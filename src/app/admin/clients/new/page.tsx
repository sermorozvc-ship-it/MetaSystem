'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, UserPlus, Loader2, CheckCircle2,
    Mail, Lock, User, CreditCard, Calendar, Clock
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, createClientManually } from '@/lib/services/admin'
import { tryRefreshSession } from '@/lib/supabase/client'

export default function NewClientPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [isAdminUser, setIsAdminUser] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState<{ userId: string; email: string } | null>(null)
    const [error, setError] = useState('')

    // Form fields
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [amount, setAmount] = useState('')
    const [planMonths, setPlanMonths] = useState('1')
    const [includesNutrition, setIncludesNutrition] = useState(false)
    const [subscriptionStart, setSubscriptionStart] = useState(() => new Date().toISOString().split('T')[0])
    const [subscriptionEnd, setSubscriptionEnd] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() + 1)
        return d.toISOString().split('T')[0]
    })

    // Auto-calculate end date when start or months change
    useEffect(() => {
        if (!subscriptionStart || !planMonths) return
        const d = new Date(subscriptionStart)
        d.setMonth(d.getMonth() + Number(planMonths))
        setSubscriptionEnd(d.toISOString().split('T')[0])
    }, [subscriptionStart, planMonths])

    useEffect(() => {
        if (!authLoading && !user) router.replace('/auth')
    }, [user, authLoading, router])

    useEffect(() => {
        if (!user) return
        tryRefreshSession().then(() =>
            isAdmin(user).then(admin => {
                if (!admin) router.replace('/dashboard')
                else setIsAdminUser(true)
            })
        )
    }, [user, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password.length < 6) {
            setError('Пароль должен быть минимум 6 символов')
            return
        }

        setIsSubmitting(true)
        const result = await createClientManually({
            email: email.trim().toLowerCase(),
            password,
            full_name: fullName.trim(),
            amount: Number(amount) || 0,
            plan_months: Number(planMonths),
            includes_nutrition: includesNutrition,
            subscription_start: subscriptionStart,
            subscription_end: subscriptionEnd,
        })

        if (result.success && result.userId) {
            setSuccess({ userId: result.userId, email: email.trim().toLowerCase() })
        } else {
            setError(result.error || 'Неизвестная ошибка')
        }
        setIsSubmitting(false)
    }

    if (authLoading || !isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-success/20 border border-success/30 mb-6">
                        <CheckCircle2 className="w-10 h-10 text-success" />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-white mb-2">Клиент добавлен</h1>
                    <p className="text-text-secondary mb-2">{success.email}</p>
                    <p className="text-sm text-text-muted mb-8">
                        Аккаунт создан и подтверждён. Клиент может войти сразу — письмо с подтверждением не нужно.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => router.push(`/admin/clients/${success.userId}`)}
                            className="glass-button w-full flex items-center justify-center gap-2"
                        >
                            Открыть профиль клиента →
                        </button>
                        <button
                            onClick={() => {
                                setSuccess(null)
                                setFullName(''); setEmail(''); setPassword('')
                                setAmount(''); setPlanMonths('1'); setIncludesNutrition(false)
                            }}
                            className="glass-button-secondary w-full"
                        >
                            Добавить ещё одного
                        </button>
                        <button
                            onClick={() => router.push('/admin/clients')}
                            className="glass-button-secondary w-full text-text-muted"
                        >
                            К списку клиентов
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/admin/clients')}
                        className="glass-button-secondary flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Назад
                    </button>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-white">Добавить клиента</h1>
                        <p className="text-text-secondary text-sm">Ручное добавление без оплаты через сервис</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Личные данные */}
                    <div className="glass-card p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-accent uppercase tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4" /> Данные клиента
                        </h2>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Имя и фамилия *</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Иван Иванов"
                                    className="glass-input glass-input-icon w-full"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Email *</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="client@example.com"
                                    className="glass-input glass-input-icon w-full"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">
                                Пароль * <span className="text-text-muted font-normal">(клиент сможет сменить в настройках)</span>
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Минимум 6 символов"
                                    className="glass-input glass-input-icon w-full"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <p className="text-xs text-text-muted mt-1.5">
                                Передайте пароль клиенту лично или через мессенджер. Аккаунт сразу активен — подтверждение email не нужно.
                            </p>
                        </div>
                    </div>

                    {/* Оплата и тариф */}
                    <div className="glass-card p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-accent uppercase tracking-wider flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> Оплата и тариф
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Сумма оплаты (₽)</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        className="glass-input glass-input-icon w-full"
                                    />
                                </div>
                                <p className="text-xs text-text-muted mt-1">0 — если не нужно фиксировать</p>
                            </div>

                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Длительность (месяцев)</label>
                                <div className="relative">
                                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                                    <select
                                        value={planMonths}
                                        onChange={e => setPlanMonths(e.target.value)}
                                        className="glass-input glass-input-icon w-full appearance-none"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 9, 12].map(m => (
                                            <option key={m} value={m}>{m} {m === 1 ? 'месяц' : m < 5 ? 'месяца' : 'месяцев'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" /> Начало подписки
                                </label>
                                <input
                                    type="date"
                                    value={subscriptionStart}
                                    onChange={e => setSubscriptionStart(e.target.value)}
                                    className="glass-input w-full"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" /> Конец подписки
                                </label>
                                <input
                                    type="date"
                                    value={subscriptionEnd}
                                    onChange={e => setSubscriptionEnd(e.target.value)}
                                    className="glass-input w-full"
                                    required
                                />
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-sm text-text-secondary">
                            Подписка: <span className="text-white font-semibold">
                                {subscriptionStart && subscriptionEnd
                                    ? `${new Date(subscriptionStart).toLocaleDateString('ru-RU')} — ${new Date(subscriptionEnd).toLocaleDateString('ru-RU')}`
                                    : '—'
                                }
                            </span>
                            {planMonths && <span className="text-text-muted ml-2">({planMonths} мес.)</span>}
                        </div>

                        {/* Питание */}
                        <div>
                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-transparent hover:border-border transition-colors">
                                <div className="relative mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={includesNutrition}
                                        onChange={e => setIncludesNutrition(e.target.checked)}
                                        className="w-4 h-4 accent-accent"
                                    />
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">Включить план питания</p>
                                    <p className="text-text-muted text-xs mt-0.5">
                                        Клиент попадёт в ветку с питанием — после анкеты тренировок ему будет предложена анкета по питанию
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="glass-button w-full flex items-center justify-center gap-2 py-4 text-base"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Создаём аккаунт...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Добавить клиента
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
