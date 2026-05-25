// PATCH/DELETE /api/admin/nutrition-programs/[planId]
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, ctx: { params: { planId: string } }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { planId } = ctx.params
    const body = await request.json().catch(() => ({}))

    const updates: Record<string, any> = {}
    if (typeof body.plan_md === 'string') updates.plan_md = body.plan_md
    if (body.plan_data) updates.plan_data = body.plan_data
    if (typeof body.title === 'string') updates.title = body.title
    if (typeof body.start_date === 'string') updates.start_date = body.start_date
    if (typeof body.end_date === 'string') updates.end_date = body.end_date
    updates.updated_at = new Date().toISOString()

    const { data, error } = await auth.service
        .from('nutrition_programs')
        .update(updates)
        .eq('id', planId)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plan: data })
}

export async function DELETE(request: NextRequest, ctx: { params: { planId: string } }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { planId } = ctx.params
    const { error } = await auth.service
        .from('nutrition_programs')
        .delete()
        .eq('id', planId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
