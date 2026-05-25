// GET /api/messages/clients — для тренера: список клиентов с непрочитанными
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

    const { data: profile } = await service
        .from('profiles').select('role').eq('id', user.id).single()
    const isTrainer = user.id === TRAINER_ID
        || ['admin', 'trainer', 'curator'].includes(profile?.role || '')
    if (!isTrainer) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })

    const { data, error } = await service
        .from('admin_messages')
        .select('from_user_id, to_user_id, message, created_at, is_read')
        .or(`from_user_id.eq.${TRAINER_ID},to_user_id.eq.${TRAINER_ID}`)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const clientMap = new Map<string, { lastMessage: string; lastDate: string; unread: number }>()
    for (const msg of (data || [])) {
        const clientId = msg.from_user_id === TRAINER_ID ? msg.to_user_id : msg.from_user_id
        if (!clientId || clientId === TRAINER_ID) continue
        if (!clientMap.has(clientId)) {
            clientMap.set(clientId, {
                lastMessage: msg.message,
                lastDate: msg.created_at,
                unread: 0,
            })
        }
        if (msg.from_user_id === clientId && !msg.is_read) {
            clientMap.get(clientId)!.unread++
        }
    }

    return NextResponse.json({
        clients: Array.from(clientMap.entries()).map(([userId, v]) => ({ userId, ...v })),
    })
}
