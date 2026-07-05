'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { isAdmin } from '@/lib/services/admin'
import { ensureSession } from '@/lib/supabase/client'

const AUTH_GRACE_MS = 5000

let guardAdminCache: { userId: string; isAdmin: boolean } | null = null

/**
 * Общая защита админ-страниц: не редиректим на /auth при кратковременном
 * user=null (TOKEN_REFRESHED) и при таймауте ensureSession, если user
 * всё ещё в AuthContext.
 */
export function useAdminGuard() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isAdminUser, setIsAdminUser] = useState(
        () => !!(user?.id && guardAdminCache?.userId === user.id && guardAdminCache.isAdmin)
    )
    const [isReady, setIsReady] = useState(
        () => !!(user?.id && guardAdminCache?.userId === user.id)
    )

    const userRef = useRef(user)
    useEffect(() => { userRef.current = user }, [user])

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
                const sessionOk = await ensureSession()
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

        verify()

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