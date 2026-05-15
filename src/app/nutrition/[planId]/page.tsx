'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Loader2, ChevronLeft, ChevronRight,
    Droplets, Flame, ChevronDown, ChevronUp, BookOpen, Calendar, Dumbbell,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    getNutritionProgramById,
    type NutritionProgram, type NutritionDay,
    type NutritionMeal, type NutritionRecipe, type SportSupplement,
} from '@/lib/services/nutrition-programs'

type PageTab = 'plan' | 'recipes' | 'supplements'

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

function MacroBadge({ label, value, unit, color }: {
    label: string; value?: number; unit: string; color: string
}) {
    if (!value) return null
    return (
        <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-bg-elevated border border-border">
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
    const isEmpty = meal.dishes.length === 0 && !meal.note

    return (
        <div className={`glass-card overflow-hidden ${isEmpty ? 'opacity-60' : ''}`}>
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
                            {isEmpty && (
                                <span className="text-xs text-text-muted italic">не заполнено</span>
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

            {expanded && (
                <div className="px-4 pb-4 space-y-2">
                    {meal.dishes.map((dish, idx) => (
                        <div key={dish.id || idx} className="rounded-xl bg-bg-elevated p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-white leading-tight">{dish.name}</p>
                                    {dish.amount && <p className="text-xs text-accent mt-0.5">{dish.amount}</p>}
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

                    {meal.note && (
                        <div className="mt-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
                            <p className="text-xs text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">💬 </span>{meal.note}
                            </p>
                        </div>
                    )}

                    {isEmpty && (
                        <p className="text-xs text-text-muted italic text-center py-2">
                            Тренер ещё не заполнил этот приём пищи
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Карточка рецепта ─────────────────────────────────────────────────────────

function RecipeCard({ recipe }: { recipe: NutritionRecipe }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="glass-card overflow-hidden">
            <div
                className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-display font-bold text-white">{recipe.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-secondary flex-wrap">
                        {recipe.kcal && (
                            <span className="text-accent font-semibold flex items-center gap-1">
                                <Flame className="w-3 h-3" />{recipe.kcal} ккал
                            </span>
                        )}
                        {recipe.protein && <span>Б: {recipe.protein}г</span>}
                        {recipe.fat && <span>Ж: {recipe.fat}г</span>}
                        {recipe.carbs && <span>У: {recipe.carbs}г</span>}
                        {recipe.servings && <span className="text-text-muted">· {recipe.servings}</span>}
                    </div>
                </div>
                <button className="glass-button-secondary p-1.5 rounded-lg flex-shrink-0 ml-2">
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-text-muted" />
                        : <ChevronDown className="w-4 h-4 text-text-muted" />
                    }
                </button>
            </div>

            {expanded && (
                <div className="px-4 pb-4 space-y-4">
                    {recipe.ingredients.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Ингредиенты</p>
                            <ul className="space-y-1">
                                {recipe.ingredients.map((ing, i) => (
                                    <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                                        <span className="text-accent mt-0.5 flex-shrink-0">•</span>
                                        {ing}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {recipe.steps.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Приготовление</p>
                            <ol className="space-y-2">
                                {recipe.steps.map((step, i) => (
                                    <li key={i} className="text-sm text-text-secondary flex items-start gap-3">
                                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                            {i + 1}
                                        </span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {recipe.note && (
                        <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                            <p className="text-xs text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">💡 Заметка: </span>{recipe.note}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Вкладка "Рецепты" ───────────────────────────────────────────────────────

function RecipesTab({ recipes }: { recipes: NutritionRecipe[] }) {
    const categories = Array.from(new Set(recipes.map(r => r.category || 'Прочее')))

    if (recipes.length === 0) {
        return (
            <div className="glass-card p-12 text-center">
                <BookOpen className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">Рецепты не добавлены</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {categories.map(cat => {
                const catRecipes = recipes.filter(r => (r.category || 'Прочее') === cat)
                return (
                    <div key={cat}>
                        <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">{cat}</h2>
                        <div className="space-y-3">
                            {catRecipes.map(recipe => (
                                <RecipeCard key={recipe.id} recipe={recipe} />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Вкладка "Спортивное питание" ────────────────────────────────────────────

function SupplementsTab({ supplements }: { supplements: { coachNote?: string; supplements: SportSupplement[] } }) {
    if (supplements.supplements.length === 0) {
        return (
            <div className="glass-card p-12 text-center">
                <Dumbbell className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">Рекомендации по спортпиту не добавлены</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {supplements.coachNote && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex gap-3">
                    <span className="text-accent text-lg flex-shrink-0">💬</span>
                    <div>
                        <p className="text-xs text-accent font-semibold mb-0.5">Рекомендация тренера</p>
                        <p className="text-sm text-text-secondary leading-relaxed">{supplements.coachNote}</p>
                    </div>
                </div>
            )}

            {supplements.supplements.map((supp, idx) => (
                <div key={supp.id || idx} className="glass-card p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Dumbbell className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-display font-bold text-white mb-2">{supp.name}</h3>
                            <div className="space-y-1.5">
                                {supp.dose && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-xs text-text-muted w-20 flex-shrink-0 pt-0.5">Доза</span>
                                        <span className="text-sm text-white font-semibold">{supp.dose}</span>
                                    </div>
                                )}
                                {supp.timing && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-xs text-text-muted w-20 flex-shrink-0 pt-0.5">Приём</span>
                                        <span className="text-sm text-text-secondary leading-snug">{supp.timing}</span>
                                    </div>
                                )}
                                {supp.purpose && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-xs text-text-muted w-20 flex-shrink-0 pt-0.5">Цель</span>
                                        <span className="text-sm text-text-secondary leading-snug">{supp.purpose}</span>
                                    </div>
                                )}
                            </div>
                            {supp.note && (
                                <div className="mt-3 p-3 rounded-xl bg-bg-elevated border border-border">
                                    <p className="text-xs text-text-secondary leading-relaxed">
                                        <span className="text-accent font-semibold">💡 </span>{supp.note}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
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
    const [pageTab, setPageTab] = useState<PageTab>('plan')
    const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
    const [currentDayIndex, setCurrentDayIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!authLoading && !user) router.replace('/auth')
    }, [user, authLoading, router])

    useEffect(() => {
        if (authLoading) return
        if (!user) return
        getNutritionProgramById(planId)
            .then(data => {
                if (!data) { router.replace('/nutrition'); return }
                setPlan(data)
                // Открываем текущую неделю/день
                if (data.plan_data?.weeks?.length) {
                    const today = new Date().getDay()
                    const dayMap: Record<string, number> = {
                        monday: 1, tuesday: 2, wednesday: 3,
                        thursday: 4, friday: 5, saturday: 6, sunday: 0,
                    }
                    // Ищем сегодняшний день по всем неделям
                    for (let wi = 0; wi < data.plan_data.weeks.length; wi++) {
                        const week = data.plan_data.weeks[wi]
                        const di = week.days.findIndex(d => dayMap[d.dayOfWeek] === today)
                        if (di >= 0) {
                            setCurrentWeekIndex(wi)
                            setCurrentDayIndex(di)
                            break
                        }
                    }
                } else if (data.plan_data?.days?.length) {
                    const today = new Date().getDay()
                    const dayMap: Record<string, number> = {
                        monday: 1, tuesday: 2, wednesday: 3,
                        thursday: 4, friday: 5, saturday: 6, sunday: 0,
                    }
                    const di = data.plan_data.days.findIndex(d => dayMap[d.dayOfWeek] === today)
                    if (di >= 0) setCurrentDayIndex(di)
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

    const weeks = plan.plan_data?.weeks || []
    const flatDays = plan.plan_data?.days || []
    const recipes = plan.plan_data?.recipes || []
    const supplements = plan.plan_data?.supplements
    const hasWeeks = weeks.length > 0
    const hasRecipes = recipes.length > 0
    const hasSupplements = !!(supplements && supplements.supplements.length > 0)

    // Если нет структурированных данных — raw markdown
    if (!hasWeeks && flatDays.length === 0) {
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

    // Текущая неделя и день
    const currentWeek = hasWeeks ? weeks[currentWeekIndex] : null
    const daysToShow = currentWeek ? currentWeek.days : flatDays
    const currentDay: NutritionDay | undefined = daysToShow[currentDayIndex]

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
                        {hasWeeks && <span className="ml-2 text-text-muted">· {weeks.length} нед. · {flatDays.length} дней</span>}
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

                    {/* Общая рекомендация */}
                    {plan.plan_data?.weeklyNote && (
                        <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex gap-2">
                            <span className="text-accent text-base flex-shrink-0">💬</span>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">Тренер: </span>
                                {plan.plan_data.weeklyNote}
                            </p>
                        </div>
                    )}
                </div>

                {/* Вкладки: План / Рецепты / Спортпит */}
                <div className="flex gap-2 mb-5 flex-wrap">
                    <button
                        onClick={() => setPageTab('plan')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                            pageTab === 'plan' ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        План питания
                    </button>
                    {hasRecipes && (
                        <button
                            onClick={() => setPageTab('recipes')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                                pageTab === 'recipes' ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                            }`}
                        >
                            <BookOpen className="w-4 h-4" />
                            Рецепты
                            <span className="text-xs opacity-70">({recipes.length})</span>
                        </button>
                    )}
                    {hasSupplements && (
                        <button
                            onClick={() => setPageTab('supplements')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                                pageTab === 'supplements' ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                            }`}
                        >
                            <Dumbbell className="w-4 h-4" />
                            Спортпит
                        </button>
                    )}
                </div>

                {/* ── Вкладка Рецепты ── */}
                {pageTab === 'recipes' && <RecipesTab recipes={recipes} />}

                {/* ── Вкладка Спортпит ── */}
                {pageTab === 'supplements' && supplements && <SupplementsTab supplements={supplements} />}

                {/* ── Вкладка План ── */}
                {pageTab === 'plan' && (
                    <>
                        {/* Навигация по неделям */}
                        {hasWeeks && weeks.length > 1 && (
                            <div className="mb-4">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Неделя</p>
                                <div className="flex gap-2 flex-wrap">
                                    {weeks.map((week, wi) => (
                                        <button
                                            key={week.weekNumber}
                                            onClick={() => { setCurrentWeekIndex(wi); setCurrentDayIndex(0) }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                wi === currentWeekIndex
                                                    ? 'bg-accent text-bg-main'
                                                    : 'bg-bg-elevated text-text-muted hover:text-white'
                                            }`}
                                        >
                                            Нед. {week.weekNumber}
                                        </button>
                                    ))}
                                </div>
                                {/* Рекомендация на неделю */}
                                {currentWeek?.weeklyNote && (
                                    <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/20 flex gap-2">
                                        <span className="text-accent flex-shrink-0">📅</span>
                                        <p className="text-sm text-text-secondary leading-relaxed">
                                            <span className="text-accent font-semibold">{currentWeek.title}: </span>
                                            {currentWeek.weeklyNote}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Кнопки дней */}
                        {daysToShow.length > 1 && (
                            <div className="flex gap-1.5 mb-4 flex-wrap">
                                {daysToShow.map((day, idx) => (
                                    <button
                                        key={day.dayNumber}
                                        onClick={() => setCurrentDayIndex(idx)}
                                        className={`flex-1 min-w-[44px] py-2 rounded-lg text-xs font-semibold transition-all ${
                                            idx === currentDayIndex
                                                ? 'bg-accent text-bg-main'
                                                : day.meals.length === 0
                                                ? 'bg-bg-elevated text-text-muted/50'
                                                : 'bg-bg-elevated text-text-muted hover:text-white'
                                        }`}
                                    >
                                        {hasWeeks ? day.dayNumber : `Д${day.dayNumber}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Навигация prev/next */}
                        {daysToShow.length > 1 && (
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
                                    <h2 className="text-lg font-display font-bold text-white">
                                        День {currentDay?.dayNumber}
                                    </h2>
                                    <p className="text-xs text-text-secondary">{currentDay?.title}</p>
                                </div>
                                <button
                                    onClick={() => setCurrentDayIndex(i => Math.min(daysToShow.length - 1, i + 1))}
                                    disabled={currentDayIndex === daysToShow.length - 1}
                                    className="glass-button-secondary flex items-center gap-1 disabled:opacity-30"
                                >
                                    <span className="hidden sm:inline text-sm">Следующий</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {currentDay && (
                            <>
                                {/* Рекомендация тренера на день */}
                                {currentDay.coachNote && (
                                    <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex gap-3 mb-4">
                                        <span className="text-accent text-lg flex-shrink-0">📋</span>
                                        <div>
                                            <p className="text-xs text-accent font-semibold mb-0.5">Рекомендация тренера</p>
                                            <p className="text-sm text-text-secondary leading-relaxed">{currentDay.coachNote}</p>
                                        </div>
                                    </div>
                                )}

                                {/* КБЖУ дня + вода */}
                                {(currentDay.totalKcal || currentDay.waterGoal) && (
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
                                )}

                                {/* Приёмы пищи */}
                                <div className="space-y-4">
                                    {currentDay.meals.map((meal, idx) => (
                                        <MealCard key={meal.id || idx} meal={meal} />
                                    ))}
                                </div>

                                {currentDay.meals.length === 0 && (
                                    <div className="glass-card p-8 text-center">
                                        <p className="text-text-muted">Приёмы пищи для этого дня ещё не заполнены</p>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
