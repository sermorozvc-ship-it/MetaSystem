'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Error boundary уровня App Router.
 * Срабатывает на ошибках рендера / data-fetching внутри сегмента.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-bg-main">
            <div className="max-w-md w-full glass-card p-8 text-center">
                <h2 className="font-display text-2xl text-white mb-3">Что-то пошло не так</h2>
                <p className="text-text-secondary text-sm mb-6">
                    Мы уже получили отчёт об ошибке и разбираемся. Попробуй обновить страницу.
                </p>
                {error.digest && (
                    <p className="text-text-muted text-xs mb-6 font-mono">ID: {error.digest}</p>
                )}
                <button
                    onClick={() => reset()}
                    className="glass-button-primary px-5 py-2.5 rounded-xl text-sm"
                >
                    Попробовать снова
                </button>
            </div>
        </div>
    )
}
