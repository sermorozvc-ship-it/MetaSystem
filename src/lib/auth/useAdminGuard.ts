'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { isAdminUser as isAdminUserFast } from '@/lib/auth/isAdminUser'
import { isAdmin } from '@/lib/services/admin'
import { ensureSession, getStoredAccessTokenSync } from '@/lib/supabase/client'

const AUTH_GRACE_MS = 5000

let guardAdminCache: { userId: string; isAdmin: boolean } | null = null

function hasFastAdminAccess(user: { id?: string; email?: string | null; user_metadata?: any } | null): boolean {
    if (!user?.id) return false
    if (isAdminUserFast(user)) return true
    return !!(guardAdminCache?.userId === user.id && guardAdminCache.isAdmin)
}

/**
 * Общая защита админ-страниц: не редиректим на /auth при кратковременном
 * user=null (TOKEN_REFRESHED) и при таймауте ensureSession, если user
 * всё ещё в AuthContext.
 *
 * Быстрый путь: metadata owner / role или guardAdminCache — сразу isReady,
 * без ожидания ensureSession + RPC is_admin (они часто блокируются inTabLock).
 */
export function useAdminGuard() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isAdminUser, setIsAdminUser] = useState(() => hasFastAdminAccess(user))
    const [isReady, setIsReady] = useState(() => hasFastAdminAccess(user) || !!user?.id)

    const userRef = useRef(user)
    useEffect(() => { userRef.current = user }, [user])

    useEffect(() => {
        if (!user?.id) return
        if (hasFastAdminAccess(user)) {
            setIsReady(true)
            setIsAdminUser(true)
        }
    }, [user?.id, user?.email, user?.user_metadata?.role])

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            const t = setTimeout(() => {
                if (!userRef.current) {
                    const returnTo = pathname?.startsWith('/admin') ? pathname : '/admin'
                    router.replace(`/auth?returnTo=${encodeURIComponent(returnTo)}`)
                }
            }, AUTH_GRACE_MS)
            return () => clearTimeout(t)
        }

        let cancelled = false

        const verify = async () => {
            try {
                const hasFreshToken = !!getStoredAccessTokenSync()
                const sessionOk = hasFreshToken ? true : await ensureSession()
                if (!sessionOk && !userRef.current) {
                    const returnTo = pathname?.startsWith('/admin') ? pathname : '/admin'
                    router.replace(`/auth?returnTo=${encodeURIComponent(returnTo)}`)
                    return
                }
                if (!sessionOk) {
                    console.warn('[useAdminGuard] ensureSession=false but user in context, continuing')
                }

                const admin = await isAdmin(user)
                if (cancelled) return
                if (user?.id) {
                    guardAdminCache = { userId: user.id, isAdmin: admin }
                }
                if (!admin) {
                    router.replace('/dashboard')
                    return
                }
                setIsAdminUser(true)
            } catch (e) {
                console.error('[useAdminGuard]', e)
            } finally {
                if (!cancelled) setIsReady(true)
            }
        }

        if (hasFastAdminAccess(user)) {
            setIsReady(true)
            setIsAdminUser(true)
            void verify()
        } else {
            void verify()
        }

        const failsafe = setTimeout(() => {
            if (!cancelled) setIsReady(true)
        }, 8000)

        return () => {
            cancelled = true
            clearTimeout(failsafe)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading])

    return { user, authLoading, isAdminUser, isReady }
}