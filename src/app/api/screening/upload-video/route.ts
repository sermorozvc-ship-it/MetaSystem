import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/avi',
  'video/x-matroska',
]

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error('Google Drive credentials not configured')
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  return google.drive({ version: 'v3', auth })
}

async function findFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string): Promise<string | null> {
  const query = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`
  const res = await drive.files.list({
    q: query,
    fields: 'files(id)',
    pageSize: 1,
  })
  return res.data.files?.[0]?.id || null
}

async function createFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Ошибка создания папки в Google Drive')
  }
  return res.data.id
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Сервер не настроен' }, { status: 500 })
    }

    const adminClient = createSupabaseAdmin(url, serviceKey, {
      auth: { persistSession: false },
    })

    // Авторизация
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // FormData
    const form = await request.formData()
    const file = form.get('file')
    const testId = String(form.get('testId') || '')
    const slot = String(form.get('slot') || '0')
    const clientName = String(form.get('clientName') || '').trim()

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }

    if (!clientName) {
      return NextResponse.json({ error: 'Имя клиента не указано' }, { status: 400 })
    }

    const testIdNum = parseInt(testId, 10)
    if (!testId || isNaN(testIdNum) || testIdNum < 1 || testIdNum > 7) {
      return NextResponse.json({ error: 'Неверный номер теста' }, { status: 400 })
    }

    const slotNum = parseInt(slot, 10)
    if (isNaN(slotNum) || slotNum < 0 || slotNum > 1) {
      return NextResponse.json({ error: 'Неверный номер слота' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Файл слишком большой (макс. 100MB)' },
        { status: 413 },
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат видео. Используйте MP4, MOV, WebM или AVI.' },
        { status: 400 },
      )
    }

    // Загрузка в Google Drive
    const drive = getDriveClient()
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!rootFolderId) {
      return NextResponse.json({ error: 'Google Drive folder not configured' }, { status: 500 })
    }

    // Ищем или создаём папку пользователя {user_id}
    const userFolderName = user.id
    let userFolderId = await findFolder(drive, userFolderName, rootFolderId)
    if (!userFolderId) {
      userFolderId = await createFolder(drive, userFolderName, rootFolderId)
    }

    // Ищем или создаём папку с именем клиента {clientName}
    let clientFolderId = await findFolder(drive, clientName, userFolderId)
    if (!clientFolderId) {
      clientFolderId = await createFolder(drive, clientName, userFolderId)
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const fileName = `test-${testId}-slot${slotNum}_${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { data: uploadedFile } = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [clientFolderId],
      },
      media: {
        mimeType: file.type || 'video/mp4',
        body: require('stream').Readable.from(buffer),
      },
      fields: 'id, webViewLink, webContentLink',
    })

    if (!uploadedFile?.id) {
      return NextResponse.json({ error: 'Ошибка загрузки в Google Drive' }, { status: 500 })
    }

    // Делаем файл доступным по ссылке (для просмотра в браузере)
    await drive.permissions.create({
      fileId: uploadedFile.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    // Получаем публичную ссылку
    const { data: fileData } = await drive.files.get({
      fileId: uploadedFile.id,
      fields: 'webViewLink, webContentLink',
    })

    const viewUrl = fileData?.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view`

    return NextResponse.json({ url: viewUrl })
  } catch (e: any) {
    console.error('[API screening/upload-video] error:', e)
    return NextResponse.json(
      { error: e?.message || 'Неизвестная ошибка' },
      { status: 500 },
    )
  }
}
