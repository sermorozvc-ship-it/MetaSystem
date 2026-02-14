'use client'

import { useState, useEffect } from 'react'
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
    RefreshCw
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

    // Form states
    const [messageText, setMessageText] = useState('')
    const [messageType, setMessageType] = useState<'message' | 'warning'>('message')
    const [blockReason, setBlockReason] = useState('')
    const [curatorComment, setCuratorComment] = useState('')

    const [accessError, setAccessError] = useState<string | null>(null)

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


    const handleUserClick = async (userItem: UserWithProgress) => {
        setSelectedUser(userItem)
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
        if (!selectedUser || !messageText.trim()) return

        const result = await sendMessageToUser(selectedUser.id, messageText, messageType)
        if (result.success) {
            setMessageText('')
            setShowMessageModal(false)
            // Refresh messages
            const messages = await getUserMessages(selectedUser.id)
            setSelectedUserMessages(messages)
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
                <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
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
                <div className="relative mb-4 md:mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Поиск по имени или email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="glass-input w-full pl-12"
                    />
                </div>

                {/* Users List */}
                {activeTab === 'users' && (
                    <div className="space-y-3">
                        {filteredUsers.map(userItem => (
                            <div
                                key={userItem.id}
                                className="glass-card p-4 hover:bg-deep-dark-200/30 transition-colors cursor-pointer"
                                onClick={() => handleUserClick(userItem)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                                    flex items-center justify-center text-white font-bold shrink-0">
                                        {(userItem.full_name || userItem.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-sm truncate">{userItem.full_name || 'Без имени'}</p>
                                        <p className="text-xs text-gray-400 truncate">{userItem.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                        <div className="text-right">
                                            <span className="text-white font-semibold text-sm">{userItem.completed_days}</span>
                                            <span className="text-gray-400 text-xs">/7</span>
                                            <div className="w-14 h-1.5 bg-deep-dark-200 rounded-full mt-1">
                                                <div
                                                    className="h-full bg-meta-orange rounded-full"
                                                    style={{ width: `${(userItem.completed_days / 7) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        {userItem.is_blocked ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                                           bg-red-500/10 text-red-400 text-xs">
                                                <Ban className="w-3 h-3" />
                                                <span className="hidden sm:inline">Заблок.</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                                           bg-green-500/10 text-green-400 text-xs">
                                                <CheckCircle className="w-3 h-3" />
                                                <span className="hidden sm:inline">Актив</span>
                                            </span>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-gray-500 hidden md:block" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredUsers.length === 0 && (
                            <div className="glass-card p-12 text-center text-gray-400">
                                Пользователи не найдены
                            </div>
                        )}
                    </div>
                )}

                {/* Reports List */}
                {activeTab === 'reports' && (
                    <div className="space-y-3">
                        {allReports.filter(r =>
                            !searchQuery ||
                            (r.user as any)?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (r.user as any)?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map(report => (
                            <div
                                key={report.id}
                                className="glass-card p-4 hover:bg-deep-dark-200/30 transition-colors cursor-pointer"
                                onClick={() => {
                                    setSelectedReport(report)
                                    setShowReportModal(true)
                                }}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600
                                                    flex items-center justify-center text-white font-bold text-sm shrink-0">
                                        {((report.user as any)?.full_name || (report.user as any)?.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-sm truncate">{(report.user as any)?.full_name || 'Без имени'}</p>
                                        <p className="text-xs text-gray-400 truncate">{(report.user as any)?.email}</p>
                                    </div>
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-meta-orange/20 text-meta-orange font-bold text-sm shrink-0">
                                        {report.day_number}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        {report.files?.length ? (
                                            <span className="flex items-center gap-1">
                                                <Image className="w-3.5 h-3.5" />
                                                {report.files.length} фото
                                            </span>
                                        ) : null}
                                        <span>{new Date(report.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                    {report.status === 'approved' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">
                                            <CheckCircle className="w-3 h-3" /> Одобрен
                                        </span>
                                    ) : report.status === 'rejected' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">
                                            <X className="w-3 h-3" /> Отклонён
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs">
                                            <Clock className="w-3 h-3" /> Ожидает
                                        </span>
                                    )}
                                </div>
                                {report.comment && (
                                    <p className="text-gray-400 text-xs mt-2 line-clamp-2">{report.comment}</p>
                                )}
                            </div>
                        ))}
                        {allReports.length === 0 && (
                            <div className="glass-card p-12 text-center text-gray-400">
                                Отчёты не найдены
                            </div>
                        )}
                    </div>
                )}

                {/* Messages List */}
                {activeTab === 'messages' && (
                    <div className="space-y-3">
                        {allMessages.filter(m =>
                            !searchQuery ||
                            m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (m.from_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (m.to_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                        ).map(msg => (
                            <div
                                key={msg.id}
                                className="glass-card p-4 hover:bg-deep-dark-200/30 transition-colors cursor-pointer"
                                onClick={() => {
                                    const targetUser = users.find(u => u.id === msg.to_user_id || u.id === msg.from_user_id)
                                    if (targetUser) handleUserClick(targetUser)
                                }}
                            >
                                <div className="flex items-start gap-3 mb-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                                            {(msg.from_user?.full_name || msg.from_user?.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white text-sm truncate">{msg.from_user?.full_name || 'Удалён'}</span>
                                        <span className="text-gray-500 text-xs shrink-0">→</span>
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                                            {(msg.to_user?.full_name || msg.to_user?.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white text-sm truncate">{msg.to_user?.full_name || 'Удалён'}</span>
                                    </div>
                                </div>
                                <p className="text-gray-300 text-sm line-clamp-2 mb-2">{msg.message}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                        {new Date(msg.created_at).toLocaleDateString('ru-RU', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                    {msg.message_type === 'warning' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs">
                                            <AlertTriangle className="w-3 h-3" /> Внимание
                                        </span>
                                    ) : msg.message_type === 'announcement' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                                            <Flame className="w-3 h-3" /> Объявление
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                                            <MessageSquare className="w-3 h-3" /> Сообщение
                                        </span>
                                    )}
                                </div>
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
                        className="glass-card p-4 md:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in mx-3 md:mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                                flex items-center justify-center text-white text-xl font-bold">
                                    {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {selectedUser.full_name || 'Без имени'}
                                    </h2>
                                    <p className="text-gray-400">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUserModal(false)}
                                className="w-10 h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                           text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* User Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                            <div className="glass-card p-3 md:p-4 bg-deep-dark-200/40">
                                <p className="text-xs md:text-sm text-gray-400 mb-1">Прогресс</p>
                                <p className="text-xl md:text-2xl font-bold text-white">{selectedUser.completed_days}/7</p>
                            </div>
                            <div className="glass-card p-3 md:p-4 bg-deep-dark-200/40">
                                <p className="text-xs md:text-sm text-gray-400 mb-1">Отчётов</p>
                                <p className="text-xl md:text-2xl font-bold text-white">{selectedUserReports.length}</p>
                            </div>
                            <div className="glass-card p-3 md:p-4 bg-deep-dark-200/40">
                                <p className="text-xs md:text-sm text-gray-400 mb-1">Сообщений</p>
                                <p className="text-xl md:text-2xl font-bold text-white">{selectedUserMessages.length}</p>
                            </div>
                            <div className="glass-card p-3 md:p-4 bg-deep-dark-200/40">
                                <p className="text-xs md:text-sm text-gray-400 mb-1">Регистрация</p>
                                <p className="text-base md:text-lg font-bold text-white">
                                    {new Date(selectedUser.created_at).toLocaleDateString('ru-RU')}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 md:gap-3 mb-4 md:mb-6">
                            <button
                                onClick={() => setShowMessageModal(true)}
                                className="glass-button flex items-center gap-2 text-sm px-4 py-2.5"
                            >
                                <Send className="w-4 h-4" />
                                Написать
                            </button>
                            {selectedUser.is_blocked ? (
                                <button
                                    onClick={handleUnblockUser}
                                    className="glass-button-secondary flex items-center gap-2 text-green-400 text-sm px-4 py-2.5"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Разблокировать
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowBlockModal(true)}
                                    className="glass-button-secondary flex items-center gap-2 text-red-400 text-sm px-4 py-2.5"
                                >
                                    <Ban className="w-4 h-4" />
                                    Заблокировать
                                </button>
                            )}
                        </div>

                        {/* Tasks Progress Section */}
                        <div className="mb-6">
                            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Прогресс заданий ({courseData.length} дней)</h3>
                            <div className="glass-card p-3 md:p-5 bg-deep-dark-200/40">
                                <div className="grid grid-cols-1 gap-3 md:gap-4">
                                    {courseData.map(day => {
                                        // Filter completed tasks for this day from the flat list
                                        const completedTasks = userProgressDetails.filter(p => p.day_number === day.dayNumber && p.completed === true)
                                        const completedTaskIds = completedTasks.map(p => p.task_id)
                                        const totalTasks = day.tasks.length
                                        const completedCount = completedTaskIds.length
                                        const percent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

                                        return (
                                            <div key={day.dayNumber} className="flex items-center gap-2 md:gap-4">
                                                <div className="w-12 md:w-16 flex-shrink-0">
                                                    <span className="text-xs md:text-sm text-gray-400">День {day.dayNumber}</span>
                                                </div>

                                                <div className="flex-1 flex gap-1 md:gap-1.5 h-6 md:h-8 items-center bg-deep-dark/30 rounded-lg px-1.5 md:px-2">
                                                    {day.tasks.map(task => {
                                                        const isCompleted = completedTaskIds.includes(task.id)
                                                        // Find completion timestamp if available
                                                        const detail = completedTasks.find(p => p.task_id === task.id)
                                                        const dateStr = detail?.completed_at
                                                            ? new Date(detail.completed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                            : ''

                                                        return (
                                                            <div
                                                                key={task.id}
                                                                title={`${task.text}${dateStr ? ` (Выполнено: ${dateStr})` : ''}`}
                                                                className={`h-4 flex-1 rounded transition-colors relative group ${isCompleted
                                                                    ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                                                                    : 'bg-white/5 border border-white/5'
                                                                    }`}
                                                            >
                                                                {/* Tooltip */}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] 
                                                                            bg-gray-800 text-xs text-white p-2 rounded opacity-0 group-hover:opacity-100 
                                                                            pointer-events-none transition-opacity z-10 border border-white/10 shadow-xl">
                                                                    <div className="font-semibold mb-0.5">{task.text}</div>
                                                                    {dateStr && <div className="text-gray-400 text-[10px]">{dateStr}</div>}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="w-12 text-right flex-shrink-0">
                                                    <span className={`text-sm font-bold ${percent === 100 ? 'text-green-400' :
                                                        percent > 50 ? 'text-blue-400' : 'text-gray-500'
                                                        }`}>
                                                        {percent}%
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Reports Section */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Отчёты по дням</h3>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
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
                                            className={`glass-card p-4 text-center cursor-pointer transition-all ${report
                                                ? report.status === 'approved'
                                                    ? 'border-green-500/30 bg-green-500/10'
                                                    : report.status === 'rejected'
                                                        ? 'border-red-500/30 bg-red-500/10'
                                                        : 'border-yellow-500/30 bg-yellow-500/10'
                                                : 'bg-deep-dark-200/40'
                                                }`}
                                        >
                                            <p className="text-xs text-gray-400 mb-1">День</p>
                                            <p className="text-lg font-bold text-white">{day}</p>
                                            {report && (
                                                <div className="mt-2">
                                                    {report.status === 'approved' && <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />}
                                                    {report.status === 'rejected' && <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                                                    {report.status === 'pending' && <Clock className="w-4 h-4 text-yellow-400 mx-auto" />}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Messages History */}
                        {selectedUserMessages.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">История сообщений</h3>
                                <div className="space-y-3 max-h-48 overflow-y-auto">
                                    {selectedUserMessages.map(msg => (
                                        <div key={msg.id} className="glass-card p-4 bg-deep-dark-200/40">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    {msg.message_type === 'warning' && (
                                                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                                    )}
                                                    <span className="text-sm text-gray-400">
                                                        {new Date(msg.created_at).toLocaleDateString('ru-RU')}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-white mt-2">{msg.message}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Send Message Modal */}
            {showMessageModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
                    <div
                        className="glass-card p-5 md:p-6 w-full max-w-lg animate-fade-in mx-3 md:mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold text-white mb-4">
                            Сообщение для {selectedUser.full_name || selectedUser.email}
                        </h2>

                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setMessageType('message')}
                                className={`flex-1 py-2 rounded-xl transition-all ${messageType === 'message'
                                    ? 'bg-meta-orange text-white'
                                    : 'bg-deep-dark-200/60 text-gray-400'
                                    }`}
                            >
                                Обычное
                            </button>
                            <button
                                onClick={() => setMessageType('warning')}
                                className={`flex-1 py-2 rounded-xl transition-all ${messageType === 'warning'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-deep-dark-200/60 text-gray-400'
                                    }`}
                            >
                                Предупреждение
                            </button>
                        </div>

                        <textarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Введите сообщение..."
                            className="glass-input w-full h-32 resize-none mb-4"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMessageModal(false)}
                                className="glass-button-secondary flex-1"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSendMessage}
                                disabled={!messageText.trim()}
                                className="glass-button flex-1 flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                Отправить
                            </button>
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
                                <div className="grid grid-cols-2 gap-4">
                                    {selectedReport.files.map((file, idx) => (
                                        <div key={idx} className="aspect-video rounded-xl overflow-hidden bg-deep-dark-200">
                                            {file.url ? (
                                                <img
                                                    src={file.url}
                                                    alt={file.name}
                                                    className="w-full h-full object-cover"
                                                />
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
