import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { makeFilePublic } from '@/lib/services/google-drive-upload'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { fileId } = body

    if (!fileId) {
      return NextResponse.json({ error: 'fileId не передан' }, { status: 400 })
    }

    const url = await makeFilePublic(fileId)
    return NextResponse.json({ url })
  } catch (e: any) {
    console.error('[drive-upload/complete]', e)
    return NextResponse.json({ error: e?.message || 'Ошибка сервера' }, { status: 500 })
  }
}
