'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react'
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
 * Пытается получить сессию из localStorage напрямую, как fallback
 */
function tryGetSessionFromStorage(): { user: User | null; session: Session | null } {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl) return { user: null, session: null }

        // Supabase хранит сессию по ключу: sb-<project-ref>-auth-token
        const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
        const storageKey = `sb-${projectRef}-auth-token`
        const stored = localStorage.getItem(storageKey)

        if (!stored) return { user: null, session: null }

        const parsed = JSON.parse(stored)
        // Проверяем не истёк ли токен
        if (parsed?.expires_at) {
            const expiresAt = parsed.expires_at * 1000
            if (Date.now() > expiresAt) {
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
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasResolved = useRef(false)

    // Create client once
    const [supabase] = useState(() => createClient())

    // Гарантированный сброс isLoading через максимальный таймаут
    useEffect(() => {
        loadingTimerRef.current = setTimeout(() => {
            if (!hasResolved.current) {
                console.warn('[Auth] Force-resolving loading state after safety timeout')
                // Попробуем fallback из localStorage
                const fallback = tryGetSessionFromStorage()
                if (fallback.user) {
                    setUser(fallback.user)
                    setSession(fallback.session)
                }
                hasResolved.current = true
                setIsLoading(false)
            }
        }, 10000) // Абсолютный максимум — 10 секунд

        return () => {
            if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        let isMounted = true

        const getSession = async () => {
            try {
                const sessionPromise = supabase.auth.getSession()
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Auth timeout')), 8000)
                )

                const { data: { session: currentSession }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as any

                if (!isMounted) return

                if (error) {
                    // При ошибке пробуем fallback из localStorage
                    console.warn('[Auth] getSession error, trying localStorage fallback:', error.message)
                    const fallback = tryGetSessionFromStorage()
                    setSession(fallback.session)
                    setUser(fallback.user)
                } else {
                    setSession(currentSession)
                    setUser(currentSession?.user ?? null)
                }
            } catch (error: any) {
                if (!isMounted) return

                // При таймауте или AbortError — пробуем из localStorage
                if (error?.message === 'Auth timeout' || error?.name === 'AbortError' || error?.message?.includes('aborted')) {
                    console.warn('[Auth] Session fetch timed out/aborted, trying localStorage fallback')
                    const fallback = tryGetSessionFromStorage()
                    setSession(fallback.session)
                    setUser(fallback.user)
                } else {
                    console.error('[Auth] Unexpected error getting session:', error)
                }
            } finally {
                if (isMounted) {
                    hasResolved.current = true
                    setIsLoading(false)
                }
            }
        }

        getSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted) return

                setSession(newSession)
                setUser(newSession?.user ?? null)

                // Если loading ещё true — сбрасываем
                if (!hasResolved.current) {
                    hasResolved.current = true
                    setIsLoading(false)
                }

                // Create profile on sign up
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
                    } catch (e) {
                        // silently fail profile creation checks
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
            options: {
                data: {
                    full_name: fullName
                }
            }
        })
        return { error: error as Error | null }
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        clearUserCache()
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{
            user,
            session,
            isLoading,
            signUp,
            signIn,
            signOut
        }}>
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
