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
  const safeName = clientName
    .normalize('NFD')
    .replace(/[\u0400-\u04FF]/g, (ch) => {
      const map: Record<string, string> = { 'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya','а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' }
      return map[ch] || ch
    })
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const path = `${user.id}/${safeName}/test-${testId}-slot${slot}_${Date.now()}.${ext}`

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
