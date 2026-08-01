import { getAccessTokenWithRecovery, createClient, safeGetUser } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/utils/with-timeout'

export interface ScreeningTestData {
  id: number
  title: string
  video_url: string
  video_urls?: string[]
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export async function uploadScreeningVideo(
  file: File,
  testId: number,
  slot: number,
  clientName: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ url: string }> {
  const user = await safeGetUser()
  if (!user) throw new Error('Не удалось определить пользователя. Перезайдите.')

  const supabase = createClient()

  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
  const path = `${user.id}/${clientName}/test-${testId}-slot${slot}_${Date.now()}.${ext}`

  onProgress?.({ loaded: 0, total: file.size, percent: 0 })

  const { data, error } = await supabase.storage
    .from('screening-videos')
    .upload(path, file, {
      contentType: file.type || 'video/mp4',
      upsert: false,
    })

  if (error) {
    console.error('[uploadScreeningVideo] Storage error:', error)
    throw new Error(error.message || 'Ошибка загрузки видео')
  }

  const { data: urlData } = supabase.storage
    .from('screening-videos')
    .getPublicUrl(data.path)

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 })

  return { url: urlData.publicUrl }
}

export interface ScreeningPayload {
  client_date: string
  client_contact: string
  tests: ScreeningTestData[]
}

export interface ScreeningRecord {
  id: string
  user_id: string
  client_date: string | null
  client_contact: string | null
  tests: ScreeningTestData[]
  created_at: string
  updated_at: string
}

export async function upsertScreening(payload: ScreeningPayload): Promise<ScreeningRecord> {
  const { token, status } = await getAccessTokenWithRecovery()
  if (!token) {
    if (status === 'expired' || status === 'refresh_failed') {
      throw new Error('Сессия истекла. Перезайдите.')
    }
    throw new Error('Не удалось определить пользователя. Перезайдите.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch('/api/screening/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const j = await res.json()
        if (j?.error) message = j.error
      } catch {}
      throw new Error('Ошибка сохранения: ' + message)
    }

    const j = await res.json()
    return j.data as ScreeningRecord
  } finally {
    clearTimeout(timeout)
  }
}

export async function isScreeningCompleted(): Promise<boolean> {
  const user = await safeGetUser()
  if (!user) return false

  const supabase = createClient()
  try {
    const { data } = await withTimeout<{ data: { id: string } | null; error: any }>(
      supabase
        .from('client_screenings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
      'isScreeningCompleted',
    )

    if (data) {
      void withTimeout<{ error: any }>(
        supabase
          .from('profiles')
          .update({ screening_completed: true })
          .eq('id', user.id),
        'isScreeningCompleted:updateProfile',
      ).catch(() => {})
      return true
    }
    return false
  } catch (e) {
    console.error('[Screening] isScreeningCompleted timeout/network:', e)
    return false
  }
}
