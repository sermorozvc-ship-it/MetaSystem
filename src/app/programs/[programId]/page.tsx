'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Dumbbell, Play, CheckCircle2, Loader2,
    ChevronLeft, ChevronRight, Save, ExternalLink, Smile
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    getProgramById,
    getTrainingEntry,
    upsertTrainingEntry,
    completeTrainingDay,
    type TrainingProgram,
    type TrainingDay,
    type Exercise,
} from '@/lib/services/training'

export default function ProgramDetailPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const params = useParams()
    const programId = params.programId as string

    const [program, setProgram] = useState<TrainingProgram | null>(null)
    const [currentDayIndex, setCurrentDayIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState('')

    // Form state for current day
    const [exerciseData, setExerciseData] = useState<Record<string, any>>({})
    const [energyLevel, setEnergyLevel] = useState<number>(5)
    const [mood, setMood] = useState<number>(3)
    const [sleepQuality, setSleepQuality] = useState<number>(3)
    const [notes, setNotes] = useState('')
    const [isCompleted, setIsCompleted] = useState(false)

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    // Load program
    useEffect(() => {
        if (!user || !programId) return

        const loadProgram = async () => {
            try {
                const data = await getProgramById(programId)
                if (!data) {
                    router.replace('/programs')
                    return
                }
                setProgram(data)
            } catch (e) {
                console.error('Error loading program:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadProgram()
    }, [user, programId, router])

    // Load entry data for current day
    useEffect(() => {
        if (!program || !user) return

        const loadEntry = async () => {
            const currentDay = program.program_data.days[currentDayIndex]
            if (!currentDay) return

            try {
                const entry = await getTrainingEntry(program.id, currentDay.dayNumber)
                if (entry) {
                    setExerciseData(entry.entry_data || {})
                    setEnergyLevel(entry.energy_level || 5)
                    setMood(entry.mood || 3)
                    setSleepQuality(entry.sleep_quality || 3)
                    setNotes(entry.notes || '')
                    setIsCompleted(!!entry.completed_at)
                } else {
                    // Reset form
                    setExerciseData({})
                    setEnergyLevel(5)
                    setMood(3)
                    setSleepQuality(3)
                    setNotes('')
                    setIsCompleted(false)
                }
            } catch (e) {
                console.error('Error loading entry:', e)
            }
        }

        loadEntry()
    }, [program, currentDayIndex, user])

    // Auto-save with debounce
    const saveEntry = useCallback(async () => {
        if (!program || !user) return

        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return

        setIsSaving(true)
        try {
            await upsertTrainingEntry(program.id, currentDay.dayNumber, exerciseData, {
                energy_level: energyLevel,
                mood,
                sleep_quality: sleepQuality,
                notes,
            })
            setSaveMessage('✓ Сохранено')
            setTimeout(() => setSaveMessage(''), 2000)
        } catch (e) {
            console.error('Error saving entry:', e)
            setSaveMessage('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }, [program, currentDayIndex, exerciseData, energyLevel, mood, sleepQuality, notes, user])

    // Debounced auto-save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (Object.keys(exerciseData).length > 0) {
                saveEntry()
            }
        }, 1000)

        return () => clearTimeout(timer)
    }, [exerciseData, energyLevel, mood, sleepQuality, notes, saveEntry])

    const updateExerciseField = (exerciseId: string, field: string, value: any) => {
        setExerciseData((prev) => ({
            ...prev,
            [exerciseId]: {
                ...prev[exerciseId],
                [field]: value,
            },
        }))
    }

    const handleCompleteDay = async () => {
        if (!program) return

        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return

        try {
            await saveEntry()
            await completeTrainingDay(program.id, currentDay.dayNumber)
            setIsCompleted(true)
            setSaveMessage('✓ Тренировка завершена!')
        } catch (e) {
            console.error('Error completing day:', e)
        }
    }

    const handlePrevDay = () => {
        if (currentDayIndex > 0) {
            setCurrentDayIndex(currentDayIndex - 1)
        }
    }

    const handleNextDay = () => {
        if (program && currentDayIndex < program.program_data.days.length - 1) {
            setCurrentDayIndex(currentDayIndex + 1)
        }
    }

    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (isLoading || !program) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    const currentDay = program.program_data.days[currentDayIndex]
    if (!currentDay) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <p className="text-text-secondary">День не найден</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => router.push('/programs')}
                        className="glass-button-secondary flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Назад
                    </button>

                    {saveMessage && (
                        <div className="text-sm text-accent font-medium animate-fade-in">{saveMessage}</div>
                    )}
                </div>

                {/* Program Info */}
                <div className="glass-card p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-display font-bold text-white mb-1">
                                Неделя {program.week_number}
                            </h1>
                            <p className="text-sm text-text-secondary">
                                {new Date(program.start_date).toLocaleDateString('ru-RU')} —{' '}
                                {new Date(program.end_date).toLocaleDateString('ru-RU')}
                            </p>
                        </div>
                        {isCompleted && (
                            <div className="px-4 py-2 rounded-full bg-success/20 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-success" />
                                <span className="text-sm font-semibold text-success">Завершено</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Day Navigation */}
                <div className="flex items-center justify-between mb-6 gap-2">
                    <button
                        onClick={handlePrevDay}
                        disabled={currentDayIndex === 0}
                        className="glass-button-secondary flex items-center gap-1 md:gap-2 disabled:opacity-30 flex-shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Предыдущий</span>
                    </button>

                    <div className="text-center flex-1 min-w-0">
                        <h2 className="text-lg md:text-xl font-display font-bold text-white truncate">День {currentDay.dayNumber}</h2>
                        <p className="text-xs md:text-sm text-text-secondary truncate">{currentDay.title}</p>
                    </div>

                    <button
                        onClick={handleNextDay}
                        disabled={currentDayIndex === program.program_data.days.length - 1}
                        className="glass-button-secondary flex items-center gap-1 md:gap-2 disabled:opacity-30 flex-shrink-0"
                    >
                        <span className="hidden sm:inline">Следующий</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Exercises */}
                <div className="space-y-4 mb-6">
                    {currentDay.exercises.map((exercise, index) => {
                        const data = exerciseData[exercise.id] || {}

                        return (
                            <div key={exercise.id} className="glass-card p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                                                {index + 1}
                                            </span>
                                            <h3 className="text-lg font-display font-bold text-white">
                                                {exercise.name}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-text-secondary">
                                            План: {exercise.sets} x {exercise.reps}
                                            {exercise.targetWeight && ` • ${exercise.targetWeight} кг`}
                                        </p>
                                    </div>
                                    {exercise.videoUrl && (
                                        <a
                                            href={exercise.videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="glass-button-secondary flex items-center gap-2 text-sm"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                            Видео
                                        </a>
                                    )}
                                </div>

                                {/* Input fields */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                                    <div>
                                        <label className="block text-xs text-text-muted mb-2">Вес (кг)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={data.actualWeight || ''}
                                            onChange={(e) =>
                                                updateExerciseField(exercise.id, 'actualWeight', e.target.value)
                                            }
                                            className="glass-input w-full text-sm"
                                            placeholder="20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-text-muted mb-2">Повторения</label>
                                        <input
                                            type="number"
                                            value={data.actualReps || ''}
                                            onChange={(e) =>
                                                updateExerciseField(exercise.id, 'actualReps', e.target.value)
                                            }
                                            className="glass-input w-full text-sm"
                                            placeholder="12"
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs text-text-muted mb-2">RPE (1-10)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={data.rpe || ''}
                                            onChange={(e) => updateExerciseField(exercise.id, 'rpe', e.target.value)}
                                            className="glass-input w-full text-sm"
                                            placeholder="7"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-xs text-text-muted mb-2">Комментарий</label>
                                    <input
                                        type="text"
                                        value={data.comment || ''}
                                        onChange={(e) => updateExerciseField(exercise.id, 'comment', e.target.value)}
                                        className="glass-input w-full text-sm"
                                        placeholder="Ощущения, сложности..."
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Cardio */}
                {currentDay.cardio && (
                    <div className="glass-card p-6 mb-6">
                        <h3 className="text-lg font-display font-bold text-white mb-2">Кардио</h3>
                        <p className="text-text-secondary">{currentDay.cardio}</p>
                    </div>
                )}

                {/* Wellbeing */}
                <div className="glass-card p-6 mb-6">
                    <h3 className="text-lg font-display font-bold text-white mb-4">Самочувствие</h3>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm text-text-secondary">Энергия</label>
                                <span className="text-accent font-bold">{energyLevel}/10</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={energyLevel}
                                onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm text-text-secondary">Настроение</label>
                                <span className="text-accent font-bold">{mood}/5</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={mood}
                                onChange={(e) => setMood(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm text-text-secondary">Качество сна</label>
                                <span className="text-accent font-bold">{sleepQuality}/5</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={sleepQuality}
                                onChange={(e) => setSleepQuality(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-2">Заметки</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="glass-input w-full h-24 resize-none"
                                placeholder="Как прошла тренировка, что чувствовали..."
                            />
                        </div>
                    </div>
                </div>

                {/* Complete Button */}
                {!isCompleted && (
                    <button
                        onClick={handleCompleteDay}
                        disabled={isSaving}
                        className="glass-button w-full flex items-center justify-center gap-2 py-4"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                Завершить тренировку
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    )
}
