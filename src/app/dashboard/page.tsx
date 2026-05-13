'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dumbbell, TrendingUp, Calendar, MessageCircle,
    ChevronRight, Loader2, Zap, Apple
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getCurrentProgram, type TrainingProgram } from '@/lib/services/training'
import { getLatestMetric, type ClientMetric } from '@/lib/services/metrics'
import {
    isNutritionQuestionnaireRequired,
    isNutritionQuestionnaireCompleted,
} from '@/lib/services/nutrition'

export default function DashboardPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [currentProgram, setCurrentProgram] = useState<TrainingProgram | null>(null)
    const [latestMetric, setLatestMetric] = useState<ClientMetric | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState<number | null>(null)
    const [nutritionPending, setNutritionPending] = useState(false)

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (!user) return

        const loadDashboardData = async () => {
            try {
                const [program, metric, needsNutrition, nutritionDone] = await Promise.all([
                    getCurrentProgram(),
                    getLatestMetric(),
                    isNutritionQuestionnaireRequired(),
                    isNutritionQuestionnaireCompleted(),
                ])

                setCurrentProgram(program)
                setLatestMetric(metric)
                setNutritionPending(needsNutrition && !nutritionDone)

                // Считаем дни подписки из платежа
                try {
                    const { getUserPayment } = await import('@/lib/services/payment')
                    const payment = await getUserPayment()
                    if (payment?.status === 'confirmed' && payment.confirmed_at && payment.plan_months) {
                        const startDate = new Date(payment.confirmed_at)
                        const endDate = new Date(startDate)
                        endDate.setMonth(endDate.getMonth() + payment.plan_months)
                        const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        setSubscriptionDaysLeft(Math.max(0, daysLeft))
                    }
                } catch {}
            } catch (e) {
                console.error('Error loading dashboard:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadDashboardData()
    }, [user])

    if (!authLoading && !user) {
        return null
    }

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Атлет'

    return (
        <div className="min-h-screen bg-bg-main p-4 py-6 md:py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">
                        Привет, {userName}! 👋
                    </h1>
                    <p className="text-text-secondary text-sm">Добро пожаловать в MetaSystem</p>
                </div>

                {/* Nutrition questionnaire banner */}
                {nutritionPending && (
                    <button
                        onClick={() => router.push('/questionnaire/nutrition')}
                        className="w-full mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 flex items-center gap-4 text-left hover:bg-accent/15 transition-colors"
                    >
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                            <Apple className="w-6 h-6 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold mb-1">Заполните анкету по питанию</p>
                            <p className="text-text-secondary text-sm">
                                Нужно, чтобы тренер составил индивидуальный план питания. Займёт 5–7 минут.
                            </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-accent flex-shrink-0" />
                    </button>
                )}

                {/* Quick Stats */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Подписка</p>
                                <p className="text-xl font-display font-bold text-white">
                                    {subscriptionDaysLeft ? `${subscriptionDaysLeft} дней` : 'Неактивна'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Вес</p>
                                <p className="text-xl font-display font-bold text-white">
                                    {latestMetric?.weight_kg ? `${latestMetric.weight_kg} кг` : '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                                <Dumbbell className="w-5 h-5 text-info" />
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">Программа</p>
                                <p className="text-xl font-display font-bold text-white">
                                    {currentProgram ? `Неделя ${currentProgram.week_number}` : 'Нет'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Current Program */}
                {currentProgram ? (
                    <div className="glass-card p-6 mb-8 border-accent shadow-glow-accent-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-accent" />
                                    <span className="text-sm font-semibold text-accent">Текущая программа</span>
                                </div>
                                <h2 className="text-2xl font-display font-bold text-white mb-1">
                                    Неделя {currentProgram.week_number}
                                </h2>
                                <p className="text-sm text-text-secondary">
                                    {new Date(currentProgram.start_date).toLocaleDateString('ru-RU')} —{' '}
                                    {new Date(currentProgram.end_date).toLocaleDateString('ru-RU')}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push(`/programs/${currentProgram.id}`)}
                                className="glass-button flex items-center gap-2"
                            >
                                Открыть
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-text-secondary">
                            {currentProgram.training_days_count} тренировочных дней в неделю
                        </p>
                    </div>
                ) : (
                    <div className="glass-card p-12 text-center mb-8">
                        <Dumbbell className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-display font-bold text-white mb-2">
                            Программа еще не загружена
                        </h3>
                        <p className="text-text-secondary">
                            Ваш тренер скоро загрузит первую программу тренировок
                        </p>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => router.push('/programs')}
                        className="glass-card p-6 text-left hover:border-accent transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <Dumbbell className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">
                                        Тренировочные программы
                                    </h3>
                                    <p className="text-sm text-text-secondary">Просмотр и заполнение программ</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted" />
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/metrics')}
                        className="glass-card p-6 text-left hover:border-accent transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-success" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">Метрики</h3>
                                    <p className="text-sm text-text-secondary">Отслеживание прогресса</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted" />
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/messages')}
                        className="glass-card p-6 text-left hover:border-accent transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
                                    <MessageCircle className="w-6 h-6 text-info" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">Сообщения</h3>
                                    <p className="text-sm text-text-secondary">Чат с тренером</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted" />
                        </div>
                    </button>
                </div>

                {/* Latest Metric */}
                {latestMetric && (
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-accent" />
                            <h2 className="text-xl font-display font-bold text-white">Последний замер</h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-text-muted mb-1">Вес</p>
                                <p className="text-lg font-semibold text-white">{latestMetric.weight_kg} кг</p>
                            </div>
                            {latestMetric.waist_cm && (
                                <div>
                                    <p className="text-sm text-text-muted mb-1">Талия</p>
                                    <p className="text-lg font-semibold text-white">{latestMetric.waist_cm} см</p>
                                </div>
                            )}
                            {latestMetric.body_fat_pct && (
                                <div className="col-span-2 sm:col-span-1">
                                    <p className="text-sm text-text-muted mb-1">% жира</p>
                                    <p className="text-lg font-semibold text-white">{latestMetric.body_fat_pct}%</p>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-text-muted mt-4">
                            {new Date(latestMetric.measured_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                            })}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
