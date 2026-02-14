import { createClient as createSupabaseClient, SupabaseClient, User } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Кеш для пользователя
let cachedUser: User | null = null
let userCacheTimestamp = 0
const USER_CACHE_TTL = 5000

export function createClient(): SupabaseClient {
    if (client) return client

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Если переменных нет, выводим ошибку в консоль, но не возвращаем null, 
    // чтобы не вызывать client-side exception при обращении к методам
    if (!supabaseUrl || !supabaseKey) {
        if (typeof window !== 'undefined') {
            console.error('CRITICAL: Supabase variables are missing! Check Vercel Environment Variables.')
        }
        // Возвращаем объект-пустышку, чтобы методы типа .auth не вызывали ошибку на черном экране
        return {} as any
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
 */
export async function safeGetUser(): Promise<User | null> {
    const now = Date.now()

    if (cachedUser && (now - userCacheTimestamp) < USER_CACHE_TTL) {
        return cachedUser
    }

    const supabase = createClient()

    try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
                console.warn('getUser aborted, returning cached user')
                return cachedUser
            }
            console.error('getUser error:', error)
            return cachedUser
        }

        cachedUser = user
        userCacheTimestamp = now
        return user
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.warn('getUser aborted (catch), returning cached user')
            return cachedUser
        }
        console.error('getUser exception:', error)
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
