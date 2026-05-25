// PATCH/DELETE /api/admin/programs/[programId]
//   PATCH — редактирование programs (program_md / program_data / даты)
//   DELETE — удаление программы
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, ctx: { params: { programId: string } }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { programId } = ctx.params
    const body = await request.json().catch(() => ({}))

    const updates: Record<string, any> = {}
    if (typeof body.program_md === 'string') updates.program_md = body.program_md
    if (body.program_data) updates.program_data = body.program_data
    if (typeof body.start_date === 'string') updates.start_date = body.start_date
    if (typeof body.end_date === 'string') updates.end_date = body.end_date
    if (typeof body.training_days_count === 'number') updates.training_days_count = body.training_days_count
    updates.updated_at = new Date().toISOString()

    const { data, error } = await auth.service
        .from('training_programs')
        .update(updates)
        .eq('id', programId)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ program: data })
}

export async function DELETE(request: NextRequest, ctx: { params: { programId: string } }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { programId } = ctx.params
    const { error } = await auth.service
        .from('training_programs')
        .delete()
        .eq('id', programId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
