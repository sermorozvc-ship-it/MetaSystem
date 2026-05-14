'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { TrainingProgram, TrainingEntry } from '@/lib/services/training'
import {
  getMuscleGroup, getMuscleGroupInfo, setManualOverride,
  MUSCLE_GROUPS, type MuscleGroup,
} from '@/lib/utils/muscleGroups'

// ─── Типы ────────────────────────────────────────────────────────────────────

interface ExercisePoint {
  date: string        // ISO date
  dateLabel: string   // отображаемая дата
  weight: number      // рабочий вес последнего подхода
  reps: number        // повторения последнего подхода
  weekNumber: number
}

interface ExerciseStat {
  exerciseId: string
  exerciseName: string
  muscleGroup: MuscleGroup
  points: ExercisePoint[]
  maxWeight: number
  lastWeight: number
  firstWeight: number
  trend: 'up' | 'down' | 'flat'
  trendPct: number
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function buildExerciseStats(
  programs: TrainingProgram[],
  entries: TrainingEntry[]
): ExerciseStat[] {
  // Карта: programId → program
  const programMap = new Map(programs.map(p => [p.id, p]))

  // Карта: programId+dayNumber → entry
  const entryMap = new Map(entries.map(e => [`${e.program_id}:${e.day_number}`, e]))

  // Карта: exerciseId → { name, points[] }
  const exerciseMap = new Map<string, { name: string; points: ExercisePoint[] }>()

  // Сортируем программы по неделе
  const sortedPrograms = [...programs].sort((a, b) => a.week_number - b.week_number)

  for (const program of sortedPrograms) {
    const days = program.program_data?.days || []
    for (const day of days) {
      const entry = entryMap.get(`${program.id}:${day.dayNumber}`)
      if (!entry) continue

      // Дата тренировки: берём completed_at или start_date недели + смещение дня
      let dateStr = entry.completed_at
        ? entry.completed_at.split('T')[0]
        : program.start_date

      for (const exercise of day.exercises) {
        const cd = entry.entry_data?.[exercise.id]
        if (!cd) continue

        let lastWeight = 0
        let lastReps = 0

        if (cd.sets && Array.isArray(cd.sets)) {
          // Новый формат — берём последний заполненный подход
          const filled = cd.sets.filter((s: any) => s.weight && parseFloat(s.weight) > 0)
          if (filled.length === 0) continue
          const last = filled[filled.length - 1]
          lastWeight = parseFloat(last.weight) || 0
          lastReps = parseInt(last.reps) || 0
        } else if (cd.actualWeight) {
          // Старый формат
          lastWeight = parseFloat(cd.actualWeight) || 0
          lastReps = parseInt(cd.actualReps) || 0
        }

        if (lastWeight === 0) continue

        if (!exerciseMap.has(exercise.id)) {
          exerciseMap.set(exercise.id, { name: exercise.name, points: [] })
        }

        exerciseMap.get(exercise.id)!.points.push({
          date: dateStr,
          dateLabel: format(new Date(dateStr), 'd MMM', { locale: ru }),
          weight: lastWeight,
          reps: lastReps,
          weekNumber: program.week_number,
        })
      }
    }
  }

  // Строим статистику
  const stats: ExerciseStat[] = []

  for (const [exerciseId, { name, points }] of exerciseMap.entries()) {
    if (points.length === 0) continue

    // Сортируем по дате
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

    const maxWeight = Math.max(...sorted.map(p => p.weight))
    const firstWeight = sorted[0].weight
    const lastWeight = sorted[sorted.length - 1].weight
    const trendPct = firstWeight > 0 ? ((lastWeight - firstWeight) / firstWeight) * 100 : 0
    const trend: 'up' | 'down' | 'flat' =
      trendPct > 2 ? 'up' : trendPct < -2 ? 'down' : 'flat'

    stats.push({
      exerciseId,
      exerciseName: name,
      muscleGroup: getMuscleGroup(exerciseId, name),
      points: sorted,
      maxWeight,
      lastWeight,
      firstWeight,
      trend,
      trendPct,
    })
  }

  // Сортируем: сначала с наибольшим количеством точек
  return stats.sort((a, b) => b.points.length - a.points.length)
}

// ─── Кастомный тултип ────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass-card px-3 py-2 text-xs border border-border shadow-lg">
      <p className="text-text-muted mb-1">{d.dateLabel} · Нед. {d.weekNumber}</p>
      <p className="text-accent font-bold text-sm">{d.weight} кг</p>
      {d.reps > 0 && <p className="text-text-secondary">{d.reps} повт.</p>}
    </div>
  )
}

