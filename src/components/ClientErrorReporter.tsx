'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Клиентский репортер ошибок.
 *
 * Заменяет старый `ErrorSuppressor`, который агрессивно перезаписывал
 * `console.error` и глушил `unhandledrejection`/`error` события — это
 * маскировало реальные баги.
 *
 * Поведение:
 *   - Узкий список «шумных» ошибок просто игнорируется (preventDefault),
 *     чтобы Next.js dev-overlay не дёргал из-за фоновых AbortError.
 *   - Все остальные ошибки логируются через `console.error` и улетают в Sentry.
 *   - `console.error` НЕ переопределяется — он работает штатно.
 */

const NOISY_PATTERNS = [
    'AbortError',
    'signal is aborted',
    'Auth timeout',
    'aborted without reason',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
] as const

const NOISY_CODES = ['PGRST116'] as const

function isNoisy(reason: unknown): boolean {
    if (!reason) return false
    const err = reason as { name?: string; message?: string; code?: string }
    if (err.code && NOISY_CODES.includes(err.code as typeof NOISY_CODES[number])) {
        return true
    }
    const text = `${err.name ?? ''} ${err.message ?? ''}`
    return NOISY_PATTERNS.some((p) => text.includes(p))
}

export function ClientErrorReporter() {
    useEffect(() => {
        const onUnhandled = (event: PromiseRejectionEvent) => {
            if (isNoisy(event.reason)) {
                event.preventDefault()
                return
            }
            // Реальная ошибка — пусть улетит в Sentry.
            // Sentry сам подписан на window 'unhandledrejection', тут мы только
            // фильтруем шум и оставляем системную обработку.
        }

        const onError = (event: ErrorEvent) => {
            if (isNoisy(event.error)) {
                event.preventDefault()
                return
            }
        }

        window.addEventListener('unhandledrejection', onUnhandled)
        window.addEventListener('error', onError)

        return () => {
            window.removeEventListener('unhandledrejection', onUnhandled)
            window.removeEventListener('error', onError)
        }
    }, [])

    return null
}

/** Утилита для ручного логирования с контекстом. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
    if (isNoisy(error)) return
    if (context) {
        Sentry.withScope((scope) => {
            scope.setExtras(context)
            Sentry.captureException(error)
        })
    } else {
        Sentry.captureException(error)
    }
}
