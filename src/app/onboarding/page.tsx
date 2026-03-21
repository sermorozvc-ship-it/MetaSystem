'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Flame, CheckCircle2, Calendar, Clock,
    Dumbbell, Footprints, Zap, Heart, Brain, Trophy,
    UtensilsCrossed, ArrowRight, Loader2, ShoppingBag
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getUserPayment } from '@/lib/services/payment'
import { getNextFutureMondayStart, getTimeUntilStart, formatDate, isCohortActive, getNextMondayStart } from '@/lib/utils/cohort'

const SCHEDULE = [
    {
        day: 'Понедельник',
        emoji: '🥗',
        icon: UtensilsCrossed,
        title: 'День Питания',
        description: 'Тренировки нет. Разбираем холодильник, учимся собирать «Тарелку» и закупаем продукты.',
        color: 'from-green-500/20 to-green-600/10',
        borderColor: 'border-green-500/30',
        iconColor: 'text-green-400',
    },
    {
        day: 'Вторник',
        emoji: '🔥',
        icon: Dumbbell,
        title: 'Тренировка №1 (Силовая/Фулбоди)',
        description: 'Нужно 20 минут + коврик и гантели (или бутылки с водой).',
        color: 'from-orange-500/20 to-red-500/10',
        borderColor: 'border-orange-500/30',
        iconColor: 'text-orange-400',
    },
    {
        day: 'Среда',
        emoji: '🚶‍♂️',
        icon: Footprints,
        title: 'День Активности (NEAT)',
        description: 'Тренировки нет. Работаем с осанкой и шагами. Видео-урок «Замок таза».',
        color: 'from-blue-500/20 to-blue-600/10',
        borderColor: 'border-blue-500/30',
        iconColor: 'text-blue-400',
    },
    {
        day: 'Четверг',
        emoji: '⚡️',
        icon: Zap,
        title: 'Тренировка №2 (HIIT / Интервальная)',
        description: 'Самый интенсивный день. Нужно 20 минут + полотенце (будет жарко).',
        color: 'from-yellow-500/20 to-amber-500/10',
        borderColor: 'border-yellow-500/30',
        iconColor: 'text-yellow-400',
    },
    {
        day: 'Пятница',
        emoji: '🧘‍♂️',
        icon: Heart,
        title: 'Тренировка №3 (Мобильность / Анти-Стресс)',
        description: 'Спокойная практика на 15 минут для снятия зажимов.',
        color: 'from-purple-500/20 to-purple-600/10',
        borderColor: 'border-purple-500/30',
        iconColor: 'text-purple-400',
    },
    {
        day: 'Суббота',
        emoji: '🧠',
        icon: Brain,
        title: 'Психология + Прогулка',
        description: 'Разбираем, почему мозг саботирует успех. Длинная прогулка на улице.',
        color: 'from-pink-500/20 to-pink-600/10',
        borderColor: 'border-pink-500/30',
        iconColor: 'text-pink-400',
    },
    {
        day: 'Воскресенье',
        emoji: '🏆',
        icon: Trophy,
        title: 'Финал',
        description: 'Замеры, итоги и стратегия на будущее.',
        color: 'from-emerald-500/20 to-emerald-600/10',
        borderColor: 'border-emerald-500/30',
        iconColor: 'text-emerald-400',
    },
]

