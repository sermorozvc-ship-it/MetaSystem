'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, LogOut, User, MessageSquare, Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
    currentDay?: number
    userName?: string
}

export default function Header({ currentDay = 1, userName: propUserName }: HeaderProps) {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [unreadMessages, setUnreadMessages] = useState(0)

    const userName = propUserName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Атлет'

    useEffect(() => {
        if (user) {
            loadUnreadCount()
        }
    }, [user])

    const loadUnreadCount = async () => {
        const supabase = createClient()
        const { count } = await supabase
            .from('admin_messages')
            .select('*', { count: 'exact', head: true })
            .eq('to_user_id', user?.id)
            .eq('is_read', false)

        setUnreadMessages(count || 0)
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Доброе утро'
        if (hour < 18) return 'Добрый день'
        return 'Добрый вечер'
    }

    const handleSignOut = async () => {
        try {
            // Race between signOut and a 1s timeout
            await Promise.race([
                signOut(),
                new Promise(resolve => setTimeout(resolve, 1000))
            ])
        } catch (error) {
            console.error('Logout error:', error)
        }

        // Force force force redirect
        window.location.href = '/auth'
    }

    return (
        <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6">
            {/* Greeting */}
            <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl font-bold text-white truncate">
                    {getGreeting()}, <span className="text-meta-orange">{userName}!</span>
                </h1>
                <p className="text-gray-400 mt-0.5 md:mt-1 text-xs md:text-base">
                    День {currentDay} из 7 • Метаболический Запуск
                </p>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-2">
                {/* Search - desktop only */}
                <div className="relative hidden lg:block">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Поиск..."
                        className="glass-input pl-11 pr-4 py-2.5 w-64 text-sm"
                    />
                </div>

                {/* Notifications / Messages */}
                <button
                    onClick={() => router.push('/messages')}
                    className="relative w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                          flex items-center justify-center text-gray-400 hover:text-white
                          transition-colors duration-200 hover:border-white/20">
                    <MessageSquare className="w-5 h-5" />
                    {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-meta-orange rounded-full 
                              text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
                            {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                    )}
                </button>

                {/* User Avatar & Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                   flex items-center justify-center text-white font-bold text-sm
                                   border-2 border-meta-orange/30 hover:border-meta-orange/60 transition-colors"
                    >
                        {userName.charAt(0).toUpperCase()}
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowUserMenu(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 z-50 animate-fade-in">
                                {user ? (
                                    <>
                                        <div className="px-3 py-2 border-b border-white/10 mb-2">
                                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/profile')}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                                       text-gray-300 hover:bg-deep-dark-200 transition-colors text-left"
                                        >
                                            <User className="w-4 h-4" />
                                            <span className="text-sm">Профиль</span>
                                        </button>
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                                       text-red-400 hover:bg-red-500/10 transition-colors text-left"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span className="text-sm">Выйти</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => router.push('/auth')}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                                   text-meta-orange hover:bg-meta-orange/10 transition-colors text-left"
                                    >
                                        <User className="w-4 h-4" />
                                        <span className="text-sm">Войти в аккаунт</span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
