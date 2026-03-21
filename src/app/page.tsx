'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Flame, ArrowRight, Dumbbell, Brain, Utensils,
    Target, Timer, Users, ChevronRight, Zap, Shield, Star
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

export default function LandingPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    // Если уже залогинен — проверяем оплату на стороне payment page
    useEffect(() => {
        if (!isLoading && user) {
            router.replace('/payment')
        }
    }, [user, isLoading, router])

    return (
        <div className="min-h-screen bg-deep-dark overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-meta-orange/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex items-center justify-between max-w-6xl mx-auto px-6 py-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-meta-orange to-meta-orange-600 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-bold text-lg hidden sm:block">MetaSystem</span>
                </div>
                <button
                    onClick={() => router.push('/auth')}
                    className="glass-button-secondary py-2.5 px-5 text-sm"
                >
                    Войти
                </button>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 pt-12 md:pt-20 pb-16 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-meta-orange/10 border border-meta-orange/20 mb-8">
                    <Zap className="w-4 h-4 text-meta-orange" />
                    <span className="text-sm text-meta-orange font-medium">7 дней, которые изменят всё</span>
                </div>

                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                    Метаболическая<br />
                    <span className="bg-gradient-to-r from-meta-orange to-orange-400 bg-clip-text text-transparent">
                        Перезагрузка
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Научная система похудения без голодовок. Работаем с питанием,
                    гормонами и головой за <span className="text-white font-medium">одну неделю</span>.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                    <button
                        onClick={() => router.push('/auth?mode=register')}
                        className="glass-button flex items-center gap-2 py-4 px-8 text-lg w-full sm:w-auto"
                    >
                        Начать за 10 ₽
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <a href="#program" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 py-4">
                        Узнать больше
                        <ChevronRight className="w-4 h-4" />
                    </a>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>Научный подход</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Когортный формат</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        <span>20 мин/день</span>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
                <div className="grid md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={Utensils}
                        title="Питание без диет"
                        description="Не считаем калории. Учимся собирать &laquo;Тарелку&raquo; — правильное соотношение белка, жиров и углеводов."
                        color="text-green-400"
                        bgColor="bg-green-500/10"
                    />
                    <FeatureCard
                        icon={Dumbbell}
                        title="3 тренировки"
                        description="Силовая, HIIT и мобильность. Всего 15–20 минут. Никакого зала — нужен только коврик."
                        color="text-orange-400"
                        bgColor="bg-orange-500/10"
                    />
                    <FeatureCard
                        icon={Brain}
                        title="Психология"
                        description="Разбираем, почему мозг саботирует прогресс. Биохимия сна, стресса и мотивации."
                        color="text-purple-400"
                        bgColor="bg-purple-500/10"
                    />
                </div>
            </section>

            {/* Program Section */}
            <section id="program" className="relative z-10 max-w-4xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Программа курса
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto">
                        Каждый день продуман так, чтобы чередовать нагрузку
                        и не истощать нервную систему
                    </p>
                </div>

                <div className="space-y-3">
                    {[
                        { day: 'ПН', emoji: '🥗', title: 'Стратегия и Питание', color: 'border-green-500/30' },
                        { day: 'ВТ', emoji: '🔥', title: 'Силовая тренировка', color: 'border-orange-500/30' },
                        { day: 'СР', emoji: '🚶', title: 'NEAT-активность', color: 'border-blue-500/30' },
                        { day: 'ЧТ', emoji: '⚡', title: 'HIIT-тренировка', color: 'border-yellow-500/30' },
                        { day: 'ПТ', emoji: '🧘', title: 'Мобильность', color: 'border-purple-500/30' },
                        { day: 'СБ', emoji: '🧠', title: 'Психология', color: 'border-pink-500/30' },
                        { day: 'ВС', emoji: '🏆', title: 'Финал и замеры', color: 'border-emerald-500/30' },
                    ].map((item, i) => (
                        <div key={i} className={`glass-card p-4 border ${item.color} flex items-center gap-4`}>
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-gray-400">{item.day}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-3">
                                <span className="text-xl">{item.emoji}</span>
                                <span className="text-white font-medium">{item.title}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 py-16">
                <div className="glass-card p-8 md:p-12 text-center border border-meta-orange/20 bg-gradient-to-br from-meta-orange/10 to-transparent">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600 mb-6 shadow-glow-orange">
                        <Target className="w-8 h-8 text-white" />
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Готов начать?
                    </h2>
                    <p className="text-gray-400 max-w-lg mx-auto mb-8">
                        Старт каждый понедельник. Присоединяйся к когорте и начни
                        <span className="text-white"> перезагрузку метаболизма</span>.
                    </p>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={() => router.push('/auth?mode=register')}
                            className="glass-button flex items-center gap-2 py-4 px-10 text-lg"
                        >
                            Начать за 10 ₽
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            ))}
                            <span className="text-sm text-gray-400 ml-2">4.9 / 5</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-8">
                <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-meta-orange" />
                        <span className="text-sm text-gray-500">MetaSystem © 2026</span>
                    </div>
                    <p className="text-xs text-gray-600">
                        Это не медицинская программа. Консультируйтесь с врачом.
                    </p>
                </div>
            </footer>
        </div>
    )
}

function FeatureCard({ icon: Icon, title, description, color, bgColor }: {
    icon: React.ElementType
    title: string
    description: string
    color: string
    bgColor: string
}) {
    return (
        <div className="glass-card p-6 hover:border-white/20 transition-all duration-300">
            <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
    )
}
