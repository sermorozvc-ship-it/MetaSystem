import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { extractFileIdFromUrl, deleteFile, deleteFolderIfEmpty, getFileParentFolderId } from '@/lib/services/google-drive-upload'

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

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    const body = await req.json()
    const { videoUrl, targetUserId, exerciseId, programId, dayNumber } = body

    if (!videoUrl || !targetUserId || !exerciseId || !programId || dayNumber == null) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // ─── 1. Сначала обновляем БД ─────────────────────────────────────────────
    const { data: entry, error: fetchError } = await adminClient
      .from('training_entries')
      .select('entry_data')
      .eq('program_id', programId)
      .eq('day_number', dayNumber)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (fetchError) {
      console.error('[diary/drive-upload/delete] DB fetch error:', fetchError)
      return NextResponse.json({ error: 'Ошибка чтения записи: ' + fetchError.message }, { status: 500 })
    }

    if (!entry) {
      return NextResponse.json({ error: 'Запись тренировки не найдена' }, { status: 404 })
    }

    const hasVideo = !!entry?.entry_data?.__exerciseVideos__?.[exerciseId]

    if (hasVideo) {
      const updatedEntryData = { ...entry.entry_data }
      const updatedVideos = { ...updatedEntryData.__exerciseVideos__ }
      delete updatedVideos[exerciseId]
      updatedEntryData.__exerciseVideos__ = updatedVideos

      const { error: updateError } = await adminClient
        .from('training_entries')
        .update({ entry_data: updatedEntryData, updated_at: new Date().toISOString() })
        .eq('program_id', programId)
        .eq('day_number', dayNumber)
        .eq('user_id', targetUserId)

      if (updateError) {
        console.error('[diary/drive-upload/delete] DB update error:', updateError)
        return NextResponse.json({ error: 'Ошибка обновления записи: ' + updateError.message }, { status: 500 })
      }
      console.log('[diary/drive-upload/delete] DB updated, video removed from entry_data')
    }

    // ─── 2. Потом удаляем с Google Drive (best-effort, не фейлим ответ) ──────
    const fileId = extractFileIdFromUrl(videoUrl)
    if (fileId) {
      try {
        const parentFolderId = await getFileParentFolderId(fileId)
        await deleteFile(fileId)
        console.log('[diary/drive-upload/delete] Google Drive file deleted:', fileId)

        if (parentFolderId) {
          const folderDeleted = await deleteFolderIfEmpty(parentFolderId)
          if (folderDeleted) console.log('[diary/drive-upload/delete] Empty folder deleted:', parentFolderId)
        }
      } catch (e: any) {
        console.error('[diary/drive-upload/delete] Google Drive delete failed (non-critical):', e?.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[diary/drive-upload/delete]', e)
    return NextResponse.json({ error: e?.message || 'Ошибка сервера' }, { status: 500 })
  }
}
