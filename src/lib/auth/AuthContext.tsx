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
    const [initialData] = useState(() => getInitialSessionFromStorage())
    const [user, setUser] = useState<User | null>(initialData.user)
    const [session, setSession] = useState<Session | null>(initialData.session)
    const [isLoading, setIsLoading] = useState(!initialData.user)
    const hasResolved = useRef(false)

    const [supabase] = useState(() => createClient())

    // Safety timeout — если всё совсем плохо, снимаем loading через 5 секунд
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasResolved.current) {
                console.warn('[Auth] Safety timeout reached, resolving...')
                setIsLoading(false)
                hasResolved.current = true
            }
        }, 5000)

        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        let isMounted = true

        const validateSession = async () => {
            try {
                // Пытаемся получить актуальную сессию (Supabase сам обновит её через refresh_token если нужно)
                const { data: { session: currentSession }, error } = await supabase.auth.getSession()

                if (!isMounted) return

                if (error) {
                    console.error('[Auth] getSession error:', error.message)
                    // Если ошибка серьезная — разлогиниваем для безопасности
                    if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
                        setSession(null)
                        setUser(null)
                    }
                } else if (currentSession) {
                    setSession(currentSession)
                    setUser(currentSession.user)
                } else {
                    setSession(null)
                    setUser(null)
                }
            } catch (e: any) {
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
