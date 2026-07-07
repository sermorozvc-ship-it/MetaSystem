// POST /api/admin/users/[userId]/renew — ручное продление подписки клиента
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const { planMonths, planType, includesNutrition, amount } = body

    if (!planMonths || !planType || typeof amount !== 'number') {
        return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // Текущая подписка
    const { data: profile } = await auth.service
        .from('profiles')
        .select('subscription_end_date, has_nutrition_plan')
        .eq('id', userId)
        .single()

    const currentEnd = profile?.subscription_end_date as string | null | undefined
    let newStart: Date

    if (currentEnd) {
        const endDate = new Date(currentEnd)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        newStart = endDate >= today
            ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
            : today
    } else {
        newStart = new Date()
    }

    const newEnd = new Date(newStart)
    newEnd.setMonth(newEnd.getMonth() + planMonths)
    newEnd.setDate(newEnd.getDate() - 1)

    const newEndStr = newEnd.toISOString().split('T')[0]

    // Платёж
    const { data: payment, error: paymentError } = await auth.service
        .from('payments')
        .insert({
            user_id: userId,
            amount,
            currency: 'RUB',
            status: 'confirmed',
            payment_method: 'manual',
            plan_type: planType,
            plan_months: planMonths,
            includes_nutrition: includesNutrition,
            base_amount: amount,
            nutrition_amount: includesNutrition ? 3000 : 0,
            confirmed_by: auth.userId,
            confirmed_at: new Date().toISOString(),
            renewal_type: 'renewal',
        })
        .select('id')
        .single()

    if (paymentError || !payment) {
        return NextResponse.json({ error: 'Ошибка создания платежа: ' + paymentError?.message }, { status: 500 })
    }

    await auth.service.from('subscription_renewals').insert({
        user_id: userId,
        previous_end_date: currentEnd ?? null,
        previous_had_nutrition: profile?.has_nutrition_plan ?? false,
        new_plan_type: planType,
        new_plan_months: planMonths,
        includes_nutrition: includesNutrition,
        payment_id: payment.id,
        amount,
        renewal_type: 'renewal',
        status: 'confirmed',
        new_start_date: newStart.toISOString().split('T')[0],
        new_end_date: newEndStr,
    })

    const { error: profileError } = await auth.service
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_start_date: newStart.toISOString().split('T')[0],
            subscription_end_date: newEndStr,
            has_nutrition_plan: includesNutrition ? true : (profile?.has_nutrition_plan ?? false),
            renewal_pending: false,
            programs_visible: true,
        })
        .eq('id', userId)

    if (profileError) {
        return NextResponse.json({ error: 'Ошибка обновления профиля: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, newEndDate: newEndStr })
}
