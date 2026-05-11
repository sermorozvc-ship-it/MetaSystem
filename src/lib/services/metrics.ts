// MetaSystem v2 — Metrics Service
// Сервис для работы с метриками и замерами клиентов

import { createClient } from '@/lib/supabase/client'

export interface ClientMetric {
  id: string
  user_id: string
  measured_at: string
  // Основные метрики
  weight_kg?: number
  body_fat_pct?: number
  // Объемы
  waist_cm?: number
  hips_cm?: number
  chest_cm?: number
  arm_left_cm?: number
  arm_right_cm?: number
  thigh_left_cm?: number
  thigh_right_cm?: number
  // Образ жизни
  sleep_hours?: number
  stress_level?: number
  steps_avg?: number
  water_liters?: number
  // Фото
  photo_front?: string
  photo_side?: string
  photo_back?: string
  notes?: string
  created_at: string
}

export interface MetricFormData {
  measured_at: string
  weight_kg?: number
  body_fat_pct?: number
  waist_cm?: number
  hips_cm?: number
  chest_cm?: number
  arm_left_cm?: number
  arm_right_cm?: number
  thigh_left_cm?: number
  thigh_right_cm?: number
  sleep_hours?: number
  stress_level?: number
  steps_avg?: number
  water_liters?: number
  photo_front?: string
  photo_side?: string
  photo_back?: string
  notes?: string
}

export interface MetricsDelta {
  weight_kg?: number
  body_fat_pct?: number
  waist_cm?: number
  hips_cm?: number
  chest_cm?: number
  arm_left_cm?: number
  arm_right_cm?: number
  thigh_left_cm?: number
  thigh_right_cm?: number
}

/**
 * Получить все метрики пользователя
 */
export async function getMyMetrics(): Promise<ClientMetric[]> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })

  if (error) {
    console.error('Error fetching metrics:', error)
    throw error
  }

  return data || []
}

/**
 * Получить метрики клиента (для админа)
 */
export async function getClientMetrics(userId: string): Promise<ClientMetric[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })

  if (error) {
    console.error('Error fetching client metrics:', error)
    throw error
  }

  return data || []
}

/**
 * Получить метрику по дате
 */
export async function getMetricByDate(date: string): Promise<ClientMetric | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', user.id)
    .eq('measured_at', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching metric:', error)
    throw error
  }

  return data
}

/**
 * Получить последнюю метрику
 */
export async function getLatestMetric(): Promise<ClientMetric | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest metric:', error)
    throw error
  }

  return data
}

/**
 * Создать или обновить метрику
 */
export async function upsertMetric(formData: MetricFormData): Promise<ClientMetric> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_metrics')
    .upsert({
      user_id: user.id,
      ...formData,
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting metric:', error)
    throw error
  }

  return data
}

/**
 * Удалить метрику
 */
export async function deleteMetric(metricId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('client_metrics')
    .delete()
    .eq('id', metricId)

  if (error) {
    console.error('Error deleting metric:', error)
    throw error
  }
}

/**
 * Загрузить фото прогресса
 */
export async function uploadProgressPhoto(
  file: File,
  type: 'front' | 'side' | 'back',
  date: string
): Promise<string> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/progress/${date}_${type}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('client-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
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
 * Рассчитать дельту между двумя метриками
 */
export function calculateDelta(
  current: ClientMetric,
  previous: ClientMetric
): MetricsDelta {
  const delta: MetricsDelta = {}

  if (current.weight_kg && previous.weight_kg) {
    delta.weight_kg = current.weight_kg - previous.weight_kg
  }
  if (current.body_fat_pct && previous.body_fat_pct) {
    delta.body_fat_pct = current.body_fat_pct - previous.body_fat_pct
  }
  if (current.waist_cm && previous.waist_cm) {
    delta.waist_cm = current.waist_cm - previous.waist_cm
  }
  if (current.hips_cm && previous.hips_cm) {
    delta.hips_cm = current.hips_cm - previous.hips_cm
  }
  if (current.chest_cm && previous.chest_cm) {
    delta.chest_cm = current.chest_cm - previous.chest_cm
  }
  if (current.arm_left_cm && previous.arm_left_cm) {
    delta.arm_left_cm = current.arm_left_cm - previous.arm_left_cm
  }
  if (current.arm_right_cm && previous.arm_right_cm) {
    delta.arm_right_cm = current.arm_right_cm - previous.arm_right_cm
  }
  if (current.thigh_left_cm && previous.thigh_left_cm) {
    delta.thigh_left_cm = current.thigh_left_cm - previous.thigh_left_cm
  }
  if (current.thigh_right_cm && previous.thigh_right_cm) {
    delta.thigh_right_cm = current.thigh_right_cm - previous.thigh_right_cm
  }

  return delta
}

/**
 * Получить метрики за период
 */
export async function getMetricsInRange(
  startDate: string,
  endDate: string
): Promise<ClientMetric[]> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', user.id)
    .gte('measured_at', startDate)
    .lte('measured_at', endDate)
    .order('measured_at', { ascending: true })

  if (error) {
    console.error('Error fetching metrics in range:', error)
    throw error
  }

  return data || []
}

/**
 * Получить статистику за период
 */
export async function getMetricsStats(
  startDate: string,
  endDate: string
): Promise<{
  count: number
  avgWeight?: number
  avgBodyFat?: number
  avgSleep?: number
  avgStress?: number
  totalDelta?: MetricsDelta
}> {
  const metrics = await getMetricsInRange(startDate, endDate)
  
  if (metrics.length === 0) {
    return { count: 0 }
  }

  const stats = {
    count: metrics.length,
    avgWeight: 0,
    avgBodyFat: 0,
    avgSleep: 0,
    avgStress: 0,
    totalDelta: {} as MetricsDelta,
  }

  let weightSum = 0, weightCount = 0
  let bodyFatSum = 0, bodyFatCount = 0
  let sleepSum = 0, sleepCount = 0
  let stressSum = 0, stressCount = 0

  metrics.forEach((metric) => {
    if (metric.weight_kg) {
      weightSum += metric.weight_kg
      weightCount++
    }
    if (metric.body_fat_pct) {
      bodyFatSum += metric.body_fat_pct
      bodyFatCount++
    }
    if (metric.sleep_hours) {
      sleepSum += metric.sleep_hours
      sleepCount++
    }
    if (metric.stress_level) {
      stressSum += metric.stress_level
      stressCount++
    }
  })

  if (weightCount > 0) stats.avgWeight = weightSum / weightCount
  if (bodyFatCount > 0) stats.avgBodyFat = bodyFatSum / bodyFatCount
  if (sleepCount > 0) stats.avgSleep = sleepSum / sleepCount
  if (stressCount > 0) stats.avgStress = stressSum / stressCount

  // Дельта между первой и последней метрикой
  if (metrics.length >= 2) {
    const first = metrics[0]
    const last = metrics[metrics.length - 1]
    stats.totalDelta = calculateDelta(last, first)
  }

  return stats
}

/**
 * Получить фото прогресса для сравнения
 */
export async function getProgressPhotos(
  type: 'front' | 'side' | 'back'
): Promise<Array<{ date: string; url: string }>> {
  const metrics = await getMyMetrics()
  
  return metrics
    .filter((m) => m[`photo_${type}`])
    .map((m) => ({
      date: m.measured_at,
      url: m[`photo_${type}`]!,
    }))
}