// ─── Карточка одного упражнения ───────────────────────────────────────────────

function ExerciseCard({ stat, onGroupChange }: {
  stat: ExerciseStat
  onGroupChange: (exerciseId: string, group: MuscleGroup) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingGroup, setEditingGroup] = useState(false)

  const groupInfo = getMuscleGroupInfo(stat.muscleGroup)

  const minW = Math.max(0, Math.min(...stat.points.map(p => p.weight)) - 5)
  const maxW = Math.max(...stat.points.map(p => p.weight)) + 5

  const TrendIcon = stat.trend === 'up' ? TrendingUp : stat.trend === 'down' ? TrendingDown : Minus
  const trendColor = stat.trend === 'up' ? 'text-green-400' : stat.trend === 'down' ? 'text-red-400' : 'text-text-muted'

  return (
    <div className="glass-card overflow-hidden">
      {/* Заголовок */}
      <div
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Группа мышц */}
            <button
              onClick={e => { e.stopPropagation(); setEditingGroup(v => !v) }}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors hover:bg-white/10"
              style={{ backgroundColor: groupInfo.color + '22', border: `1px solid ${groupInfo.color}44` }}
              title={`Группа: ${groupInfo.label} (нажми чтобы изменить)`}
            >
              {groupInfo.emoji}
            </button>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{stat.exerciseName}</h3>
              <p className="text-xs text-text-muted">{groupInfo.label} · {stat.points.length} тренировок</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Тренд */}
            <div className="text-right">
              <div className={`flex items-center gap-1 justify-end ${trendColor}`}>
                <TrendIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">
                  {stat.trendPct > 0 ? '+' : ''}{stat.trendPct.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-text-muted">{stat.firstWeight} → {stat.lastWeight} кг</p>
            </div>

            {/* Макс */}
            <div className="text-right hidden sm:block">
              <p className="text-accent font-bold text-sm">{stat.maxWeight} кг</p>
              <p className="text-xs text-text-muted">макс</p>
            </div>

            <div className="ml-1">
              {expanded
                ? <ChevronUp className="w-4 h-4 text-text-muted" />
                : <ChevronDown className="w-4 h-4 text-text-muted" />
              }
            </div>
          </div>
        </div>

        {/* Выбор группы мышц */}
        {editingGroup && (
          <div
            className="mt-3 p-3 rounded-xl bg-bg-elevated border border-border"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs text-text-muted mb-2 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Выбери группу мышц для этого упражнения:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    setManualOverride(stat.exerciseId, g.id)
                    onGroupChange(stat.exerciseId, g.id)
                    setEditingGroup(false)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    stat.muscleGroup === g.id
                      ? 'text-bg-main'
                      : 'text-text-secondary hover:text-white'
                  }`}
                  style={{
                    backgroundColor: stat.muscleGroup === g.id ? g.color : g.color + '22',
                    border: `1px solid ${g.color}44`,
                  }}
                >
                  {g.emoji} {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* График */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {stat.points.length < 2 ? (
            <div className="py-6 text-center">
              <p className="text-text-muted text-sm">Нужно минимум 2 тренировки для графика</p>
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-accent font-bold text-xl">{stat.points[0].weight} кг</p>
                  <p className="text-xs text-text-muted">{stat.points[0].dateLabel}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Мини-статистика */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Старт', value: `${stat.firstWeight} кг`, color: 'text-text-secondary' },
                  { label: 'Сейчас', value: `${stat.lastWeight} кг`, color: 'text-white' },
                  { label: 'Рекорд', value: `${stat.maxWeight} кг`, color: 'text-accent' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-bg-elevated p-2.5 text-center">
                    <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-text-muted">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* График */}
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={stat.points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${stat.exerciseId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c8f542" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c8f542" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="#444"
                    tick={{ fontSize: 10, fill: '#666' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#444"
                    tick={{ fontSize: 10, fill: '#666' }}
                    tickLine={false}
                    domain={[minW, maxW]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Линия рекорда */}
                  <ReferenceLine
                    y={stat.maxWeight}
                    stroke="#c8f542"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#c8f542"
                    strokeWidth={2.5}
                    fill={`url(#grad-${stat.exerciseId})`}
                    dot={{ fill: '#c8f542', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#c8f542', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* История подходов */}
              <div className="mt-3 space-y-1">
                {[...stat.points].reverse().slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="text-text-muted">Нед. {p.weekNumber} · {p.dateLabel}</span>
                    <div className="flex items-center gap-3">
                      {p.reps > 0 && <span className="text-text-secondary">{p.reps} повт.</span>}
                      <span className="text-white font-semibold">{p.weight} кг</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

interface ExerciseProgressViewProps {
  programs: TrainingProgram[]
  entries: TrainingEntry[]
}

export default function ExerciseProgressView({ programs, entries }: ExerciseProgressViewProps) {
  const [activeGroup, setActiveGroup] = useState<MuscleGroup | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // Триггер для перерендера при смене группы мышц
  const [overrideVersion, setOverrideVersion] = useState(0)

  const stats = useMemo(
    () => buildExerciseStats(programs, entries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programs, entries, overrideVersion]
  )

  const handleGroupChange = (_exerciseId: string, _group: MuscleGroup) => {
    setOverrideVersion(v => v + 1)
  }

  const filtered = useMemo(() => {
    let result = stats
    if (activeGroup !== 'all') {
      result = result.filter(s => s.muscleGroup === activeGroup)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s => s.exerciseName.toLowerCase().includes(q))
    }
    return result
  }, [stats, activeGroup, searchQuery, overrideVersion])

  // Считаем количество упражнений по группам
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: stats.length }
    for (const s of stats) {
      counts[s.muscleGroup] = (counts[s.muscleGroup] || 0) + 1
    }
    return counts
  }, [stats])

  if (stats.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <TrendingUp className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h3 className="text-lg font-display font-bold text-white mb-2">Нет данных</h3>
        <p className="text-text-secondary text-sm">
          Заполни хотя бы одну тренировку, чтобы увидеть статистику прогресса
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Поиск */}
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="glass-input text-sm"
        placeholder="Поиск упражнения..."
      />

      {/* Фильтр по группам мышц */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveGroup('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeGroup === 'all'
              ? 'bg-accent text-bg-main'
              : 'bg-bg-elevated text-text-muted hover:text-white'
          }`}
        >
          Все ({groupCounts.all})
        </button>
        {MUSCLE_GROUPS.filter(g => groupCounts[g.id]).map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeGroup === g.id ? 'text-bg-main' : 'text-text-muted hover:text-white'
            }`}
            style={
              activeGroup === g.id
                ? { backgroundColor: g.color }
                : { backgroundColor: g.color + '22', border: `1px solid ${g.color}33` }
            }
          >
            {g.emoji} {g.label} ({groupCounts[g.id]})
          </button>
        ))}
      </div>

      {/* Список упражнений */}
      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-text-muted text-sm">Нет упражнений в этой категории</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(stat => (
            <ExerciseCard
              key={stat.exerciseId}
              stat={stat}
              onGroupChange={handleGroupChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
