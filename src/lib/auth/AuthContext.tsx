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
            console.log('[Auth] Validating session...')
            try {
                // Мы НЕ сбрасываем user/session из initialData сразу.
                // Просто пробуем получить свежую сессию.
                const { data: { session: currentSession }, error } = await supabase.auth.getSession()

                if (!isMounted) return

                if (currentSession) {
                    console.log('[Auth] Session active:', currentSession.user.email)
                    setSession(currentSession)
                    setUser(currentSession.user)
                } else if (error) {
                    console.warn('[Auth] getSession result:', error.message)
                    // Только критические ошибки авторизации должны сбрасывать сессию
                    if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
                        setSession(null)
                        setUser(null)
                    }
                } else {
                    console.log('[Auth] Session not found on server')
                    // Если SDK говорит, что сессии нет — значит её действительно нет.
                    setSession(null)
                    setUser(null)
                }
            } catch (e: any) {
                console.error('[Auth] Validation exception:', e.message)
            } finally {
                if (isMounted && !hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }
            }
        }

        validateSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted) return
                console.log('[Auth] State change event:', event)

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (!hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }

                // ВАЖНО: Если юзер зашел, но его нет в базе профилей — создаем его
                if (event === 'SIGNED_IN' && newSession?.user) {
                    const { data: existing } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', newSession.user.id)
                        .maybeSingle()

                    if (!existing) {
                        await supabase.from('profiles').insert({
                            id: newSession.user.id,
                            email: newSession.user.email,
                            full_name: newSession.user.user_metadata?.full_name || 'Пользователь',
                            role: 'user'
                        }).select().single()
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
        console.log('[Auth] Signing out...')
        clearUserCache()

        // Очищаем Supabase
        await supabase.auth.signOut()

        // Принудительно чистим наш кастомный сторадж и localStorage Supabase
        if (typeof window !== 'undefined') {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            if (supabaseUrl) {
                const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
                localStorage.removeItem(`sb-${projectRef}-auth-token`)
            }
            // Полная очистка для надежности
            localStorage.clear()

            // Сбрасываем состояния
            setUser(null)
            setSession(null)

            // Перекидываем на вход
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
