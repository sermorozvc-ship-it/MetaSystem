'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Play, CheckCircle2, Loader2, ChevronLeft, ChevronRight,
    X, Maximize2, Minimize2, ChevronDown, ChevronUp, Timer, Clock,
    Lock, RefreshCw, Link2, Check, Square, RotateCcw,
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
import { tryRefreshSession, getAccessTokenWithRecovery } from '@/lib/supabase/client'

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

interface TrainingDebugEvent {
    ts: string
    type: string
    details?: Record<string, any>
}

const TRAINING_DEBUG_KEY_PREFIX = 'training_debug_'
const TRAINING_DEBUG_MAX_EVENTS = 250

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
    setStatuses,
    onSaveSet,
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
    /** Карта статусов сохранения для подходов этого упражнения (key = setIdx). */
    setStatuses?: Record<number, 'dirty' | 'saving' | 'saved' | 'error'>
    /** Клик по индикатору подхода — запрашивает ручное сохранение. */
    onSaveSet?: (setIdx: number) => void
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
                            <div className="w-7" />
                        </div>
                        {Array.from({ length: totalSets }).map((_, setIdx) => {
                            const setData = data.sets[setIdx] || { weight: '', reps: '', rir: '', setComment: '' }
                            const plannedWeight = targetWeights[setIdx] ?? 0
                            const isExtra = setIdx >= plannedSets
                            const setStatus = setStatuses?.[setIdx]

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
                                            placeholder={plannedWeight > 0 ? String(plannedWeight) : '—'} />
                                        <input type="number" value={setData.reps}
                                            onChange={e => updateSet(setIdx, 'reps', e.target.value)}
                                            className="glass-input text-sm py-2 px-2 text-center min-w-0 font-semibold"
                                            placeholder={activeExercise.reps.split('-')[0] || '—'} />
                                        <input type="number" min="0" max="5" value={setData.rir}
                                            onChange={e => updateSet(setIdx, 'rir', e.target.value)}
                                            className="glass-input text-sm py-2 px-2 text-center min-w-0 font-semibold"
                                            placeholder="2" />

                                        {/* Индикатор/кнопка сохранения подхода.
                                            dirty  → зелёная кнопка (нажми чтобы сохранить)
                                            saving → спиннер
                                            saved  → зелёная галочка (не кнопка)
                                            error  → красный ⚠ (нажми чтобы повторить) */}
                                        <div className="w-7 flex justify-center">
                                            {setStatus === 'dirty' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onSaveSet?.(setIdx)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-success/20 border border-success/50 text-success hover:bg-success/35 transition-colors"
                                                    title="Сохранить подход"
                                                    aria-label="Сохранить подход"
                                                >
                                                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                </button>
                                            )}
                                            {setStatus === 'saving' && (
                                                <div
                                                    className="w-7 h-7 flex items-center justify-center text-text-muted"
                                                    title="Сохраняю…"
                                                    aria-label="Сохраняю"
                                                >
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                </div>
                                            )}
                                            {setStatus === 'saved' && (
                                                <div
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-success/25 border border-success/60 text-success"
                                                    title="Сохранено"
                                                    aria-label="Сохранено"
                                                >
                                                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                </div>
                                            )}
                                            {setStatus === 'error' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onSaveSet?.(setIdx)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 transition-colors"
                                                    title="Ошибка сохранения — нажми, чтобы повторить"
                                                    aria-label="Повторить сохранение"
                                                >
                                                    <span className="text-xs leading-none">⚠</span>
                                                </button>
                                            )}
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

    // Ключ локального бэкапа — страховка от потери ответов при reload/сетевом сбое.
    const draftKey = `checkin_draft_${programId}`

    // Всегда свежие answers для flush из обработчиков (blur/pagehide),
    // чтобы не ловить stale-closure.
    const answersRef = useRef(answers)
    useEffect(() => { answersRef.current = answers }, [answers])

    // Загружаем существующий чек-ин. Если локальный черновик новее серверного
    // updated_at — восстанавливаем его (последнее сохранение не дошло).
    useEffect(() => {
        let cancelled = false
        let localDraft: { answers?: Record<string, string>; savedAt?: number } | null = null
        try {
            const raw = localStorage.getItem(draftKey)
            if (raw) localDraft = JSON.parse(raw)
        } catch { /* noop */ }

        getWeeklyCheckin(programId)
            .then(checkin => {
                if (cancelled) return
                const serverUpdatedAt = checkin?.updated_at ? new Date(checkin.updated_at).getTime() : 0
                const draftIsNewer = !!localDraft?.savedAt && localDraft.savedAt > serverUpdatedAt + 1000
                if (checkin) {
                    setCompletedAt(checkin.completed_at)
                    if (draftIsNewer && localDraft?.answers && !checkin.completed_at) {
                        setAnswers(localDraft.answers)
                        dirtyRef.current = true   // досохраним
                        console.info('[checkin] restored local draft (newer than server)')
                    } else {
                        setAnswers(checkin.answers || {})
                        try { localStorage.removeItem(draftKey) } catch { /* noop */ }
                    }
                } else if (localDraft?.answers) {
                    // Записи на сервере нет, но есть черновик — поднимаем его.
                    setAnswers(localDraft.answers)
                    dirtyRef.current = true
                }
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [programId, draftKey])

    // ─── Сохранение с мьютексом + очередью ──────────────────────────────────
    // Гарантии (как в основном дневнике):
    //  - параллельных upsert нет (inFlightRef);
    //  - правки во время сохранения не теряются (pendingRef → повтор);
    //  - upsertWeeklyCheckin обёрнут в withTimeout — спиннер «Сохраняю...»
    //    больше не висит вечно при флапающей сети.
    const dirtyRef = useRef(false)
    const inFlightRef = useRef(false)
    const pendingRef = useRef(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const doSave = useCallback(async () => {
        if (inFlightRef.current) { pendingRef.current = true; return }
        inFlightRef.current = true
        setSaveStatus('saving')
        setError(null)
        try {
            await upsertWeeklyCheckin({ programId, userId, answers: answersRef.current })
            dirtyRef.current = false
            try { localStorage.removeItem(draftKey) } catch { /* noop */ }
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 1500)
        } catch (e: any) {
            setSaveStatus('error')
            setError(e?.message || 'Ошибка сохранения')
        } finally {
            inFlightRef.current = false
            if (pendingRef.current) {
                pendingRef.current = false
                setTimeout(() => { void doSave() }, 50)
            }
        }
    }, [programId, userId, draftKey])

    // Немедленный сброс (flush): отменяет дебаунс и сохраняет сейчас.
    // Вызывается при blur поля и при уходе со страницы — закрывает дыру
    // «ввёл ответ → сразу нажал Завершить, дебаунс не успел».
    const flush = useCallback(() => {
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
        if (dirtyRef.current) void doSave()
    }, [doSave])

    // Debounce-автосохранение 800мс
    useEffect(() => {
        if (!dirtyRef.current) return
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { void doSave() }, 800)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [answers, doSave])

    // Flush при уходе со страницы / сворачивании вкладки — последняя линия защиты.
    useEffect(() => {
        const onHide = () => {
            // Пишем черновик синхронно (сеть может не успеть на pagehide).
            try {
                if (dirtyRef.current) {
                    localStorage.setItem(draftKey, JSON.stringify({ answers: answersRef.current, savedAt: Date.now() }))
                }
            } catch { /* noop */ }
            flush()
        }
        const onVisibility = () => { if (document.visibilityState === 'hidden') onHide() }
        window.addEventListener('pagehide', onHide)
        window.addEventListener('beforeunload', onHide)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('pagehide', onHide)
            window.removeEventListener('beforeunload', onHide)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [flush, draftKey])

    const updateAnswer = (key: string, value: string) => {
        setAnswers(prev => ({ ...prev, [key]: value }))
        dirtyRef.current = true
        // Сразу пишем локальный черновик — данные не пропадут даже если
        // вкладку закроют до срабатывания дебаунса.
        try {
            localStorage.setItem(draftKey, JSON.stringify({
                answers: { ...answersRef.current, [key]: value },
                savedAt: Date.now(),
            }))
        } catch { /* noop */ }
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
                                                onBlur={flush}
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
                                                onBlur={flush}
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
                                                onBlur={flush}
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
    const [isWarmupCollapsed, setIsWarmupCollapsed] = useState(true)
    const [isCooldownCollapsed, setIsCooldownCollapsed] = useState(true)
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
    // Если задано — таймер «остановлен» вручную (кнопка Стоп). Хранит зафиксированное число секунд.
    // Сессионное состояние: не персистится в localStorage, сбрасывается при загрузке дня.
    const [stoppedDuration, setStoppedDuration] = useState<number | null>(null)

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
    // Поколение лока. Каждый раз, когда новая операция захватывает лок,
    // счётчик увеличивается. finally-блоки старых операций проверяют
    // поколение и НЕ сбрасывают inFlightRef, если лок уже захвачен
    // новой операцией (handleCompleteDay после force-release).
    const lockGenerationRef = useRef(0)
    // Когда был захвачен inFlightRef. Нужно для защиты от «вечного» лока:
    // если по какой-то причине finally не отработал (например вкладку
    // усыпили прямо во время запроса и таймер withTimeout не сработал),
    // лок старше STALE_LOCK_MS считается протухшим и принудительно снимается.
    // Иначе кнопки «Сохранить»/«Завершить» залипали бы до hard reload.
    const inFlightSinceRef = useRef<number>(0)
    // 15с = чуть больше сетевого таймаута withTimeout (12с). Логика: если
    // upsert честно отрабатывает, его finally снимет лок задолго до 15с. Если
    // же лок «висит» дольше 15с — значит finally не отработал (заморозка
    // вкладки / оборванная сеть при смене VPN), и лок надо принудительно снять.
    // Раньше было 20с — лишние 8с «вечного спиннера» после пробуждения вкладки.
    const STALE_LOCK_MS = 15_000
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [saveError, setSaveError] = useState<string | null>(null)
    const debugEventsRef = useRef<TrainingDebugEvent[]>([])
    const debugStorageKey = `${TRAINING_DEBUG_KEY_PREFIX}${programId}`

    const pushDebugEvent = useCallback((type: string, details?: Record<string, any>) => {
        const event: TrainingDebugEvent = {
            ts: new Date().toISOString(),
            type,
            details,
        }
        const nextEvents = [...debugEventsRef.current, event].slice(-TRAINING_DEBUG_MAX_EVENTS)
        debugEventsRef.current = nextEvents

        if (typeof window !== 'undefined') {
            ;(window as any).__trainingDebug = {
                events: nextEvents,
                dump: () => nextEvents,
                latest: () => nextEvents[nextEvents.length - 1] ?? null,
                clear: () => {
                    debugEventsRef.current = []
                    try { localStorage.removeItem(debugStorageKey) } catch { /* noop */ }
                },
            }
            try {
                localStorage.setItem(debugStorageKey, JSON.stringify(nextEvents))
            } catch { /* noop */ }
        }

        console.info('[training-debug]', type, details ?? {})
    }, [debugStorageKey])

    // true если лок свободен ИЛИ протух — можно стартовать новую операцию.
    const lockIsFree = useCallback(() => {
        if (!inFlightRef.current) return true
        if (Date.now() - inFlightSinceRef.current > STALE_LOCK_MS) {
            console.warn('[program] stale in-flight lock force-released after', STALE_LOCK_MS, 'ms')
            pushDebugEvent('lock_force_released', {
                heldForMs: Date.now() - inFlightSinceRef.current,
                staleThresholdMs: STALE_LOCK_MS,
            })
            inFlightRef.current = false
            // КРИТИЧНО: снимаем и визуальный спиннер. Раньше тут сбрасывался
            // только ref — и кнопка оставалась disabled со «Сохраняю...", пока
            // пользователь не перезагрузит страницу. На телефоне (экран гаснет
            // между подходами → вкладка заморожена → таймер withTimeout не
            // тикал) это и был тот самый вечный спиннер.
            setIsSaving(false)
            setSaveStatus(prev => prev === 'saving' ? 'idle' : prev)
            return true
        }
        return false
    }, [pushDebugEvent])

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Таймер отложенного ретрая после ошибки автосейва (1 ретрай через 3с, без рекурсии).
    // Очищается при ручном save / при размонтировании / при следующем вводе.
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Счётчик последовательных ошибок автосейва. Сбрасывается при успехе.
    // Если превышен — автосейв-ретрай останавливается, чтобы не держать
    // inFlightRef вечно (иначе кнопка «Завершить» залипает).
    const consecutiveSaveErrorsRef = useRef(0)

    const resetSavingState = useCallback((nextStatus: 'idle' | 'error' = 'idle') => {
        pushDebugEvent('reset_saving_state', {
            nextStatus,
            wasSaving: isSaving,
            prevSaveStatus: saveStatus,
            inFlight: inFlightRef.current,
        })
        setIsSaving(false)
        setSaveStatus(prev => prev === 'saving' ? nextStatus : (nextStatus === 'error' ? 'error' : prev))
        inFlightRef.current = false
    }, [isSaving, pushDebugEvent, saveStatus])

    // ─── Per-set save status ───────────────────────────────────────────────
    // Ключ: `${exerciseId}::${setIdx}`. Хранится только для подходов, по
    // которым есть актуальный статус — после успешного сейва ключи удаляются
    // через 2 секунды (короткий «✓ Сохранено» прямо на строке подхода).
    // Это даёт пользователю мгновенную и точечную обратную связь — без
    // визуального шума глобального «Сохраняю...» внизу страницы.
    type SetSaveStatus = 'dirty' | 'saving' | 'saved' | 'error'
    const [setSaveStates, setSetSaveStates] = useState<Record<string, SetSaveStatus>>({})
    // Снимок ключей, переведённых в 'saving' в начале последнего сейва.
    // По завершении сейва переводим именно их в 'saved' / 'error', не трогая
    // подходы, которые юзер успел отредактировать ВО ВРЕМЯ запроса
    // (они останутся 'dirty' и будут обработаны следующим сейвом).
    const savingSetKeysRef = useRef<string[]>([])
    const setSaveFadeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
    const setKey = (exId: string, idx: number) => `${exId}::${idx}`
    const lastSavedAtRef = useRef<number | null>(null)

    // Снимок entry_data, последний раз подтверждённый сервером. Нужен для
    // защиты от деструктивной записи: автосейв не должен затирать упражнения,
    // которые уже заполнены на сервере (возможно, с другого устройства).
    const lastServerEntryRef = useRef<Record<string, any> | null>(null)

    // Ключ локального бэкапа на (программа, день) — страховка от потери ввода
    // при перезагрузке страницы / падении сети до ответа Supabase.
    const backupKey = useCallback((dayNumber: number) => {
        return `training_draft_${programId}_${dayNumber}`
    }, [programId])

    // Ref на актуального user — нужен внутри отложенной перепроверки гварда,
    // чтобы не словить stale-closure после grace-периода.
    const userRef = useRef(user)
    useEffect(() => { userRef.current = user }, [user])

    // Auth-guard с grace-периодом.
    // ВАЖНО (см. .kiro/steering/desktop-page-load.md): НЕ редиректим на /auth
    // по первому же null. При смене VPN / обновлении access_token user на
    // доли секунды бывает null, пока onAuthStateChange не восстановит сессию.
    // Мгновенный router.replace('/auth') в этот момент выбрасывал со страницы
    // прямо во время тренировки («страница сама закрылась»). Ждём 3с и
    // перепроверяем: если сессия вернулась — остаёмся.
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = localStorage.getItem(debugStorageKey)
            if (raw) {
                const restored = JSON.parse(raw)
                if (Array.isArray(restored)) {
                    debugEventsRef.current = restored.slice(-TRAINING_DEBUG_MAX_EVENTS)
                }
            }
        } catch { /* noop */ }

        ;(window as any).__trainingDebug = {
            events: debugEventsRef.current,
            dump: () => debugEventsRef.current,
            latest: () => debugEventsRef.current[debugEventsRef.current.length - 1] ?? null,
            clear: () => {
                debugEventsRef.current = []
                try { localStorage.removeItem(debugStorageKey) } catch { /* noop */ }
            },
        }

        pushDebugEvent('page_mount', {
            programId,
            hasUser: !!user,
        })

        return () => {
            pushDebugEvent('page_unmount', {
                isSaving,
                saveStatus,
                hasUser: !!userRef.current,
            })
        }
    }, [debugStorageKey, programId, pushDebugEvent])

    useEffect(() => {
        pushDebugEvent('auth_state', {
            authLoading,
            hasUser: !!user,
        })
    }, [authLoading, user, pushDebugEvent])

    useEffect(() => {
        pushDebugEvent('save_state', {
            isSaving,
            saveStatus,
            saveError,
            inFlight: inFlightRef.current,
        })
    }, [isSaving, saveStatus, saveError, pushDebugEvent])

    useEffect(() => {
        const onVisible = () => pushDebugEvent('visibility_change', { state: document.visibilityState })
        const onFocus = () => pushDebugEvent('window_focus')
        const onBlur = () => pushDebugEvent('window_blur')
        const onOnline = () => pushDebugEvent('network_online')
        const onOffline = () => pushDebugEvent('network_offline')
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onFocus)
        window.addEventListener('blur', onBlur)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', onFocus)
            window.removeEventListener('blur', onBlur)
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [pushDebugEvent])

    useEffect(() => {
        if (authLoading) return
        if (user) return
        const t = setTimeout(() => {
            if (!userRef.current) router.replace('/auth')
        }, 3000)
        return () => clearTimeout(t)
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
                                warmup: day.warmup ?? parsed.days[i]?.warmup,
                                cooldown: day.cooldown ?? parsed.days[i]?.cooldown,
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
        setIsWarmupCollapsed(true)
        setIsCooldownCollapsed(true)
        setIsWeekContextCollapsed(true)
    }, [program, currentDayIndex])

    // Загрузка записи текущего дня
    useEffect(() => {
        if (!program || !user) return
        dataLoadedRef.current = false
        userChangedRef.current = false
        // Сбрасываем известный серверный снимок — пока новая загрузка не
        // подтвердится, автосейв не имеет права писать (см. защиту в
        // useEffect автосейва ниже).
        lastServerEntryRef.current = null
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

            // Сессионный флаг «Стоп» сбрасываем при загрузке любого дня —
            // он намеренно не персистится в localStorage.
            setStoppedDuration(null)

            // Per-set save states тоже сбрасываем — они относятся к
            // прошлому дню/прошлой сессии редактирования и не должны
            // «протекать» в новый день.
            for (const t of setSaveFadeTimersRef.current.values()) clearTimeout(t)
            setSaveFadeTimersRef.current.clear()
            savingSetKeysRef.current = []
            setSetSaveStates({})

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
                    // Запоминаем серверный снимок — он используется для
                    // не деструктивного merge в reconcileWithServer.
                    lastServerEntryRef.current = entry.entry_data || null

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
                    //
                    // ВАЖНО: окно доверия к черновику = 2 минуты. Иначе при
                    // кросс-устройственной синхронизации (ввёл с мобилы → открыл
                    // десктоп, где висит старый черновик) старый черновик
                    // десктопа затирает свежие серверные данные. Если черновик
                    // старше 2 минут — берём сервер как источник правды.
                    //
                    // ДОПОЛНИТЕЛЬНО: даже свежий черновик не должен «уменьшать»
                    // серверный набор. Если на сервере заполнено больше упражнений
                    // — значит черновик устарел, второе устройство дозаполнило.
                    // Берём сервер.
                    const serverUpdatedAt = entry.updated_at ? new Date(entry.updated_at).getTime() : 0
                    const DRAFT_TRUST_WINDOW_MS = 2 * 60 * 1000
                    const draftAge = localDraft?.savedAt ? Date.now() - localDraft.savedAt : Infinity
                    const draftIsNewer = !!localDraft?.savedAt
                        && localDraft.savedAt > serverUpdatedAt + 1000
                        && draftAge < DRAFT_TRUST_WINDOW_MS

                    // Считаем сколько упражнений с заполненными подходами есть
                    // на сервере и в черновике.
                    const countFilled = (data: Record<string, any> | undefined | null): number => {
                        if (!data) return 0
                        let n = 0
                        for (const k of Object.keys(data)) {
                            if (k === '__meta__') continue
                            const ex = (data as any)[k]
                            if (ex?.sets && Array.isArray(ex.sets)
                                && ex.sets.some((s: any) => (s?.weight && String(s.weight).trim() !== '') || (s?.reps && String(s.reps).trim() !== ''))) {
                                n++
                            }
                        }
                        return n
                    }
                    const serverFilled = countFilled(entry.entry_data as any)
                    const draftFilled = countFilled(localDraft?.exerciseData as any)
                    const draftWouldShrink = draftFilled < serverFilled

                    if (draftIsNewer && !draftWouldShrink && localDraft?.exerciseData) {
                        setExerciseData(localDraft.exerciseData)
                        setEnergyLevel(localDraft.energyLevel ?? entry.energy_level ?? 5)
                        setMood(localDraft.mood ?? entry.mood ?? 3)
                        setSleepQuality(localDraft.sleepQuality ?? entry.sleep_quality ?? 3)
                        setNotes(localDraft.notes ?? entry.notes ?? '')
                        setSupersets(localDraft.supersets ?? (entry.entry_data?.__meta__?.supersets || []))
                        // помечаем как «надо досохранить» — после монтирования сработает автосейв
                        userChangedRef.current = true
                        setSaveStatus('idle')
                        console.info('[program] restored local draft (newer than server, age=' + Math.round(draftAge / 1000) + 's)')
                    } else {
                        if (draftIsNewer && draftWouldShrink) {
                            console.info('[program] ignored draft — server has more filled exercises (' + serverFilled + ' vs draft ' + draftFilled + '). Cleaning local draft.')
                            try { localStorage.removeItem(backupKey(currentDay.dayNumber)) } catch { /* noop */ }
                        } else if (localDraft?.savedAt && localDraft.savedAt > serverUpdatedAt + 1000) {
                            console.info('[program] ignored stale local draft (age=' + Math.round(draftAge / 1000) + 's, beyond 2min window) — using server version')
                            // Чистим устаревший черновик, чтобы он не мешал в следующий раз.
                            try { localStorage.removeItem(backupKey(currentDay.dayNumber)) } catch { /* noop */ }
                        }
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
                    // На сервере нет записи (200 + null) — это первое
                    // открытие дня. Сервер ответил, lastServerEntryRef = пустой
                    // объект (но НЕ null — null означает «не знаем что на
                    // сервере», и тогда защита от деструктивной записи отключена).
                    lastServerEntryRef.current = {}
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
                // Сеть/RLS отвалились — НЕ знаем, что на сервере.
                // ОЧЕНЬ ВАЖНО: ставим lastServerEntryRef = null. При null
                // reconcileWithServer не вмешивается (нечего сравнивать), но
                // мы дополнительно НЕ запускаем автосейв на этой загрузке
                // (userChangedRef ставится только если мы реально подняли
                // черновик), чтобы не писать пустоту поверх возможно полных
                // серверных данных.
                lastServerEntryRef.current = null
                // Пробуем хотя бы поднять локальный черновик, чтобы
                // пользователь не остался с пустыми полями.
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
        // Если пользователь явно остановил таймер кнопкой «Стоп» — не перезапускаем
        // автоматически при правке подходов. Только после явного «Сброса» (stoppedDuration=null)
        // следующее изменение подхода снова запустит таймер.
        if (stoppedDuration !== null) return
        const now = Date.now()
        // Сохраняем в localStorage чтобы пережить перезагрузку
        if (program) {
            const key = `workout_start_${program.id}_${program.program_data.days[currentDayIndex]?.dayNumber}`
            localStorage.setItem(key, String(now))
        }
        setWorkoutStartTime(now)
    }, [workoutStartTime, stoppedDuration, program, currentDayIndex])

    // Кнопка «Стоп»: фиксируем текущее значение и останавливаем тикающий счётчик.
    // localStorage очищаем, чтобы после перезагрузки страницы таймер не «дотикал» лишнее.
    const stopTimer = useCallback(() => {
        if (workoutStartTime === null && stoppedDuration === null) return
        const current = workoutStartTime !== null
            ? Math.floor((Date.now() - workoutStartTime) / 1000)
            : elapsedSeconds
        setStoppedDuration(current)
        setElapsedSeconds(current)
        setWorkoutStartTime(null)
        if (program) {
            const key = `workout_start_${program.id}_${program.program_data.days[currentDayIndex]?.dayNumber}`
            localStorage.removeItem(key)
        }
    }, [workoutStartTime, stoppedDuration, elapsedSeconds, program, currentDayIndex])

    // Кнопка «Сброс»: confirm-диалог, обнуление. После сброса следующий ввод подхода
    // снова автоматически запустит таймер с нуля.
    const resetTimer = useCallback(() => {
        if (workoutStartTime === null && stoppedDuration === null && elapsedSeconds === 0) return
        if (typeof window !== 'undefined' && !window.confirm('Сбросить таймер тренировки?')) return
        setWorkoutStartTime(null)
        setElapsedSeconds(0)
        setStoppedDuration(null)
        if (program) {
            const key = `workout_start_${program.id}_${program.program_data.days[currentDayIndex]?.dayNumber}`
            localStorage.removeItem(key)
        }
    }, [workoutStartTime, stoppedDuration, elapsedSeconds, program, currentDayIndex])

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
    /**
     * Сверка с серверным снимком. Раньше здесь был жёсткий БЛОК: если
     * предлагаемая запись «теряла» упражнения, заполненные на сервере, —
     * upsert отменялся (return false). Проблема: lastServerEntryRef при этом
     * не обновлялся, поэтому КАЖДЫЙ следующий save снова блокировался —
     * кнопка «Сохранить» намертво залипала до hard reload.
     *
     * Новое поведение: вместо блокировки — НЕ деструктивный merge. Любое
     * упражнение, которое на сервере имеет заполненные подходы, а в текущем
     * снимке стало пустым/пропало (например другое устройство дозаполнило,
     * а наш стейт устарел), — переносится из серверного снимка в запись.
     * Так данные не теряются И запись всегда проходит — UI не залипает.
     */
    const reconcileWithServer = useCallback((nextEntryData: Record<string, any>): { merged: Record<string, any>; preserved: string[] } => {
        const serverData = lastServerEntryRef.current
        if (!serverData) return { merged: nextEntryData, preserved: [] }

        const hasFilledSets = (ex: any): boolean => {
            if (!ex || !Array.isArray(ex.sets)) return false
            return ex.sets.some((s: any) => (s?.weight && String(s.weight).trim() !== '') || (s?.reps && String(s.reps).trim() !== ''))
        }

        const merged = { ...nextEntryData }
        const preserved: string[] = []
        for (const key of Object.keys(serverData)) {
            if (key === '__meta__') continue
            const serverEx = (serverData as any)[key]
            const nextEx = (nextEntryData as any)[key]
            if (hasFilledSets(serverEx) && !hasFilledSets(nextEx)) {
                merged[key] = serverEx
                preserved.push(key)
            }
        }
        return { merged, preserved }
    }, [])

    const saveEntry = useCallback(async (silent = false): Promise<boolean> => {
        if (!program || !user) return false
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return false

        // Если запрос уже в полёте — отметим, что нужен повторный прогон,
        // и выйдем. Текущий saveEntry внутри finally сам перезапустится.
        // lockIsFree() заодно снимает протухший лок (см. inFlightSinceRef).
        if (!lockIsFree()) {
            pendingRef.current = true
            return false
        }
        inFlightRef.current = true
        inFlightSinceRef.current = Date.now()
        const myGeneration = lockGenerationRef.current
        // Захватили лок — отменяем отложенный ретрай (он сейчас не нужен,
        // мы и так начали новый сейв).
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }

        if (!silent) setIsSaving(true)
        setSaveError(null)

        // Снимок «dirty» подходов → переводим в 'saving', чтобы UI на каждой
        // строке показал спиннер сохранения. По завершении (catch/finally в
        // try ниже) переводим эти же ключи в 'saved' или 'error'.
        // Подходы, отредактированные ВО ВРЕМЯ запроса, останутся 'dirty'
        // и попадут в следующий сейв — мы их сюда не включаем.
        {
            const keys: string[] = []
            for (const [k, v] of Object.entries(setSaveStates)) {
                if (v === 'dirty' || v === 'error') keys.push(k)
            }
            savingSetKeysRef.current = keys
            if (keys.length > 0) {
                setSetSaveStates(prev => {
                    const next = { ...prev }
                    for (const k of keys) next[k] = 'saving'
                    return next
                })
            }
        }

        // Для тихого автосейва индикатор «Сохраняю...» показываем не сразу,
        // а через 400мс. Большинство upsert'ов отрабатывают быстрее — UI
        // не мерцает на каждое нажатие. Для ручного «Сохранить» индикатор
        // включаем сразу, чтобы пользователь видел реакцию на клик.
        let savingIndicatorTimer: ReturnType<typeof setTimeout> | null = null
        if (silent) {
            savingIndicatorTimer = setTimeout(() => {
                setSaveStatus('saving')
                savingIndicatorTimer = null
            }, 400)
        } else {
            setSaveStatus('saving')
        }

        try {
            const snap = buildEntrySnapshot()

            // ─── НЕ деструктивный merge с серверным снимком ──────────────────
            // Если на сервере было больше заполненных упражнений, чем сейчас
            // в стейте (другое устройство дозаполнило / наш стейт устарел) —
            // переносим эти упражнения в запись, чтобы их не потерять.
            // Раньше тут был жёсткий блок, который залипал навсегда — см.
            // комментарий в reconcileWithServer.
            const { merged, preserved } = reconcileWithServer(snap.entryData)
            if (preserved.length > 0) {
                console.warn('[program] preserved', preserved.length, 'server-filled exercises during save:', preserved.join(', '))
                // Подтянем сохранённые с сервера упражнения обратно в UI-стейт,
                // чтобы пользователь увидел, что данные не пропали.
                const restore: Record<string, ExerciseClientData> = {}
                for (const key of preserved) {
                    const ex = (merged as any)[key]
                    if (ex?.sets) restore[key] = { sets: ex.sets, comment: ex.comment || '', selectedAlternativeId: ex.selectedAlternativeId }
                }
                if (Object.keys(restore).length > 0) {
                    setExerciseData(prev => ({ ...restore, ...prev }))
                }
            }

            await upsertTrainingEntry(program.id, currentDay.dayNumber, merged, snap.metadata)

            // Запоминаем, что теперь на сервере — наш только что записанный снимок.
            lastServerEntryRef.current = merged
            // Сброс счётчика ошибок — сейв прошёл.
            consecutiveSaveErrorsRef.current = 0

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

            // Если индикатор «Сохраняю...» так и не успел появиться — гасим таймер
            // и сразу показываем «✓ Сохранено». Иначе пользователь увидит
            // мерцание saving → saved → idle на каждый ввод.
            if (savingIndicatorTimer) {
                clearTimeout(savingIndicatorTimer)
                savingIndicatorTimer = null
            }

            setSaveStatus('saved')
            // Per-set: переводим зафиксированный снимок в 'saved' и через 2с
            // удаляем эти ключи — UI вернётся к чистому виду без галочек.
            if (savingSetKeysRef.current.length > 0) {
                const keys = savingSetKeysRef.current.slice()
                savingSetKeysRef.current = []
                setSetSaveStates(prev => {
                    const next = { ...prev }
                    for (const k of keys) {
                        if (next[k] === 'saving') next[k] = 'saved'
                    }
                    return next
                })
                for (const k of keys) {
                    const existing = setSaveFadeTimersRef.current.get(k)
                    if (existing) clearTimeout(existing)
                    const t = setTimeout(() => {
                        setSaveFadeTimersRef.current.delete(k)
                        setSetSaveStates(prev => {
                            if (prev[k] !== 'saved') return prev
                            const next = { ...prev }
                            delete next[k]
                            return next
                        })
                    }, 2000)
                    setSaveFadeTimersRef.current.set(k, t)
                }
            }
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
            if (savingIndicatorTimer) {
                clearTimeout(savingIndicatorTimer)
                savingIndicatorTimer = null
            }
            setSaveStatus('error')
            setSaveError(e?.message || 'Ошибка сохранения')
            // Per-set: фиксируем 'error' для подходов из снимка.
            if (savingSetKeysRef.current.length > 0) {
                const keys = savingSetKeysRef.current.slice()
                savingSetKeysRef.current = []
                setSetSaveStates(prev => {
                    const next = { ...prev }
                    for (const k of keys) {
                        if (next[k] === 'saving') next[k] = 'error'
                    }
                    return next
                })
            }
            if (!silent) setSaveMessage('Ошибка сохранения — попробуй ещё раз')
            // ⚠️ Раньше тут pendingRef мог запустить бесконечный цикл
            // «сохранение → таймаут → сразу новое сохранение → опять таймаут».
            // Теперь: pendingRef снимаем, и делаем ОДНУ отложенную попытку
            // через 3 секунды (без рекурсии в catch'е), только если правки ещё
            // есть и сервер по-прежнему «знаком» (lastServerEntryRef !== null).
            // Если и эта попытка упадёт — стопаем, дальше юзер жмёт вручную
            // (кнопка на конкретном подходе / «Завершить»).
            //
            // Ограничение: после MAX_AUTOSAVE_RETRIES последовательных ошибок
            // ретрай прекращается полностью, чтобы не держать inFlightRef
            // бесконечно (иначе кнопка «Завершить» залипает на долго).
            consecutiveSaveErrorsRef.current++
            pendingRef.current = false
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current)
                retryTimerRef.current = null
            }
            const MAX_AUTOSAVE_RETRIES = 3
            if (silent && userChangedRef.current && lastServerEntryRef.current !== null
                && consecutiveSaveErrorsRef.current <= MAX_AUTOSAVE_RETRIES) {
                console.warn(`[program] autosave retry ${consecutiveSaveErrorsRef.current}/${MAX_AUTOSAVE_RETRIES} in 3s`)
                retryTimerRef.current = setTimeout(() => {
                    retryTimerRef.current = null
                    saveEntryRef.current?.(true)
                }, 3000)
            } else if (consecutiveSaveErrorsRef.current > MAX_AUTOSAVE_RETRIES) {
                console.warn(`[program] autosave stopped after ${MAX_AUTOSAVE_RETRIES} consecutive errors — user will save manually`)
            }
            return false
        } finally {
            // КРИТИЧНО: Если лок захвачен другой операцией (handleCompleteDay
            // после force-release), НЕ сбрасываем inFlightRef — иначе «угоним»
            // лок у приоритетной операции и кнопка снова залипнет.
            if (lockGenerationRef.current === myGeneration) {
                inFlightRef.current = false
            }
            if (!silent) setIsSaving(false)
            // Если за время УСПЕШНОГО сохранения накопились новые правки —
            // запускаем ещё один проход, но ТОЛЬКО если статус не error
            // (на error pendingRef уже сброшен выше, чтобы не зациклиться).
            if (pendingRef.current) {
                pendingRef.current = false
                setTimeout(() => { saveEntryRef.current?.(true) }, 50)
            }
        }
    }, [program, currentDayIndex, user, buildEntrySnapshot, backupKey, reconcileWithServer, lockIsFree])

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

        // КРИТИЧНО: если сервер не подтвердил исходное состояние записи
        // (lastServerEntryRef === null после ошибки/таймаута), мы не имеем
        // права писать в Supabase — мы не знаем, что там лежит сейчас, и
        // можем затереть данные с другого устройства. Локальный бэкап
        // уже записан выше, страница «починится» сама после успешной
        // повторной загрузки.
        if (lastServerEntryRef.current === null) {
            console.warn('[program] autosave skipped — server snapshot unknown (will retry on next focus reload)')
            return
        }

        // Сразу пишем локальный бэкап — даже если сеть отвалится,
        // данные не пропадут после reload.
        writeLocalDraft(currentDay.dayNumber)
        setSaveStatus(prev => prev === 'saved' ? 'idle' : prev)

        // Пользователь сделал новую правку — сбрасываем счётчик ошибок,
        // чтобы автосейв попробовал сохранить свежие данные.
        consecutiveSaveErrorsRef.current = 0

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

    // Очистка retry-таймера при размонтировании, чтобы не дёргать saveEntry
    // на уже несуществующем компоненте.
    useEffect(() => {
        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current)
                retryTimerRef.current = null
            }
            for (const t of setSaveFadeTimersRef.current.values()) clearTimeout(t)
            setSaveFadeTimersRef.current.clear()
        }
    }, [])

    // ─── Кросс-устройственная синхронизация ──────────────────────────────────
    // Когда пользователь возвращается во вкладку (фокус / visibilitychange),
    // перечитываем программу и запись дня из БД. Это даёт ощущение «синка»
    // между мобилой и десктопом без realtime-канала: вкладка десктопа,
    // оставленная в фоне, при возврате видит актуальное состояние того,
    // что человек заполнил с телефона.
    //
    // Условия безопасности:
    //  - если есть несохранённые правки (userChangedRef.current === true) —
    //    НЕ перечитываем, иначе перетрём ввод пользователя серверной версией;
    //  - если идёт upsert (inFlightRef) — тоже пропускаем;
    //  - чтобы не дёргать БД на каждый микро-фокус, троттлим до 5с между
    //    запросами.
    const lastFocusReloadAtRef = useRef(0)
    useEffect(() => {
        if (!program || !user) return

        const reloadFromServer = async () => {
            // Не вмешиваемся в активный ввод и в полётный upsert.
            if (userChangedRef.current) return
            if (inFlightRef.current) return

            const now = Date.now()
            if (now - lastFocusReloadAtRef.current < 5000) return
            lastFocusReloadAtRef.current = now

            try {
                // 1) Перечитываем саму программу — тренер мог обновить план.
                const fresh = await getProgramById(program.id)
                if (fresh) {
                    // Применяем enrich-логику как в первичной загрузке.
                    if (fresh.program_md) {
                        try {
                            const pd = fresh.program_data
                            const parsed = parseMdToJson(fresh.program_md)
                            fresh.program_data = {
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
                                    warmup: day.warmup ?? parsed.days[i]?.warmup,
                                    cooldown: day.cooldown ?? parsed.days[i]?.cooldown,
                                })),
                            }
                        } catch {}
                    }
                    setProgram(fresh)
                }

                // 2) Перечитываем запись текущего дня — клиент мог заполнить
                //    что-то с другого устройства.
                const currentDay = (fresh ?? program).program_data.days[currentDayIndex]
                if (!currentDay) return

                const entry = await getTrainingEntry(program.id, currentDay.dayNumber)
                if (!entry) return

                // Обновляем известный серверный снимок — защита от деструктивной записи.
                lastServerEntryRef.current = entry.entry_data || null

                const converted: Record<string, ExerciseClientData> = {}
                for (const ex of currentDay.exercises) {
                    const raw = entry.entry_data?.[ex.id]
                    if (!raw) {
                        converted[ex.id] = { sets: [], comment: '' }
                    } else if (raw.sets && Array.isArray(raw.sets)) {
                        converted[ex.id] = {
                            sets: raw.sets,
                            comment: raw.comment || '',
                            selectedAlternativeId: raw.selectedAlternativeId,
                        }
                    }
                }
                setExerciseData(converted)
                setEnergyLevel(entry.energy_level || 5)
                setMood(entry.mood || 3)
                setSleepQuality(entry.sleep_quality || 3)
                setNotes(entry.notes || '')
                const meta: DayMeta = entry.entry_data?.__meta__ || {}
                setSupersets(meta.supersets || [])
                if (entry.completed_at) {
                    setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
                    setSavedDuration(entry.workout_duration_seconds ?? null)
                }
                // userChangedRef мы НЕ ставим — это серверный снимок,
                // автосейв на нём не должен запуститься.
            } catch (e) {
                console.warn('[program] focus-reload failed:', e)
            }
        }

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void reloadFromServer()
            }
        }
        const onFocus = () => { void reloadFromServer() }

        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onFocus)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', onFocus)
        }
    }, [program, user, currentDayIndex])

    // ─── Watchdog: восстановление после заморозки вкладки / смены сети ─────────
    // Сценарий тренировки: телефон гасит экран между подходами → вкладка
    // заморожена браузером → таймер withTimeout НЕ тикает. Если в этот момент
    // VPN сменил IP (или сеть мигнула), активный upsert умирает, но лок
    // inFlightRef остаётся true, а спиннер «Сохраняю...» висит. Раньше это
    // чинилось только hard reload.
    //
    // Здесь при возврате вкладки (visible/focus) и при восстановлении сети
    // (online) мы:
    //   1) принудительно снимаем протухший лок и спиннер (lockIsFree чистит
    //      и isSaving/saveStatus);
    //   2) если остались несохранённые правки — дотягиваем их тихим автосейвом.
    // Это и есть «раз и навсегда»: даже если запрос подвис незаметно, кнопка
    // не залипает, а данные досохраняются сами.
    useEffect(() => {
        const recover = () => {
            // Снимаем залипший лок (если протух) — заодно гасит спиннер.
            const free = lockIsFree()
            // Есть несохранённые изменения и сервер-снимок известен — досохраняем.
            if (free && userChangedRef.current && lastServerEntryRef.current !== null) {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current)
                    debounceTimerRef.current = null
                }
                saveEntryRef.current?.(true)
            }
        }
        const onVisible = () => { if (document.visibilityState === 'visible') recover() }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', recover)
        window.addEventListener('online', recover)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', recover)
            window.removeEventListener('online', recover)
        }
    }, [lockIsFree])

    // ─── Failsafe: сброс isSaving если он «застрял» дольше 45с ────────────
    // На десктопе (нет sleep экрана) watchdog срабатывает только при focus/
    // visibilitychange/online. Если пользователь открыл страницу и ушёл,
    // а потом вернулся — isSaving мог «застрять» если handleCompleteDay
    // подвис. Этот таймер гарантирует сброс через 45с в любом случае.
    // 45с — с запасом покрывает worst-case: 2 × (3с getStoredAccessToken
    // timeout + 10с fetch timeout) + 12с markWeeklyCheckin ≈ 38с.
    useEffect(() => {
        if (!isSaving) return
        const timer = setTimeout(() => {
            console.warn('[program] failsafe: isSaving was true for 45s, force-resetting')
            setIsSaving(false)
            inFlightRef.current = false
        }, 45_000)
        return () => clearTimeout(timer)
    }, [isSaving])

    // ─── Debug: доступ к состоянию лока из консоли браузера ─────────────────
    // В dev-режиме можно в консоли писать:
    //   __debugLock.status()   — показать текущее состояние лока
    //   __debugLock.hold()     — захватить лок (эмуляция залипшего автосейва)
    //   __debugLock.release()  — освободить лок
    //   __debugLock.check()    — проверить кнопку «Завершить» (lockIsFree)
    useEffect(() => {
        if (typeof window === 'undefined') return
        ;(window as any).__debugLock = {
            status: () => {
                console.log({
                    inFlight: inFlightRef.current,
                    isSaving,
                    generation: lockGenerationRef.current,
                    heldFor: inFlightRef.current ? `${Date.now() - inFlightSinceRef.current}ms` : 'n/a',
                    lockIsFree: lockIsFree(),
                    saveStatus,
                    consecutiveErrors: consecutiveSaveErrorsRef.current,
                })
            },
            hold: () => {
                inFlightRef.current = true
                inFlightSinceRef.current = Date.now()
                lockGenerationRef.current++
                console.log('[debug] Lock force-acquired. Now __debugLock.status() and try clicking Завершить')
            },
            release: () => {
                inFlightRef.current = false
                console.log('[debug] Lock released')
            },
            check: () => {
                console.log('lockIsFree():', lockIsFree())
            },
        }
        return () => { delete (window as any).__debugLock }
    }, [isSaving, lockIsFree, saveStatus])

    // Группируем per-set статусы по exerciseId — чтобы каждый ExerciseCard
    // получал только свой кусочек и не ре-рендерился из-за статусов соседей.
    const setStatusesByExercise = useMemo(() => {
        const map: Record<string, Record<number, 'dirty' | 'saving' | 'saved' | 'error'>> = {}
        for (const [k, v] of Object.entries(setSaveStates)) {
            const sep = k.indexOf('::')
            if (sep < 0) continue
            const exId = k.slice(0, sep)
            const idx = parseInt(k.slice(sep + 2), 10)
            if (!Number.isFinite(idx)) continue
            if (!map[exId]) map[exId] = {}
            map[exId][idx] = v
        }
        return map
    }, [setSaveStates])

    // Клик по кнопке «✓» на конкретном подходе. Запрашиваем ручное (не silent)
    // сохранение всего снапшота: подход помечен 'dirty' → переедет в 'saving'
    // на старте saveEntry, и затем в 'saved'/'error' по результату. Если уже
    // идёт автосейв с этим же подходом — saveEntry молча вернёт false
    // (лок занят), но pendingRef уже взведён и второй прогон отработает сам.
    const handleSaveSet = useCallback((exerciseId: string, setIdx: number) => {
        const k = setKey(exerciseId, setIdx)
        // На всякий случай — если статус был 'saved' (юзер успел тыкнуть до
        // того как 'saved' исчез), форсим его в 'dirty', чтобы next save
        // его подхватил.
        setSetSaveStates(prev => {
            if (prev[k] === 'saving') return prev
            const t = setSaveFadeTimersRef.current.get(k)
            if (t) { clearTimeout(t); setSaveFadeTimersRef.current.delete(k) }
            return { ...prev, [k]: 'dirty' }
        })
        // Отменяем висящий дебаунс и запускаем сразу — пользователь явно
        // запросил сохранение.
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        saveEntryRef.current?.(false)
    }, [])

    const handleAuthFailure = useCallback(async (context: 'complete' | 'save-completed') => {
        const { status } = await getAccessTokenWithRecovery()
        pushDebugEvent('auth_failure', {
            context,
            status,
            isSaving,
            saveStatus,
            inFlight: inFlightRef.current,
            heldForMs: inFlightRef.current ? Date.now() - inFlightSinceRef.current : null,
        })
        console.warn(`[program] ${context} aborted by auth state: ${status}`)
        setSaveStatus('error')
        setSaveError(
            status === 'missing' || status === 'expired' || status === 'refresh_failed'
                ? 'Сессия истекла или потерялась. Обнови страницу и попробуй снова.'
                : 'Не удалось подтвердить сессию. Обнови страницу и попробуй снова.'
        )
        setSaveMessage('⚠ Проблема с сессией — обнови страницу')
        resetSavingState('error')
    }, [isSaving, pushDebugEvent, resetSavingState, saveStatus])

    const updateExercise = (exerciseId: string, data: ExerciseClientData) => {
        userChangedRef.current = true
        if (!completedDays.has(program?.program_data.days[currentDayIndex]?.dayNumber ?? -1)) {
            startTimerIfNeeded()
        }
        // Помечаем изменившиеся подходы как 'dirty', чтобы кнопка «✓» на
        // строке подхода стала активной. Сравниваем поля weight/reps/rir
        // (комментарий и метка не считаются «значимыми» для UI-индикатора —
        // они и так сохранятся вместе со следующим сейвом).
        const prevSets = exerciseData[exerciseId]?.sets ?? []
        const nextSets = data.sets ?? []
        const len = Math.max(prevSets.length, nextSets.length)
        const dirtyKeys: string[] = []
        for (let i = 0; i < len; i++) {
            const a = prevSets[i] || { weight: '', reps: '', rir: '' }
            const b = nextSets[i] || { weight: '', reps: '', rir: '' }
            if (a.weight !== b.weight || a.reps !== b.reps || a.rir !== b.rir || a.label !== b.label) {
                dirtyKeys.push(setKey(exerciseId, i))
            }
        }
        if (dirtyKeys.length > 0) {
            setSetSaveStates(prev => {
                const next = { ...prev }
                for (const k of dirtyKeys) {
                    // Если ключ уже был — отменяем «затухающий» таймер saved.
                    const t = setSaveFadeTimersRef.current.get(k)
                    if (t) { clearTimeout(t); setSaveFadeTimersRef.current.delete(k) }
                    next[k] = 'dirty'
                }
                return next
            })
        }
        setExerciseData(prev => ({ ...prev, [exerciseId]: data }))
    }

    const handleCompleteDay = async () => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return

        pushDebugEvent('complete_click', {
            dayNumber: currentDay.dayNumber,
            currentDayIndex,
            isSaving,
            saveStatus,
            inFlight: inFlightRef.current,
            hasPendingChanges: userChangedRef.current,
            elapsedSeconds,
            workoutStartTime,
        })

        // «Завершить» — приоритетная кнопка. Должна работать ВСЕГДА,
        // даже если автосейв держит лок (retry-цикл при ошибке сети/сессии).
        // Принудительно снимаем лок и отменяем все автосейв-таймеры.
        if (!lockIsFree()) {
            console.warn('[program] handleCompleteDay: force-releasing lock held by autosave')
        }
        inFlightRef.current = true
        inFlightSinceRef.current = Date.now()
        lockGenerationRef.current++
        const myGeneration = lockGenerationRef.current
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }
        pendingRef.current = false

        // Предварительная проверка сессии: если JWT протух, не шлём
        // запросы на сервер (которые уйдут в таймаут по 10-12с каждый),
        // а сразу покажем понятную ошибку с инструкцией.
        setIsSaving(true)
        setSaveStatus('saving')
        setSaveError(null)
        setSaveMessage('')
        try {
            const sessionOk = await tryRefreshSession()
            pushDebugEvent('complete_refresh_result', { sessionOk })
            if (!sessionOk) {
                await handleAuthFailure('complete')
                return
            }
        } catch (e: any) {
            pushDebugEvent('complete_refresh_exception', { message: e?.message || String(e) })
            const { token } = await getAccessTokenWithRecovery()
            if (!token) {
                await handleAuthFailure('complete')
                return
            }
        }
        const finalDuration = workoutStartTime !== null
            ? Math.floor((Date.now() - workoutStartTime) / 1000)
            : elapsedSeconds || undefined
        try {
            const snap = buildEntrySnapshot()
            pushDebugEvent('complete_save_start', {
                dayNumber: currentDay.dayNumber,
                exerciseCount: Object.keys(snap.entryData || {}).length,
                finalDuration,
            })
            await upsertTrainingEntry(program.id, currentDay.dayNumber, snap.entryData, {
                ...snap.metadata,
                workout_duration_seconds: finalDuration,
            })
            pushDebugEvent('complete_upsert_ok', { dayNumber: currentDay.dayNumber })
            await completeTrainingDay(program.id, currentDay.dayNumber)
            pushDebugEvent('complete_mark_done_ok', { dayNumber: currentDay.dayNumber })

            // Если это последний день недели — автоматически фиксируем чек-ин клиента,
            // чтобы тренер видел финализированные ответы в дневнике.
            if (currentDayIndex === program.program_data.days.length - 1) {
                await markWeeklyCheckinCompleted(program.id)
            }

            setCompletedDays(prev => new Set([...prev, currentDay.dayNumber]))
            setSavedDuration(finalDuration ?? null)
            setWorkoutStartTime(null)
            setStoppedDuration(null)
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
            if (lockGenerationRef.current === myGeneration) {
                resetSavingState()
            }
        }
    }

    const handleSaveCompleted = async () => {
        if (!program) return
        const currentDay = program.program_data.days[currentDayIndex]
        if (!currentDay) return
        pushDebugEvent('save_completed_click', {
            dayNumber: currentDay.dayNumber,
            currentDayIndex,
            isSaving,
            saveStatus,
            inFlight: inFlightRef.current,
            savedDuration,
        })
        if (!lockIsFree()) {
            console.warn('[program] handleSaveCompleted: force-releasing lock held by autosave')
        }
        inFlightRef.current = true
        inFlightSinceRef.current = Date.now()
        lockGenerationRef.current++
        const myGeneration = lockGenerationRef.current
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }
        pendingRef.current = false
        setIsSaving(true)
        setSaveStatus('saving')
        setSaveError(null)
        setSaveMessage('')
        try {
            const sessionOk = await tryRefreshSession()
            pushDebugEvent('save_completed_refresh_result', { sessionOk })
            if (!sessionOk) {
                await handleAuthFailure('save-completed')
                return
            }
        } catch (e: any) {
            pushDebugEvent('save_completed_refresh_exception', { message: e?.message || String(e) })
            const { token } = await getAccessTokenWithRecovery()
            if (!token) {
                await handleAuthFailure('save-completed')
                return
            }
        }
        try {
            const snap = buildEntrySnapshot()
            pushDebugEvent('save_completed_start', {
                dayNumber: currentDay.dayNumber,
                exerciseCount: Object.keys(snap.entryData || {}).length,
                savedDuration,
            })
            await upsertTrainingEntry(program.id, currentDay.dayNumber, snap.entryData, {
                ...snap.metadata,
                workout_duration_seconds: savedDuration ?? undefined,
            })
            pushDebugEvent('save_completed_upsert_ok', { dayNumber: currentDay.dayNumber })
            setSaveStatus('saved')
            setSaveMessage('✓ Правки сохранены')
            setTimeout(() => setSaveMessage(''), 2000)
            setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500)
        } catch (e: any) {
            console.error('Error saving completed entry:', e)
            pushDebugEvent('save_completed_error', { message: e?.message || String(e) })
            setSaveStatus('error')
            setSaveError(e?.message || 'Ошибка сохранения')
            setSaveMessage('Ошибка сохранения — попробуй ещё раз')
        } finally {
            if (lockGenerationRef.current === myGeneration) {
                resetSavingState()
            }
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
        : (stoppedDuration !== null
            ? stoppedDuration
            : (workoutStartTime !== null ? elapsedSeconds : null))

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

                    {currentDay.warmup && (
                        <div className="rounded-xl border border-orange-500/25 overflow-hidden">
                            <button
                                onClick={() => setIsWarmupCollapsed(v => !v)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-left bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
                            >
                                <span className="text-base flex-shrink-0">🔥</span>
                                <span className="text-sm font-semibold text-orange-400 flex-1">Разминка</span>
                                <ChevronDown className={`w-4 h-4 text-orange-400/60 transition-transform duration-200 ${isWarmupCollapsed ? '' : 'rotate-180'}`} />
                            </button>
                            {!isWarmupCollapsed && (
                                <div className="px-4 py-3 bg-orange-500/5">
                                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                        {currentDay.warmup}
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
                                        setStatuses={setStatusesByExercise[exercise.id]}
                                        onSaveSet={(setIdx) => handleSaveSet(exercise.id, setIdx)}
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

                {/* Заминка — отдельный блок после всех упражнений */}
                {currentDay.cooldown && (
                    <div className="rounded-xl border border-cyan-500/25 overflow-hidden mb-5">
                        <button
                            onClick={() => setIsCooldownCollapsed(v => !v)}
                            className="w-full flex items-center gap-2 px-4 py-3 text-left bg-cyan-500/10 hover:bg-cyan-500/15 transition-colors"
                        >
                            <span className="text-base flex-shrink-0">🧘</span>
                            <span className="text-sm font-semibold text-cyan-400 flex-1">Заминка</span>
                            <ChevronDown className={`w-4 h-4 text-cyan-400/60 transition-transform duration-200 ${isCooldownCollapsed ? '' : 'rotate-180'}`} />
                        </button>
                        {!isCooldownCollapsed && (
                            <div className="px-4 py-3 bg-cyan-500/5">
                                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                    {currentDay.cooldown}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Кардио */}
                {currentDay.cardio && (
                    currentDay.cardioOnly ? (
                        // Отдельный кардио-день (формат 2 из cardio-prescription.md):
                        // день отдыха от силовой, посвящённый кардио. Большой акцентный
                        // блок, чтобы клиенту было однозначно понятно — сегодня только это.
                        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 mb-5">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">🚶</span>
                                <h3 className="text-base font-display font-bold text-cyan-300">Кардио-день</h3>
                            </div>
                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                                {currentDay.cardio}
                            </p>
                        </div>
                    ) : (
                        <div className="glass-card p-5 mb-5">
                            <h3 className="text-base font-display font-bold text-white mb-1">Кардио</h3>
                            <p className="text-text-secondary text-sm">{currentDay.cardio}</p>
                        </div>
                    )
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
                                        <div className="flex items-center gap-2 mb-3 -mt-1 flex-wrap">
                                            <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-accent">
                                                <Clock className="w-4 h-4" />
                                                {formatDuration(displayDuration)}
                                                {stoppedDuration !== null && !isCurrentDayCompleted && (
                                                    <span className="ml-1 text-[10px] uppercase tracking-wider text-text-muted font-sans font-semibold">
                                                        остановлен
                                                    </span>
                                                )}
                                            </div>
                                            {!isCurrentDayCompleted && (workoutStartTime !== null || stoppedDuration !== null) && (
                                                <div className="flex items-center gap-1.5">
                                                    {workoutStartTime !== null && (
                                                        <button
                                                            type="button"
                                                            onClick={stopTimer}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-bg-elevated hover:bg-white/5 border border-white/10 text-xs text-text-muted hover:text-white transition-colors"
                                                            title="Остановить таймер"
                                                        >
                                                            <Square className="w-3 h-3" />
                                                            Стоп
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={resetTimer}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-bg-elevated hover:bg-white/5 border border-white/10 text-xs text-text-muted hover:text-white transition-colors"
                                                        title="Сбросить таймер"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        Сброс
                                                    </button>
                                                </div>
                                            )}
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
                            {saveStatus === 'saved' && (
                                <span className="text-success truncate">✓ Сохранено автоматически</span>
                            )}
                            {saveStatus === 'error' && (
                                <span className="text-red-400 truncate" title={saveError ?? undefined}>
                                    ⚠ {saveError ?? 'Ошибка сохранения. Нажми ✓ на подходе, чтобы повторить'}
                                </span>
                            )}
                            {(saveStatus === 'idle' || saveStatus === 'saving') && lastSavedAtRef.current !== null && (
                                <span className="text-text-muted truncate">Все изменения сохранены</span>
                            )}
                        </div>
                        <div className="flex gap-2 sm:gap-3">
                            {/* Кнопки «Сохранить» больше нет: сохранение
                                теперь происходит автоматически после ввода
                                и/или по клику на ✓ возле конкретного подхода.
                                Это убирает гонку с автосейвом и «бесконечное
                                Сохраняю...» при медленной сети. */}
                            <button onClick={handleCompleteDay} disabled={isSaving}
                                className="glass-button w-full flex items-center justify-center gap-1.5 sm:gap-2 py-3 min-w-0">
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

        {/* Модалка альтернативных упражнений.
            z-[300] — выше RestTimer (z-index:200), чтобы таймер не перекрывал
            окно выбора. items-center всегда — центр экрана и на мобиле. */}
        {altModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={() => setAltModal(null)}>
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
        {supersetModal && (            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={() => setSupersetModal(null)}>
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
