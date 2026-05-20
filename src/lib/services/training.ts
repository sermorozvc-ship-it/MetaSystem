// MetaSystem v2 — Training Service
// Сервис для работы с тренировочными программами

import { createClient } from '@/lib/supabase/client'
import { notifyProgramUploaded } from './notifications'

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
  weeklyNote?: string  // общая рекомендация тренера на неделю
}

export interface TrainingDay {
  dayNumber: number
  dayOfWeek: string
  title: string
  exercises: Exercise[]
  cardio?: string
  clientNotes?: string
  coachNote?: string   // рекомендация тренера на этот день
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

  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .eq('user_id', user.id)
    .order('week_number', { ascending: false })

  if (error) {
    console.error('Error fetching programs:', error)
    throw error
  }

  return data || []
}

/**
 * Получить программу по ID
 */
export async function getProgramById(programId: string): Promise<TrainingProgram | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .eq('id', programId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching program:', error)
    return null
  }

  return data
}

/**
 * Получить программу по номеру недели
 */
export async function getProgramByWeek(weekNumber: number): Promise<TrainingProgram | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_number', weekNumber)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching program:', error)
    throw error
  }

  return data
}

/**
 * Получить текущую активную программу.
 * Приоритет: программа на сегодня → последняя активная по дате начала
 */
export async function getCurrentProgram(): Promise<TrainingProgram | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().split('T')[0]

  // 1. Ищем программу, в диапазон которой попадает сегодня
  const { data: exact } = await supabase
    .from('training_programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle()

  if (exact) return exact

  // 2. Fallback: последняя активная программа (по убыванию week_number)
  const { data: latest } = await supabase
    .from('training_programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return latest ?? null
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

  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
    .maybeSingle()

  if (error) {
    console.error('Error fetching entry:', error)
    return null
  }

  return data
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
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('training_entries')
    .upsert(
      {
        program_id: programId,
        user_id: user.id,
        day_number: dayNumber,
        entry_data: entryData,
        ...metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'program_id,day_number' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error upserting entry:', error)
    throw error
  }

  return data
}

/**
 * Отметить тренировку как завершенную
 */
export async function completeTrainingDay(
  programId: string,
  dayNumber: number
): Promise<void> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('training_entries')
    .update({ completed_at: new Date().toISOString() })
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error completing training day:', error)
    throw error
  }
}

/**
 * Получить все записи программы
 */
export async function getProgramEntries(programId: string): Promise<TrainingEntry[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('program_id', programId)
    .order('day_number', { ascending: true })

  if (error) {
    console.error('Error fetching entries:', error)
    throw error
  }

  return data || []
}

/**
 * Получить программы клиента (для админа)
 */
export async function getClientPrograms(userId: string): Promise<TrainingProgram[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .eq('user_id', userId)
    .order('week_number', { ascending: false })

  if (error) {
    console.error('Error fetching client programs:', error)
    return []
  }

  return data || []
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

/**
 * Экспортировать заполненную программу с данными клиента
 */
export async function exportFilledProgram(programId: string): Promise<string> {
  const program = await getProgramById(programId)
  if (!program) throw new Error('Program not found')

  const entries = await getProgramEntries(programId)
  
  let markdown = `# Неделя ${program.week_number}\n\n`
  markdown += `**Период:** ${program.start_date} — ${program.end_date}\n\n`

  program.program_data.days.forEach((day) => {
    const entry = entries.find((e) => e.day_number === day.dayNumber)
    
    markdown += `## День ${day.dayNumber}: ${day.title}\n\n`
    
    day.exercises.forEach((exercise) => {
      const entryForEx = entry?.entry_data[exercise.id]
      // Определяем какое упражнение было выполнено (основное или альтернатива)
      const selectedAltId = entryForEx?.selectedAlternativeId
      const selectedAlt = selectedAltId
        ? exercise.alternatives?.find(a => a.id === selectedAltId)
        : null
      const performedName = selectedAlt ? selectedAlt.name : exercise.name
      const performedSets = selectedAlt ? selectedAlt.sets : exercise.sets
      const performedReps = selectedAlt ? selectedAlt.reps : exercise.reps

      markdown += `### ${performedName}`
      if (selectedAlt) markdown += ` *(альтернатива к: ${exercise.name})*`
      markdown += '\n'
      if (exercise.videoUrl && !selectedAlt) markdown += `[Видео](${exercise.videoUrl})\n`
      if (selectedAlt?.videoUrl) markdown += `[Видео](${selectedAlt.videoUrl})\n`
      markdown += `- План: ${performedSets} x ${performedReps}\n`

      if (entryForEx) {
        if (entryForEx.sets && Array.isArray(entryForEx.sets)) {
          // Новый формат с подходами
          const filledSets = entryForEx.sets.filter((s: any) => s.weight || s.reps)
          if (filledSets.length > 0) {
            markdown += `- Факт подходов:\n`
            filledSets.forEach((s: any, i: number) => {
              markdown += `  - Подход ${i + 1}: ${s.weight || '—'} кг × ${s.reps || '—'} повт.${s.rir ? ` RIR ${s.rir}` : ''}\n`
            })
          }
        } else {
          // Старый формат
          markdown += `- Факт: ${entryForEx.actualWeight || '—'} кг x ${entryForEx.actualReps || '—'} повт.\n`
          markdown += `- RPE: ${entryForEx.rpe || '—'}/10\n`
        }
        if (entryForEx.comment) markdown += `- Комментарий: ${entryForEx.comment}\n`
      }

      markdown += '\n'
    })

    if (entry) {
      markdown += `**Самочувствие:**\n`
      markdown += `- Энергия: ${entry.energy_level || '—'}/10\n`
      markdown += `- Настроение: ${entry.mood || '—'}/5\n`
      markdown += `- Сон: ${entry.sleep_quality || '—'}/5\n`
      if (entry.workout_duration_seconds) {
        const h = Math.floor(entry.workout_duration_seconds / 3600)
        const m = Math.floor((entry.workout_duration_seconds % 3600) / 60)
        const s = entry.workout_duration_seconds % 60
        const timeStr = h > 0
          ? `${h}ч ${m}мин`
          : s > 0 ? `${m}мин ${s}с` : `${m}мин`
        markdown += `- Время тренировки: ${timeStr}\n`
      }
      if (entry.notes) markdown += `- Заметки: ${entry.notes}\n`
    }

    markdown += '\n---\n\n'
  })

  return markdown
}
