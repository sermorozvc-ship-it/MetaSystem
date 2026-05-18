// Конфигурация Sentry для клиента (браузер).
// Если DSN не задан, Sentry просто не инициализируется и не шлёт ничего.
// Это позволяет безопасно деплоить без обязательной настройки.

import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

// Шумные ошибки, которые не несут ценности — фильтруем до отправки.
// (Заменяет агрессивный `ErrorSuppressor`, который глушил всё подряд.)
const IGNORED_ERROR_MESSAGES = [
    'AbortError',
    'signal is aborted',
    'Auth timeout',
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'Load failed',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
] as const

const IGNORED_ERROR_CODES = ['PGRST116'] as const

if (DSN) {
    Sentry.init({
        dsn: DSN,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
        // Низкий sampleRate чтобы не выжечь квоту на маленьком проекте.
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.1,
        // Не шлём ошибки в дев-режиме чтобы не засорять прод-проект Sentry.
        enabled: process.env.NODE_ENV === 'production',
        ignoreErrors: [...IGNORED_ERROR_MESSAGES],
        beforeSend(event, hint) {
            const err = hint.originalException as { code?: string; message?: string } | undefined

            if (err?.code && IGNORED_ERROR_CODES.includes(err.code as typeof IGNORED_ERROR_CODES[number])) {
                return null
            }

            const msg = err?.message || event.message || ''
            if (IGNORED_ERROR_MESSAGES.some((s) => msg.includes(s))) {
                return null
            }

            return event
        },
    })
}
