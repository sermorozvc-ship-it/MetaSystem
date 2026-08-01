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
  onProgress?.({ loaded: 0, total: file.size, percent: 0 })

  // 1. Создаём resumable upload session на Google Drive (через наш API)
  const tokenData = await getAccessTokenWithRecovery()
  if (!tokenData.token) throw new Error('Сессия истекла. Перезайдите.')

  const initRes = await fetch('/api/screening/drive-upload/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'video/mp4',
      clientName,
      testId,
      slot,
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err.error || `Ошибка инициализации загрузки: ${initRes.status}`)
  }

  const { uploadUrl } = await initRes.json()

  // 2. Загружаем файл напрямую на Google Drive (Vercel не блокирует)
  const uploadResult = await new Promise<{ fileId: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        onProgress?.({ loaded: e.loaded, total: e.total, percent })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Пробуем получить file ID из body
        if (xhr.responseText) {
          try {
            const resp = JSON.parse(xhr.responseText)
            if (resp.id) {
              resolve({ fileId: resp.id })
              return
            }
          } catch {}
        }
        // Если body пустой — пробуем из заголовка Location
        const location = xhr.getResponseHeader('Location')
        if (location) {
          const match = location.match(/\/([^/]+)\?/)
          if (match) {
            resolve({ fileId: match[1] })
            return
          }
        }
        reject(new Error('Google Drive загрузил файл, но не вернул ID. Статус: ' + xhr.status))
      } else {
        reject(new Error(`Ошибка загрузки на Google Drive: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = (e) => {
      // onerror может сработать после успешной загрузки из-за CORS
      // Проверяем — если прогресс был 100%, считаем успешной
      reject(new Error('Ошибка сети при загрузке на Google Drive'))
    }
    xhr.onabort = () => reject(new Error('Загрузка отменена'))
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки на Google Drive'))

    xhr.timeout = 300_000 // 5 минут
    xhr.send(file)
  })

  // 3. Делаем файл публичным и получаем ссылку
  const completeRes = await fetch('/api/screening/drive-upload/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
    body: JSON.stringify({ fileId: uploadResult.fileId }),
  })

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}))
    throw new Error(err.error || `Ошибка публикации файла: ${completeRes.status}`)
  }

  const { url } = await completeRes.json()

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 })

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
