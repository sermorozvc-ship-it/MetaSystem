import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getDriveAuth } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const maxDuration = 60

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

async function streamUpload(formData: FormData, user: any) {
  const file = formData.get('file')
  const testId = String(formData.get('testId') || '')
  const slot = String(formData.get('slot') || '0')
  const clientName = String(formData.get('clientName') || '').trim()

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

  const ALLOWED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi', 'video/x-matroska']
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Неподдерживаемый формат видео' }, { status: 400 })
  }

  const { drive } = getDriveAuth()
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootFolderId) {
    return NextResponse.json({ error: 'Google Drive folder not configured' }, { status: 500 })
  }

  const userFolderId = await findOrCreateFolder(drive, user.id, rootFolderId)
  const clientFolderId = await findOrCreateFolder(drive, clientName.trim(), userFolderId)

  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
  const storedFileName = `test-${testId}-slot${parseInt(slot, 10) || 0}_${Date.now()}.${ext}`

  const { Readable } = require('stream') as typeof import('stream')
  const nodeStream = Readable.fromWeb(file.stream() as any)

  const uploadedFile = await drive.files.create({
    requestBody: {
      name: storedFileName,
      parents: [clientFolderId],
    },
    media: {
      mimeType: file.type || 'video/mp4',
      body: nodeStream,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  } as any)

  if (!uploadedFile.data.id) {
    return NextResponse.json({ error: 'Ошибка загрузки в Google Drive' }, { status: 500 })
  }

  await drive.permissions.create({
    fileId: uploadedFile.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  const { data: fileData } = await drive.files.get({
    fileId: uploadedFile.data.id,
    fields: 'webViewLink',
    supportsAllDrives: true,
  })

  const viewUrl = fileData?.webViewLink || `https://drive.google.com/file/d/${uploadedFile.data.id}/view`

  const slotNum = parseInt(slot, 10) || 0
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  if (serviceKey && testIdNum >= 1 && testIdNum <= 7 && clientName) {
    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: existing } = await admin
      .from('screenings')
      .select('id, video_urls, video_url')
      .eq('user_id', user.id)
      .eq('test_id', String(testIdNum))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const urls: string[] = Array.isArray(existing.video_urls) ? [...existing.video_urls] : existing.video_url ? [existing.video_url] : []
      urls[slotNum] = viewUrl
      await admin.from('screenings').update({ video_urls: urls, client_contact: clientName.trim() }).eq('id', existing.id)
    } else {
      const urls: string[] = []
      urls[slotNum] = viewUrl
      await admin.from('screenings').insert({ user_id: user.id, test_id: String(testIdNum), video_urls: urls, client_contact: clientName.trim() })
    }
  }

  return NextResponse.json({ url: viewUrl })
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

    const formData = await request.formData()
    return await streamUpload(formData, user)
  } catch (e: any) {
    console.error('[API screening/upload-video] error:', e)
    return NextResponse.json({ error: e?.message || 'Неизвестная ошибка' }, { status: 500 })
  }
}
