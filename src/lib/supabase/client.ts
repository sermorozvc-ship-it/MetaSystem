import { createClient as createSupabaseClient, SupabaseClient, User } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Кеш для пользователя
let cachedUser: User | null = null
let userCacheTimestamp = 0
let nullCacheTimestamp = 0
const USER_CACHE_TTL = 30000 // 30 секунд для валидного пользователя
const NULL_CACHE_TTL = 5000  // 5 секунд для null — чтобы не забивать Supabase впустую

export function createClient(): SupabaseClient {
    if (client) return client

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        if (typeof window !== 'undefined') {
            console.error('CRITICAL: Supabase variables are missing! Check .env.local file.')
        }
        return createSupabaseClient('https://mock.supabase.co', 'mock-key', { auth: { persistSession: false } })
    }

    client = createSupabaseClient(
        supabaseUrl,
        supabaseKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'implicit',
                // @ts-ignore
                isLockingSupported: false
            }
        }
    )

    return client
}

// Семафор для предотвращения параллельных запросов к auth
let getUserPromise: Promise<User | null> | null = null

/**
 * Безопасное получение пользователя с кешированием и защитой от параллелизма.
 * Кеширует и null-результат на 5 секунд, чтобы не забивать Supabase бессмысленными запросами.
 */
export async function safeGetUser(): Promise<User | null> {
    const now = Date.now()

    // Если есть валидный кеш пользователя — возвращаем
    if (cachedUser && (now - userCacheTimestamp) < USER_CACHE_TTL) {
        return cachedUser
    }

    // Если недавно получили null — не долбим Supabase повторно
    if (!cachedUser && nullCacheTimestamp > 0 && (now - nullCacheTimestamp) < NULL_CACHE_TTL) {
        return null
    }

    // Если запрос уже идет — ждем его, а не создаем новый
    if (getUserPromise) return getUserPromise

    getUserPromise = (async () => {
        const supabase = createClient()
        try {
            const sessionPromise = supabase.auth.getSession()
            const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((res) =>
                setTimeout(() => res({ data: { session: null }, error: new Error('Auth Timeout') }), 3000)
            )

            const { data: { session }, error } = await Promise.race([
                sessionPromise,
                timeoutPromise
            ]) as any

            if (error) {
                console.warn('[safeGetUser] Auth notice:', error.message)
                nullCacheTimestamp = Date.now()
                return cachedUser
            }

            const user = session?.user ?? null
            if (user) {
                cachedUser = user
                userCacheTimestamp = Date.now()
                nullCacheTimestamp = 0
            } else {
                cachedUser = null
                nullCacheTimestamp = Date.now()
            }
            return user
        } catch (error: any) {
            console.warn('[safeGetUser] Critical failure:', error.message)
            nullCacheTimestamp = Date.now()
            return cachedUser
        } finally {
            getUserPromise = null
        }
    })()

    return getUserPromise
}

/**
 * Очистка кеша пользователя (при логине/логауте)
 */
export function clearUserCache() {
    cachedUser = null
    userCacheTimestamp = 0
    nullCacheTimestamp = 0
}
