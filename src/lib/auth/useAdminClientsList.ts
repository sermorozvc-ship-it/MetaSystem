'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/admin-fetch'
import type { UserWithProgress } from '@/lib/services/admin'
import {
    clearAdminClientsCache,
    getAdminClientsCache,
    setAdminClientsCache,
} from '@/lib/auth/admin-clients-cache'

function filterClients(users: UserWithProgress[]) {
    return users.filter((u) => u.role !== 'admin' && u.role !== 'trainer')
}

/**
 * Загрузка списка клиентов без ожидания useAdminGuard.
 * Токен берётся через adminFetch → getAccessTokenWithRecovery (с refresh).
 * Кеш общий с /admin — при переходе «Главная → Клиенты» данные уже на месте.
 */
export function useAdminClientsList() {
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
            } catch (e: any) {
                console.error('[useAdminClientsList] load failed:', e)
                if (!cancelled) {
                    setLoadError(e?.message || 'Не удалось загрузить клиентов')
                }
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
    }, [reloadKey])

    return { clients, setClients, isLoading, loadError, reload }
}