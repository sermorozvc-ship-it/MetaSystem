// GET/PATCH /api/admin/clients/[userId]/programs-visible
//   GET   — текущее значение programs_visible
//   PATCH — переключить видимость программ для клиента
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const { data, error } = await auth.service
        .from('profiles')
        .select('programs_visible')
        .eq('id', userId)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ programs_visible: data?.programs_visible ?? true })
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const body = await request.json().catch(() => ({}))

    if (typeof body.programs_visible !== 'boolean') {
        return NextResponse.json({ error: 'programs_visible must be boolean' }, { status: 400 })
    }

    const { error } = await auth.service
        .from('profiles')
        .update({ programs_visible: body.programs_visible })
        .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ programs_visible: body.programs_visible })
}
