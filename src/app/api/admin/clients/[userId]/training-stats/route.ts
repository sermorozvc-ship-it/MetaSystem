// GET /api/admin/clients/[userId]/training-stats — программы и записи клиента (для AdminExerciseStats)
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const [progsRes, entriesRes] = await Promise.all([
        auth.service
            .from('training_programs')
            .select('*')
            .eq('user_id', userId)
            .order('week_number', { ascending: true }),
        auth.service
            .from('training_entries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),
    ])

    if (progsRes.error) return NextResponse.json({ error: progsRes.error.message }, { status: 500 })
    if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 })

    return NextResponse.json({
        programs: progsRes.data || [],
        entries: entriesRes.data || [],
    })
}
