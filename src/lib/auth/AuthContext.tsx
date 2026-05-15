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

// Глобальный кеш сессии — переживает ремаунт компонента при навигации
// Это ключевое: при переходе между страницами isLoading сразу false
let globalSession: Session | null = null
let globalUser: User | null = null
let globalResolved = false

/**
 * AuthContext — единственный источник правды о текущем пользователе.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    // Если глобальный кеш уже есть — стартуем с isLoading=false сразу
    const [user, setUser] = useState<User | null>(globalUser)
    const [session, setSession] = useState<Session | null>(globalSession)
    const [isLoading, setIsLoading] = useState(!globalResolved)
    const hasResolved = useRef(globalResolved)

    const [supabase] = useState(() => createClient())
    const isLoggingOut = useRef(false)

    useEffect(() => {
        let isMounted = true

        // Если уже разрешили глобально — не делаем лишний getSession
        if (globalResolved) {
            setUser(globalUser)
            setSession(globalSession)
            setIsLoading(false)
            hasResolved.current = true
        } else {
            // 1. Читаем сессию из localStorage (синхронно через Supabase)
            supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
                if (!isMounted) return
                if (initialSession?.user) {
                    globalSession = initialSession
                    globalUser = initialSession.user
                    setSession(initialSession)
                    setUser(initialSession.user)
                    setCachedUser(initialSession.user)
                } else {
                    globalSession = null
                    globalUser = null
                    setSession(null)
                    setUser(null)
                    setCachedUser(null)
                }
                if (!hasResolved.current) {
                    hasResolved.current = true
                    globalResolved = true
                    setIsLoading(false)
                }
            }).catch(() => {
                if (!hasResolved.current && isMounted) {
                    hasResolved.current = true
                    globalResolved = true
                    setIsLoading(false)
                }
            })
        }

        // 2. Подписка на изменения состояния (главный источник правды)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted || isLoggingOut.current) return

                console.log(`[Auth] Event: ${event}`, !!newSession?.user)

                if (newSession?.user) {
                    globalSession = newSession
                    globalUser = newSession.user
                    setSession(newSession)
                    setUser(newSession.user)
                    setCachedUser(newSession.user)
                } else {
                    globalSession = null
                    globalUser = null
                    setSession(null)
                    setUser(null)
                    setCachedUser(null)
                }

                if (!hasResolved.current) {
                    hasResolved.current = true
                    globalResolved = true
                    setIsLoading(false)
                }

                // Создание профиля при первом входе
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
                                full_name: newSession.user.user_metadata?.full_name || null,
                                role: 'user',
                                is_blocked: false
                            })
                        }
                    } catch (err) {
                        console.error('[Auth] Profile creation error:', err)
                    }
                }
            }
        )

        // 3. Таймаут-страховка: максимум 1.5 сек
        const timeout = setTimeout(() => {
            if (!hasResolved.current && isMounted) {
                console.warn('[Auth] Timeout — forcing isLoading=false')
                hasResolved.current = true
                globalResolved = true
                setIsLoading(false)
            }
        }, 1500)

        return () => {
            isMounted = false
            subscription.unsubscribe()
            clearTimeout(timeout)
        }
    }, [supabase])

    const signUp = async (email: string, password: string, fullName?: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { 
                data: { full_name: fullName },
                emailRedirectTo: typeof window !== 'undefined' 
                    ? `${window.location.origin}/auth?mode=login` 
                    : undefined
            }
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

        // Сбрасываем глобальный кеш
        globalSession = null
        globalUser = null
        globalResolved = false

        try {
            await supabase.auth.signOut()

            if (typeof window !== 'undefined') {
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
