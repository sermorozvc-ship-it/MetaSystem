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
import { createClient, clearUserCache } from '@/lib/supabase/client'
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
    deleteReport,
    getAdminStats,
    UserWithProgress,
    DayReportWithUser,
    AdminMessage
} from '@/lib/services/admin'
import { courseData } from '@/lib/data/courseData'

type Tab = 'users' | 'reports' | 'messages'

export default function AdminPage() {
    const { user, signOut, isLoading: authLoading } = useAuth()
    const router = useRouter()

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
        const controller = new AbortController()

        // Safety timeout to prevent infinite loading state
        const safetyTimer = setTimeout(() => {
            if (mounted) setIsLoading(false)
        }, 5000)

        const init = async () => {
            if (authLoading) return

            // If we already have users and it's just a background sync, don't show global loader
            if (users.length === 0) setIsLoading(true)
            setAccessError(null)

            try {
                // 1. Проверяем что пользователь залогинен
                if (!user) {
                    console.warn('[AdminPage] No user found, will show login form')
                    setIsLoading(false)
                    return
                }

                // 2. Check Admin Rights — теперь всегда берёт свежую сессию
                const adminRights = await isAdmin()
                if (!mounted) return

                if (!adminRights) {
                    console.error('[AdminPage] Access Denied for user:', user?.email)
                    setAccessError('Доступ запрещен. У вас нет прав администратора.')
                    setIsLoading(false)
                    return
                }
                setIsAdminUser(true)

                // 3. Load Data Parallel with individual error handling
                const [usersData, statsData, reportsData, messagesData] = await Promise.all([
                    getAllUsers().catch(err => { console.error('Users fetch error:', err); return []; }),
                    getAdminStats().catch(err => { console.error('Stats fetch error:', err); return stats; }),
                    getAllReports().catch(err => { console.error('Reports fetch error:', err); return []; }),
                    getAllMessages().catch(err => { console.error('Messages fetch error:', err); return []; })
                ])

                if (mounted) {
                    setUsers(usersData)  // всегда обновляем, даже если пустой массив
                    setStats(statsData)
                    setAllReports(reportsData)
                    setAllMessages(messagesData)
                    console.log(`[AdminPage] Loaded: ${usersData.length} users, ${reportsData.length} reports, ${messagesData.length} messages`)
                }
            } catch (err: any) {
                console.error('Admin Init failed:', err)
                // Показываем ошибку только если это не ошибка доступа (она уже обработана выше)
                if (mounted && !accessError) {
                    console.warn('[AdminPage] Ошибка загрузки данных:', err.message)
                }
            } finally {
                if (mounted) {
                    setIsLoading(false)
                    clearTimeout(safetyTimer)
                }
            }
        }

        init()
        return () => {
            mounted = false
            controller.abort()
            clearTimeout(safetyTimer)
        }
    }, [user?.id, authLoading]) // Only depend on user ID, not the whole object

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
                const messages = await getUserMessages(selectedUser.id)
                setSelectedUserMessages(messages)
            }
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
            window.location.reload()
        }
    }

    const handleUnblockUser = async () => {
        if (!selectedUser) return
        const result = await unblockUser(selectedUser.id)
        if (result.success) {
            setShowUserModal(false)
            window.location.reload()
        }
    }

    const handleDeleteReport = async (reportId: number) => {
        if (!confirm('Удалить этот отчёт?')) return
        const result = await deleteReport(reportId)
        if (result.success) {
            setShowReportModal(false)
            window.location.reload()
        }
    }

    const handleReportAction = async (status: 'approved' | 'rejected') => {
        if (!selectedReport) return
        const result = await updateReportStatus(selectedReport.id, status, curatorComment || undefined)
        if (result.success) {
            setShowReportModal(false)
            window.location.reload()
        }
    }

    const filteredUsers = users.filter(u => {
        const query = searchQuery.toLowerCase();
        const nameMatch = (u.full_name || '').toLowerCase().includes(query);
        const emailMatch = (u.email || '').toLowerCase().includes(query);
        return nameMatch || emailMatch;
    })

    if (accessError || (!isAdminUser && !isLoading && !authLoading)) {
        // Всегда показываем форму входа при любой проблеме с доступом
        return <AdminLoginForm />
    }

    const handleCloseModal = () => {
        setShowUserModal(false)
        setSelectedUser(null) // Clear selected user
        setUserProgressDetails([]) // Clear progress cache
        setSelectedUserReports([])
        setSelectedUserMessages([])
    }

    return (
        <div className="min-h-screen bg-deep-dark">
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

                    <div className="flex items-center gap-2">
                        {isLoading && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-meta-orange/10 rounded-lg border border-meta-orange/20 animate-pulse">
                                <RefreshCw className="w-3.5 h-3.5 text-meta-orange animate-spin" />
                                <span className="text-[10px] uppercase font-bold text-meta-orange">Загрузка...</span>
                            </div>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            disabled={isLoading}
                            className={`glass-button-secondary flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 text-sm shrink-0 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Обновить</span>
                        </button>
                    </div>
                </div>
            </header>

            {isLoading && !users.length ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <Shield className="w-12 h-12 text-meta-orange animate-bounce mb-4" />
                    <h2 className="text-xl font-bold text-white">Загрузка данных...</h2>
                </div>
            ) : (
                <>
                    <div className="p-4 md:p-8">
                        <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
                            <StatCard icon={Users} label="Всего" value={stats.totalUsers} color="blue" />
                            <StatCard icon={TrendingUp} label="Активных" value={stats.activeUsers} color="green" />
                            <StatCard icon={Ban} label="Заблокиров." value={stats.blockedUsers} color="red" />
                            <StatCard icon={FileCheck} label="Ожидают" value={stats.pendingReports} color="orange" />
                            <StatCard icon={CheckCircle} label="Завершили" value={stats.completedToday} color="purple" />
                        </div>

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
                                                    <div className="h-2.5 flex-1 bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all duration-500"
                                                            style={{ width: `${Math.round((userItem.completed_days / 25) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black text-cyan-400/90">{userItem.completed_days}/25</span>
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
                                            setSelectedReport(report)
                                            setShowReportModal(true)
                                        }}
                                        className="glass-card p-5 cursor-pointer hover:border-meta-orange/30 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${report.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
                                                report.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                {report.status === 'pending' ? 'Ожидает' : report.status === 'approved' ? 'Принят' : 'Отклонен'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">
                                                    {new Date(report.created_at).toLocaleDateString('ru-RU')}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteReport(report.id)
                                                    }}
                                                    className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
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
                            </div>
                        )}
                    </div>

                    {/* Modals Section */}
                    {showUserModal && selectedUser && (
                        <div className="modal-overlay" onClick={handleCloseModal}>
                            <div className="glass-card p-4 md:p-6 w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto animate-fade-in md:mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                                            {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="text-lg md:text-xl font-bold text-white truncate">{selectedUser.full_name || 'Без имени'}</h2>
                                            <p className="text-xs md:text-sm text-gray-400">{selectedUser.email}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleCloseModal} className="w-10 h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex gap-4 border-b border-white/5 mb-6 overflow-x-auto no-scrollbar shrink-0">
                                    {[
                                        { id: 'progress', label: 'Прогресс', icon: TrendingUp },
                                        { id: 'reports', label: 'Отчёты', icon: FileCheck },
                                        { id: 'messages', label: 'Сообщения', icon: MessageSquare }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setUserModalTab(tab.id as any)}
                                            className={`flex items-center gap-2 px-1 pb-3 text-xs md:text-sm font-bold transition-all relative whitespace-nowrap ${userModalTab === tab.id ? 'text-meta-orange' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <tab.icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                            {userModalTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-meta-orange rounded-full" />}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 overflow-y-auto min-h-0">
                                    {userModalTab === 'progress' && (
                                        <div className="animate-fade-in space-y-6">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white/5 p-4 rounded-2xl">
                                                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Заданий</p>
                                                    <p className="text-xl font-bold text-white">{selectedUser.completed_days}/25</p>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-2xl">
                                                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Отчётов</p>
                                                    <p className="text-xl font-bold text-white">{selectedUserReports.length}</p>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-2xl">
                                                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Сообщений</p>
                                                    <p className="text-xl font-bold text-white">{selectedUserMessages.length}</p>
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-2xl">
                                                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Регистрация</p>
                                                    <p className="text-sm font-bold text-white">{new Date(selectedUser.created_at).toLocaleDateString('ru-RU')}</p>
                                                </div>
                                            </div>

                                            <div className="bg-black/20 rounded-2xl p-6 space-y-4">
                                                {courseData.map(day => {
                                                    const userDayProgress = userProgressDetails.filter(p =>
                                                        p.day_number === day.dayNumber &&
                                                        p.user_id === selectedUser.id &&
                                                        p.completed === true
                                                    )
                                                    const totalTasks = day.tasks.length
                                                    const percent = totalTasks > 0 ? Math.round((userDayProgress.length / totalTasks) * 100) : 0

                                                    return (
                                                        <div key={day.dayNumber} className="flex flex-col gap-2.5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-meta-orange shadow-[0_0_8px_rgba(255,107,0,0.4)]" />
                                                                    <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider">День {day.dayNumber}</span>
                                                                </div>
                                                                <span className={`text-[11px] font-black px-2 py-0.5 rounded-md bg-white/5 ${percent === 100 ? 'text-cyan-400' : 'text-white'}`}>
                                                                    {percent}%
                                                                </span>
                                                            </div>
                                                            <div className="h-6 bg-black/40 rounded-xl flex gap-1.5 px-1.5 py-1 border border-white/5 backdrop-blur-sm relative">
                                                                {day.tasks.map((task, idx) => {
                                                                    const isCompleted = userProgressDetails.some(p =>
                                                                        p.day_number === day.dayNumber &&
                                                                        String(p.task_id) === String(task.id) &&
                                                                        p.user_id === selectedUser.id &&
                                                                        p.completed === true
                                                                    )

                                                                    const taskName = task.text || (task as any).title || `Задание ${idx + 1}`;

                                                                    return (
                                                                        <div
                                                                            key={task.id}
                                                                            className="h-full flex-1 relative group/task cursor-help"
                                                                        >
                                                                            <div className={`absolute inset-0 rounded-md transition-all duration-300 ${isCompleted
                                                                                ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                                                                                : 'bg-white/10 group-hover/task:bg-white/20'
                                                                                }`} />

                                                                            {/* Floating Tooltip */}
                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-deep-dark-200 border border-white/10 rounded-xl text-[11px] font-bold text-white whitespace-nowrap opacity-0 group-hover/task:opacity-100 transition-all scale-90 group-hover/task:scale-100 pointer-events-none z-[100] shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-cyan-400' : 'bg-gray-500'}`} />
                                                                                    {taskName}
                                                                                </div>
                                                                                {/* Triangle pointer */}
                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-deep-dark-200" />
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {userModalTab === 'reports' && (
                                        <div className="animate-fade-in grid grid-cols-4 sm:grid-cols-7 gap-3">
                                            {[1, 2, 3, 4, 5, 6, 7].map(day => {
                                                const report = selectedUserReports.find(r => r.day_number === day)
                                                return (
                                                    <div
                                                        key={day}
                                                        onClick={() => { if (report) { setSelectedReport(report); setShowReportModal(true); } }}
                                                        className={`glass-card p-4 text-center cursor-pointer border-2 ${report ? 'border-meta-orange/20' : 'opacity-30'}`}
                                                    >
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">День</p>
                                                        <p className="text-xl font-black text-white">{day}</p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {userModalTab === 'messages' && (
                                        <div className="animate-fade-in flex flex-col h-full min-h-[400px]">
                                            <div id="admin-chat-container" className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar scroll-smooth">
                                                {selectedUserMessages.map(msg => {
                                                    const isFromMe = msg.from_user_id === user?.id;
                                                    return (
                                                        <div key={msg.id} className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[85%] p-3 rounded-2xl ${isFromMe ? 'bg-meta-orange text-white rounded-tr-none' : 'bg-deep-dark-200 text-gray-200 rounded-tl-none border border-white/5'}`}>
                                                                <p className="text-sm">{msg.message}</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="relative pt-4 border-t border-white/5">
                                                <textarea
                                                    value={messageText}
                                                    onChange={(e) => setMessageText(e.target.value)}
                                                    placeholder="Напишите сообщение..."
                                                    className="glass-input w-full h-24 resize-none pr-14"
                                                />
                                                <button onClick={handleSendMessage} disabled={!messageText.trim() || isSendingMessage} className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-meta-orange text-white flex items-center justify-center shadow-lg shadow-meta-orange/20">
                                                    {isSendingMessage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-3">
                                    <button onClick={selectedUser.is_blocked ? handleUnblockUser : () => setShowBlockModal(true)} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all ${selectedUser.is_blocked ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {selectedUser.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showBlockModal && selectedUser && (
                        <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
                            <div className="glass-card p-6 w-full max-w-lg animate-fade-in mx-4" onClick={e => e.stopPropagation()}>
                                <h2 className="text-xl font-bold text-white mb-4">Блокировка</h2>
                                <textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Причина..." className="glass-input w-full h-24 mb-4" />
                                <div className="flex gap-3">
                                    <button onClick={() => setShowBlockModal(false)} className="glass-button-secondary flex-1">Отмена</button>
                                    <button onClick={handleBlockUser} disabled={!blockReason.trim()} className="bg-red-500 text-white flex-1 p-3 rounded-xl font-bold">Блокировать</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showReportModal && selectedReport && (
                        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
                            <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in mx-4" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-white">Отчёт за {selectedReport.day_number} день</h2>
                                    <button onClick={() => setShowReportModal(false)} className="text-gray-500 hover:text-white"><X /></button>
                                </div>

                                {selectedReport.files?.map((f, i) => (
                                    <div key={i} className="mb-4 rounded-2xl overflow-hidden border border-white/5 bg-black/20">
                                        <img src={f.url} alt="Report" className="w-full h-auto max-h-[500px] object-contain" />
                                    </div>
                                ))}

                                <p className="text-gray-300 italic mb-6">"{selectedReport.comment || 'Без комментария'}"</p>

                                {selectedReport.status === 'pending' && (
                                    <div className="space-y-4">
                                        <textarea value={curatorComment} onChange={(e) => setCuratorComment(e.target.value)} placeholder="Комментарий куратора..." className="glass-input w-full h-20" />
                                        <div className="flex gap-4">
                                            <button onClick={() => handleReportAction('rejected')} className="flex-1 bg-red-500/10 text-red-500 p-3 rounded-xl font-bold">Отклонить</button>
                                            <button onClick={() => handleReportAction('approved')} className="flex-1 bg-green-500 text-white p-3 rounded-xl font-bold">Одобрить</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: number, color: 'blue' | 'green' | 'red' | 'orange' | 'purple' }) {
    const colors = {
        blue: 'text-blue-400 bg-blue-500/10',
        green: 'text-green-400 bg-green-500/10',
        red: 'text-red-400 bg-red-500/10',
        orange: 'text-meta-orange bg-meta-orange/10',
        purple: 'text-purple-400 bg-purple-500/10'
    }
    return (
        <div className="glass-card p-4 flex-1 min-w-[130px] md:min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
                <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{label}</p>
        </div>
    )
}

function AdminLoginForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const supabase = createClient()
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) {
                setError(authError.message === 'Invalid login credentials'
                    ? 'Неверный email или пароль'
                    : authError.message)
                setLoading(false)
                return
            }

            // Очищаем кеш и перезагружаем — теперь сессия будет реальной
            clearUserCache()
            if (typeof window !== 'undefined') {
                localStorage.removeItem('dev_admin_email')
            }
            window.location.reload()
        } catch (err: any) {
            setError('Ошибка подключения к серверу')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-deep-dark flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-meta-orange to-orange-600 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Админ-панель</h1>
                    <p className="text-sm text-gray-400">Войдите с правами администратора</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            className="glass-input w-full"
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="glass-input w-full"
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="glass-button w-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Вход...
                            </>
                        ) : (
                            <>
                                <Shield className="w-4 h-4" />
                                Войти
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

