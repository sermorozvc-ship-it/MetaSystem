'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    TrendingUp,
    BookOpen,
    Settings,
    User,
    Flame,
    Shield,
    MessageSquare
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
    activeItem?: string
    onItemClick?: (item: string) => void
}

const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Панель', href: '/dashboard' },
    { id: 'progress', icon: TrendingUp, label: 'Прогресс', href: '/progress' },
    { id: 'journal', icon: BookOpen, label: 'Дневник', href: '/journal' },
    { id: 'messages', icon: MessageSquare, label: 'Чат', href: '/messages' },
    { id: 'settings', icon: Settings, label: 'Настройки', href: '/settings' },
]

export default function Sidebar({ activeItem = 'dashboard', onItemClick }: SidebarProps) {
    const [hoveredItem, setHoveredItem] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        let isMounted = true;
        const checkAdmin = async () => {
            if (!user) {
                // Demo mode - show admin link
                setIsAdmin(true)
                return
            }

            // Сначала проверяем роль в метаданных (это мгновенно)
            const roleInMetadata = user.user_metadata?.role
            if (roleInMetadata === 'admin' || roleInMetadata === 'curator') {
                if (isMounted) setIsAdmin(true)
                return
            }

            // Если в метаданных нет, проверяем БД один раз
            try {
                const supabase = createClient()
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                if (isMounted) {
                    setIsAdmin(profile?.role === 'admin' || profile?.role === 'curator')
                }
            } catch (e) {
                console.error('Sidebar admin check failed', e)
            }
        }

        checkAdmin()
        return () => { isMounted = false }
    }, [user])

    const handleItemClick = (item: typeof menuItems[0]) => {
        if (onItemClick) {
            onItemClick(item.id)
        } else {
            router.push(item.href)
        }
    }

    // Mobile bottom bar items (max 5 for comfort)
    const mobileItems = isAdmin
        ? [...menuItems.slice(0, 4), { id: 'admin', icon: Shield, label: 'Админ', href: '/admin' }]
        : menuItems

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="glass-sidebar w-20 min-h-screen hidden md:flex flex-col items-center py-6 gap-2 z-40 overflow-visible">
                {/* Logo */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600 flex items-center justify-center mb-8 shadow-glow-orange-sm">
                    <Flame className="w-7 h-7 text-white" />
                </div>

                {/* Navigation Items */}
                <nav className="flex flex-col gap-2 flex-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeItem === item.id
                        const isHovered = hoveredItem === item.id

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                onMouseEnter={() => setHoveredItem(item.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                                className={`
                relative w-12 h-12 rounded-2xl flex items-center justify-center
                transition-all duration-200 group
                ${isActive
                                        ? 'bg-meta-orange text-white shadow-glow-orange-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-deep-dark-200'
                                    }
              `}
                            >
                                <Icon className="w-5 h-5" />

                                {/* Tooltip */}
                                <span
                                    className={`
                  absolute left-16 px-3 py-1.5 rounded-lg bg-deep-dark-200 text-white text-sm
                  whitespace-nowrap pointer-events-none z-[9999]
                  transition-all duration-200 border border-white/10 shadow-lg
                  ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}
                `}
                                >
                                    {item.label}
                                </span>
                            </button>
                        )
                    })}

                    {/* Admin Link */}
                    {isAdmin && (
                        <button
                            onClick={() => window.open('/admin', '_blank')}
                            onMouseEnter={() => setHoveredItem('admin')}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`
                                relative w-12 h-12 rounded-2xl flex items-center justify-center
                                transition-all duration-200 group mt-4
                                ${activeItem === 'admin'
                                    ? 'bg-purple-500 text-white shadow-glow-purple-sm'
                                    : 'text-purple-400 hover:text-white hover:bg-purple-500/20'
                                }
                            `}
                        >
                            <Shield className="w-5 h-5" />

                            {/* Tooltip */}
                            <span
                                className={`
                                    absolute left-16 px-3 py-1.5 rounded-lg bg-deep-dark-200 text-white text-sm
                                    whitespace-nowrap pointer-events-none z-[9999]
                                    transition-all duration-200 border border-white/10 shadow-lg
                                    ${hoveredItem === 'admin' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}
                                `}
                            >
                                Админ-панель
                            </span>
                        </button>
                    )}
                </nav>

                {/* User Profile */}
                <button
                    className="w-12 h-12 rounded-2xl bg-deep-dark-200 flex items-center justify-center
                   text-gray-400 hover:text-white transition-colors duration-200
                   border border-white/10 hover:border-white/20"
                >
                    <User className="w-5 h-5" />
                </button>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                            bg-deep-dark-100/95 backdrop-blur-xl border-t border-white/10
                            px-2 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-around py-2">
                    {mobileItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeItem === item.id
                        const isAdminItem = item.id === 'admin'

                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (isAdminItem) {
                                        window.open('/admin', '_blank')
                                    } else {
                                        handleItemClick(item)
                                    }
                                }}
                                className={`
                                    flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                                    transition-all duration-200 min-w-[56px]
                                    ${isActive
                                        ? isAdminItem
                                            ? 'text-purple-400'
                                            : 'text-meta-orange'
                                        : 'text-gray-500'
                                    }
                                `}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                                {isActive && (
                                    <div className={`w-1 h-1 rounded-full ${isAdminItem ? 'bg-purple-400' : 'bg-meta-orange'}`} />
                                )}
                            </button>
                        )
                    })}
                </div>
            </nav>
        </>
    )
}
