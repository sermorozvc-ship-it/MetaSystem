'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Apple, ChevronRight, Loader2, Zap, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getMyNutritionPrograms, type NutritionProgram } from '@/lib/services/nutrition-programs'
import { useFailsafe } from '@/lib/hooks/useFailsafe'

export default function NutritionPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [plans, setPlans] = useState<NutritionProgram[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!authLoading && !user) router.replace('/auth')
    }, [user, authLoading, router])

    useEffect(() => {
        if (authLoading) return
        if (!user) return
        getMyNutritionPrograms()
            .then(setPlans)
            .catch(console.error)
            .finally(() => setIsLoading(false))
    }, [user, authLoading])

    // Аварийный таймер от вечного лоадера на десктопе
    useFailsafe(isLoading, () => setIsLoading(false), 8_000, 'nutrition')

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    const activePlan = plans.find(p => p.status === 'active')

    return (
        <div className="min-h-screen bg-bg-main p-4 py-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-display font-bold text-white mb-1">Планы питания</h1>
                    <p className="text-text-secondary text-sm">Ваши индивидуальные планы от тренера</p>
                </div>

                {plans.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Apple className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-display font-bold text-white mb-2">Планов питания пока нет</h3>
                        <p className="text-text-secondary">Тренер скоро загрузит ваш первый план питания</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activePlan && (
                            <button
                                onClick={() => router.push(`/nutrition/${activePlan.id}`)}
                                className="w-full glass-card p-6 text-left border-accent shadow-glow-accent-sm hover:bg-white/5 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-accent" />
                                        <span className="text-sm font-semibold text-accent">Текущий план</span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-accent" />
                                </div>
                                <h2 className="text-xl font-display font-bold text-white mb-1">
                                    {activePlan.title || `План питания №${activePlan.plan_number}`}
                                </h2>
                                <p className="text-sm text-text-secondary mb-3">
                                    {new Date(activePlan.start_date).toLocaleDateString('ru-RU')} —{' '}
                                    {new Date(activePlan.end_date).toLocaleDateString('ru-RU')}
                                </p>
                                {activePlan.plan_data?.dailyKcal && (
                                    <div className="flex gap-4 text-xs">
                                        <span className="text-accent font-semibold">{activePlan.plan_data.dailyKcal} ккал</span>
                                        {activePlan.plan_data.dailyProtein && <span className="text-text-secondary">Б: {activePlan.plan_data.dailyProtein}г</span>}
                                        {activePlan.plan_data.dailyFat && <span className="text-text-secondary">Ж: {activePlan.plan_data.dailyFat}г</span>}
                                        {activePlan.plan_data.dailyCarbs && <span className="text-text-secondary">У: {activePlan.plan_data.dailyCarbs}г</span>}
                                    </div>
                                )}
                            </button>
                        )}

                        {plans.filter(p => p.status !== 'active').map(plan => (
                            <button
                                key={plan.id}
                                onClick={() => router.push(`/nutrition/${plan.id}`)}
                                className="w-full glass-card p-5 text-left hover:border-accent/40 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-display font-bold text-white">
                                                {plan.title || `План питания №${plan.plan_number}`}
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-bg-elevated text-text-muted">
                                                {plan.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-secondary flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(plan.start_date).toLocaleDateString('ru-RU')} —{' '}
                                            {new Date(plan.end_date).toLocaleDateString('ru-RU')}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-text-muted" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
