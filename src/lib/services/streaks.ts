// MetaSystem v2 — Streaks & Calendar Service
// Чистая логика: стрики по неделям и календарь активности.
// Работает поверх training_programs + training_entries + client_metrics.

import { createClient } from '@/lib/supabase/client'
import type { TrainingProgram, TrainingEntry } from './training'
import type { ClientMetric } from './metrics'

// ────────────────────────────────────────────────────────────────────────────
// Типы

export interface WeekStatus {
  programId: string
  weekNumber: number
  startDate: string  // ISO YYYY-MM-DD
  endDate: string
  requiredCount: number       // training_days_count
  completedCount: number      // entries с completed_at
  isComplete: boolean
  isPast: boolean             // end_date < today
  isCurrent: boolean          // today между start и end
}

export interface StreakStats {
  currentStreak: number       // подряд закрытых недель, начиная с самой последней закрытой
  bestStreak: number
  totalCompletedWeeks: number
  totalWeeks: number
  nextMilestone: number | null    // ближайшая веха (4, 8, 12, 26, 52)
  weeksToMilestone: number | null
  history: WeekStatus[]       // от старых к новым
  isInDanger: boolean         // текущая неделя завершилась, но не закрыта (streak порвётся со следующей закрытой)
  currentWeekProgress: {      // прогресс текущей (незакрытой) недели
    completed: number
    required: number
  } | null
}

export interface CalendarDay {
  date: string                // ISO YYYY-MM-DD
  isTrainingCompleted: boolean    // в этот день клиент завершил тренировку
  hasMetric: boolean              // в этот день есть запись метрик
  isScheduledCheckin: boolean     // в этот день запланирован чекин (замеры/фото)
  checkinId?: string              // id записи в scheduled_checkins
  checkinNotes?: string           // заметка тренера к чекину
  checkinCompleted: boolean       // чекин уже выполнен
  programId?: string
  programWeek?: number
  dayNumber?: number              // номер дня в программе (если завершено)
  dayTitle?: string
}

export interface CalendarMonth {
  year: number
  month: number               // 1-12
  days: Record<string, CalendarDay>   // ключ — ISO date
  // Сводка по месяцу
  trainingsCompleted: number
  metricsAdded: number
  scheduledCheckins: number   // кол-во запланированных чекинов в месяце
}

// ────────────────────────────────────────────────────────────────────────────
// Утилиты дат (без зависимостей)

