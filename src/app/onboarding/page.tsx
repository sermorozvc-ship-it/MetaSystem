'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, UserPlus, Shield, Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isQuestionnaireCompleted } from '@/lib/services/questionnaire'

export default function OnboardingPage() {
    const router = useRouter()
    const { user, isLoading } = useAuth()

    // Если пользователь уже авторизован — пропускаем онбординг
    useEffect(() => {
        if (isLoading) return
        if (!user) return
        // Авторизован — проверяем анкеты
        const go = async () => {
            try {
                const done = await isQuestionnaireCompleted()
                if (!done) {
                    window.location.href = '/questionnaire'
                    return
                }
                const { isNutritionQuestionnaireRequired, isNutritionQuestionnaireCompleted } =
                    await import('@/lib/services/nutrition')
                const needsNutrition = await isNutritionQuestionnaireRequired()
                if (needsNutrition) {
                    const nutritionDone = await isNutritionQuestionnaireCompleted()
                    if (!nutritionDone) {
                        window.location.href = '/questionnaire/nutrition'
                        return
                    }
                }
                window.location.href = '/dashboard'
            } catch {
                window.location.href = '/questionnaire'
            }
        }
        go()
    }, [user, isLoading])

    return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 pointer-events-none" />

            <div className="relative max-w-md w-full text-center">
                {/* Success Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-success/20 border border-success/30 mb-6">
                    <CheckCircle2 className="w-10 h-10 text-success" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-display font-bold text-white mb-3">
                    Оплата прошла успешно!
                </h1>

                <p className="text-text-secondary text-lg mb-8">
                    Ваше место в программе забронировано. Осталось пройти быструю регистрацию.
                </p>

                {/* Info Card */}
                <div className="glass-card p-6 mb-8 text-left">
                    <h2 className="text-lg font-display font-semibold text-white mb-4">
                        Что дальше?
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <UserPlus className="w-4 h-4 text-accent" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium text-sm">Создайте аккаунт</h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    Регистрация займёт меньше минуты — нужен только email и пароль.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-info/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Zap className="w-4 h-4 text-info" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium text-sm">Заполните анкету</h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    После регистрации вы заполните короткую анкету, чтобы тренер составил программу под вас.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Shield className="w-4 h-4 text-success" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium text-sm">Получите программу</h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    Тренер создаст вашу индивидуальную программу тренировок в личном кабинете.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTA Button */}
                <button
                    onClick={() => router.push('/auth?mode=register&returnTo=/questionnaire')}
                    className="glass-button w-full flex items-center justify-center gap-2 py-4 text-lg"
                >
                    Зарегистрироваться
                    <ArrowRight className="w-5 h-5" />
                </button>

                <p className="text-xs text-text-muted mt-4">
                    Уже есть аккаунт?{' '}
                    <button
                        onClick={() => router.push('/auth?mode=login&returnTo=/questionnaire')}
                        className="text-accent hover:underline"
                    >
                        Войти
                    </button>
                </p>
            </div>
        </div>
    )
}
