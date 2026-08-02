import { getAccessTokenWithRecovery } from '@/lib/supabase/client'

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

/**
 * Загружает видео техники упражнения на Google Drive.
 * Структура папок: ROOT / userId / clientName / diary_week{N}_day{M}/
 * Имя файла формируется на сервере на основе clientName + folderSuffix + timestamp.
 */
export async function uploadDiaryVideo(
  file: File,
  exerciseName: string,
  programWeek: number,
  dayNumber: number,
  clientName: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ url: string }> {
  onProgress?.({ loaded: 0, total: file.size, percent: 0 })

  const tokenData = await getAccessTokenWithRecovery()
  if (!tokenData.token) throw new Error('Сессия истекла. Перезайдите.')

  // 1. Создаём resumable upload session
  const initRes = await fetch('/api/diary/drive-upload/init', {
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
      programWeek,
      dayNumber,
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err.error || `Ошибка инициализации загрузки: ${initRes.status}`)
  }

  const { uploadUrl, clientFolderId, driveFileName } = await initRes.json()

  // 2. Загружаем файл напрямую на Google Drive (XHR с прогрессом)
  let fileId: string | null = null

  await new Promise<void>((resolve, reject) => {
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
        if (xhr.responseText) {
          try {
            const resp = JSON.parse(xhr.responseText)
            if (resp.id) fileId = resp.id
          } catch {}
        }
        if (!fileId) {
          const location = xhr.getResponseHeader('Location')
          if (location) {
            const match = location.match(/\/([^/]+)\?/)
            if (match) fileId = match[1]
          }
        }
        resolve()
      } else {
        reject(new Error(`Ошибка загрузки на Google Drive: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => resolve()
    xhr.onabort = () => reject(new Error('Загрузка отменена'))
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки на Google Drive'))

    xhr.timeout = 300_000
    xhr.send(file)
  })

  // 3. Делаем файл публичным и получаем ссылку
  const completeRes = await fetch('/api/diary/drive-upload/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
    body: JSON.stringify({ fileId, clientFolderId, driveFileName }),
  })

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}))
    throw new Error(err.error || `Ошибка публикации файла: ${completeRes.status}`)
  }

  const { url } = await completeRes.json()

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 })

  return { url }
}
