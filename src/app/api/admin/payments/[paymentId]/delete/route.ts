// DELETE /api/admin/payments/[paymentId] — удаление платежа
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ paymentId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { paymentId } = await ctx.params

    // Проверяем существование платежа
    const { data: payment, error: fetchErr } = await auth.service
        .from('payments')
        .select('id, status')
        .eq('id', paymentId)
        .single()

    if (fetchErr || !payment) {
        return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 })
    }

    // Удаляем связанные записи в subscription_renewals
    await auth.service
        .from('subscription_renewals')
        .delete()
        .eq('payment_id', paymentId)

    // Удаляем платёж
    const { error } = await auth.service
        .from('payments')
        .delete()
        .eq('id', paymentId)

    if (error) {
        return NextResponse.json({ error: 'Ошибка удаления: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
