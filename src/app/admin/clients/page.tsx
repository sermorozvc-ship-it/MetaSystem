'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, Loader2, ChevronRight, Calendar, CheckCircle2, Archive, ArchiveRestore, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, getAllUsers, archiveUser, unarchiveUser, deleteUser, type UserWithProgress } from '@/lib/services/admin'

type Tab = 'active' | 'archived'

export default function AdminClientsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [clients, setClients] = useState<UserWithProgress[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isAdminUser, setIsAdminUser] = useState(false)
    const [tab, setTab] = useState<Tab>('active')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

    useEffect(() => {
        if (authLoading) return
        if (!user) { router.replace('/auth'); return }

        let cancelled = false

        const load = async () => {
            const admin = await isAdmin(user)
            if (cancelled) return
            if (!admin) { router.replace('/dashboard'); return }

            setIsAdminUser(true)

            try {
                const data = await getAllUsers()
                if (cancelled) return
                const clientsOnly = data.filter(u => u.role !== 'admin' && u.role !== 'trainer')
                setClients(clientsOnly)
            } catch (e) {
                console.error(e)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [user, authLoading, router])

    const activeClients = clients.filter(c => !c.is_archived)
    const archivedClients = clients.filter(c => c.is_archived)

    const displayed = (tab === 'active' ? activeClients : archivedClients).filter(c => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    })

    const handleArchive = async (e: React.MouseEvent, clientId: string) => {
        e.stopPropagation()
        if (!confirm('Переместить клиента в архив?')) return
        setActionLoading(clientId)
        const { success, error } = await archiveUser(clientId)
        if (success) {
            setClients(prev => prev.map(c => c.id === clientId ? { ...c, is_archived: true } : c))
        } else {
            alert('Ошибка: ' + error)
        }
        setActionLoading(null)
    }

    const handleUnarchive = async (e: React.MouseEvent, clientId: string) => {
        e.stopPropagation()
        setActionLoading(clientId)
        const { success, error } = await unarchiveUser(clientId)
        if (success) {
            setClients(prev => prev.map(c => c.id === clientId ? { ...c, is_archived: false } : c))
        } else {
            alert('Ошибка: ' + error)
        }
        setActionLoading(null)
    }

    const handleDelete = async (e: React.MouseEvent, clientId: string, name: string) => {
        e.stopPropagation()
        if (confirmDelete !== clientId) {
            setConfirmDelete(clientId)
            return
        }
        setActionLoading(clientId)
        setConfirmDelete(null)
        const { success, error } = await deleteUser(clientId)
        if (success) {
            setClients(prev => prev.filter(c => c.id !== clientId))
        } else {
            alert('Ошибка удаления: ' + error)
        }
        setActionLoading(null)
    }

    const getSubscriptionBadge = (status?: string) => {
        switch (status) {
            case 'active': return { label: 'Активна', color: 'text-success', bgColor: 'bg-success/20' }
            case 'paused': return { label: 'Приостановлена', color: 'text-warning', bgColor: 'bg-warning/20' }
            case 'expired': return { label: 'Истекла', color: 'text-danger', bgColor: 'bg-danger/20' }
            default: return { label: 'Неактивна', color: 'text-text-muted', bgColor: 'bg-bg-elevated' }
        }
    }

    if (authLoading || isLoading || !isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-8">
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">Клиенты</h1>
                        <p className="text-sm text-text-secondary">Управление клиентами и программами</p>
                    </div>
                    <button
                        onClick={() => router.push('/admin/clients/new')}
                        className="glass-button flex items-center gap-2 flex-shrink-0 text-sm"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Добавить клиента</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setTab('active')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            tab === 'active' ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        Активные
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'active' ? 'bg-bg-main/20' : 'bg-bg-elevated'}`}>
                            {activeClients.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setTab('archived')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            tab === 'archived' ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                        }`}
                    >
                        <Archive className="w-4 h-4" />
                        Архив
                        {archivedClients.length > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'archived' ? 'bg-bg-main/20' : 'bg-bg-elevated'}`}>
                                {archivedClients.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Search */}
                <div className="glass-card p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Поиск по имени или email..."
                            className="glass-input glass-input-icon w-full"
                        />
                    </div>
                </div>

                {/* Archive hint */}
                {tab === 'archived' && archivedClients.length > 0 && (
                    <div className="mb-4 p-4 rounded-xl bg-danger/5 border border-danger/20 text-sm text-text-secondary">
                        ⚠️ Удаление из архива необратимо — все данные клиента будут удалены навсегда.
                    </div>
                )}

                {/* List */}
                {displayed.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        {tab === 'archived'
                            ? <Archive className="w-16 h-16 text-text-muted mx-auto mb-4" />
                            : <Users className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        }
                        <h3 className="text-xl font-display font-bold text-white mb-2">
                            {searchQuery
                                ? 'Клиенты не найдены'
                                : tab === 'archived' ? 'Архив пуст' : 'Клиентов пока нет'
                            }
                        </h3>
                        <p className="text-text-secondary">
                            {searchQuery ? 'Попробуйте изменить запрос' : tab === 'archived' ? 'Архивированные клиенты появятся здесь' : 'Клиенты появятся после регистрации'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayed.map(client => {
                            const subscription = getSubscriptionBadge(client.subscription_status)
                            const isProcessing = actionLoading === client.id
                            const isConfirmingDelete = confirmDelete === client.id

                            return (
                                <div
                                    key={client.id}
                                    onClick={() => router.push(`/admin/clients/${client.id}`)}
                                    className={`glass-card p-6 cursor-pointer hover:border-accent transition-all ${client.is_archived ? 'opacity-70' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <h3 className="text-xl font-display font-bold text-white">
                                                    {client.full_name || 'Без имени'}
                                                </h3>
                                                <div className={`px-3 py-1 rounded-full ${subscription.bgColor} flex items-center gap-1.5`}>
                                                    <span className={`text-xs font-semibold ${subscription.color}`}>{subscription.label}</span>
                                                </div>
                                                {client.is_archived && (
                                                    <div className="px-3 py-1 rounded-full bg-text-muted/20 flex items-center gap-1.5">
                                                        <Archive className="w-3 h-3 text-text-muted" />
                                                        <span className="text-xs font-semibold text-text-muted">Архив</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm text-text-secondary mb-3">{client.email}</p>
                                            <div className="flex items-center gap-6 text-sm flex-wrap">
                                                {client.subscription_end_date && (
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-text-muted" />
                                                        <span className="text-text-secondary">До {new Date(client.subscription_end_date).toLocaleDateString('ru-RU')}</span>
                                                    </div>
                                                )}
                                                {client.has_nutrition_plan && (
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="w-4 h-4 text-success" />
                                                        <span className="text-success">План питания</span>
                                                    </div>
                                                )}
                                                {client.plan_type && (
                                                    <div className="text-text-muted">
                                                        Тариф: {client.plan_type === '1_month' ? '1 месяц' : client.plan_type === '3_months' ? '3 месяца' : '6 месяцев'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                            {tab === 'active' ? (
                                                <button
                                                    onClick={e => handleArchive(e, client.id)}
                                                    disabled={isProcessing}
                                                    title="В архив"
                                                    className="glass-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 text-text-muted hover:text-warning hover:border-warning/40 transition-colors"
                                                >
                                                    {isProcessing
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Archive className="w-3.5 h-3.5" />
                                                    }
                                                    В архив
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={e => handleUnarchive(e, client.id)}
                                                        disabled={isProcessing}
                                                        title="Восстановить"
                                                        className="glass-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 text-text-muted hover:text-success hover:border-success/40 transition-colors"
                                                    >
                                                        {isProcessing
                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            : <ArchiveRestore className="w-3.5 h-3.5" />
                                                        }
                                                        Восстановить
                                                    </button>
                                                    <button
                                                        onClick={e => handleDelete(e, client.id, client.full_name || 'клиента')}
                                                        disabled={isProcessing}
                                                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all ${
                                                            isConfirmingDelete
                                                                ? 'bg-danger text-white border-danger animate-pulse'
                                                                : 'glass-button-secondary text-danger border-danger/30 hover:border-danger/60'
                                                        }`}
                                                    >
                                                        {isProcessing
                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            : <Trash2 className="w-3.5 h-3.5" />
                                                        }
                                                        {isConfirmingDelete ? 'Подтвердить удаление' : 'Удалить навсегда'}
                                                    </button>
                                                </>
                                            )}
                                            <ChevronRight className="w-5 h-5 text-text-muted ml-1" />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
