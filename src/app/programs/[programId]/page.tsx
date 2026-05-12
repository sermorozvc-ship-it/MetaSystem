'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Play, CheckCircle2, Loader2, ChevronLeft, ChevronRight, X, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    getProgramById,
    getTrainingEntry,
    upsertTrainingEntry,
    completeTrainingDay,
    type TrainingProgram,
    type Exercise,
} from '@/lib/services/training'

// ─── Типы данных клиента ─────────────────────────────────────────────────────

interface SetData {
    weight: string
    reps: string
    rir: string
}

interface ExerciseClientData {
    sets: SetData[]
    comment: string
}

// ─── YouTube embed URL ───────────────────────────────────────────────────────

function getYouTubeEmbedUrl(url: string): string | null {
    try {
        // Форматы: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
        const patterns = [
            /youtu\.be\/([^?&]+)/,
            /youtube\.com\/watch\?v=([^&]+)/,
            /youtube\.com\/embed\/([^?&]+)/,
        ]
        for (const p of patterns) {
            const m = url.match(p)
            if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`
        }
        return null
    } catch {
        return null
    }
}

// ─── Видео модал ─────────────────────────────────────────────────────────────

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
    const [large, setLarge] = useState(false)
    const embedUrl = getYouTubeEmbedUrl(url)

    // Закрытие по Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    if (!embedUrl) {
        // Не YouTube — открываем в новой вкладке
        window.open(url, '_blank')
        onClose()
        return null
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={onClose}>
            {/* Затемнение */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Окно */}
            <div
                className={`relative z-10 glass-card overflow-hidden transition-all duration-300 w-full ${
                    large ? 'max-w-4xl' : 'max-w-lg'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Шапка */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-white truncate pr-4">{title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => setLarge(v => !v)}
                            className="glass-button-secondary p-1.5 rounded-lg"
                            title={large ? 'Уменьшить' : 'Увеличить'}
                        >
                            {large
                                ? <Minimize2 className="w-4 h-4" />
                                : <Maximize2 className="w-4 h-4" />
                            }
                        </button>
                        <button onClick={onClose} className="glass-button-secondary p-1.5 rounded-lg" title="Закрыть">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Видео 16:9 */}
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={title}
                    />
                </div>
            </div>
        </div>
    )
}

// ─── Компонент одного упражнения ─────────────────────────────────────────────

function ExerciseCard({
    exercise,
    index,
    data,
    onChange,
    onVideoClick,
    collapsed,
    onToggleCollapse,
}: {
    exercise: Exercise
    index: number
    data: ExerciseClientData
    onChange: (d: ExerciseClientData) => void
    onVideoClick: (url: string, title: string) => void
    collapsed: boolean
    onToggleCollapse: () => void
}) {
    const plannedSets = exercise.sets || 3
    const targetWeights = exercise.targetWeights || Array(plannedSets).fill(0)

    // Реальное количество подходов = max(плановые, введённые клиентом)
    const totalSets = Math.max(plannedSets, data.sets.length)

    // Считаем сколько подходов заполнено (для индикатора в свёрнутом виде)
    const filledSets = data.sets.filter(s => s.weight || s.reps).length

    const updateSet = (setIdx: number, field: keyof SetData, value: string) => {
        const newSets = [...data.sets]
        while (newSets.length <= setIdx) newSets.push({ weight: '', reps: '', rir: '' })
        newSets[setIdx] = { ...newSets[setIdx], [field]: value }
        onChange({ ...data, sets: newSets })
    }

    const addSet = () => {
        const newSets = [...data.sets]
        while (newSets.length < totalSets) newSets.push({ weight: '', reps: '', rir: '' })
        newSets.push({ weight: '', reps: '', rir: '' })
        onChange({ ...data, sets: newSets })
    }

    const removeExtraSet = (setIdx: number) => {
        if (setIdx < plannedSets) return
        const newSets = data.sets.filter((_, i) => i !== setIdx)
        onChange({ ...data, sets: newSets })
    }

    return (
        <div className={`glass-card overflow-hidden transition-all duration-200 ${collapsed ? 'opacity-70' : ''}`}>
            {/* Заголовок — всегда виден, клик сворачивает/разворачивает */}
            <div
                className="flex items-center justify-between p-5 cursor-pointer select-none"
                onClick={onToggleCollapse}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
                        collapsed && filledSets > 0 ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'
                    }`}>
                        {collapsed && filledSets > 0 ? '✓' : index + 1}
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-base font-display font-bold text-white leading-tight truncate">{exercise.name}</h3>
                        <p className="text-xs text-text-secondary">
                            {plannedSets} x {exercise.reps}
                            {targetWeights.some((w: number) => w > 0) && (
                                <span className="text-accent ml-1">
                                    • {targetWeights.map((w: number) => w > 0 ? `${w}` : '—').join('/')} кг
                                </span>
                            )}
                            {collapsed && filledSets > 0 && (
                                <span className="text-success ml-2">· {filledSets}/{totalSets} подх. заполнено</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {exercise.videoUrl && !collapsed && (
                        <button
                            onClick={e => { e.stopPropagation(); onVideoClick(exercise.videoUrl!, exercise.name) }}
                            className="glass-button-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                            <Play className="w-3 h-3" />Видео
                        </button>
                    )}
                    <button className="glass-button-secondary p-1.5 rounded-lg" title={collapsed ? 'Развернуть' : 'Свернуть'}>
                        {collapsed
                            ? <ChevronDown className="w-4 h-4 text-text-muted" />
                            : <ChevronUp className="w-4 h-4 text-text-muted" />
                        }
                    </button>
                </div>
            </div>

            {/* Тело — скрывается при свёртывании */}
            {!collapsed && (
                <div className="px-5 pb-5">
                    {/* Таблица подходов */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-4 gap-2 text-xs text-text-muted px-1">
                            <div>Подход</div>
                            <div>Вес (кг)</div>
                            <div>Повт.</div>
                            <div>RIR</div>
                        </div>

                        {Array.from({ length: totalSets }).map((_, setIdx) => {
                            const setData = data.sets[setIdx] || { weight: '', reps: '', rir: '' }
                            const plannedWeight = targetWeights[setIdx] ?? 0
                            const isExtra = setIdx >= plannedSets

                            return (
                                <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            <span className={`text-sm font-semibold ${isExtra ? 'text-accent' : 'text-white'}`}>
                                                {setIdx + 1}
                                                {isExtra && <span className="text-xs ml-0.5">+</span>}
                                            </span>
                                            {isExtra && (
                                                <button onClick={() => removeExtraSet(setIdx)}
                                                    className="text-text-muted hover:text-danger text-xs ml-1 leading-none">✕</button>
                                            )}
                                        </div>
                                        {plannedWeight > 0 && (
                                            <span className="text-xs text-text-muted">{plannedWeight} кг</span>
                                        )}
                                    </div>
                                    <input type="number" step="0.5" value={setData.weight}
                                        onChange={e => updateSet(setIdx, 'weight', e.target.value)}
                                        className="glass-input text-sm py-2 px-3 text-center"
                                        placeholder={plannedWeight > 0 ? String(plannedWeight) : '—'} />
                                    <input type="number" value={setData.reps}
                                        onChange={e => updateSet(setIdx, 'reps', e.target.value)}
                                        className="glass-input text-sm py-2 px-3 text-center"
                                        placeholder={exercise.reps.split('-')[0] || '—'} />
                                    <input type="number" min="0" max="5" value={setData.rir}
                                        onChange={e => updateSet(setIdx, 'rir', e.target.value)}
                                        className="glass-input text-sm py-2 px-3 text-center"
                                        placeholder="2" />
                                </div>
                            )
                        })}

                        <button onClick={addSet}
                            className="w-full mt-1 py-2 rounded-xl border border-dashed border-border text-xs text-text-muted hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5">
                            <span className="text-base leading-none">+</span> Добавить подход
                        </button>
                    </div>

                    {/* Комментарий */}
                    <div className="mt-3">
                        <input type="text" value={data.comment}
                            onChange={e => onChange({ ...data, comment: e.target.value })}
                            className="glass-input w-full text-sm"
                            placeholder="Комментарий к упражнению..." />
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Главная страница ─────────────────────────────────────────────────────────

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

    // exerciseData[exerciseId] = ExerciseClientData
    const [exerciseData, setExerciseData] = useState<Record<string, ExerciseClientData>>({})
    const [energyLevel, setEnergyLevel] = useState(5)
    const [mood, setMood] = useState(3)
    const [sleepQuality, setSleepQuality] = useState(3)
    const [notes, setNotes] = useState('')
    const [completedDays, setCompletedDays] = useState<Set<number>>(new Set())
    const [videoModal, setVideoModal] = useState<{ url: string; title: string } | null>(null)
    const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set())

    // Сворачиваем все упражнения при смене дня
    useEffect(() => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        setCollapsedExercises(new Set(currentDay.exercises.map(e => e.id)))
    }, [program, currentDayIndex])

    const dataLoadedRef = useRef(false)
    const userChangedRef = useRef(false)

    useEffect(() => {
        if (!authLoading && !user) window.location.href = '/auth'
    }, [user, authLoading])

    // Загрузка программы
    useEffect(() => {
        if (!user || !programId) return
        const load = async () => {
            try {
                const data = await getProgramById(programId)
                if (!data) { router.replace('/programs'); return }
                setProgram(data)
            } catch (e) {
                console.error('Error loading program:', e)
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [user, programId, router])

    // Загрузка записи текущего дня
    useEffect(() => {
        if (!program || !user) return
        dataLoadedRef.current = false
        userChangedRef.current = false

        const loadEntry = async () => {
            const currentDay = program.program_data.days[currentDayIndex]
            if (!currentDay) return
            try {
                const entry = await getTrainingEntry(program.id, currentDay.dayNumber)
                if (entry) {
                    // Конвертируем старый формат в новый если нужно
                    const converted: Record<string, ExerciseClientData> = {}
                    for (const ex of currentDay.exercises) {
                        const raw = entry.entry_data?.[ex.id]
                        if (!raw) {
                            converted[ex.id] = { sets: [], comment: '' }
                        } else if (raw.sets && Array.isArray(raw.sets)) {
                            // Новый формат
                            converted[ex.id] = { sets: raw.sets, comment: raw.comment || '' }
                        } else {
                            // Старый формат — конвертируем в новый
                            const legacySets: SetData[] = Array.from({ length: ex.sets }, () => ({
                                weight: raw.actualWeight ? String(raw.actualWeight) : '',
                                reps: raw.actualReps ? String(raw.actualReps) : '',
                                rir: raw.rpe ? String(raw.rpe) : '',
                            }))
                            converted[ex.id] = { sets: legacySets, comment: raw.comment || '' }
                        }
                    }
                    setExerciseData(converted)
                    setEnergyLevel(entry.energy_level || 5)
                    setMood(entry.mood || 3)
                    setSleepQuality(entry.sleep_quality || 3)
                    setNotes(entry.notes || '')
                    if (entry.completed_at) {
                        setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
                    }
                } else {
                    setExerciseData({})
                    setEnergyLevel(5)
                    setMood(3)
                    setSleepQuality(3)
                    setNotes('')
                }
            } catch (e) {
                console.error('Error loading entry:', e)
            } finally {
                dataLoadedRef.current = true
            }
        }
        loadEntry()
    }, [program, currentDayIndex, user])

    // Сохранение
    const saveEntry = useCallback(async (silent = false) => {
        if (!program || !user) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return

        if (!silent) setIsSaving(true)
        try {
            await upsertTrainingEntry(program.id, currentDay.dayNumber, exerciseData, {
                energy_level: energyLevel,
                mood,
                sleep_quality: sleepQuality,
                notes,
            })
            if (!silent) {
                setSaveMessage('✓ Сохранено')
                setTimeout(() => setSaveMessage(''), 2000)
            }
        } catch (e) {
            console.error('Error saving:', e)
            if (!silent) setSaveMessage('Ошибка сохранения')
        } finally {
            if (!silent) setIsSaving(false)
        }
    }, [program, currentDayIndex, exerciseData, energyLevel, mood, sleepQuality, notes, user])

    // Автосейв
    useEffect(() => {
        if (!dataLoadedRef.current || !userChangedRef.current) return
        const t = setTimeout(() => saveEntry(true), 1500)
        return () => clearTimeout(t)
    }, [exerciseData, energyLevel, mood, sleepQuality, notes, saveEntry])

    const updateExercise = (exerciseId: string, data: ExerciseClientData) => {
        userChangedRef.current = true
        setExerciseData(prev => ({ ...prev, [exerciseId]: data }))
    }

    const handleCompleteDay = async () => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        setIsSaving(true)
        try {
            await upsertTrainingEntry(program.id, currentDay.dayNumber, exerciseData, {
                energy_level: energyLevel, mood, sleep_quality: sleepQuality, notes,
            })
            await completeTrainingDay(program.id, currentDay.dayNumber)
            setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
            setSaveMessage('✓ Тренировка завершена!')
            setTimeout(() => setSaveMessage(''), 3000)
        } catch (e) {
            console.error('Error completing:', e)
            setSaveMessage('Ошибка')
        } finally {
            setIsSaving(false)
        }
    }

    if (authLoading || isLoading || !program) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (!program.program_data?.days || program.program_data.days.length === 0) {
        return (
            <div className="min-h-screen bg-bg-main p-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => router.push('/programs')} className="glass-button-secondary flex items-center gap-2 mb-6">
                        <ArrowLeft className="w-4 h-4" />Назад
                    </button>
                    <div className="glass-card p-6 mb-4">
                        <h1 className="text-2xl font-display font-bold text-white">Неделя {program.week_number}</h1>
                        <p className="text-sm text-text-secondary mt-1">
                            {new Date(program.start_date).toLocaleDateString('ru-RU')} — {new Date(program.end_date).toLocaleDateString('ru-RU')}
                        </p>
                    </div>
                    <div className="glass-card p-6">
                        <pre className="whitespace-pre-wrap text-sm text-text-secondary font-body leading-relaxed">{program.program_md}</pre>
                    </div>
                </div>
            </div>
        )
    }

    const currentDay = program.program_data.days[currentDayIndex]
    if (!currentDay) return null

    const isCurrentDayCompleted = completedDays.has(currentDay.dayNumber)
    const allDaysCompleted = program.program_data.days.every(d => completedDays.has(d.dayNumber))

    return (
        <>
        <div className="min-h-screen bg-bg-main p-4 py-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <button onClick={() => router.push('/programs')} className="glass-button-secondary flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />Назад
                    </button>
                    {saveMessage && <div className="text-sm text-accent font-medium">{saveMessage}</div>}
                </div>

                {/* Инфо о программе + прогресс */}
                <div className="glass-card p-5 mb-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h1 className="text-xl font-display font-bold text-white">Неделя {program.week_number}</h1>
                            <p className="text-xs text-text-secondary mt-0.5">
                                {new Date(program.start_date).toLocaleDateString('ru-RU')} — {new Date(program.end_date).toLocaleDateString('ru-RU')}
                            </p>
                        </div>
                        {allDaysCompleted && (
                            <div className="flex items-center gap-1.5 text-success text-sm font-semibold">
                                <CheckCircle2 className="w-4 h-4" />Неделя завершена
                            </div>
                        )}
                    </div>

                    {/* Рекомендация тренера на неделю */}
                    {program.program_data.weeklyNote && (
                        <div className="mb-3 p-3 rounded-xl bg-accent/10 border border-accent/20 flex gap-2">
                            <span className="text-accent text-base flex-shrink-0">💬</span>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">Тренер: </span>
                                {program.program_data.weeklyNote}
                            </p>
                        </div>
                    )}

                    {/* Кнопки дней */}
                    <div className="flex gap-2">
                        {program.program_data.days.map((day, idx) => (
                            <button key={day.dayNumber} onClick={() => setCurrentDayIndex(idx)}
                                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                                    idx === currentDayIndex
                                        ? 'bg-accent text-bg-main'
                                        : completedDays.has(day.dayNumber)
                                        ? 'bg-success/20 text-success border border-success/30'
                                        : 'bg-bg-elevated text-text-muted'
                                }`}>
                                {completedDays.has(day.dayNumber) ? '✓ ' : ''}День {day.dayNumber}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Навигация по дням */}
                <div className="flex items-center justify-between mb-5 gap-2">
                    <button onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))}
                        disabled={currentDayIndex === 0}
                        className="glass-button-secondary flex items-center gap-1 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm">Предыдущий</span>
                    </button>
                    <div className="text-center">
                        <h2 className="text-lg font-display font-bold text-white">
                            День {currentDay.dayNumber}
                            {isCurrentDayCompleted && <span className="text-success ml-2 text-base">✓</span>}
                        </h2>
                        <p className="text-xs text-text-secondary">{currentDay.title}</p>
                    </div>
                    <button onClick={() => setCurrentDayIndex(i => Math.min(program.program_data.days.length - 1, i + 1))}
                        disabled={currentDayIndex === program.program_data.days.length - 1}
                        className="glass-button-secondary flex items-center gap-1 disabled:opacity-30">
                        <span className="hidden sm:inline text-sm">Следующий</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Упражнения */}
                <div className="space-y-4 mb-5">
                    {/* Рекомендация тренера на день */}
                    {currentDay.coachNote && (
                        <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex gap-3">
                            <span className="text-accent text-lg flex-shrink-0">📋</span>
                            <div>
                                <p className="text-xs text-accent font-semibold mb-0.5">Рекомендация тренера на сегодня</p>
                                <p className="text-sm text-text-secondary leading-relaxed">{currentDay.coachNote}</p>
                            </div>
                        </div>
                    )}

                    {/* Кнопка свернуть/развернуть все */}
                    {currentDay.exercises.length > 1 && (
                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    const allIds = currentDay.exercises.map(e => e.id)
                                    const allCollapsed = allIds.every(id => collapsedExercises.has(id))
                                    if (allCollapsed) {
                                        setCollapsedExercises(new Set())
                                    } else {
                                        setCollapsedExercises(new Set(allIds))
                                    }
                                }}
                                className="glass-button-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                            >
                                {currentDay.exercises.every(e => collapsedExercises.has(e.id))
                                    ? <><ChevronDown className="w-3.5 h-3.5" />Развернуть все</>
                                    : <><ChevronUp className="w-3.5 h-3.5" />Свернуть все</>
                                }
                            </button>
                        </div>
                    )}

                    {currentDay.exercises.map((exercise, idx) => (
                        <ExerciseCard
                            key={exercise.id}
                            exercise={exercise}
                            index={idx}
                            data={exerciseData[exercise.id] || { sets: [], comment: '' }}
                            onChange={d => updateExercise(exercise.id, d)}
                            onVideoClick={(url, title) => setVideoModal({ url, title })}
                            collapsed={collapsedExercises.has(exercise.id)}
                            onToggleCollapse={() => setCollapsedExercises(prev => {
                                const next = new Set(prev)
                                if (next.has(exercise.id)) next.delete(exercise.id)
                                else next.add(exercise.id)
                                return next
                            })}
                        />
                    ))}
                </div>

                {/* Кардио */}
                {currentDay.cardio && (
                    <div className="glass-card p-5 mb-5">
                        <h3 className="text-base font-display font-bold text-white mb-1">Кардио</h3>
                        <p className="text-text-secondary text-sm">{currentDay.cardio}</p>
                    </div>
                )}

                {/* Самочувствие */}
                <div className="glass-card p-5 mb-5">
                    <h3 className="text-base font-display font-bold text-white mb-4">Самочувствие</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Энергия до тренировки', value: energyLevel, max: 10, set: (v: number) => { userChangedRef.current = true; setEnergyLevel(v) } },
                            { label: 'Настроение', value: mood, max: 5, set: (v: number) => { userChangedRef.current = true; setMood(v) } },
                            { label: 'RPE тренировки (субъективная нагрузка)', value: sleepQuality, max: 10, set: (v: number) => { userChangedRef.current = true; setSleepQuality(v) } },
                        ].map(({ label, value, max, set }) => (
                            <div key={label}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm text-text-secondary">{label}</label>
                                    <span className="text-accent font-bold text-sm">{value}/{max}</span>
                                </div>
                                <input type="range" min="1" max={max} value={value}
                                    onChange={e => set(parseInt(e.target.value))} className="w-full" />
                            </div>
                        ))}
                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Заметки</label>
                            <textarea value={notes}
                                onChange={e => { userChangedRef.current = true; setNotes(e.target.value) }}
                                className="glass-input w-full h-20 resize-none text-sm"
                                placeholder="Как прошла тренировка..." />
                        </div>
                    </div>
                </div>

                {/* Кнопки */}
                {!isCurrentDayCompleted ? (
                    <div className="flex gap-3">
                        <button onClick={() => saveEntry(false)} disabled={isSaving}
                            className="glass-button-secondary flex-1 flex items-center justify-center gap-2 py-3">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾'}
                            Сохранить
                        </button>
                        <button onClick={handleCompleteDay} disabled={isSaving}
                            className="glass-button flex-1 flex items-center justify-center gap-2 py-3">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Завершить
                        </button>
                    </div>
                ) : (
                    <div className="glass-card p-4 flex items-center justify-center gap-2 text-success">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">День {currentDay.dayNumber} завершён</span>
                    </div>
                )}
            </div>
        </div>

        {/* Видео модал */}
        {videoModal && (
            <VideoModal
                url={videoModal.url}
                title={videoModal.title}
                onClose={() => setVideoModal(null)}
            />
        )}
        </>
    )
}
