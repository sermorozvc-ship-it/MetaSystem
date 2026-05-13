'use client'

import { useState, useEffect } from 'react'
import {
    Flame, CreditCard, Check, Clock, ArrowRight, Loader2,
    CheckCircle2, ExternalLink, RefreshCw, Gift, Zap
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getUserPayment, createPaymentRequest, createTestPayment, type Payment } from '@/lib/services/payment'

const YOOMONEY_WALLET = process.env.NEXT_PUBLIC_YOOMONEY_WALLET || '410014990008683'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meta-system-ja1o.vercel.app'

type PlanType = '1_month' | '3_months' | '6_months'

const PLANS = {
    '1_month': { price: 5, months: 1, label: '1 месяц' },
    '3_months': { price: 6, months: 3, label: '3 месяца' },
    '6_months': { price: 7, months: 6, label: '6 месяцев' },
}

const NUTRITION_PRICE = 2

function buildYooMoneyUrl(userId: string, amount: number) {
    const params = new URLSearchParams({
        receiver: YOOMONEY_WALLET,
        'quickpay-form': 'button',
        paymentType: 'AC',
        sum: amount.toString(),
        label: userId,
        successURL: `${APP_URL}/onboarding`,
        targets: 'MetaSystem — Онлайн-ведение',
        'short-dest': 'Платформа MetaSystem',
        comment: 'Оплата тарифа MetaSystem',
    })
    return `https://yoomoney.ru/quickpay/confirm?${params.toString()}`
}

