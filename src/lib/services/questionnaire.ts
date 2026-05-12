// MetaSystem v2 — Questionnaire Service
// Сервис для работы с анкетами клиентов

import { createClient } from '@/lib/supabase/client'

export interface ClientQuestionnaire {
  id: string
  user_id: string
  // Базовые данные
  age?: number
  gender?: 'male' | 'female'
  height_cm?: number
  weight_kg?: number
  // Цели и опыт
  goal?: string
  training_experience?: string
  preferred_training_days?: number
  available_equipment?: string[]
  // Ограничения
  injuries?: string
  health_conditions?: string
  // Образ жизни
  sleep_hours_avg?: number
  stress_level?: number
  activity_level?: string
  // Начальные замеры
  waist_cm?: number
  hips_cm?: number
  chest_cm?: number
  arm_cm?: number
  thigh_cm?: number
  // Фото
  photo_front?: string
  photo_side?: string
  photo_back?: string
  // Доп. информация
  additional_notes?: string
  created_at: string
  updated_at: string
}

export interface QuestionnaireFormData {
  age: number
  gender: 'male' | 'female'
  height_cm: number
  weight_kg: number
  goal: string
  training_experience: string
  preferred_training_days: number
  available_equipment: string[]
  injuries?: string
  health_conditions?: string
  sleep_hours_avg: number
  stress_level: number
  activity_level: string
  waist_cm?: number
  hips_cm?: number
  chest_cm?: number
  arm_cm?: number
  thigh_cm?: number
  photo_front?: string
  photo_side?: string
  photo_back?: string
  additional_notes?: string
}

/**
 * Получить анкету текущего пользователя
 */
export async function getMyQuestionnaire(): Promise<ClientQuestionnaire | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_questionnaires')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching questionnaire:', error)
    throw error
  }

  return data
}

/**
 * Получить анкету клиента по ID (для админа)
 */
export async function getQuestionnaireByUserId(userId: string): Promise<ClientQuestionnaire | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_questionnaires')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching questionnaire:', error)
    }
    return null
  }

  return data
}

/**
 * Создать или обновить анкету
 */
export async function upsertQuestionnaire(
  formData: QuestionnaireFormData
): Promise<ClientQuestionnaire> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Убираем undefined поля — Supabase не любит их в upsert
  const payload: Record<string, any> = { user_id: user.id, updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(formData)) {
    if (value !== undefined && value !== null) {
      payload[key] = value
    }
  }

  const { data, error } = await supabase
    .from('client_questionnaires')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting questionnaire:', error)
    throw new Error('Ошибка сохранения: ' + error.message)
  }

  // Обновляем флаг в профиле
  await supabase
    .from('profiles')
    .update({ questionnaire_completed: true })
    .eq('id', user.id)

  return data
}

/**
 * Загрузить фото в Storage
 */
export async function uploadQuestionnairePhoto(
  file: File,
  type: 'front' | 'side' | 'back'
): Promise<string> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/questionnaire/${type}_${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('client-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Error uploading photo:', error)
    throw error
  }

  const { data: { publicUrl } } = supabase.storage
    .from('client-photos')
    .getPublicUrl(data.path)

  return publicUrl
}

/**
 * Проверить, заполнена ли анкета
 */
export async function isQuestionnaireCompleted(): Promise<boolean> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Проверяем наличие записи в client_questionnaires
  // Это более надежно, чем полагаться только на флаг
  const { data: questionnaire } = await supabase
    .from('client_questionnaires')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Если есть запись в анкетах - считаем заполненной
  if (questionnaire) {
    // Обновляем флаг в профиле на всякий случай
    await supabase
      .from('profiles')
      .update({ questionnaire_completed: true })
      .eq('id', user.id)
    
    return true
  }

  return false
}
