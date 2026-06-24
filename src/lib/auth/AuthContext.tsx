'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient, clearUserCache, setCachedUser, isSessionValid } from '@/lib/supabase/client'

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
                            const { error: insertError } = await supabase.from('profiles').insert({
                                id: newSession.user.id,
                                email: newSession.user.email,
                                full_name: newSession.user.user_metadata?.full_name || null,
                                role: 'client',
                            })
                            if (insertError) {
                                console.error('[Auth] Profile insert error:', insertError.message, insertError.code)
                            }
                        }
                    } catch (err) {
                        console.error('[Auth] Profile creation error:', err)
                    }
                }
            }
        )

        // 3. Таймаут-страховка: максимум 5 сек.
        // Раньше было 1500мс — слишком мало для холодного старта на десктопе:
        // если getSession() резолвится дольше, флаг hasResolved выставлялся
        // с user=null, страницы делали guard-редирект на /auth, и пользователь
        // получал hard reload поверх валидной сессии. На мобиле чанки
        // меньше и быстрее — там не было заметно. 5с это безопасный порог:
        // нормальный getSession() укладывается в 200–500мс.
        const timeout = setTimeout(() => {
            if (!hasResolved.current && isMounted) {
                console.warn('[Auth] Timeout — forcing isLoading=false')
                hasResolved.current = true
                globalResolved = true
                setIsLoading(false)
            }
        }, 5000)

        // 4. Refresh сессии при возврате к вкладке.
        // На десктопе пользователь часто оставляет вкладку висеть, и фоновый
        // таб засыпает (browser throttling). При возврате access_token может
        // быть просрочен, а supabase ещё не успел его обновить — навигация
        // виснет на RLS-запросах. Принудительный getSession() при visible
        // триггерит auto-refresh и onAuthStateChange.
        const handleVisible = () => {
            if (typeof document === 'undefined') return
            if (document.visibilityState !== 'visible') return
            // Не дёргаем supabase если ещё идёт первичный resolve
            if (!hasResolved.current) return
            supabase.auth.getSession().catch(err => {
                console.warn('[Auth] visibility refresh failed:', err)
            })
        }

        const keepSessionAlive = async () => {
            if (!isMounted || !hasResolved.current || isLoggingOut.current) return
            try {
                const stillValid = await isSessionValid()
                if (stillValid) return

                console.info('[Auth] heartbeat: session is stale, refreshing')
                const { data, error } = await supabase.auth.refreshSession()
                if (error) {
                    console.warn('[Auth] heartbeat refresh failed:', error.message)
                    return
                }
                if (!isMounted || isLoggingOut.current) return
                if (data.session?.user) {
                    globalSession = data.session
                    globalUser = data.session.user
                    setSession(data.session)
                    setUser(data.session.user)
                    setCachedUser(data.session.user)
                    console.info('[Auth] heartbeat: session refreshed')
                }
            } catch (err) {
                console.warn('[Auth] heartbeat failed:', err)
            }
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisible)
            window.addEventListener('focus', handleVisible)
        }

        const heartbeat = setInterval(() => {
            void keepSessionAlive()
        }, 60_000)

        return () => {
            isMounted = false
            subscription.unsubscribe()
            clearTimeout(timeout)
            clearInterval(heartbeat)
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisible)
                window.removeEventListener('focus', handleVisible)
            }
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
