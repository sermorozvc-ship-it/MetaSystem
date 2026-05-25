// GET /api/admin/clients/[userId]/payment — последний confirmed платёж клиента
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const { data, error } = await auth.service
        .from('payments')
        .select('plan_type, plan_months, confirmed_at, status, includes_nutrition')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payment: data })
}
