'use client'

import { usePathname } from 'next/navigation'

export default function PageWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const noNavPaths = ['/', '/auth', '/payment', '/questionnaire', '/onboarding', '/get-started', '/screening']
    const needsPadding = !noNavPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

    if (!needsPadding) return <>{children}</>

    // Десктоп: pt-20 (навбар ~72px)
    // Мобильный: pt-16 (верхний хедер ~56px) + pb-20 (нижний таббар ~60px)
    return (
        <div className="pt-16 pb-20 md:pt-20 md:pb-0">
            {children}
        </div>
    )
}
