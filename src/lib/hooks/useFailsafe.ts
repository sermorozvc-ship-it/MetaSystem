'use client'

import { useEffect, useRef } from 'react'

/**
 * Аварийный таймер для страниц с lazy-загрузкой данных.
 *
 * Если страница после `loading=true` не сменила его на `false` за указанное
 * время — принудительно вызываем `forceOff`. Это страховочный щит на случай
 * зависших Supabase-запросов: даже если какой-то один сервис на странице
 * не отвалился по своему withTimeout, у пользователя не будет вечного
 * спиннера.
 *
 * Подробности: см. .kiro/steering/desktop-page-load.md
 *
 * @example
 *   const [isLoading, setIsLoading] = useState(true)
 *   useFailsafe(isLoading, () => setIsLoading(false))
 */
export function useFailsafe(
    loading: boolean,
    forceOff: () => void,
    timeoutMs: number = 8_000,
    label: string = 'page',
) {
    const triggered = useRef(false)
    const offRef = useRef(forceOff)
    offRef.current = forceOff

    useEffect(() => {
        if (!loading) {
            triggered.current = false
            return
        }
        if (triggered.current) return

        const t = setTimeout(() => {
            console.warn(`[Failsafe ${label}] forcing isLoading=false after ${timeoutMs}ms`)
            triggered.current = true
            offRef.current()
        }, timeoutMs)

        return () => clearTimeout(t)
    }, [loading, timeoutMs, label])
}
