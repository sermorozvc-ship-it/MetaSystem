'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    TrendingUp, ArrowLeft, Flame, Target, Zap,
    Calendar, CheckCircle, Clock, Award, Star,
    ChevronRight, BarChart3, Activity
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { courseData } from '@/lib/data/courseData'

export default function ProgressPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [taskProgress, setTaskProgress] = useState<Record<number, number[]>>({})
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadProgress = async () => {
            try {
                const { getUserProgress } = await import('@/lib/services/progress')
                const progress = await getUserProgress()
                setTaskProgress(progress)
            } catch (e) {
                console.error('Failed to load progress', e)
            } finally {
                setIsLoading(false)
            }
        }
        loadProgress()
    }, [])

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

                {/* Top Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                    <div className="glass-card p-4 md:p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-meta-orange/20 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-meta-orange" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-bold text-white">{completionPercent}%</div>
                        <p className="text-xs text-gray-400 mt-1">Общий прогресс</p>
                    </div>

                    <div className="glass-card p-4 md:p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-bold text-white">{completedTasks}<span className="text-gray-500 text-base">/{totalTasks}</span></div>
                        <p className="text-xs text-gray-400 mt-1">Заданий выполнено</p>
                    </div>

                    <div className="glass-card p-4 md:p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-bold text-white">{completedDaysCount}<span className="text-gray-500 text-base">/7</span></div>
                        <p className="text-xs text-gray-400 mt-1">Дней завершено</p>
                    </div>

                    <div className="glass-card p-4 md:p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <Flame className="w-5 h-5 text-orange-400" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-bold text-white">{streak}</div>
                        <p className="text-xs text-gray-400 mt-1">Серия дней 🔥</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {/* Day-by-Day Breakdown */}
                    <div className="glass-card p-4 md:p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-meta-orange" />
                            По дням
                        </h2>

                        <div className="space-y-3">
                            {courseData.map(day => {
                                const completed = (taskProgress[day.dayNumber] || []).length
                                const total = day.tasks.length
                                const percent = total > 0 ? Math.round((completed / total) * 100) : 0
                                const isFullyDone = completed === total

                                return (
                                    <div
                                        key={day.dayNumber}
                                        onClick={() => router.push('/dashboard')}
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

                                        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Achievements */}
                    <div className="glass-card p-4 md:p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Award className="w-5 h-5 text-meta-orange" />
                            Достижения
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
                                    <h4 className="text-sm font-semibold text-white mb-1">Продолжайте в том же духе!</h4>
                                    <p className="text-xs text-gray-300">
                                        {completionPercent < 30
                                            ? 'Вы только начали путь. Каждый выполненный шаг приближает вас к цели!'
                                            : completionPercent < 70
                                                ? 'Отличная работа! Вы преодолели половину пути. Не останавливайтесь!'
                                                : 'Невероятный результат! Финишная прямая — осталось совсем немного!'
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
