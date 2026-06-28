// PATCH / DELETE /api/admin/payments/[paymentId]
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ paymentId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { paymentId } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const { amount, created_at } = body

    const updateData: Record<string, any> = {}

    if (typeof amount === 'number') {
        if (amount < 0) {
            return NextResponse.json({ error: 'Сумма не может быть отрицательной' }, { status: 400 })
        }
        updateData.amount = amount
    }

    if (typeof created_at === 'string' && created_at) {
        const date = new Date(created_at)
        if (isNaN(date.getTime())) {
            return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
        }
        updateData.created_at = date.toISOString()
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { error } = await auth.service
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)

    if (error) {
        return NextResponse.json({ error: 'Ошибка обновления: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ paymentId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { paymentId } = await ctx.params

    const { data: payment, error: fetchErr } = await auth.service
        .from('payments')
        .select('id')
        .eq('id', paymentId)
        .single()

    if (fetchErr || !payment) {
        return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 })
    }

    await auth.service
        .from('subscription_renewals')
        .delete()
        .eq('payment_id', paymentId)

    const { error } = await auth.service
        .from('payments')
        .delete()
        .eq('id', paymentId)

    if (error) {
        return NextResponse.json({ error: 'Ошибка удаления: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
