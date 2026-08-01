import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createResumableUploadSession } from '@/lib/services/google-drive-upload'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { fileName, fileSize, mimeType, clientName, testId, slot } = body

    if (!fileName || !fileSize || !mimeType || !clientName || testId == null || slot == null) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const { uploadUrl } = await createResumableUploadSession({
      fileName,
      fileSize,
      mimeType,
      clientName,
      userId: user.id,
      testId,
      slot,
    })

    return NextResponse.json({ uploadUrl })
  } catch (e: any) {
    console.error('[drive-upload/init]', e)
    return NextResponse.json({ error: e?.message || 'Ошибка сервера' }, { status: 500 })
  }
}
