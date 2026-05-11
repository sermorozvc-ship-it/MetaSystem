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
}

export interface TrainingDay {
  dayNumber: number
  dayOfWeek: string
  title: string
  exercises: Exercise[]
  cardio?: string
  clientNotes?: string
}

export interface Exercise {
  id: string
  name: string
  videoUrl?: string
  sets: number
  reps: string
  targetWeight?: number
  clientData?: {
    actualWeight?: number
    actualReps?: number
    rpe?: number
    comment?: string
  }
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
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching program:', error)
    throw error
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
 * Получить текущую активную программу
 */
export async function getCurrentProgram(): Promise<TrainingProgram | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching current program:', error)
    throw error
  }

  return data
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

  const { data, error } = await supabase
    .from('training_programs')
    .insert({
      user_id: userId,
      week_number: weekNumber,
      start_date: startDate,
      end_date: endDate,
      training_days_count: trainingDaysCount,
      program_md: programMd,
      program_data: programData,
      notes_trainer: notesTrainer,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating program:', error)
    throw error
  }

  // Отправить уведомление клиенту о новой программе
  await notifyProgramUploaded(userId, weekNumber)

  return data
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
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching entry:', error)
    throw error
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
  }
): Promise<TrainingEntry> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('training_entries')
    .upsert({
      program_id: programId,
      user_id: user.id,
      day_number: dayNumber,
      entry_data: entryData,
      ...metadata,
      updated_at: new Date().toISOString(),
    })
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

  const { error } = await supabase
    .from('training_entries')
    .update({ completed_at: new Date().toISOString() })
    .eq('program_id', programId)
    .eq('day_number', dayNumber)

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
    throw error
  }

  return data || []
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
      markdown += `### ${exercise.name}\n`
      if (exercise.videoUrl) markdown += `[Видео](${exercise.videoUrl})\n`
      markdown += `- План: ${exercise.sets} x ${exercise.reps}\n`
      
      if (entry?.entry_data[exercise.id]) {
        const clientData = entry.entry_data[exercise.id]
        markdown += `- Факт: ${clientData.actualWeight || '—'} кг x ${clientData.actualReps || '—'} повт.\n`
        markdown += `- RPE: ${clientData.rpe || '—'}/10\n`
        if (clientData.comment) markdown += `- Комментарий: ${clientData.comment}\n`
      }
      
      markdown += '\n'
    })

    if (entry) {
      markdown += `**Самочувствие:**\n`
      markdown += `- Энергия: ${entry.energy_level || '—'}/10\n`
      markdown += `- Настроение: ${entry.mood || '—'}/5\n`
      markdown += `- Сон: ${entry.sleep_quality || '—'}/5\n`
      if (entry.notes) markdown += `- Заметки: ${entry.notes}\n`
    }

    markdown += '\n---\n\n'
  })

  return markdown
}
