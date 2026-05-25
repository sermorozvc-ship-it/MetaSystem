// GET /api/messages/conversation
//
// Возвращает переписку текущего пользователя с тренером.
// Если параметр ?clientId=... передан и пользователь сам тренер/админ,
// возвращает переписку тренера с этим клиентом.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const service = getServiceClient()
    const { data: { user }, error: authError } = await service.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const url = new URL(request.url)
    const clientIdParam = url.searchParams.get('clientId')

    let peerId: string

    if (clientIdParam) {
        // Если запрашивает переписку с конкретным клиентом — должен быть тренер/админ
        const { data: profile } = await service
            .from('profiles').select('role').eq('id', user.id).single()
        const isTrainer = user.id === TRAINER_ID
            || ['admin', 'trainer', 'curator'].includes(profile?.role || '')
        if (!isTrainer) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
        peerId = clientIdParam
    } else {
        // Иначе — переписка текущего пользователя с тренером
        peerId = user.id === TRAINER_ID ? TRAINER_ID : TRAINER_ID
    }

    // Если пользователь сам тренер и без clientId — отдаём пусто (нечего смотреть)
    if (user.id === TRAINER_ID && !clientIdParam) {
        return NextResponse.json({ messages: [] })
    }

    const meId = clientIdParam ? TRAINER_ID : user.id
    const otherId = clientIdParam ? clientIdParam : TRAINER_ID

    const { data, error } = await service
        .from('admin_messages')
        .select('*')
        .or(`and(from_user_id.eq.${meId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${meId})`)
        .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: data || [] })
}
