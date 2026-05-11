'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Calendar, CheckCircle2, Clock, Lock, Loader2,
    ChevronRight, Dumbbell, TrendingUp
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getMyPrograms, getCurrentProgram, type TrainingProgram } from '@/lib/services/training'
import { getProgramEntries } from '@/lib/services/training'

export default function ProgramsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [programs, setPrograms] = useState<TrainingProgram[]>([])
    const [currentProgram, setCurrentProgram] = useState<TrainingProgram | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [completionStats, setCompletionStats] = useState<Record<string, number>>({})

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (!user) return

        const loadPrograms = async () => {
            try {
                const [allPrograms, current] = await Promise.all([
                    getMyPrograms(),
                    getCurrentProgram(),
                ])

                setPrograms(allPrograms)
                setCurrentProgram(current)

                // Загружаем статистику заполнения для каждой программы
                const stats: Record<string, number> = {}
                for (const program of allPrograms) {
                    const entries = await getProgramEntries(program.id)
                    const completedDays = entries.filter((e) => e.completed_at).length
                    const totalDays = program.program_data.days.length
                    stats[program.id] = totalDays > 0 ? (completedDays / totalDays) * 100 : 0
                }
                setCompletionStats(stats)
            } catch (e) {
                console.error('Error loading programs:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadPrograms()
    }, [user])

    const getProgramStatus = (program: TrainingProgram) => {
        const today = new Date().toISOString().split('T')[0]
        const isActive = program.start_date <= today && program.end_date >= today
        const isPast = program.end_date < today
        const isFuture = program.start_date > today
        const completion = completionStats[program.id] || 0

        if (isPast) {
            return {
                label: completion === 100 ? 'Завершено' : 'Прошедшая',
                color: completion === 100 ? 'text-success' : 'text-text-muted',
                bgColor: completion === 100 ? 'bg-success/20' : 'bg-bg-elevated',
                icon: completion === 100 ? CheckCircle2 : Clock,
            }
        }

        if (isActive) {
            return {
                label: 'Активная',
                color: 'text-accent',
                bgColor: 'bg-accent/20',
                icon: Dumbbell,
            }
        }

        if (isFuture) {
            return {
                label: 'Ожидает',
                color: 'text-text-muted',
                bgColor: 'bg-bg-elevated',
                icon: Lock,
            }
        }

        return {
            label: 'Неизвестно',
            color: 'text-text-muted',
            bgColor: 'bg-bg-elevated',
            icon: Clock,
        }
    }

    const formatDateRange = (startDate: string, endDate: string) => {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
        return `${start.toLocaleDateString('ru-RU', options)} — ${end.toLocaleDateString('ru-RU', options)}`
    }

    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-display font-bold text-white mb-2">Тренировочные программы</h1>
                    <p className="text-text-secondary">Ваши недельные программы тренировок</p>
                </div>

                {/* Current Program Highlight */}
                {currentProgram && (
                    <div className="glass-card p-6 mb-8 border-accent shadow-glow-accent-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Dumbbell className="w-5 h-5 text-accent" />
                                    <span className="text-sm font-semibold text-accent">Текущая программа</span>
                                </div>
                                <h2 className="text-2xl font-display font-bold text-white mb-1">
                                    Неделя {currentProgram.week_number}
                                </h2>
                                <p className="text-sm text-text-secondary">
                                    {formatDateRange(currentProgram.start_date, currentProgram.end_date)}
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

                        {/* Progress */}
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-text-secondary">Прогресс</span>
                                <span className="text-sm font-semibold text-accent">
                                    {Math.round(completionStats[currentProgram.id] || 0)}%
                                </span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${completionStats[currentProgram.id] || 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Programs List */}
                {programs.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Calendar className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-display font-bold text-white mb-2">Программ пока нет</h3>
                        <p className="text-text-secondary">
                            Ваш тренер скоро загрузит первую программу тренировок
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-xl font-display font-bold text-white mb-4">Все программы</h2>

                        {programs.map((program) => {
                            const status = getProgramStatus(program)
                            const StatusIcon = status.icon
                            const completion = completionStats[program.id] || 0
                            const isClickable = program.status === 'active'

                            return (
                                <div
                                    key={program.id}
                                    onClick={() => isClickable && router.push(`/programs/${program.id}`)}
                                    className={`glass-card p-6 transition-all ${
                                        isClickable
                                            ? 'cursor-pointer hover:border-accent'
                                            : 'opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xl font-display font-bold text-white">
                                                    Неделя {program.week_number}
                                                </h3>
                                                <div
                                                    className={`px-3 py-1 rounded-full ${status.bgColor} flex items-center gap-1.5`}
                                                >
                                                    <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                                                    <span className={`text-xs font-semibold ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-sm text-text-secondary mb-3">
                                                {formatDateRange(program.start_date, program.end_date)} •{' '}
                                                {program.training_days_count} тренировочных дней
                                            </p>

                                            {/* Progress bar */}
                                            {isClickable && (
                                                <div className="mt-3">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs text-text-muted">Заполнено</span>
                                                        <span className="text-xs font-semibold text-accent">
                                                            {Math.round(completion)}%
                                                        </span>
                                                    </div>
                                                    <div className="progress-bar h-1.5">
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{ width: `${completion}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {isClickable && (
                                            <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0 ml-4" />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Stats */}
                {programs.length > 0 && (
                    <div className="glass-card p-6 mt-8">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-accent" />
                            <h3 className="text-lg font-display font-bold text-white">Статистика</h3>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-display font-bold text-accent mb-1">
                                    {programs.length}
                                </div>
                                <div className="text-xs text-text-muted">Всего программ</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-display font-bold text-accent mb-1">
                                    {programs.filter((p) => completionStats[p.id] === 100).length}
                                </div>
                                <div className="text-xs text-text-muted">Завершено</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-display font-bold text-accent mb-1">
                                    {currentProgram ? Math.round(completionStats[currentProgram.id] || 0) : 0}%
                                </div>
                                <div className="text-xs text-text-muted">Текущий прогресс</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
