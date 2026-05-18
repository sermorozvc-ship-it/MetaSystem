// Next.js instrumentation hook — подключаем Sentry для серверной части и edge.
// Документация: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

import * as Sentry from '@sentry/nextjs'

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config')
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config')
    }
}

// В Sentry SDK v10 экспорт называется `captureRequestError`,
// но Next.js ожидает `onRequestError`. Перенаправляем.
export const onRequestError = Sentry.captureRequestError
