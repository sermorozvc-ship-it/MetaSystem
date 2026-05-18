/** @type {import('next').NextConfig} */
const nextConfig = {
    // Отключаем Strict Mode для предотвращения AbortError в Supabase Auth
    // Strict Mode вызывает двойной mount компонентов, что конфликтует с Web Locks API
    reactStrictMode: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
}

// Подключаем Sentry только если установлен SDK и заданы базовые переменные.
// Если SENTRY_AUTH_TOKEN не задан — sourcemaps не грузятся, но рантайм-мониторинг работает.
let finalConfig = nextConfig
try {
    const { withSentryConfig } = require('@sentry/nextjs')
    finalConfig = withSentryConfig(nextConfig, {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        // Тихий режим если не в CI
        silent: !process.env.CI,
        widenClientFileUpload: true,
        // Отключаем загрузку sourcemap, если auth token не задан
        sourcemaps: {
            disable: !process.env.SENTRY_AUTH_TOKEN,
        },
        // Туннель (опционально) — обходит ad-blockers
        // tunnelRoute: '/monitoring',
    })
} catch {
    // Sentry не установлен или недоступен — работаем без него
}

module.exports = finalConfig
