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
 * Синхронно читаем сессию из localStorage.
 * Мы возвращаем данные даже если токен истек, 
 * чтобы SDK Supabase мог использовать refresh_token для обновления.
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

        if (parsed?.user) {
            return { user: parsed.user, session: parsed as Session }
        }
        return { user: null, session: null }
    } catch {
        return { user: null, session: null }
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [initialData] = useState(() => {
        const data = getInitialSessionFromStorage()
        if (typeof window !== 'undefined') {
            console.log('[Auth] Initial data from storage:', data.user ? 'User found' : 'No user')
        }
        return data
    })

    const [user, setUser] = useState<User | null>(initialData.user)
    const [session, setSession] = useState<Session | null>(initialData.session)
    const [isLoading, setIsLoading] = useState(true) // Начинаем с true
    const hasResolved = useRef(false)

    const [supabase] = useState(() => createClient())
    const isValidating = useRef(false)
    const isLoggingOut = useRef(false)

    // SAFETY FIRST: Если через 3 секунды мы всё еще "грузимся" — принудительно показываем приложение
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasResolved.current) {
                console.warn('[Auth] FORCED RESOLVE: session check took too long (>3s)')
                setIsLoading(false)
                hasResolved.current = true
            }
        }, 3000)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        let isMounted = true

        const validateSession = async () => {
            if (isValidating.current || isLoggingOut.current) return
            isValidating.current = true

            console.log('[Auth] Validating session...')
            try {
                // Пытаемся получить сессию с жестким таймаутом
                const sessionPromise = supabase.auth.getSession()
                const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((res) =>
                    setTimeout(() => res({ data: { session: null }, error: new Error('Auth Timeout') }), 3000)
                )

                const { data: { session: currentSession }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as any

                if (!isMounted) return

                if (error) {
                    console.warn('[Auth] getSession error:', error.message)
                    // Не сбрасываем всё сразу, если это просто таймаут,
                    // но если ошибка критическая (токен) — чистим
                    if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
                        setSession(null)
                        setUser(null)
                    }
                } else if (currentSession) {
                    console.log('[Auth] Session valid, user:', currentSession.user.email)
                    setSession(currentSession)
                    setUser(currentSession.user)
                } else {
                    console.log('[Auth] No session found on validation')
                    setSession(null)
                    setUser(null)
                }
            } catch (e: any) {
                console.error('[Auth] Validation exception:', e.message)
            } finally {
                isValidating.current = false
                if (isMounted && !hasResolved.current) {
                    console.log('[Auth] Loading finished')
                    hasResolved.current = true
                    setIsLoading(false)
                }
            }
        }

        validateSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted || isLoggingOut.current) return
                console.log('[Auth] State change event:', event, newSession?.user?.email || 'no-user')

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (!hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }

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
