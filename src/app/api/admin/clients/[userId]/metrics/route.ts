// GET /api/admin/clients/[userId]/metrics — последние замеры клиента
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const { data, error } = await auth.service
        .from('client_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ metrics: data || [] })
}
