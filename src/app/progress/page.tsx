'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    TrendingUp, ArrowLeft, Flame, Target, Zap,
    Calendar, CheckCircle, Clock, Award, Star,
    ChevronRight, BarChart3, Activity, Trophy,
    Play, Headphones, Dumbbell, Calculator
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { courseData } from '@/lib/data/courseData'

export default function ProgressPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [taskProgress, setTaskProgress] = useState<Record<number, number[]>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [expandedDay, setExpandedDay] = useState<number | null>(null)

    useEffect(() => {
        if (authLoading) return

        const loadProgress = async () => {
            try {
                const { getUserProgress } = await import('@/lib/services/progress')
                const timeoutPromise = new Promise<Record<number, number[]>>((resolve) =>
                    setTimeout(() => resolve({}), 5000)
                )
                const progress = await Promise.race([getUserProgress(), timeoutPromise])
                setTaskProgress(progress)
            } catch (e) {
                console.error('Failed to load progress', e)
            } finally {
                setIsLoading(false)
            }
        }
        loadProgress()
    }, [authLoading])

    // Подсчёт статистики
    const totalTasks = courseData.reduce((acc, day) => acc + day.tasks.length, 0)
    const completedTasks = Object.values(taskProgress).reduce((acc, tasks) => acc + tasks.length, 0)
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const completedDaysCount = courseData.filter(day => {
        const completed = taskProgress[day.dayNumber] || []
        return completed.length === day.tasks.length
    }).length

    // Текущая серия дней подряд
    let streak = 0
    for (let i = 1; i <= 7; i++) {
        const dayData = courseData.find(d => d.dayNumber === i)
        if (!dayData) break
        const completed = taskProgress[i] || []
        if (completed.length === dayData.tasks.length) {
            streak++
        } else {
            break
        }
    }

    // Текущий день (для демо — день 1)
    const currentDay = (() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diff = Math.floor((Date.now() - today.getTime()) / (1000 * 60 * 60 * 24))
        return Math.min(Math.max(1, diff + 1), 7)
    })()

    // Достижения
    const achievements = [
        {
            id: 'first_task',
            title: 'Первый шаг',
            description: 'Выполните первое задание',
            icon: Star,
            color: 'text-yellow-400 bg-yellow-500/20',
            unlocked: completedTasks >= 1
        },
        {
            id: 'day_complete',
            title: 'Полный день',
            description: 'Выполните все задания за день',
            icon: CheckCircle,
            color: 'text-green-400 bg-green-500/20',
            unlocked: completedDaysCount >= 1
        },
        {
            id: 'streak_3',
            title: 'Три дня подряд',
            description: '3 дня без пропусков',
            icon: Flame,
            color: 'text-orange-400 bg-orange-500/20',
            unlocked: streak >= 3
        },
        {
            id: 'half_done',
            title: 'На полпути',
            description: 'Выполните 50% всех заданий',
            icon: Target,
            color: 'text-blue-400 bg-blue-500/20',
            unlocked: completionPercent >= 50
        },
        {
            id: 'week_complete',
            title: 'Финишер',
            description: 'Пройдите весь курс',
            icon: Award,
            color: 'text-purple-400 bg-purple-500/20',
            unlocked: completedDaysCount === 7
        },
        {
            id: 'perfectionist',
            title: 'Перфекционист',
            description: '100% выполнение всех заданий',
            icon: Zap,
            color: 'text-cyan-400 bg-cyan-500/20',
            unlocked: completedTasks === totalTasks
        },
    ]

    const getTaskIcon = (type: string) => {
        switch (type) {
            case 'video': return <Play className="w-3.5 h-3.5" />
            case 'audio': return <Headphones className="w-3.5 h-3.5" />
            case 'workout': return <Dumbbell className="w-3.5 h-3.5" />
            case 'tool': case 'measurement': return <Calculator className="w-3.5 h-3.5" />
            default: return <CheckCircle className="w-3.5 h-3.5" />
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-meta-orange border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="progress" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                {/* Header */}
                <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                                   flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
                            <TrendingUp className="w-5 h-5 md:w-7 md:h-7 text-meta-orange" />
                            Мой прогресс
                        </h1>
                        <p className="text-xs md:text-sm text-gray-400 mt-1">Отслеживание результатов курса</p>
                    </div>
                </div>

                {/* Big Circular Progress */}
                <div className="glass-card p-5 md:p-8 mb-6 md:mb-8">
                    <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8">
                        {/* Circular Progress */}
                        <div className="relative w-36 h-36 md:w-44 md:h-44 shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                <circle
                                    cx="60" cy="60" r="52" fill="none"
                                    stroke="url(#progressGradient)"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${completionPercent * 3.27} ${327 - completionPercent * 3.27}`}
                                    className="transition-all duration-1000 ease-out"
                                />
                                <defs>
                                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#FF6B00" />
                                        <stop offset="100%" stopColor="#FFAA00" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl md:text-4xl font-bold text-white">{completionPercent}%</span>
                                <span className="text-xs text-gray-400 mt-1">выполнено</span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="flex-1 grid grid-cols-2 gap-3 md:gap-4 w-full">
                            <div className="bg-deep-dark-200/40 rounded-2xl p-3 md:p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    </div>
                                </div>
                                <div className="text-xl md:text-2xl font-bold text-white">{completedTasks}<span className="text-gray-500 text-sm font-normal">/{totalTasks}</span></div>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">Заданий</p>
                            </div>

                            <div className="bg-deep-dark-200/40 rounded-2xl p-3 md:p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                    </div>
                                </div>
                                <div className="text-xl md:text-2xl font-bold text-white">{completedDaysCount}<span className="text-gray-500 text-sm font-normal">/7</span></div>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">Дней</p>
                            </div>

                            <div className="bg-deep-dark-200/40 rounded-2xl p-3 md:p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                        <Flame className="w-4 h-4 text-orange-400" />
                                    </div>
                                </div>
                                <div className="text-xl md:text-2xl font-bold text-white">{streak}</div>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">Серия 🔥</p>
                            </div>

                            <div className="bg-deep-dark-200/40 rounded-2xl p-3 md:p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                        <Trophy className="w-4 h-4 text-purple-400" />
                                    </div>
                                </div>
                                <div className="text-xl md:text-2xl font-bold text-white">{achievements.filter(a => a.unlocked).length}<span className="text-gray-500 text-sm font-normal">/{achievements.length}</span></div>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">Наград</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {/* Day-by-Day Breakdown — теперь с раскрывающимися заданиями */}
                    <div className="glass-card p-4 md:p-6">
                        <h2 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-meta-orange" />
                            По дням
                        </h2>

                        <div className="space-y-3">
                            {courseData.map(day => {
                                const completedIds = taskProgress[day.dayNumber] || []
                                const completed = completedIds.length
                                const total = day.tasks.length
                                const percent = total > 0 ? Math.round((completed / total) * 100) : 0
                                const isFullyDone = completed === total
                                const isExpanded = expandedDay === day.dayNumber

                                return (
                                    <div key={day.dayNumber}>
                                        <div
                                            onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                                            className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl cursor-pointer transition-all
                                                ${isFullyDone
                                                    ? 'bg-green-500/10 border border-green-500/20'
                                                    : 'bg-deep-dark-200/40 border border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0
                                                ${isFullyDone
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-deep-dark-200 text-gray-400'
                                                }`}>
                                                {isFullyDone ? <CheckCircle className="w-5 h-5" /> : day.dayNumber}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="text-sm font-medium text-white truncate">{day.title}</h3>
                                                    <span className="text-xs text-gray-400 shrink-0 ml-2">{completed}/{total}</span>
                                                </div>
                                                <div className="progress-bar h-2">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${isFullyDone ? 'bg-green-500' : 'bg-gradient-to-r from-meta-orange to-meta-orange-300'}`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <ChevronRight className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>

                                        {/* Раскрывающийся список заданий */}
                                        {isExpanded && (
                                            <div className="mt-2 ml-4 md:ml-6 space-y-1.5 animate-fade-in">
                                                {day.tasks.map(task => {
                                                    const isDone = completedIds.includes(task.id)
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className="flex items-center gap-2.5 py-2 px-3 rounded-xl text-sm"
                                                        >
                                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0
                                                                ${isDone ? 'bg-green-500 text-white' : 'border border-gray-600 text-gray-600'}`}>
                                                                {isDone && <CheckCircle className="w-3 h-3" />}
                                                            </div>
                                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0
                                                                ${isDone ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {getTaskIcon(task.type)}
                                                            </div>
                                                            <span className={`flex-1 ${isDone ? 'text-gray-400 line-through' : 'text-gray-300'}`}>
                                                                {task.text}
                                                            </span>
                                                        </div>
                                                    )
                                                })}

                                                {/* Кнопка перехода к дню */}
                                                <button
                                                    onClick={() => router.push('/dashboard')}
                                                    className="w-full mt-2 py-2 px-3 rounded-xl text-xs text-meta-orange
                                                               bg-meta-orange/10 border border-meta-orange/20
                                                               hover:bg-meta-orange/20 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    Перейти к заданиям дня {day.dayNumber}
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Achievements */}
                    <div className="glass-card p-4 md:p-6">
                        <h2 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Award className="w-5 h-5 text-meta-orange" />
                            Достижения
                            <span className="text-xs text-gray-500 ml-auto">{achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {achievements.map(ach => {
                                const Icon = ach.icon
                                return (
                                    <div
                                        key={ach.id}
                                        className={`relative p-4 rounded-2xl border transition-all ${ach.unlocked
                                            ? 'bg-deep-dark-200/60 border-white/10'
                                            : 'bg-deep-dark-200/20 border-white/5 opacity-50'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ach.unlocked ? ach.color : 'bg-gray-700/30 text-gray-600'}`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">{ach.title}</h4>
                                                <p className="text-xs text-gray-400 mt-0.5">{ach.description}</p>
                                            </div>
                                        </div>
                                        {ach.unlocked && (
                                            <div className="absolute top-3 right-3">
                                                <CheckCircle className="w-4 h-4 text-green-400" />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Motivation */}
                        <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-meta-orange/10 to-purple-500/10 border border-meta-orange/20">
                            <div className="flex items-start gap-3">
                                <Zap className="w-5 h-5 text-meta-orange shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-1">
                                        {completionPercent === 0
                                            ? 'Время начинать!'
                                            : completionPercent === 100
                                                ? '🎉 Поздравляем!'
                                                : 'Продолжайте в том же духе!'
                                        }
                                    </h4>
                                    <p className="text-xs text-gray-300">
                                        {completionPercent === 0
                                            ? 'Перейдите на Панель и выполните первое задание. Каждый маленький шаг ведёт к большому результату!'
                                            : completionPercent < 30
                                                ? 'Вы только начали путь. Каждый выполненный шаг приближает вас к цели!'
                                                : completionPercent < 70
                                                    ? 'Отличная работа! Вы преодолели половину пути. Не останавливайтесь!'
                                                    : completionPercent < 100
                                                        ? 'Невероятный результат! Финишная прямая — осталось совсем немного!'
                                                        : 'Вы прошли весь курс «Метаболический Запуск»! Вы — настоящий чемпион!'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
