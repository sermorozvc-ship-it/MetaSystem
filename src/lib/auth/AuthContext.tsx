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
 * AuthContext использует createBrowserClient из @supabase/ssr
 * который хранит сессию в COOKIES (не localStorage).
 * Поэтому синхронное чтение из localStorage невозможно — 
 * сессия определяется асинхронно через getSession().
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true) // Начинаем с true — ждём getSession()
    const hasResolved = useRef(false)

    const [supabase] = useState(() => createClient())
    const isValidating = useRef(false)
    const isLoggingOut = useRef(false)

    useEffect(() => {
        let isMounted = true

        const validateSession = async () => {
            if (isValidating.current || isLoggingOut.current) return
            isValidating.current = true

            console.log('[Auth] Validating session...')
            try {
                // Пытаемся получить сессию с жестким таймаутом (уменьшили до 2с для большей отзывчивости)
                const sessionPromise = supabase.auth.getSession()
                const timeoutPromise = new Promise<{ data: { session: Session | null }, error: any }>((res) =>
                    setTimeout(() => res({ data: { session: null }, error: new Error('Auth Timeout') }), 8000)
                )

                const result = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ])

                const { data: { session: currentSession }, error } = result

                if (!isMounted) return

                if (error) {
                    console.warn('[Auth] getSession error/timeout:', error.message)
                    // Не сбрасываем всё сразу, если это просто таймаут
                    if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
                        setSession(null)
                        setUser(null)
                    }
                    // Если таймаут - считаем, что сессии нет, но не разлогиниваем принудительно, если локально что-то есть
                } else if (currentSession) {
                    console.log('[Auth] Session valid, user:', currentSession.user.email)
                    setSession(currentSession)
                    setUser(currentSession.user)
                } else {
                    // console.log('[Auth] No session found on validation')
                    setSession(null)
                    setUser(null)
                }
            } catch (e: any) {
                console.error('[Auth] Validation exception:', e.message)
            } finally {
                isValidating.current = false
                if (isMounted) {
                    // Убираем искусственную задержку, сразу открываем интерфейс
                    hasResolved.current = true
                    setIsLoading(false)
                }
            }
        }

        validateSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted || isLoggingOut.current) return
                // console.log('[Auth] State change event:', event)

                setSession(newSession)
                setUser(newSession?.user ?? null)
                setIsLoading(false)
                hasResolved.current = true

                // ВАЖНО: Если юзер зашел, но его нет в базе профилей — создаем его
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
                                full_name: newSession.user.user_metadata?.full_name || 'Пользователь',
                                role: 'user'
                            })
                        }
                    } catch (e) {
                        console.warn('[Auth] Profile sync error (likely already exists):', e)
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
        if (isLoggingOut.current) return
        isLoggingOut.current = true
        setIsLoading(true)

        console.log('[Auth] Starting Global Sign Out (Hard Reset)...')
        try {
            // 1. Supabase SignOut
            await supabase.auth.signOut()

            // 2. Clear all traces
            if (typeof window !== 'undefined') {
                // Clear all storage
                localStorage.clear()
                sessionStorage.clear()

                // Clear all cookies
                const cookies = document.cookie.split(';')
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i]
                    const eqPos = cookie.indexOf('=')
                    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
                    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
                }
            }

            setSession(null)
            setUser(null)
            clearUserCache()

            console.log('[Auth] Cleanup complete, hard redirecting to /auth...')

            // 3. HARD REDIRECT - much safer than router.push for clearing state
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
