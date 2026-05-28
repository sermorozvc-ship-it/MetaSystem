import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/**
 * POST /api/questionnaire/save
 *
 * Сохраняет анкету клиента (upsert по user_id).
 *
 * Зачем серверный роут вместо прямого supabase-js из браузера:
 * - На клиенте Supabase JS использует кастомный inTabLock + auto-refresh
 *   JWT, и при большом payload (анкета с 30+ полями) на флапающей сети
 *   запрос мог висеть >15с и обрываться по таймауту.
 * - Блокировщики в инкогнито/расширения иногда режут XHR к
 *   *.supabase.co, но не к собственному домену Vercel.
 * - Серверный роут идёт на тот же origin, без CORS, без клиентского
 *   lock'а, без refresh JWT в середине запроса.
 *
 * Авторизация: Bearer-токен из заголовка (берём session.access_token
 * на клиенте). Сервер проверяет токен через getUser, дальше использует
 * service-role клиент для upsert (он не зависит от пользовательской
 * сессии и не задерживается на RLS).
 */
export async function POST(request: NextRequest) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

        if (!url || !serviceKey) {
            console.error('[API questionnaire/save] missing env vars')
            return NextResponse.json({ error: 'Сервер не настроен' }, { status: 500 })
        }

        const adminClient = createSupabaseAdmin(url, serviceKey, {
            auth: { persistSession: false },
        })

        // 1. Авторизация: токен пользователя
        const authHeader = request.headers.get('authorization') || ''
        const token = authHeader.replace('Bearer ', '').trim()

        if (!token) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        // 2. Тело запроса
        const body = await request.json().catch(() => ({}))
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Неверное тело запроса' }, { status: 400 })
        }

        // 3. Собираем payload — берём только не-null/не-undefined поля
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

        // 4. Upsert — service-role обходит RLS, поэтому быстрый
        const { data, error } = await adminClient
            .from('client_questionnaires')
            .upsert(payload, { onConflict: 'user_id' })
            .select()
            .single()

        if (error) {
            console.error('[API questionnaire/save] DB error:', error)
            return NextResponse.json({ error: 'Ошибка БД: ' + error.message }, { status: 500 })
        }

        // 5. Помечаем профиль как заполненный (fire-and-forget внутри роута,
        // но Vercel держит, так что просто дожидаемся)
        await adminClient
            .from('profiles')
            .update({ questionnaire_completed: true })
            .eq('id', user.id)

        return NextResponse.json({ data })
    } catch (e: any) {
        console.error('[API questionnaire/save] error:', e)
        return NextResponse.json(
            { error: e?.message || 'Неизвестная ошибка' },
            { status: 500 },
        )
    }
}
