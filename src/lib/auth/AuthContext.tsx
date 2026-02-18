'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient, clearUserCache } from '@/lib/supabase/client'

interface AuthContextType {
    user: User | null
    session: Session | null
    isLoading: boolean
    signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Синхронно читаем сессию из localStorage — это мгновенно!
 * Позволяет показать UI до завершения сетевого запроса.
 */
function getInitialSessionFromStorage(): { user: User | null; session: Session | null } {
    if (typeof window === 'undefined') return { user: null, session: null }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl) return { user: null, session: null }

        const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
        const storageKey = `sb-${projectRef}-auth-token`
        const stored = localStorage.getItem(storageKey)

        if (!stored) return { user: null, session: null }

        const parsed = JSON.parse(stored)

        // Проверяем не истёк ли access_token
        if (parsed?.expires_at) {
            const expiresAt = parsed.expires_at * 1000
            if (Date.now() > expiresAt) {
                // Токен истёк, но refresh_token может быть валидным — 
                // пусть getSession() обновит. Пока возвращаем null.
                return { user: null, session: null }
            }
        }

        if (parsed?.user) {
            return { user: parsed.user, session: parsed as Session }
        }
        return { user: null, session: null }
    } catch {
        return { user: null, session: null }
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    // Ключевое изменение: инициализируем user/session СИНХРОННО из localStorage
    // Это позволяет страницам сразу начать загрузку данных без ожидания getSession()
    const [initialData] = useState(() => getInitialSessionFromStorage())
    const [user, setUser] = useState<User | null>(initialData.user)
    const [session, setSession] = useState<Session | null>(initialData.session)
    // Если есть данные в localStorage — считаем что auth уже готов!
    const [isLoading, setIsLoading] = useState(!initialData.user)
    const hasResolved = useRef(!!initialData.user)

    const [supabase] = useState(() => createClient())

    // Safety timeout — если getSession зависнет, принудительно снимаем loading
    useEffect(() => {
        if (hasResolved.current) return

        const timer = setTimeout(() => {
            if (!hasResolved.current) {
                console.warn('[Auth] Force-resolving after safety timeout')
                hasResolved.current = true
                setIsLoading(false)
            }
        }, 2000) // 2 секунды — достаточно для нормальной сети

        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        let isMounted = true

        // Фоновая валидация сессии — не блокирует UI
        const validateSession = async () => {
            try {
                // Таймаут 3 секунды — если Supabase не ответил, не ждём
                const sessionPromise = supabase.auth.getSession()
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Session timeout')), 3000)
                )

                const { data: { session: currentSession }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>

                if (!isMounted) return

                if (!error && currentSession) {
                    setSession(currentSession)
                    setUser(currentSession.user)
                } else if (!error && !currentSession) {
                    // Сессия отсутствует на сервере — пользователь вышел
                    setSession(null)
                    setUser(null)
                }
                // При ошибке — оставляем текущие значения (из localStorage)
            } catch (e: any) {
                // При ошибке сети или таймауте — оставляем данные из localStorage
                console.warn('[Auth] Session validation failed:', e.message)
            } finally {
                if (isMounted && !hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }
            }
        }

        validateSession()

        // Слушаем изменения auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted) return

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (!hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }

                // Создаём профиль при регистрации
                if (event === 'SIGNED_IN' && newSession?.user) {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', newSession.user.id)
                            .single()

                        if (!profile) {
                            await supabase.from('profiles').insert({
                                id: newSession.user.id,
                                email: newSession.user.email,
                                full_name: newSession.user.user_metadata?.full_name
                            })
                        }
                    } catch {
                        // silently fail
                    }
                }
            }
        )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [supabase])

    const signUp = async (email: string, password: string, fullName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        })
        return { error: error as Error | null }
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        clearUserCache()
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
