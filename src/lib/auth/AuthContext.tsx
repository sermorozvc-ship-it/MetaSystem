'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient, clearUserCache, setCachedUser } from '@/lib/supabase/client'

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
 * AuthContext — единственный источник правды о текущем пользователе.
 * Использует getUser() вместо getSession() — надёжнее с createBrowserClient.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const hasResolved = useRef(false)

    const [supabase] = useState(() => createClient())
    const isLoggingOut = useRef(false)

    useEffect(() => {
        let isMounted = true

        // 1. Сначала мгновенно читаем сессию из localStorage (синхронно)
        //    Снимаем isLoading сразу — страницы рендерятся без задержки
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            if (!isMounted) return
            if (initialSession?.user) {
                setSession(initialSession)
                setUser(initialSession.user)
                setCachedUser(initialSession.user)
                // Снимаем лоадер немедленно — данные из localStorage уже достаточно надёжны
                if (!hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }
            }
            // Если сессии нет — ждём onAuthStateChange (он сработает быстро)
        })


        // 2. Подписка на изменения состояния (главный источник правды)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted || isLoggingOut.current) return

                console.log(`[Auth] Event: ${event}`, !!newSession?.user)

                // Обрабатываем сессию
                if (newSession?.user) {
                    setSession(newSession)
                    setUser(newSession.user)
                    setCachedUser(newSession.user)
                } else {
                    // Если сессии нет (вышли или INITIAL_SESSION без пользователя)
                    setSession(null)
                    setUser(null)
                    setCachedUser(null)
                }

                // Снимаем лоадер при первом получении состояния
                if (!hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }

                // Логика создания профиля
                if (event === 'SIGNED_IN' && newSession?.user) {
                    try {
                        const { data: existing } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', newSession.user.id)
                            .maybeSingle()

                        if (!existing) {
                            console.log('[Auth] Creating profile for:', newSession.user.email)
                            await supabase.from('profiles').insert({
                                id: newSession.user.id,
                                email: newSession.user.email,
                                role: 'client',
                                is_blocked: false
                            })
                        }
                    } catch (err) {
                        console.error('[Auth] Profile creation error:', err)
                    }
                }
            }
        )

        // 3. Таймаут-страховка: если onAuthStateChange не сработал за 3с — снимаем лоадер
        const timeout = setTimeout(() => {
            if (!hasResolved.current && isMounted) {
                console.warn('[Auth] Timeout — forcing isLoading=false')
                hasResolved.current = true
                setIsLoading(false)
            }
        }, 3000)

        return () => {
            isMounted = false
            subscription.unsubscribe()
            clearTimeout(timeout)
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
        if (isLoggingOut.current) return
        isLoggingOut.current = true
        setIsLoading(true)

        try {
            await supabase.auth.signOut()

            if (typeof window !== 'undefined') {
                // Удаляем только ключи Supabase, чтобы не ломать другие данные
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-')) localStorage.removeItem(key)
                })
                Object.keys(sessionStorage).forEach(key => {
                    if (key.startsWith('sb-')) sessionStorage.removeItem(key)
                })
            }

            setSession(null)
            setUser(null)
            clearUserCache()

            window.location.href = '/auth'
        } catch (e) {
            console.error('[Auth] SignOut error:', e)
            window.location.href = '/auth'
        }
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