export default function OnboardingPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [isLoading, setIsLoading] = useState(true)
    const [cohortStart, setCohortStart] = useState(() => getNextFutureMondayStart())
    const [timeLeft, setTimeLeft] = useState(getTimeUntilStart(cohortStart))

    // Проверка авторизации и оплаты
    useEffect(() => {
        if (authLoading) return

        if (!user) {
            router.replace('/auth')
            return
        }

        const checkPayment = async () => {
            try {
                const payment = await getUserPayment()
                if (!payment || payment.status !== 'confirmed') {
                    router.replace('/payment')
                    return
                }

                // Если когорта уже активна — на dashboard
                const start = getNextMondayStart()
                if (isCohortActive(start)) {
                    setCohortStart(start)
                }
            } catch (e) {
                console.error('[Onboarding] Error:', e)
            } finally {
                setIsLoading(false)
            }
        }
        checkPayment()
    }, [user, authLoading, router])

    // Таймер
    useEffect(() => {
        const interval = setInterval(() => {
            const newTime = getTimeUntilStart(cohortStart)
            setTimeLeft(newTime)

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

    const courseStarted = isCohortActive(cohortStart)

    return (
        <div className="min-h-screen bg-deep-dark">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-meta-orange/5 via-transparent to-purple-500/5 pointer-events-none" />

            <div className="relative max-w-2xl mx-auto px-4 py-8 pb-24">
                {/* Header — Welcome */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-meta-orange to-meta-orange-600 mb-6 shadow-glow-orange animate-pulse">
                        <Flame className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                        Добро пожаловать в Команду! 🤝
                    </h1>

                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/15 border border-green-500/30 mb-6">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-green-400">
                            Оплата принята. Место забронировано.
                        </span>
                    </div>
                </div>

                {/* Motivational Text */}
                <div className="glass-card p-6 mb-8">
                    <p className="text-gray-300 leading-relaxed">
                        Поздравляю с лучшей инвестицией в себя. Ты прошёл первый фильтр.
                        Мы стартуем строго в <span className="text-white font-semibold">ПОНЕДЕЛЬНИК</span>.
                        Почему? Чтобы вся группа шла в едином ритме, а твой организм вошёл
                        в режим «недели» — в выходные мы будем восстанавливаться.
                    </p>
                    <p className="text-gray-300 leading-relaxed mt-4">
                        Пока у тебя есть время, изучи наш график. Это не просто «похудение».
                        Это <span className="text-meta-orange font-semibold">Метаболическая Перезагрузка</span>.
                        Мы будем работать с питанием, гормонами и головой.
                    </p>
                </div>

                {/* Countdown Timer */}
                {!courseStarted && (
                    <div className="glass-card p-6 mb-8">
                        <div className="flex items-center justify-center gap-2 text-meta-orange mb-4">
                            <Calendar className="w-5 h-5" />
                            <span className="text-sm font-medium">Старт когорты</span>
                        </div>

                        <p className="text-xl font-medium text-white text-center mb-6">
                            {formatDate(cohortStart)}, 07:00
                        </p>

                        <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
                            <TimerUnit value={timeLeft.days} label="дней" />
                            <TimerUnit value={timeLeft.hours} label="часов" />
                            <TimerUnit value={timeLeft.minutes} label="минут" />
                            <TimerUnit value={timeLeft.seconds} label="секунд" />
                        </div>
                    </div>
                )}

                {/* Schedule Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-meta-orange/20 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-meta-orange" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            📅 Как будет выглядеть твоя неделя
                        </h2>
                        <p className="text-sm text-gray-400">
                            Чередуем нагрузку, чтобы не убить нервную систему
                        </p>
                    </div>
                </div>

                {/* Schedule Cards */}
                <div className="space-y-3 mb-8">
                    {SCHEDULE.map((item, index) => {
                        const Icon = item.icon
                        return (
                            <div
                                key={index}
                                className={`glass-card p-4 border ${item.borderColor} bg-gradient-to-r ${item.color} transition-all duration-300 hover:scale-[1.02]`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                        <Icon className={`w-5 h-5 ${item.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {item.day}
                                            </span>
                                            <span className="text-sm">{item.emoji}</span>
                                        </div>
                                        <h3 className="text-white font-semibold mb-1">
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* What to do now */}
                <div className="glass-card p-6 mb-8">
                    <h3 className="text-lg font-bold text-white mb-4">
                        👇 Что сделать прямо сейчас
                    </h3>

                    <div className="space-y-4">
                        <TodoItem
                            icon={ShoppingBag}
                            title="Подготовь инвентарь"
                            description="Коврик, удобную одежду и пару гантелей (или 2 бутылки по 1.5–5 литров)."
                        />
                        <TodoItem
                            icon={Flame}
                            title="Настройся"
                            description="Это будет неделя, которая изменит твоё отношение к телу."
                        />
                        <TodoItem
                            icon={Clock}
                            title="Отдыхай"
                            description="В понедельник в 07:00 придёт первое задание. До связи!"
                        />
                    </div>
                </div>

                {/* CTA Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-deep-dark via-deep-dark/95 to-transparent">
                    <div className="max-w-2xl mx-auto">
                        <button
                            onClick={() => router.push(courseStarted ? '/dashboard' : '/waiting-room')}
                            className="glass-button w-full flex items-center justify-center gap-2 py-4 text-lg"
                        >
                            {courseStarted ? 'Начать курс' : 'Перейти в зал ожидания'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function TimerUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="glass-card p-3 bg-deep-dark-200/40 text-center">
            <div className="text-2xl md:text-3xl font-bold text-white mb-0.5">
                {value.toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                {label}
            </div>
        </div>
    )
}

function TodoItem({ icon: Icon, title, description }: {
    icon: React.ElementType
    title: string
    description: string
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-meta-orange/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-meta-orange" />
            </div>
            <div>
                <h4 className="text-white font-medium text-sm">{title}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
        </div>
    )
}
