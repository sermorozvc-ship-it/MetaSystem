'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ArrowLeft, Dumbbell, TrendingUp, FileText, Plus,
    Loader2, Upload, X, Check, ChevronDown, ChevronUp,
    Download, CheckCircle2, Clock, Pencil, Archive, ArchiveRestore,
    Apple, Copy
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
import { parseMdToJson, EXAMPLE_PROGRAM_MD } from '@/lib/utils/md-parser'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

type Tab = 'questionnaire' | 'nutrition' | 'programs' | 'metrics'

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
                    clientData.sets.forEach((s: any, i: number) => {
                        const w = s.weight ? `${s.weight} кг` : '—'
                        const r = s.reps ? `${s.reps} повт.` : '—'
                        const rir = s.rir !== undefined && s.rir !== '' ? `RIR ${s.rir}` : ''
                        lines.push(`- **Подход ${i + 1}:** ${w} × ${r}${rir ? ` • ${rir}` : ''}`)
                    })
                } else {
                    // Старый формат
                    const w = clientData.actualWeight ? `${clientData.actualWeight} кг` : '—'
                    const r = clientData.actualReps ? `${clientData.actualReps} повт.` : '—'
                    lines.push(`- **Факт:** ${w} × ${r}${clientData.rpe ? ` • RPE ${clientData.rpe}` : ''}`)
                }
                if (clientData.comment) lines.push(`- **Комментарий:** ${clientData.comment}`)
            } else {
                lines.push(`- **Факт:** не заполнено`)
            }
            lines.push('')
        }

        if (day.cardio) { lines.push(`**Кардио:** ${day.cardio}`); lines.push('') }

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
                                            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-4 text-xs text-text-secondary">
                                                <span>⚡ Энергия: <strong className="text-white">{entry.energy_level ?? '—'}/10</strong></span>
                                                <span>😊 Настроение: <strong className="text-white">{entry.mood ?? '—'}/5</strong></span>
                                                <span>🏋️ RPE: <strong className="text-white">{entry.sleep_quality ?? '—'}/10</strong></span>
                                                {entry.notes && <span className="w-full text-text-muted">💬 {entry.notes}</span>}
                                            </div>
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
    const [isArchiving, setIsArchiving] = useState(false)

    // Upload modal state
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [programMd, setProgramMd] = useState('')
    const [weekNumber, setWeekNumber] = useState(1)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [trainingDays, setTrainingDays] = useState(3)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')

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

                {/* Tabs */}
                <div className="-mx-4 px-4 flex gap-2 mb-6 overflow-x-auto pb-1" style={{scrollbarWidth: 'none'}}>
                    {(['questionnaire', 'nutrition', 'programs', 'metrics'] as Tab[]).map(tab => {
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
                                {tab === 'metrics' && <><TrendingUp className="w-4 h-4 inline mr-1" />Метрики</>}
                            </button>
                        )
                    })}
                </div>

                {/* Анкета */}
                {activeTab === 'questionnaire' && (
                    <div className="glass-card p-8">
                        {questionnaire ? (
                            <div className="space-y-8">

                                {/* Кнопка копирования */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => {
                                            const q = questionnaire
                                            const expMap: Record<string, string> = { beginner: 'Новичок (менее 6 мес)', intermediate: 'Средний (6 мес – 2 года)', advanced: 'Продвинутый (более 2 лет)' }
                                            const actMap: Record<string, string> = { sedentary: 'Сидячий', light: 'Лёгкая активность', moderate: 'Умеренная', high: 'Высокая' }
                                            const lines = [
                                                `👤 АНКЕТА КЛИЕНТА: ${clientProfile?.full_name || '—'} (${clientProfile?.email || '—'})`,
                                                `Дата заполнения: ${new Date(q.created_at).toLocaleDateString('ru-RU')}`,
                                                '',
                                                '📋 ОСНОВНАЯ ИНФОРМАЦИЯ',
                                                `Возраст: ${q.age || '—'}`,
                                                `Пол: ${q.gender === 'male' ? 'Мужской' : q.gender === 'female' ? 'Женский' : '—'}`,
                                                `Рост: ${q.height_cm ? q.height_cm + ' см' : '—'}`,
                                                `Вес: ${q.weight_kg ? q.weight_kg + ' кг' : '—'}`,
                                                '',
                                                '🎯 ЦЕЛИ И ОПЫТ',
                                                `Цель: ${q.goal || '—'}`,
                                                `Опыт тренировок: ${expMap[q.training_experience || ''] || q.training_experience || '—'}`,
                                                `Дней тренировок: ${q.preferred_training_days ? q.preferred_training_days + ' дней/нед' : '—'}`,
                                                `Место тренировок: ${q.available_equipment?.join(', ') || '—'}`,
                                                '',
                                                '❤️ ЗДОРОВЬЕ И ОБРАЗ ЖИЗНИ',
                                                `Травмы/ограничения: ${q.injuries || 'нет'}`,
                                                `Хронические заболевания: ${q.health_conditions || 'нет'}`,
                                                `Сон: ${q.sleep_hours_avg ? q.sleep_hours_avg + ' ч' : '—'}`,
                                                `Уровень стресса: ${q.stress_level ? q.stress_level + '/10' : '—'}`,
                                                `Уровень активности: ${actMap[q.activity_level || ''] || q.activity_level || '—'}`,
                                                ...(q.waist_cm || q.hips_cm || q.chest_cm || q.arm_cm || q.thigh_cm ? [
                                                    '',
                                                    '📏 НАЧАЛЬНЫЕ ЗАМЕРЫ',
                                                    ...(q.waist_cm ? [`Талия: ${q.waist_cm} см`] : []),
                                                    ...(q.hips_cm ? [`Бёдра: ${q.hips_cm} см`] : []),
                                                    ...(q.chest_cm ? [`Грудь: ${q.chest_cm} см`] : []),
                                                    ...(q.arm_cm ? [`Рука: ${q.arm_cm} см`] : []),
                                                    ...(q.thigh_cm ? [`Бедро: ${q.thigh_cm} см`] : []),
                                                ] : []),
                                                ...(q.additional_notes ? ['', '💬 ДОПОЛНИТЕЛЬНО', q.additional_notes] : []),
                                            ]
                                            navigator.clipboard.writeText(lines.join('\n'))
                                                .then(() => alert('Данные скопированы в буфер обмена'))
                                                .catch(() => alert('Не удалось скопировать'))
                                        }}
                                        className="glass-button-secondary flex items-center gap-2 text-sm"
                                    >
                                        📋 Скопировать анкету
                                    </button>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Основная информация</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><label className="text-xs text-text-muted">Возраст</label><p className="text-white font-semibold">{questionnaire.age || '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Пол</label><p className="text-white font-semibold">{questionnaire.gender === 'male' ? 'Мужской' : questionnaire.gender === 'female' ? 'Женский' : '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Рост</label><p className="text-white font-semibold">{questionnaire.height_cm ? `${questionnaire.height_cm} см` : '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Вес</label><p className="text-white font-semibold">{questionnaire.weight_kg ? `${questionnaire.weight_kg} кг` : '—'}</p></div>
                                    </div>
                                </div>

                                {/* Цели и опыт */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Цели и опыт</h3>
                                    <div className="space-y-3">
                                        <div><label className="text-xs text-text-muted">Цель</label><p className="text-white">{questionnaire.goal || '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Опыт тренировок</label>
                                            <p className="text-white">{
                                                questionnaire.training_experience === 'beginner' ? 'Новичок (менее 6 мес)' :
                                                questionnaire.training_experience === 'intermediate' ? 'Средний (6 мес – 2 года)' :
                                                questionnaire.training_experience === 'advanced' ? 'Продвинутый (более 2 лет)' :
                                                questionnaire.training_experience || '—'
                                            }</p>
                                        </div>
                                        <div><label className="text-xs text-text-muted">Дней тренировок в неделю</label><p className="text-white font-semibold">{questionnaire.preferred_training_days ? `${questionnaire.preferred_training_days} дней` : '—'}</p></div>
                                        {questionnaire.available_equipment && questionnaire.available_equipment.length > 0 && (
                                            <div><label className="text-xs text-text-muted">Оборудование</label>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {questionnaire.available_equipment.map(eq => (
                                                        <span key={eq} className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs">{eq}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Здоровье и образ жизни */}
                                <div>
                                    <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Здоровье и образ жизни</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div><label className="text-xs text-text-muted">Травмы/ограничения</label><p className="text-white">{questionnaire.injuries || '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Хронические заболевания</label><p className="text-white">{questionnaire.health_conditions || '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Сон (часов)</label><p className="text-white font-semibold">{questionnaire.sleep_hours_avg ? `${questionnaire.sleep_hours_avg} ч` : '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Уровень стресса</label><p className="text-white font-semibold">{questionnaire.stress_level ? `${questionnaire.stress_level}/10` : '—'}</p></div>
                                        <div><label className="text-xs text-text-muted">Уровень активности</label>
                                            <p className="text-white">{
                                                questionnaire.activity_level === 'sedentary' ? 'Сидячий' :
                                                questionnaire.activity_level === 'light' ? 'Лёгкая активность' :
                                                questionnaire.activity_level === 'moderate' ? 'Умеренная' :
                                                questionnaire.activity_level === 'high' ? 'Высокая' :
                                                questionnaire.activity_level || '—'
                                            }</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Замеры */}
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

                                {/* Доп. информация */}
                                {questionnaire.additional_notes && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Дополнительно</h3>
                                        <p className="text-white bg-bg-elevated p-4 rounded-xl">{questionnaire.additional_notes}</p>
                                    </div>
                                )}

                                {/* Фото */}
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
                    <div className="glass-card p-8">
                        {nutritionQ ? (
                            <div className="space-y-6">
                                {/* Шапка с кнопкой копирования */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                                            <Apple className="w-5 h-5 text-accent" />
                                            Анкета питания
                                        </h2>
                                        <p className="text-sm text-text-muted mt-1">
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
                                        className="glass-button-secondary flex items-center gap-2 text-sm"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Скопировать анкету
                                    </button>
                                </div>

                                {/* Быстрые данные */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                    {[
                                        { label: 'Вес', value: nutritionQ.current_weight_kg, unit: 'кг', color: 'text-accent' },
                                        { label: 'Рост', value: nutritionQ.height_cm, unit: 'см', color: 'text-blue-400' },
                                        { label: 'Возраст', value: nutritionQ.age, unit: 'лет', color: 'text-yellow-400' },
                                        { label: 'Пол', value: nutritionQ.gender === 'male' ? 'М' : nutritionQ.gender === 'female' ? 'Ж' : null, unit: '', color: 'text-purple-400' },
                                        { label: 'Цель', value: nutritionQ.nutrition_goal ? NUTRITION_LABELS.GOAL_MAP[nutritionQ.nutrition_goal]?.split(' ').slice(0, 2).join(' ') : null, unit: '', color: 'text-emerald-400' },
                                        { label: 'Тип питания', value: nutritionQ.diet_type ? NUTRITION_LABELS.DIET_TYPE_MAP[nutritionQ.diet_type]?.split(' ').slice(0, 2).join(' ') : null, unit: '', color: 'text-orange-400' },
                                    ].filter(c => c.value).map(c => (
                                        <div key={c.label} className="glass-card p-4 text-center">
                                            <p className="text-xs text-text-muted mb-1">{c.label}</p>
                                            <p className={`text-lg font-display font-bold ${c.color} leading-tight`}>{c.value}</p>
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

                {/* Метрики */}
                {activeTab === 'metrics' && (
                    <ClientMetricsView userId={userId} />
                )}
            </div>

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
        </div>
    )
}
