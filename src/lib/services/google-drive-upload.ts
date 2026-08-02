import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

let driveClient: drive_v3.Drive | null = null

function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive OAuth2 не настроен. Нужны GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN')
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })

  driveClient = google.drive({ version: 'v3', auth })
  return driveClient
}

function transliterate(str: string): string {
  const map: Record<string, string> = {
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
  }
  return str
    .normalize('NFD')
    .replace(/[\u0400-\u04FF]/g, (ch) => map[ch] || ch)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const drive = getDrive()
  const safeName = transliterate(name)
  const q = `name='${safeName.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`

  const { data } = await drive.files.list({
    q,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  if (data.files && data.files.length > 0) return data.files[0].id!

  const { data: created } = await drive.files.create({
    requestBody: { name: safeName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.id!
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google OAuth2 не настроен')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error('Не удалось получить access token')
  const data = await res.json()
  return data.access_token
}

/**
 * Создаёт resumable upload session на Google Drive.
 * Клиент загружает файл напрямую на Google по uploadUrl (Vercel не блокирует).
 * После загрузки Google возвращает file ID в response body.
 */
export async function createResumableUploadSession(params: {
  fileName: string
  fileSize: number
  mimeType: string
  clientName: string
  userId: string
  testId: number
  slot: number
}): Promise<{ uploadUrl: string; clientFolderId: string; fileName: string }> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID не задан')

  const userFolder = await findOrCreateFolder(params.userId, rootFolderId)
  const clientFolder = await findOrCreateFolder(params.clientName, userFolder)

  const ext = params.fileName.split('.').pop() || 'mp4'
  const safeName = `${transliterate(params.clientName)}_test${params.testId}_slot${params.slot}_${Date.now()}.${ext}`
  const accessToken = await getAccessToken()

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
        'X-Upload-Content-Length': String(params.fileSize),
      },
      body: JSON.stringify({
        name: safeName,
        parents: [clientFolder],
        mimeType: params.mimeType,
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ошибка создания upload session: ${res.status} ${err}`)
  }

  const uploadUrl = res.headers.get('Location')
  if (!uploadUrl) throw new Error('Google не вернул upload URL')

  return { uploadUrl, clientFolderId: clientFolder, fileName: safeName }
}

/**
 * Универсальная версия createResumableUploadSession.
 * Принимает folderSuffix вместо testId/slot — подходит для дневника и любых других контекстов.
 * Структура папок: ROOT / userId / clientName / {folderSuffix}/
 * Имя файла: transliterate(clientName)_folderSuffix_timestamp.ext
 */
export async function createResumableUploadSessionV2(params: {
  fileName: string
  fileSize: number
  mimeType: string
  clientName: string
  userId: string
  folderSuffix: string
}): Promise<{ uploadUrl: string; clientFolderId: string; fileName: string }> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID не задан')

  const userFolder = await findOrCreateFolder(params.userId, rootFolderId)
  const clientFolder = await findOrCreateFolder(params.clientName, userFolder)
  const subFolder = await findOrCreateFolder(params.folderSuffix, clientFolder)

  const ext = params.fileName.split('.').pop() || 'mp4'
  const safeSuffix = transliterate(params.folderSuffix)
  const safeName = `${transliterate(params.clientName)}_${safeSuffix}_${Date.now()}.${ext}`
  const accessToken = await getAccessToken()

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
        'X-Upload-Content-Length': String(params.fileSize),
      },
      body: JSON.stringify({
        name: safeName,
        parents: [subFolder],
        mimeType: params.mimeType,
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ошибка создания upload session: ${res.status} ${err}`)
  }

  const uploadUrl = res.headers.get('Location')
  if (!uploadUrl) throw new Error('Google не вернул upload URL')

  return { uploadUrl, clientFolderId: subFolder, fileName: safeName }
}

/**
 * Ищет файл по имени в папке (fallback если ID не пришёл в ответе загрузки)
 */
export async function findFileByName(fileName: string, folderId: string): Promise<string | null> {
  const drive = getDrive()
  const q = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`

  const { data } = await drive.files.list({
    q,
    fields: 'files(id, createdTime)',
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  if (data.files && data.files.length > 0) return data.files[0].id!
  return null
}

/**
 * Делает файл публичным и возвращает ссылку
 */
export async function makeFilePublic(fileId: string): Promise<string> {
  const drive = getDrive()

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  const { data } = await drive.files.get({
    fileId,
    fields: 'webViewLink',
    supportsAllDrives: true,
  })

  return data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
}

/**
 * Извлекает file ID из Google Drive URL.
 * Поддерживает форматы:
 *   https://drive.google.com/file/d/{id}/view
 *   https://drive.google.com/open?id={id}
 */
export function extractFileIdFromUrl(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

/**
 * Удаляет файл с Google Drive по его ID.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive()
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
    enforceSingleParent: true,
  })
}

/**
 * Возвращает ID родительской папки файла (первый parent).
 */
export async function getFileParentFolderId(fileId: string): Promise<string | null> {
  const drive = getDrive()
  const { data } = await drive.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  })
  return data.parents?.[0] || null
}

/**
 * Проверяет, пуста ли папка на Google Drive, и если да — удаляет её.
 */
export async function deleteFolderIfEmpty(folderId: string): Promise<boolean> {
  const drive = getDrive()
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (data.files && data.files.length > 0) return false
  await drive.files.delete({
    fileId: folderId,
    supportsAllDrives: true,
    enforceSingleParent: true,
  })
  return true
}
