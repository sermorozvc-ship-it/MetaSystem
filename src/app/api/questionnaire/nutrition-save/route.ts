import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/**
 * POST /api/questionnaire/nutrition-save
 *
 * Сохраняет анкету по питанию через серверный роут.
 * Причины см. в /api/questionnaire/save.
 */
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

        const authHeader = request.headers.get('authorization') || ''
        const token = authHeader.replace('Bearer ', '').trim()
        if (!token) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const answers = body?.answers
        if (!answers || typeof answers !== 'object') {
            return NextResponse.json({ error: 'Неверное тело запроса' }, { status: 400 })
        }

        const payload = {
            user_id: user.id,
            answers,
            current_weight_kg: answers.current_weight_kg ?? null,
            height_cm: answers.height_cm ?? null,
            age: answers.age ?? null,
            gender: answers.gender ?? null,
            nutrition_goal: answers.nutrition_goal ?? null,
            diet_type: answers.diet_type ?? null,
            updated_at: new Date().toISOString(),
        }

        const { data, error } = await adminClient
            .from('client_nutrition_questionnaires')
            .upsert(payload, { onConflict: 'user_id' })
            .select()
            .single()

        if (error) {
            console.error('[API questionnaire/nutrition-save] DB error:', error)
            return NextResponse.json({ error: 'Ошибка БД: ' + error.message }, { status: 500 })
        }

        await adminClient
            .from('profiles')
            .update({ nutrition_questionnaire_completed: true })
            .eq('id', user.id)

        return NextResponse.json({ data })
    } catch (e: any) {
        console.error('[API questionnaire/nutrition-save] error:', e)
        return NextResponse.json(
            { error: e?.message || 'Неизвестная ошибка' },
            { status: 500 },
        )
    }
}
