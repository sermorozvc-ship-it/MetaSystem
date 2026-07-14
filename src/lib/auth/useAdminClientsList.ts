'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/admin-fetch'
import { useAuth } from '@/lib/auth/AuthContext'
import type { UserWithProgress } from '@/lib/services/admin'
import {
    clearAdminClientsCache,
    getAdminClientsCache,
    setAdminClientsCache,
} from '@/lib/auth/admin-clients-cache'

function filterClients(users: UserWithProgress[]) {
    return users.filter((u) => u.role !== 'admin' && u.role !== 'trainer')
}

function isSessionError(message: string | undefined): boolean {
    if (!message) return false
    const m = message.toLowerCase()
    return (
        m.includes('сессия истекла') ||
        m.includes('нет токена') ||
        m.includes('не авторизован') ||
        m.includes('session') ||
        m.includes('jwt')
    )
}

/**
 * Загрузка списка клиентов.
 * Ждёт готовности AuthContext (user), чтобы не бить API до recovery сессии.
 * Токен берётся через adminFetch → getAccessTokenWithRecovery (с refresh + retry).
 * Кеш общий с /admin — при переходе «Главная → Клиенты» данные уже на месте.
 */
export function useAdminClientsList() {
    const { user, isLoading: authLoading } = useAuth()
    const initialCache = getAdminClientsCache()

    const [clients, setClients] = useState<UserWithProgress[]>(initialCache ?? [])
    const [isLoading, setIsLoading] = useState(!initialCache)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const reload = useCallback(() => {
        clearAdminClientsCache()
        setReloadKey((k) => k + 1)
    }, [])

    useEffect(() => {
        // Пока auth не разрешился — ждём (не показываем ложную «сессия истекла»)
        if (authLoading) {
            if (!getAdminClientsCache()) setIsLoading(true)
            return
        }

        // Нет user после resolve — guard редиректнет; не дергаем API
        if (!user?.id) {
            if (!getAdminClientsCache()) {
                setIsLoading(false)
                setLoadError(null)
            }
            return
        }

        if (reloadKey === 0) {
            const cached = getAdminClientsCache()
            if (cached) {
                setClients(cached)
                setIsLoading(false)
                return
            }
        }

        let cancelled = false
        setIsLoading(true)
        setLoadError(null)

        const load = async () => {
            try {
                const { users } = await adminFetch<{ users: UserWithProgress[] }>(
                    '/api/admin/users',
                    { cache: 'no-store' },
                )
                if (cancelled) return

                const clientsOnly = filterClients(users ?? [])
                setClients(clientsOnly)
                setAdminClientsCache(clientsOnly)
                setLoadError(null)
            } catch (e: any) {
                console.error('[useAdminClientsList] load failed:', e)
                if (cancelled) return

                const msg = e?.message || 'Не удалось загрузить клиентов'
                // Одна отложенная попытка на session-ошибку (race на старте вкладки)
                if (isSessionError(msg)) {
                    await new Promise((r) => setTimeout(r, 800))
                    if (cancelled) return
                    try {
                        const { users } = await adminFetch<{ users: UserWithProgress[] }>(
                            '/api/admin/users',
                            { cache: 'no-store' },
                        )
                        if (cancelled) return
                        const clientsOnly = filterClients(users ?? [])
                        setClients(clientsOnly)
                        setAdminClientsCache(clientsOnly)
                        setLoadError(null)
                        return
                    } catch (retryErr: any) {
                        console.error('[useAdminClientsList] retry failed:', retryErr)
                        if (!cancelled) {
                            setLoadError(retryErr?.message || msg)
                        }
                        return
                    }
                }

                setLoadError(msg)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void load()

        const failsafe = setTimeout(() => {
            if (!cancelled) setIsLoading(false)
        }, 12_000)

        return () => {
            cancelled = true
            clearTimeout(failsafe)
        }
    }, [reloadKey, user?.id, authLoading])

    return { clients, setClients, isLoading, loadError, reload }
}
