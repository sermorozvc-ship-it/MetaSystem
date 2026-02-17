'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    Users,
    FileCheck,
    MessageSquare,
    TrendingUp,
    Shield,
    Search,
    ChevronRight,
    Ban,
    Trash2,
    Send,
    CheckCircle,
    XCircle,
    Clock,
    Image,
    AlertTriangle,
    Eye,
    X,
    Flame,
    ArrowLeft,
    RefreshCw,
    Mail
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    isAdmin,
    getAllUsers,
    getAllReports,
    getAllMessages,
    getUserReports,
    getUserMessages,
    sendMessageToUser,
    blockUser,
    unblockUser,
    updateReportStatus,
    getAdminStats,
    UserWithProgress,
    DayReportWithUser,
    AdminMessage
} from '@/lib/services/admin'
import { courseData } from '@/lib/data/courseData'

type Tab = 'users' | 'reports' | 'messages'

export default function AdminPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    // Helper for reload
    const loadData = () => window.location.reload()

    const [isAdminUser, setIsAdminUser] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>('users')
    const [searchQuery, setSearchQuery] = useState('')

    // Data states
    const [users, setUsers] = useState<UserWithProgress[]>([])
    const [allReports, setAllReports] = useState<DayReportWithUser[]>([])
    const [allMessages, setAllMessages] = useState<AdminMessage[]>([])
    const [userProgressDetails, setUserProgressDetails] = useState<any[]>([])
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        blockedUsers: 0,
        pendingReports: 0,
        completedToday: 0
    })

    // Selected user states
    const [selectedUser, setSelectedUser] = useState<UserWithProgress | null>(null)
    const [selectedUserReports, setSelectedUserReports] = useState<DayReportWithUser[]>([])
    const [selectedUserMessages, setSelectedUserMessages] = useState<AdminMessage[]>([])

    // Modal states
    const [showUserModal, setShowUserModal] = useState(false)
    const [showMessageModal, setShowMessageModal] = useState(false)
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [showReportModal, setShowReportModal] = useState(false)
    const [selectedReport, setSelectedReport] = useState<DayReportWithUser | null>(null)
    const [userModalTab, setUserModalTab] = useState<'progress' | 'reports' | 'messages'>('progress')

    // Form states
    const [messageText, setMessageText] = useState('')
    const [messageType, setMessageType] = useState<'message' | 'warning'>('message')
    const [blockReason, setBlockReason] = useState('')
    const [curatorComment, setCuratorComment] = useState('')
    const [isSendingMessage, setIsSendingMessage] = useState(false)
    const [accessError, setAccessError] = useState<string | null>(null)

    const [activeTooltip, setActiveTooltip] = useState<{ day: number, taskId: number, text: string } | null>(null)
    const tooltipTimeoutRef = useRef<any>(null)

    const showTaskTooltip = (day: number, taskId: number, text: string) => {
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current)
        setActiveTooltip({ day, taskId, text })
        tooltipTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 2500)
    }

    // Initialization effect
    useEffect(() => {
        let mounted = true

        const init = async () => {
            // 1. Reset state on auth change
            if (authLoading) return
            setIsLoading(true)
            setAccessError(null)

            // If not logged in? (Optional: handle redirect or wait for auth)

            try {
                // 2. Check Admin Rights
                const adminRights = await isAdmin()

                if (!mounted) return

                if (!adminRights) {
                    setAccessError('Доступ запрещен. Недостаточно прав.')
                    setIsLoading(false)
                    return
                }

                setIsAdminUser(true)

                // 3. Load Data Parallel
                const p1 = getAllUsers().catch(e => {
                    // Игнорируем AbortError - это не критическая ошибка
                    if (e?.name === 'AbortError' || e?.message?.includes('abort') || e?.message?.includes('AbortError')) {
                        console.warn('Users load aborted, will retry on next mount')
                        return []
                    }
                    console.error('Users load failed:', e)
                    if (mounted) setAccessError(p => p ? `${p} | Users err` : `Ошибка загрузки пользователей: ${e.message}`)
                    return []
                })

                const p2 = getAdminStats().catch(e => {
                    // Игнорируем AbortError
                    if (e?.name === 'AbortError' || e?.message?.includes('abort')) {
                        console.warn('Stats load aborted')
                    } else {
                        console.error('Stats load failed:', e)
                    }
                    return { totalUsers: 0, activeUsers: 0, blockedUsers: 0, pendingReports: 0, completedToday: 0 }
                })

                const p3 = getAllReports().catch(e => {
                    if (e?.name === 'AbortError' || e?.message?.includes('abort')) {
                        console.warn('Reports load aborted')
                    } else {
                        console.error('Reports load failed:', e)
                    }
                    return []
                })

                const p4 = getAllMessages().catch(e => {
                    if (e?.name === 'AbortError' || e?.message?.includes('abort')) {
                        console.warn('Messages load aborted')
                    } else {
                        console.error('Messages load failed:', e)
                    }
                    return []
                })

                const [usersData, statsData, reportsData, messagesData] = await Promise.all([p1, p2, p3, p4])

                if (mounted) {
                    setUsers(usersData)
                    setStats(statsData)
                    setAllReports(reportsData)
                    setAllMessages(messagesData)
                }

            } catch (err: any) {
                console.error('Init failed:', err)
                if (mounted && err.name !== 'AbortError') setAccessError(`Критическая ошибка: ${err.message}`)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        init()

        return () => { mounted = false }
    }, [user, authLoading])


    const messagesEndRef = useState<HTMLDivElement | null>(null)[0];
    const scrollMessagesToBottom = () => {
        const container = document.getElementById('admin-chat-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    };

    useEffect(() => {
        if (userModalTab === 'messages' && selectedUserMessages.length > 0) {
            scrollMessagesToBottom();
        }
    }, [userModalTab, selectedUserMessages]);

    const handleUserClick = async (userItem: UserWithProgress, initialTab: 'progress' | 'reports' | 'messages' = 'progress') => {
        setSelectedUser(userItem)
        setUserModalTab(initialTab)
        setShowUserModal(true)

        try {
            const { getDetailedUserProgress } = await import('@/lib/services/progress')

            const [reports, messages, progress] = await Promise.all([
                getUserReports(userItem.id),
                getUserMessages(userItem.id),
                getDetailedUserProgress(userItem.id)
            ])
            setSelectedUserReports(reports)
            setSelectedUserMessages(messages)
            setUserProgressDetails(progress)
        } catch (error) {
            console.error('Error loading user details:', error)
        }
    }

    const handleSendMessage = async () => {
        if (!selectedUser || !messageText.trim() || isSendingMessage) return

        setIsSendingMessage(true)
        try {
            const result = await sendMessageToUser(selectedUser.id, messageText, messageType)
            if (result.success) {
                setMessageText('')
                setShowMessageModal(false)
                // Refresh messages history for this user immediately
                const messages = await getUserMessages(selectedUser.id)
                setSelectedUserMessages(messages)
            } else {
                alert(`Ошибка при отправке: ${result.error || 'Неизвестная ошибка'}`)
            }
        } catch (error: any) {
            console.error('Send message exception:', error)
            alert('Не удалось отправить сообщение. Проверьте интернет-соединение.')
        } finally {
            setIsSendingMessage(false)
        }
    }

    const handleBlockUser = async () => {
        if (!selectedUser || !blockReason.trim()) return

        const result = await blockUser(selectedUser.id, blockReason)
        if (result.success) {
            setBlockReason('')
            setShowBlockModal(false)
            setShowUserModal(false)
            await loadData()
        }
    }

    const handleUnblockUser = async () => {
        if (!selectedUser) return

        const result = await unblockUser(selectedUser.id)
        if (result.success) {
            setShowUserModal(false)
            await loadData()
        }
    }

    const handleReportAction = async (status: 'approved' | 'rejected') => {
        if (!selectedReport) return

        const result = await updateReportStatus(selectedReport.id, status, curatorComment || undefined)
        if (result.success) {
            setCuratorComment('')
            setShowReportModal(false)
            if (selectedUser) {
                const reports = await getUserReports(selectedUser.id)
                setSelectedUserReports(reports)
            }
            await loadData()
        }
    }

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Non-blocking loading check
    const isPageLoading = isLoading || (authLoading && !isAdminUser)

    if (accessError) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center p-4">
                <div className="glass-card max-w-md w-full p-8 text-center border-red-500/30">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Ошибка доступа</h1>
                    <p className="text-gray-400 mb-6">{accessError}</p>

                    <div className="bg-black/30 p-4 rounded-lg text-left text-xs font-mono text-gray-500 mb-6 overflow-auto">
                        <p>User ID: {user?.id || 'null'}</p>
                        <p>Email: {user?.email || 'null'}</p>
                        <p>Loading: {isLoading ? 'true' : 'false'}</p>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard')}
                        className="glass-button w-full"
                    >
                        Вернуться в Кабинет
                    </button>
                    <button
                        onClick={() => window.location.href = '/auth'}
                        className="text-gray-500 text-sm mt-4 hover:text-white underline"
                    >
                        Выйти из аккаунта (Hard Reset)
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-deep-dark">
            {/* Header */}
            <header className="glass-sidebar border-b border-white/5 px-4 md:px-8 py-3 md:py-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-4 min-w-0">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                       text-gray-400 hover:text-white transition-colors shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                            flex items-center justify-center shrink-0">
                                <Shield className="w-4 h-4 md:w-5 md:h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-base md:text-xl font-bold text-white truncate">Админ-панель</h1>
                                <p className="text-xs md:text-sm text-gray-400 hidden sm:block">Управление курсом</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        disabled={isLoading}
                        className={`glass-button-secondary flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 text-sm shrink-0 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{isLoading ? 'Загрузка...' : 'Обновить'}</span>
                    </button>
                </div>
            </header>

            <div className="p-4 md:p-8">
                {/* Stats Cards */}
                <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
                    <div className="snap-start shrink-0 w-[130px] md:w-auto"><StatCard icon={Users} label="Всего" value={stats.totalUsers} color="blue" /></div>
                    <div className="snap-start shrink-0 w-[130px] md:w-auto"><StatCard icon={TrendingUp} label="Активных" value={stats.activeUsers} color="green" /></div>
                    <div className="snap-start shrink-0 w-[130px] md:w-auto"><StatCard icon={Ban} label="Заблокиров." value={stats.blockedUsers} color="red" /></div>
                    <div className="snap-start shrink-0 w-[130px] md:w-auto"><StatCard icon={FileCheck} label="Ожидают" value={stats.pendingReports} color="orange" /></div>
                    <div className="snap-start shrink-0 w-[130px] md:w-auto"><StatCard icon={CheckCircle} label="Завершили" value={stats.completedToday} color="purple" /></div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
                    {[
                        { id: 'users', label: 'Пользователи', shortLabel: 'Пользов.', icon: Users },
                        { id: 'reports', label: 'Отчёты', shortLabel: 'Отчёты', icon: FileCheck },
                        { id: 'messages', label: 'Сообщения', shortLabel: 'Сообщ.', icon: MessageSquare }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl transition-all whitespace-nowrap text-sm shrink-0 ${activeTab === tab.id
                                ? 'bg-meta-orange text-white'
                                : 'bg-deep-dark-200/60 text-gray-400 hover:text-white hover:bg-deep-dark-200'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.shortLabel}</span>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Поиск по имени или почте..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="glass-input w-full pl-11 text-sm h-12"
                    />
                </div>

                {/* Content Sections */}
                {activeTab === 'users' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
                        {filteredUsers.map(userItem => (
                            <div
                                key={userItem.id}
                                onClick={() => handleUserClick(userItem)}
                                className="glass-card group p-5 cursor-pointer hover:border-meta-orange/30 transition-all hover:bg-white/[0.02]"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                                  flex items-center justify-center text-white text-lg font-bold">
                                        {(userItem.full_name || userItem.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate">{userItem.full_name || 'Без имени'}</h3>
                                        <p className="text-xs text-gray-500 truncate">{userItem.email}</p>
                                    </div>
                                    {userItem.is_blocked && (
                                        <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-[10px] font-bold uppercase">Заблокирован</span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Прогресс</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-cyan-400"
                                                    style={{ width: `${Math.round((userItem.completed_days / 25) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold">{userItem.completed_days}/25</span>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Активность</p>
                                        <div className="flex items-center gap-1.5 text-xs font-bold">
                                            <Clock className="w-3 h-3 text-meta-orange" />
                                            {userItem.last_activity ? new Date(userItem.last_activity).toLocaleDateString('ru-RU') : 'Нет'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
                        {allReports.filter(r =>
                            !searchQuery ||
                            r.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            r.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map(report => (
                            <div
                                key={report.id}
                                onClick={() => {
                                    const userObj = users.find(u => u.id === report.user_id)
                                    if (userObj) {
                                        setSelectedReport(report)
                                        setShowReportModal(true)
                                    }
                                }}
                                className="glass-card p-5 cursor-pointer hover:border-meta-orange/30 transition-all"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${report.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
                                        report.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {report.status === 'pending' ? 'Ожидает' : report.status === 'approved' ? 'Принят' : 'Отклонен'}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">
                                        {new Date(report.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-sm font-bold text-white">
                                        {report.user?.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white leading-none mb-1">{report.user?.full_name || 'Пользователь'}</p>
                                        <p className="text-xs text-meta-orange font-bold uppercase">День {report.day_number}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 line-clamp-2 italic">{report.comment || 'Без комментария'}</p>
                            </div>
                        ))}
                        {allReports.length === 0 && (
                            <div className="glass-card p-12 text-center text-gray-400 col-span-full">
                                Отчёты не найдены
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="space-y-3 animate-fade-in">
                        {allMessages.filter(m =>
                            !searchQuery ||
                            m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.from_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map(msg => (
                            <div
                                key={msg.id}
                                onClick={() => {
                                    const userObj = users.find(u => u.id === msg.from_user_id || u.id === msg.to_user_id)
                                    if (userObj) handleUserClick(userObj, 'messages')
                                }}
                                className={`glass-card p-4 cursor-pointer hover:border-meta-orange/30 transition-all flex items-center gap-4 ${!msg.is_read ? 'border-meta-orange/40 bg-meta-orange/5' : ''}`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center text-meta-orange shrink-0">
                                    {msg.message_type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-sm font-bold text-white truncate">
                                            {msg.from_user?.full_name || 'Пользователь'}
                                        </p>
                                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                            {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 truncate leading-relaxed">{msg.message}</p>
                                </div>
                                {!msg.is_read && (
                                    <div className="w-2 h-2 rounded-full bg-meta-orange shrink-0" />
                                )}
                            </div>
                        ))}
                        {allMessages.length === 0 && (
                            <div className="glass-card p-12 text-center text-gray-400">
                                Сообщения не найдены
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                    <div
                        className="glass-card p-4 md:p-6 w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto animate-fade-in md:mx-4 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
                            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                                flex items-center justify-center text-white text-xl font-bold shrink-0">
                                    {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg md:text-xl font-bold text-white truncate">
                                        {selectedUser.full_name || 'Без имени'}
                                    </h2>
                                    <p className="text-xs md:text-sm text-gray-400 truncate">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUserModal(false)}
                                className="w-10 h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                           text-gray-400 hover:text-white transition-colors shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* User Tabs - Scrollable on mobile */}
                        <div className="flex gap-4 border-b border-white/5 mb-6 overflow-x-auto no-scrollbar shrink-0">
                            {[
                                { id: 'progress', label: 'Прогресс', icon: TrendingUp },
                                { id: 'reports', label: 'Отчёты', icon: FileCheck },
                                { id: 'messages', label: 'Сообщения', icon: MessageSquare }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setUserModalTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-1 pb-3 text-xs md:text-sm font-bold transition-all relative whitespace-nowrap ${userModalTab === tab.id ? 'text-meta-orange' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                    {userModalTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-meta-orange rounded-full" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Overview Tab Content */}
                        {userModalTab === 'progress' && (
                            <div className="animate-fade-in flex-1">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-3 md:p-4">
                                        <p className="text-[10px] md:text-xs text-gray-500 font-black uppercase mb-1">Заданий</p>
                                        <p className="text-lg md:text-2xl font-bold text-white">
                                            {selectedUser.completed_days}/{courseData.reduce((acc, d) => acc + d.tasks.length, 0)}
                                        </p>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-3 md:p-4">
                                        <p className="text-[10px] md:text-xs text-gray-500 font-black uppercase mb-1">Отчётов</p>
                                        <p className="text-lg md:text-2xl font-bold text-white">{selectedUserReports.length}</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-3 md:p-4">
                                        <p className="text-[10px] md:text-xs text-gray-500 font-black uppercase mb-1">Сообщений</p>
                                        <p className="text-lg md:text-2xl font-bold text-white">{selectedUserMessages.length}</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-3 md:p-4">
                                        <p className="text-[10px] md:text-xs text-gray-500 font-black uppercase mb-1">Регистрация</p>
                                        <p className="text-sm md:text-lg font-bold text-white leading-tight">
                                            {new Date(selectedUser.created_at).toLocaleDateString('ru-RU')}
                                        </p>
                                    </div>
                                </div>

                                <h3 className="text-sm md:text-base font-bold text-white mb-4 italic uppercase tracking-wider">Прогресс заданий (7 дней)</h3>
                                <div className="bg-black/20 rounded-2xl p-4 md:p-6 space-y-4">
                                    {courseData.map(day => {
                                        const completedTasks = userProgressDetails.filter(p => p.day_number === day.dayNumber && p.completed === true)
                                        const completedTaskIds = completedTasks.map(p => p.task_id)
                                        const totalTasks = day.tasks.length
                                        const completedCount = completedTaskIds.length
                                        const percent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

                                        return (
                                            <div key={day.dayNumber} className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">День {day.dayNumber}</span>
                                                    <span className="text-[10px] font-bold text-white">{percent}%</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 flex gap-1 h-8 items-center bg-black/40 rounded-xl px-2 relative group overflow-visible">
                                                        {day.tasks.map(task => {
                                                            const isCompleted = completedTaskIds.includes(task.id)
                                                            const isTooltipActive = activeTooltip?.day === day.dayNumber && activeTooltip?.taskId === task.id

                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    onClick={() => showTaskTooltip(day.dayNumber, task.id, task.text)}
                                                                    className={`h-4 flex-1 rounded-full transition-all cursor-pointer relative ${isCompleted ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-white/5 hover:bg-white/10'}`}
                                                                >
                                                                    {/* Custom Tooltip Overlay */}
                                                                    {isTooltipActive && (
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] w-48 py-2 px-3 bg-meta-orange text-white text-[10px] font-bold rounded-lg shadow-2xl shadow-black pointer-events-none animate-bounce-subtle outline outline-4 outline-black/20">
                                                                            <div className="relative z-10">{task.text}</div>
                                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-meta-orange" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Reports Tab Content */}
                        {userModalTab === 'reports' && (
                            <div className="animate-fade-in space-y-6">
                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                                    {[1, 2, 3, 4, 5, 6, 7].map(day => {
                                        const report = selectedUserReports.find(r => r.day_number === day)
                                        return (
                                            <div
                                                key={day}
                                                onClick={() => {
                                                    if (report) {
                                                        setSelectedReport(report)
                                                        setShowReportModal(true)
                                                    }
                                                }}
                                                className={`glass-card p-4 text-center cursor-pointer transition-all border-2 ${report
                                                    ? report.status === 'approved'
                                                        ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40'
                                                        : report.status === 'rejected'
                                                            ? 'border-red-500/20 bg-red-500/5 hover:border-red-500/40'
                                                            : 'border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40'
                                                    : 'bg-deep-dark-200/40 border-transparent opacity-40'
                                                    }`}
                                            >
                                                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">День</p>
                                                <p className="text-xl font-black text-white">{day}</p>
                                            </div>
                                        )
                                    })}
                                </div>

                                {selectedUserReports.length === 0 && (
                                    <p className="text-center py-10 text-gray-500 italic">Пользователь еще не отправлял отчеты</p>
                                )}
                            </div>
                        )}

                        {/* Messages Tab Content */}
                        {userModalTab === 'messages' && (
                            <div className="animate-fade-in flex flex-col h-[60vh] md:h-[500px]">
                                <div id="admin-chat-container" className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 custom-scrollbar scroll-smooth">
                                    {selectedUserMessages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4">
                                                <MessageSquare className="w-8 h-8 text-gray-600" />
                                            </div>
                                            <p className="text-gray-500">История переписки пуста</p>
                                        </div>
                                    ) : (
                                        selectedUserMessages.map(msg => {
                                            // Message is from ME (Admin) if from_user_id matches my ID
                                            const isFromMe = msg.from_user_id === user?.id;
                                            // Label shows Student name only if it's NOT from me
                                            const label = isFromMe ? 'Вы' : (selectedUser.full_name || 'Подопечный');

                                            return (
                                                <div key={msg.id} className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}>
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase mb-1 px-1">
                                                        {label}
                                                    </span>
                                                    <div className={`max-w-[85%] p-4 rounded-2xl ${!isFromMe
                                                        ? 'bg-deep-dark-200/80 text-gray-200 rounded-tl-none border border-white/10'
                                                        : msg.message_type === 'warning'
                                                            ? 'bg-yellow-500 text-black rounded-tr-none shadow-lg shadow-yellow-500/10'
                                                            : 'bg-meta-orange text-white rounded-tr-none shadow-lg shadow-meta-orange/10'
                                                        }`}>
                                                        <div className="flex items-center gap-2 mb-1.5 opacity-70">
                                                            {msg.message_type === 'warning' && <AlertTriangle className={`w-3 h-3 ${!isFromMe ? 'text-yellow-400' : 'text-black'}`} />}
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isFromMe && msg.message_type === 'warning' ? 'text-black' : ''}`}>
                                                                {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Quick Reply Area */}
                                <div className="pt-4 border-t border-white/5 space-y-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => setMessageType('message')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${messageType === 'message' ? 'bg-meta-orange text-white' : 'bg-white/5 text-gray-500'}`}>Обычное</button>
                                        <button onClick={() => setMessageType('warning')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${messageType === 'warning' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-gray-500'}`}>Предупреждение</button>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            placeholder="Напишите сообщение..."
                                            className="glass-input w-full h-24 resize-none pr-16 text-sm"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!messageText.trim() || isSendingMessage}
                                            className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-meta-orange text-white flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-meta-orange/30"
                                        >
                                            {isSendingMessage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Danger Zone */}
                        <div className="mt-12 pt-8 border-t border-white/5 flex justify-end gap-3">
                            {!selectedUser.is_blocked && (
                                <button
                                    onClick={() => setShowBlockModal(true)}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500/20 transition-all uppercase tracking-widest"
                                >
                                    <Ban className="w-4 h-4" /> Заблокировать
                                </button>
                            )}
                            {selectedUser.is_blocked && (
                                <button
                                    onClick={handleUnblockUser}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/10 text-green-500 text-xs font-bold hover:bg-green-500/20 transition-all uppercase tracking-widest"
                                >
                                    <CheckCircle className="w-4 h-4" /> Разблокировать
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Block User Modal */}
            {showBlockModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
                    <div
                        className="glass-card p-5 md:p-6 w-full max-w-lg animate-fade-in mx-3 md:mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <Ban className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Блокировка пользователя</h2>
                                <p className="text-gray-400">{selectedUser.full_name || selectedUser.email}</p>
                            </div>
                        </div>

                        <textarea
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            placeholder="Причина блокировки..."
                            className="glass-input w-full h-24 resize-none mb-4"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBlockModal(false)}
                                className="glass-button-secondary flex-1"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleBlockUser}
                                disabled={!blockReason.trim()}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold 
                                           px-6 py-3 rounded-xl transition-all"
                            >
                                Заблокировать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Review Modal */}
            {showReportModal && selectedReport && (
                <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div
                        className="glass-card p-4 md:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in mx-3 md:mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">
                                Отчёт по Дню {selectedReport.day_number}
                            </h2>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="w-10 h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                           text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Photos */}
                        {selectedReport.files && selectedReport.files.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-400 mb-3">Прикреплённые фото</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {selectedReport.files.map((file, idx) => (
                                        <div key={idx} className="group relative rounded-2xl overflow-hidden bg-black/40 border border-white/5 flex items-center justify-center min-h-[300px] max-h-[600px]">
                                            {file.url ? (
                                                <>
                                                    <img
                                                        src={file.url}
                                                        alt={file.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                    {/* Full Screen Overlay */}
                                                    <button
                                                        onClick={() => window.open(file.url, '_blank')}
                                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"
                                                    >
                                                        <div className="w-12 h-12 rounded-full bg-meta-orange text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                                            <Eye className="w-6 h-6" />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">Открыть оригинал</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Image className="w-8 h-8 text-gray-500" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Comment */}
                        {selectedReport.comment && (
                            <div className="glass-card p-4 mb-6 bg-deep-dark-200/40">
                                <h3 className="text-sm font-semibold text-gray-400 mb-2">Комментарий пользователя</h3>
                                <p className="text-white">{selectedReport.comment}</p>
                            </div>
                        )}

                        {/* Curator Comment */}
                        {selectedReport.status === 'pending' && (
                            <>
                                <textarea
                                    value={curatorComment}
                                    onChange={(e) => setCuratorComment(e.target.value)}
                                    placeholder="Комментарий куратора (опционально)..."
                                    className="glass-input w-full h-24 resize-none mb-4"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleReportAction('rejected')}
                                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 
                                                   font-semibold px-6 py-3 rounded-xl transition-all
                                                   flex items-center justify-center gap-2"
                                    >
                                        <XCircle className="w-5 h-5" />
                                        Отклонить
                                    </button>
                                    <button
                                        onClick={() => handleReportAction('approved')}
                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white 
                                                   font-semibold px-6 py-3 rounded-xl transition-all
                                                   flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        Одобрить
                                    </button>
                                </div>
                            </>
                        )}

                        {selectedReport.status !== 'pending' && (
                            <div className={`p-4 rounded-xl ${selectedReport.status === 'approved'
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-red-500/10 border border-red-500/30'
                                }`}>
                                <div className="flex items-center gap-2">
                                    {selectedReport.status === 'approved' ? (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-400" />
                                    )}
                                    <span className={selectedReport.status === 'approved' ? 'text-green-400' : 'text-red-400'}>
                                        {selectedReport.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                                    </span>
                                </div>
                                {selectedReport.curator_comment && (
                                    <p className="text-gray-300 mt-2">{selectedReport.curator_comment}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Stat Card Component
function StatCard({
    icon: Icon,
    label,
    value,
    color
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: number
    color: 'blue' | 'green' | 'red' | 'orange' | 'purple'
}) {
    const colors = {
        blue: 'text-blue-400 bg-blue-500/20',
        green: 'text-green-400 bg-green-500/20',
        red: 'text-red-400 bg-red-500/20',
        orange: 'text-meta-orange bg-meta-orange/20',
        purple: 'text-purple-400 bg-purple-500/20'
    }

    return (
        <div className="glass-card p-3 md:p-5 h-full">
            <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
                    <Icon className="w-4 h-4 md:w-5 md:h-5" />
                </div>
            </div>
            <p className="text-xl md:text-3xl font-bold text-white">{value}</p>
            <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1">{label}</p>
        </div>
    )
}
