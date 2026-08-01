import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createResumableUploadSession } from '@/lib/services/google-drive-upload'

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
    const { fileName, fileSize, mimeType, clientName, testId, slot } = body

    if (!fileName || !fileSize || !mimeType || !clientName || testId == null || slot == null) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const session = await createResumableUploadSession({
      fileName,
      fileSize,
      mimeType,
      clientName,
      userId: user.id,
      testId,
      slot,
    })

    return NextResponse.json({
      uploadUrl: session.uploadUrl,
      clientFolderId: session.clientFolderId,
      driveFileName: session.fileName,
    })
  } catch (e: any) {
    console.error('[drive-upload/init]', e)
    return NextResponse.json({ error: e?.message || 'Ошибка сервера' }, { status: 500 })
  }
}
