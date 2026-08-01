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
  const { token, status } = await getAccessTokenWithRecovery()
  if (!token) {
    if (status === 'expired' || status === 'refresh_failed') {
      throw new Error('Сессия истекла. Перезайдите.')
    }
    throw new Error('Не удалось определить пользователя. Перезайдите.')
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('testId', String(testId))
    formData.append('slot', String(slot))
    formData.append('clientName', clientName)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/screening/upload-video')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        })
      }
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response)
        } else {
          reject(new Error(response.error || `HTTP ${xhr.status}`))
        }
      } catch {
        reject(new Error(`HTTP ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Ошибка сети'))
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки'))
    xhr.timeout = 300_000

    xhr.send(formData)
  })
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
