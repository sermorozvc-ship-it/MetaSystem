'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, LogOut, User, MessageSquare, Menu, X, Calendar, CheckCircle, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import { courseData } from '@/lib/data/courseData'

interface HeaderProps {
    currentDay?: number
    userName?: string
}

export default function Header({ currentDay = 1, userName: propUserName }: HeaderProps) {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [unreadMessages, setUnreadMessages] = useState(0)

    // Search states
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchFocused, setIsSearchFocused] = useState(false)

    const userName = propUserName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Атлет'

    // Search logic
    const allSearchItems = [
        { title: 'Дневник', subtitle: 'ЛОГ СОСТОЯНИЯ', href: '/journal', type: 'nav' },
        { title: 'Прогресс', subtitle: 'АНАЛИТИКА', href: '/progress', type: 'nav' },
        { title: 'Сообщения', subtitle: 'ЧАТ С КУРАТОРОМ', href: '/messages', type: 'nav' },
        ...courseData.map(d => ({
            title: `День ${d.dayNumber}: ${d.title}`,
            subtitle: 'КУРС / ПЕРЕЙТИ К ДНЮ',
            href: `/dashboard?day=${d.dayNumber}`,
            type: 'day'
        })),
        ...courseData.flatMap(d => d.tasks.map(t => ({
            title: t.text,
            subtitle: `ЗАДАНИЕ / ДЕНЬ ${d.dayNumber}`,
            href: `/dashboard?day=${d.dayNumber}`,
            type: 'task'
        })))
    ]

    const searchResults = searchQuery.trim() === ''
        ? []
        : allSearchItems.filter(item =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 8)

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
        <header className="relative flex flex-col md:flex-row md:items-center justify-between px-6 md:px-12 py-8 md:py-10 gap-6">
            {/* Background Glow Effect */}
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-meta-orange/20 to-transparent" />

            {/* Greeting & Status Group */}
            <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-[0.3em] mb-1 animate-fade-in opacity-80">
                        Личный кабинет
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tighter italic">
                        {getGreeting()}, <br className="sm:hidden" />
                        <span className="bg-gradient-to-r from-meta-orange to-red-500 bg-clip-text text-transparent">
                            {userName}!
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-meta-orange animate-pulse" />
                        <span className="text-[11px] md:text-xs font-bold text-gray-300 uppercase tracking-wider">
                            День {currentDay} из 7
                        </span>
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                    <span className="text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-widest italic opacity-60">
                        Метаболический Запуск
                    </span>
                </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-3 md:gap-4 shrink-0 self-end md:self-auto">
                {/* Search - desktop only */}
                <div className="relative hidden lg:block group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-meta-orange transition-colors" />
                    <input
                        type="search"
                        placeholder="Найти задание или раздел..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                        className="glass-input pl-11 pr-4 py-3 w-80 text-sm focus:w-96 transition-all border-white/5 bg-white/[0.03]"
                    />

                    {/* Search Results Dropdown */}
                    {isSearchFocused && searchQuery.trim() !== '' && (
                        <div className="absolute top-full mt-2 w-full glass-card p-2 z-[100] animate-fade-in shadow-2xl border-white/20">
                            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                {searchResults.length > 0 ? (
                                    <>
                                        {searchResults.map((result, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    router.push(result.href)
                                                    setSearchQuery('')
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                                           text-gray-300 hover:bg-white/5 hover:text-white transition-all text-left group/item"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/item:bg-meta-orange/20">
                                                    {result.type === 'day' ? <Calendar className="w-4 h-4 text-blue-400" /> :
                                                        result.type === 'nav' ? <TrendingUp className="w-4 h-4 text-meta-orange" /> :
                                                            <CheckCircle className="w-4 h-4 text-emerald-400" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold tracking-tight">{result.title}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{result.subtitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Ничего не найдено</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Notifications / Messages */}
                <button
                    onClick={() => router.push('/messages')}
                    className="relative w-12 h-12 rounded-2xl bg-white/5 border border-white/10
                          flex items-center justify-center text-gray-400 hover:text-white
                          transition-all duration-300 hover:border-meta-orange/30 hover:bg-meta-orange/5 group">
                    <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-meta-orange rounded-full 
                              text-[10px] font-black flex items-center justify-center text-white animate-pulse shadow-lg shadow-meta-orange/40">
                            {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                    )}
                </button>

                {/* User Avatar & Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-12 h-12 rounded-2xl bg-gradient-to-br from-meta-orange to-red-600
                                   flex items-center justify-center text-white font-black text-lg shadow-xl shadow-meta-orange/20
                                   border border-white/20 hover:scale-105 transition-all active:scale-95"
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
                            <div className="absolute right-0 top-full mt-3 w-64 md:w-56 glass-card p-2 z-50 animate-fade-in origin-top-right shadow-2xl">
                                {user ? (
                                    <>
                                        <div className="px-3 py-2 border-b border-white/10 mb-2">
                                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/settings')}
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
