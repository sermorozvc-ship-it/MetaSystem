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
            console.error('CRITICAL: Supabase variables are missing! Check Vercel Environment Variables.')
        }
        // Возвращаем мок-объект, который имитирует методы Supabase
        // Это предотвратит падение всего приложения
        return {
            auth: {
                getUser: async () => ({ data: { user: null }, error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                getSession: async () => ({ data: { session: null }, error: null }),
            },
            from: () => ({
                select: () => ({ order: () => ({ data: [], error: null }) }),
                insert: () => ({ error: null }),
                update: () => ({ error: null }),
            }),
        } as any
    }

    // Используем @supabase/supabase-js напрямую с отключенными locks
    client = createSupabaseClient(
        supabaseUrl,
        supabaseKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                flowType: 'implicit',
                // Отключаем Web Locks
                lock: async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
                    // Выполняем функцию напрямую без блокировок
                    return await fn()
                }
            }
        }
    )

    return client
}

/**
 * Безопасное получение пользователя с кешированием
 * Никогда не кидает ошибки — всегда возвращает User | null
 */
export async function safeGetUser(): Promise<User | null> {
    const now = Date.now()

    if (cachedUser && (now - userCacheTimestamp) < USER_CACHE_TTL) {
        return cachedUser
    }

    const supabase = createClient()

    try {
        // Используем getSession вместо getUser — это быстрее и не делает лишний запрос к серверу
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
                console.warn('[safeGetUser] getSession aborted, returning cached user')
                return cachedUser
            }
            console.error('[safeGetUser] getSession error:', error.message)
            return cachedUser
        }

        const user = session?.user ?? null
        cachedUser = user
        userCacheTimestamp = now
        return user
    } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('abort') || error.message?.includes('Failed to fetch')) {
            console.warn('[safeGetUser] request failed, returning cached user')
            return cachedUser
        }
        console.error('[safeGetUser] exception:', error.message)
        return cachedUser
    }
}

/**
 * Очистка кеша пользователя
 */
export function clearUserCache() {
    cachedUser = null
    userCacheTimestamp = 0
}

