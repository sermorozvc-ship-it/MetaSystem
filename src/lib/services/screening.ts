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

  const authHeaders = { Authorization: `Bearer ${token}` }

  const initRes = await fetch('/api/screening/upload-video/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'video/mp4',
      fileSize: file.size,
      testId,
      slot,
      clientName,
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({ error: `HTTP ${initRes.status}` }))
    throw new Error(err.error || `Ошибка инициализации: HTTP ${initRes.status}`)
  }

  const { uploadUrl } = await initRes.json()

  const fileResponse = await new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.responseType = 'text'

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
      resolve(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText }))
    }
    xhr.onerror = () => reject(new Error('Ошибка сети при загрузке в Google Drive'))
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки'))
    xhr.timeout = 300_000

    xhr.send(file)
  })

  if (!fileResponse.ok) {
    const errText = await fileResponse.text().catch(() => '')
    console.error('[uploadScreeningVideo] Drive PUT failed:', fileResponse.status, errText)
    throw new Error(`Ошибка загрузки в Google Drive: HTTP ${fileResponse.status}`)
  }

  let fileId: string | null = null
  try {
    const driveBody = JSON.parse(await fileResponse.text())
    fileId = driveBody.id || null
  } catch {
    const loc = fileResponse.headers.get('Location') || ''
    const match = loc.match(/\/files\/([^?/]+)/)
    if (match) fileId = match[1]
  }

  if (!fileId) {
    throw new Error('Не удалось получить ID загруженного файла')
  }

  const completeRes = await fetch('/api/screening/upload-video/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ fileId, testId, slot, clientName }),
  })

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({ error: `HTTP ${completeRes.status}` }))
    throw new Error(err.error || `Ошибка финализации: HTTP ${completeRes.status}`)
  }

  const { url } = await completeRes.json()
  return { url }
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
