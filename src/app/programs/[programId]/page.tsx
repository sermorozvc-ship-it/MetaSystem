'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Play, CheckCircle2, Loader2, ChevronLeft, ChevronRight,
    X, Maximize2, Minimize2, ChevronDown, ChevronUp, Timer, Clock,
    Lock, RefreshCw, Link2, Check,
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
import { parseMdToJson } from '@/lib/utils/md-parser'
import { parseCheckinQuestions } from '@/lib/utils/checkin-questions'
import { getWeeklyCheckin, upsertWeeklyCheckin, markWeeklyCheckinCompleted } from '@/lib/services/weekly-checkin'

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

// Данные дня (хранятся в entry_data под ключом __meta__)
interface DayMeta {
    supersets?: Superset[]
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
            /youtu\.be\/([^?&/]+)/,
            /youtube\.com\/watch\?v=([^&]+)/,
            /youtube\.com\/embed\/([^?&/]+)/,
            /youtube\.com\/shorts\/([^?&/]+)/,
            /youtube\.com\/live\/([^?&/]+)/,
        ]
        for (const p of patterns) {
            const m = url.match(p)
            if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1`
        }
        return null
    } catch {
        return null
    }
}

// Шортсы вертикальные — для них используем 9:16 вместо 16:9
function isVerticalVideoUrl(url: string): boolean {
    return /youtube\.com\/shorts\//.test(url)
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
    const vertical = isVerticalVideoUrl(url)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    // Блокируем прокрутку body пока открыт плеер — чтобы фон не елозил
    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [])

    // Размер контейнера: горизонтальное — 16:9 как было; шортс — узкая колонка по центру
    // max-w-sm на мобиле даёт примерно ширину телефона, но не во весь экран
    const containerWidthClass = vertical
        ? (large ? 'max-w-md' : 'max-w-xs')
        : (large ? 'max-w-4xl' : 'max-w-lg')

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 transition-all duration-300"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <div
                className={`relative z-10 glass-card overflow-hidden transition-all duration-300 w-full max-h-[90vh] flex flex-col ${containerWidthClass}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
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
                    vertical ? (
                        // 9:16 — но ограничиваем высотой вьюпорта, чтобы плеер влезал целиком
                        <div className="relative w-full bg-black flex-1" style={{ aspectRatio: '9 / 16', maxHeight: 'calc(90vh - 56px)' }}>
                            <iframe
                                src={embedUrl}
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={title}
                            />
                        </div>
                    ) : (
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src={embedUrl}
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={title}
                            />
                        </div>
                    )
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
        <div className="transition-all duration-200">
            <div className={`glass-card transition-all duration-200 ${collapsed ? 'opacity-70' : ''}`}>
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
                            className="glass-button-secondary p-1.5 rounded-lg"
                            title="Видео">
                            <Play className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={onTimerStart} className="glass-button-secondary p-1.5 rounded-lg" title="Таймер отдыха">
                            <Timer className="w-3.5 h-3.5" />
                        </button>
                        {hasAlternatives && (
                            <button
                                onClick={() => onAltMenuOpen?.()}
                                className={`glass-button-secondary p-1.5 rounded-lg ${selectedAlt ? 'border-accent/40 text-accent' : ''}`}
                                title={selectedAlt ? 'Активна альтернатива' : 'Заменить упражнение'}
                            >
                                <span className="text-sm leading-none">⇄</span>
                            </button>
                        )}
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

// ─── Простой inline-markdown рендерер ────────────────────────────────────────
// Поддерживает: **bold**, > blockquote, - list item

function renderSimpleMd(text: string): React.ReactNode {
    return text.split('\n').map((line, i) => {
        // Blockquote: > текст
        if (line.startsWith('> ')) {
            return (
                <div key={i} className="border-l-2 border-accent/40 pl-3 my-2 text-text-muted italic text-xs">
                    {renderInline(line.slice(2))}
                </div>
            )
        }
        // List item: - текст
        if (line.startsWith('- ')) {
            return (
                <div key={i} className="flex gap-2 my-1">
                    <span className="text-accent/60 flex-shrink-0 mt-0.5">·</span>
                    <span>{renderInline(line.slice(2))}</span>
                </div>
            )
        }
        // Пустая строка
        if (!line.trim()) return <div key={i} className="h-3" />
        // Обычный текст
        return <div key={i} className="my-1">{renderInline(line)}</div>
    })
}

function renderInline(text: string): React.ReactNode {
    // Разбиваем по **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
    })
}

// ─── Чек-ин блок ─────────────────────────────────────────────────────────────

/**
 * Форма чек-ина с инпутами под каждый вопрос. Вопросы парсятся из markdown
 * раздела "## 📊 Чек-ин в конце недели" программы. Ответы сохраняются в
 * weekly_checkins (одна запись на программу) и автоматически попадают в
 * экспортируемый дневник как блок "💬 Чек-ин клиента".
 *
 * UX: автосохранение через 800мс после ввода (debounce), кнопка "Завершить"
 * проставляет completed_at.
 */
