'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Calendar, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { getNextFutureMondayStart, getTimeUntilStart, formatDate, isCohortActive, getNextMondayStart } from '@/lib/utils/cohort'
import { useAuth } from '@/lib/auth'
import { getUserPayment } from '@/lib/services/payment'

export default function WaitingRoomPage() {
    const router = useRouter()
    const { user, isLoading: authLoading } = useAuth()
    const [cohortStart, setCohortStart] = useState(() => getNextFutureMondayStart())
    const [timeLeft, setTimeLeft] = useState(getTimeUntilStart(cohortStart))
    const [isLoading, setIsLoading] = useState(true)

    // Проверка авторизации и оплаты
    useEffect(() => {
        if (authLoading) return

        if (!user) {
            window.location.href = '/auth'
            return
        }

        const checkAccess = async () => {
            try {
                const payment = await getUserPayment()
                if (!payment || payment.status !== 'confirmed') {
                    window.location.href = '/payment'
                    return
                }

                const start = getNextMondayStart()
                if (isCohortActive(start)) {
                    window.location.href = '/dashboard'
                    return
                }
                setCohortStart(start)
            } catch (e) {
                console.error('[WaitingRoom] Error:', e)
            } finally {
                setIsLoading(false)
            }
        }
        checkAccess()
    }, [user, authLoading, router])

    // Таймер — обновляется каждую секунду
    useEffect(() => {
        const interval = setInterval(() => {
            const newTime = getTimeUntilStart(cohortStart)
            setTimeLeft(newTime)
            if (isCohortActive(cohortStart)) {
                window.location.href = '/dashboard'
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [cohortStart])

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-meta-orange animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-deep-dark flex flex-col items-center justify-center p-4 py-10">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-meta-orange/5 via-transparent to-purple-500/5 pointer-events-none" />

            <div className="relative w-full max-w-lg text-center">
                {/* Logo */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600 mb-6 shadow-glow-orange">
                    <Flame className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
                    Метаболический Запуск
                </h1>
                <p className="text-base text-gray-400 mb-8">
                    7-дневный курс перезагрузки метаболизма
                </p>

                {/* Countdown Card */}
                <div className="glass-card p-5 sm:p-8 mb-6">
                    <div className="flex items-center justify-center gap-2 text-meta-orange mb-4">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">До старта когорты</span>
                    </div>

                    <p className="text-lg font-semibold text-white mb-6">
                        {formatDate(cohortStart)}, 07:00
                    </p>

                    {/* Timer — адаптивный */}
                    <div className="grid grid-cols-4 gap-2 sm:gap-4">
                        <TimeUnit value={timeLeft.days} label="дн" />
                        <TimeUnit value={timeLeft.hours} label="ч" />
                        <TimeUnit value={timeLeft.minutes} label="мин" />
                        <TimeUnit value={timeLeft.seconds} label="сек" />
                    </div>

                    {/* Separator labels on larger screens */}
                    <div className="hidden sm:grid grid-cols-4 gap-4 mt-1 px-0.5">
                        {['дней', 'часов', 'минут', 'секунд'].map(l => (
                            <p key={l} className="text-[10px] text-gray-600 uppercase tracking-wider text-center">{l}</p>
                        ))}
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    <div className="glass-card p-4 text-left">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                            <Clock className="w-4 h-4 text-blue-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">Почему понедельник?</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Когортный формат — вся группа идёт в едином ритме. Это повышает мотивацию и результат.
                        </p>
                    </div>

                    <div className="glass-card p-4 text-left">
                        <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center mb-3">
                            <ArrowRight className="w-4 h-4 text-green-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">Пока вы ждёте</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Подготовьте сантиметровую ленту и очистите холодильник от сладких напитков.
                        </p>
                    </div>
                </div>

                {/* Back to onboarding */}
                <button
                    onClick={() => window.location.href = '/onboarding'}
                    className="glass-button-secondary text-sm w-full"
                >
                    Посмотреть расписание курса
                </button>
            </div>
        </div>
    )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="glass-card py-3 px-1 sm:p-4 bg-deep-dark-200/40 flex flex-col items-center justify-center min-w-0">
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums leading-none mb-1">
                {value.toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">
                {label}
            </div>
        </div>
    )
}
