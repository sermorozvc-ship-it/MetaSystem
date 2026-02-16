// ВАЖНО: Импорт должен быть первым для отключения Web Locks до Supabase
import '@/lib/supabase/disableLocks'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ErrorSuppressor } from '@/components/ErrorSuppressor'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
    title: 'Метаболический Запуск | 7-дневный курс',
    description: 'Премиум 7-дневный фитнес курс для перезагрузки метаболизма. Научный подход к похудению без голодовок.',
    keywords: ['фитнес', 'метаболизм', 'похудение', 'здоровье', 'тренировки'],
    manifest: '/manifest.json',
    themeColor: '#FF6B00',
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
        <html lang="ru">
            <body className={`${inter.className} bg-deep-dark min-h-screen`}>
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
