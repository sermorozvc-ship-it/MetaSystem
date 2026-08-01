import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const runtime = 'nodejs'
export const maxDuration = 30

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google Drive credentials not configured')
  const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive.file'] })
  return google.drive({ version: 'v3', auth })
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
    const { fileId, testId, slot, clientName } = body

    if (!fileId) {
      return NextResponse.json({ error: 'fileId не передан' }, { status: 400 })
    }

    const drive = getDriveClient()

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    const { data: fileData } = await drive.files.get({
      fileId,
      fields: 'webViewLink',
    })

    const viewUrl = fileData?.webViewLink || `https://drive.google.com/file/d/${fileId}/view`

    const testIdNum = parseInt(String(testId), 10)
    const slotNum = parseInt(String(slot), 10) || 0

    if (testIdNum >= 1 && testIdNum <= 7 && clientName?.trim()) {
      const testIdStr = String(testIdNum)
      const { data: existing } = await adminClient
        .from('screenings')
        .select('id, video_urls, video_url')
        .eq('user_id', user.id)
        .eq('test_id', testIdStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const urls: string[] = Array.isArray(existing.video_urls) ? [...existing.video_urls] : existing.video_url ? [existing.video_url] : []
        urls[slotNum] = viewUrl
        await adminClient
          .from('screenings')
          .update({ video_urls: urls, client_contact: clientName.trim() })
          .eq('id', existing.id)
      } else {
        const urls: string[] = []
        urls[slotNum] = viewUrl
        await adminClient
          .from('screenings')
          .insert({
            user_id: user.id,
            test_id: testIdStr,
            video_urls: urls,
            client_contact: clientName.trim(),
          })
      }
    }

    return NextResponse.json({ url: viewUrl })
  } catch (e: any) {
    console.error('[API screening/upload-video/complete] error:', e)
    return NextResponse.json({ error: e?.message || 'Неизвестная ошибка' }, { status: 500 })
  }
}
