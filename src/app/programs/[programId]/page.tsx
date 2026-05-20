'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Play, CheckCircle2, Loader2, ChevronLeft, ChevronRight,
    X, Maximize2, Minimize2, ChevronDown, ChevronUp, Timer, Clock,
    Lock, RefreshCw, Link2,
} from 'lucide-react'
import RestTimer from '@/components/RestTimer'
import { useAuth } from '@/lib/auth'
import {
    getProgramById,
    getTrainingEntry,
    upsertTrainingEntry,
    completeTrainingDay,
    type TrainingProgram,
    type Exercise,
} from '@/lib/services/training'
import { getMySubscriptionInfo } from '@/lib/services/renewal'

// ─── Типы данных клиента ─────────────────────────────────────────────────────

type SetLabel = 'warmup' | 'heavy' | 'dropset' | null

interface SetData {
    weight: string
    reps: string
    rir: string
    setComment?: string
    label?: SetLabel
}

interface ExerciseClientData {
    sets: SetData[]
    comment: string
    selectedAlternativeId?: string
}

// Суперсет: пара из двух exerciseId
interface Superset {
    id: string          // уникальный id суперсета
    exerciseIds: [string, string]
}

// Порядок упражнений в дне
type ExerciseOrder = string[]

// Данные дня (хранятся в entry_data под ключом __meta__)
interface DayMeta {
    supersets?: Superset[]
    exerciseOrder?: ExerciseOrder
}

// ─── Метки подходов ───────────────────────────────────────────────────────────

const SET_LABELS: { value: SetLabel; label: string; color: string; bg: string; inputColor: string }[] = [
    { value: 'heavy',   label: 'Тяжело',    color: 'text-red-400',    bg: 'bg-red-400/20 border-red-400/40',       inputColor: '#f87171' },
    { value: 'dropset', label: 'Дроп-сет',  color: 'text-purple-400', bg: 'bg-purple-400/20 border-purple-400/40', inputColor: '#c084fc' },
]

function getLabelInfo(label: SetLabel) {
    return SET_LABELS.find(l => l.value === label) ?? null
}

