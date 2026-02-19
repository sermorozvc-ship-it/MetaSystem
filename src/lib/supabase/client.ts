import { createClient as createSupabaseClient, SupabaseClient, User } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Кеш для пользователя
let cachedUser: User | null = null
let userCacheTimestamp = 0
const USER_CACHE_TTL = 30000 // 30 секунд — достаточно для предотвращения race conditions

export function createClient(): SupabaseClient {
    if (client) return client

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        if (typeof window !== 'undefined') {
            console.error('CRITICAL: Supabase variables are missing! Check .env.local file.')
        }

        // Мок-объект с цепочкой методов, чтобы ничего не падало
        const mockFn = () => ({
            select: mockFn,
            insert: mockFn,
            update: mockFn,
            upsert: mockFn,
            delete: mockFn,
            eq: mockFn,
            or: mockFn,
            order: mockFn,
            single: () => Promise.resolve({ data: null, error: null }),
            then: (fn: any) => Promise.resolve({ data: [], error: null }).then(fn)
        })

        return {
            auth: {
                getUser: async () => ({ data: { user: null }, error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                getSession: async () => ({ data: { session: null }, error: null }),
                signOut: async () => { }
            },
            from: mockFn,
            storage: {
                from: () => ({
                    upload: async () => ({ data: null, error: new Error('Missing Config') }),
                    getPublicUrl: () => ({ data: { publicUrl: '' } })
                })
            }
        } as any
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
                // Отключаем Web Locks корректно через конфиг
                // @ts-ignore
                isLockingSupported: false
            }
        }
    )

    return client
}

// Симафор для предотвращения параллельных запросов к auth
let getUserPromise: Promise<User | null> | null = null

/**
 * Безопасное получение пользователя с кешированием и защитой от параллелизма
 */
export async function safeGetUser(): Promise<User | null> {
    const now = Date.now()
    if (cachedUser && (now - userCacheTimestamp) < USER_CACHE_TTL) {
        return cachedUser
    }

    // Если запрос уже идет — ждем его, а не создаем новый
    if (getUserPromise) return getUserPromise

    getUserPromise = (async () => {
        const supabase = createClient()
        try {
            console.log('[safeGetUser] Fetching fresh session...')

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
                return cachedUser // Возвращаем что есть в кеше
            }

            const user = session?.user ?? null
            cachedUser = user
            userCacheTimestamp = Date.now()
            return user
        } catch (error: any) {
            console.warn('[safeGetUser] Critical failure:', error.message)
            return cachedUser
        } finally {
            getUserPromise = null
        }
    })()

    return getUserPromise
}

/**
 * Очистка кеша пользователя
 */
export function clearUserCache() {
    cachedUser = null
    userCacheTimestamp = 0
}

