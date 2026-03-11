import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Кеш для пользователя — заполняется из AuthContext через setCachedUser()
let cachedUser: User | null = null
let userCacheTimestamp = 0
const USER_CACHE_TTL = 60000  // 1 минута — кеш актуален долго

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

async function inTabLock<R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> {
    const startTime = Date.now()

    // Ждём предыдущую операцию с тем же именем (если есть)
    const prev = lockQueues.get(name)
    if (prev) {
        try {
            // Ждём завершения предыдущей операции, но не больше acquireTimeout
            await Promise.race([
                prev,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Lock acquire timeout: ${name}`)), 
                        Math.max(acquireTimeout - (Date.now() - startTime), 0))
                )
            ])
        } catch (e: any) {
            // Если предыдущая операция упала или таймаут — продолжаем
            if (e?.message?.includes('Lock acquire timeout')) {
                console.warn(`[inTabLock] Timeout waiting for lock "${name}", proceeding anyway`)
            }
        }
    }

    // Создаём промис для текущей операции и ставим его в очередь
    let resolveCurrent: () => void
    const currentPromise = new Promise<void>(r => resolveCurrent = r)
    lockQueues.set(name, currentPromise)

    try {
        return await fn()
    } finally {
        resolveCurrent!()
        // Чистим очередь если это последняя операция
        if (lockQueues.get(name) === currentPromise) {
            lockQueues.delete(name)
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
                // Не сбрасываем кеш если timeout — возвращаем старое значение
                if (cachedUser) {
                    console.log('[safeGetUser] getUser returned null but cache exists, keeping cache')
                    return cachedUser
                }
                cachedUser = null
            }
            return user
        } catch (err: any) {
            console.warn('[safeGetUser] Exception:', err.message)
            // При ошибке возвращаем кешированного пользователя (если есть)
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
