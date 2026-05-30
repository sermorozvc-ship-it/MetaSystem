'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Users, Shield, Loader2, TrendingUp, Calendar,
    CreditCard, CheckCircle2, Clock, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, getAllUsers, getAdminStats, type UserWithProgress } from '@/lib/services/admin'

export default function AdminDashboardPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [isAdminUser, setIsAdminUser] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [clients, setClients] = useState<UserWithProgress[]>([])
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        blockedUsers: 0,
        pendingReports: 0,
        completedToday: 0,
        pendingPayments: 0,
        confirmedPayments: 0,
    })

    useEffect(() => {
        if (authLoading) return
        if (!user) { router.replace('/auth'); return }

        let cancelled = false

        const load = async () => {
            try {
                // Проверяем admin и грузим данные за один проход
                const admin = await isAdmin(user)
                if (cancelled) return
                if (!admin) { router.replace('/dashboard'); return }

                setIsAdminUser(true)

                const [usersData, statsData] = await Promise.all([
                    getAllUsers(),
                    getAdminStats(),
                ])
                if (cancelled) return
                const clientsOnly = usersData.filter((u) => u.role !== 'admin' && u.role !== 'trainer')
                setClients(clientsOnly)
                setStats(statsData)
            } catch (e) {
                console.error('Error loading admin data:', e)
            } finally {
                // ВСЕГДА снимаем спиннер, даже если isAdmin/загрузка упали или
                // эффект был отменён до завершения — иначе вечный лоадер.
                if (!cancelled) setIsLoading(false)
            }
        }

        load()

        // Аварийный таймаут: если данные не успели загрузиться за 8с —
        // снимаем спиннер и показываем страницу с тем что есть, а не висим бесконечно.
        const failsafe = setTimeout(() => {
            if (!cancelled) {
                console.warn('[AdminPage] Failsafe timeout — forcing isLoading=false')
                setIsLoading(false)
            }
        }, 8000)

        return () => { cancelled = true; clearTimeout(failsafe) }
        // Зависим от user?.id (стабильная строка), а НЕ от объекта user:
        // onAuthStateChange (token refresh / focus) создаёт новый объект user
        // с тем же id, и зависимость от объекта перезапускала бы эффект,
        // отменяя текущую загрузку до finally → вечный спиннер при SPA-навигации.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading])

    // Спиннер показываем пока идёт первичная загрузка. НЕ гейтим по isAdminUser:
    // failsafe сбрасывает только isLoading, и при подвисшей проверке прав
    // гейт по !isAdminUser держал бы лоадер вечно. Не-админ редиректится выше.
    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    // Защита: если права не подтвердились (редирект уже инициирован) — не мигаем контентом
    if (!isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    const activeClients = clients.filter((c) => c.subscription_status === 'active')
    const recentClients = clients.slice(0, 5)

    return (
        <div className="min-h-screen bg-bg-main p-4 py-6 md:py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-bg-main" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Админ-панель</h1>
                            <p className="text-text-secondary text-sm">Управление платформой</p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                                <Users className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Всего клиентов</p>
                                <p className="text-2xl font-display font-bold text-white">{clients.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Активных</p>
                                <p className="text-2xl font-display font-bold text-white">{activeClients.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Ожидают оплаты</p>
                                <p className="text-2xl font-display font-bold text-white">{stats.pendingPayments}</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-info" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Оплачено</p>
                                <p className="text-2xl font-display font-bold text-white">{stats.confirmedPayments}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => router.push('/admin/clients')}
                        className="glass-card p-6 text-left hover:border-accent transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">Клиенты</h3>
                                    <p className="text-sm text-text-secondary">Управление клиентами и программами</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted" />
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/admin/payments')}
                        className="glass-card p-6 text-left hover:border-accent transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                                    <CreditCard className="w-6 h-6 text-success" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">Оплаты</h3>
                                    <p className="text-sm text-text-secondary">Управление платежами</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted" />
                        </div>
                    </button>
                </div>

                {/* Recent Clients */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-display font-bold text-white">Последние клиенты</h2>
                        <button
                            onClick={() => router.push('/admin/clients')}
                            className="text-sm text-accent hover:underline"
                        >
                            Все клиенты
                        </button>
                    </div>

                    {recentClients.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-16 h-16 text-text-muted mx-auto mb-4" />
                            <p className="text-text-secondary">Клиентов пока нет</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentClients.map((client) => (
                                <div
                                    key={client.id}
                                    onClick={() => router.push(`/admin/clients/${client.id}`)}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-bg-elevated hover:bg-bg-card cursor-pointer transition-all"
                                >
                                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold flex-shrink-0">
                                        {(client.full_name || client.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-white truncate">{client.full_name || 'Без имени'}</p>
                                        <p className="text-sm text-text-muted truncate">{client.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {client.subscription_status === 'active' && (
                                            <span className="px-2 py-1 rounded-full bg-success/20 text-success text-xs font-semibold whitespace-nowrap">
                                                Активна
                                            </span>
                                        )}
                                        <ChevronRight className="w-5 h-5 text-text-muted" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
