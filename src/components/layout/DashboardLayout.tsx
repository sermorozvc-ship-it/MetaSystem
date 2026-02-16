'use client'

import { ReactNode, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { X } from 'lucide-react'

interface DashboardLayoutProps {
    children: ReactNode
    rightPanel?: ReactNode
    userName?: string
    currentDay?: number
    showMobileSheet?: boolean
    onCloseMobileSheet?: () => void
}

export default function DashboardLayout({
    children,
    rightPanel,
    userName = 'Атлет',
    currentDay = 1,
    showMobileSheet = false,
    onCloseMobileSheet
}: DashboardLayoutProps) {

    // Блокируем скролл body, когда sheet открыт
    useEffect(() => {
        if (showMobileSheet) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [showMobileSheet])

    return (
        <div className="flex min-h-screen bg-deep-dark">
            {/* Sidebar */}
            <Sidebar activeItem="dashboard" />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
                <Header userName={userName} currentDay={currentDay} />

                <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 px-4 md:px-8 pb-4 md:pb-8">
                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>

                    {/* Desktop: обычная боковая панель */}
                    {rightPanel && (
                        <aside className="hidden lg:block w-80 shrink-0">
                            {rightPanel}
                        </aside>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Sheet */}
            {rightPanel && (
                <>
                    {/* Затемнение фона */}
                    <div
                        className={`
                            lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40
                            transition-opacity duration-300
                            ${showMobileSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                        `}
                        onClick={onCloseMobileSheet}
                    />

                    {/* Шторка */}
                    <div
                        className={`
                            lg:hidden fixed bottom-0 left-0 right-0 z-50
                            bg-deep-dark-100 border-t border-white/10
                            rounded-t-3xl shadow-2xl
                            transition-transform duration-300 ease-out
                            ${showMobileSheet ? 'translate-y-0' : 'translate-y-full'}
                        `}
                        style={{ maxHeight: '85vh' }}
                    >
                        {/* Ручка + кнопка закрытия */}
                        <div className="sticky top-0 bg-deep-dark-100 rounded-t-3xl z-10 px-4 pt-3 pb-2 flex items-center justify-between">
                            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                            <div /> {/* spacer */}
                            <button
                                onClick={onCloseMobileSheet}
                                className="w-8 h-8 rounded-full bg-deep-dark-300 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Контент панели */}
                        <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(85vh - 48px)' }}>
                            {rightPanel}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
