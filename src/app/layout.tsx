import '@/lib/supabase/disableLocks'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ErrorSuppressor } from '@/components/ErrorSuppressor'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const viewport = {
    themeColor: '#FF6B00',
    width: 'device-width',
    initialScale: 1,
}

export const metadata: Metadata = {
    title: 'Метаболический Запуск | 7-дневный курс',
    description: 'Премиум 7-дневный фитнес курс для перезагрузки метаболизма. Научный подход к похудению без голодовок.',
    keywords: ['фитнес', 'метаболизм', 'похудение', 'здоровье', 'тренировки'],
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'MetaSystem',
    },
}

import NextTopLoader from 'nextjs-toploader'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <body className={`${inter.className} bg-deep-dark min-h-screen`} suppressHydrationWarning>
                <NextTopLoader
                    color="#FF6B00"
                    initialPosition={0.08}
                    crawlSpeed={200}
                    height={3}
                    crawl={true}
                    showSpinner={false}
                    easing="ease"
                    speed={200}
                    shadow="0 0 10px #FF6B00,0 0 5px #FF6B00"
                />
                <AuthProvider>
                    <ErrorSuppressor />
                    {children}
                </AuthProvider>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered');
                  }, function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
                    }}
                />
            </body>
        </html>
    )
}