function todayISO(): string {
  const d = new Date()
  // Используем локальную дату пользователя
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoDateOnly(value: string | Date): string {
  if (typeof value === 'string') {
    // Если уже YYYY-MM-DD — вернём как есть
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
    return new Date(value).toISOString().slice(0, 10)
  }
  return value.toISOString().slice(0, 10)
}

// ────────────────────────────────────────────────────────────────────────────
// Расчёт стриков

/**
 * Построить статус каждой недели по programs + entries.
 * Сортировка от старых к новым (по week_number).
 */
export function buildWeeksHistory(
  programs: TrainingProgram[],
  entries: TrainingEntry[]
): WeekStatus[] {
  const today = todayISO()

  // Группируем entries по program_id и считаем completed
  const completedByProgram = new Map<string, number>()
  for (const e of entries) {
    if (!e.completed_at) continue
    completedByProgram.set(e.program_id, (completedByProgram.get(e.program_id) || 0) + 1)
  }

  const sorted = [...programs].sort((a, b) => a.week_number - b.week_number)

  return sorted.map(p => {
    const required = Math.max(1, p.training_days_count || 1)
    const completed = completedByProgram.get(p.id) || 0
    const startDate = isoDateOnly(p.start_date)
    const endDate = isoDateOnly(p.end_date)
    const isPast = endDate < today
    const isCurrent = startDate <= today && today <= endDate

    return {
      programId: p.id,
      weekNumber: p.week_number,
      startDate,
      endDate,
      requiredCount: required,
      completedCount: completed,
      isComplete: completed >= required,
      isPast,
      isCurrent,
    }
  })
}

const MILESTONES = [2, 4, 8, 12, 26, 52]

/**
 * Рассчитать статистику стриков из истории недель.
 * Стрик = подряд закрытые недели, идущие до самой последней закрытой.
 */
export function calculateStreakStats(history: WeekStatus[]): StreakStats {
  // Считаем стрик: идём с конца (последние закрытые недели подряд)
  let currentStreak = 0
  let isInDanger = false

  // Найти последнюю прошедшую неделю
  const lastPastIdx = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].isPast) return i
    }
    return -1
  })()

  if (lastPastIdx >= 0) {
    // Если последняя прошедшая неделя не закрыта — стрик с прошлого момента порван
    if (!history[lastPastIdx].isComplete) {
      currentStreak = 0
      isInDanger = true
    } else {
      // Идём назад и считаем подряд закрытые
      for (let i = lastPastIdx; i >= 0; i--) {
        if (history[i].isComplete) currentStreak++
        else break
      }
    }
  }

  // Текущая неделя (idle, ещё не закончилась) если уже закрыта — добавляем
  const currentIdx = history.findIndex(w => w.isCurrent)
  if (currentIdx >= 0 && history[currentIdx].isComplete) {
    // Только если неделя до неё тоже закрыта или это первая
    if (lastPastIdx < 0 || history[lastPastIdx].isComplete) {
      currentStreak++
    }
  }

  // Best streak — максимальная серия подряд idущих закрытых среди прошедших + текущей-если-закрыта
  let bestStreak = 0
  let run = 0
  for (let i = 0; i < history.length; i++) {
    const w = history[i]
    if (!w.isPast && !w.isCurrent) break  // будущие недели не считаем
    if (w.isPast && !w.isComplete) { run = 0; continue }
    if (w.isCurrent && !w.isComplete) {
      // не разрывает best, но и не добавляет
      continue
    }
    if (w.isComplete) {
      run++
      if (run > bestStreak) bestStreak = run
    }
  }

  const totalCompletedWeeks = history.filter(w => w.isComplete).length
  const totalWeeks = history.filter(w => w.isPast || (w.isCurrent && w.isComplete)).length

  const nextMilestone = MILESTONES.find(m => m > currentStreak) ?? null
  const weeksToMilestone = nextMilestone ? nextMilestone - currentStreak : null

  // Прогресс текущей незакрытой недели (для мотивационного отображения)
  const currentWeek = history.find(w => w.isCurrent)
  const currentWeekProgress = (currentWeek && !currentWeek.isComplete)
    ? { completed: currentWeek.completedCount, required: currentWeek.requiredCount }
    : null

  return {
    currentStreak,
    bestStreak,
    totalCompletedWeeks,
    totalWeeks,
    nextMilestone,
    weeksToMilestone,
    history,
    isInDanger,
    currentWeekProgress,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Загрузка данных текущего пользователя

async function loadMyTrainingData(): Promise<{ programs: TrainingProgram[]; entries: TrainingEntry[] }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { programs: [], entries: [] }

  const [pr, er] = await Promise.all([
    supabase.from('training_programs').select('*').eq('user_id', user.id),
    supabase.from('training_entries').select('*').eq('user_id', user.id),
  ])

  return {
    programs: (pr.data || []) as TrainingProgram[],
    entries: (er.data || []) as TrainingEntry[],
  }
}

async function loadClientTrainingData(userId: string): Promise<{ programs: TrainingProgram[]; entries: TrainingEntry[] }> {
  const supabase = createClient()
  const [pr, er] = await Promise.all([
    supabase.from('training_programs').select('*').eq('user_id', userId),
    supabase.from('training_entries').select('*').eq('user_id', userId),
  ])

  return {
    programs: (pr.data || []) as TrainingProgram[],
    entries: (er.data || []) as TrainingEntry[],
  }
}

async function loadMyMetrics(): Promise<ClientMetric[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('client_metrics')
    .select('id,user_id,measured_at,weight_kg,notes')
    .eq('user_id', user.id)
  return (data || []) as ClientMetric[]
}

async function loadClientMetrics(userId: string): Promise<ClientMetric[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('client_metrics')
    .select('id,user_id,measured_at,weight_kg,notes')
    .eq('user_id', userId)
  return (data || []) as ClientMetric[]
}

// ────────────────────────────────────────────────────────────────────────────
// Публичные API (свои данные)

export async function getMyStreakStats(): Promise<StreakStats> {
  const { programs, entries } = await loadMyTrainingData()
  const history = buildWeeksHistory(programs, entries)
  return calculateStreakStats(history)
}

export async function getClientStreakStats(userId: string): Promise<StreakStats> {
  const { programs, entries } = await loadClientTrainingData(userId)
  const history = buildWeeksHistory(programs, entries)
  return calculateStreakStats(history)
}

// ────────────────────────────────────────────────────────────────────────────
// Календарь

/**
 * Построить данные календаря на месяц: какие даты содержат завершённые
 * тренировки и/или замеры.
 */
