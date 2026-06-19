// MetaSystem v2 — Training Service
// Сервис для работы с тренировочными программами

import { createClient, safeGetUser, directSupabaseFetch } from '@/lib/supabase/client'
import { notifyProgramUploaded } from './notifications'
import { withTimeout } from '@/lib/utils/with-timeout'

/**
 * Все клиентские чтения и записи в этом сервисе обёрнуты в withTimeout.
 * Без него Supabase-запрос мог «висеть» бесконечно — UI-спиннер не
 * сбрасывался, пользователь видел вечный лоадер и был вынужден жать F5.
 * См. .kiro/steering/desktop-page-load.md — это часть контракта десктопной
 * загрузки страниц.
 */

export interface TrainingProgram {
  id: string
  user_id: string
  week_number: number
  start_date: string
  end_date: string
  training_days_count: number
  program_md: string
  program_data: ProgramData
  status: 'draft' | 'active' | 'completed' | 'archived'
  notes_trainer?: string
  created_at: string
  updated_at: string
}

export interface ProgramData {
  weekNumber: number
  startDate: string
  endDate: string
  days: TrainingDay[]
  weeklyNote?: string         // краткая рекомендация тренера на неделю (**Рекомендация:**)
  weekContext?: string        // контекст недели (**Контекст недели:**), многострочный
  redFlags?: string           // красные флаги (**Красные флаги:**), многострочный
  checkin?: string            // блок чек-ина (## 📊 Чек-ин в конце недели)
  loggingNote?: string        // памятка по логированию (## Памятка по логированию)
  prevWeekStats?: PrevWeekStats // статистика за прошлую неделю
}

/**
 * Статистика за прошлую неделю.
 * Отображается клиенту в начале текущей недели, чтобы он видел, что
 * тренер слышит его обратную связь и составляет программу индивидуально.
 *
 * Все три подблока — многострочный markdown-текст, заполняется тренером
 * на основе фактических подходов и комментариев клиента за прошлую неделю.
 */
export interface PrevWeekStats {
  coachSummary?: string    // **Резюме прошлой недели:** общий обзор и мысли тренера
  volumeSummary?: string   // **Объём прошлой недели:** тоннаж/интенсивность (объективно)
  wellnessSummary?: string // **Самочувствие прошлой недели:** обобщение со слов клиента
}

export interface TrainingDay {
  dayNumber: number
  dayOfWeek: string
  title: string
  exercises: Exercise[]
  cardio?: string
  clientNotes?: string
  coachNote?: string   // краткая рекомендация тренера на день (**Рекомендация дня:**)
  dayContext?: string  // расширенный контекст дня, многострочный
  warmup?: string      // блок разминки на день (**Разминка:**), многострочный
  cooldown?: string    // блок заминки на день (**Заминка:**), многострочный
  /**
   * Признак «отдельный кардио-день» (день отдыха от силовой, посвящённый кардио).
   * Парсер выставляет true, если заголовок дня содержит слово «кардио»
   * (например «## День 4: Кардио (день отдыха от силовой)»).
   * Для таких дней exercises пустой, основная нагрузка описана в `cardio`
   * (например «40 мин ходьба или велотренажёр (ЧСС 115-130), без интервалов»).
   * UI скрывает разминку/заминку/упражнения и показывает кардио крупным блоком.
   */
  cardioOnly?: boolean
}

export interface Exercise {
  id: string
  name: string
  videoUrl?: string
  sets: number
  reps: string
  targetWeights: number[]   // вес для каждого подхода, длина = sets
  targetWeight?: number     // legacy fallback
  alternatives?: AlternativeExercise[]  // альтернативные упражнения (2-3 варианта)
  clientData?: {
    actualWeight?: number
    actualReps?: number
    rpe?: number
    comment?: string
  }
}

export interface AlternativeExercise {
  id: string
  name: string
  videoUrl?: string
  sets: number
  reps: string
  // Веса для альтернатив не проставляются по умолчанию
}

export interface TrainingEntry {
  id: string
  program_id: string
  user_id: string
  day_number: number
  entry_data: Record<string, any>
  energy_level?: number
  mood?: number
  sleep_quality?: number
  notes?: string
  workout_duration_seconds?: number
  completed_at?: string
  created_at: string
  updated_at: string
}

/**
 * Получить все программы пользователя
 */
export async function getMyPrograms(): Promise<TrainingProgram[]> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    const { data, error } = await withTimeout<{ data: TrainingProgram[] | null; error: any }>(
      supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', user.id)
        .order('week_number', { ascending: false }),
      'getMyPrograms',
    )

    if (error) {
      console.error('Error fetching programs:', error)
      return []
    }

    return data || []
  } catch (e) {
    console.error('Error fetching programs (timeout/network):', e)
    return []
  }
}

