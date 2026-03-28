'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Flame, CreditCard, Copy, Check, Clock,
    ArrowRight, Loader2, AlertCircle, CheckCircle2,
    ExternalLink, RefreshCw
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getUserPayment, createPaymentRequest, type Payment } from '@/lib/services/payment'
import { getNextFutureMondayStart, isCohortActive } from '@/lib/utils/cohort'

const YOOMONEY_WALLET = process.env.NEXT_PUBLIC_YOOMONEY_WALLET || '410014990008683'
const PRICE = 10
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meta-system-ja1o.vercel.app'

function buildYooMoneyUrl(userId: string, amount: number) {
    const params = new URLSearchParams({
        receiver: YOOMONEY_WALLET,
        'quickpay-form': 'button',
        paymentType: 'AC', // AC = банковская карта, PC = кошелёк ЮMoney
        sum: amount.toString(),
        label: userId,
        successURL: `${APP_URL}/onboarding`,
        targets: 'MetaSystem — Метаболическая Перезагрузка',
        'short-dest': 'Курс MetaSystem',
        comment: 'Оплата курса «Метаболическая Перезагрузка»',
    })
    return `https://yoomoney.ru/quickpay/confirm?${params.toString()}`
}

export default function PaymentPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [payment, setPayment] = useState<Payment | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [isPolling, setIsPolling] = useState(false)

    // Редирект неавторизованных
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    // Загрузка статуса оплаты
    useEffect(() => {
        if (!user) return

        const loadPayment = async () => {
            try {
                const existing = await getUserPayment()
                if (existing?.status === 'confirmed') {
                    // Если когорта уже началась — сразу на dashboard
                    // Если ещё не началась — на onboarding (зал ожидания)
                    if (existing.cohort_start) {
                        const cohortStartDate = new Date(existing.cohort_start + 'T07:00:00')
                        if (isCohortActive(cohortStartDate)) {
                            router.replace('/dashboard')
                        } else {
                            router.replace('/onboarding')
                        }
                    } else {
                        router.replace('/onboarding')
                    }
                    return
                }
                setPayment(existing)
            } catch (e) {
                console.error('[Payment] Load error:', e)
            } finally {
                setIsLoading(false)
            }
        }
        loadPayment()
    }, [user, router])

    // Polling — запускается всегда когда статус pending (даже после перезагрузки страницы)
    useEffect(() => {
        if (!user) return
        if (isLoading) return // ждём пока загрузится начальный статус
        if (payment?.status !== 'pending') return // только если pending

        setIsPolling(true)

        const interval = setInterval(async () => {
            try {
                const current = await getUserPayment()
                if (current?.status === 'confirmed') {
                    clearInterval(interval)
                    setIsPolling(false)
                    if (current.cohort_start) {
                        const cohortStartDate = new Date(current.cohort_start + 'T07:00:00')
                        router.replace(isCohortActive(cohortStartDate) ? '/dashboard' : '/onboarding')
                    } else {
                        router.replace('/onboarding')
                    }
                }
            } catch (e) {
                console.error('[Payment] Polling error:', e)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [user, isLoading, payment?.status, router])

    // Создать pending запись и открыть ЮMoney
    const handleYooMoneyPay = async () => {
        if (!user) return
        setError('')
        setIsSubmitting(true)

        // ⚡ Открываем окно СИНХРОННО (до async) — иначе браузер заблокирует popup!
        const yooWindow = window.open('about:blank', '_blank')

        try {
            // Создаём pending payment если ещё нет
            if (!payment || payment.status !== 'pending') {
                const cohortStart = getNextFutureMondayStart()
                const { payment: newPayment, error: paymentError } = await createPaymentRequest(cohortStart)

                if (paymentError) {
                    setError(paymentError)
                    yooWindow?.close()
                    return
                }
                setPayment(newPayment)
            }

            // Направляем pre-opened окно на ЮMoney
            const yooUrl = buildYooMoneyUrl(user.id, PRICE)
            if (yooWindow && !yooWindow.closed) {
                yooWindow.location.href = yooUrl
            } else {
                // Popup заблокирован — открываем в том же окне как fallback
                window.location.href = yooUrl
            }

            // Начинаем polling для автоподтверждения через webhook
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
                if (current.cohort_start) {
                    const cohortStartDate = new Date(current.cohort_start + 'T07:00:00')
                    window.location.href = isCohortActive(cohortStartDate) ? '/dashboard' : '/onboarding'
                } else {
                    window.location.href = '/onboarding'
                }
                return
            }
            setPayment(current)
        } catch (e) {
            console.error('[Payment] Check error:', e)
        } finally {
            setIsLoading(false)
        }
    }

    // Пока авторизация ещё грузится — показываем только если реально нет юзера после загрузки
    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-meta-orange animate-spin" />
            </div>
        )
    }


    // Если уже отправил запрос — показать статус ожидания
    if (payment?.status === 'pending') {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-gradient-to-br from-meta-orange/5 via-transparent to-yellow-500/5 pointer-events-none" />

                <div className="relative max-w-md w-full text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-500 to-orange-500 mb-8 shadow-lg">
                        <Clock className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-4">
                        Ожидаем подтверждение
                    </h1>

                    <div className="glass-card p-8 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-8 h-8 text-yellow-400" />
                        </div>

                        <p className="text-gray-300 mb-4">
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

                        <div className="mt-6 p-4 rounded-xl bg-deep-dark-200/60 border border-white/5">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Сумма</span>
                                <span className="text-white font-medium">{PRICE} ₽</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-2">
                                <span className="text-gray-400">Статус</span>
                                <span className="text-yellow-400 font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                                    {isPolling ? 'Проверяем...' : 'Ожидание'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Кнопка «Оплатить ещё раз» если окно закрыли */}
                        <button
                            onClick={() => {
                                if (user) {
                                    const yooUrl = buildYooMoneyUrl(user.id, PRICE)
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

                        <button
                            onClick={() => router.push('/')}
                            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                        >
                            Вернуться на главную
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-deep-dark flex items-center justify-center p-4">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-meta-orange/5 via-transparent to-green-500/5 pointer-events-none" />

            <div className="relative max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600 mb-4 shadow-glow-orange">
                        <Flame className="w-9 h-9 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Оплата курса</h1>
                    <p className="text-gray-400 mt-2">Метаболическая Перезагрузка — 7 дней</p>
                </div>

                {/* Price Card */}
                <div className="glass-card p-6 mb-6">
                    <div className="text-center mb-6">
                        <div className="text-5xl font-bold text-white mb-1">
                            {PRICE} <span className="text-2xl text-gray-400">₽</span>
                        </div>
                        <p className="text-sm text-gray-500">Единоразовый платёж</p>
                    </div>

                    {/* What's included */}
                    <div className="space-y-3 mb-6">
                        {[
                            '7 дней интенсивного курса',
                            '3 тренировки (силовая, HIIT, мобильность)',
                            'Видео-уроки по питанию и метаболизму',
                            'Подкасты для мотивации',
                            'Калькулятор висцерального жира',
                            'Дневник прогресса',
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-3 h-3 text-green-400" />
                                </div>
                                <span className="text-sm text-gray-300">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="glass-card p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-meta-orange" />
                        Способ оплаты
                    </h2>

                    {/* YooMoney Button */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                                <span className="text-lg font-bold text-purple-600">Ю</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">ЮMoney</p>
                                <p className="text-xs text-gray-400">Карта, кошелёк ЮMoney</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Безопасная оплата через платёжную систему ЮMoney.
                            Принимаются банковские карты и кошелёк ЮMoney.
                        </p>
                    </div>

                    {/* Info */}
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-400">
                                После оплаты вы автоматически получите доступ к курсу.
                                Обычно подтверждение приходит <span className="text-green-400 font-medium">мгновенно</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/30">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Pay Button */}
                <button
                    onClick={handleYooMoneyPay}
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
                            Оплатить {PRICE} ₽
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                <p className="text-center text-xs text-gray-500 mt-4">
                    Вы будете перенаправлены на защищённую страницу ЮMoney для оплаты
                </p>
            </div>
        </div>
    )
}
