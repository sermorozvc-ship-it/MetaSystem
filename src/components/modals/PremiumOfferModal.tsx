'use client'

import { X, Check, Rocket, Zap, Users, ShieldCheck, CreditCard, ArrowRight, Camera, BarChart3, Clock, HeartPulse } from 'lucide-react'
import { useState, useEffect } from 'react'

interface PremiumOfferModalProps {
    isOpen: boolean
    onClose: () => void
    userName: string
}

export default function PremiumOfferModal({ isOpen, onClose, userName }: PremiumOfferModalProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true)
            document.body.style.overflow = 'hidden'
        } else {
            setIsVisible(false)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
    }

    return (
        <div 
            className={`fixed inset-0 z-[200] flex items-center justify-center sm:p-4 bg-black/99 backdrop-blur-3xl transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleBackdropClick}
        >
            <div className={`relative w-full max-w-4xl max-h-[95vh] bg-deep-dark-100 sm:rounded-[2.5rem] border border-white/10 shadow-2xl overflow-y-auto custom-scrollbar transition-all duration-500 transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-10 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 active:scale-95"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Hero Section */}
                <div className="relative overflow-hidden pt-16 pb-12 px-6 sm:px-12 text-center">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-meta-orange/10 to-transparent pointer-events-none" />
                    
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-meta-orange/20 border border-meta-orange/30 text-meta-orange text-xs font-bold uppercase tracking-widest mb-8 animate-fade-in text-center mx-auto">
                        <Rocket className="w-4 h-4" />
                        Тест-драйв окончен
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                        Мы убрали воду, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-meta-orange to-orange-400">
                            пришло время Системы
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-gray-400 text-lg sm:text-xl font-medium leading-relaxed">
                        Чтобы построить тело мечты, нужна точность. <br className="hidden sm:block" />
                        Я открываю набор на <span className="text-white">премиальное сопровождение</span>.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="px-6 sm:px-12 pb-16">
                    <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                        <Zap className="text-meta-orange" />
                        Технологии, которые экономят время
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        <div className="glass-card p-6 bg-white/5 border-white/5 hover:border-meta-orange/30 transition-all group">
                            <div className="w-12 h-12 rounded-2xl bg-meta-orange/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Camera className="w-6 h-6 text-meta-orange" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Считаем по ФОТО</h3>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                Просто сфоткай еду, приложение само посчитает КБЖУ. Никакой рутины и кухонных весов.
                            </p>
                        </div>

                        <div className="glass-card p-6 bg-white/5 border-white/5 hover:border-meta-orange/30 transition-all group">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <BarChart3 className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Real-time Аналитика</h3>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                Я вижу твой прогресс в реальном времени и даю точечные правки. Мы не гадаем, мы управляем цифрами.
                            </p>
                        </div>

                        <div className="glass-card p-6 bg-white/5 border-white/5 hover:border-meta-orange/30 transition-all group">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Clock className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Максимум Скорости</h3>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                Заполнение отчетов занимает 3-5 минут в день. Система работает на тебя, а не наоборот.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Team Section */}
                <div className="px-6 sm:px-12 py-16 bg-white/5">
                    <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                        <Users className="text-meta-orange" />
                        Команда поддержки 24/7
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-meta-orange/10 flex items-center justify-center shrink-0 border border-meta-orange/20">
                                <HeartPulse className="w-8 h-8 text-meta-orange" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg mb-1">Профессиональный Врач</h4>
                                <p className="text-gray-400 text-sm leading-relaxed text-balance">
                                    Глубокий разбор ваших анализов, гормонального профиля и состояния здоровья для безопасного результата.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                <ShieldCheck className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg mb-1">Твой Наставник (Дмитрий)</h4>
                                <p className="text-gray-400 text-sm leading-relaxed text-balance">
                                    Ручная стратегия, диагностика осанки, видео-разборы тренировок и личная связь в мессенджерах.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="px-6 sm:px-12 py-16">
                    <h2 className="text-2xl font-bold text-white mb-10 text-center">Выбери свой масштаб:</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-8">
                        {/* Sprint Tariff */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition" />
                            <div className="relative glass-card p-8 bg-deep-dark-200 border-white/5 flex flex-col h-full">
                                <div className="mb-6">
                                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">ТАРИФ «СПРИНТ»</h3>
                                    <div className="text-blue-400 font-bold text-sm uppercase tracking-wider">2 месяца • Быстрый старт</div>
                                </div>
                                <div className="space-y-4 mb-8 flex-grow">
                                    <div className="flex items-center gap-3 text-gray-300 font-medium">
                                        <Check className="w-5 h-5 text-blue-400 shrink-0" />
                                        <span>Цель: Минус 5–8 кг + Здоровье</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-300 font-medium">
                                        <Check className="w-5 h-5 text-blue-400 shrink-0" />
                                        <span>Идеально для быстрой формы</span>
                                    </div>
                                </div>
                                <div className="mt-auto">
                                    <div className="text-3xl font-black text-white mb-1">42 000₽</div>
                                    <div className="text-xs text-gray-400 font-bold mb-6">Рассрочка без %: от 3 500₽/мес</div>
                                    <button className="w-full py-4 rounded-xl bg-white text-black font-black hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                                        ВЫБРАТЬ СПРИНТ
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Transformation Tariff */}
                        <div className="relative group sm:scale-105 z-10">
                            <div className="absolute -inset-1 bg-gradient-to-r from-meta-orange to-orange-600 rounded-[2.5rem] blur opacity-50 group-hover:opacity-75 transition" />
                            <div className="relative glass-card p-8 bg-deep-dark-200 border-meta-orange/20 flex flex-col h-full">
                                <div className="absolute top-4 right-8 bg-meta-orange text-white text-[10px] font-black py-1 px-3 rounded-full">ХИТ 🔥</div>
                                <div className="mb-6">
                                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">ТАРИФ «ТРАНСФОРМАЦИЯ»</h3>
                                    <div className="text-meta-orange font-bold text-sm uppercase tracking-wider">4 месяца • Полная перестройка</div>
                                </div>
                                <div className="space-y-4 mb-8 flex-grow">
                                    <div className="flex items-center gap-3 text-gray-300 font-medium">
                                        <Check className="w-5 h-5 text-meta-orange shrink-0" />
                                        <span>Цель: Минус 10–20 кг + Закрепление</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-300 font-medium">
                                        <Check className="w-5 h-5 text-meta-orange shrink-0" />
                                        <span>Фиксация веса навсегда</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-300 font-medium">
                                        <Check className="w-5 h-5 text-meta-orange shrink-0" />
                                        <span>Полная перестройка организма</span>
                                    </div>
                                </div>
                                <div className="mt-auto">
                                    <div className="text-3xl font-black text-white mb-1">72 000₽</div>
                                    <div className="text-xs text-gray-400 font-bold mb-6">Рассрочка без %: от 6 000₽/мес</div>
                                    <button className="w-full py-4 rounded-xl bg-meta-orange text-white font-black hover:bg-meta-orange/90 shadow-glow-orange-sm transition-all flex items-center justify-center gap-2">
                                        ВЫБРАТЬ ТРАНСФОРМАЦИЮ
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="px-6 sm:px-12 py-12 bg-white/5 border-t border-white/10 text-center">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
                        <div className="flex items-center gap-2 text-gray-400">
                            <CreditCard className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-widest leading-loose">Оплата: Картой РФ / Зарубежной / Рассрочка 0% (первый платеж через 30 дней)</span>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[10px] uppercase font-black tracking-[0.2em] opacity-50">
                        Заряди свою метаболическую систему на максимум
                    </p>
                </div>
            </div>
        </div>
    )
}
