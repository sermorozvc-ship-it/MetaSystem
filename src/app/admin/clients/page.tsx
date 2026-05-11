'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, Loader2, ChevronRight, Calendar, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, getAllUsers, type UserWithProgress } from '@/lib/services/admin'

export default function AdminClientsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [clients, setClients] = useState<UserWithProgress[]>([])
    const [filteredClients, setFilteredClients] = useState<UserWithProgress[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isAdminUser, setIsAdminUser] = useState(false)

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (!user) return

        const checkAdmin = async () => {
            const admin = await isAdmin(user)
            if (!admin) {
                router.replace('/dashboard')
                return
            }
            setIsAdminUser(true)
        }

        checkAdmin()
    }, [user, router])

    useEffect(() => {
        if (!isAdminUser) return

        const loadClients = async () => {
            try {
                const data = await getAllUsers()
                const clientsOnly = data.filter((u) => u.role === 'client')
                setClients(clientsOnly)
                setFilteredClients(clientsOnly)
            } catch (e) {
                console.error('Error loading clients:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadClients()
    }, [isAdminUser])

    useEffect(() => {
        if (!searchQuery) {
            setFilteredClients(clients)
            return
        }

        const query = searchQuery.toLowerCase()
        const filtered = clients.filter(
            (client) =>
                client.full_name?.toLowerCase().includes(query) || client.email?.toLowerCase().includes(query)
        )
        setFilteredClients(filtered)
    }, [searchQuery, clients])

    const getSubscriptionBadge = (status?: string) => {
        switch (status) {
            case 'active':
                return { label: 'Активна', color: 'text-success', bgColor: 'bg-success/20' }
            case 'paused':
                return { label: 'Приостановлена', color: 'text-warning', bgColor: 'bg-warning/20' }
            case 'expired':
                return { label: 'Истекла', color: 'text-danger', bgColor: 'bg-danger/20' }
            default:
                return { label: 'Неактивна', color: 'text-text-muted', bgColor: 'bg-bg-elevated' }
        }
    }

    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (isLoading || !isAdminUser) {
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
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white mb-2">Клиенты</h1>
                        <p className="text-text-secondary">Управление клиентами и программами</p>
                    </div>
                    <div className="glass-card px-4 py-2">
                        <div className="text-2xl font-display font-bold text-accent">{clients.length}</div>
                        <div className="text-xs text-text-muted">Всего клиентов</div>
                    </div>
                </div>

                {/* Search */}
                <div className="glass-card p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по имени или email..."
                            className="glass-input w-full pl-12"
                        />
                    </div>
                </div>

                {/* Clients List */}
                {filteredClients.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Users className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-display font-bold text-white mb-2">
                            {searchQuery ? 'Клиенты не найдены' : 'Клиентов пока нет'}
                        </h3>
                        <p className="text-text-secondary">
                            {searchQuery ? 'Попробуйте изменить запрос' : 'Клиенты появятся после регистрации'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredClients.map((client) => {
                            const subscription = getSubscriptionBadge(client.subscription_status)

                            return (
                                <div
                                    key={client.id}
                                    onClick={() => router.push(`/admin/clients/${client.id}`)}
                                    className="glass-card p-6 cursor-pointer hover:border-accent transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xl font-display font-bold text-white">
                                                    {client.full_name || 'Без имени'}
                                                </h3>
                                                <div
                                                    className={`px-3 py-1 rounded-full ${subscription.bgColor} flex items-center gap-1.5`}
                                                >
                                                    <span className={`text-xs font-semibold ${subscription.color}`}>
                                                        {subscription.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-sm text-text-secondary mb-3">{client.email}</p>

                                            <div className="flex items-center gap-6 text-sm">
                                                {client.subscription_end_date && (
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-text-muted" />
                                                        <span className="text-text-secondary">
                                                            До{' '}
                                                            {new Date(client.subscription_end_date).toLocaleDateString(
                                                                'ru-RU'
                                                            )}
                                                        </span>
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
                                                        Тариф:{' '}
                                                        {client.plan_type === '1_month'
                                                            ? '1 месяц'
                                                            : client.plan_type === '3_months'
                                                            ? '3 месяца'
                                                            : '6 месяцев'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0 ml-4" />
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
