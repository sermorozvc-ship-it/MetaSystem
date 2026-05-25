// GET /api/admin/programs/[programId]/entries — все записи дневника по программе
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: { programId: string } }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { programId } = ctx.params
    const { data, error } = await auth.service
        .from('training_entries')
        .select('*')
        .eq('program_id', programId)
        .order('day_number', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entries: data || [] })
}
