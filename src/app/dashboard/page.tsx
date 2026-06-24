'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    Dumbbell, TrendingUp, Calendar, MessageCircle,
    ChevronRight, Loader2, Zap, Apple, RefreshCw,
    AlertTriangle, CheckCircle2, Plus, Flame, X
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getMyPrograms, type TrainingProgram } from '@/lib/services/training'
import { getLatestMetric, type ClientMetric } from '@/lib/services/metrics'
import {
    isNutritionQuestionnaireRequired,
    isNutritionQuestionnaireCompleted,
} from '@/lib/services/nutrition'
import { getCurrentNutritionProgram, type NutritionProgram } from '@/lib/services/nutrition-programs'
import { getMyQuestionnaire, isQuestionnaireCompleted } from '@/lib/services/questionnaire'
import { getMySubscriptionInfo, type SubscriptionInfo } from '@/lib/services/renewal'
import { getMyStreakStats, type StreakStats } from '@/lib/services/streaks'
import StreakCard from '@/components/StreakCard'
import InstallPWABanner from '@/components/InstallPWABanner'
import { useFailsafe } from '@/lib/hooks/useFailsafe'

export default function DashboardPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [currentProgram, setCurrentProgram] = useState<TrainingProgram | null>(null)
    const [currentNutritionPlan, setCurrentNutritionPlan] = useState<NutritionProgram | null>(null)
    const [latestMetric, setLatestMetric] = useState<ClientMetric | null>(null)
    const [questionnaireWeight, setQuestionnaireWeight] = useState<number | null>(null)
    const [streakStats, setStreakStats] = useState<StreakStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState<number | null>(null)
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | null>(null)
    const [subscriptionPlanLabel, setSubscriptionPlanLabel] = useState<string | null>(null)
    const [nutritionPending, setNutritionPending] = useState(false)
    const [questionnairePending, setQuestionnairePending] = useState(false)
    const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
    const [renewedBanner, setRenewedBanner] = useState(false)
    const [nutritionBannerDismissed, setNutritionBannerDismissed] = useState(false)

    useEffect(() => {
        const dismissed = localStorage.getItem('nutritionBannerDismissed')
        if (dismissed) setNutritionBannerDismissed(true)
    }, [])

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    // Показываем баннер "продлено" если пришли с ?renewed=true
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('renewed') === 'true') {
                setRenewedBanner(true)
                // Убираем параметр из URL без перезагрузки
                window.history.replaceState({}, '', '/dashboard')
            }
        }
    }, [])

    useEffect(() => {
        if (!user) return

        const loadDashboardData = async () => {
            try {
                const [allPrograms, metric, qDone, needsNutrition, nutritionDone, subInfoData] = await Promise.all([
                    getMyPrograms(),
                    getLatestMetric(),
                    isQuestionnaireCompleted(),
                    isNutritionQuestionnaireRequired(),
                    isNutritionQuestionnaireCompleted(),
                    getMySubscriptionInfo(),
                ])

                // Определяем текущую программу по ДАТАМ, а не по getCurrentProgram()
                // (getCurrentProgram фильтрует по status='active' и может вернуть будущую неделю)
                const today = new Date().toISOString().split('T')[0]
                const dateMatch = allPrograms.find(p => p.start_date <= today && p.end_date >= today)
                const program = dateMatch ?? (allPrograms.length > 0 ? allPrograms[0] : null)

                setCurrentProgram(program)
                setLatestMetric(metric)
                setQuestionnairePending(!qDone)
                setNutritionPending(needsNutrition && !nutritionDone)
                setSubInfo(subInfoData)

                // Данные подписки из subInfo
                if (subInfoData.endDate) {
                    setSubscriptionEndDate(new Date(subInfoData.endDate))
                    setSubscriptionDaysLeft(subInfoData.daysLeft)
                }

                // Если нет замеров — берём вес из анкеты как fallback
                if (!metric?.weight_kg) {
                    try {
                        const q = await getMyQuestionnaire()
                        if (q?.weight_kg) setQuestionnaireWeight(q.weight_kg)
                    } catch {}
                }

                // Загружаем текущий план питания
                try {
                    const nutPlan = await getCurrentNutritionProgram()
                    setCurrentNutritionPlan(nutPlan)
                } catch {}

                // Загружаем стрик (мягко — не ломаем дашборд при ошибке)
                try {
                    const streak = await getMyStreakStats()
                    setStreakStats(streak)
                } catch (e) {
                    console.warn('[Dashboard] Streak load failed (non-critical):', e)
                }

                // Лейбл тарифа
                const planLabels: Record<string, string> = {
                    '1_month': '1 месяц',
                    '3_months': '3 месяца',
                    '6_months': '6 месяцев',
                }
                if (subInfoData.planType) {
                    setSubscriptionPlanLabel(planLabels[subInfoData.planType] ?? null)
                }
            } catch (e) {
                console.error('Error loading dashboard:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadDashboardData()
    }, [user?.id])

    // Аварийный таймер: если за 8с страница не сняла isLoading — снимаем сами,
    // чтобы пользователь не висел на лоадере (см. desktop-page-load.md).
    useFailsafe(isLoading, () => setIsLoading(false), 8_000, 'dashboard')

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

                {/* PWA Install Banner */}
                <InstallPWABanner />

                {/* Баннер: незаполненная основная анкета клиента
                    Показываем ВЫШЕ питания — она заполняется первой и без неё
                    тренер не сможет составить программу. */}
                {questionnairePending && (
                    <button
                        onClick={() => router.push('/questionnaire')}
                        className="w-full mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-5 flex items-center gap-4 text-left hover:bg-warning/15 transition-colors"
                    >
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                            <Dumbbell className="w-6 h-6 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold mb-1">Заполните анкету клиента</p>
                            <p className="text-text-secondary text-sm">
                                Это первый шаг — без анкеты тренер не сможет составить программу. Займёт 7–10 минут.
                            </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-warning flex-shrink-0" />
                    </button>
                )}

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

                {/* Баннер: тариф успешно продлён */}
                {renewedBanner && (
                    <div className="w-full mb-6 rounded-2xl border border-success/40 bg-success/10 p-5 flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold mb-1">Тариф успешно продлён!</p>
                            <p className="text-text-secondary text-sm">
                                Все ваши данные сохранены. Продолжайте работу.
                            </p>
                        </div>
                        <button
                            onClick={() => setRenewedBanner(false)}
                            className="text-text-muted hover:text-white transition-colors text-lg leading-none flex-shrink-0"
                        >×</button>
                    </div>
                )}

                {/* Баннер: тариф истёк */}
                {subInfo?.isExpired && !renewedBanner && (
                    <button
                        onClick={() => router.push('/renew?expired=true')}
                        className="w-full mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-5 flex items-center gap-4 text-left hover:bg-danger/15 transition-colors"
                    >
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-danger/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-danger" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold mb-1">Ваш тариф истёк</p>
                            <p className="text-text-secondary text-sm">
                                Продлите подписку, чтобы продолжить работу. Все данные сохранены.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-danger font-semibold text-sm">Продлить</span>
                            <ChevronRight className="w-5 h-5 text-danger" />
                        </div>
                    </button>
                )}

                {/* Баннер: тариф скоро истекает */}
                {subInfo?.isExpiringSoon && !subInfo.isExpired && !renewedBanner && (
                    <button
                        onClick={() => router.push('/renew')}
                        className="w-full mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-5 flex items-center gap-4 text-left hover:bg-warning/15 transition-colors"
                    >
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold mb-1">
                                Тариф истекает через {subInfo.daysLeft} {subInfo.daysLeft === 1 ? 'день' : subInfo.daysLeft! <= 4 ? 'дня' : 'дней'}
                            </p>
                            <p className="text-text-secondary text-sm">
                                Продлите сейчас, чтобы не прерывать работу. Данные сохранятся.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-warning font-semibold text-sm">Продлить</span>
                            <ChevronRight className="w-5 h-5 text-warning" />
                        </div>
                    </button>
                )}

                {/* Баннер: докупить питание */}
                {subInfo && !subInfo.isExpired && !subInfo.hasNutrition && subInfo.status === 'active' && !nutritionPending && !nutritionBannerDismissed && (
                    <div className="relative w-full mb-6 rounded-2xl border border-border bg-bg-elevated/50 p-5 flex items-center gap-4 text-left">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setNutritionBannerDismissed(true)
                                localStorage.setItem('nutritionBannerDismissed', '1')
                            }}
                            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4 text-text-muted" />
                        </button>
                        <button
                            onClick={() => router.push('/add-nutrition')}
                            className="flex items-center gap-4 flex-1 min-w-0 text-left"
                        >
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                                <Plus className="w-6 h-6 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold mb-1">Добавить план питания</p>
                                <p className="text-text-secondary text-sm">
                                    Подключите индивидуальный план питания к вашей подписке — всего 3 000 ₽
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
                        </button>
                    </div>
                )}

                {/* Streak (если есть программы) */}
                {streakStats && (streakStats.totalWeeks > 0 || streakStats.history.length > 0) && (
                    <div className="mb-6">
                        <StreakCard
                            stats={streakStats}
                            showLink
                            onLinkClick={() => router.push('/calendar')}
                        />
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    {/* Карточка подписки с прогресс-баром */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-5 h-5 text-accent" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-text-muted">Подписка{subscriptionPlanLabel ? ` · ${subscriptionPlanLabel}` : ''}</p>
                                <p className="text-xl font-display font-bold text-white leading-tight">
                                    {subscriptionDaysLeft !== null
                                        ? subscriptionDaysLeft > 0
                                            ? <><span className={subscriptionDaysLeft <= 14 ? 'text-danger' : subscriptionDaysLeft <= 30 ? 'text-warning' : 'text-accent'}>{subscriptionDaysLeft}</span> дн.</>
                                            : <span className="text-danger">Истекла</span>
                                        : '—'
                                    }
                                </p>
                            </div>
                        </div>
                        {subscriptionDaysLeft !== null && subscriptionEndDate && (
                            <>
                                {/* Прогресс-бар */}
                                {(() => {
                                    const totalDays = subscriptionPlanLabel?.includes('6') ? 180 : subscriptionPlanLabel?.includes('3') ? 90 : 30
                                    const pct = Math.min(100, Math.max(0, (subscriptionDaysLeft / totalDays) * 100))
                                    const color = subscriptionDaysLeft <= 14 ? 'bg-danger' : subscriptionDaysLeft <= 30 ? 'bg-warning' : 'bg-accent'
                                    return (
                                        <div className="mb-2">
                                            <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                                                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })()}
                                <p className="text-xs text-text-muted">
                                    до {subscriptionEndDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </>
                        )}
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
                        onClick={() => router.push('/nutrition')}
                        className={`glass-card p-6 text-left transition-all ${currentNutritionPlan ? 'hover:border-accent border-accent/30' : 'hover:border-accent'}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <Apple className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">
                                        {currentNutritionPlan
                                            ? currentNutritionPlan.title || `План питания №${currentNutritionPlan.plan_number}`
                                            : 'Планы питания'
                                        }
                                    </h3>
                                    <p className="text-sm text-text-secondary">
                                        {currentNutritionPlan
                                            ? currentNutritionPlan.plan_data?.dailyKcal
                                                ? `${currentNutritionPlan.plan_data.dailyKcal} ккал · ${currentNutritionPlan.plan_data.days?.length || 0} дней`
                                                : 'Активный план питания'
                                            : 'Индивидуальный план от тренера'
                                        }
                                    </p>
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

                    <button
                        onClick={() => router.push('/calendar')}
                        className="glass-card p-6 text-left hover:border-accent transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <Flame className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-white mb-1">Календарь и стрик</h3>
                                    <p className="text-sm text-text-secondary">
                                        {streakStats && streakStats.currentStreak > 0
                                            ? `${streakStats.currentStreak} ${streakStats.currentStreak === 1 ? 'неделя' : streakStats.currentStreak <= 4 ? 'недели' : 'недель'} подряд`
                                            : 'Серия закрытых недель'}
                                    </p>
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