export function buildCalendarMonth(
  year: number,
  month: number, // 1-12
  programs: TrainingProgram[],
  entries: TrainingEntry[],
  metrics: ClientMetric[],
  scheduledCheckins: Array<{ id: string; scheduled_date: string; notes?: string; completed_at?: string }> = []
): CalendarMonth {
  const days: Record<string, CalendarDay> = {}

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDate = new Date(year, month, 0).getDate()
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`

  const ensureDay = (d: string): CalendarDay => {
    if (!days[d]) days[d] = {
      date: d,
      isTrainingCompleted: false,
      hasMetric: false,
      isScheduledCheckin: false,
      checkinCompleted: false,
    }
    return days[d]
  }

  const programById = new Map(programs.map(p => [p.id, p]))

  // Завершённые тренировки → проставляем по completed_at
  for (const e of entries) {
    if (!e.completed_at) continue
    const d = isoDateOnly(e.completed_at)
    if (d < firstDay || d > lastDay) continue

    const day = ensureDay(d)
    day.isTrainingCompleted = true
    day.programId = e.program_id
    day.dayNumber = e.day_number

    const prog = programById.get(e.program_id)
    if (prog) {
      day.programWeek = prog.week_number
      const dayInfo = prog.program_data?.days?.find(x => x.dayNumber === e.day_number)
      if (dayInfo?.title) day.dayTitle = dayInfo.title
    }
  }

  // Замеры → точка
  for (const m of metrics) {
    const d = isoDateOnly(m.measured_at)
    if (d < firstDay || d > lastDay) continue
    const day = ensureDay(d)
    day.hasMetric = true
  }

  // Запланированные чекины → жёлтая точка
  for (const c of scheduledCheckins) {
    const d = isoDateOnly(c.scheduled_date)
    if (d < firstDay || d > lastDay) continue
    const day = ensureDay(d)
    day.isScheduledCheckin = true
    day.checkinId = c.id
    day.checkinNotes = c.notes
    day.checkinCompleted = !!c.completed_at
  }

  const trainingsCompleted = Object.values(days).filter(d => d.isTrainingCompleted).length
  const metricsAdded = Object.values(days).filter(d => d.hasMetric).length
  const scheduledCheckinsCount = Object.values(days).filter(d => d.isScheduledCheckin).length

  return { year, month, days, trainingsCompleted, metricsAdded, scheduledCheckins: scheduledCheckinsCount }
}

export async function getMyCalendarMonth(year: number, month: number): Promise<CalendarMonth> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return buildCalendarMonth(year, month, [], [], [], [])

  const [{ programs, entries }, metrics, checkinsRes] = await Promise.all([
    loadMyTrainingData(),
    loadMyMetrics(),
    supabase
      .from('scheduled_checkins')
      .select('id,scheduled_date,notes,completed_at')
      .eq('user_id', user.id),
  ])
  const checkins = (checkinsRes.data || []) as Array<{ id: string; scheduled_date: string; notes?: string; completed_at?: string }>
  return buildCalendarMonth(year, month, programs, entries, metrics, checkins)
}

export async function getClientCalendarMonth(userId: string, year: number, month: number): Promise<CalendarMonth> {
  const supabase = createClient()
  const [{ programs, entries }, metrics, checkinsRes] = await Promise.all([
    loadClientTrainingData(userId),
    loadClientMetrics(userId),
    supabase
      .from('scheduled_checkins')
      .select('id,scheduled_date,notes,completed_at')
      .eq('user_id', userId),
  ])
  const checkins = (checkinsRes.data || []) as Array<{ id: string; scheduled_date: string; notes?: string; completed_at?: string }>
  return buildCalendarMonth(year, month, programs, entries, metrics, checkins)
}

/**
 * Загружает стрик-статистику И данные календаря за один набор запросов.
 * Вместо 5 запросов (2+2+1) делает 3 (programs + entries + metrics).
 * При смене месяца пересчитывает только календарь из уже загруженных данных.
 */
export async function getClientStreakAndCalendar(
  userId: string,
  year: number,
  month: number
): Promise<{ stats: StreakStats; calendar: CalendarMonth }> {
  const supabase = createClient()
  const [{ programs, entries }, metrics, checkinsRes] = await Promise.all([
    loadClientTrainingData(userId),
    loadClientMetrics(userId),
    supabase
      .from('scheduled_checkins')
      .select('id,scheduled_date,notes,completed_at')
      .eq('user_id', userId),
  ])
  const checkins = (checkinsRes.data || []) as Array<{ id: string; scheduled_date: string; notes?: string; completed_at?: string }>
  const history = buildWeeksHistory(programs, entries)
  const stats = calculateStreakStats(history)
  const calendar = buildCalendarMonth(year, month, programs, entries, metrics, checkins)
  return { stats, calendar }
}

/**
 * Пересчитывает только календарь из уже загруженных данных (без новых запросов).
 * Используется при смене месяца в AdminClientActivityView.
 */
export function rebuildCalendarMonth(
  year: number,
  month: number,
  programs: TrainingProgram[],
  entries: TrainingEntry[],
  metrics: ClientMetric[],
  scheduledCheckins: Array<{ id: string; scheduled_date: string; notes?: string; completed_at?: string }> = []
): CalendarMonth {
  return buildCalendarMonth(year, month, programs, entries, metrics, scheduledCheckins)
}
