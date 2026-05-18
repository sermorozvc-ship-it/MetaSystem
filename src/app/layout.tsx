// MetaSystem v2 — Root Layout
// Шрифты: Unbounded (заголовки) + Golos Text (тело)
// Дизайн-система: Dark Lime (#c8f542)
import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ClientErrorReporter } from '@/components/ClientErrorReporter'
import Navigation from '@/components/Navigation'
import PageWrapper from '@/components/PageWrapper'
import NextTopLoader from 'nextjs-toploader'

export const viewport = {
    themeColor: '#0d0d0d',
    width: 'device-width',
    initialScale: 1,
}

export const metadata: Metadata = {
    title: 'MetaSystem | Онлайн-ведение тренировок',
    description: 'Персональная платформа онлайн-ведения. Индивидуальные тренировочные программы, отслеживание прогресса, метрики и аналитика.',
    keywords: ['фитнес', 'тренер', 'онлайн ведение', 'тренировки', 'персональный тренер', 'программа тренировок'],
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'MetaSystem',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700;900&family=Golos+Text:wght@400;500;600&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-bg-main min-h-screen font-body" suppressHydrationWarning>
                <NextTopLoader
                    color="#c8f542"
                    initialPosition={0.08}
                    crawlSpeed={200}
                    height={3}
                    crawl={true}
                    showSpinner={false}
                    easing="ease"
                    speed={200}
                    shadow="0 0 10px rgba(200,245,66,0.5),0 0 5px rgba(200,245,66,0.3)"
                />
                <AuthProvider>
                    <ClientErrorReporter />
                    <Navigation />
                    <PageWrapper>{children}</PageWrapper>
                </AuthProvider>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(reg) { console.log('[SW] Registered', reg.scope); })
                  .catch(function(err) { console.warn('[SW] Registration failed', err); });
              }
            `,
                    }}
                />
            </body>
        </html>
    )
}
