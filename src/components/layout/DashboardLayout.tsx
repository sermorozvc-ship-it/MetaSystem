'use client'

import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface DashboardLayoutProps {
    children: ReactNode
    rightPanel?: ReactNode
    userName?: string
    currentDay?: number
}

export default function DashboardLayout({
    children,
    rightPanel,
    userName = 'Атлет',
    currentDay = 1
}: DashboardLayoutProps) {
    const [showMobilePanel, setShowMobilePanel] = useState(false)

    return (
        <div className="flex min-h-screen bg-deep-dark">
            {/* Sidebar (desktop only, mobile becomes bottom nav) */}
            <Sidebar activeItem="dashboard" />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
                <Header userName={userName} currentDay={currentDay} />

                <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 px-4 md:px-8 pb-4 md:pb-8">
                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>

                    {/* Right Panel - Collapsible on mobile */}
                    {rightPanel && (
                        <>
                            {/* Mobile toggle button */}
                            <button
                                onClick={() => setShowMobilePanel(!showMobilePanel)}
                                className="lg:hidden glass-button w-full flex items-center justify-center gap-2 py-3"
                            >
                                {showMobilePanel ? 'Скрыть задания' : 'Показать задания дня'}
                            </button>

                            {/* Panel */}
                            <aside className={`
                                w-full lg:w-80 shrink-0
                                ${showMobilePanel ? 'block' : 'hidden'} lg:block
                            `}>
                                {rightPanel}
                            </aside>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
