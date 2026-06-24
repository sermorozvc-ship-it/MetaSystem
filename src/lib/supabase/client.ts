import { createClient as createSupabaseBrowserClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

let client: SupabaseClient | undefined
let authStorageKey: string | null = null

function getAuthStorageKey(): string {
    if (authStorageKey) return authStorageKey
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return 'sb-local-auth-token'
    try {
        const hostname = new URL(supabaseUrl).hostname
        const projectRef = hostname.split('.')[0]
        authStorageKey = `sb-${projectRef}-auth-token`
        return authStorageKey
    } catch {
        return 'sb-local-auth-token'
    }
}

const browserStorage = {
    getItem(key: string) {
        if (typeof window === 'undefined') return null
        try {
            const value = window.localStorage.getItem(key)
            if (!value && key === getAuthStorageKey()) {
                pushAuthDebugEvent('storage_get_miss', { key })
            }
            return value
        } catch (e) {
            pushAuthDebugEvent('storage_get_error', { key, message: e instanceof Error ? e.message : String(e) })
            return null
        }
    },
    setItem(key: string, value: string) {
        if (typeof window === 'undefined') return
        try {
            window.localStorage.setItem(key, value)
            if (key === getAuthStorageKey()) {
                pushAuthDebugEvent('storage_set', { key, size: value.length })
            }
        } catch (e) {
            pushAuthDebugEvent('storage_set_error', { key, message: e instanceof Error ? e.message : String(e) })
        }
    },
    removeItem(key: string) {
        if (typeof window === 'undefined') return
        try {
            window.localStorage.removeItem(key)
            if (key === getAuthStorageKey()) {
                pushAuthDebugEvent('storage_remove', { key })
            }
        } catch (e) {
            pushAuthDebugEvent('storage_remove_error', { key, message: e instanceof Error ? e.message : String(e) })
        }
    },
}

function pushAuthDebugEvent(type: string, details?: Record<string, any>) {
    try {
        if (typeof window === 'undefined') return
        const stateKey = '__authDebug'
        const storageKey = 'auth_debug_events'
        let prev: any[] = []
        try {
            const raw = localStorage.getItem(storageKey)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) prev = parsed
            }
        } catch { /* noop */ }

        const event = {
            ts: new Date().toISOString(),
            type,
            details,
        }
        const next = [...prev, event].slice(-200)
        ;(window as any)[stateKey] = {
            events: next,
            dump: () => next,
            latest: () => next[next.length - 1] ?? null,
            clear: () => {
                try { localStorage.removeItem(storageKey) } catch { /* noop */ }
                ;(window as any)[stateKey].events = []
            },
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify(next))
        } catch { /* noop */ }
    } catch {
        // noop
    }
}

// Кеш для пользователя — заполняется из AuthContext через setCachedUser()
let cachedUser: User | null = null
let userCacheTimestamp = 0
const USER_CACHE_TTL = 10000  // 10 секунд — быстрая инвалидация при смене аккаунта

/**
 * Внутри-табовый мьютекс для Supabase Auth.
 * 
 * Вместо глобального disableLocks (который убирал ВСЮ блокировку и вызывал
 * race condition при F5 refresh), используем кастомную lock-функцию, которую 
 * передаём прямо в Supabase client.
 * 
 * Логика:
 * - Сериализует запросы ВНУТРИ одной вкладки (предотвращает race condition при refresh)
 * - НЕ блокирует МЕЖДУ вкладками (предотвращает deadlock при нескольких вкладках)
 * - Имеет таймаут acquireTimeout для предотвращения бесконечного ожидания
 */
const lockQueues = new Map<string, Promise<any>>()

// Время жизни lock. Если lock «висит» дольше этого — значит fn() завис навсегда
// (сеть умерла, таб заморожен). Принудительно снимаем, чтобы не блокировать
// следующие операции (upsert и т.д.).
const LOCK_MAX_HOLD_MS = 5_000

// Отслеживаем время захвата lock для каждого имени.
const lockAcquiredAt = new Map<string, number>()

