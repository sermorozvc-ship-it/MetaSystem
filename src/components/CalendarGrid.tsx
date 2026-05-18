'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Dumbbell, Activity } from 'lucide-react'
import type { CalendarMonth, CalendarDay, WeekStatus } from '@/lib/services/streaks'

interface Props {
  month: CalendarMonth
  weeksHistory?: WeekStatus[]
  onMonthChange?: (year: number, month: number) => void
  onDayClick?: (day: CalendarDay | null, date: string) => void
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function CalendarGrid({
  month,
  weeksHistory,
  onMonthChange,
  onDayClick,
}: Props) {
  const today = todayISO()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Подготовим клетки с правильной раскладкой (Пн-Вс)
  const cells = useMemo(() => {
    const { year, month: m } = month
    const firstDayOfMonth = new Date(year, m - 1, 1)
    const lastDay = new Date(year, m, 0).getDate()

    // Понедельник = 0
    const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7

    const out: Array<{ date: string | null; data?: CalendarDay; inWeek?: WeekStatus }> = []
    for (let i = 0; i < firstWeekday; i++) out.push({ date: null })

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${pad(m)}-${pad(d)}`
      const dayData = month.days[dateStr]
      const inWeek = weeksHistory?.find(w => dateStr >= w.startDate && dateStr <= w.endDate)
      out.push({ date: dateStr, data: dayData, inWeek })
    }

    // Добиваем до полной сетки (кратно 7)
    while (out.length % 7 !== 0) out.push({ date: null })

    return out
  }, [month, weeksHistory])

  const navMonth = (delta: number) => {
    if (!onMonthChange) return
    const nm = month.month + delta
    let y = month.year
    let m = nm
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    onMonthChange(y, m)
  }

  const handleDayClick = (cell: typeof cells[number]) => {
    if (!cell.date) return
    setSelectedDate(cell.date)
    onDayClick?.(cell.data ?? null, cell.date)
  }

  return (
    <div className="glass-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-display font-bold text-white">
          {MONTHS_RU[month.month - 1]} {month.year}
        </h3>
        {onMonthChange && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => navMonth(-1)}
              className="glass-button-secondary p-2 rounded-xl"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navMonth(1)}
              className="glass-button-secondary p-2 rounded-xl"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] sm:text-xs text-text-muted font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((cell, i) => {
          if (!cell.date) {
            return <div key={i} className="aspect-square" />
          }

          const isToday = cell.date === today
          const isSelected = cell.date === selectedDate
          const day = parseInt(cell.date.split('-')[2], 10)
          const data = cell.data
          const inWeek = cell.inWeek

          // Цветовое окрашивание клетки
          let bg = 'bg-bg-elevated/40'
          let textColor = 'text-text-secondary'

          if (data?.isTrainingCompleted) {
            bg = 'bg-accent/30 border-accent/50'
            textColor = 'text-white'
          } else if (inWeek?.isComplete) {
            bg = 'bg-accent/10'
            textColor = 'text-text-secondary'
          } else if (inWeek?.isPast && !inWeek.isComplete) {
            bg = 'bg-danger/10'
            textColor = 'text-text-secondary'
          } else if (inWeek?.isCurrent) {
            bg = 'bg-accent/5 border-accent/20'
          }

          return (
            <button
              key={i}
              onClick={() => handleDayClick(cell)}
              className={`relative aspect-square rounded-lg border border-transparent flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 ${bg} ${
                isSelected ? 'ring-2 ring-accent' : ''
              } ${isToday ? 'ring-1 ring-white/40' : ''}`}
            >
              <span className={`text-[11px] sm:text-sm font-semibold ${textColor} ${isToday ? 'text-white' : ''}`}>
                {day}
              </span>
              {/* Индикаторы внизу клетки */}
              <div className="absolute bottom-1 flex gap-0.5">
                {data?.isTrainingCompleted && (
                  <span className="w-1 h-1 rounded-full bg-accent" />
                )}
                {data?.hasMetric && (
                  <span className="w-1 h-1 rounded-full bg-info" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Legend + summary */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent/50 border border-accent/60" />
            <span>Тренировка</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent/10" />
            <span>Закрытая неделя</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-danger/20" />
            <span>Пропуски</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-info" />
            <span>Замер</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-secondary flex-wrap">
          <div className="flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-accent" />
            <span>{month.trainingsCompleted} тренировок</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-info" />
            <span>{month.metricsAdded} замеров</span>
          </div>
        </div>
      </div>
    </div>
  )
}