/**
 * Получить программу по ID
 */
export async function getProgramById(programId: string): Promise<TrainingProgram | null> {
  const supabase = createClient()

  try {
    const { data, error } = await withTimeout<{ data: TrainingProgram | null; error: any }>(
      supabase
        .from('training_programs')
        .select('*')
        .eq('id', programId)
        .maybeSingle(),
      'getProgramById',
    )

    if (error) {
      console.error('Error fetching program:', error)
      return null
    }

    return data
  } catch (e) {
    console.error('Error fetching program (timeout/network):', e)
    return null
  }
}

/**
 * Получить программу по номеру недели
 */
export async function getProgramByWeek(weekNumber: number): Promise<TrainingProgram | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    const { data, error } = await withTimeout<{ data: TrainingProgram | null; error: any }>(
      supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .maybeSingle(),
      'getProgramByWeek',
    )

    if (error) {
      console.error('Error fetching program:', error)
      return null
    }

    return data
  } catch (e) {
    console.error('Error fetching program (timeout/network):', e)
    return null
  }
}

/**
 * Получить текущую активную программу.
 * Приоритет: программа на сегодня → последняя активная по дате начала
 */
export async function getCurrentProgram(): Promise<TrainingProgram | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[Training] getCurrentProgram: not authenticated')
    return null
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    // 1. Ищем программу, в диапазон которой попадает сегодня
    const { data: exact, error: exactError } = await withTimeout<{ data: TrainingProgram | null; error: any }>(
      supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle(),
      'getCurrentProgram:exact',
    )

    if (exactError) {
      console.error('Error fetching current program (exact):', exactError)
    } else if (exact) {
      return exact
    }

    // 2. Fallback: последняя активная программа (по убыванию week_number)
    const { data: latest, error: latestError } = await withTimeout<{ data: TrainingProgram | null; error: any }>(
      supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'getCurrentProgram:latest',
    )

    if (latestError) {
      console.error('Error fetching current program (latest):', latestError)
      return null
    }

    return latest ?? null
  } catch (e) {
    console.error('Error fetching current program (timeout/network):', e)
    return null
  }
}

/**
 * Создать программу (для админа)
 */
export async function createProgram(
  userId: string,
  weekNumber: number,
  startDate: string,
  endDate: string,
  trainingDaysCount: number,
  programMd: string,
  programData: ProgramData,
  notesTrainer?: string
): Promise<TrainingProgram> {
  const supabase = createClient()

  console.log('[Training] Creating program for user:', userId, 'week:', weekNumber)

  const insertPayload = {
    user_id: userId,
    week_number: weekNumber,
    start_date: startDate,
    end_date: endDate,
    training_days_count: trainingDaysCount,
    program_md: programMd,
    program_data: programData,
    notes_trainer: notesTrainer || null,
    status: 'active',
  }

  console.log('[Training] Insert payload keys:', Object.keys(insertPayload))

  const { data, error } = await supabase
    .from('training_programs')
    .insert(insertPayload)
    .select()

  console.log('[Training] Insert result - data:', !!data, 'error:', error?.message || 'none')

  if (error) {
    console.error('[Training] Error creating program:', error)
    throw new Error('Ошибка создания программы: ' + error.message + ' (code: ' + error.code + ')')
  }

  const program = Array.isArray(data) ? data[0] : data
  if (!program) {
    throw new Error('Программа не была создана (пустой ответ от БД)')
  }

  console.log('[Training] Program created:', program.id)

  // Отправить уведомление клиенту (не блокируем если не получится)
  try {
    await notifyProgramUploaded(userId, weekNumber)
  } catch (e) {
    console.warn('[Training] Notification failed (non-critical):', e)
  }

  return program
}

/**
 * Обновить программу
 */
export async function updateProgram(
  programId: string,
  updates: Partial<TrainingProgram>
): Promise<TrainingProgram> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('training_programs')
    .update(updates)
    .eq('id', programId)
    .select()
    .single()

  if (error) {
    console.error('Error updating program:', error)
    throw error
  }

  return data
}

/**
 * Получить запись тренировки
 */
