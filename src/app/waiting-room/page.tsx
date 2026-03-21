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
            router.replace('/auth')
            return
        }

        const checkAccess = async () => {
            try {
                const payment = await getUserPayment()
                if (!payment || payment.status !== 'confirmed') {
                    router.replace('/payment')
                    return
                }

                // Если когорта активна — на dashboard
                const start = getNextMondayStart()
                if (isCohortActive(start)) {
                    router.replace('/dashboard')
                    return
                }
            } catch (e) {
                console.error('[WaitingRoom] Error:', e)
            } finally {
                setIsLoading(false)
            }
        }
        checkAccess()
    }, [user, authLoading, router])

    // Обновление таймера каждую секунду
    useEffect(() => {
        const interval = setInterval(() => {
            const newTime = getTimeUntilStart(cohortStart)
            setTimeLeft(newTime)

            // Если курс начался — редирект
            if (isCohortActive(cohortStart)) {
                router.push('/dashboard')
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [cohortStart, router])

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-meta-orange animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-deep-dark flex items-center justify-center p-6">
            {/* Background Gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-meta-orange/5 via-transparent to-purple-500/5 pointer-events-none" />

            <div className="relative max-w-2xl w-full text-center">
                {/* Logo */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-meta-orange to-meta-orange-600 mb-8 shadow-glow-orange">
                    <Flame className="w-10 h-10 text-white" />
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                    Метаболический Запуск
                </h1>
                <p className="text-xl text-gray-400 mb-12">
                    7-дневный курс перезагрузки метаболизма
                </p>

                {/* Countdown Card */}
                <div className="glass-card p-8 mb-8">
                    <div className="flex items-center justify-center gap-2 text-meta-orange mb-6">
                        <Calendar className="w-5 h-5" />
                        <span className="text-sm font-medium">Старт когорты</span>
                    </div>

                    <p className="text-2xl font-medium text-white mb-8">
                        {formatDate(cohortStart)}, 07:00
                    </p>

                    {/* Timer */}
                    <div className="grid grid-cols-4 gap-4 max-w-md mx-auto">
                        <TimeUnit value={timeLeft.days} label="дней" />
                        <TimeUnit value={timeLeft.hours} label="часов" />
                        <TimeUnit value={timeLeft.minutes} label="минут" />
                        <TimeUnit value={timeLeft.seconds} label="секунд" />
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <div className="glass-card p-6 text-left">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                            <Clock className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            Почему понедельник?
                        </h3>
                        <p className="text-sm text-gray-400">
                            Когортный формат обеспечивает синхронное прохождение курса всей группой.
                            Это повышает мотивацию и результаты участников.
                        </p>
                    </div>

                    <div className="glass-card p-6 text-left">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                            <ArrowRight className="w-5 h-5 text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            Пока вы ждёте
                        </h3>
                        <p className="text-sm text-gray-400">
                            Подготовьте сантиметровую ленту для измерений.
                            Очистите холодильник от сладких напитков и полуфабрикатов.
                        </p>
                    </div>
                </div>

                {/* View onboarding */}
                <button
                    onClick={() => router.push('/onboarding')}
                    className="glass-button-secondary text-sm"
                >
                    Посмотреть расписание курса
                </button>
            </div>
        </div>
    )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="glass-card p-4 bg-deep-dark-200/40">
            <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                {value.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
                {label}
            </div>
        </div>
    )
}

