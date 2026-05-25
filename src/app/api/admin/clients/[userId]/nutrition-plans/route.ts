// GET /api/admin/clients/[userId]/nutrition-plans — список планов питания клиента
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: { userId: string } }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = ctx.params
    const { data, error } = await auth.service
        .from('nutrition_programs')
        .select('*')
        .eq('user_id', userId)
        .order('plan_number', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plans: data || [] })
}
