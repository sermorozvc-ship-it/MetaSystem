import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getDriveAuth } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const chunks: Uint8Array[] = []
  let totalSize = 0

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
    if (isNaN(testIdNum) || testIdNum < 1 || testIdNum > 7) {
      return NextResponse.json({ error: 'Неверный номер теста' }, { status: 400 })
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 100MB)' }, { status: 413 })
    }

    const ALLOWED_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi', 'video/x-matroska']
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Неподдерживаемый формат видео' }, { status: 400 })
    }

    const { drive } = getDriveAuth()
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!rootFolderId) {
      return NextResponse.json({ error: 'Google Drive folder not configured' }, { status: 500 })
    }

    const userFolderName = user.id
    let userFolderId: string | null = null
    let clientFolderId: string | null = null

    const userQ = `name = '${userFolderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`
    const userRes = await drive.files.list({ q: userQ, fields: 'files(id)', pageSize: 1 })
    userFolderId = userRes.data.files?.[0]?.id || null

    if (!userFolderId) {
      const createRes = await drive.files.create({
        requestBody: { name: userFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
        fields: 'id',
      })
      userFolderId = createRes.data.id || null
    }
    if (!userFolderId) {
      return NextResponse.json({ error: 'Не удалось создать папку пользователя' }, { status: 500 })
    }

    const clientQ = `name = '${clientName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${userFolderId}' in parents and trashed = false`
    const clientRes = await drive.files.list({ q: clientQ, fields: 'files(id)', pageSize: 1 })
    clientFolderId = clientRes.data.files?.[0]?.id || null

    if (!clientFolderId) {
      const createRes = await drive.files.create({
        requestBody: { name: clientName, mimeType: 'application/vnd.google-apps.folder', parents: [userFolderId] },
        fields: 'id',
      })
      clientFolderId = createRes.data.id || null
    }
    if (!clientFolderId) {
      return NextResponse.json({ error: 'Не удалось создать папку клиента' }, { status: 500 })
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const storedFileName = `test-${testId}-slot${parseInt(slot, 10) || 0}_${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { Readable } = require('stream') as typeof import('stream')
    const fileStream = Readable.from(buffer)

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: storedFileName,
        parents: [clientFolderId],
      },
      media: {
        mimeType: file.type || 'video/mp4',
        body: fileStream,
      },
      fields: 'id, webViewLink, webContentLink',
    } as any)

    if (!uploadedFile.data.id) {
      return NextResponse.json({ error: 'Ошибка загрузки в Google Drive' }, { status: 500 })
    }

    await drive.permissions.create({
      fileId: uploadedFile.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    const { data: fileData } = await drive.files.get({
      fileId: uploadedFile.data.id,
      fields: 'webViewLink',
    })

    const viewUrl = fileData?.webViewLink || `https://drive.google.com/file/d/${uploadedFile.data.id}/view`

    return NextResponse.json({ url: viewUrl })
  } catch (e: any) {
    console.error('[API screening/upload-video] error:', e)
    return NextResponse.json(
      { error: e?.message || 'Неизвестная ошибка' },
      { status: 500 },
    )
  }
}
