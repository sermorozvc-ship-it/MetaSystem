import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

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
 * Создаёт Supabase клиент для браузера через @supabase/ssr.
 * Singleton — один инстанс на всё приложение.
 * 
 * Использует кастомную lock-функцию вместо navigator.locks
 * для предотвращения deadlock И race condition одновременно.
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

    client = createBrowserClient(supabaseUrl, supabaseKey, {
        auth: {
            // Кастомная lock-функция: сериализует внутри вкладки, не блокирует между
            lock: inTabLock,
        }
    })
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
        return cachedUser
    }

    // 2. Запрос уже идёт — ждём его, не создаём дубликат
    if (getUserPromise) return getUserPromise

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
            } else {
                // Различаем auth error (сессия истекла) и timeout (сеть недоступна).
                // При auth error — сбрасываем кеш, чтобы вызывающий код получил null
                // и мог показать сообщение «сессия истекла» вместо вечных ошибок 401.
                // При timeout — сохраняем кеш (сеть временно недоступна, сессия может
                // быть валидной).
                if (result?.error) {
                    console.warn('[safeGetUser] auth error, clearing cache:', result.error?.message ?? result.error)
                    cachedUser = null
                    userCacheTimestamp = 0
                } else if (cachedUser) {
                    console.log('[safeGetUser] getUser returned null (timeout) but cache exists, keeping cache')
                    return cachedUser
                } else {
                    cachedUser = null
                }
            }
            return user
        } catch (err: any) {
            console.warn('[safeGetUser] Exception:', err.message)
            // При сетевой ошибке (promise rejected) — возвращаем кеш, сеть может
            // быть временно недоступна.
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
 * Очистка кеша (при логауте)
 */
export function clearUserCache() {
    cachedUser = null
    userCacheTimestamp = 0
}

// ─── Direct fetch: обход Supabase-клиента ───────────────────────────────
// Проблема: supabase.from().upsert() ВНУТРЕННЕ вызывает getSession() →
// inTabLock → если сессия «протухла» → клиент пытается обновить токен →
// сеть мёртвая → висит навсегда (12с таймаут, POST никогда не уходит).
//
// Решение: читаем access_token из localStorage и делаем прямой fetch к
// Supabase REST API. Без lock'ов, без auth-refresh, без зависаний.

async function getStoredAccessToken(): Promise<string | null> {
    try {
        if (typeof window === 'undefined') return null

        // Основной способ: SDK сам знает где хранит сессию (localStorage, cookies и т.д.)
        // getSession() не делает сетевых запросов — безопасно, не вызывает deadlock.
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) return session.access_token

        // Fallback: ручной поиск в localStorage (если SDK не может прочитать сессию)
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

        // Fallback: пробуем стандартный ключ sb-{projectRef}-auth-token
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

        console.warn('[getStoredAccessToken] No access token found')
        return null
    } catch {
        return null
    }
}

function getSupabaseRestUrl(): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
}

function getSupabaseAnonKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
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
    const token = await getStoredAccessToken()
    if (!token) throw new Error('Not authenticated (no access token in storage)')

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
