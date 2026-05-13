'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Droplets, Flame, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getNutritionProgramById, type NutritionProgram, type NutritionDay, type NutritionMeal } from '@/lib/services/nutrition-programs'

// ─── Иконки приёмов пищи ─────────────────────────────────────────────────────

function getMealIcon(name: string): string {
    const n = name.toLowerCase()
    if (n.includes('завтрак')) return '🌅'
    if (n.includes('обед')) return '☀️'
    if (n.includes('ужин')) return '🌙'
    if (n.includes('перекус')) return '🍎'
    if (n.includes('после тренировки') || n.includes('посттрен')) return '💪'
    if (n.includes('до тренировки') || n.includes('предтрен')) return '⚡'
    return '🍽️'
}

// ─── Макро-бейдж ─────────────────────────────────────────────────────────────

function MacroBadge({ label, value, unit, color }: { label: string; value?: number; unit: string; color: string }) {
    if (!value) return null
    return (
        <div className={`flex flex-col items-center px-3 py-2 rounded-xl bg-bg-elevated border border-border`}>
            <span className={`text-lg font-display font-bold ${color}`}>{value}</span>
            <span className="text-xs text-text-muted">{unit}</span>
            <span className="text-xs text-text-muted mt-0.5">{label}</span>
        </div>
    )
}

// ─── Карточка приёма пищи ─────────────────────────────────────────────────────