export default function PaymentPage() {
    const { user, isLoading: authLoading } = useAuth()
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const planFromUrl = searchParams.get('plan') as PlanType | null
    // Fallback: читаем из sessionStorage если план не передан в URL
    const planFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('selected_plan') as PlanType | null : null

    const [selectedPlan, setSelectedPlan] = useState<PlanType>(planFromUrl || planFromStorage || '3_months')
    const [includeNutrition, setIncludeNutrition] = useState(false)
    const [payment, setPayment] = useState<Payment | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [isPolling, setIsPolling] = useState(false)

    // Флаг — пользователь только что зарегистрировался и вернулся сюда
    const isJustRegistered = searchParams.get('registered') === 'true'
    const [showWelcomeBanner, setShowWelcomeBanner] = useState(isJustRegistered)

    // Расчет итоговой суммы
    const baseAmount = PLANS[selectedPlan].price
    const nutritionAmount = selectedPlan === '6_months' ? 0 : (includeNutrition ? NUTRITION_PRICE : 0)
    const totalAmount = baseAmount + nutritionAmount
    const hasNutritionIncluded = selectedPlan === '6_months' || includeNutrition

    // Неавторизованные могут видеть страницу оплаты — регистрация происходит после оплаты через /onboarding
    // Редиректим только админов
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
        if (!authLoading && user) {
            const ADMIN_EMAILS = ['dgmukhin@gmail.com']
            const isAdminUser = ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')
                || user.user_metadata?.role === 'admin'
                || user.user_metadata?.role === 'curator'
            if (isAdminUser) {
                window.location.href = '/admin'
            }
        }
    }, [user, authLoading])

    // Загрузка статуса оплаты
    useEffect(() => {
        if (!user) {
            // Неавторизованный — просто показываем страницу без загрузки
            setIsLoading(false)
            return
        }

        const loadPayment = async () => {
            try {
                const existing = await getUserPayment()
                console.log('[Payment] Loaded payment:', existing)
                
                if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') {
                    setPayment(existing?.status === 'pending' && existing.amount <= 10 ? existing : null)
                    setIsLoading(false)
                    return
                }

                if (existing?.status === 'confirmed') {
                    window.location.href = '/onboarding'
                    return
                }
                
                if (existing?.status === 'pending' && existing.amount <= 10) {
                    setPayment(existing)
                } else {
                    setPayment(null)
                }
            } catch (e) {
                console.error('[Payment] Load error:', e)
            } finally {
                setIsLoading(false)
            }
        }
        loadPayment()
    }, [user])

    // Polling для автоподтверждения
    useEffect(() => {
        if (!user || isLoading || payment?.status !== 'pending') return

        setIsPolling(true)

        const interval = setInterval(async () => {
            try {
                const current = await getUserPayment()
                if (current?.status === 'confirmed') {
                    clearInterval(interval)
                    setIsPolling(false)
                    window.location.href = '/onboarding'
                }
            } catch (e) {
                console.error('[Payment] Polling error:', e)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [user, isLoading, payment?.status])

    // Создать платеж и открыть ЮMoney
    const handlePayment = async () => {
        // Если не авторизован — сначала регистрация, потом вернёмся сюда
        if (!user) {
            const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
            window.location.href = `/auth?returnTo=${returnTo}`
            return
        }
        setError('')
        setIsSubmitting(true)

        const yooWindow = window.open('about:blank', '_blank')

        try {
            if (!payment || payment.status !== 'pending') {
                const { payment: newPayment, error: paymentError } = await createPaymentRequest(
                    selectedPlan,
                    hasNutritionIncluded
                )

                if (paymentError) {
                    yooWindow?.close()
                    // Сессия протухла — отправляем на авторизацию
                    if (paymentError === 'Пользователь не авторизован') {
                        const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
                        window.location.href = `/auth?returnTo=${returnTo}`
                        return
                    }
                    setError(paymentError)
                    return
                }
                setPayment(newPayment)
            }

            const yooUrl = buildYooMoneyUrl(user.id, totalAmount)
            if (yooWindow && !yooWindow.closed) {
                yooWindow.location.href = yooUrl
            } else {
                window.location.href = yooUrl
            }

            setIsPolling(true)
        } catch (e) {
            setError('Произошла ошибка. Попробуйте позже.')
            yooWindow?.close()
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCheckStatus = async () => {
        setIsLoading(true)
        try {
            const current = await getUserPayment()
            if (current?.status === 'confirmed') {
                window.location.href = '/onboarding'
                return
            }
            setPayment(current)
        } catch (e) {
            console.error('[Payment] Check error:', e)
        } finally {
            setIsLoading(false)
        }
    }

    // Тестовая оплата (только для разработки)
    const handleTestPayment = async () => {
        if (!user) {
            alert('Пользователь не авторизован')
            return
        }
        setError('')
        setIsSubmitting(true)

        try {
            const { payment: testPayment, error: testError } = await createTestPayment(
                selectedPlan,
                hasNutritionIncluded
            )

            if (testError) {
                setError(testError)
                alert('Ошибка: ' + testError)
                return
            }

            // Успешно создан тестовый платеж
            console.log('[Payment] Test payment created:', testPayment)
            window.location.href = '/onboarding'
        } catch (e) {
            console.error('[Payment] Test payment error:', e)
            const msg = e instanceof Error ? e.message : 'Неизвестная ошибка'
            setError('Ошибка создания тестового платежа: ' + msg)
            alert('Ошибка: ' + msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Пока проверяем авторизацию — показываем спиннер
    if (authLoading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    // Статус ожидания оплаты
    if (payment?.status === 'pending') {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5 pointer-events-none" />

                <div className="relative max-w-md w-full text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-accent mb-8 shadow-glow-accent">
                        <Clock className="w-10 h-10 text-bg-main" />
                    </div>

                    <h1 className="text-3xl font-display font-bold text-white mb-4">
                        Ожидаем подтверждение
                    </h1>

                    <div className="glass-card p-8 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-8 h-8 text-accent" />
                        </div>

                        <p className="text-text-secondary mb-4">
                            {isPolling ? (
                                <>
                                    Оплата обрабатывается... Страница обновится
                                    <span className="text-white font-semibold"> автоматически</span>.
                                </>
                            ) : (
                                <>
                                    Если вы уже оплатили, подтверждение придёт
                                    <span className="text-white font-semibold"> автоматически</span>.
                                </>
                            )}
                        </p>

                        <div className="mt-6 p-4 rounded-xl bg-bg-elevated border border-border">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">Сумма</span>
                                <span className="text-white font-medium">{payment.amount} ₽</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-2">
                                <span className="text-text-secondary">Статус</span>
                                <span className="text-accent font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                    {isPolling ? 'Проверяем...' : 'Ожидание'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                if (user) {
                                    const yooUrl = buildYooMoneyUrl(user.id, payment.amount)
                                    window.open(yooUrl, '_blank')
                                    setIsPolling(true)
                                }
                            }}
                            className="glass-button w-full flex items-center justify-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Открыть форму оплаты
                        </button>

                        <button
                            onClick={handleCheckStatus}
                            className="glass-button-secondary w-full flex items-center justify-center gap-2 text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
                            Проверить статус
                        </button>

                        {/* Кнопка сброса платежа (только для разработки) */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-white/10">
                                <p className="text-xs text-text-muted text-center">DEV инструменты</p>
                                <button
                                    onClick={async () => {
                                        if (!user) return
                                        try {
                                            const { createClient } = await import('@/lib/supabase/client')
                                            const supabase = createClient()
                                            await supabase
                                                .from('payments')
                                                .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
                                                .eq('user_id', user.id)
                                                .eq('status', 'pending')
                                            window.location.href = '/onboarding'
                                        } catch (e) {
                                            alert('Ошибка: ' + e)
                                        }
                                    }}
                                    className="glass-button-secondary w-full flex items-center justify-center gap-2 text-sm text-green-400"
                                >
                                    ✅ Подтвердить оплату вручную (DEV)
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!user) return
                                        try {
                                            const { createClient } = await import('@/lib/supabase/client')
                                            const supabase = createClient()
                                            await supabase.from('payments').delete().eq('user_id', user.id)
                                            setPayment(null)
                                            setIsPolling(false)
                                            window.location.reload()
                                        } catch (e) {
                                            alert('Ошибка: ' + e)
                                        }
                                    }}
                                    className="glass-button-secondary w-full flex items-center justify-center gap-2 text-sm text-red-400"
                                >
                                    🗑️ Удалить все платежи (DEV)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-4 py-12">
            <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 pointer-events-none" />

            <div className="relative max-w-5xl w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4 shadow-glow-accent">
                        <Flame className="w-9 h-9 text-bg-main" />
                    </div>
                    <h1 className="text-4xl font-display font-bold text-white mb-2">Выберите тариф</h1>
                    <p className="text-text-secondary">Индивидуальное онлайн-ведение с персональным тренером</p>
                </div>

                {/* Баннер после регистрации */}
                {showWelcomeBanner && (
                    <div className="mb-8 rounded-2xl border border-accent/40 bg-accent/10 p-5 flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-bg-main" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold mb-1">Аккаунт создан — вы вернулись на страницу оплаты</p>
                            <p className="text-text-secondary text-sm">
                                Всё в порядке. Выберите тариф и нажмите «Оплатить» — вас перенаправит на ЮMoney.
                                После оплаты вы сразу попадёте в личный кабинет.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowWelcomeBanner(false)}
                            className="flex-shrink-0 text-text-muted hover:text-white transition-colors text-lg leading-none"
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Тарифные карточки */}
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                    {(Object.keys(PLANS) as PlanType[]).map((planKey) => {
                        const plan = PLANS[planKey]
                        const isSelected = selectedPlan === planKey
                        const isPopular = planKey === '3_months'
                        const isBest = planKey === '6_months'

                        return (
                            <div
                                key={planKey}
                                onClick={() => setSelectedPlan(planKey)}
                                className={`glass-card p-6 cursor-pointer transition-all duration-300 relative ${
                                    isSelected ? 'border-accent shadow-glow-accent' : 'hover:border-border-accent'
                                }`}
                            >
                                {isPopular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-bg-main text-xs font-display font-semibold rounded-full">
                                        <Zap className="w-3 h-3 inline mr-1" />
                                        Популярный
                                    </div>
                                )}
                                {isBest && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-bg-main text-xs font-display font-semibold rounded-full">
                                        <Gift className="w-3 h-3 inline mr-1" />
                                        Лучшее предложение
                                    </div>
                                )}

                                <div className="text-center mb-6 mt-2">
                                    <h3 className="text-xl font-display font-bold text-white mb-2">{plan.label}</h3>
                                    <div className="text-4xl font-display font-bold text-accent mb-1">
                                        {plan.price.toLocaleString('ru-RU')} ₽
                                    </div>
                                    <p className="text-sm text-text-muted">
                                        {Math.round(plan.price / plan.months).toLocaleString('ru-RU')} ₽/мес
                                    </p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-text-secondary">
                                            Индивидуальные программы тренировок
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-text-secondary">
                                            Отслеживание прогресса и метрик
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-text-secondary">
                                            Чат с тренером 24/7
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-text-secondary">
                                            Корректировка программ по ходу
                                        </span>
                                    </div>
                                    {isBest && (
                                        <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30">
                                            <Gift className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                                            <span className="text-sm text-gold font-semibold">
                                                План питания в подарок!
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isSelected && (
                                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                                        <Check className="w-4 h-4 text-bg-main" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Опция питания (только для 1 и 3 месяцев) */}
                {selectedPlan !== '6_months' && (
                    <div className="glass-card p-6 mb-8">
                        <label className="flex items-start gap-4 cursor-pointer">
                            <div
                                onClick={() => setIncludeNutrition(!includeNutrition)}
                                className={`custom-checkbox ${includeNutrition ? 'checked' : ''}`}
                            >
                                {includeNutrition && <Check className="w-3 h-3 text-bg-main" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-white font-semibold">Добавить план питания</span>
                                    <span className="text-accent font-bold">+{NUTRITION_PRICE} ₽</span>
                                </div>
                                <p className="text-sm text-text-secondary">
                                    Индивидуальный план питания с расчетом калорий и макронутриентов
                                </p>
                            </div>
                        </label>
                    </div>
                )}

                {/* Итоговая сумма */}
                <div className="glass-card p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-text-secondary">Тариф</span>
                        <span className="text-white font-medium">{PLANS[selectedPlan].label}</span>
                    </div>
                    {hasNutritionIncluded && (
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-text-secondary">План питания</span>
                            <span className="text-accent font-medium">
                                {selectedPlan === '6_months' ? '🎁 В подарок' : `+${NUTRITION_PRICE} ₽`}
                            </span>
                        </div>
                    )}
                    <div className="border-t border-border pt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-display font-bold text-white">Итого</span>
                            <span className="text-3xl font-display font-bold text-accent">
                                {totalAmount.toLocaleString('ru-RU')} ₽
                            </span>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 mb-4 rounded-xl bg-danger/10 border border-danger/30">
                        <p className="text-sm text-danger">{error}</p>
                    </div>
                )}

                {/* Кнопка оплаты */}
                <button
                    onClick={handlePayment}
                    disabled={isSubmitting}
                    className="glass-button w-full flex items-center justify-center gap-2 py-4 text-lg"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Подготовка...
                        </>
                    ) : (
                        <>
                            <CreditCard className="w-5 h-5" />
                            Оплатить {totalAmount.toLocaleString('ru-RU')} ₽
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                {/* Кнопка тестовой оплаты (только для разработки) */}
                {process.env.NODE_ENV === 'development' && (
                    <>
                        <button
                            onClick={handleTestPayment}
                            disabled={isSubmitting}
                            className="glass-button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm mt-3"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Создание...
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4" />
                                    Пропустить оплату (тест)
                                </>
                            )}
                        </button>

                        <button
                            onClick={async () => {
                                if (!user) return
                                if (!confirm('Полный сброс: удалить платеж, анкету и программы?')) return
                                
                                try {
                                    const { createClient } = await import('@/lib/supabase/client')
                                    const supabase = createClient()
                                    
                                    // Удаляем все данные пользователя
                                    await Promise.all([
                                        supabase.from('payments').delete().eq('user_id', user.id),
                                        supabase.from('questionnaires').delete().eq('user_id', user.id),
                                        supabase.from('training_programs').delete().eq('client_id', user.id),
                                    ])
                                    
                                    alert('Данные удалены. Страница перезагрузится.')
                                    window.location.href = '/payment'
                                } catch (e) {
                                    console.error('Error resetting data:', e)
                                    alert('Ошибка сброса данных')
                                }
                            }}
                            className="glass-button-secondary w-full flex items-center justify-center gap-2 py-2 text-xs mt-2 text-red-400 hover:text-red-300"
                        >
                            🗑️ Полный сброс (DEV)
                        </button>
                    </>
                )}

                <p className="text-center text-xs text-text-muted mt-4">
                    Безопасная оплата через ЮMoney. После оплаты вы перейдете к заполнению анкеты.
                </p>
            </div>
        </div>
    )
}
