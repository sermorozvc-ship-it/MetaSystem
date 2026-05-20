'use client'

import { useMemo } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area,
    ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { TrainingProgram, TrainingEntry } from '@/lib/services/training'

// ─── Типы ────────────────────────────────────────────────────────────────────

interface WeekTonnage {
    weekNumber: number
    label: string          // "Нед. 1"
    tonnage: number        // рабочий тоннаж (без разминочных)
    totalSets: number
    totalReps: number
    trainingsCompleted: number
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function buildWeeklyTonnage(
    programs: TrainingProgram[],
    entries: TrainingEntry[]
): WeekTonnage[] {
    const entryMap = new Map(entries.map(e => [`${e.program_id}:${e.day_number}`, e]))
    const sorted = [...programs].sort((a, b) => a.week_number - b.week_number)

    return sorted.map(program => {
        let tonnage = 0
        let totalSets = 0
        let totalReps = 0
        let trainingsCompleted = 0

        const days = program.program_data?.days || []
        for (const day of days) {
            const entry = entryMap.get(`${program.id}:${day.dayNumber}`)
            if (!entry || !entry.completed_at) continue
            trainingsCompleted++

            for (const exercise of day.exercises) {
                const cd = entry.entry_data?.[exercise.id]
                if (!cd?.sets || !Array.isArray(cd.sets)) continue

                for (const s of cd.sets) {
                    // Пропускаем разминочные подходы
                    if (s.label === 'warmup') continue
                    const w = parseFloat(s.weight) || 0
                    const r = parseInt(s.reps) || 0
                    if (w > 0 && r > 0) {
                        tonnage += w * r
                        totalSets++
                        totalReps += r
                    }
                }
            }
        }

        return {
            weekNumber: program.week_number,
            label: `Нед. ${program.week_number}`,
            tonnage,
            totalSets,
            totalReps,
            trainingsCompleted,
        }
    }).filter(w => w.trainingsCompleted > 0 || w.tonnage > 0)
}

// ─── Кастомный тултип ────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as WeekTonnage
    return (
        <div className="glass-card px-3 py-2.5 text-xs border border-border shadow-lg min-w-[160px]">
            <p className="text-text-muted mb-2 font-semibold">{d.label}</p>
            <div className="space-y-1">
                <div className="flex justify-between gap-4">
                    <span className="text-text-secondary">Тоннаж</span>
                    <span className="text-accent font-bold">{d.tonnage.toLocaleString('ru-RU')} кг</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-text-secondary">Подходов</span>
                    <span className="text-white">{d.totalSets}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-text-secondary">Повторений</span>
                    <span className="text-white">{d.totalReps}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-text-secondary">Тренировок</span>
                    <span className="text-white">{d.trainingsCompleted}</span>
                </div>
            </div>
        </div>
    )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

interface WeeklyTonnageChartProps {
    programs: TrainingProgram[]
    entries: TrainingEntry[]
}

export default function WeeklyTonnageChart({ programs, entries }: WeeklyTonnageChartProps) {
    const data = useMemo(() => buildWeeklyTonnage(programs, entries), [programs, entries])

    if (data.length === 0) {
        return (
            <div className="glass-card p-8 text-center">
                <TrendingUp className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-muted text-sm">Нет данных для графика тоннажа</p>
                <p className="text-text-muted text-xs mt-1">Завершите хотя бы одну тренировку</p>
            </div>
        )
    }

    // Тренд: сравниваем первую и последнюю неделю
    const first = data[0].tonnage
    const last = data[data.length - 1].tonnage
    const trendPct = first > 0 ? ((last - first) / first) * 100 : 0
    const trend: 'up' | 'down' | 'flat' = trendPct > 2 ? 'up' : trendPct < -2 ? 'down' : 'flat'
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
    const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-text-muted'

    const maxTonnage = Math.max(...data.map(d => d.tonnage))
    const avgTonnage = data.reduce((s, d) => s + d.tonnage, 0) / data.length

    return (
        <div className="glass-card overflow-hidden">
            {/* Заголовок */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <span className="text-accent">🏋️</span>
                            Тоннаж по неделям
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">Рабочие подходы (без разминочных)</p>
                    </div>
                    <div className={`flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon className="w-4 h-4" />
                        <span className="text-sm font-bold">
                            {trendPct > 0 ? '+' : ''}{trendPct.toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Мини-статистика */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                        { label: 'Макс. неделя', value: `${maxTonnage.toLocaleString('ru-RU')} кг`, color: 'text-accent' },
                        { label: 'Среднее', value: `${Math.round(avgTonnage).toLocaleString('ru-RU')} кг`, color: 'text-white' },
                        { label: 'Последняя', value: `${last.toLocaleString('ru-RU')} кг`, color: 'text-white' },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl bg-bg-elevated p-2.5 text-center">
                            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* График */}
            <div className="p-4">
                {data.length === 1 ? (
                    /* Одна неделя — просто показываем число */
                    <div className="py-8 text-center">
                        <p className="text-4xl font-display font-bold text-accent">
                            {data[0].tonnage.toLocaleString('ru-RU')}
                        </p>
                        <p className="text-sm text-text-muted mt-1">кг за неделю {data[0].weekNumber}</p>
                        <p className="text-xs text-text-muted mt-3">Нужно минимум 2 недели для графика</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={data} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                            <defs>
                                <linearGradient id="tonnageGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#c8f542" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#c8f542" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="label"
                                stroke="#444"
                                tick={{ fontSize: 10, fill: '#666' }}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#444"
                                tick={{ fontSize: 10, fill: '#666' }}
                                tickLine={false}
                                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}т` : String(v)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            {/* Линия среднего */}
                            <ReferenceLine
                                y={avgTonnage}
                                stroke="#c8f542"
                                strokeDasharray="4 4"
                                strokeOpacity={0.3}
                                label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#666' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="tonnage"
                                stroke="#c8f542"
                                strokeWidth={2.5}
                                fill="url(#tonnageGrad)"
                                dot={{ fill: '#c8f542', r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: '#c8f542', strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* История по неделям */}
            {data.length > 1 && (
                <div className="px-4 pb-4">
                    <div className="space-y-1.5">
                        {[...data].reverse().slice(0, 6).map((w, i) => {
                            const prev = data[data.length - 1 - i - 1]
                            const delta = prev ? w.tonnage - prev.tonnage : null
                            const isLast = i === 0
                            return (
                                <div key={w.weekNumber} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${isLast ? 'bg-accent/10 border border-accent/20' : ''}`}>
                                    <span className={`font-medium ${isLast ? 'text-accent' : 'text-text-secondary'}`}>
                                        {w.label}
                                        {isLast && <span className="ml-1 text-[10px] text-accent/70">← текущая</span>}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-text-muted">{w.trainingsCompleted} трен.</span>
                                        {delta !== null && (
                                            <span className={`text-[10px] ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-text-muted'}`}>
                                                {delta > 0 ? '+' : ''}{delta.toLocaleString('ru-RU')} кг
                                            </span>
                                        )}
                                        <span className={`font-bold ${isLast ? 'text-accent' : 'text-white'}`}>
                                            {w.tonnage.toLocaleString('ru-RU')} кг
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
