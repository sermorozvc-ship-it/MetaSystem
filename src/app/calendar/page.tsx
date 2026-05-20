'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Flame, Trophy, Calendar as CalendarIcon, ChevronRight, Activity, Dumbbell, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import StreakCard from '@/components/StreakCard'
import CalendarGrid from '@/components/CalendarGrid'
import {
  getMyStreakStats,
  getMyCalendarMonth,
  type StreakStats,
  type CalendarMonth,
  type CalendarDay,
} from '@/lib/services/streaks'

function todayParts(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function CalendarPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState<StreakStats | null>(null)
  const [calendar, setCalendar] = useState<CalendarMonth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ date: string; data: CalendarDay | null } | null>(null)

  const [{ year, month }, setYM] = useState(todayParts())

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    setIsLoading(true)
    const load = async () => {
      try {
        setError(null)
        const [s, c] = await Promise.all([
          getMyStreakStats(),
          getMyCalendarMonth(year, month),
        ])
        if (cancelled) return
        setStats(s)
        setCalendar(c)
      } catch (e: any) {
        if (cancelled) return
        console.error('[Calendar] Load error:', e)
        setError(e?.message || 'Не удалось загрузить календарь')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, year, month])

  const last8Weeks = useMemo(() => {
    if (!stats) return []
    return [...stats.history]
      .filter(w => w.isPast || w.isCurrent)
      .slice(-8)
  }, [stats])

  if (authLoading || (isLoading && !stats)) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="min-h-screen bg-bg-main p-4 py-6 md:py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-1 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-accent" />
            Календарь и стрик
          </h1>
          <p className="text-text-secondary text-sm">
            Отслеживай свою серию закрытых недель и активность по дням.
          </p>
        </div>

        {error && (
          <div className="glass-card p-4 mb-6 border-danger/40 bg-danger/10">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Streak + сводка */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            {stats && <StreakCard stats={stats} />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-warning" />
                <p className="text-xs text-text-muted">Лучшая серия</p>
              </div>
              <p className="text-2xl font-display font-bold text-white">
                {stats?.bestStreak ?? 0}
                <span className="text-xs text-text-muted ml-1.5 font-normal">нед.</span>
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-accent" />
                <p className="text-xs text-text-muted">Закрыто всего</p>
              </div>
              <p className="text-2xl font-display font-bold text-white">
                {stats?.totalCompletedWeeks ?? 0}
                <span className="text-xs text-text-muted ml-1.5 font-normal">из {stats?.totalWeeks ?? 0}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Последние недели */}
        {last8Weeks.length > 0 && (
          <div className="glass-card p-4 sm:p-6 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              Последние недели
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {last8Weeks.map(w => {
                const status =
                  w.isComplete ? 'complete' :
                  (w.isPast ? 'missed' : 'current')

                const bg =
                  status === 'complete' ? 'bg-accent/15 border-accent/40' :
                  status === 'missed' ? 'bg-danger/10 border-danger/30' :
                  'bg-bg-elevated/60 border-border'

                const txt =
                  status === 'complete' ? 'text-accent' :
                  status === 'missed' ? 'text-danger' :
                  'text-text-secondary'

                return (
                  <div
                    key={w.programId}
                    className={`flex-shrink-0 min-w-[88px] rounded-xl p-3 border ${bg} text-center`}
                    title={`Неделя ${w.weekNumber}: ${w.completedCount}/${w.requiredCount}`}
                  >
                    <p className="text-xs text-text-muted mb-1">Нед.</p>
                    <p className={`text-lg font-display font-bold ${txt}`}>{w.weekNumber}</p>
                    <p className="text-[10px] text-text-muted mt-1">
                      {w.completedCount}/{w.requiredCount}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Календарь */}
        {calendar && (
          <CalendarGrid
            month={calendar}
            weeksHistory={stats?.history}
            onMonthChange={(y, m) => setYM({ year: y, month: m })}
            onDayClick={(data, date) => setSelected({ date, data })}
          />
        )}

        {/* Предстоящие чекины */}
        {calendar && Object.values(calendar.days).some(d => d.isScheduledCheckin && !d.checkinCompleted) && (() => {
          const todayStr = new Date().toISOString().split('T')[0]
          const upcoming = Object.values(calendar.days)
            .filter(d => d.isScheduledCheckin && !d.checkinCompleted && d.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
          if (upcoming.length === 0) return null
          return (
            <div className="mt-6 glass-card p-4 sm:p-6 border-warning/20 bg-warning/5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>📏</span> Предстоящие чекины
              </h3>
              <div className="space-y-2">
                {upcoming.map(d => (
                  <div key={d.date} className="flex items-center justify-between p-3 rounded-xl bg-warning/10 border border-warning/20">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {new Date(d.date + 'T12:00:00').toLocaleDateString('ru-RU', {
                          weekday: 'long', day: 'numeric', month: 'long',
                        })}
                      </p>
                      {d.checkinNotes && <p className="text-xs text-text-muted mt-0.5">{d.checkinNotes}</p>}
                    </div>
                    <button
                      onClick={() => router.push('/metrics')}
                      className="glass-button-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      Замеры <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Подсказка про стрик по неделям */}        <div className="mt-6 glass-card p-4 sm:p-6 border-info/20 bg-info/5">
          <h3 className="text-sm font-semibold text-white mb-2">Как считается стрик</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Стрик растёт за каждую закрытую неделю — когда ты завершил <span className="text-white font-semibold">все запланированные тренировки</span> за неделю.
            Если за прошедшую неделю остались незаполненные дни, стрик обнуляется и нужно начинать новую серию.
          </p>
        </div>

        {/* Day details modal */}
        {selected && (
          <DayDetailsModal
            date={selected.date}
            data={selected.data}
            onClose={() => setSelected(null)}
            onOpenProgram={(pid) => {
              router.push(`/programs/${pid}`)
            }}
          />
        )}
      </div>
    </div>
  )
}

function DayDetailsModal({
  date,
  data,
  onClose,
  onOpenProgram,
}: {
  date: string
  data: CalendarDay | null
  onClose: () => void
  onOpenProgram: (programId: string) => void
}) {
  const formattedDate = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-text-muted">Детали дня</p>
            <h3 className="text-lg font-display font-bold text-white capitalize">
              {formattedDate}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="glass-button-secondary p-2 rounded-xl"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {data?.isTrainingCompleted ? (
            <button
              type="button"
              onClick={() => data.programId && onOpenProgram(data.programId)}
              className="w-full p-4 rounded-xl bg-accent/10 border border-accent/30 hover:bg-accent/15 transition-colors text-left flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {data.dayTitle || `День ${data.dayNumber}`}
                </p>
                <p className="text-xs text-text-muted">
                  Неделя {data.programWeek} · Тренировка завершена
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border text-text-muted text-sm">
              В этот день не было завершённой тренировки.
            </div>
          )}

          {data?.hasMetric && (
            <div className="p-4 rounded-xl bg-info/10 border border-info/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center flex-shrink-0">
                <Activity className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Замер добавлен</p>
                <p className="text-xs text-text-muted">Запись в метриках за этот день</p>
              </div>
            </div>
          )}

          {data?.isScheduledCheckin && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              data.checkinCompleted
                ? 'bg-success/10 border-success/20'
                : 'bg-warning/10 border-warning/20'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                data.checkinCompleted ? 'bg-success/20' : 'bg-warning/20'
              }`}>
                <span className="text-lg">{data.checkinCompleted ? '✅' : '📏'}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {data.checkinCompleted ? 'Чекин выполнен' : 'Запланирован чекин'}
                </p>
                {data.checkinNotes && (
                  <p className="text-xs text-text-muted mt-0.5">{data.checkinNotes}</p>
                )}
                {!data.checkinCompleted && (
                  <button
                    onClick={() => { onClose(); window.location.href = '/metrics' }}
                    className="mt-2 text-xs text-warning hover:underline"
                  >
                    Перейти к замерам →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
