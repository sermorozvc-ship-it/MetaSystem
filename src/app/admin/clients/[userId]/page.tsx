'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Dumbbell, TrendingUp, FileText, Plus,
    Loader2, Upload, X, Check, ChevronDown, ChevronUp,
    Download, CheckCircle2, Clock, Pencil, Archive, ArchiveRestore,
    Apple, Copy, Calendar, RefreshCw
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin, getUserDetails, archiveUser, unarchiveUser } from '@/lib/services/admin'
import { getQuestionnaireByUserId, type ClientQuestionnaire } from '@/lib/services/questionnaire'
import {
    getNutritionQuestionnaireByUserId,
    userHasNutritionAccess,
    formatNutritionForAdmin,
    NUTRITION_LABELS,
    type NutritionQuestionnaire,
} from '@/lib/services/nutrition'
import { getClientPrograms, type TrainingProgram, type TrainingEntry } from '@/lib/services/training'
import ExerciseProgressView from '@/components/ExerciseProgressView'
import { parseMdToJson, EXAMPLE_PROGRAM_MD } from '@/lib/utils/md-parser'
import { type NutritionProgram } from '@/lib/services/nutrition-programs'
import { parseNutritionMdToJson, EXAMPLE_NUTRITION_MD } from '@/lib/utils/nutrition-md-parser'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

type Tab = 'questionnaire' | 'nutrition' | 'programs' | 'nutrition_plans' | 'metrics' | 'exercise_stats'