async function inTabLock<R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> {
    const startTime = Date.now()

    // Ждём предыдущую операцию с тем же именем (если есть).
    // Если предыдущий lock «протух» (держится дольше LOCK_MAX_HOLD_MS) —
    // не ждём его, а принудительно снимаем и идём дальше.
    const prev = lockQueues.get(name)
    if (prev) {
        const prevAcquiredAt = lockAcquiredAt.get(name) ?? 0
        const heldFor = Date.now() - prevAcquiredAt
        if (heldFor > LOCK_MAX_HOLD_MS) {
            console.warn(`[inTabLock] Stale lock "${name}" held for ${heldFor}ms — force-releasing`)
            lockQueues.delete(name)
            lockAcquiredAt.delete(name)
        } else {
            try {
                await Promise.race([
                    prev,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Lock acquire timeout: ${name}`)),
                            Math.max(acquireTimeout - (Date.now() - startTime), 0))
                    )
                ])
            } catch (e: any) {
                if (e?.message?.includes('Lock acquire timeout')) {
                    console.warn(`[inTabLock] Timeout waiting for lock "${name}", proceeding anyway`)
                }
            }
        }
    }

    // Создаём промис для текущей операции и ставим его в очередь
    let resolveCurrent: () => void
    const currentPromise = new Promise<void>(r => resolveCurrent = r)
    lockQueues.set(name, currentPromise)
    lockAcquiredAt.set(name, Date.now())

    try {
        return await fn()
    } finally {
        resolveCurrent!()
        if (lockQueues.get(name) === currentPromise) {
            lockQueues.delete(name)
            lockAcquiredAt.delete(name)
        }
    }
}

/**
 * Создаёт браузерный Supabase client.
 * Singleton — один инстанс на всё приложение.
 *
 * Используем обычный `@supabase/supabase-js` browser client вместо
 * `@supabase/ssr createBrowserClient`: для долгоживущих client-side страниц
 * (часовая тренировка) нам критична предсказуемая persistSession-логика с
 * явным localStorage adapter, а не SSR-абстракция.
 *
 * Кастомный lock сохраняем, чтобы не вернуть старые race/deadlock проблемы.
 */
export function createClient(): SupabaseClient {
    if (client) return client

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        if (typeof window !== 'undefined') {
            console.error('CRITICAL: Supabase env vars missing!')
        }
        const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
        return createSupabaseClient('https://mock.supabase.co', 'mock-key', { auth: { persistSession: false } })
    }

    client = createSupabaseBrowserClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: getAuthStorageKey(),
            storage: browserStorage as any,
            // Кастомная lock-функция: сериализует внутри вкладки, не блокирует между
            lock: inTabLock,
        }
    })

    if (typeof window !== 'undefined') {
        pushAuthDebugEvent('client_created', {
            storageKey: getAuthStorageKey(),
            hasStoredSession: !!window.localStorage.getItem(getAuthStorageKey()),
        })

        client.auth.onAuthStateChange((event, session) => {
            pushAuthDebugEvent('auth_state_change', {
                event,
                hasSession: !!session,
                hasAccessToken: !!session?.access_token,
                userId: session?.user?.id ?? null,
            })
        })

        window.addEventListener('storage', (e) => {
            if (e.key === getAuthStorageKey()) {
                pushAuthDebugEvent('storage_event', {
                    key: e.key,
                    hasOldValue: !!e.oldValue,
                    hasNewValue: !!e.newValue,
                })
            }
        })
    }
    return client
}

// Семафор для предотвращения параллельных запросов
let getUserPromise: Promise<User | null> | null = null

/**
 * Вспомогательная функция: Promise с таймаутом
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`[safeGetUser] Auth notice: Auth Timeout (${ms}ms)`)
            resolve(fallback)
        }, ms))
    ])
}

/**
 * Безопасное получение пользователя.
 * Приоритет: кеш из AuthContext → один запрос getUser() с таймаутом 3 сек.
 * 
 * ВАЖНО: Если кеш есть — возвращаем мгновенно, без сетевых запросов.
 * Это критично для предотвращения deadlock при параллельных вызовах
 * из Sidebar, AdminPage и других компонентов.
 */
export async function safeGetUser(): Promise<User | null> {
    const now = Date.now()

    // 1. Кеш есть и актуален — мгновенный ответ (без сети!)
    if (cachedUser && (now - userCacheTimestamp) < USER_CACHE_TTL) {
        pushAuthDebugEvent('safe_get_user_cache_hit', { ageMs: now - userCacheTimestamp })
        return cachedUser
    }

    // 2. Запрос уже идёт — ждём его, не создаём дубликат
    if (getUserPromise) {
        pushAuthDebugEvent('safe_get_user_join_inflight')
        return getUserPromise
    }

    getUserPromise = (async () => {
        const supabase = createClient()
        try {
            // getUser с таймаутом 4 секунды — не ждём бесконечно
            const result = await withTimeout(
                supabase.auth.getUser(),
                4000,
                { data: { user: null }, error: null } as any
            )

            const user = result?.data?.user ?? null

            if (user) {
                cachedUser = user
                userCacheTimestamp = Date.now()
                pushAuthDebugEvent('safe_get_user_ok', { userId: user.id })
            } else {
                if (result?.error) {
                    console.warn('[safeGetUser] auth error, clearing cache:', result.error?.message ?? result.error)
                    pushAuthDebugEvent('safe_get_user_auth_error', { message: result.error?.message ?? String(result.error) })
                    cachedUser = null
                    userCacheTimestamp = 0
                } else if (cachedUser) {
                    console.log('[safeGetUser] getUser returned null (timeout) but cache exists, keeping cache')
                    pushAuthDebugEvent('safe_get_user_timeout_keep_cache')
                    return cachedUser
                } else {
                    pushAuthDebugEvent('safe_get_user_null_no_cache')
                    cachedUser = null
                }
            }
            return user
        } catch (err: any) {
            console.warn('[safeGetUser] Exception:', err.message)
            pushAuthDebugEvent('safe_get_user_exception', { message: err?.message ?? String(err) })
            return cachedUser
        } finally {
            getUserPromise = null
        }
    })()

    return getUserPromise
}

/**
 * Устанавливает кеш пользователя (вызывается из AuthContext)
 */
export function setCachedUser(user: User | null) {
    cachedUser = user
    userCacheTimestamp = user ? Date.now() : 0
}

/**
 * Очистка кеша (при логуте)
 */
export function clearUserCache() {
    cachedUser = null
    userCacheTimestamp = 0
}

/**
 * Быстрая проверка валидности сессии (без сетевых запросов).
 * Декодирует JWT из localStorage и проверяет exp.
 * Возвращает true если токен ещё жив (с запасом 60с).
 */
export async function isSessionValid(): Promise<boolean> {
    try {
        if (typeof window === 'undefined') return false
        const supabase = createClient()
        // getSession() — синхронное чтение из storage, без сети
        const { data: { session } } = await getSessionSync(supabase)
        if (!session?.access_token) return false
        // Декодируем JWT payload (base64url)
        const parts = session.access_token.split('.')
        if (parts.length !== 3) return false
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        // Проверяем exp с запасом 60 секунд
        const nowSec = Math.floor(Date.now() / 1000)
        return payload.exp > nowSec + 60
    } catch {
        return false
    }
}

/**
 * Попытка обновить сессию. Возвращает true если обновление прошло успешно.
 * Используется перед критическими операциями (Завершить тренировку).
 */
export async function tryRefreshSession(): Promise<boolean> {
    try {
        if (typeof window === 'undefined') return false
        const supabase = createClient()
        const { data, error } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<{ data: { session: null }; error: null }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null }, error: null }), 3_000)
            ),
        ])
        if (data?.session?.access_token) {
            // Токен есть — проверяем не протух ли
            const parts = data.session.access_token.split('.')
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
                const nowSec = Math.floor(Date.now() / 1000)
                if (payload.exp > nowSec + 60) return true
            }
        }
        // Токена нет или он протух — пробуем refresh
        const { data: refreshData } = await Promise.race([
            supabase.auth.refreshSession(),
            new Promise<{ data: { session: null } }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null } }), 5_000)
            ),
        ])
        return !!refreshData?.session?.access_token
    } catch {
        return false
    }
}

// Синхронное чтение сессии (обёртка для типизации)
async function getSessionSync(supabase: SupabaseClient) {
    return supabase.auth.getSession()
}

// ─── Direct fetch: обход Supabase-клиента ───────────────────────────────
// Проблема: supabase.from().upsert() ВНУТРЕННЕ вызывает getSession() →
// inTabLock → если сессия «протухла» → клиент пытается обновить токен →
// сеть мёртвая → висит навсегда (12с таймаут, POST никогда не уходит).
//
// Решение: читаем access_token из localStorage и делаем прямой fetch к
// Supabase REST API. Без lock'ов, без auth-refresh, без зависаний.

async function getStoredAccessToken(): Promise<string | null> {
    const { token } = await getAccessTokenWithRecovery()
    return token
}

function getSupabaseRestUrl(): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
}

function getSupabaseAnonKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
}

function isJwtFresh(accessToken: string, skewSeconds: number = 60): boolean {
    try {
        const parts = accessToken.split('.')
        if (parts.length !== 3) return false
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        const nowSec = Math.floor(Date.now() / 1000)
        return payload.exp > nowSec + skewSeconds
    } catch {
        return false
    }
}

function readStoredTokenFromLocalStorage(): string | null {
    if (typeof window === 'undefined') return null

    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        if (k.includes('auth-token') || k.includes('auth_token')) {
            const raw = localStorage.getItem(k)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            if (parsed?.access_token) return parsed.access_token
        }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
        const hostname = new URL(supabaseUrl).hostname
        const projectRef = hostname.split('.')[0]
        const key = `sb-${projectRef}-auth-token`
        const raw = localStorage.getItem(key)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.access_token) return parsed.access_token
        }
    }

    return null
}

async function getSessionWithTimeout(
    supabase: SupabaseClient,
    timeoutMs: number,
): Promise<Session | null> {
    const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
    return result?.data?.session ?? null
}

async function refreshSessionWithTimeout(
    supabase: SupabaseClient,
    timeoutMs: number,
): Promise<Session | null> {
    const result = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
    return result?.data?.session ?? null
}

export type AccessTokenStatus = 'fresh' | 'refreshed' | 'expired' | 'missing' | 'refresh_failed'

export async function getAccessTokenWithRecovery(): Promise<{
    token: string | null
    status: AccessTokenStatus
}> {
    try {
        if (typeof window === 'undefined') {
            return { token: null, status: 'missing' }
        }

        // ПРИОРИТЕТ: localStorage → синхронно и мгновенно.
        // Чтение из storage не зависит от inTabLock и не висит на auth-refresh.
        // Это критично для handleCompleteDay / directSupabaseFetch, когда
        // autosave держит inTabLock и.getSession() таймаутится на 3с × N вызовов.
        const storedToken = readStoredTokenFromLocalStorage()
        if (storedToken && isJwtFresh(storedToken)) {
            pushAuthDebugEvent('token_fresh_from_storage')
            return { token: storedToken, status: 'fresh' }
        }

        const supabase = createClient()

        // localStorage не помог (нет токена или протух) — идём через Supabase клиент.
        // getSession → inTabLock, может таймаутиться если autosave держит lock.
        const session = await getSessionWithTimeout(supabase, 3_000)
        if (session?.access_token) {
            if (isJwtFresh(session.access_token)) {
                pushAuthDebugEvent('token_fresh_from_session')
                return { token: session.access_token, status: 'fresh' }
            }

            console.warn('[auth] access token expired in session, trying refresh')
            pushAuthDebugEvent('token_expired_in_session')
            const refreshed = await refreshSessionWithTimeout(supabase, 5_000)
            if (refreshed?.access_token && isJwtFresh(refreshed.access_token, 15)) {
                pushAuthDebugEvent('token_refreshed_after_session_expired')
                return { token: refreshed.access_token, status: 'refreshed' }
            }

            // Refresh не помог — повторно пробуем localStorage (мог обновиться)
            const recoveredToken = readStoredTokenFromLocalStorage()
            if (recoveredToken && isJwtFresh(recoveredToken, 15)) {
                console.warn('[auth] recovered token from localStorage after refresh failure')
                pushAuthDebugEvent('token_recovered_from_storage_after_refresh_failure')
                return { token: recoveredToken, status: 'refreshed' }
            }

            pushAuthDebugEvent('token_expired_no_recovery')
            return { token: null, status: 'expired' }
        }

        // Пробуем refresh напрямую (localStorage и session не дали результат)
        console.warn('[auth] no fresh token anywhere, trying refresh')
        pushAuthDebugEvent('token_missing_before_refresh')
        const refreshed = await refreshSessionWithTimeout(supabase, 5_000)
        if (refreshed?.access_token && isJwtFresh(refreshed.access_token, 15)) {
            pushAuthDebugEvent('token_refreshed_after_missing')
            return { token: refreshed.access_token, status: 'refreshed' }
        }

        pushAuthDebugEvent('token_missing_no_recovery')
        return { token: null, status: 'missing' }
    } catch (e) {
        console.warn('[auth] getAccessTokenWithRecovery failed:', e)
        pushAuthDebugEvent('token_recovery_exception', { message: e instanceof Error ? e.message : String(e) })
        return { token: null, status: 'refresh_failed' }
    }
}

/**
 * Прямой fetch к Supabase REST API с access_token из localStorage.
 * Не использует Supabase-клиент → не висит на auth-lock / token refresh.
 */
export async function directSupabaseFetch<T>(
    table: string,
    options: {
        method: 'POST' | 'PATCH' | 'GET'
        body?: any
        params?: string
        prefer?: string
    },
    timeoutMs: number = 10_000,
): Promise<T> {
    const { token, status } = await getAccessTokenWithRecovery()
    if (!token) {
        throw new Error(`Not authenticated (${status})`)
    }

    if (status === 'refreshed') {
        console.info(`[auth] directSupabaseFetch recovered session for ${options.method} ${table}`)
    }

    const urlObj = new URL(`${getSupabaseRestUrl()}/${table}`)
    if (options.params) {
        const searchParams = new URLSearchParams(options.params)
        urlObj.search = searchParams.toString()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(urlObj.toString(), {
            method: options.method,
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': getSupabaseAnonKey(),
                'Content-Type': 'application/json',
                'Prefer': options.prefer ?? 'return=representation',
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        })

        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`Supabase REST ${options.method} ${table} failed (${res.status}): ${text}`)
        }

        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
            return await res.json()
        }
        return undefined as T
    } finally {
        clearTimeout(timer)
    }
}