function CheckinBlock({ programId, userId, text }: { programId: string; userId: string; text: string }) {
    const [collapsed, setCollapsed] = useState(true)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [completedAt, setCompletedAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)

    // Парсим вопросы один раз
    const questions = useMemo(() => parseCheckinQuestions(text), [text])

    // Загружаем существующий чек-ин
    useEffect(() => {
        let cancelled = false
        getWeeklyCheckin(programId)
            .then(checkin => {
                if (cancelled) return
                if (checkin) {
                    setAnswers(checkin.answers || {})
                    setCompletedAt(checkin.completed_at)
                }
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [programId])

    // Debounce-автосохранение
    const dirtyRef = useRef(false)
    useEffect(() => {
        if (!dirtyRef.current) return
        const t = setTimeout(async () => {
            setSaveStatus('saving')
            setError(null)
            try {
                await upsertWeeklyCheckin({ programId, userId, answers })
                setSaveStatus('saved')
                setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 1500)
            } catch (e: any) {
                setSaveStatus('error')
                setError(e?.message || 'Ошибка сохранения')
            }
            dirtyRef.current = false
        }, 800)
        return () => clearTimeout(t)
    }, [answers, programId, userId])

    const updateAnswer = (key: string, value: string) => {
        setAnswers(prev => ({ ...prev, [key]: value }))
        dirtyRef.current = true
    }

    const filledCount = questions.filter(q => {
        const a = answers[q.key]
        return a !== undefined && String(a).trim() !== ''
    }).length

    const isCompleted = !!completedAt

    return (
        <div className={`mb-5 rounded-2xl border-2 overflow-hidden ${
            isCompleted
                ? 'border-success/40 bg-success/5'
                : 'border-accent/40 bg-accent/5 shadow-glow-accent'
        }`}>
            <button
                onClick={() => setCollapsed(v => !v)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
                <span className="text-xl flex-shrink-0">{isCompleted ? '✅' : '📊'}</span>
                <div className="flex-1 min-w-0">
                    <span className={`text-base font-display font-bold ${isCompleted ? 'text-success' : 'text-accent'}`}>
                        Чек-ин в конце недели
                    </span>
                    <p className={`text-xs mt-0.5 ${isCompleted ? 'text-success/70' : 'text-accent/60'}`}>
                        {isCompleted
                            ? `Завершён · ${new Date(completedAt!).toLocaleDateString('ru-RU')}`
                            : questions.length > 0
                                ? `Заполнено ${filledCount} из ${questions.length}`
                                : 'Обязательно перед следующей неделей'}
                    </p>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${
                    isCompleted ? 'text-success/60' : 'text-accent/60'
                } ${collapsed ? '' : 'rotate-180'}`} />
            </button>

            {!collapsed && (
                <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed border-t border-accent/20 pt-4 space-y-3">
                    {loading ? (
                        <div className="py-4 flex items-center justify-center gap-2 text-text-muted">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Загружаю...
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-text-muted italic">
                                Заполни поля ниже. Ответы сохраняются автоматически и попадут в твой отчёт за неделю.
                            </p>

                            {questions.map(q => {
                                const value = answers[q.key] ?? ''
                                const inputId = `checkin-${programId}-${q.key}`
                                return (
                                    <div key={q.key} className="space-y-1">
                                        <label htmlFor={inputId} className="block text-sm font-semibold text-white">
                                            {q.label}
                                            {q.hint && <span className="text-xs text-text-muted ml-2 font-normal">({q.hint})</span>}
                                        </label>
                                        {q.inputType === 'textarea' ? (
                                            <textarea
                                                id={inputId}
                                                value={value}
                                                onChange={e => updateAnswer(q.key, e.target.value)}
                                                disabled={isCompleted}
                                                rows={2}
                                                className="glass-input w-full text-sm resize-y disabled:opacity-60"
                                                placeholder="Свободный ответ..."
                                            />
                                        ) : q.inputType === 'number' ? (
                                            <input
                                                id={inputId}
                                                type="number"
                                                value={value}
                                                onChange={e => updateAnswer(q.key, e.target.value)}
                                                disabled={isCompleted}
                                                min={q.min}
                                                max={q.max}
                                                className="glass-input w-full text-sm disabled:opacity-60"
                                                placeholder={q.min !== undefined && q.max !== undefined ? `${q.min}-${q.max}` : '—'}
                                            />
                                        ) : (
                                            <input
                                                id={inputId}
                                                type="text"
                                                value={value}
                                                onChange={e => updateAnswer(q.key, e.target.value)}
                                                disabled={isCompleted}
                                                className="glass-input w-full text-sm disabled:opacity-60"
                                                placeholder="Свободный ответ..."
                                            />
                                        )}
                                    </div>
                                )
                            })}

                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                {isCompleted ? (
                                    <span className="text-xs text-success font-semibold flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Чек-ин зафиксирован, ответы попадут в отчёт за неделю
                                    </span>
                                ) : (
                                    <span className="text-xs text-text-muted italic">
                                        Ответы сохраняются автоматически. Финализация — кнопкой «Завершить неделю» внизу.
                                    </span>
                                )}
                                <span className="text-xs text-text-muted ml-auto">
                                    {saveStatus === 'saving' && 'Сохраняю...'}
                                    {saveStatus === 'saved' && '✓ Сохранено'}
                                    {saveStatus === 'error' && (
                                        <span className="text-danger">{error || 'Ошибка'}</span>
                                    )}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Главная страница ─────────────────────────────────────────────────────────

/**
 * Лоадер с fallback'ом «долго грузится».
 *
 * Десктопная проблема: иногда Supabase / RLS / навигация подвисает,
 * клиентские чтения не резолвятся и страница остаётся со спиннером
 * навсегда. Чтобы пользователь не сидел в недоумении и не делал F5
 * вслепую, через 7 секунд показываем явный баннер с кнопкой
 * принудительного soft-refresh (location.reload).
 *
 * Это не лечит первопричину (для этого withTimeout в сервисах),
 * а является страховочным UX-щитом.
 */
function PageLoadingFallback() {
    const [tooLong, setTooLong] = useState(false)

    useEffect(() => {
        const t = setTimeout(() => setTooLong(true), 7000)
        return () => clearTimeout(t)
    }, [])

    return (
        <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center gap-4 p-6 text-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            {tooLong && (
                <div className="max-w-sm space-y-3 mt-2">
                    <p className="text-sm text-text-secondary">
                        Загрузка занимает дольше обычного. Возможно сеть
                        флапает или сессия зависла.
                    </p>
                    <button
                        onClick={() => {
                            if (typeof window !== 'undefined') window.location.reload()
                        }}
                        className="glass-button-secondary text-sm px-5 py-2"
                    >
                        Обновить страницу
                    </button>
                </div>
            )}
        </div>
    )
}

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
    const [isWeeklyNoteCollapsed, setIsWeeklyNoteCollapsed] = useState(true)
    const [isWeekContextCollapsed, setIsWeekContextCollapsed] = useState(true)
    const [isRedFlagsCollapsed, setIsRedFlagsCollapsed] = useState(true)
    const [isDayNoteCollapsed, setIsDayNoteCollapsed] = useState(true)
    const [isDayContextCollapsed, setIsDayContextCollapsed] = useState(true)
    // Статистика за прошлую неделю — три независимых раздела
    const [isPrevWeekCollapsed, setIsPrevWeekCollapsed] = useState(true)
    const [isPrevCoachCollapsed, setIsPrevCoachCollapsed] = useState(true)
    const [isPrevVolumeCollapsed, setIsPrevVolumeCollapsed] = useState(true)
    const [isPrevWellnessCollapsed, setIsPrevWellnessCollapsed] = useState(true)
    const [restTimerVisible, setRestTimerVisible] = useState(false)

    // Суперсеты
    const [supersets, setSupersets] = useState<Superset[]>([])

    // Модалка суперсета
    const [supersetModal, setSupersetModal] = useState<{ exerciseId: string; nextExerciseId: string; nextName: string } | null>(null)

    // Модалка альтернатив
    const [altModal, setAltModal] = useState<{ exercise: Exercise; onSelect: (altId: string | undefined) => void } | null>(null)

    // Таймер тренировки
    const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [savedDuration, setSavedDuration] = useState<number | null>(null)

    const dataLoadedRef = useRef(false)
    const userChangedRef = useRef(false)
    const latestDataRef = useRef({ exerciseData, energyLevel, mood, sleepQuality, notes })

    // ─── Автосохранение: lock + очередь + статус ─────────────────────────────
    // Гарантируем, что:
    //  1. Параллельных upsert никогда не запускается (inFlightRef).
    //  2. Если во время сохранения пользователь снова что-то ввёл,
    //     после завершения текущего прогона запускается ещё один (pendingRef).
    //  3. UI всегда видит реальный статус (saveStatus), а не залипший isSaving.
    const inFlightRef = useRef(false)
    const pendingRef = useRef(false)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [saveError, setSaveError] = useState<string | null>(null)
    const lastSavedAtRef = useRef<number | null>(null)

    // Ключ локального бэкапа на (программа, день) — страховка от потери ввода
    // при перезагрузке страницы / падении сети до ответа Supabase.
    const backupKey = useCallback((dayNumber: number) => {
        return `training_draft_${programId}_${dayNumber}`
    }, [programId])

    useEffect(() => {
        if (!authLoading && !user) router.replace('/auth')
    }, [user, authLoading, router])

    // Проверка подписки
    useEffect(() => {
        if (!user) return
        getMySubscriptionInfo().then(info => {
            if (info.isExpired) setSubscriptionExpired(true)
        }).catch(() => {})
    }, [user?.id])

    // Загрузка программы
    useEffect(() => {
        if (!user || !programId) return
        const load = async () => {
            try {
                const data = await getProgramById(programId)
                if (!data) { router.replace('/programs'); return }

                // Дозаполняем отсутствующие поля из program_md на лету —
                // без записи в БД. Это нужно для программ, которые сохранены
                // ДО появления нового парсера: у них в program_data может не быть
                // prevWeekStats / dayContext / weekContext, но в program_md
                // эти данные есть. Каждое поле подставляется независимо
                // (через ?? parsed.X), поэтому уже заполненные поля не перетираются.
                if (data.program_md) {
                    try {
                        const pd = data.program_data
                        const parsed = parseMdToJson(data.program_md)
                        data.program_data = {
                            ...pd,
                            weeklyNote: pd.weeklyNote ?? parsed.weeklyNote,
                            weekContext: pd.weekContext ?? parsed.weekContext,
                            redFlags: pd.redFlags ?? parsed.redFlags,
                            checkin: pd.checkin ?? parsed.checkin,
                            loggingNote: pd.loggingNote ?? parsed.loggingNote,
                            prevWeekStats: pd.prevWeekStats ?? parsed.prevWeekStats,
                            days: pd.days.map((day, i) => ({
                                ...day,
                                coachNote: day.coachNote ?? parsed.days[i]?.coachNote,
                                dayContext: day.dayContext ?? parsed.days[i]?.dayContext,
                            })),
                        }
                    } catch (e) {
                        console.warn('[program] md enrich failed:', e)
                    }
                }

                setProgram(data)
            } catch (e) {
                console.error('Error loading program:', e)
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [user?.id, programId, router])

    // Сворачиваем все упражнения при смене дня
    useEffect(() => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        setCollapsedExercises(new Set(currentDay.exercises.map(e => e.id)))
        // Сбрасываем состояние дневных блоков
        setIsDayNoteCollapsed(true)
        setIsDayContextCollapsed(true)
        setIsWeekContextCollapsed(true)
    }, [program, currentDayIndex])

    // Загрузка записи текущего дня
    useEffect(() => {
        if (!program || !user) return
        dataLoadedRef.current = false
        userChangedRef.current = false
        // Сбрасываем локальный статус автосохранения при смене дня —
        // иначе после переключения остаётся «✓ Сохранено» от предыдущего дня.
        setSaveStatus('idle')
        setSaveError(null)
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }

        const loadEntry = async () => {
            const currentDay = program.program_data.days[currentDayIndex]
            if (!currentDay) return

            // Локальный бэкап (если есть). Используем как fallback, если
            // сеть не дала ответа, и как «more-recent override» если бэкап
            // новее серверной записи (значит последняя попытка сохранения
            // не дошла — например пользователь сделал hard reload).
            let localDraft: {
                exerciseData?: Record<string, ExerciseClientData>
                energyLevel?: number
                mood?: number
                sleepQuality?: number
                notes?: string
                supersets?: Superset[]
                savedAt?: number
            } | null = null
            try {
                const raw = localStorage.getItem(backupKey(currentDay.dayNumber))
                if (raw) localDraft = JSON.parse(raw)
            } catch (e) {
                console.warn('[program] local draft parse failed:', e)
            }

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

                    // Если локальный бэкап новее, чем то что нам отдал сервер,
                    // значит последний save не дошёл — восстанавливаем черновик
                    // и помечаем, что нужно повторно сохранить.
                    const serverUpdatedAt = entry.updated_at ? new Date(entry.updated_at).getTime() : 0
                    const draftIsNewer = localDraft?.savedAt && localDraft.savedAt > serverUpdatedAt + 1000
                    if (draftIsNewer && localDraft?.exerciseData) {
                        setExerciseData(localDraft.exerciseData)
                        setEnergyLevel(localDraft.energyLevel ?? entry.energy_level ?? 5)
                        setMood(localDraft.mood ?? entry.mood ?? 3)
                        setSleepQuality(localDraft.sleepQuality ?? entry.sleep_quality ?? 3)
                        setNotes(localDraft.notes ?? entry.notes ?? '')
                        setSupersets(localDraft.supersets ?? (entry.entry_data?.__meta__?.supersets || []))
                        // помечаем как «надо досохранить» — после монтирования сработает автосейв
                        userChangedRef.current = true
                        setSaveStatus('idle')
                        console.info('[program] restored local draft (newer than server)')
                    } else {
                        setExerciseData(converted)
                        setEnergyLevel(entry.energy_level || 5)
                        setMood(entry.mood || 3)
                        setSleepQuality(entry.sleep_quality || 3)
                        setNotes(entry.notes || '')

                        // Загружаем мета-данные (суперсеты)
                        const meta: DayMeta = entry.entry_data?.__meta__ || {}
                        setSupersets(meta.supersets || [])
                    }

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
                    // На сервере нет записи. Если есть локальный черновик —
                    // используем его, чтобы не потерять ввод после перезагрузки.
                    if (localDraft?.exerciseData) {
                        setExerciseData(localDraft.exerciseData)
                        setEnergyLevel(localDraft.energyLevel ?? 5)
                        setMood(localDraft.mood ?? 3)
                        setSleepQuality(localDraft.sleepQuality ?? 3)
                        setNotes(localDraft.notes ?? '')
                        setSupersets(localDraft.supersets ?? [])
                        userChangedRef.current = true
                        console.info('[program] restored local draft (no server entry)')
                    } else {
                        setExerciseData({})
                        setEnergyLevel(5)
                        setMood(3)
                        setSleepQuality(3)
                        setNotes('')
                        setSupersets([])
                    }
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
            } catch (e) {
                console.error('Error loading entry:', e)
                // Сеть/RLS отвалились — пробуем хотя бы поднять локальный
                // черновик, чтобы пользователь не остался с пустыми полями.
                if (localDraft?.exerciseData) {
                    setExerciseData(localDraft.exerciseData)
                    setEnergyLevel(localDraft.energyLevel ?? 5)
                    setMood(localDraft.mood ?? 3)
                    setSleepQuality(localDraft.sleepQuality ?? 3)
                    setNotes(localDraft.notes ?? '')
                    setSupersets(localDraft.supersets ?? [])
                    userChangedRef.current = true
                    setSaveStatus('error')
                    setSaveError('Не удалось загрузить с сервера, восстановлен локальный черновик')
                }
            } finally {
                dataLoadedRef.current = true
            }
        }
        loadEntry()
    }, [program, currentDayIndex, user, backupKey])

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
    const metaRef = useRef({ supersets })
    useEffect(() => { metaRef.current = { supersets } }, [supersets])

    /**
     * Снимок текущего состояния тренировочного дня для записи в БД.
     * Вынесен отдельно, чтобы:
     *  - сохранять идентичную структуру в БД и в localStorage-бэкап;
     *  - не дублировать логику сборки __meta__ в трёх местах.
     */
    const buildEntrySnapshot = useCallback(() => {
        const { exerciseData: ed, energyLevel: el, mood: m, sleepQuality: sq, notes: n } = latestDataRef.current
        const { supersets: ss } = metaRef.current
        return {
            entryData: { ...ed, __meta__: { supersets: ss } as DayMeta },
            metadata: { energy_level: el, mood: m, sleep_quality: sq, notes: n },
            raw: { exerciseData: ed, energyLevel: el, mood: m, sleepQuality: sq, notes: n, supersets: ss },
        }
    }, [])

    /**
     * Локальный бэкап последнего состояния. Пишется СРАЗУ при любом
     * вводе пользователя — чтобы данные не терялись при hard reload,
     * сетевом сбое или вкладке, закрытой до завершения сохранения.
     *
     * Чистится только после подтверждённого ответа от сервера в saveEntry.
     */
    const writeLocalDraft = useCallback((dayNumber: number) => {
        try {
            const snap = buildEntrySnapshot()
            localStorage.setItem(
                backupKey(dayNumber),
                JSON.stringify({ ...snap.raw, savedAt: Date.now() }),
            )
        } catch (e) {
            // localStorage может быть переполнен / приватный режим — это не фатально.
            console.warn('[program] localStorage write failed:', e)
        }
    }, [backupKey, buildEntrySnapshot])

    /**
     * Сохранение записи дня. Гарантии:
     *
     *  - Никогда не запускается параллельно (inFlightRef как mutex).
     *    Повторный вызов во время выполнения помечает pendingRef и
     *    стартует ещё раз сразу после завершения текущего, со свежими
     *    данными из latestDataRef. Это убирает «зависание» кнопки —
     *    она всегда отрабатывает за один click + один in-flight цикл.
     *
     *  - Имеет таймаут (см. withTimeout в services/training.ts).
     *    Если сеть/RLS подвисли, через 12с упадёт reject, isSaving сбросится,
     *    кнопка станет снова кликабельной.
     *
     *  - Локальный бэкап снимается только после успеха upsert. До этого
     *    при перезагрузке восстановим черновик и попробуем досохранить.
     *
     *  - silent=true (автосейв) не показывает «✓ Сохранено», но всё равно
     *    обновляет saveStatus, чтобы пользователь видел индикатор.
     *
     * @returns true если сохранилось, false если упало (но кнопка свободна)
     */
    const saveEntry = useCallback(async (silent = false): Promise<boolean> => {
        if (!program || !user) return false
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return false

        // Если запрос уже в полёте — отметим, что нужен повторный прогон,
        // и выйдем. Текущий saveEntry внутри finally сам перезапустится.
        if (inFlightRef.current) {
            pendingRef.current = true
            return false
        }
        inFlightRef.current = true

        if (!silent) setIsSaving(true)
        setSaveStatus('saving')
        setSaveError(null)

        try {
            const snap = buildEntrySnapshot()
            await upsertTrainingEntry(program.id, currentDay.dayNumber, snap.entryData, snap.metadata)

            lastSavedAtRef.current = Date.now()
            // Серверная запись подтверждена — локальный бэкап больше не нужен,
            // но оставим его до следующего ввода (на случай мгновенного reload).
            // Перезапишем «согласованным» снимком с пометкой времени.
            try {
                localStorage.setItem(
                    backupKey(currentDay.dayNumber),
                    JSON.stringify({ ...snap.raw, savedAt: lastSavedAtRef.current }),
                )
            } catch { /* noop */ }

            setSaveStatus('saved')
            if (!silent) {
                setSaveMessage('✓ Сохранено')
                setTimeout(() => setSaveMessage(''), 2000)
            }
            // Через 1.5с возвращаем idle — но только если не появилось новых правок.
            setTimeout(() => {
                setSaveStatus(prev => prev === 'saved' ? 'idle' : prev)
            }, 1500)
            return true
        } catch (e: any) {
            console.error('Error saving:', e)
            setSaveStatus('error')
            setSaveError(e?.message || 'Ошибка сохранения')
            if (!silent) setSaveMessage('Ошибка сохранения — попробуй ещё раз')
            return false
        } finally {
            inFlightRef.current = false
            if (!silent) setIsSaving(false)
            // Если за время сохранения накопились новые правки —
            // сразу запускаем ещё один проход (silent), чтобы не терять их.
            if (pendingRef.current) {
                pendingRef.current = false
                // Маленький timeout, чтобы дать React зафиксировать стейт-апдейты.
                setTimeout(() => { saveEntryRef.current?.(true) }, 50)
            }
        }
    }, [program, currentDayIndex, user, buildEntrySnapshot, backupKey])

    // Ref на актуальный saveEntry, чтобы можно было дёргать его внутри
    // самого saveEntry (для pending-проброса) и из flush-on-unmount без
    // ловушки stale-closure.
    const saveEntryRef = useRef(saveEntry)
    useEffect(() => { saveEntryRef.current = saveEntry }, [saveEntry])

    // ─── Автосохранение по дебаунсу 800мс после любого ввода ────────────────
    // Раньше было 1500мс, но это слишком долго: пользователь успевает
    // нажать «Сохранить» вручную и попадает в гонку с автосейвом. 800мс —
    // тот же порог, что у CheckinBlock, проверен и работает стабильно.
    useEffect(() => {
        if (!dataLoadedRef.current || !userChangedRef.current) return
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return

        // Сразу пишем локальный бэкап — даже если сеть отвалится,
        // данные не пропадут после reload.
        writeLocalDraft(currentDay.dayNumber)
        setSaveStatus(prev => prev === 'saved' ? 'idle' : prev)

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => {
            saveEntryRef.current?.(true)
        }, 800)

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
                debounceTimerRef.current = null
            }
        }
    }, [exerciseData, energyLevel, mood, sleepQuality, notes, supersets, program, currentDayIndex, writeLocalDraft])

    // Финальный flush при размонтировании / закрытии вкладки.
    // Если пользователь успел нажать «Сохранить» прямо перед уходом со страницы,
    // и debounce ещё не сработал — попробуем сделать last-chance save через sendBeacon? Нет:
    // используем синхронный сценарий — debounce уже отработает на ближайшем тике, плюс
    // localStorage гарантирует, что после открытия вкладки заново данные восстановятся.
    useEffect(() => {
        const onBeforeUnload = () => {
            if (!program) return
            const currentDay = program.program_data.days[currentDayIndex]
            if (!currentDay) return
            // Принудительно дописываем актуальный черновик в localStorage —
            // последняя линия защиты от потери ввода.
            writeLocalDraft(currentDay.dayNumber)
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [program, currentDayIndex, writeLocalDraft])

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
        // Защита от двойного клика и от гонки с автосейвом
        if (inFlightRef.current) return
        inFlightRef.current = true
        // Если есть «висящий» дебаунс — отменяем, чтобы не записать дважды
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        setIsSaving(true)
        setSaveStatus('saving')
        const finalDuration = workoutStartTime !== null
            ? Math.floor((Date.now() - workoutStartTime) / 1000)
            : elapsedSeconds || undefined
        try {
            const snap = buildEntrySnapshot()
            await upsertTrainingEntry(program.id, currentDay.dayNumber, snap.entryData, {
                ...snap.metadata,
                workout_duration_seconds: finalDuration,
            })
            await completeTrainingDay(program.id, currentDay.dayNumber)

            // Если это последний день недели — автоматически фиксируем чек-ин клиента,
            // чтобы тренер видел финализированные ответы в дневнике.
            if (currentDayIndex === program.program_data.days.length - 1) {
                await markWeeklyCheckinCompleted(program.id)
            }

            setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
            setSavedDuration(finalDuration ?? null)
            setWorkoutStartTime(null)
            // Очищаем сохранённое время старта и локальный черновик —
            // день закрыт, данные на сервере подтверждены.
            localStorage.removeItem(`workout_start_${program.id}_${currentDay.dayNumber}`)
            try { localStorage.removeItem(backupKey(currentDay.dayNumber)) } catch { /* noop */ }
            setSaveStatus('saved')
            setSaveMessage('✓ Тренировка завершена!')
            setTimeout(() => setSaveMessage(''), 3000)
            setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500)
        } catch (e: any) {
            console.error('Error completing:', e)
            setSaveStatus('error')
            setSaveError(e?.message || 'Ошибка завершения')
            setSaveMessage('Ошибка — попробуй ещё раз')
        } finally {
            setIsSaving(false)
            inFlightRef.current = false
        }
    }

    const handleSaveCompleted = async () => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        if (inFlightRef.current) return
        inFlightRef.current = true
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        setIsSaving(true)
        setSaveStatus('saving')
        try {
            const snap = buildEntrySnapshot()
            await upsertTrainingEntry(program.id, currentDay.dayNumber, snap.entryData, {
                ...snap.metadata,
                workout_duration_seconds: savedDuration ?? undefined,
            })
            setSaveStatus('saved')
            setSaveMessage('✓ Правки сохранены')
            setTimeout(() => setSaveMessage(''), 2000)
            setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500)
        } catch (e: any) {
            console.error('Error saving completed entry:', e)
            setSaveStatus('error')
            setSaveError(e?.message || 'Ошибка сохранения')
            setSaveMessage('Ошибка сохранения — попробуй ещё раз')
        } finally {
            setIsSaving(false)
            inFlightRef.current = false
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

    if (authLoading || isLoading || !program) {
        return <PageLoadingFallback />
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
    const orderedExercises = currentDay.exercises

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

                {/* Статистика за прошлую неделю — три раздела от тренера */}
                {program.program_data.prevWeekStats && (
                    program.program_data.prevWeekStats.coachSummary ||
                    program.program_data.prevWeekStats.volumeSummary ||
                    program.program_data.prevWeekStats.wellnessSummary
                ) && (
                    <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/5 overflow-hidden">
                        <button
                            onClick={() => setIsPrevWeekCollapsed(v => !v)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/10 transition-colors"
                        >
                            <span className="text-lg flex-shrink-0">📊</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-display font-bold text-accent">Статистика за прошлую неделю</div>
                                <div className="text-xs text-text-muted mt-0.5">Резюме тренера, объём и самочувствие</div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-accent/60 transition-transform duration-200 flex-shrink-0 ${isPrevWeekCollapsed ? '' : 'rotate-180'}`} />
                        </button>

                        {!isPrevWeekCollapsed && (
                            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-accent/15">
                                {program.program_data.prevWeekStats.coachSummary && (
                                    <div className="rounded-xl border border-accent/20 overflow-hidden">
                                        <button
                                            onClick={() => setIsPrevCoachCollapsed(v => !v)}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-accent/10 hover:bg-accent/15 transition-colors"
                                        >
                                            <span className="text-accent text-base flex-shrink-0">📝</span>
                                            <span className="text-sm font-semibold text-accent flex-1">Резюме тренера</span>
                                            <ChevronDown className={`w-4 h-4 text-accent/60 transition-transform duration-200 ${isPrevCoachCollapsed ? '' : 'rotate-180'}`} />
                                        </button>
                                        {!isPrevCoachCollapsed && (
                                            <div className="px-3 py-2.5 bg-accent/5">
                                                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                                    {program.program_data.prevWeekStats.coachSummary}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {program.program_data.prevWeekStats.volumeSummary && (
                                    <div className="rounded-xl border border-blue-500/20 overflow-hidden">
                                        <button
                                            onClick={() => setIsPrevVolumeCollapsed(v => !v)}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-blue-500/10 hover:bg-blue-500/15 transition-colors"
                                        >
                                            <span className="text-base flex-shrink-0">📈</span>
                                            <span className="text-sm font-semibold text-blue-400 flex-1">Объём и интенсивность</span>
                                            <ChevronDown className={`w-4 h-4 text-blue-400/60 transition-transform duration-200 ${isPrevVolumeCollapsed ? '' : 'rotate-180'}`} />
                                        </button>
                                        {!isPrevVolumeCollapsed && (
                                            <div className="px-3 py-2.5 bg-blue-500/5">
                                                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                                    {program.program_data.prevWeekStats.volumeSummary}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {program.program_data.prevWeekStats.wellnessSummary && (
                                    <div className="rounded-xl border border-emerald-500/20 overflow-hidden">
                                        <button
                                            onClick={() => setIsPrevWellnessCollapsed(v => !v)}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
                                        >
                                            <span className="text-base flex-shrink-0">💚</span>
                                            <span className="text-sm font-semibold text-emerald-400 flex-1">Самочувствие со слов клиента</span>
                                            <ChevronDown className={`w-4 h-4 text-emerald-400/60 transition-transform duration-200 ${isPrevWellnessCollapsed ? '' : 'rotate-180'}`} />
                                        </button>
                                        {!isPrevWellnessCollapsed && (
                                            <div className="px-3 py-2.5 bg-emerald-500/5">
                                                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                                    {program.program_data.prevWeekStats.wellnessSummary}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

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
                        <div className="mb-2 rounded-xl border border-accent/20 overflow-hidden">
                            <button
                                onClick={() => setIsWeeklyNoteCollapsed(v => !v)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-accent/10 hover:bg-accent/15 transition-colors"
                            >
                                <span className="text-accent text-base flex-shrink-0">💬</span>
                                <span className="text-sm font-semibold text-accent flex-1">Рекомендация тренера</span>
                                <ChevronDown className={`w-4 h-4 text-accent/60 transition-transform duration-200 ${isWeeklyNoteCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            {!isWeeklyNoteCollapsed && (
                                <div className="px-3 py-2.5 bg-accent/5">
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                        {program.program_data.weeklyNote}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {program.program_data.weekContext && (
                        <div className="mb-2 rounded-xl border border-blue-500/20 overflow-hidden">
                            <button
                                onClick={() => setIsWeekContextCollapsed(v => !v)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-blue-500/10 hover:bg-blue-500/15 transition-colors"
                            >
                                <span className="text-base flex-shrink-0">📖</span>
                                <span className="text-sm font-semibold text-blue-400 flex-1">Контекст недели</span>
                                <ChevronDown className={`w-4 h-4 text-blue-400/60 transition-transform duration-200 ${isWeekContextCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            {!isWeekContextCollapsed && (
                                <div className="px-3 py-2.5 bg-blue-500/5">
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                        {program.program_data.weekContext}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {program.program_data.redFlags && (
                        <div className="mb-2 rounded-xl border border-danger/20 overflow-hidden">
                            <button
                                onClick={() => setIsRedFlagsCollapsed(v => !v)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-danger/10 hover:bg-danger/15 transition-colors"
                            >
                                <span className="text-base flex-shrink-0">🚩</span>
                                <span className="text-sm font-semibold text-danger flex-1">Красные флаги</span>
                                <ChevronDown className={`w-4 h-4 text-danger/60 transition-transform duration-200 ${isRedFlagsCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            {!isRedFlagsCollapsed && (
                                <div className="px-3 py-2.5 bg-danger/5">
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                        {program.program_data.redFlags}
                                    </p>
                                </div>
                            )}
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
                        <div className="rounded-xl border border-accent/20 overflow-hidden">
                            <button
                                onClick={() => setIsDayNoteCollapsed(v => !v)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-left bg-accent/10 hover:bg-accent/15 transition-colors"
                            >
                                <span className="text-accent text-lg flex-shrink-0">📋</span>
                                <span className="text-sm font-semibold text-accent flex-1">Рекомендация тренера на сегодня</span>
                                <ChevronDown className={`w-4 h-4 text-accent/60 transition-transform duration-200 ${isDayNoteCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            {!isDayNoteCollapsed && (
                                <div className="px-4 py-3 bg-accent/5">
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                        {currentDay.coachNote}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {currentDay.dayContext && (
                        <div className="rounded-xl border border-blue-500/20 overflow-hidden">
                            <button
                                onClick={() => setIsDayContextCollapsed(v => !v)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-left bg-blue-500/10 hover:bg-blue-500/15 transition-colors"
                            >
                                <span className="text-base flex-shrink-0">📝</span>
                                <span className="text-sm font-semibold text-blue-400 flex-1">Детали дня</span>
                                <ChevronDown className={`w-4 h-4 text-blue-400/60 transition-transform duration-200 ${isDayContextCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            {!isDayContextCollapsed && (
                                <div className="px-4 py-3 bg-blue-500/5">
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                        {currentDay.dayContext}
                                    </p>
                                </div>
                            )}
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
                                    className="transition-all duration-150"
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

                {/* Чек-ин в конце недели — рендерится после Самочувствия, перед кнопками */}

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

                {/* Чек-ин в конце недели — на последнем тренировочном дне, после Самочувствия */}
                {currentDayIndex === program.program_data.days.length - 1 && program.program_data.checkin && user && (
                    <CheckinBlock
                        programId={program.id}
                        userId={user.id}
                        text={program.program_data.checkin}
                    />
                )}

                {/* Кнопки */}
                {!isCurrentDayCompleted ? (
                    <div className="space-y-2">
                        {/* Индикатор статуса автосохранения — пользователь всегда видит,
                            что данные либо уже сохранены, либо сохраняются прямо сейчас.
                            Это снимает ощущение «нажал и ничего не понятно».
                            min-w-0 + truncate — на узких мобильных экранах сообщение об
                            ошибке (текст таймаута/код) не выпирает за края контейнера. */}
                        <div className="flex items-center justify-end gap-2 text-xs min-h-[16px] min-w-0">
                            {saveStatus === 'saving' && (
                                <span className="text-text-muted flex items-center gap-1.5 truncate">
                                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                                    <span className="truncate">Сохраняю...</span>
                                </span>
                            )}
                            {saveStatus === 'saved' && (
                                <span className="text-success truncate">✓ Сохранено автоматически</span>
                            )}
                            {saveStatus === 'error' && (
                                <span className="text-red-400 truncate" title={saveError ?? undefined}>
                                    ⚠ {saveError ?? 'Ошибка автосохранения, нажми «Сохранить»'}
                                </span>
                            )}
                            {saveStatus === 'idle' && lastSavedAtRef.current !== null && (
                                <span className="text-text-muted truncate">Все изменения сохранены</span>
                            )}
                        </div>
                        <div className="flex gap-2 sm:gap-3">
                            <button onClick={() => saveEntry(false)} disabled={isSaving}
                                className="glass-button-secondary flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 min-w-0">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <span className="flex-shrink-0">💾</span>}
                                <span className="truncate">Сохранить</span>
                            </button>
                            <button onClick={handleCompleteDay} disabled={isSaving}
                                className="glass-button flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 min-w-0">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                                <span className="truncate">{currentDayIndex === program.program_data.days.length - 1 ? 'Завершить неделю' : 'Завершить'}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="glass-card p-4 flex items-center justify-center gap-2 text-success">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-semibold">
                                {currentDayIndex === program.program_data.days.length - 1
                                    ? 'Неделя завершена'
                                    : `День ${currentDay.dayNumber} завершён`}
                            </span>
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
