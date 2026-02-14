'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Create client once
    const [supabase] = useState(() => createClient())

    useEffect(() => {
        // Get initial session
        const getSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                if (error) throw error
                setSession(session)
                setUser(session?.user ?? null)
            } catch (error: any) {
                if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
                    console.error('Error getting session:', error)
                }
            } finally {
                setIsLoading(false)
            }
        }

        getSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session)
                setUser(session?.user ?? null)
                setIsLoading(false)

                // Create profile on sign up
                if (event === 'SIGNED_IN' && session?.user) {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', session.user.id)
                            .single()

                        if (!profile) {
                            await supabase.from('profiles').insert({
                                id: session.user.id,
                                email: session.user.email,
                                full_name: session.user.user_metadata?.full_name
                            })
                        }
                    } catch (e) {
                        // silently fail profile creation checks
                        console.error('Profile check error', e)
                    }
                }
            }
        )

        return () => {
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