function getYouTubeEmbedUrl(url: string): string | null {
    try {
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

// ─── Экран истёкшей подписки ──────────────────────────────────────────────────

function SubscriptionExpiredScreen() {
    const router = useRouter()
    return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
            <div className="max-w-sm w-full text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-danger/20 border border-danger/30 mb-6">
                    <Lock className="w-10 h-10 text-danger" />
                </div>
                <h1 className="text-2xl font-display font-bold text-white mb-3">Подписка истекла</h1>
                <p className="text-text-secondary text-sm mb-8 leading-relaxed">
                    Доступ к тренировочным программам приостановлен. Продлите подписку, чтобы продолжить тренировки.
                </p>
                <button
                    onClick={() => router.push('/renew?expired=true')}
                    className="glass-button w-full flex items-center justify-center gap-2 py-3 mb-3"
                >
                    <RefreshCw className="w-4 h-4" />
                    Продлить подписку
                </button>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="glass-button-secondary w-full py-3"
                >
                    На главную
                </button>
            </div>
        </div>
    )
}

// ─── Видео модал ─────────────────────────────────────────────────────────────

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
    const [large, setLarge] = useState(false)
    const embedUrl = getYouTubeEmbedUrl(url)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div className={`fixed inset-0 z-50 flex justify-center p-4 transition-all duration-300 ${large ? 'items-center' : 'items-end sm:items-center'}`}
            onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className={`relative z-10 glass-card overflow-hidden transition-all duration-300 w-full ${large ? 'max-w-4xl' : 'max-w-lg'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-white truncate pr-4">{title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {embedUrl && (
                            <button onClick={() => setLarge(v => !v)} className="glass-button-secondary p-1.5 rounded-lg">
                                {large ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                        )}
                        <button onClick={onClose} className="glass-button-secondary p-1.5 rounded-lg">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {embedUrl ? (
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen title={title} />
                    </div>
                ) : (
                    <div className="p-6 flex flex-col items-center gap-4 text-center">
                        <Play className="w-12 h-12 text-accent opacity-60" />
                        <p className="text-sm text-text-secondary">Видео доступно по ссылке</p>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                            className="glass-button flex items-center gap-2 text-sm" onClick={onClose}>
                            <Play className="w-4 h-4" />Открыть видео
                        </a>
                    </div>
                )}
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
    onTimerStart,
    onSupersetClick,
    onAltMenuOpen,
    collapsed,
    onToggleCollapse,
    supersetLabel,
    isDragging,
    nextExerciseName,
}: {
    exercise: Exercise
    index: number
    data: ExerciseClientData
    onChange: (d: ExerciseClientData) => void
    onVideoClick: (url: string, title: string) => void
    onTimerStart: () => void
    onSupersetClick?: () => void
    onAltMenuOpen?: () => void   // открыть модалку выбора альтернатив
    collapsed: boolean
    onToggleCollapse: () => void
    supersetLabel?: string
    isDragging?: boolean
    nextExerciseName?: string
}) {
    const altMenuRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!altMenuRef.current) return
        const handler = (e: MouseEvent) => {
            if (altMenuRef.current && !altMenuRef.current.contains(e.target as Node)) {
                // no-op — altMenu теперь управляется снаружи
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const selectedAlt = data.selectedAlternativeId
        ? exercise.alternatives?.find(a => a.id === data.selectedAlternativeId) ?? null
        : null
    const activeExercise = selectedAlt
        ? { ...selectedAlt, targetWeights: [] as number[], targetWeight: undefined }
        : exercise

    const hasAlternatives = (exercise.alternatives?.length ?? 0) > 0
    const plannedSets = activeExercise.sets || 3
    const targetWeights = selectedAlt
        ? Array(plannedSets).fill(0)
        : (exercise.targetWeights || Array(plannedSets).fill(0))

    const totalSets = Math.max(plannedSets, data.sets.length)
    const filledSets = data.sets.filter(s => s.weight || s.reps).length

    const updateSet = (setIdx: number, field: keyof SetData, value: string | SetLabel) => {
        const newSets = [...data.sets]
        while (newSets.length <= setIdx) newSets.push({ weight: '', reps: '', rir: '', setComment: '' })
        newSets[setIdx] = { ...newSets[setIdx], [field]: value }
        onChange({ ...data, sets: newSets })
    }

    const toggleSetLabel = (setIdx: number, label: SetLabel) => {
        const newSets = [...data.sets]
        while (newSets.length <= setIdx) newSets.push({ weight: '', reps: '', rir: '', setComment: '' })
        const current = newSets[setIdx]?.label
        // Если нажали ту же метку — снимаем, иначе ставим
        const newLabel: SetLabel = current === label ? null : label
        newSets[setIdx] = { ...newSets[setIdx], label: newLabel }
        onChange({ ...data, sets: newSets })
    }

    const addSet = () => {
        const newSets = [...data.sets]
        while (newSets.length < totalSets) newSets.push({ weight: '', reps: '', rir: '', setComment: '' })
        newSets.push({ weight: '', reps: '', rir: '', setComment: '' })
        onChange({ ...data, sets: newSets })
    }

    const removeExtraSet = (setIdx: number) => {
        if (setIdx < plannedSets) return
        const newSets = data.sets.filter((_, i) => i !== setIdx)
        onChange({ ...data, sets: newSets })
    }

    const selectExercise = (altId: string | undefined) => {
        onChange({ sets: [], comment: '', selectedAlternativeId: altId })
    }

    // Считаем рабочий тоннаж (без разминочных)
    const workingTonnage = data.sets.reduce((sum, s) => {
        if (s.label === 'warmup') return sum
        const w = parseFloat(s.weight) || 0
        const r = parseInt(s.reps) || 0
        return sum + w * r
    }, 0)

    return (
        <div className={`transition-all duration-200 ${isDragging ? 'opacity-50' : ''}`}>
            <div className={`glass-card transition-all duration-200 ${collapsed ? 'opacity-70' : ''} ${isDragging ? 'ring-2 ring-accent shadow-glow-accent' : ''}`}>
            {/* Заголовок */}
            <div className="p-4 cursor-pointer select-none" onClick={onToggleCollapse}>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                        {/* Суперсет-метка */}
                        {supersetLabel && (
                            <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-bold text-accent">
                                {supersetLabel}
                            </span>
                        )}

                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 transition-colors ${
                            collapsed && filledSets > 0 ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'
                        }`}>
                            {collapsed && filledSets > 0 ? '✓' : index + 1}
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-base font-display font-bold text-white leading-tight break-words">
                                    {activeExercise.name}
                                </h3>
                                {selectedAlt && (
                                    <span className="text-xs text-accent/70 font-normal">(альтернатива)</span>
                                )}
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5">
                                {plannedSets} x {activeExercise.reps}
                                {!selectedAlt && targetWeights.some((w: number) => w > 0) && (
                                    <span className="text-accent ml-1">
                                        • {targetWeights.map((w: number) => w > 0 ? `${w}` : '—').join('/')} кг
                                    </span>
                                )}
                                {collapsed && filledSets > 0 && (
                                    <span className="text-success ml-2">· {filledSets}/{totalSets} подх.</span>
                                )}
                                {collapsed && workingTonnage > 0 && (
                                    <span className="text-text-muted ml-2">· {workingTonnage.toLocaleString('ru-RU')} кг</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {hasAlternatives && (
                            <div ref={altMenuRef} onClick={e => e.stopPropagation()}>
                                <button
                                    className={`glass-button-secondary p-1.5 rounded-lg text-xs flex items-center gap-1 ${selectedAlt ? 'border-accent/40 text-accent' : ''}`}
                                    title="Альтернативные упражнения"
                                    onClick={() => onAltMenuOpen?.()}
                                >
                                    <span className="text-sm leading-none">⇄</span>
                                </button>
                            </div>
                        )}
                        <button
                            className="glass-button-secondary p-1.5 rounded-lg"
                            onClick={e => { e.stopPropagation(); onToggleCollapse() }}
                        >
                            {collapsed ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronUp className="w-4 h-4 text-text-muted" />}
                        </button>
                    </div>
                </div>

                {!collapsed && (
                    <div className="flex items-center gap-2 pl-9" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => {
                                const url = activeExercise.videoUrl
                                    || `https://www.youtube.com/results?search_query=${encodeURIComponent(activeExercise.name + ' техника')}`
                                onVideoClick(url, activeExercise.name)
                            }}
                            className="glass-button-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                            <Play className="w-3 h-3" />Видео
                        </button>
                        <button onClick={onTimerStart} className="rest-timer-trigger" title="Таймер отдыха">
                            <Timer className="w-3.5 h-3.5" />
                            <span>Отдых</span>
                        </button>
                        {onSupersetClick && (
                            <button
                                onClick={onSupersetClick}
                                className={`glass-button-secondary p-1.5 rounded-lg ${supersetLabel ? 'border-accent/40 text-accent' : ''}`}
                                title={supersetLabel ? `Суперсет ${supersetLabel} (нажми чтобы убрать)` : 'Суперсет'}
                            >
                                <Link2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {!collapsed && (
                <div className="px-5 pb-5">
                    {/* Таблица подходов */}
                    <div className="space-y-2">
                        {/* Заголовок */}
                        <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 text-xs text-text-muted px-1">
                            <div className="min-w-[44px]">Подход</div>
                            <div>Вес (кг)</div>
                            <div>Повт.</div>
                            <div>RIR</div>
                            <div className="w-6" />
                        </div>
                        {Array.from({ length: totalSets }).map((_, setIdx) => {
                            const setData = data.sets[setIdx] || { weight: '', reps: '', rir: '', setComment: '' }
                            const plannedWeight = targetWeights[setIdx] ?? 0
                            const isExtra = setIdx >= plannedSets
                            const labelInfo = getLabelInfo(setData.label ?? null)

                            return (
                                <div key={setIdx}>
                                    <div className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center rounded-lg px-1 py-0.5`}>
                                        {/* Номер подхода */}
                                        <div className="flex flex-col min-w-[44px]">
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
                                            className="glass-input text-sm py-2 px-2 text-center min-w-0 font-semibold"
                                            style={labelInfo ? { color: labelInfo.inputColor } : undefined}
                                            placeholder={plannedWeight > 0 ? String(plannedWeight) : '—'} />
                                        <input type="number" value={setData.reps}
                                            onChange={e => updateSet(setIdx, 'reps', e.target.value)}
                                            className="glass-input text-sm py-2 px-2 text-center min-w-0 font-semibold"
                                            style={labelInfo ? { color: labelInfo.inputColor } : undefined}
                                            placeholder={activeExercise.reps.split('-')[0] || '—'} />
                                        <input type="number" min="0" max="5" value={setData.rir}
                                            onChange={e => updateSet(setIdx, 'rir', e.target.value)}
                                            className="glass-input text-sm py-2 px-2 text-center min-w-0 font-semibold"
                                            style={labelInfo ? { color: labelInfo.inputColor } : undefined}
                                            placeholder="2" />

                                        {/* Кнопка метки — три точки */}
                                        <div className="w-6 flex justify-center">
                                            <div className="relative group">
                                                <button
                                                    className={`w-6 h-7 flex items-center justify-center rounded transition-colors ${
                                                        labelInfo
                                                            ? `${labelInfo.color}`
                                                            : 'text-text-muted hover:text-accent'
                                                    }`}
                                                    title="Метка подхода"
                                                >
                                                    <span className="text-base leading-none select-none">⋮</span>
                                                </button>
                                                {/* Dropdown меток */}
                                                <div className="absolute right-0 top-full mt-1 z-30 hidden group-hover:block glass-card border border-border shadow-xl min-w-[130px] p-1.5 space-y-1">
                                                    {SET_LABELS.map(l => (
                                                        <button
                                                            key={l.value}
                                                            onClick={() => toggleSetLabel(setIdx, l.value)}
                                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                                                                setData.label === l.value
                                                                    ? `${l.bg} ${l.color} font-semibold`
                                                                    : 'text-text-secondary hover:bg-bg-elevated'
                                                            }`}
                                                        >
                                                            {setData.label === l.value && <span>✓</span>}
                                                            {l.label}
                                                        </button>
                                                    ))}
                                                    {setData.label && (
                                                        <button
                                                            onClick={() => toggleSetLabel(setIdx, setData.label ?? null)}
                                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:bg-bg-elevated transition-colors"
                                                        >
                                                            Снять метку
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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
        </div>
    )
}

// ─── Суперсет-разделитель ─────────────────────────────────────────────────────

function SupersetDivider({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-accent/20" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/30">
                <Link2 className="w-3 h-3 text-accent" />
                <span className="text-xs text-accent font-semibold">Суперсет {label}</span>
                <button onClick={onRemove} className="text-accent/60 hover:text-danger ml-1 text-xs leading-none" title="Убрать суперсет">✕</button>
            </div>
            <div className="flex-1 h-px bg-accent/20" />
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
    const [subscriptionExpired, setSubscriptionExpired] = useState(false)

    const [exerciseData, setExerciseData] = useState<Record<string, ExerciseClientData>>({})
    const [energyLevel, setEnergyLevel] = useState(5)
    const [mood, setMood] = useState(3)
    const [sleepQuality, setSleepQuality] = useState(3)
    const [notes, setNotes] = useState('')
    const [completedDays, setCompletedDays] = useState<Set<number>>(new Set())
    const [videoModal, setVideoModal] = useState<{ url: string; title: string } | null>(null)
    const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set())
    const [isStatsCollapsed, setIsStatsCollapsed] = useState(true)
    const [isWellnessCollapsed, setIsWellnessCollapsed] = useState(true)
    const [restTimerVisible, setRestTimerVisible] = useState(false)

    // Суперсеты и порядок упражнений
    const [supersets, setSupersets] = useState<Superset[]>([])
    const [exerciseOrder, setExerciseOrder] = useState<ExerciseOrder>([])

    // Модалка суперсета
    const [supersetModal, setSupersetModal] = useState<{ exerciseId: string; nextExerciseId: string; nextName: string } | null>(null)

    // Модалка альтернатив
    const [altModal, setAltModal] = useState<{ exercise: Exercise; onSelect: (altId: string | undefined) => void } | null>(null)

    // Drag-and-drop
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    // Таймер тренировки
    const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [savedDuration, setSavedDuration] = useState<number | null>(null)

    const dataLoadedRef = useRef(false)
    const userChangedRef = useRef(false)
    const latestDataRef = useRef({ exerciseData, energyLevel, mood, sleepQuality, notes })

    useEffect(() => {
        if (!authLoading && !user) window.location.href = '/auth'
    }, [user, authLoading])

    // Проверка подписки
    useEffect(() => {
        if (!user) return
        getMySubscriptionInfo().then(info => {
            if (info.isExpired) setSubscriptionExpired(true)
        }).catch(() => {})
    }, [user])

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

    // Сворачиваем все упражнения при смене дня
    useEffect(() => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        setCollapsedExercises(new Set(currentDay.exercises.map(e => e.id)))
    }, [program, currentDayIndex])

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
                    const converted: Record<string, ExerciseClientData> = {}
                    for (const ex of currentDay.exercises) {
                        const raw = entry.entry_data?.[ex.id]
                        if (!raw) {
                            converted[ex.id] = { sets: [], comment: '' }
                        } else if (raw.sets && Array.isArray(raw.sets)) {
                            converted[ex.id] = { sets: raw.sets, comment: raw.comment || '', selectedAlternativeId: raw.selectedAlternativeId }
                        } else {
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

                    // Загружаем мета-данные (суперсеты, порядок)
                    const meta: DayMeta = entry.entry_data?.__meta__ || {}
                    setSupersets(meta.supersets || [])
                    const savedOrder = meta.exerciseOrder || []
                    const allIds = currentDay.exercises.map(e => e.id)
                    // Восстанавливаем порядок, добавляя новые упражнения в конец
                    const restoredOrder = [
                        ...savedOrder.filter(id => allIds.includes(id)),
                        ...allIds.filter(id => !savedOrder.includes(id)),
                    ]
                    setExerciseOrder(restoredOrder)

                    if (entry.completed_at) {
                        setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
                        setSavedDuration(entry.workout_duration_seconds ?? null)
                        setWorkoutStartTime(null)
                        setElapsedSeconds(0)
                    } else {
                        setSavedDuration(null)
                        // Восстанавливаем таймер из localStorage если был запущен
                        const key = `workout_start_${program.id}_${currentDay.dayNumber}`
                        const saved = localStorage.getItem(key)
                        if (saved) {
                            const startTime = parseInt(saved)
                            setWorkoutStartTime(startTime)
                            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
                        } else {
                            setWorkoutStartTime(null)
                            setElapsedSeconds(0)
                        }
                    }
                } else {
                    setExerciseData({})
                    setEnergyLevel(5)
                    setMood(3)
                    setSleepQuality(3)
                    setNotes('')
                    setSavedDuration(null)
                    // Восстанавливаем таймер из localStorage если был запущен
                    const key = `workout_start_${program.id}_${currentDay.dayNumber}`
                    const saved = localStorage.getItem(key)
                    if (saved) {
                        const startTime = parseInt(saved)
                        setWorkoutStartTime(startTime)
                        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
                    } else {
                        setWorkoutStartTime(null)
                        setElapsedSeconds(0)
                    }
                    setSupersets([])
                    setExerciseOrder(program.program_data.days[currentDayIndex]?.exercises.map(e => e.id) || [])
                }
            } catch (e) {
                console.error('Error loading entry:', e)
            } finally {
                dataLoadedRef.current = true
            }
        }
        loadEntry()
    }, [program, currentDayIndex, user])

    useEffect(() => {
        latestDataRef.current = { exerciseData, energyLevel, mood, sleepQuality, notes }
    })

    const startTimerIfNeeded = useCallback(() => {
        if (workoutStartTime !== null) return
        const now = Date.now()
        // Сохраняем в localStorage чтобы пережить перезагрузку
        if (program) {
            const key = `workout_start_${program.id}_${program.program_data.days[currentDayIndex]?.dayNumber}`
            localStorage.setItem(key, String(now))
        }
        setWorkoutStartTime(now)
    }, [workoutStartTime, program, currentDayIndex])

    useEffect(() => {
        if (workoutStartTime === null) return
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - workoutStartTime) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [workoutStartTime])

    // Сохранение — читает мета-данные из state через ref
    const metaRef = useRef({ supersets, exerciseOrder })
    useEffect(() => { metaRef.current = { supersets, exerciseOrder } }, [supersets, exerciseOrder])

    const saveEntry = useCallback(async (silent = false) => {
        if (!program || !user) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return

        const { exerciseData: ed, energyLevel: el, mood: m, sleepQuality: sq, notes: n } = latestDataRef.current
        const { supersets: ss, exerciseOrder: eo } = metaRef.current

        // Добавляем мета-данные в entry_data
        const entryDataWithMeta = {
            ...ed,
            __meta__: { supersets: ss, exerciseOrder: eo } as DayMeta,
        }

        if (!silent) setIsSaving(true)
        try {
            await upsertTrainingEntry(program.id, currentDay.dayNumber, entryDataWithMeta, {
                energy_level: el, mood: m, sleep_quality: sq, notes: n,
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
    }, [program, currentDayIndex, user])

    useEffect(() => {
        if (!dataLoadedRef.current || !userChangedRef.current) return
        const t = setTimeout(() => saveEntry(true), 1500)
        return () => clearTimeout(t)
    }, [exerciseData, energyLevel, mood, sleepQuality, notes, supersets, exerciseOrder, saveEntry])

    const updateExercise = (exerciseId: string, data: ExerciseClientData) => {
        userChangedRef.current = true
        if (!completedDays.has(program?.program_data.days[currentDayIndex]?.dayNumber ?? -1)) {
            startTimerIfNeeded()
        }
        setExerciseData(prev => ({ ...prev, [exerciseId]: data }))
    }

    const handleCompleteDay = async () => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        setIsSaving(true)
        const finalDuration = workoutStartTime !== null
            ? Math.floor((Date.now() - workoutStartTime) / 1000)
            : elapsedSeconds || undefined
        try {
            const { exerciseData: ed, energyLevel: el, mood: m, sleepQuality: sq, notes: n } = latestDataRef.current
            const { supersets: ss, exerciseOrder: eo } = metaRef.current
            const entryDataWithMeta = { ...ed, __meta__: { supersets: ss, exerciseOrder: eo } }
            await upsertTrainingEntry(program.id, currentDay.dayNumber, entryDataWithMeta, {
                energy_level: el, mood: m, sleep_quality: sq, notes: n,
                workout_duration_seconds: finalDuration,
            })
            await completeTrainingDay(program.id, currentDay.dayNumber)
            setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
            setSavedDuration(finalDuration ?? null)
            setWorkoutStartTime(null)
            // Очищаем сохранённое время старта
            localStorage.removeItem(`workout_start_${program.id}_${currentDay.dayNumber}`)
            setSaveMessage('✓ Тренировка завершена!')
            setTimeout(() => setSaveMessage(''), 3000)
        } catch (e) {
            console.error('Error completing:', e)
            setSaveMessage('Ошибка')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveCompleted = async () => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        setIsSaving(true)
        try {
            const { exerciseData: ed, energyLevel: el, mood: m, sleepQuality: sq, notes: n } = latestDataRef.current
            const { supersets: ss, exerciseOrder: eo } = metaRef.current
            const entryDataWithMeta = { ...ed, __meta__: { supersets: ss, exerciseOrder: eo } }
            await upsertTrainingEntry(program.id, currentDay.dayNumber, entryDataWithMeta, {
                energy_level: el, mood: m, sleep_quality: sq, notes: n,
                workout_duration_seconds: savedDuration ?? undefined,
            })
            setSaveMessage('✓ Правки сохранены')
            setTimeout(() => setSaveMessage(''), 2000)
        } catch (e) {
            console.error('Error saving completed entry:', e)
            setSaveMessage('Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    // ─── Суперсеты ────────────────────────────────────────────────────────────

    const addSuperset = (id1: string, id2: string) => {
        // Проверяем что оба упражнения не в другом суперсете
        const alreadyInSuperset = supersets.some(ss =>
            ss.exerciseIds.includes(id1) || ss.exerciseIds.includes(id2)
        )
        if (alreadyInSuperset) return
        const newSS: Superset = {
            id: `ss_${Date.now()}`,
            exerciseIds: [id1, id2],
        }
        userChangedRef.current = true
        setSupersets(prev => [...prev, newSS])
    }

    const removeSuperset = (ssId: string) => {
        userChangedRef.current = true
        setSupersets(prev => prev.filter(ss => ss.id !== ssId))
    }

    const getSupersetForExercise = (exerciseId: string): Superset | null => {
        return supersets.find(ss => ss.exerciseIds.includes(exerciseId)) ?? null
    }

    const getSupersetLabel = (ssId: string): string => {
        const idx = supersets.findIndex(ss => ss.id === ssId)
        return String.fromCharCode(65 + idx) // A, B, C...
    }

    // ─── Drag-and-drop ────────────────────────────────────────────────────────

    const handleDragStart = (exerciseId: string) => {
        setDraggedId(exerciseId)
    }

    const handleDragOver = (e: React.DragEvent, exerciseId: string) => {
        e.preventDefault()
        if (exerciseId !== draggedId) setDragOverId(exerciseId)
    }

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null)
            setDragOverId(null)
            return
        }

        const currentOrder = exerciseOrder.length > 0
            ? exerciseOrder
            : (program?.program_data.days[currentDayIndex]?.exercises.map(e => e.id) || [])

        const newOrder = [...currentOrder]
        const fromIdx = newOrder.indexOf(draggedId)
        const toIdx = newOrder.indexOf(targetId)
        if (fromIdx === -1 || toIdx === -1) return

        newOrder.splice(fromIdx, 1)
        newOrder.splice(toIdx, 0, draggedId)

        userChangedRef.current = true
        setExerciseOrder(newOrder)
        setDraggedId(null)
        setDragOverId(null)
    }

    const handleDragEnd = () => {
        setDraggedId(null)
        setDragOverId(null)
    }

    // Touch drag (мобильный)
    const touchStartY = useRef<number>(0)
    const touchExerciseId = useRef<string | null>(null)

    const handleTouchStart = (e: React.TouchEvent, exerciseId: string) => {
        touchStartY.current = e.touches[0].clientY
        touchExerciseId.current = exerciseId
        setDraggedId(exerciseId)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchExerciseId.current) return
        const touch = e.touches[0]
        const el = document.elementFromPoint(touch.clientX, touch.clientY)
        const card = el?.closest('[data-exercise-id]')
        const overId = card?.getAttribute('data-exercise-id')
        if (overId && overId !== touchExerciseId.current) {
            setDragOverId(overId)
        }
    }

    const handleTouchEnd = () => {
        if (touchExerciseId.current && dragOverId && touchExerciseId.current !== dragOverId) {
            const currentOrder = exerciseOrder.length > 0
                ? exerciseOrder
                : (program?.program_data.days[currentDayIndex]?.exercises.map(e => e.id) || [])

            const newOrder = [...currentOrder]
            const fromIdx = newOrder.indexOf(touchExerciseId.current)
            const toIdx = newOrder.indexOf(dragOverId)
            if (fromIdx !== -1 && toIdx !== -1) {
                newOrder.splice(fromIdx, 1)
                newOrder.splice(toIdx, 0, touchExerciseId.current!)
                userChangedRef.current = true
                setExerciseOrder(newOrder)
            }
        }
        touchExerciseId.current = null
        setDraggedId(null)
        setDragOverId(null)
    }

    if (authLoading || isLoading || !program) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    // Показываем экран истёкшей подписки
    if (subscriptionExpired) {
        return <SubscriptionExpiredScreen />
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

    const formatDuration = (seconds: number): string => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    const displayDuration = isCurrentDayCompleted
        ? (savedDuration ?? null)
        : (workoutStartTime !== null ? elapsedSeconds : null)

    // Упорядоченный список упражнений
    const allExerciseIds = currentDay.exercises.map(e => e.id)
    const orderedIds = exerciseOrder.length > 0
        ? [...exerciseOrder.filter(id => allExerciseIds.includes(id)), ...allExerciseIds.filter(id => !exerciseOrder.includes(id))]
        : allExerciseIds
    const orderedExercises = orderedIds.map(id => currentDay.exercises.find(e => e.id === id)!).filter(Boolean)

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

                {/* Инфо о программе */}
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

                    {program.program_data.weeklyNote && (
                        <div className="mb-3 p-3 rounded-xl bg-accent/10 border border-accent/20 flex gap-2">
                            <span className="text-accent text-base flex-shrink-0">💬</span>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                <span className="text-accent font-semibold">Тренер: </span>
                                {program.program_data.weeklyNote}
                            </p>
                        </div>
                    )}

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
                <div className="space-y-2 mb-5">
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
                                    setCollapsedExercises(allCollapsed ? new Set() : new Set(allIds))
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

                    {/* Список упражнений с drag-and-drop */}
                    {orderedExercises.map((exercise, idx) => {
                        const ss = getSupersetForExercise(exercise.id)
                        const isFirstInSS = ss ? ss.exerciseIds[0] === exercise.id : false
                        const isSecondInSS = ss ? ss.exerciseIds[1] === exercise.id : false
                        const ssLabel = ss ? getSupersetLabel(ss.id) : undefined

                        // Следующее упражнение в порядке
                        const nextExercise = orderedExercises[idx + 1]
                        const canAddSuperset = nextExercise
                            && !getSupersetForExercise(exercise.id)
                            && !getSupersetForExercise(nextExercise.id)

                        return (
                            <div key={exercise.id}>
                                {/* Суперсет-разделитель перед вторым упражнением */}
                                {isSecondInSS && ss && (
                                    <SupersetDivider
                                        label={getSupersetLabel(ss.id)}
                                        onRemove={() => removeSuperset(ss.id)}
                                    />
                                )}                                <div
                                    data-exercise-id={exercise.id}
                                    draggable
                                    onDragStart={() => handleDragStart(exercise.id)}
                                    onDragOver={e => handleDragOver(e, exercise.id)}
                                    onDrop={e => handleDrop(e, exercise.id)}
                                    onDragEnd={handleDragEnd}
                                    onTouchStart={e => handleTouchStart(e, exercise.id)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    className={`transition-all duration-150 ${
                                        dragOverId === exercise.id && draggedId !== exercise.id
                                            ? 'ring-2 ring-accent/60 rounded-xl scale-[1.01]'
                                            : ''
                                    }`}
                                >
                                    <ExerciseCard
                                        exercise={exercise}
                                        index={idx}
                                        data={exerciseData[exercise.id] || { sets: [], comment: '' }}
                                        onChange={d => updateExercise(exercise.id, d)}
                                        onVideoClick={(url, title) => setVideoModal({ url, title })}
                                        onTimerStart={() => setRestTimerVisible(true)}
                                        onAltMenuOpen={
                                            (exercise.alternatives?.length ?? 0) > 0
                                                ? () => setAltModal({
                                                    exercise,
                                                    onSelect: (altId) => {
                                                        updateExercise(exercise.id, {
                                                            ...(exerciseData[exercise.id] || { sets: [], comment: '' }),
                                                            sets: [],
                                                            comment: '',
                                                            selectedAlternativeId: altId,
                                                        })
                                                        setAltModal(null)
                                                    },
                                                })
                                                : undefined
                                        }
                                        onSupersetClick={
                                            // Показываем кнопку только если есть следующее упражнение
                                            nextExercise
                                                ? () => {
                                                    const existingSS = getSupersetForExercise(exercise.id)
                                                    if (existingSS) {
                                                        // Уже в суперсете — убираем
                                                        removeSuperset(existingSS.id)
                                                    } else {
                                                        setSupersetModal({
                                                            exerciseId: exercise.id,
                                                            nextExerciseId: nextExercise.id,
                                                            nextName: nextExercise.name,
                                                        })
                                                    }
                                                }
                                                : undefined
                                        }
                                        collapsed={collapsedExercises.has(exercise.id)}
                                        onToggleCollapse={() => setCollapsedExercises(prev => {
                                            const next = new Set(prev)
                                            if (next.has(exercise.id)) next.delete(exercise.id)
                                            else next.add(exercise.id)
                                            return next
                                        })}
                                        supersetLabel={ssLabel}
                                        isDragging={draggedId === exercise.id}
                                        nextExerciseName={nextExercise?.name}
                                    />
                                </div>

                                {/* Скрепка между карточками убрана — суперсет через кнопку внутри карточки */}
                            </div>
                        )
                    })}
                </div>

                {/* Кардио */}
                {currentDay.cardio && (
                    <div className="glass-card p-5 mb-5">
                        <h3 className="text-base font-display font-bold text-white mb-1">Кардио</h3>
                        <p className="text-text-secondary text-sm">{currentDay.cardio}</p>
                    </div>
                )}

                {/* Статистика сессии */}
                {(() => {
                    let totalTonnage = 0
                    let totalSetsCount = 0
                    let totalRepsCount = 0
                    const exercisesWithData: string[] = []

                    currentDay.exercises.forEach(ex => {
                        const exData = exerciseData[ex.id]
                        if (!exData?.sets?.length) return
                        const filledSets = exData.sets.filter(s => s.weight || s.reps)
                        if (filledSets.length === 0) return
                        exercisesWithData.push(ex.id)
                        filledSets.forEach(s => {
                            // Разминочные подходы не учитываются в тоннаже
                            if (s.label !== 'warmup') {
                                const w = parseFloat(s.weight) || 0
                                const r = parseInt(s.reps) || 0
                                totalTonnage += w * r
                            }
                            totalSetsCount += 1
                            totalRepsCount += parseInt(s.reps) || 0
                        })
                    })

                    if (exercisesWithData.length === 0) return null

                    return (
                        <div className="glass-card mb-5 border border-accent/20 overflow-hidden">
                            <button
                                onClick={() => setIsStatsCollapsed(v => !v)}
                                className="w-full p-5 flex items-center justify-between gap-2 text-left"
                            >
                                <span className="flex items-center gap-2 text-base font-display font-bold text-white">
                                    <span className="text-accent">📊</span> Статистика сессии
                                </span>
                                <span className="flex items-center gap-2">
                                    {isStatsCollapsed && displayDuration !== null && (
                                        <span className="flex items-center gap-1.5 text-sm font-mono font-bold text-accent">
                                            <Clock className="w-4 h-4" />
                                            {formatDuration(displayDuration)}
                                        </span>
                                    )}
                                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isStatsCollapsed ? '-rotate-90' : ''}`} />
                                </span>
                            </button>
                            {!isStatsCollapsed && (
                                <div className="px-5 pb-5">
                                    {displayDuration !== null && (
                                        <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-accent mb-3 -mt-1">
                                            <Clock className="w-4 h-4" />
                                            {formatDuration(displayDuration)}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                        <div className="rounded-xl bg-bg-elevated p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-accent">{totalTonnage.toLocaleString('ru-RU')}</p>
                                            <p className="text-xs text-text-muted mt-0.5">Тоннаж (кг)</p>
                                        </div>
                                        <div className="rounded-xl bg-bg-elevated p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-white">{exercisesWithData.length}</p>
                                            <p className="text-xs text-text-muted mt-0.5">Упражнений</p>
                                        </div>
                                        <div className="rounded-xl bg-bg-elevated p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-white">{totalSetsCount}</p>
                                            <p className="text-xs text-text-muted mt-0.5">Подходов</p>
                                        </div>
                                        <div className="rounded-xl bg-bg-elevated p-3 text-center">
                                            <p className="text-2xl font-display font-bold text-white">{totalRepsCount}</p>
                                            <p className="text-xs text-text-muted mt-0.5">Повторений</p>
                                        </div>
                                        <div className="rounded-xl bg-bg-elevated p-3 text-center col-span-2 sm:col-span-1">
                                            <p className="text-2xl font-display font-bold text-white font-mono">
                                                {displayDuration !== null ? formatDuration(displayDuration) : '—'}
                                            </p>
                                            <p className="text-xs text-text-muted mt-0.5">Время</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })()}

                {/* Самочувствие */}
                <div className="glass-card mb-5 overflow-hidden">
                    <button
                        onClick={() => setIsWellnessCollapsed(v => !v)}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left"
                    >
                        <span className="text-base font-display font-bold text-white">Самочувствие</span>
                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isWellnessCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    {!isWellnessCollapsed && (
                        <div className="px-5 pb-5 space-y-4">
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
                    )}
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
                    <div className="space-y-3">
                        <div className="glass-card p-4 flex items-center justify-center gap-2 text-success">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-semibold">День {currentDay.dayNumber} завершён</span>
                        </div>
                        <button onClick={handleSaveCompleted} disabled={isSaving}
                            className="glass-button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '✏️'}
                            Сохранить правки в дневник
                        </button>
                    </div>
                )}
            </div>
        </div>

        {videoModal && (
            <VideoModal url={videoModal.url} title={videoModal.title} onClose={() => setVideoModal(null)} />
        )}

        {restTimerVisible && (
            <RestTimer onClose={() => setRestTimerVisible(false)} />
        )}

        {/* Модалка альтернативных упражнений */}
        {altModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setAltModal(null)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative z-10 glass-card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-display font-bold text-white">Выбери упражнение</h3>
                        <button onClick={() => setAltModal(null)} className="glass-button-secondary p-1.5 rounded-lg">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {/* Основное */}
                        <button
                            onClick={() => altModal.onSelect(undefined)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors border ${
                                !exerciseData[altModal.exercise.id]?.selectedAlternativeId
                                    ? 'bg-accent/20 border-accent/40 text-accent font-semibold'
                                    : 'border-border text-text-secondary hover:bg-bg-elevated'
                            }`}
                        >
                            <span className="text-xs text-text-muted block mb-0.5">Основное</span>
                            {altModal.exercise.name}
                            <span className="text-xs text-text-muted ml-2">{altModal.exercise.sets} x {altModal.exercise.reps}</span>
                        </button>
                        {/* Альтернативы */}
                        {altModal.exercise.alternatives!.map(alt => (
                            <button
                                key={alt.id}
                                onClick={() => altModal.onSelect(alt.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors border ${
                                    exerciseData[altModal.exercise.id]?.selectedAlternativeId === alt.id
                                        ? 'bg-accent/20 border-accent/40 text-accent font-semibold'
                                        : 'border-border text-text-secondary hover:bg-bg-elevated'
                                }`}
                            >
                                <span className="text-xs text-text-muted block mb-0.5">Альтернатива · {alt.sets} x {alt.reps}</span>
                                {alt.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Модалка суперсета */}
        {supersetModal && (            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSupersetModal(null)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative z-10 glass-card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                            <Link2 className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-base font-display font-bold text-white">Суперсет</h3>
                            <p className="text-xs text-text-muted">Объединить со следующим упражнением</p>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-bg-elevated border border-border mb-4 text-sm text-text-secondary">
                        <span className="text-accent font-semibold">→ </span>
                        {supersetModal.nextName}
                    </div>
                    <p className="text-xs text-text-muted mb-4 leading-relaxed">
                        Упражнения будут выполняться поочерёдно без отдыха между ними.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSupersetModal(null)}
                            className="glass-button-secondary flex-1 py-2.5 text-sm"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={() => {
                                addSuperset(supersetModal.exerciseId, supersetModal.nextExerciseId)
                                setSupersetModal(null)
                            }}
                            className="glass-button flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                        >
                            <Link2 className="w-4 h-4" />
                            Объединить
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
