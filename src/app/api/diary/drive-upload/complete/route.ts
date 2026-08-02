import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { makeFilePublic, findFileByName } from '@/lib/services/google-drive-upload'

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Сервер не настроен' }, { status: 500 })
    }

    const adminClient = createSupabaseAdmin(url, serviceKey, {
      auth: { persistSession: false },
    })

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { fileId, clientFolderId, driveFileName } = body

    let resolvedFileId = fileId
    if (!resolvedFileId && clientFolderId && driveFileName) {
      resolvedFileId = await findFileByName(driveFileName, clientFolderId)
    }

    if (!resolvedFileId) {
      return NextResponse.json({ error: 'Файл не найден на Google Drive' }, { status: 404 })
    }

    const publicUrl = await makeFilePublic(resolvedFileId)
    return NextResponse.json({ url: publicUrl })
  } catch (e: any) {
    console.error('[diary/drive-upload/complete]', e)
    return NextResponse.json({ error: e?.message || 'Ошибка сервера' }, { status: 500 })
  }
}
