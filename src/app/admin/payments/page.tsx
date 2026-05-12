'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, CreditCard, CheckCircle2, Clock, RefreshCw,
    Loader2, ChevronRight, Search, XCircle
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, getAllPayments, confirmPayment, refundPayment, type AdminPayment } from '@/lib/services/admin'

const PLAN_LABELS: Record<string, string> = {
    '1_month': '1 месяц',
    '3_months': '3 месяца',
    '6_months': '6 месяцев',
}

const STATUS_CONFIG = {
    pending: { label: 'Ожидает', color: 'bg-warning/20 text-warning', icon: Clock },
    confirmed: { label: 'Оплачено', color: 'bg-success/20 text-success', icon: CheckCircle2 },
    refunded: { label: 'Возврат', color: 'bg-danger/20 text-danger', icon: XCircle },
}

export default function AdminPaymentsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [isAdminUser, setIsAdminUser] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [payments, setPayments] = useState<AdminPayment[]>([])
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'refunded'>('all')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => {
        if (!authLoading && !user) { window.location.href = '/auth'; return }
    }, [user, authLoading])

    useEffect(() => {
        if (!user) return
        isAdmin(user).then(admin => {
            if (!admin) { window.location.href = '/admin'; return }
            setIsAdminUser(true)
        })
    }, [user])

    useEffect(() => {
        if (!isAdminUser) return
        getAllPayments().then(data => {
            setPayments(data)
            setIsLoading(false)
        }).catch(() => setIsLoading(false))
    }, [isAdminUser])

    const handleConfirm = async (paymentId: string) => {
        setActionLoading(paymentId)
        const { success, error } = await confirmPayment(paymentId)
        if (success) {
            setPayments(prev => prev.map(p =>
                p.id === paymentId ? { ...p, status: 'confirmed', confirmed_at: new Date().toISOString() } : p
            ))
        } else {
            alert('Ошибка: ' + error)
        }
        setActionLoading(null)
    }

    const handleRefund = async (paymentId: string) => {
        if (!confirm('Оформить возврат?')) return
        setActionLoading(paymentId)
        const { success, error } = await refundPayment(paymentId)
        if (success) {
            setPayments(prev => prev.map(p =>
                p.id === paymentId ? { ...p, status: 'refunded' } : p
            ))
        } else {
            alert('Ошибка: ' + error)
        }
        setActionLoading(null)
    }

    const filtered = payments.filter(p => {
        const matchStatus = filterStatus === 'all' || p.status === filterStatus
        const q = search.toLowerCase()
        const matchSearch = !q
            || p.user?.full_name?.toLowerCase().includes(q)
            || p.user?.email?.toLowerCase().includes(q)
        return matchStatus && matchSearch
    })

    const totalConfirmed = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0)
    const totalPending = payments.filter(p => p.status === 'pending').length

    if (authLoading || isLoading || !isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => router.push('/admin')} className="glass-button-secondary flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />Назад
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white">Оплаты</h1>
                        <p className="text-text-secondary">Управление платежами клиентов</p>
                    </div>
                </div>

                {/* Статистика */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="glass-card p-5">
                        <p className="text-sm text-text-muted mb-1">Всего платежей</p>
                        <p className="text-2xl font-display font-bold text-white">{payments.length}</p>
                    </div>
                    <div className="glass-card p-5">
                        <p className="text-sm text-text-muted mb-1">Ожидают подтверждения</p>
                        <p className="text-2xl font-display font-bold text-warning">{totalPending}</p>
                    </div>
                    <div className="glass-card p-5">
                        <p className="text-sm text-text-muted mb-1">Сумма оплачено</p>
                        <p className="text-2xl font-display font-bold text-success">
                            {totalConfirmed.toLocaleString('ru-RU')} ₽
                        </p>
                    </div>
                </div>

                {/* Фильтры */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск по имени или email..."
                            className="glass-input w-full pl-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['all', 'pending', 'confirmed', 'refunded'] as const).map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                    filterStatus === s ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                                }`}>
                                {s === 'all' ? 'Все' : STATUS_CONFIG[s].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Список платежей */}
                {filtered.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <CreditCard className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <p className="text-text-secondary">Платежей не найдено</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(payment => {
                            const cfg = STATUS_CONFIG[payment.status]
                            const StatusIcon = cfg.icon
                            const isProcessing = actionLoading === payment.id

                            return (
                                <div key={payment.id} className="glass-card p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Клиент */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <button
                                                    onClick={() => router.push(`/admin/clients/${payment.user_id}`)}
                                                    className="font-semibold text-white hover:text-accent transition-colors flex items-center gap-1"
                                                >
                                                    {payment.user?.full_name || 'Без имени'}
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${cfg.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-text-muted">{payment.user?.email}</p>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-secondary">
                                                <span>💳 {payment.payment_method}</span>
                                                {payment.plan_type && <span>📅 {PLAN_LABELS[payment.plan_type]}</span>}
                                                {payment.includes_nutrition && <span>🥗 + питание</span>}
                                                <span>🕐 {new Date(payment.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                {payment.confirmed_at && (
                                                    <span className="text-success">✓ {new Date(payment.confirmed_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Сумма + действия */}
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <span className="text-xl font-display font-bold text-accent">
                                                {payment.amount.toLocaleString('ru-RU')} ₽
                                            </span>

                                            {payment.status === 'pending' && (
                                                <button
                                                    onClick={() => handleConfirm(payment.id)}
                                                    disabled={isProcessing}
                                                    className="glass-button flex items-center gap-1.5 text-xs px-3 py-2"
                                                >
                                                    {isProcessing
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <CheckCircle2 className="w-3.5 h-3.5" />
                                                    }
                                                    Подтвердить
                                                </button>
                                            )}

                                            {payment.status === 'confirmed' && (
                                                <button
                                                    onClick={() => handleRefund(payment.id)}
                                                    disabled={isProcessing}
                                                    className="glass-button-secondary flex items-center gap-1.5 text-xs px-3 py-2 text-danger hover:border-danger/40"
                                                >
                                                    {isProcessing
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <RefreshCw className="w-3.5 h-3.5" />
                                                    }
                                                    Возврат
                                                </button>
                                            )}
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
