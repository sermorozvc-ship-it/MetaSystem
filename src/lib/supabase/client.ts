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
        console.error('CRITICAL: Supabase variables are missing! client.ts', {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey
        })

        // Возвращаем мок-объект, чтобы приложение не упало с ошибкой "cannot read property auth of undefined"
        return {
            auth: {
                getUser: async () => ({ data: { user: null }, error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                getSession: async () => ({ data: { session: null }, error: null }),
            },
            from: () => ({
                select: () => ({ order: () => ({ eq: () => ({ data: [], error: null }), data: [], error: null }) }),
                insert: () => ({ error: null }),
                update: () => ({ error: null }),
                upsert: () => ({ error: null }),
                delete: () => ({ eq: () => ({ error: null }) }),
            }),
            storage: {
                from: () => ({
                    upload: async () => ({ data: null, error: new Error('Missing Supabase Config') }),
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
                flowType: 'pkce' // PKCE более надежен для современных браузеров
            }
        }
    )

    return client
}

/**
 * Безопасное получение пользователя с кешированием
 * Никогда не кидает фатальные ошибки — всегда возвращает User | null
 */
export async function safeGetUser(): Promise<User | null> {
    const now = Date.now()

    if (cachedUser && (now - userCacheTimestamp) < USER_CACHE_TTL) {
        return cachedUser
    }

    const supabase = createClient()

    try {
        // Таймаут для получения сессии — 5 секунд
        const timeout = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        )

        const sessionPromise = supabase.auth.getSession()

        const result = await Promise.race([sessionPromise, timeout]) as any
        const session = result?.data?.session ?? null

        const user = session?.user ?? null
        cachedUser = user
        userCacheTimestamp = now
        return user
    } catch (error: any) {
        console.warn('[safeGetUser] failed or timeout:', error.message)
        // Если есть старый кеш — используем его, это лучше чем ничего
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