// ─── Просмотр метрик клиента (для админа) ───────────────────────────────────
function ClientMetricsView({ userId }: { userId: string }) {
    const [metrics, setMetrics] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )
            const { data } = await db
                .from('client_metrics')
                .select('*')
                .eq('user_id', userId)
                .order('measured_at', { ascending: false })
            setMetrics(data || [])
            setLoading(false)
        }
        load()
    }, [userId])

    if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>

    if (metrics.length === 0) {
        return (
            <div className="glass-card p-12 text-center">
                <TrendingUp className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">Клиент ещё не добавил замеры</p>
            </div>
        )
    }

    const latest = metrics[0]
    const prev = metrics[1]
    const delta = (cur?: number, pre?: number) => {
        if (!cur || !pre) return null
        const d = cur - pre
        return { val: Math.abs(d).toFixed(1), up: d > 0 }
    }

    // Данные для графиков (от старых к новым)
    const chartData = [...metrics].reverse().map(m => ({
        date: format(new Date(m.measured_at), 'dd MMM', { locale: ru }),
        weight: m.weight_kg,
        waist: m.waist_cm,
        hips: m.hips_cm,
        chest: m.chest_cm,
        sleep: m.sleep_hours,
        stress: m.stress_level,
        water: m.water_liters,
    }))

    const tooltipStyle = { backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12 }

    return (
        <div className="space-y-6">
            {/* Сводные карточки */}
            <div>
                <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">
                    Последний замер · {format(new Date(latest.measured_at), 'dd MMM yyyy', { locale: ru })}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                        { label: 'Вес', value: latest.weight_kg, unit: 'кг', d: delta(latest.weight_kg, prev?.weight_kg), color: 'text-accent' },
                        { label: '% жира', value: latest.body_fat_pct, unit: '%', d: delta(latest.body_fat_pct, prev?.body_fat_pct), color: 'text-blue-400' },
                        { label: 'Талия', value: latest.waist_cm, unit: 'см', d: delta(latest.waist_cm, prev?.waist_cm), color: 'text-yellow-400' },
                        { label: 'Сон', value: latest.sleep_hours, unit: 'ч', d: delta(latest.sleep_hours, prev?.sleep_hours), color: 'text-purple-400' },
                        { label: 'Стресс', value: latest.stress_level, unit: '/10', d: delta(latest.stress_level, prev?.stress_level), color: 'text-red-400' },
                        { label: 'Вода', value: latest.water_liters, unit: 'л', d: delta(latest.water_liters, prev?.water_liters), color: 'text-emerald-400' },
                    ].filter(c => c.value).map(c => (
                        <div key={c.label} className="glass-card p-4 text-center">
                            <p className="text-xs text-text-muted mb-1">{c.label}</p>
                            <p className={`text-2xl font-display font-bold ${c.color}`}>{c.value}</p>
                            <p className="text-xs text-text-muted">{c.unit}</p>
                            {c.d && (
                                <p className={`text-xs mt-1 font-medium ${c.d.up ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {c.d.up ? '↑' : '↓'} {c.d.val}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* График веса */}
            {chartData.filter(d => d.weight).length > 1 && (
                <div className="glass-card p-6">
                    <p className="text-sm font-semibold text-white mb-4">Динамика веса</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="adminWeightGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#c8f542" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#c8f542" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#555" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} кг`, 'Вес']} />
                            <Area type="monotone" dataKey="weight" stroke="#c8f542" strokeWidth={2.5} fill="url(#adminWeightGrad)" dot={{ fill: '#c8f542', r: 4, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Объёмы */}
            {chartData.filter(d => d.waist || d.hips || d.chest).length > 1 && (
                <div className="glass-card p-6">
                    <p className="text-sm font-semibold text-white mb-4">Объёмы</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#555" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`${v} см`, name]} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="waist" stroke="#c8f542" strokeWidth={2} dot={{ r: 3 }} name="Талия" />
                            <Line type="monotone" dataKey="hips" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Бёдра" />
                            <Line type="monotone" dataKey="chest" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Грудь" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Образ жизни */}
            {chartData.filter(d => d.sleep || d.stress || d.water).length > 1 && (
                <div className="glass-card p-6">
                    <p className="text-sm font-semibold text-white mb-4">Образ жизни</p>
                    <div className="grid md:grid-cols-3 gap-4">
                        {[
                            { key: 'sleep', label: 'Сон', unit: 'ч', color: '#818cf8' },
                            { key: 'stress', label: 'Стресс', unit: '/10', color: '#f87171' },
                            { key: 'water', label: 'Вода', unit: 'л', color: '#34d399' },
                        ].map(({ key, label, unit, color }) => {
                            if (!chartData.some(d => (d as any)[key])) return null
                            return (
                                <div key={key}>
                                    <p className="text-xs text-text-muted mb-2">{label} ({unit})</p>
                                    <ResponsiveContainer width="100%" height={90}>
                                        <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id={`admin-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="date" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip contentStyle={{ ...tooltipStyle, fontSize: 11 }} formatter={(v: any) => [`${v}${unit}`, label]} />
                                            <Area type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#admin-${key})`} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Таблица всех замеров */}
            <div className="glass-card p-6">
                <p className="text-sm font-semibold text-white mb-4">История замеров</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-text-muted border-b border-border">
                                <th className="text-left pb-2 pr-4">Дата</th>
                                <th className="text-right pb-2 pr-4">Вес</th>
                                <th className="text-right pb-2 pr-4">% жира</th>
                                <th className="text-right pb-2 pr-4">Талия</th>
                                <th className="text-right pb-2 pr-4">Бёдра</th>
                                <th className="text-right pb-2 pr-4">Грудь</th>
                                <th className="text-right pb-2 pr-4">Сон</th>
                                <th className="text-right pb-2">Стресс</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.map(m => (
                                <tr key={m.id} className="border-b border-border/40 hover:bg-white/5">
                                    <td className="py-2 pr-4 text-text-secondary">{format(new Date(m.measured_at), 'dd.MM.yyyy')}</td>
                                    <td className="py-2 pr-4 text-right text-white">{m.weight_kg ? `${m.weight_kg} кг` : '—'}</td>
                                    <td className="py-2 pr-4 text-right text-text-secondary">{m.body_fat_pct ? `${m.body_fat_pct}%` : '—'}</td>
                                    <td className="py-2 pr-4 text-right text-text-secondary">{m.waist_cm ? `${m.waist_cm}` : '—'}</td>
                                    <td className="py-2 pr-4 text-right text-text-secondary">{m.hips_cm ? `${m.hips_cm}` : '—'}</td>
                                    <td className="py-2 pr-4 text-right text-text-secondary">{m.chest_cm ? `${m.chest_cm}` : '—'}</td>
                                    <td className="py-2 pr-4 text-right text-text-secondary">{m.sleep_hours ? `${m.sleep_hours}ч` : '—'}</td>
                                    <td className="py-2 text-right text-text-secondary">{m.stress_level ? `${m.stress_level}/10` : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Фото прогресса */}
            {metrics.some(m => m.photo_front || m.photo_side || m.photo_back) && (
                <div className="glass-card p-6">
                    <p className="text-sm font-semibold text-white mb-4">Фото прогресса</p>
                    <div className="space-y-4">
                        {metrics.filter(m => m.photo_front || m.photo_side || m.photo_back).map(m => (
                            <div key={m.id}>
                                <p className="text-xs text-text-muted mb-2">{format(new Date(m.measured_at), 'dd MMM yyyy', { locale: ru })}</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {[m.photo_front, m.photo_side, m.photo_back].map((url, i) => url ? (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt="" className="w-full h-40 object-contain rounded-xl bg-bg-elevated hover:opacity-90 transition-opacity" />
                                        </a>
                                    ) : <div key={i} className="w-full h-40 rounded-xl bg-bg-elevated" />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Генерация заполненного Markdown ────────────────────────────────────────
function buildFilledMd(program: TrainingProgram, entries: TrainingEntry[]): string {
    const entriesMap = new Map(entries.map(e => [e.day_number, e]))
    const lines: string[] = []

    lines.push(`# Неделя ${program.week_number}`)
    lines.push('')
    lines.push(`**Период:** ${program.start_date} — ${program.end_date}`)
    if (program.program_data.weeklyNote) {
        lines.push(`**Рекомендация:** ${program.program_data.weeklyNote}`)
    }
    lines.push('')

    const days = program.program_data?.days || []
    if (days.length === 0) return program.program_md

    for (const day of days) {
        const entry = entriesMap.get(day.dayNumber)
        const completed = !!entry?.completed_at

        lines.push(`## День ${day.dayNumber}: ${day.title}${completed ? ' ✅' : ''}`)
        if (day.coachNote) lines.push(`**Рекомендация дня:** ${day.coachNote}`)
        lines.push('')

        // Статистика дня
        let dayTonnage = 0
        let dayExercisesCount = 0
        let daySetsCount = 0
        let dayRepsCount = 0

        for (const ex of day.exercises) {
            lines.push(`### ${ex.name}`)
            if (ex.videoUrl) lines.push(`[Видео](${ex.videoUrl})`)

            const tw = ex.targetWeights || []
            const weightsStr = tw.length > 0 ? tw.map(w => w > 0 ? w : '—').join('/') + ' кг' : ''
            lines.push(`- **План:** ${ex.sets} x ${ex.reps}${weightsStr ? ` • ${weightsStr}` : ''}`)

            const clientData = entry?.entry_data?.[ex.id]
            if (clientData) {
                // Новый формат — данные по подходам
                if (clientData.sets && Array.isArray(clientData.sets)) {
                    const filledSets = clientData.sets.filter((s: any) => s.weight || s.reps)
                    if (filledSets.length > 0) {
                        dayExercisesCount++
                        clientData.sets.forEach((s: any, i: number) => {
                            const w = s.weight ? `${s.weight} кг` : '—'
                            const r = s.reps ? `${s.reps} повт.` : '—'
                            const rir = s.rir !== undefined && s.rir !== '' ? `RIR ${s.rir}` : ''
                            const setLine = `- **Подход ${i + 1}:** ${w} × ${r}${rir ? ` • ${rir}` : ''}${s.setComment ? ` _(${s.setComment})_` : ''}`
                            lines.push(setLine)
                            // Считаем статистику
                            const wNum = parseFloat(s.weight) || 0
                            const rNum = parseInt(s.reps) || 0
                            if (wNum || rNum) {
                                dayTonnage += wNum * rNum
                                daySetsCount++
                                dayRepsCount += rNum
                            }
                        })
                    } else {
                        lines.push(`- **Факт:** не заполнено`)
                    }
                } else {
                    // Старый формат
                    const w = clientData.actualWeight ? `${clientData.actualWeight} кг` : '—'
                    const r = clientData.actualReps ? `${clientData.actualReps} повт.` : '—'
                    lines.push(`- **Факт:** ${w} × ${r}${clientData.rpe ? ` • RPE ${clientData.rpe}` : ''}`)
                    if (clientData.actualWeight && clientData.actualReps) {
                        dayExercisesCount++
                        dayTonnage += (parseFloat(clientData.actualWeight) || 0) * (parseInt(clientData.actualReps) || 0)
                        daySetsCount += ex.sets
                        dayRepsCount += (parseInt(clientData.actualReps) || 0) * ex.sets
                    }
                }
                if (clientData.comment) lines.push(`- **Комментарий к упражнению:** ${clientData.comment}`)
            } else {
                lines.push(`- **Факт:** не заполнено`)
            }
            lines.push('')
        }

        if (day.cardio) { lines.push(`**Кардио:** ${day.cardio}`); lines.push('') }

        // Статистика сессии
        if (dayExercisesCount > 0) {
            lines.push(`### 📊 Статистика сессии`)
            lines.push(`| Показатель | Значение |`)
            lines.push(`|---|---|`)
            lines.push(`| Общий тоннаж | **${dayTonnage.toLocaleString('ru-RU')} кг** |`)
            lines.push(`| Упражнений | ${dayExercisesCount} |`)
            lines.push(`| Подходов | ${daySetsCount} |`)
            lines.push(`| Повторений | ${dayRepsCount} |`)
            lines.push('')
        }

        if (entry) {
            lines.push(`**Самочувствие:**`)
            lines.push(`- Энергия: ${entry.energy_level ?? '—'}/10`)
            lines.push(`- Настроение: ${entry.mood ?? '—'}/5`)
            lines.push(`- RPE тренировки: ${entry.sleep_quality ?? '—'}/10`)
            if (entry.notes) lines.push(`- Заметки: ${entry.notes}`)
            if (entry.completed_at) lines.push(`- Завершено: ${new Date(entry.completed_at).toLocaleString('ru-RU')}`)
        } else {
            lines.push(`**Самочувствие:** не заполнено`)
        }

        lines.push(''); lines.push('---'); lines.push('')
    }

    // Итоговая статистика недели
    const allEntries = [...entriesMap.values()]
    let weekTonnage = 0
    let weekExercises = 0
    let weekSets = 0
    let weekReps = 0

    for (const day of days) {
        const entry = entriesMap.get(day.dayNumber)
        if (!entry) continue
        for (const ex of day.exercises) {
            const cd = entry.entry_data?.[ex.id]
            if (!cd) continue
            if (cd.sets && Array.isArray(cd.sets)) {
                const filled = cd.sets.filter((s: any) => s.weight || s.reps)
                if (filled.length > 0) {
                    weekExercises++
                    cd.sets.forEach((s: any) => {
                        const w = parseFloat(s.weight) || 0
                        const r = parseInt(s.reps) || 0
                        if (w || r) { weekTonnage += w * r; weekSets++; weekReps += r }
                    })
                }
            } else if (cd.actualWeight && cd.actualReps) {
                weekExercises++
                weekTonnage += (parseFloat(cd.actualWeight) || 0) * (parseInt(cd.actualReps) || 0)
                weekSets += ex.sets
                weekReps += (parseInt(cd.actualReps) || 0) * ex.sets
            }
        }
    }

    if (weekExercises > 0) {
        lines.push(`## 📊 Итоговая статистика недели`)
        lines.push('')
        lines.push(`| Показатель | Значение |`)
        lines.push(`|---|---|`)
        lines.push(`| Общий тоннаж за неделю | **${weekTonnage.toLocaleString('ru-RU')} кг** |`)
        lines.push(`| Всего упражнений | ${weekExercises} |`)
        lines.push(`| Всего подходов | ${weekSets} |`)
        lines.push(`| Всего повторений | ${weekReps} |`)
        lines.push(`| Завершено тренировок | ${allEntries.filter(e => !!e.completed_at).length}/${days.length} |`)
        lines.push('')
    }

    return lines.join('\n')
}

// ─── Карточка одной программы ───────────────────────────────────────────────
function ProgramCard({ program, onDelete, onUpdate }: {
    program: TrainingProgram
    onDelete: (id: string) => void
    onUpdate: (updated: TrainingProgram) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [entries, setEntries] = useState<TrainingEntry[]>([])
    const [loadingEntries, setLoadingEntries] = useState(false)
    const [loadError, setLoadError] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    // Редактирование
    const [editing, setEditing] = useState(false)
    const [editMd, setEditMd] = useState('')
    const [editStartDate, setEditStartDate] = useState('')
    const [editEndDate, setEditEndDate] = useState('')
    const [editTrainingDays, setEditTrainingDays] = useState(3)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')

    const openEdit = () => {
        setEditMd(program.program_md)
        setEditStartDate(program.start_date)
        setEditEndDate(program.end_date)
        setEditTrainingDays(program.training_days_count)
        setSaveError('')
        setEditing(true)
    }

    const handleSaveEdit = async () => {
        if (!editMd.trim()) { setSaveError('Программа не может быть пустой'); return }
        if (!editStartDate || !editEndDate) { setSaveError('Укажите даты'); return }
        setSaving(true)
        setSaveError('')
        try {
            const { parseMdToJson } = await import('@/lib/utils/md-parser')
            const programData = parseMdToJson(editMd)
            programData.weekNumber = program.week_number
            programData.startDate = editStartDate
            programData.endDate = editEndDate

            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )

            const { data, error } = await db
                .from('training_programs')
                .update({
                    program_md: editMd,
                    program_data: programData,
                    start_date: editStartDate,
                    end_date: editEndDate,
                    training_days_count: editTrainingDays,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', program.id)
                .select()
                .single()

            if (error) throw new Error(error.message)
            onUpdate(data)
            setEditing(false)
        } catch (e: any) {
            setSaveError(e.message || 'Ошибка сохранения')
        } finally {
            setSaving(false)
        }
    }

    const fetchEntries = async (): Promise<TrainingEntry[]> => {
        // Читаем напрямую через Supabase с service role — обходит RLS, не нужен токен
        const { createClient: createDirectClient } = await import('@supabase/supabase-js')
        const db = createDirectClient(
            'https://bzyypoyvihqhrbllgffh.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
            { auth: { persistSession: false } }
        )

        const { data, error } = await db
            .from('training_entries')
            .select('*')
            .eq('program_id', program.id)
            .order('day_number', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    }

    const handleToggle = async () => {
        if (!expanded && entries.length === 0) {
            setLoadingEntries(true)
            setLoadError('')
            try {
                const fetched = await fetchEntries()
                setEntries(fetched)
            } catch (e: any) {
                setLoadError(e.message)
            } finally {
                setLoadingEntries(false)
            }
        }
        setExpanded(v => !v)
    }

    const handleDownload = async () => {
        let currentEntries = entries
        if (currentEntries.length === 0) {
            setLoadingEntries(true)
            try {
                currentEntries = await fetchEntries()
                setEntries(currentEntries)
            } catch {}
            setLoadingEntries(false)
        }

        const md = buildFilledMd(program, currentEntries)
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `week-${program.week_number}-filled.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleDelete = async () => {
        if (!confirmDelete) { setConfirmDelete(true); return }
        setDeleting(true)
        try {
            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )
            const { error } = await db.from('training_programs').delete().eq('id', program.id)
            if (error) throw new Error(error.message)
            onDelete(program.id)
        } catch (e: any) {
            console.error('Delete error:', e)
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    const days = program.program_data?.days || []
    const entriesMap = new Map(entries.map(e => [e.day_number, e]))
    const completedCount = entries.filter(e => !!e.completed_at).length

    return (
        <>
        <div className="glass-card overflow-hidden">
            {/* Заголовок */}
            <div
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={handleToggle}
            >
                {/* Верхняя строка: название + кнопки */}
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-base font-display font-bold text-white whitespace-nowrap">
                            Неделя {program.week_number}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                            program.status === 'active'
                                ? 'bg-accent/20 text-accent'
                                : 'bg-bg-elevated text-text-muted'
                        }`}>
                            {program.status}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={handleDownload}
                            disabled={loadingEntries}
                            className="glass-button-secondary p-2"
                            title="Скачать .md"
                        >
                            {loadingEntries
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Download className="w-4 h-4" />
                            }
                        </button>
                        <button
                            onClick={openEdit}
                            className="glass-button-secondary p-2"
                            title="Редактировать"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        {confirmDelete ? (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-2 py-1.5 rounded-xl bg-danger/20 border border-danger/40 text-danger text-xs font-semibold"
                                >
                                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Да'}
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="px-2 py-1.5 rounded-xl glass-button-secondary text-xs"
                                >
                                    Нет
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleDelete}
                                className="glass-button-secondary p-2 text-danger hover:border-danger/40 transition-colors"
                                title="Удалить"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <div className="ml-1">
                            {expanded
                                ? <ChevronUp className="w-4 h-4 text-text-muted" />
                                : <ChevronDown className="w-4 h-4 text-text-muted" />
                            }
                        </div>
                    </div>
                </div>

                {/* Нижняя строка: даты и прогресс */}
                <p className="text-xs text-text-secondary">
                    {new Date(program.start_date).toLocaleDateString('ru-RU')} —{' '}
                    {new Date(program.end_date).toLocaleDateString('ru-RU')}
                    {' · '}{program.training_days_count} дней
                    {entries.length > 0 && (
                        <span className="ml-2 text-accent">
                            ✓ {completedCount}/{days.length}
                        </span>
                    )}
                </p>
            </div>

            {/* Раскрытое содержимое */}
            {expanded && (
                <div className="border-t border-border px-6 pb-6 pt-4">
                    {loadingEntries && (
                        <div className="flex items-center gap-2 text-text-muted py-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Загрузка данных клиента...
                        </div>
                    )}

                    {loadError && (
                        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger mb-4">
                            {loadError}
                        </div>
                    )}

                    {!loadingEntries && days.length === 0 && (
                        <div className="py-4">
                            <p className="text-sm text-text-muted mb-3">Структурированных дней нет — исходный Markdown:</p>
                            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono bg-bg-elevated p-4 rounded-xl max-h-64 overflow-y-auto">
                                {program.program_md}
                            </pre>
                        </div>
                    )}

                    {!loadingEntries && days.length > 0 && (
                        <div className="space-y-4 mt-2">
                            {days.map(day => {
                                const entry = entriesMap.get(day.dayNumber)
                                const isDone = !!entry?.completed_at

                                return (
                                    <div key={day.dayNumber} className="rounded-xl bg-bg-elevated border border-border p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            {isDone
                                                ? <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                                                : <Clock className="w-5 h-5 text-text-muted flex-shrink-0" />
                                            }
                                            <h4 className="font-display font-bold text-white">
                                                День {day.dayNumber}: {day.title}
                                            </h4>
                                            {isDone && entry?.completed_at && (
                                                <span className="text-xs text-text-muted ml-auto">
                                                    {new Date(entry.completed_at).toLocaleString('ru-RU')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {day.exercises.map(ex => {
                                                const cd = entry?.entry_data?.[ex.id]
                                                return (
                                                    <div key={ex.id} className="text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                                        <div className="flex items-baseline gap-2 mb-1">
                                                            <span className="text-white font-medium">{ex.name}</span>
                                                            <span className="text-text-muted text-xs">
                                                                план: {ex.sets}×{ex.reps}
                                                                {ex.targetWeights?.some(w => w > 0) && ` • ${ex.targetWeights.map(w => w > 0 ? w : '—').join('/')} кг`}
                                                            </span>
                                                        </div>
                                                        {cd ? (
                                                            <div className="ml-2">
                                                                {cd.sets && Array.isArray(cd.sets) ? (
                                                                    <div className="space-y-0.5">
                                                                        {cd.sets.map((s: any, i: number) => (
                                                                            <div key={i} className="text-xs text-accent">
                                                                                Подход {i + 1}: {s.weight ? `${s.weight} кг` : '—'} × {s.reps ? `${s.reps} повт.` : '—'}{s.rir !== undefined && s.rir !== '' ? ` • RIR ${s.rir}` : ''}
                                                                                {s.setComment && <span className="text-text-muted ml-1">— {s.setComment}</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-accent text-xs">
                                                                        факт: {cd.actualWeight ? `${cd.actualWeight}кг` : '—'} × {cd.actualReps ? `${cd.actualReps}повт` : '—'}
                                                                        {cd.rpe ? ` • RPE ${cd.rpe}` : ''}
                                                                    </span>
                                                                )}
                                                                {cd.comment && <div className="text-text-muted text-xs mt-0.5">💬 {cd.comment}</div>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-text-muted italic text-xs ml-2">не заполнено</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {entry && (
                                            <>
                                            {/* Статистика сессии */}
                                            {(() => {
                                                let tonnage = 0, setsCount = 0, repsCount = 0, exCount = 0
                                                day.exercises.forEach(ex => {
                                                    const cd = entry.entry_data?.[ex.id]
                                                    if (!cd) return
                                                    if (cd.sets && Array.isArray(cd.sets)) {
                                                        const filled = cd.sets.filter((s: any) => s.weight || s.reps)
                                                        if (filled.length > 0) {
                                                            exCount++
                                                            cd.sets.forEach((s: any) => {
                                                                const w = parseFloat(s.weight) || 0
                                                                const r = parseInt(s.reps) || 0
                                                                if (w || r) { tonnage += w * r; setsCount++; repsCount += r }
                                                            })
                                                        }
                                                    } else if (cd.actualWeight && cd.actualReps) {
                                                        exCount++
                                                        tonnage += (parseFloat(cd.actualWeight) || 0) * (parseInt(cd.actualReps) || 0)
                                                        setsCount += ex.sets
                                                        repsCount += (parseInt(cd.actualReps) || 0) * ex.sets
                                                    }
                                                })
                                                if (exCount === 0) return null
                                                return (
                                                    <div className="mt-3 pt-3 border-t border-border/40">
                                                        <p className="text-xs text-text-muted mb-2 font-semibold">📊 Статистика сессии</p>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {[
                                                                { label: 'Тоннаж', value: `${tonnage.toLocaleString('ru-RU')} кг`, color: 'text-accent' },
                                                                { label: 'Упражнений', value: exCount, color: 'text-white' },
                                                                { label: 'Подходов', value: setsCount, color: 'text-white' },
                                                                { label: 'Повторений', value: repsCount, color: 'text-white' },
                                                            ].map(stat => (
                                                                <div key={stat.label} className="rounded-lg bg-bg-main p-2 text-center">
                                                                    <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                                                                    <p className="text-xs text-text-muted">{stat.label}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-4 text-xs text-text-secondary">
                                                <span>⚡ Энергия: <strong className="text-white">{entry.energy_level ?? '—'}/10</strong></span>
                                                <span>😊 Настроение: <strong className="text-white">{entry.mood ?? '—'}/5</strong></span>
                                                <span>🏋️ RPE: <strong className="text-white">{entry.sleep_quality ?? '—'}/10</strong></span>
                                                {entry.notes && <span className="w-full text-text-muted">💬 {entry.notes}</span>}
                                            </div>
                                            </>
                                        )}

                                        {!entry && (
                                            <p className="mt-2 text-xs text-text-muted italic">Клиент ещё не заполнил этот день</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Модал редактирования */}
        {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <div className="relative z-10 glass-card p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-display font-bold text-white">
                            Редактировать — Неделя {program.week_number}
                        </h2>
                        <button onClick={() => setEditing(false)} className="glass-button-secondary p-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Дата начала</label>
                                <input type="date" value={editStartDate}
                                    onChange={e => setEditStartDate(e.target.value)}
                                    className="glass-input w-full" />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Дата окончания</label>
                                <input type="date" value={editEndDate}
                                    onChange={e => setEditEndDate(e.target.value)}
                                    className="glass-input w-full" />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Тренировочных дней</label>
                                <input type="number" min="2" max="7" value={editTrainingDays}
                                    onChange={e => setEditTrainingDays(parseInt(e.target.value))}
                                    className="glass-input w-full" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-2">Программа (Markdown)</label>
                            <textarea
                                value={editMd}
                                onChange={e => setEditMd(e.target.value)}
                                className="glass-input w-full h-96 resize-none font-mono text-sm"
                            />
                        </div>

                        {saveError && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                                {saveError}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setEditing(false)} className="glass-button-secondary flex-1">
                                Отмена
                            </button>
                            <button onClick={handleSaveEdit} disabled={saving}
                                className="glass-button flex-1 flex items-center justify-center gap-2">
                                {saving
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />Сохранение...</>
                                    : <><Check className="w-4 h-4" />Сохранить изменения</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}

// ─── Карточка плана питания (для админа) ────────────────────────────────────
function NutritionPlanCard({ plan, onDelete, onUpdate }: {
    plan: NutritionProgram
    onDelete: (id: string) => void
    onUpdate: (updated: NutritionProgram) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editMd, setEditMd] = useState('')
    const [editTitle, setEditTitle] = useState('')
    const [editStartDate, setEditStartDate] = useState('')
    const [editEndDate, setEditEndDate] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')

    const openEdit = () => {
        setEditMd(plan.plan_md)
        setEditTitle(plan.title)
        setEditStartDate(plan.start_date)
        setEditEndDate(plan.end_date)
        setSaveError('')
        setEditing(true)
    }

    const handleSaveEdit = async () => {
        if (!editMd.trim()) { setSaveError('План не может быть пустым'); return }
        if (!editStartDate || !editEndDate) { setSaveError('Укажите даты'); return }
        setSaving(true)
        setSaveError('')
        try {
            const { parseNutritionMdToJson } = await import('@/lib/utils/nutrition-md-parser')
            const planData = parseNutritionMdToJson(editMd)
            planData.planNumber = plan.plan_number
            planData.startDate = editStartDate
            planData.endDate = editEndDate

            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )

            const { data, error } = await db
                .from('nutrition_programs')
                .update({
                    plan_md: editMd,
                    plan_data: planData,
                    title: editTitle || plan.title,
                    start_date: editStartDate,
                    end_date: editEndDate,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', plan.id)
                .select()
                .single()

            if (error) throw new Error(error.message)
            onUpdate(data)
            setEditing(false)
        } catch (e: any) {
            setSaveError(e.message || 'Ошибка сохранения')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirmDelete) { setConfirmDelete(true); return }
        setDeleting(true)
        try {
            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )
            const { error } = await db.from('nutrition_programs').delete().eq('id', plan.id)
            if (error) throw new Error(error.message)
            onDelete(plan.id)
        } catch (e: any) {
            console.error('Delete nutrition plan error:', e)
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    const days = plan.plan_data?.days || []

    return (
        <>
        <div className="glass-card overflow-hidden">
            <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpanded(v => !v)}>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Apple className="w-4 h-4 text-accent flex-shrink-0" />
                        <h3 className="text-base font-display font-bold text-white truncate">
                            {plan.title || `План питания №${plan.plan_number}`}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                            plan.status === 'active' ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-muted'
                        }`}>
                            {plan.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={openEdit} className="glass-button-secondary p-2" title="Редактировать">
                            <Pencil className="w-4 h-4" />
                        </button>
                        {confirmDelete ? (
                            <div className="flex items-center gap-1">
                                <button onClick={handleDelete} disabled={deleting}
                                    className="px-2 py-1.5 rounded-xl bg-danger/20 border border-danger/40 text-danger text-xs font-semibold">
                                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Да'}
                                </button>
                                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 rounded-xl glass-button-secondary text-xs">Нет</button>
                            </div>
                        ) : (
                            <button onClick={handleDelete} className="glass-button-secondary p-2 text-danger hover:border-danger/40" title="Удалить">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <div className="ml-1">
                            {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                        </div>
                    </div>
                </div>
                <p className="text-xs text-text-secondary">
                    {new Date(plan.start_date).toLocaleDateString('ru-RU')} — {new Date(plan.end_date).toLocaleDateString('ru-RU')}
                    {' · '}{days.length} дней
                    {plan.plan_data?.dailyKcal && <span className="ml-2 text-accent">{plan.plan_data.dailyKcal} ккал/день</span>}
                </p>
            </div>

            {expanded && (
                <div className="border-t border-border px-6 pb-6 pt-4">
                    {days.length === 0 ? (
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono bg-bg-elevated p-4 rounded-xl max-h-64 overflow-y-auto">
                            {plan.plan_md}
                        </pre>
                    ) : (
                        <div className="space-y-3">
                            {days.map(day => (
                                <div key={day.dayNumber} className="rounded-xl bg-bg-elevated border border-border p-4">
                                    <h4 className="font-display font-bold text-white mb-2">
                                        День {day.dayNumber}: {day.title}
                                    </h4>
                                    {day.totalKcal && (
                                        <div className="flex gap-3 text-xs mb-2">
                                            <span className="text-accent">{day.totalKcal} ккал</span>
                                            {day.totalProtein && <span className="text-text-secondary">Б: {day.totalProtein}г</span>}
                                            {day.totalFat && <span className="text-text-secondary">Ж: {day.totalFat}г</span>}
                                            {day.totalCarbs && <span className="text-text-secondary">У: {day.totalCarbs}г</span>}
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        {day.meals.map((meal, idx) => (
                                            <div key={idx} className="text-sm flex items-center gap-2">
                                                <span className="text-text-muted">{meal.name}</span>
                                                {meal.kcal && <span className="text-accent text-xs">{meal.kcal} ккал</span>}
                                                <span className="text-text-muted text-xs">({meal.dishes.length} блюд)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Модал редактирования */}
        {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <div className="relative z-10 glass-card p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-display font-bold text-white">
                            Редактировать — {plan.title || `План №${plan.plan_number}`}
                        </h2>
                        <button onClick={() => setEditing(false)} className="glass-button-secondary p-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm text-text-secondary mb-2">Название</label>
                                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="glass-input w-full" />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Дата начала</label>
                                <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="glass-input w-full" />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Дата окончания</label>
                                <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="glass-input w-full" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-2">План питания (Markdown)</label>
                            <textarea value={editMd} onChange={e => setEditMd(e.target.value)}
                                className="glass-input w-full h-96 resize-none font-mono text-sm" />
                        </div>

                        {saveError && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{saveError}</div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setEditing(false)} className="glass-button-secondary flex-1">Отмена</button>
                            <button onClick={handleSaveEdit} disabled={saving} className="glass-button flex-1 flex items-center justify-center gap-2">
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Сохранение...</> : <><Check className="w-4 h-4" />Сохранить</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}

// ─── Прогресс упражнений для админа ─────────────────────────────────────────
function AdminExerciseStats({ userId }: { userId: string }) {
    const [programs, setPrograms] = useState<TrainingProgram[]>([])
    const [entries, setEntries] = useState<TrainingEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const { createClient: createDirectClient } = await import('@supabase/supabase-js')
                const db = createDirectClient(
                    'https://bzyypoyvihqhrbllgffh.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                    { auth: { persistSession: false } }
                )
                const [progsRes, entriesRes] = await Promise.all([
                    db.from('training_programs').select('*').eq('user_id', userId).order('week_number', { ascending: true }),
                    db.from('training_entries').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
                ])
                setPrograms(progsRes.data || [])
                setEntries(entriesRes.data || [])
            } catch (e) {
                console.error('AdminExerciseStats load error:', e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [userId])

    if (loading) return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
    )

    return (
        <div>
            <h2 className="text-lg font-display font-bold text-white mb-4">
                📊 Прогресс упражнений
            </h2>
            <ExerciseProgressView programs={programs} entries={entries} />
        </div>
    )
}

// ─── Главная страница ────────────────────────────────────────────────────────
export default function AdminClientDetailPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const params = useParams()
    const userId = params.userId as string

    const [activeTab, setActiveTab] = useState<Tab>('programs')
    const [isLoading, setIsLoading] = useState(true)
    const [isAdminUser, setIsAdminUser] = useState(false)

    const [clientProfile, setClientProfile] = useState<any>(null)
    const [questionnaire, setQuestionnaire] = useState<ClientQuestionnaire | null>(null)
    const [nutritionQ, setNutritionQ] = useState<NutritionQuestionnaire | null>(null)
    const [nutritionAccess, setNutritionAccess] = useState(false)
    const [programs, setPrograms] = useState<TrainingProgram[]>([])
    const [nutritionPlans, setNutritionPlans] = useState<NutritionProgram[]>([])
    const [isArchiving, setIsArchiving] = useState(false)
    const [clientPayment, setClientPayment] = useState<any>(null)

    // Upload nutrition plan modal state
    const [showNutritionModal, setShowNutritionModal] = useState(false)
    const [nutritionMd, setNutritionMd] = useState('')
    const [nutritionPlanNumber, setNutritionPlanNumber] = useState(1)
    const [nutritionTitle, setNutritionTitle] = useState('План питания')
    const [nutritionStartDate, setNutritionStartDate] = useState('')
    const [nutritionEndDate, setNutritionEndDate] = useState('')
    const [isUploadingNutrition, setIsUploadingNutrition] = useState(false)
    const [nutritionUploadError, setNutritionUploadError] = useState('')

    // Upload modal state
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [programMd, setProgramMd] = useState('')
    const [weekNumber, setWeekNumber] = useState(1)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [trainingDays, setTrainingDays] = useState(3)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')

    // Renew modal state
    const [showRenewModal, setShowRenewModal] = useState(false)
    const [renewPlanMonths, setRenewPlanMonths] = useState(1)
    const [renewPlanType, setRenewPlanType] = useState<'1_month' | '3_months' | '6_months'>('1_month')
    const [renewIncludesNutrition, setRenewIncludesNutrition] = useState(false)
    const [renewAmount, setRenewAmount] = useState('')
    const [isRenewing, setIsRenewing] = useState(false)
    const [renewError, setRenewError] = useState('')

    useEffect(() => {
        if (!authLoading && !user) {
            window.location.href = '/auth'
        }
    }, [user, authLoading])

    useEffect(() => {
        if (!user) return
        const checkAdmin = async () => {
            try {
                const admin = await isAdmin(user)
                if (!admin) { window.location.href = '/dashboard'; return }
                setIsAdminUser(true)
            } catch {
                window.location.href = '/dashboard'
            }
        }
        checkAdmin()
    }, [user])

    useEffect(() => {
        if (!isAdminUser || !userId) return
        const load = async () => {
            try {
                const [profile, quest, progs, nutQ, nutAccess] = await Promise.allSettled([
                    getUserDetails(userId),
                    getQuestionnaireByUserId(userId),
                    getClientPrograms(userId),
                    getNutritionQuestionnaireByUserId(userId),
                    userHasNutritionAccess(userId),
                ])
                setClientProfile(profile.status === 'fulfilled' ? profile.value : null)
                setQuestionnaire(quest.status === 'fulfilled' ? quest.value : null)
                setPrograms(progs.status === 'fulfilled' ? progs.value : [])
                setNutritionQ(nutQ.status === 'fulfilled' ? nutQ.value : null)
                setNutritionAccess(nutAccess.status === 'fulfilled' ? nutAccess.value : false)

                // Загружаем планы питания через service role (обходит RLS)
                try {
                    const { createClient: createDirectClient } = await import('@supabase/supabase-js')
                    const dbNut = createDirectClient(
                        'https://bzyypoyvihqhrbllgffh.supabase.co',
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                        { auth: { persistSession: false } }
                    )
                    const { data: nutPlansData } = await dbNut
                        .from('nutrition_programs')
                        .select('*')
                        .eq('user_id', userId)
                        .order('plan_number', { ascending: false })
                    const nutPlans = nutPlansData || []
                    setNutritionPlans(nutPlans)
                    if (nutPlans.length > 0) setNutritionPlanNumber(nutPlans[0].plan_number + 1)
                } catch {}

                // Загружаем платёж клиента для отображения подписки
                try {
                    const { createClient: createDirectClient } = await import('@supabase/supabase-js')
                    const db = createDirectClient(
                        'https://bzyypoyvihqhrbllgffh.supabase.co',
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                        { auth: { persistSession: false } }
                    )
                    const { data: paymentData } = await db
                        .from('payments')
                        .select('plan_type, plan_months, confirmed_at, status, includes_nutrition')
                        .eq('user_id', userId)
                        .eq('status', 'confirmed')
                        .order('confirmed_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()
                    setClientPayment(paymentData)
                } catch {}
            } catch (e) {
                console.error('Error loading client data:', e)
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [isAdminUser, userId])

    const handleArchiveToggle = async () => {
        const isCurrentlyArchived = clientProfile?.is_archived
        const action = isCurrentlyArchived ? 'восстановить клиента из архива' : 'переместить клиента в архив'
        if (!confirm(`Вы уверены что хотите ${action}?`)) return
        setIsArchiving(true)
        const fn = isCurrentlyArchived ? unarchiveUser : archiveUser
        const { success, error } = await fn(userId)
        if (success) {
            setClientProfile((prev: any) => ({ ...prev, is_archived: !isCurrentlyArchived }))
        } else {
            alert('Ошибка: ' + error)
        }
        setIsArchiving(false)
    }

    const handleUploadProgram = async () => {
        setUploadError('')
        setIsUploading(true)
        try {
            if (!startDate || !endDate) { setUploadError('Укажите даты'); return }
            if (!programMd.trim()) { setUploadError('Введите программу'); return }

            const programData = parseMdToJson(programMd)
            programData.weekNumber = weekNumber
            programData.startDate = startDate
            programData.endDate = endDate

            // Создаём напрямую через service role — без API route, без токена
            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )

            // Удаляем существующую программу для этой недели
            await db.from('training_programs').delete().eq('user_id', userId).eq('week_number', weekNumber)

            const { data, error } = await db
                .from('training_programs')
                .insert({
                    user_id: userId,
                    week_number: weekNumber,
                    start_date: startDate,
                    end_date: endDate,
                    training_days_count: trainingDays,
                    program_md: programMd,
                    program_data: programData,
                    status: 'active',
                })
                .select()
                .single()

            if (error) { setUploadError('Ошибка БД: ' + error.message); return }

            // Уведомление клиенту
            db.from('notifications').insert({
                user_id: userId,
                type: 'program_uploaded',
                title: 'Новая программа! 💪',
                message: `Тренер загрузил программу на неделю ${weekNumber}.`,
                link: '/programs',
                read: false,
            }).then(() => {})

            const updated = await getClientPrograms(userId)
            setPrograms(updated)
            setShowUploadModal(false)
            setProgramMd('')
            setWeekNumber(weekNumber + 1)
        } catch (e: any) {
            setUploadError(e.message || 'Ошибка загрузки')
        } finally {
            setIsUploading(false)
        }
    }

    const handleUploadNutritionPlan = async () => {
        setNutritionUploadError('')
        setIsUploadingNutrition(true)
        try {
            if (!nutritionStartDate || !nutritionEndDate) { setNutritionUploadError('Укажите даты'); return }
            if (!nutritionMd.trim()) { setNutritionUploadError('Введите план питания'); return }

            const planData = parseNutritionMdToJson(nutritionMd)
            planData.planNumber = nutritionPlanNumber
            planData.startDate = nutritionStartDate
            planData.endDate = nutritionEndDate

            const { createClient: createDirectClient } = await import('@supabase/supabase-js')
            const db = createDirectClient(
                'https://bzyypoyvihqhrbllgffh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
                { auth: { persistSession: false } }
            )

            const { data, error } = await db
                .from('nutrition_programs')
                .insert({
                    user_id: userId,
                    plan_number: nutritionPlanNumber,
                    title: nutritionTitle || `План питания №${nutritionPlanNumber}`,
                    start_date: nutritionStartDate,
                    end_date: nutritionEndDate,
                    plan_md: nutritionMd,
                    plan_data: planData,
                    status: 'active',
                })
                .select()
                .single()

            if (error) { setNutritionUploadError('Ошибка БД: ' + error.message); return }

            // Уведомление клиенту
            db.from('notifications').insert({
                user_id: userId,
                type: 'nutrition_plan_uploaded',
                title: 'Новый план питания! 🥗',
                message: `Тренер загрузил план питания №${nutritionPlanNumber}.`,
                link: '/nutrition',
                read: false,
            }).then(() => {})

            const updated2 = await db
                .from('nutrition_programs')
                .select('*')
                .eq('user_id', userId)
                .order('plan_number', { ascending: false })
            setNutritionPlans(updated2.data || [])
            setShowNutritionModal(false)
            setNutritionMd('')
            setNutritionPlanNumber(nutritionPlanNumber + 1)
        } catch (e: any) {
            setNutritionUploadError(e.message || 'Ошибка загрузки')
        } finally {
            setIsUploadingNutrition(false)
        }
    }

    if (authLoading || isLoading || !isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-6 md:py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8 min-w-0">
                    <button onClick={() => router.push('/admin/clients')} className="glass-button-secondary flex items-center gap-2 flex-shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Назад</span>
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-display font-bold text-white truncate">
                                {clientProfile?.full_name || 'Клиент'}
                            </h1>
                            {clientProfile?.is_archived && (
                                <span className="px-2 py-0.5 rounded-full bg-text-muted/20 text-text-muted text-xs font-semibold flex items-center gap-1">
                                    <Archive className="w-3 h-3" /> Архив
                                </span>
                            )}
                        </div>
                        <p className="text-text-secondary text-sm truncate">{clientProfile?.email}</p>
                    </div>
                    <button
                        onClick={handleArchiveToggle}
                        disabled={isArchiving}
                        className={`glass-button-secondary flex items-center gap-2 flex-shrink-0 text-sm transition-colors ${
                            clientProfile?.is_archived
                                ? 'hover:text-success hover:border-success/40'
                                : 'hover:text-warning hover:border-warning/40'
                        }`}
                    >
                        {isArchiving
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : clientProfile?.is_archived
                                ? <ArchiveRestore className="w-4 h-4" />
                                : <Archive className="w-4 h-4" />
                        }
                        <span className="hidden sm:inline">
                            {clientProfile?.is_archived ? 'Из архива' : 'В архив'}
                        </span>
                    </button>
                </div>

                {/* Блок подписки */}
                {clientPayment && clientPayment.confirmed_at && clientPayment.plan_months && (() => {
                    const planLabels: Record<string, string> = { '1_month': '1 месяц', '3_months': '3 месяца', '6_months': '6 месяцев' }
                    const totalDays = clientPayment.plan_months * 30
                    const endDate = new Date(clientPayment.confirmed_at)
                    endDate.setMonth(endDate.getMonth() + clientPayment.plan_months)
                    const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    const daysLeftClamped = Math.max(0, daysLeft)
                    const pct = Math.min(100, Math.max(0, (daysLeftClamped / totalDays) * 100))
                    const isExpiring = daysLeftClamped <= 14
                    const isWarning = daysLeftClamped <= 30 && daysLeftClamped > 14
                    const barColor = isExpiring ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-accent'
                    const textColor = isExpiring ? 'text-danger' : isWarning ? 'text-warning' : 'text-accent'

                    return (
                        <div className="glass-card p-4 mb-4">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Calendar className="w-4 h-4 text-text-muted flex-shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-sm text-text-muted">Тариф: </span>
                                        <span className="text-sm font-semibold text-white">{planLabels[clientPayment.plan_type] || clientPayment.plan_type}</span>
                                        {clientPayment.includes_nutrition && (
                                            <span className="ml-2 text-xs text-accent">+ питание</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className={`text-xl font-display font-bold ${textColor}`}>{daysLeftClamped}</span>
                                    <span className="text-sm text-text-muted ml-1">дн.</span>
                                </div>
                            </div>
                            <div className="h-2 bg-bg-elevated rounded-full overflow-hidden mb-1.5">
                                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-text-muted">
                                <span>с {new Date(clientPayment.confirmed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                                <span className={isExpiring ? 'text-danger font-semibold' : ''}>
                                    до {endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>

                            {/* Кнопки управления подпиской */}
                            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                                <button
                                    onClick={() => setShowRenewModal(true)}
                                    className="glass-button-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Продлить
                                </button>
                                {!clientPayment.includes_nutrition && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Подключить план питания клиенту бесплатно?')) return
                                            const { enableNutritionForClient } = await import('@/lib/services/admin')
                                            const result = await enableNutritionForClient(userId)
                                            if (result.success) {
                                                setClientPayment((prev: any) => prev ? { ...prev, includes_nutrition: true } : prev)
                                                alert('Питание подключено!')
                                            } else {
                                                alert('Ошибка: ' + result.error)
                                            }
                                        }}
                                        className="glass-button-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                                    >
                                        <Apple className="w-3.5 h-3.5" />
                                        Подключить питание
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })()}

                {/* Tabs */}
                <div className="-mx-4 px-4 flex gap-2 mb-6 overflow-x-auto pb-1" style={{scrollbarWidth: 'none'}}>
                    {(['questionnaire', 'nutrition', 'programs', 'nutrition_plans', 'metrics', 'exercise_stats'] as Tab[]).map(tab => {
                        if (tab === 'nutrition' && !nutritionAccess) return null
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-2 rounded-xl font-semibold transition-all whitespace-nowrap flex-shrink-0 text-sm ${
                                    activeTab === tab ? 'bg-accent text-bg-main' : 'glass-button-secondary text-text-secondary'
                                }`}
                            >
                                {tab === 'questionnaire' && <><FileText className="w-4 h-4 inline mr-1" />Анкета</>}
                                {tab === 'nutrition' && <><Apple className="w-4 h-4 inline mr-1" />Питание</>}
                                {tab === 'programs' && <><Dumbbell className="w-4 h-4 inline mr-1" />Программы</>}
                                {tab === 'nutrition_plans' && <><Apple className="w-4 h-4 inline mr-1" />Планы питания</>}
                                {tab === 'metrics' && <><TrendingUp className="w-4 h-4 inline mr-1" />Метрики</>}
                                {tab === 'exercise_stats' && <>📊 Прогресс</>}
                            </button>
                        )
                    })}
                </div>

                {/* Анкета */}
                {activeTab === 'questionnaire' && (
                    <div className="glass-card p-4 sm:p-8">
                        {questionnaire ? (
                            <div className="space-y-8">

                                {/* Шапка: дата + кнопка копирования */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-accent flex-shrink-0" />
                                            Анкета тренировок
                                        </h2>
                                        <p className="text-xs text-text-muted mt-1">
                                            Заполнена {new Date(questionnaire.created_at).toLocaleDateString('ru-RU')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const { formatQuestionnaireForAdmin } = await import('@/lib/services/questionnaire')
                                            const text = formatQuestionnaireForAdmin(questionnaire, {
                                                full_name: clientProfile?.full_name,
                                                email: clientProfile?.email,
                                            })
                                            navigator.clipboard.writeText(text)
                                                .then(() => alert('Анкета скопирована в буфер обмена'))
                                                .catch(() => alert('Не удалось скопировать'))
                                        }}
                                        className="glass-button-secondary flex items-center gap-2 text-sm self-start sm:self-auto"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Скопировать анкету
                                    </button>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 1 · Основные данные</h3>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div><p className="text-xs text-text-muted">Имя</p><p className="text-white font-semibold">{questionnaire.full_name || clientProfile?.full_name || '—'}</p></div>
                                        <div><p className="text-xs text-text-muted">Возраст</p><p className="text-white font-semibold">{questionnaire.age || '—'}</p></div>
                                        <div><p className="text-xs text-text-muted">Пол</p><p className="text-white font-semibold">{questionnaire.gender === 'male' ? 'Мужской' : questionnaire.gender === 'female' ? 'Женский' : '—'}</p></div>
                                        <div><p className="text-xs text-text-muted">Вес</p><p className="text-white font-semibold">{questionnaire.weight_kg ? `${questionnaire.weight_kg} кг` : '—'}</p></div>
                                        <div><p className="text-xs text-text-muted">Рост</p><p className="text-white font-semibold">{questionnaire.height_cm ? `${questionnaire.height_cm} см` : '—'}</p></div>
                                        {questionnaire.gender === 'female' && (
                                            <div><p className="text-xs text-text-muted">Цикл</p><p className="text-white text-sm">{
                                                questionnaire.female_cycle === 'regular' ? 'Регулярный' :
                                                questionnaire.female_cycle === 'hormonal' ? 'Гормональные контрацептивы' :
                                                questionnaire.female_cycle === 'irregular' ? 'Нерегулярный / отсутствует' :
                                                questionnaire.female_cycle === 'menopause' ? 'Менопауза / перименопауза' : '—'
                                            }</p></div>
                                        )}
                                    </div>
                                </div>

                                {/* Блок 2: Цель */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 2 · Цель</h3>
                                    <div className="space-y-3">
                                        <div><p className="text-xs text-text-muted">Главная цель</p><p className="text-white font-semibold">{
                                            questionnaire.goal === 'muscle_gain' ? 'Набор мышечной массы' :
                                            questionnaire.goal === 'fat_loss' ? 'Похудение / снижение % жира' :
                                            questionnaire.goal === 'strength' ? 'Развитие силы' :
                                            questionnaire.goal === 'general_fitness' ? 'Улучшение общей физической формы' :
                                            questionnaire.goal === 'competition' ? 'Подготовка к соревнованиям' :
                                            questionnaire.goal === 'rehabilitation' ? 'Реабилитация и восстановление' :
                                            questionnaire.goal || '—'
                                        }</p></div>
                                        {questionnaire.goal_deadline && (
                                            <div><p className="text-xs text-text-muted">Дата / событие</p><p className="text-white">{questionnaire.goal_deadline}</p></div>
                                        )}
                                        {questionnaire.goal_motivation && (
                                            <div>
                                                <p className="text-xs text-text-muted mb-1">Важность результата</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                                                        <div className="h-full bg-accent rounded-full" style={{ width: `${(questionnaire.goal_motivation / 10) * 100}%` }} />
                                                    </div>
                                                    <span className="text-white font-bold text-sm w-8">{questionnaire.goal_motivation}/10</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Блок 3: Тренировочный опыт */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 3 · Тренировочный опыт</h3>
                                    <div className="space-y-3">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div><p className="text-xs text-text-muted">Стаж тренировок</p><p className="text-white">{
                                                questionnaire.training_experience === 'none' ? 'Никогда / перерыв > года' :
                                                questionnaire.training_experience === 'under_1' ? 'До 1 года' :
                                                questionnaire.training_experience === '1_3' ? '1–3 года' :
                                                questionnaire.training_experience === 'over_3' ? 'Более 3 лет' :
                                                questionnaire.training_experience || '—'
                                            }</p></div>
                                            <div><p className="text-xs text-text-muted">Уровень подготовки</p><p className="text-white">{
                                                questionnaire.fitness_level === 'beginner' ? 'Новичок' :
                                                questionnaire.fitness_level === 'intermediate' ? 'Средний' :
                                                questionnaire.fitness_level === 'advanced' ? 'Продвинутый' :
                                                questionnaire.fitness_level || '—'
                                            }</p></div>
                                            <div><p className="text-xs text-text-muted">Перерывы за год</p><p className="text-white">{
                                                questionnaire.training_breaks === 'none' ? 'Нет, стабильно' :
                                                questionnaire.training_breaks === '1_3' ? 'Перерыв 1–3 мес' :
                                                questionnaire.training_breaks === 'over_3' ? 'Перерыв > 3 мес' :
                                                questionnaire.training_breaks || '—'
                                            }</p></div>
                                        </div>
                                        {questionnaire.previous_training_types && questionnaire.previous_training_types.length > 0 && (
                                            <div>
                                                <p className="text-xs text-text-muted mb-2">Виды тренировок раньше</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {questionnaire.previous_training_types.map(t => (
                                                        <span key={t} className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs">{
                                                            t === 'weights' ? 'Силовые' : t === 'machines' ? 'Тренажёры' :
                                                            t === 'crossfit' ? 'Кроссфит' : t === 'cardio' ? 'Кардио' :
                                                            t === 'martial_arts' ? 'Единоборства' : t === 'none' ? 'Ничего' : t
                                                        }</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {questionnaire.previous_program && (
                                            <div><p className="text-xs text-text-muted">Предыдущая программа</p><p className="text-white bg-bg-elevated p-3 rounded-xl text-sm">{questionnaire.previous_program}</p></div>
                                        )}
                                    </div>
                                </div>

                                {/* Блок 4: Показатели силы */}
                                {(questionnaire.strength_squat || questionnaire.strength_bench || questionnaire.strength_deadlift || questionnaire.strength_pullups !== undefined || questionnaire.strength_pushups !== undefined) && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 4 · Текущие показатели силы</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            {[
                                                { label: 'Присед', value: questionnaire.strength_squat, unit: 'кг' },
                                                { label: 'Жим лёжа', value: questionnaire.strength_bench, unit: 'кг' },
                                                { label: 'Становая', value: questionnaire.strength_deadlift, unit: 'кг' },
                                                { label: 'Подтягивания', value: questionnaire.strength_pullups, unit: 'раз' },
                                                { label: 'Отжимания', value: questionnaire.strength_pushups, unit: 'раз' },
                                            ].map(({ label, value, unit }) => (
                                                <div key={label} className="text-center p-3 rounded-xl bg-bg-elevated">
                                                    <p className="text-xs text-text-muted mb-1">{label}</p>
                                                    <p className="text-xl font-display font-bold text-accent">{value ?? '—'}</p>
                                                    {value !== undefined && value !== null && <p className="text-xs text-text-muted">{unit}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Блок 5: Условия тренировок */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 5 · Условия тренировок</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><p className="text-xs text-text-muted">Место тренировок</p><p className="text-white">{
                                            questionnaire.training_location === 'gym' ? 'Тренажёрный зал' :
                                            questionnaire.training_location === 'home_equipment' ? 'Дома с оборудованием' :
                                            questionnaire.training_location === 'home_bodyweight' ? 'Дома без оборудования' :
                                            questionnaire.training_location === 'mixed' ? 'Смешанно (зал + дома)' :
                                            questionnaire.training_location || '—'
                                        }</p></div>
                                        {questionnaire.home_equipment && (
                                            <div><p className="text-xs text-text-muted">Оборудование дома</p><p className="text-white">{questionnaire.home_equipment}</p></div>
                                        )}
                                        <div><p className="text-xs text-text-muted">Дней в неделю</p><p className="text-white font-bold text-lg">{questionnaire.preferred_training_days ?? '—'}</p></div>
                                        <div><p className="text-xs text-text-muted">Длительность тренировки</p><p className="text-white">{
                                            questionnaire.session_duration === 'under_45' ? 'До 45 минут' :
                                            questionnaire.session_duration === '45_60' ? '45–60 минут' :
                                            questionnaire.session_duration === '60_90' ? '60–90 минут' :
                                            questionnaire.session_duration === 'over_90' ? 'Более 90 минут' :
                                            questionnaire.session_duration || '—'
                                        }</p></div>
                                        <div><p className="text-xs text-text-muted">Время тренировок</p><p className="text-white">{
                                            questionnaire.training_time === 'morning' ? 'Утро (6:00–10:00)' :
                                            questionnaire.training_time === 'day' ? 'День (10:00–16:00)' :
                                            questionnaire.training_time === 'evening' ? 'Вечер (16:00–21:00)' :
                                            questionnaire.training_time === 'varies' ? 'По-разному' :
                                            questionnaire.training_time || '—'
                                        }</p></div>
                                    </div>
                                </div>

                                {/* Блок 6: Здоровье */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 6 · Здоровье и ограничения</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${questionnaire.has_injuries ? 'bg-danger' : 'bg-success'}`} />
                                            <p className="text-white text-sm">{questionnaire.has_injuries ? 'Есть травмы / боли' : 'Травм нет'}</p>
                                        </div>
                                        {questionnaire.has_injuries && (
                                            <>
                                                {questionnaire.injury_zones && questionnaire.injury_zones.length > 0 && (
                                                    <div>
                                                        <p className="text-xs text-text-muted mb-2">Зоны</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {questionnaire.injury_zones.map(z => (
                                                                <span key={z} className="px-2 py-0.5 rounded-full bg-danger/20 text-danger text-xs">{
                                                                    z === 'lower_back' ? 'Поясница' : z === 'knees' ? 'Колени' :
                                                                    z === 'shoulders' ? 'Плечи' : z === 'neck' ? 'Шея' :
                                                                    z === 'elbows' ? 'Локти / запястья' : z === 'hips' ? 'Тазобедренный' : z
                                                                }</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {questionnaire.injuries && (
                                                    <div><p className="text-xs text-text-muted">Описание</p><p className="text-white bg-bg-elevated p-3 rounded-xl text-sm">{questionnaire.injuries}</p></div>
                                                )}
                                                <div><p className="text-xs text-text-muted">Влияние на тренировки</p><p className="text-white">{
                                                    questionnaire.injury_impact === 'mild' ? 'Лёгкий дискомфорт' :
                                                    questionnaire.injury_impact === 'avoid' ? 'Избегаю упражнений' :
                                                    questionnaire.injury_impact === 'severe' ? 'Серьёзно ограничивает' :
                                                    questionnaire.injury_impact || '—'
                                                }</p></div>
                                            </>
                                        )}
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div><p className="text-xs text-text-muted">Операции</p><p className="text-white">{questionnaire.surgeries || '—'}</p></div>
                                            <div><p className="text-xs text-text-muted">Препараты</p><p className="text-white">{questionnaire.medications || '—'}</p></div>
                                        </div>
                                        {questionnaire.chronic_conditions && questionnaire.chronic_conditions.length > 0 && !questionnaire.chronic_conditions.includes('none') && (
                                            <div>
                                                <p className="text-xs text-text-muted mb-2">Хронические заболевания</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {questionnaire.chronic_conditions.map(c => (
                                                        <span key={c} className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs">{
                                                            c === 'cardiovascular' ? 'Сердечно-сосудистые' :
                                                            c === 'diabetes' ? 'Диабет / обмен веществ' :
                                                            c === 'hypertension' ? 'Гипертония' :
                                                            c === 'spine' ? 'Позвоночник (грыжа, сколиоз)' : c
                                                        }</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Блок 7: Восстановление */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 7 · Восстановление и образ жизни</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><p className="text-xs text-text-muted">Сон</p><p className="text-white font-semibold">{questionnaire.sleep_hours_avg ? `${questionnaire.sleep_hours_avg} ч` : '—'}</p></div>
                                        <div><p className="text-xs text-text-muted">Качество сна</p><p className="text-white">{
                                            questionnaire.sleep_quality === 'good' ? 'Хорошее' :
                                            questionnaire.sleep_quality === 'hard_to_fall' ? 'Проблемы с засыпанием' :
                                            questionnaire.sleep_quality === 'wake_up' ? 'Часто просыпаюсь' :
                                            questionnaire.sleep_quality === 'bad' ? 'Плохой регулярно' :
                                            questionnaire.sleep_quality || '—'
                                        }</p></div>
                                        <div><p className="text-xs text-text-muted">Стресс</p><p className="text-white">{
                                            String(questionnaire.stress_level) === 'low' ? 'Низкий' :
                                            String(questionnaire.stress_level) === 'medium' ? 'Средний' :
                                            String(questionnaire.stress_level) === 'high' ? 'Высокий' :
                                            questionnaire.stress_level ? String(questionnaire.stress_level) : '—'
                                        }</p></div>
                                        <div><p className="text-xs text-text-muted">Деятельность</p><p className="text-white">{
                                            questionnaire.activity_level === 'sedentary' ? 'Сидячая' :
                                            questionnaire.activity_level === 'mixed' ? 'Смешанная' :
                                            questionnaire.activity_level === 'active' ? 'Активная' :
                                            questionnaire.activity_level === 'physical' ? 'Физически тяжёлая' :
                                            questionnaire.activity_level || '—'
                                        }</p></div>
                                    </div>
                                    {questionnaire.supplements && questionnaire.supplements.length > 0 && !questionnaire.supplements.includes('none') && (
                                        <div className="mt-3">
                                            <p className="text-xs text-text-muted mb-2">Спортивное питание</p>
                                            <div className="flex flex-wrap gap-2">
                                                {questionnaire.supplements.map(s => (
                                                    <span key={s} className="px-2 py-0.5 rounded-full bg-info/20 text-info text-xs">{
                                                        s === 'protein' ? 'Протеин' : s === 'creatine' ? 'Креатин' :
                                                        s === 'vitamins' ? 'Витамины / омега-3' : s
                                                    }</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Блок 8: Дополнительно */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Блок 8 · Дополнительно</h3>
                                    <div className="space-y-3">
                                        <div><p className="text-xs text-text-muted">Питание</p><p className="text-white">{
                                            questionnaire.nutrition_style === 'healthy' ? 'Стараюсь питаться правильно' :
                                            questionnaire.nutrition_style === 'chaotic' ? 'Питаюсь хаотично' :
                                            questionnaire.nutrition_style === 'tracking' ? 'Слежу за калориями и белком' :
                                            questionnaire.nutrition_style === 'restricted' ? 'Есть ограничения (вегетарианство, аллергии)' :
                                            questionnaire.nutrition_style || '—'
                                        }</p></div>
                                        {questionnaire.additional_notes && (
                                            <div><p className="text-xs text-text-muted">Дополнительная информация</p>
                                                <p className="text-white bg-bg-elevated p-4 rounded-xl text-sm">{questionnaire.additional_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Начальные замеры */}
                                {(questionnaire.waist_cm || questionnaire.hips_cm || questionnaire.chest_cm || questionnaire.arm_cm || questionnaire.thigh_cm) && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Начальные замеры</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {[
                                                { label: 'Талия', value: questionnaire.waist_cm },
                                                { label: 'Бёдра', value: questionnaire.hips_cm },
                                                { label: 'Грудь', value: questionnaire.chest_cm },
                                                { label: 'Рука', value: questionnaire.arm_cm },
                                                { label: 'Бедро', value: questionnaire.thigh_cm },
                                            ].map(({ label, value }) => value ? (
                                                <div key={label} className="text-center p-3 rounded-xl bg-bg-elevated">
                                                    <p className="text-xs text-text-muted mb-1">{label}</p>
                                                    <p className="text-lg font-display font-bold text-white">{value}</p>
                                                    <p className="text-xs text-text-muted">см</p>
                                                </div>
                                            ) : null)}
                                        </div>
                                    </div>
                                )}

                                {/* Стартовые фото */}
                                {(questionnaire.photo_front || questionnaire.photo_side || questionnaire.photo_back) && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Стартовые фото</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { label: 'Спереди', url: questionnaire.photo_front },
                                                { label: 'Сбоку', url: questionnaire.photo_side },
                                                { label: 'Сзади', url: questionnaire.photo_back },
                                            ].map(({ label, url }) => url ? (
                                                <div key={label} className="text-center">
                                                    <p className="text-xs text-text-muted mb-2">{label}</p>
                                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                                        <img src={url} alt={label}
                                                            className="w-full h-64 object-contain rounded-xl bg-bg-elevated hover:opacity-90 transition-opacity cursor-pointer" />
                                                    </a>
                                                </div>
                                            ) : null)}
                                        </div>
                                    </div>
                                )}

                                {/* Начальные замеры */}
                                {(questionnaire.waist_cm || questionnaire.hips_cm || questionnaire.chest_cm || questionnaire.arm_cm || questionnaire.thigh_cm) && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Начальные замеры</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {[
                                                { label: 'Талия', value: questionnaire.waist_cm },
                                                { label: 'Бёдра', value: questionnaire.hips_cm },
                                                { label: 'Грудь', value: questionnaire.chest_cm },
                                                { label: 'Рука', value: questionnaire.arm_cm },
                                                { label: 'Бедро', value: questionnaire.thigh_cm },
                                            ].map(({ label, value }) => value ? (
                                                <div key={label} className="text-center p-3 rounded-xl bg-bg-elevated">
                                                    <p className="text-xs text-text-muted mb-1">{label}</p>
                                                    <p className="text-lg font-display font-bold text-white">{value}</p>
                                                    <p className="text-xs text-text-muted">см</p>
                                                </div>
                                            ) : null)}
                                        </div>
                                    </div>
                                )}

                                {/* Стартовые фото */}
                                {(questionnaire.photo_front || questionnaire.photo_side || questionnaire.photo_back) && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Стартовые фото</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { label: 'Спереди', url: questionnaire.photo_front },
                                                { label: 'Сбоку', url: questionnaire.photo_side },
                                                { label: 'Сзади', url: questionnaire.photo_back },
                                            ].map(({ label, url }) => url ? (
                                                <div key={label} className="text-center">
                                                    <p className="text-xs text-text-muted mb-2">{label}</p>
                                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                                        <img src={url} alt={label}
                                                            className="w-full h-64 object-contain rounded-xl bg-bg-elevated hover:opacity-90 transition-opacity cursor-pointer" />
                                                    </a>
                                                </div>
                                            ) : null)}
                                        </div>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                <p className="text-text-secondary">Анкета не заполнена</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Питание */}
                {activeTab === 'nutrition' && (
                    <div className="glass-card p-4 sm:p-8">
                        {nutritionQ ? (
                            <div className="space-y-6">
                                {/* Шапка с кнопкой копирования */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                                            <Apple className="w-5 h-5 text-accent flex-shrink-0" />
                                            Анкета питания
                                        </h2>
                                        <p className="text-xs text-text-muted mt-1">
                                            Заполнена {new Date(nutritionQ.created_at).toLocaleDateString('ru-RU')}
                                            {nutritionQ.updated_at !== nutritionQ.created_at && (
                                                <> · обновлена {new Date(nutritionQ.updated_at).toLocaleDateString('ru-RU')}</>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const text = formatNutritionForAdmin(nutritionQ, {
                                                full_name: clientProfile?.full_name,
                                                email: clientProfile?.email,
                                            })
                                            navigator.clipboard.writeText(text)
                                                .then(() => alert('Анкета питания скопирована в буфер обмена'))
                                                .catch(() => alert('Не удалось скопировать'))
                                        }}
                                        className="glass-button-secondary flex items-center gap-2 text-sm self-start sm:self-auto"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Скопировать анкету
                                    </button>
                                </div>

                                {/* Быстрые данные */}
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    {[
                                        { label: 'Вес', value: nutritionQ.current_weight_kg, unit: 'кг', color: 'text-accent' },
                                        { label: 'Рост', value: nutritionQ.height_cm, unit: 'см', color: 'text-blue-400' },
                                        { label: 'Возраст', value: nutritionQ.age, unit: 'лет', color: 'text-yellow-400' },
                                        { label: 'Пол', value: nutritionQ.gender === 'male' ? 'М' : nutritionQ.gender === 'female' ? 'Ж' : null, unit: '', color: 'text-purple-400' },
                                        { label: 'Цель', value: nutritionQ.nutrition_goal ? NUTRITION_LABELS.GOAL_MAP[nutritionQ.nutrition_goal] : null, unit: '', color: 'text-emerald-400' },
                                        { label: 'Тип питания', value: nutritionQ.diet_type ? NUTRITION_LABELS.DIET_TYPE_MAP[nutritionQ.diet_type] : null, unit: '', color: 'text-orange-400' },
                                    ].filter(c => c.value).map(c => (
                                        <div key={c.label} className="glass-card p-3 text-center">
                                            <p className="text-xs text-text-muted mb-1">{c.label}</p>
                                            <p className={`text-sm font-display font-bold ${c.color} leading-tight`}>{c.value}</p>
                                            {c.unit && <p className="text-xs text-text-muted">{c.unit}</p>}
                                        </div>
                                    ))}
                                </div>

                                {/* Все блоки ответов */}
                                {[
                                    {
                                        title: 'Блок 1. Основные данные и цель',
                                        fields: [
                                            ['Вес', nutritionQ.answers?.current_weight_kg ? `${nutritionQ.answers.current_weight_kg} кг` : null],
                                            ['Рост', nutritionQ.answers?.height_cm ? `${nutritionQ.answers.height_cm} см` : null],
                                            ['Возраст', nutritionQ.answers?.age],
                                            ['Пол', nutritionQ.answers?.gender === 'male' ? 'Мужской' : nutritionQ.answers?.gender === 'female' ? 'Женский' : null],
                                            ['Цель', nutritionQ.answers?.nutrition_goal ? NUTRITION_LABELS.GOAL_MAP[nutritionQ.answers.nutrition_goal] : null],
                                            ['Желаемый вес / % жира', nutritionQ.answers?.target_weight],
                                            ['Срок', nutritionQ.answers?.target_deadline],
                                        ],
                                    },
                                    {
                                        title: 'Блок 2. Активность и образ жизни',
                                        fields: [
                                            ['Деятельность', nutritionQ.answers?.job_activity ? NUTRITION_LABELS.JOB_MAP[nutritionQ.answers.job_activity] : null],
                                            ['Тренировок в неделю', nutritionQ.answers?.workouts_per_week],
                                            ['Длительность тренировки', nutritionQ.answers?.workout_duration_min ? `${nutritionQ.answers.workout_duration_min} мин` : null],
                                            ['Тип тренировок', nutritionQ.answers?.workout_type],
                                            ['Шагов в день', nutritionQ.answers?.steps_per_day],
                                        ],
                                    },
                                    {
                                        title: 'Блок 3. Текущее питание',
                                        fields: [
                                            ['Приёмов пищи в день', nutritionQ.answers?.meals_per_day],
                                            ['Завтракает', nutritionQ.answers?.breakfast_habit === 'yes' ? 'Да' : nutritionQ.answers?.breakfast_habit === 'no' ? 'Нет' : nutritionQ.answers?.breakfast_habit === 'sometimes' ? 'Иногда' : null],
                                            ['Первый приём пищи', nutritionQ.answers?.first_meal_time],
                                            ['Последний приём пищи', nutritionQ.answers?.last_meal_time],
                                            ['Описание питания', nutritionQ.answers?.current_diet_description ? NUTRITION_LABELS.DIET_CURRENT_MAP[nutritionQ.answers.current_diet_description] : null],
                                            ['Раньше считал(а) КБЖУ', nutritionQ.answers?.tracked_kcal_before],
                                            ['Размер порции', nutritionQ.answers?.portion_size ? NUTRITION_LABELS.PORTION_MAP[nutritionQ.answers.portion_size] : null],
                                        ],
                                    },
                                    {
                                        title: 'Блок 4. Ограничения и предпочтения',
                                        fields: [
                                            ['Аллергии', nutritionQ.answers?.allergies],
                                            ['Не ест принципиально', nutritionQ.answers?.excluded_by_principle],
                                            ['Не нравятся продукты', nutritionQ.answers?.disliked_foods],
                                            ['Тип питания', nutritionQ.answers?.diet_type ? NUTRITION_LABELS.DIET_TYPE_MAP[nutritionQ.answers.diet_type] : null],
                                            ['Непереносимость лактозы/глютена', nutritionQ.answers?.lactose_gluten_intolerance],
                                            ['Молочные продукты', nutritionQ.answers?.dairy_attitude ? NUTRITION_LABELS.DAIRY_MAP[nutritionQ.answers.dairy_attitude] : null],
                                        ],
                                    },
                                    {
                                        title: 'Блок 5. Условия и реальность жизни',
                                        fields: [
                                            ['Готовит', nutritionQ.answers?.cooking_mode ? NUTRITION_LABELS.COOKING_MAP[nutritionQ.answers.cooking_mode] : null],
                                            ['Время на готовку', nutritionQ.answers?.cooking_time ? NUTRITION_LABELS.COOK_TIME_MAP[nutritionQ.answers.cooking_time] : null],
                                            ['Берёт еду на работу', nutritionQ.answers?.can_take_to_work === 'yes' ? 'Да' : nutritionQ.answers?.can_take_to_work === 'no' ? 'Нет' : nutritionQ.answers?.can_take_to_work === 'sometimes' ? 'Иногда' : null],
                                            ['Питание в будни', nutritionQ.answers?.weekday_eating],
                                            ['Питание в выходные', nutritionQ.answers?.weekend_eating],
                                        ],
                                    },
                                    {
                                        title: 'Блок 6. Сложности и паттерны',
                                        fields: [
                                            ['Поздние ужины', nutritionQ.answers?.late_evening_eating],
                                            ['Срывы / переедания', nutritionQ.answers?.binges_frequency],
                                            ['Провоцирует срыв', nutritionQ.answers?.binge_triggers?.map(t => NUTRITION_LABELS.TRIGGER_MAP[t] || t).join(', ')],
                                            ['Тяга к сладкому', nutritionQ.answers?.sweet_craving],
                                            ['Тяга к солёному/жирному', nutritionQ.answers?.salty_fatty_craving],
                                            ['Алкоголь', nutritionQ.answers?.alcohol_frequency],
                                        ],
                                    },
                                    {
                                        title: 'Блок 7. Здоровье и медицина',
                                        fields: [
                                            ['Заболевания обмена веществ', nutritionQ.answers?.metabolic_conditions],
                                            ['Проблемы с ЖКТ', nutritionQ.answers?.gi_issues],
                                            ['Препараты', nutritionQ.answers?.medications],
                                            ...(nutritionQ.answers?.gender === 'female' ? [['Цикл / СПКЯ', nutritionQ.answers?.female_cycle] as [string, any]] : []),
                                        ],
                                    },
                                    {
                                        title: 'Блок 8. Спортивное питание',
                                        fields: [
                                            ['Текущие добавки', nutritionQ.answers?.current_supplements],
                                            ['Готов принимать протеин', nutritionQ.answers?.protein_ok === 'yes' ? 'Да' : nutritionQ.answers?.protein_ok === 'no' ? 'Нет' : nutritionQ.answers?.protein_ok === 'unsure' ? 'Не уверен' : null],
                                        ],
                                    },
                                    {
                                        title: 'Блок 9. Ожидания от плана',
                                        fields: [
                                            ['Формат плана', nutritionQ.answers?.plan_format ? NUTRITION_LABELS.PLAN_FORMAT_MAP[nutritionQ.answers.plan_format] : null],
                                            ['Кол-во приёмов пищи', nutritionQ.answers?.comfortable_meals_count ? NUTRITION_LABELS.MEALS_COUNT_MAP[nutritionQ.answers.comfortable_meals_count] : null],
                                            ['Любимые продукты', nutritionQ.answers?.favorite_foods],
                                            ['Прошлый опыт диет', nutritionQ.answers?.past_diets_experience],
                                        ],
                                    },
                                ].map(block => {
                                    const filled = block.fields.filter(([, v]) => v !== null && v !== undefined && v !== '')
                                    if (filled.length === 0) return null
                                    return (
                                        <div key={block.title}>
                                            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">{block.title}</h3>
                                            <div className="grid md:grid-cols-2 gap-3">
                                                {filled.map(([label, value]) => (
                                                    <div key={label as string} className="bg-bg-elevated rounded-xl p-3">
                                                        <p className="text-xs text-text-muted mb-1">{label as string}</p>
                                                        <p className="text-white text-sm">{String(value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Apple className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                <h3 className="text-xl font-display font-bold text-white mb-2">Анкета питания не заполнена</h3>
                                <p className="text-text-secondary">Клиент ещё не заполнил анкету по питанию</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Программы */}
                {activeTab === 'programs' && (
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <h2 className="text-lg font-display font-bold text-white">
                                Программы ({programs.length})
                            </h2>
                            <button onClick={() => setShowUploadModal(true)} className="glass-button flex items-center gap-2 text-sm">
                                <Plus className="w-4 h-4" />
                                Загрузить программу
                            </button>
                        </div>

                        {programs.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <Dumbbell className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                <h3 className="text-xl font-display font-bold text-white mb-2">Программ пока нет</h3>
                                <p className="text-text-secondary mb-6">Загрузите первую программу для клиента</p>
                                <button onClick={() => setShowUploadModal(true)} className="glass-button flex items-center gap-2 mx-auto">
                                    <Upload className="w-4 h-4" />
                                    Загрузить программу
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {programs.map(program => (
                                    <ProgramCard
                                        key={program.id}
                                        program={program}
                                        onDelete={id => setPrograms(prev => prev.filter(p => p.id !== id))}
                                        onUpdate={updated => setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Планы питания */}
                {activeTab === 'nutrition_plans' && (
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <h2 className="text-lg font-display font-bold text-white">
                                Планы питания ({nutritionPlans.length})
                            </h2>
                            <button onClick={() => setShowNutritionModal(true)} className="glass-button flex items-center gap-2 text-sm">
                                <Plus className="w-4 h-4" />
                                Загрузить план питания
                            </button>
                        </div>

                        {nutritionPlans.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <Apple className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                <h3 className="text-xl font-display font-bold text-white mb-2">Планов питания пока нет</h3>
                                <p className="text-text-secondary mb-6">Загрузите первый план питания для клиента</p>
                                <button onClick={() => setShowNutritionModal(true)} className="glass-button flex items-center gap-2 mx-auto">
                                    <Upload className="w-4 h-4" />
                                    Загрузить план питания
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {nutritionPlans.map(plan => (
                                    <NutritionPlanCard
                                        key={plan.id}
                                        plan={plan}
                                        onDelete={id => setNutritionPlans(prev => prev.filter(p => p.id !== id))}
                                        onUpdate={updated => setNutritionPlans(prev => prev.map(p => p.id === updated.id ? updated : p))}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Метрики */}
                {activeTab === 'metrics' && (
                    <ClientMetricsView userId={userId} />
                )}

                {/* Прогресс упражнений */}
                {activeTab === 'exercise_stats' && (
                    <AdminExerciseStats userId={userId} />
                )}            </div>

            {/* Модал загрузки программы */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
                    <div className="glass-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-display font-bold text-white">Загрузить программу</h2>
                            <button onClick={() => setShowUploadModal(false)} className="glass-button-secondary p-2">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Неделя №</label>
                                    <input type="number" value={weekNumber} onChange={e => setWeekNumber(parseInt(e.target.value))} className="glass-input w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дней тренировок</label>
                                    <input type="number" min="2" max="7" value={trainingDays} onChange={e => setTrainingDays(parseInt(e.target.value))} className="glass-input w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дата начала</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="glass-input w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дата конца</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="glass-input w-full" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm text-text-secondary">Программа (Markdown)</label>
                                    <button onClick={() => setProgramMd(EXAMPLE_PROGRAM_MD)} className="text-xs text-accent hover:underline">
                                        Загрузить пример
                                    </button>
                                </div>
                                <textarea
                                    value={programMd}
                                    onChange={e => setProgramMd(e.target.value)}
                                    className="glass-input w-full h-96 resize-none font-mono text-sm"
                                    placeholder="# Неделя 1&#10;&#10;## День 1: Верх тела&#10;..."
                                />
                            </div>

                            {uploadError && (
                                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30">
                                    <p className="text-sm text-danger">{uploadError}</p>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button onClick={() => setShowUploadModal(false)} className="glass-button-secondary flex-1">
                                    Отмена
                                </button>
                                <button onClick={handleUploadProgram} disabled={isUploading} className="glass-button flex-1 flex items-center justify-center gap-2">
                                    {isUploading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />Загрузка...</>
                                    ) : (
                                        <><Check className="w-4 h-4" />Загрузить</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Модал загрузки плана питания */}
            {showNutritionModal && (
                <div className="modal-overlay" onClick={() => setShowNutritionModal(false)}>
                    <div className="glass-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-display font-bold text-white">Загрузить план питания</h2>
                            <button onClick={() => setShowNutritionModal(false)} className="glass-button-secondary p-2">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Название плана</label>
                                    <input type="text" value={nutritionTitle}
                                        onChange={e => setNutritionTitle(e.target.value)}
                                        className="glass-input w-full"
                                        placeholder="План питания" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Номер плана</label>
                                    <input type="number" min="1" value={nutritionPlanNumber}
                                        onChange={e => setNutritionPlanNumber(parseInt(e.target.value))}
                                        className="glass-input w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дата начала</label>
                                    <input type="date" value={nutritionStartDate}
                                        onChange={e => setNutritionStartDate(e.target.value)}
                                        className="glass-input w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дата конца</label>
                                    <input type="date" value={nutritionEndDate}
                                        onChange={e => setNutritionEndDate(e.target.value)}
                                        className="glass-input w-full" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm text-text-secondary">План питания (Markdown)</label>
                                    <button onClick={() => setNutritionMd(EXAMPLE_NUTRITION_MD)} className="text-xs text-accent hover:underline">
                                        Загрузить пример
                                    </button>
                                </div>
                                <textarea
                                    value={nutritionMd}
                                    onChange={e => setNutritionMd(e.target.value)}
                                    className="glass-input w-full h-96 resize-none font-mono text-sm"
                                    placeholder="# План питания №1&#10;&#10;## День 1: Тренировочный день&#10;..."
                                />
                            </div>

                            {nutritionUploadError && (
                                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30">
                                    <p className="text-sm text-danger">{nutritionUploadError}</p>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button onClick={() => setShowNutritionModal(false)} className="glass-button-secondary flex-1">
                                    Отмена
                                </button>
                                <button onClick={handleUploadNutritionPlan} disabled={isUploadingNutrition} className="glass-button flex-1 flex items-center justify-center gap-2">
                                    {isUploadingNutrition ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />Загрузка...</>
                                    ) : (
                                        <><Check className="w-4 h-4" />Загрузить план</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Модальное окно продления подписки ── */}
            {showRenewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-accent" />
                                Продлить подписку
                            </h2>
                            <button onClick={() => setShowRenewModal(false)} className="text-text-muted hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-text-secondary">
                            Ручное продление без оплаты через сервис. Подписка продлится от текущей даты окончания.
                        </p>

                        <div>
                            <label className="block text-sm text-text-secondary mb-2">Тариф</label>
                            <select
                                value={renewPlanType}
                                onChange={e => {
                                    const pt = e.target.value as '1_month' | '3_months' | '6_months'
                                    setRenewPlanType(pt)
                                    setRenewPlanMonths(pt === '1_month' ? 1 : pt === '3_months' ? 3 : 6)
                                }}
                                className="glass-input w-full"
                            >
                                <option value="1_month">1 месяц</option>
                                <option value="3_months">3 месяца</option>
                                <option value="6_months">6 месяцев</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={renewIncludesNutrition}
                                    onChange={e => setRenewIncludesNutrition(e.target.checked)}
                                    className="w-4 h-4 accent-accent"
                                />
                                <span className="text-sm text-white">Включить план питания</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-2">Сумма оплаты (₽)</label>
                            <input
                                type="number"
                                value={renewAmount}
                                onChange={e => setRenewAmount(e.target.value)}
                                placeholder="0 — если не нужно фиксировать"
                                className="glass-input w-full"
                                min="0"
                            />
                        </div>

                        {renewError && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                                {renewError}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setShowRenewModal(false)} className="glass-button-secondary flex-1">
                                Отмена
                            </button>
                            <button
                                onClick={async () => {
                                    setRenewError('')
                                    setIsRenewing(true)
                                    try {
                                        const { renewClientSubscription } = await import('@/lib/services/admin')
                                        const result = await renewClientSubscription({
                                            userId,
                                            planMonths: renewPlanMonths,
                                            planType: renewPlanType,
                                            includesNutrition: renewIncludesNutrition,
                                            amount: Number(renewAmount) || 0,
                                        })
                                        if (result.success) {
                                            setClientPayment((prev: any) => prev ? {
                                                ...prev,
                                                includes_nutrition: renewIncludesNutrition || prev.includes_nutrition,
                                                plan_type: renewPlanType,
                                                plan_months: renewPlanMonths,
                                            } : prev)
                                            setShowRenewModal(false)
                                            alert(`Подписка продлена до ${result.newEndDate ? new Date(result.newEndDate).toLocaleDateString('ru-RU') : '—'}`)
                                        } else {
                                            setRenewError(result.error ?? 'Ошибка продления')
                                        }
                                    } catch (e: any) {
                                        setRenewError(e.message || 'Ошибка')
                                    } finally {
                                        setIsRenewing(false)
                                    }
                                }}
                                disabled={isRenewing}
                                className="glass-button flex-1 flex items-center justify-center gap-2"
                            >
                                {isRenewing
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />Продление...</>
                                    : <><Check className="w-4 h-4" />Продлить</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