export async function getTrainingEntry(
  programId: string,
  dayNumber: number
): Promise<TrainingEntry | null> {
  const supabase = createClient()

  try {
    const { data, error } = await withTimeout<{ data: TrainingEntry | null; error: any }>(
      supabase
        .from('training_entries')
        .select('*')
        .eq('program_id', programId)
        .eq('day_number', dayNumber)
        .maybeSingle(),
      'getTrainingEntry',
    )

    if (error) {
      console.error('Error fetching entry:', error)
      return null
    }

    return data
  } catch (e) {
    console.error('Error fetching entry (timeout/network):', e)
    return null
  }
}

/**
 * Сохранить/обновить запись тренировки
 */
export async function upsertTrainingEntry(
  programId: string,
  dayNumber: number,
  entryData: Record<string, any>,
  metadata?: {
    energy_level?: number
    mood?: number
    sleep_quality?: number
    notes?: string
    workout_duration_seconds?: number
  }
): Promise<TrainingEntry> {
  const user = await safeGetUser()
  if (!user) throw new Error('Not authenticated')

  const payload = {
    program_id: programId,
    user_id: user.id,
    day_number: dayNumber,
    entry_data: entryData,
    ...metadata,
    updated_at: new Date().toISOString(),
  }

  try {
    const result = await directSupabaseFetch<TrainingEntry[]>(
      'training_entries',
      {
        method: 'POST',
        body: payload,
        params: 'on_conflict=program_id,day_number',
        prefer: 'return=representation,resolution=merge-duplicates',
      },
      10_000,
    )

    const row = Array.isArray(result) ? result[0] : result
    if (!row) throw new Error('Upsert returned no data')
    return row
  } catch (e: any) {
    console.error('Error upserting entry:', e)
    throw e
  }
}

/**
 * Отметить тренировку как завершенную
 */
export async function completeTrainingDay(
  programId: string,
  dayNumber: number
): Promise<void> {
  const user = await safeGetUser()
  if (!user) throw new Error('Not authenticated')

  try {
    await directSupabaseFetch(
      'training_entries',
      {
        method: 'PATCH',
        body: { completed_at: new Date().toISOString() },
        params: `program_id=eq.${programId}&day_number=eq.${dayNumber}&user_id=eq.${user.id}`,
        prefer: 'return=minimal',
      },
      10_000,
    )
  } catch (e: any) {
    console.error('Error completing training day:', e)
    throw e
  }
}

/**
 * Получить все записи программы
 */
export async function getProgramEntries(programId: string): Promise<TrainingEntry[]> {
  const supabase = createClient()

  try {
    const { data, error } = await withTimeout<{ data: TrainingEntry[] | null; error: any }>(
      supabase
        .from('training_entries')
        .select('*')
        .eq('program_id', programId)
        .order('day_number', { ascending: true }),
      'getProgramEntries',
    )

    if (error) {
      console.error('Error fetching entries:', error)
      return []
    }

    return data || []
  } catch (e) {
    console.error('Error fetching entries (timeout/network):', e)
    return []
  }
}

/**
 * Получить программы клиента (для админа)
 */
export async function getClientPrograms(userId: string): Promise<TrainingProgram[]> {
  const supabase = createClient()

  try {
    const { data, error } = await withTimeout<{ data: TrainingProgram[] | null; error: any }>(
      supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', userId)
        .order('week_number', { ascending: false }),
      'getClientPrograms',
    )

    if (error) {
      console.error('Error fetching client programs:', error)
      return []
    }

    return data || []
  } catch (e) {
    console.error('Error fetching client programs (timeout/network):', e)
    return []
  }
}

/**
 * Получить все записи тренировок пользователя (для статистики прогресса)
 * Возвращает записи вместе с данными программы (start_date, program_data)
 */
export async function getAllMyTrainingData(): Promise<{
  programs: TrainingProgram[]
  entries: TrainingEntry[]
}> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [programsRes, entriesRes] = await Promise.all([
    supabase
      .from('training_programs')
      .select('*')
      .eq('user_id', user.id)
      .order('week_number', { ascending: true }),
    supabase
      .from('training_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  return {
    programs: programsRes.data || [],
    entries: entriesRes.data || [],
  }
}

/**
 * Получить все записи тренировок клиента (для админа, через service role)
 */
export async function getAllClientTrainingData(
  userId: string,
  supabaseAdmin: any
): Promise<{
  programs: TrainingProgram[]
  entries: TrainingEntry[]
}> {
  const [programsRes, entriesRes] = await Promise.all([
    supabaseAdmin
      .from('training_programs')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true }),
    supabaseAdmin
      .from('training_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  return {
    programs: programsRes.data || [],
    entries: entriesRes.data || [],
  }
}

/**
 * Экспортировать программу в Markdown
 */
export function exportProgramToMarkdown(program: TrainingProgram): string {
  return program.program_md
}
