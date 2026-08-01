import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getDriveAuth } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const maxDuration = 30

async function findOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`
  const res = await drive.files.list({ q, fields: 'files(id)', pageSize: 1, supportsAllDrives: true, includeItemsFromAllDrives: true })
  if (res.data.files?.[0]?.id) return res.data.files[0].id

  const createRes = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  })
  if (!createRes.data.id) throw new Error('Ошибка создания папки в Google Drive')
  return createRes.data.id
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Сервер не настроен' }, { status: 500 })
    }

    const adminClient = createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false } })

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await request.json()
    const { fileName, mimeType, fileSize, testId, slot, clientName } = body

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json({ error: 'Не переданы метаданные файла' }, { status: 400 })
    }
    if (!clientName?.trim()) {
      return NextResponse.json({ error: 'Имя клиента не указано' }, { status: 400 })
    }

    const testIdNum = parseInt(String(testId), 10)
    if (isNaN(testIdNum) || testIdNum < 1 || testIdNum > 7) {
      return NextResponse.json({ error: 'Неверный номер теста' }, { status: 400 })
    }

    if (fileSize > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 100MB)' }, { status: 413 })
    }

    const ALLOWED_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi', 'video/x-matroska']
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'Неподдерживаемый формат видео' }, { status: 400 })
    }

    const { drive, auth } = getDriveAuth()
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!rootFolderId) {
      return NextResponse.json({ error: 'Google Drive folder not configured' }, { status: 500 })
    }

    const userFolderId = await findOrCreateFolder(drive, user.id, rootFolderId)
    const clientFolderId = await findOrCreateFolder(drive, clientName.trim(), userFolderId)

    const ext = (fileName.split('.').pop() || 'mp4').toLowerCase()
    const storedFileName = `test-${testId}-slot${parseInt(String(slot), 10) || 0}_${Date.now()}.${ext}`

    const tokenResponse = await auth.authorize()
    const accessToken = tokenResponse.access_token

    const sessionRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(fileSize),
          'X-Upload-Content-Type': mimeType,
        },
        body: JSON.stringify({
          name: storedFileName,
          parents: [clientFolderId],
        }),
      }
    )

    if (!sessionRes.ok) {
      const errText = await sessionRes.text()
      console.error('[init] Drive resumable session failed:', sessionRes.status, errText)
      return NextResponse.json({ error: `Drive error ${sessionRes.status}: ${errText}` }, { status: 500 })
    }

    const uploadUrl = sessionRes.headers.get('Location')
    if (!uploadUrl) {
      return NextResponse.json({ error: 'Не получен URL загрузки' }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl, storedFileName })
  } catch (e: any) {
    console.error('[API screening/upload-video/init] error:', e)
    return NextResponse.json({ error: e?.message || 'Неизвестная ошибка' }, { status: 500 })
  }
}
