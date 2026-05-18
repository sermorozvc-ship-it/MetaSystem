'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Глобальный error boundary — срабатывает, если упал даже сам корневой layout.
 * Должен сам объявлять `<html>` / `<body>`.
 */
export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string }
}) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html lang="ru">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0d0d0d',
                    color: '#fff',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '1rem',
                }}
            >
                <div style={{ maxWidth: 420, textAlign: 'center' }}>
                    <h2 style={{ fontSize: 24, marginBottom: 12 }}>Критическая ошибка</h2>
                    <p style={{ opacity: 0.7, marginBottom: 24, fontSize: 14 }}>
                        Приложение временно недоступно. Мы уже получили отчёт.
                    </p>
                    {error.digest && (
                        <p style={{ opacity: 0.4, fontSize: 12, fontFamily: 'monospace', marginBottom: 24 }}>
                            ID: {error.digest}
                        </p>
                    )}
                    <button
                        onClick={() => (window.location.href = '/')}
                        style={{
                            background: '#c8f542',
                            color: '#0d0d0d',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: 14,
                        }}
                    >
                        На главную
                    </button>
                </div>
            </body>
        </html>
    )
}
