// GET /api/admin/programs/[programId]/checkin — ответы клиента на недельный чек-ин
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { programId } = await ctx.params
    const { data, error } = await auth.service
        .from('weekly_checkins')
        .select('*')
        .eq('program_id', programId)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ checkin: data || null })
}