function MealCard({ meal }: { meal: NutritionMeal }) {
    const [expanded, setExpanded] = useState(true)
    const icon = getMealIcon(meal.name)

    return (
        <div className="glass-card overflow-hidden">
            {/* Заголовок */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-display font-bold text-white">{meal.name}</h3>
                            {meal.time && (
                                <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">{meal.time}</span>
                            )}
                        </div>
                        {meal.kcal && (
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-text-secondary">
                                <span className="text-accent font-semibold flex items-center gap-1">
                                    <Flame className="w-3 h-3" />{meal.kcal} ккал
                                </span>
                                {meal.protein && <span>Б: {meal.protein}г</span>}
                                {meal.fat && <span>Ж: {meal.fat}г</span>}
                                {meal.carbs && <span>У: {meal.carbs}г</span>}
                            </div>
                        )}
                    </div>
                </div>
                <button className="glass-button-secondary p-1.5 rounded-lg flex-shrink-0 ml-2">
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-text-muted" />
                        : <ChevronDown className="w-4 h-4 text-text-muted" />
                    }
                </button>
            </div>

            {/* Блюда */}
            {expanded && (
                <div className="px-4 pb-4 space-y-2">
                    {meal.dishes.map((dish, idx) => (
                        <div key={dish.id || idx} className="rounded-xl bg-bg-elevated p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-white leading-tight">{dish.name}</p>
                                    {dish.amount && (
                                        <p className="text-xs text-accent mt-0.5">{dish.amount}</p>
                                    )}
                                    {dish.recipe && (
                                        <p className="text-xs text-text-muted mt-1.5 leading-relaxed italic">
                                            📝 {dish.recipe}
                                        </p>
                                    )}
                                </div>
                                {dish.kcal && (
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-white">{dish.kcal}</p>
                                        <p className="text-xs text-text-muted">ккал</p>
                                    </div>
                                )}
                            </div>
                            {(dish.protein || dish.fat || dish.carbs) && (
                                <div className="flex gap-3 mt-2 text-xs text-text-secondary">
                                    {dish.protein !== undefined && <span>Б: <strong className="text-white">{dish.protein}г</strong></span>}
                                    {dish.fat !== undefined && <span>Ж: <strong className="text-white">{dish.fat}г</strong></span>}
                                    {dish.carbs !== undefined && <span>У: <strong className="text-white">{dish.carbs}г</strong></span>}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Заметка к приёму пищи */}
                    {meal.note && (
                        <div className="mt-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
                            <p className="text-xs text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">💬 Заметка: </span>
                                {meal.note}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function NutritionPlanDetailPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const params = useParams()
    const planId = params.planId as string

    const [plan, setPlan] = useState<NutritionProgram | null>(null)
    const [currentDayIndex, setCurrentDayIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!authLoading && !user) router.replace('/auth')
    }, [user, authLoading, router])

    useEffect(() => {
        if (authLoading) return   // ждём завершения проверки авторизации
        if (!user) return
        getNutritionProgramById(planId)
            .then(data => {
                if (!data) { router.replace('/nutrition'); return }
                setPlan(data)
                // Открываем день, соответствующий сегодняшнему
                if (data.plan_data?.days?.length) {
                    const today = new Date().getDay() // 0=вс, 1=пн...
                    const dayMap: Record<string, number> = {
                        monday: 1, tuesday: 2, wednesday: 3,
                        thursday: 4, friday: 5, saturday: 6, sunday: 0,
                    }
                    const todayIdx = data.plan_data.days.findIndex(
                        d => dayMap[d.dayOfWeek] === today
                    )
                    if (todayIdx >= 0) setCurrentDayIndex(todayIdx)
                }
            })
            .catch(console.error)
            .finally(() => setIsLoading(false))
    }, [user, authLoading, planId, router])
    if (authLoading || isLoading || !plan) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    const days = plan.plan_data?.days || []

    // Если нет структурированных дней — показываем raw markdown
    if (days.length === 0) {
        return (
            <div className="min-h-screen bg-bg-main p-4 py-8">
                <div className="max-w-2xl mx-auto">
                    <button onClick={() => router.push('/nutrition')} className="glass-button-secondary flex items-center gap-2 mb-6">
                        <ArrowLeft className="w-4 h-4" />Назад
                    </button>
                    <div className="glass-card p-6 mb-4">
                        <h1 className="text-2xl font-display font-bold text-white">
                            {plan.title || `План питания №${plan.plan_number}`}
                        </h1>
                        <p className="text-sm text-text-secondary mt-1">
                            {new Date(plan.start_date).toLocaleDateString('ru-RU')} — {new Date(plan.end_date).toLocaleDateString('ru-RU')}
                        </p>
                    </div>
                    <div className="glass-card p-6">
                        <pre className="whitespace-pre-wrap text-sm text-text-secondary font-body leading-relaxed">{plan.plan_md}</pre>
                    </div>
                </div>
            </div>
        )
    }

    const currentDay: NutritionDay = days[currentDayIndex]

    return (
        <div className="min-h-screen bg-bg-main p-4 py-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <button onClick={() => router.push('/nutrition')} className="glass-button-secondary flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />Назад
                    </button>
                </div>

                {/* Инфо о плане */}
                <div className="glass-card p-5 mb-5">
                    <h1 className="text-xl font-display font-bold text-white mb-1">
                        {plan.title || `План питания №${plan.plan_number}`}
                    </h1>
                    <p className="text-xs text-text-secondary mb-3">
                        {new Date(plan.start_date).toLocaleDateString('ru-RU')} — {new Date(plan.end_date).toLocaleDateString('ru-RU')}
                    </p>

                    {/* Целевые КБЖУ */}
                    {plan.plan_data?.dailyKcal && (
                        <div className="flex gap-2 mb-4 flex-wrap">
                            <MacroBadge label="Калории" value={plan.plan_data.dailyKcal} unit="ккал" color="text-accent" />
                            <MacroBadge label="Белок" value={plan.plan_data.dailyProtein} unit="г" color="text-blue-400" />
                            <MacroBadge label="Жиры" value={plan.plan_data.dailyFat} unit="г" color="text-yellow-400" />
                            <MacroBadge label="Углеводы" value={plan.plan_data.dailyCarbs} unit="г" color="text-green-400" />
                        </div>
                    )}

                    {/* Рекомендация тренера на неделю */}
                    {plan.plan_data?.weeklyNote && (
                        <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex gap-2">
                            <span className="text-accent text-base flex-shrink-0">💬</span>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">Тренер: </span>
                                {plan.plan_data.weeklyNote}
                            </p>
                        </div>
                    )}

                    {/* Кнопки дней */}
                    {days.length > 1 && (
                        <div className="flex gap-2 mt-4 flex-wrap">
                            {days.map((day, idx) => (
                                <button
                                    key={day.dayNumber}
                                    onClick={() => setCurrentDayIndex(idx)}
                                    className={`flex-1 min-w-[60px] py-2 rounded-lg text-xs font-semibold transition-all ${
                                        idx === currentDayIndex
                                            ? 'bg-accent text-bg-main'
                                            : 'bg-bg-elevated text-text-muted hover:text-white'
                                    }`}
                                >
                                    День {day.dayNumber}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Навигация по дням */}
                {days.length > 1 && (
                    <div className="flex items-center justify-between mb-5 gap-2">
                        <button
                            onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))}
                            disabled={currentDayIndex === 0}
                            className="glass-button-secondary flex items-center gap-1 disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Предыдущий</span>
                        </button>
                        <div className="text-center">
                            <h2 className="text-lg font-display font-bold text-white">День {currentDay.dayNumber}</h2>
                            <p className="text-xs text-text-secondary">{currentDay.title}</p>
                        </div>
                        <button
                            onClick={() => setCurrentDayIndex(i => Math.min(days.length - 1, i + 1))}
                            disabled={currentDayIndex === days.length - 1}
                            className="glass-button-secondary flex items-center gap-1 disabled:opacity-30"
                        >
                            <span className="hidden sm:inline text-sm">Следующий</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Рекомендация тренера на день */}
                {currentDay.coachNote && (
                    <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex gap-3 mb-4">
                        <span className="text-accent text-lg flex-shrink-0">📋</span>
                        <div>
                            <p className="text-xs text-accent font-semibold mb-0.5">Рекомендация тренера на сегодня</p>
                            <p className="text-sm text-text-secondary leading-relaxed">{currentDay.coachNote}</p>
                        </div>
                    </div>
                )}

                {/* КБЖУ дня + вода */}
                <div className="glass-card p-4 mb-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex gap-3 flex-wrap">
                            {currentDay.totalKcal && (
                                <div className="text-center">
                                    <p className="text-xl font-display font-bold text-accent">{currentDay.totalKcal}</p>
                                    <p className="text-xs text-text-muted">ккал</p>
                                </div>
                            )}
                            {currentDay.totalProtein && (
                                <div className="text-center">
                                    <p className="text-xl font-display font-bold text-blue-400">{currentDay.totalProtein}г</p>
                                    <p className="text-xs text-text-muted">белок</p>
                                </div>
                            )}
                            {currentDay.totalFat && (
                                <div className="text-center">
                                    <p className="text-xl font-display font-bold text-yellow-400">{currentDay.totalFat}г</p>
                                    <p className="text-xs text-text-muted">жиры</p>
                                </div>
                            )}
                            {currentDay.totalCarbs && (
                                <div className="text-center">
                                    <p className="text-xl font-display font-bold text-green-400">{currentDay.totalCarbs}г</p>
                                    <p className="text-xs text-text-muted">углеводы</p>
                                </div>
                            )}
                        </div>
                        {currentDay.waterGoal && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <Droplets className="w-4 h-4 text-blue-400" />
                                <div>
                                    <p className="text-sm font-bold text-blue-400">{currentDay.waterGoal}</p>
                                    <p className="text-xs text-text-muted">воды</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Приёмы пищи */}
                <div className="space-y-4">
                    {currentDay.meals.map((meal, idx) => (
                        <MealCard key={meal.id || idx} meal={meal} />
                    ))}
                </div>

                {/* Если нет блюд — показываем заглушку */}
                {currentDay.meals.length === 0 && (
                    <div className="glass-card p-8 text-center">
                        <p className="text-text-muted">Приёмы пищи для этого дня не указаны</p>
                    </div>
                )}
            </div>
        </div>
    )
}
