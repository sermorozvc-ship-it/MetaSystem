// GET /api/admin/clients/[userId]/programs
// Список тренировочных программ клиента (service_role, в обход RLS).
// Браузерный select через RLS/getClientPrograms часто отдавал [] при
// таймауте inTabLock/сессии — после F5 данные появлялись.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { data, error } = await auth.service
        .from('training_programs')
        .select('*')
        .eq('user_id', userId)
        .order('week_number', { ascending: false })

    if (error) {
        console.error('[admin/clients/programs]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ programs: data || [] })
}
