import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/**
 * POST /api/questionnaire/upload-photo
 *
 * Загружает фото анкеты в bucket 'client-photos' через service-role.
 * Принимает multipart/form-data с полями `file` и `type` (front|side|back).
 *
 * Зачем серверный роут: см. /api/questionnaire/save — те же причины.
 * Прямой upload через supabase.storage из браузера в инкогнито часто
 * виснет на инициализации мультипарта (CORS preflight + auth lock),
 * и кнопка «Завершить» остаётся в состоянии «Загрузка фото...».
 */
export const runtime = 'nodejs'

// Vercel: разрешаем тело до 10MB (наш лимит bucket'а)
export const maxDuration = 30

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
        const type = String(form.get('type') || '')

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
        }
        if (!['front', 'side', 'back'].includes(type)) {
            return NextResponse.json({ error: 'Неверный тип фото' }, { status: 400 })
        }

        // 10MB лимит на стороне роута (bucket тоже ограничен)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Файл слишком большой (макс. 10MB)' },
                { status: 413 },
            )
        }

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/questionnaire/${type}_${Date.now()}.${ext}`
        const buffer = Buffer.from(await file.arrayBuffer())

        const { data, error } = await adminClient.storage
            .from('client-photos')
            .upload(path, buffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type || 'image/jpeg',
            })

        if (error) {
            console.error('[API questionnaire/upload-photo] storage error:', error)
            return NextResponse.json({ error: 'Ошибка загрузки: ' + error.message }, { status: 500 })
        }

        const { data: pub } = adminClient.storage
            .from('client-photos')
            .getPublicUrl(data.path)

        return NextResponse.json({ url: pub.publicUrl })
    } catch (e: any) {
        console.error('[API questionnaire/upload-photo] error:', e)
        return NextResponse.json(
            { error: e?.message || 'Неизвестная ошибка' },
            { status: 500 },
        )
    }
}
