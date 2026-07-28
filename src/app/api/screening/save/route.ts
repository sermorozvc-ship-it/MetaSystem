import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/**
 * POST /api/screening/save
 *
 * Сохраняет результат скрининга клиента (upsert по user_id).
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
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Неверное тело запроса' }, { status: 400 })
        }

        const payload: Record<string, any> = {
            user_id: user.id,
            updated_at: new Date().toISOString(),
        }
        for (const [key, value] of Object.entries(body)) {
            if (key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') continue
            if (value !== undefined && value !== null) {
                payload[key] = value
            }
        }

        const { data, error } = await adminClient
            .from('client_screenings')
            .upsert(payload, { onConflict: 'user_id' })
            .select()
            .single()

        if (error) {
            console.error('[API screening/save] DB error:', error)
            return NextResponse.json({ error: 'Ошибка БД: ' + error.message }, { status: 500 })
        }

        await adminClient
            .from('profiles')
            .update({ screening_completed: true })
            .eq('id', user.id)

        return NextResponse.json({ data })
    } catch (e: any) {
        console.error('[API screening/save] error:', e)
        return NextResponse.json(
            { error: e?.message || 'Неизвестная ошибка' },
            { status: 500 },
        )
    }
}
