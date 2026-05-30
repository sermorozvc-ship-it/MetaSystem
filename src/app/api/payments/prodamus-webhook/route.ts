import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { notifyPaymentConfirmed } from '@/lib/services/notifications'
import { parseFormBody, verifySignature } from '@/lib/payments/prodamus-signature'
import { parseOrderId } from '@/lib/payments/prodamus-link'

// Supabase admin client — service role key first, fallback to anon
function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseAdmin(url, key, {
        auth: { persistSession: false }
    })
}

/**
 * Prodamus webhook handler.
 *
 * Продамус шлёт POST application/x-www-form-urlencoded.
 * Подпись — в HTTP-заголовке `Sign` (HMAC-SHA256 по алгоритму Продамуса).
 * Подтверждением оплаты считается ТОЛЬКО валидный вебхук с payment_status=success.
 *
 * Связка платёж↔пользователь идёт через order_id формата:
 *   init_<userId>_<paymentId>       → первичная оплата
 *   renewal_<userId>_<paymentId>    → продление тарифа
 *   nutrition_<userId>_<paymentId>  → докупка питания
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.text()
    const sign = request.headers.get('sign') ?? request.headers.get('Sign')

    console.log('[Prodamus Webhook] RAW BODY:', rawBody)

    const secret = process.env.PRODAMUS_SECRET_KEY?.trim()
    if (!secret) {
        console.error('[Prodamus Webhook] PRODAMUS_SECRET_KEY not set!')
        return new NextResponse('Config Error', { status: 500 })
    }

    const data = parseFormBody(rawBody)

    // Проверка подписи — критично для безопасности
    if (!verifySignature(data, secret, sign)) {
        console.error('[Prodamus Webhook] SIGNATURE MISMATCH')
        return new NextResponse('Forbidden', { status: 403 })
    }

    const orderId = typeof data.order_id === 'string' ? data.order_id : ''
    const paymentStatus = typeof data.payment_status === 'string' ? data.payment_status : ''
    const sum = typeof data.sum === 'string' ? data.sum : ''
    const amount = parseFloat(sum || '0')

    console.log('[Prodamus Webhook] Parsed:', { orderId, paymentStatus, sum })

    // Реагируем только на успешную оплату. Прочие статусы (например, частичная
    // оплата/ошибка) подтверждаем 200, чтобы Продамус не ретраил бесконечно.
    if (paymentStatus !== 'success') {
        console.log('[Prodamus Webhook] Status is not success — skipping:', paymentStatus)
        return new NextResponse('OK', { status: 200 })
    }

    if (!orderId) {
        console.warn('[Prodamus Webhook] No order_id — cannot match user')
        return new NextResponse('OK', { status: 200 })
    }

    const { type, userId, paymentId } = parseOrderId(orderId)
    if (!userId) {
        console.warn('[Prodamus Webhook] Cannot parse order_id:', orderId)
        return new NextResponse('OK', { status: 200 })
    }

    const supabase = getAdminClient()

    if (type === 'renewal') {
        console.log('[Prodamus Webhook] RENEWAL for user:', userId, 'paymentId:', paymentId)
        await handleRenewalPayment(supabase, userId, paymentId, amount)
        return new NextResponse('OK', { status: 200 })
    }

    if (type === 'nutrition') {
        console.log('[Prodamus Webhook] NUTRITION UPGRADE for user:', userId, 'paymentId:', paymentId)
        await handleNutritionUpgrade(supabase, userId, paymentId)
        return new NextResponse('OK', { status: 200 })
    }

    // Первичная оплата (type === 'init')
    console.log('[Prodamus Webhook] INITIAL payment for user:', userId, 'paymentId:', paymentId)
    await handleInitialPayment(supabase, userId, paymentId, amount)
    return new NextResponse('OK', { status: 200 })
}

// ──────────────────────────────────────────────────────────────────────────
// Первичная оплата
// ──────────────────────────────────────────────────────────────────────────
async function handleInitialPayment(
    supabase: ReturnType<typeof getAdminClient>,
    userId: string,
    paymentId: string,
    amount: number,
) {
    // Ищем конкретную pending-запись по paymentId, иначе — последнюю pending пользователя
    let pendingId: string | null = null

    if (paymentId) {
        const { data: byId } = await supabase
            .from('payments')
            .select('id')
            .eq('id', paymentId)
            .eq('user_id', userId)
            .maybeSingle()
        if (byId) pendingId = byId.id
    }

    if (!pendingId) {
        const { data: pending } = await supabase
            .from('payments')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (pending) pendingId = pending.id
    }

    if (pendingId) {
        const { data: paymentData, error: paymentErr } = await supabase
            .from('payments')
            .select('*')
            .eq('id', pendingId)
            .single()

        if (paymentErr || !paymentData) {
            console.error('[Prodamus Webhook] Error fetching payment:', paymentErr)
            return
        }

        const { error: updErr } = await supabase
            .from('payments')
            .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
                confirmed_by: null,
                payment_method: 'prodamus',
            })
            .eq('id', pendingId)

        if (updErr) {
            console.error('[Prodamus Webhook] DB update error:', updErr)
            return
        }

        const subscriptionEndDate = new Date()
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + (paymentData.plan_months || 1))

        const { error: profileErr } = await supabase
            .from('profiles')
            .update({
                subscription_status: 'active',
                subscription_end_date: subscriptionEndDate.toISOString().split('T')[0],
                has_nutrition_plan: paymentData.includes_nutrition || false,
            })
            .eq('id', userId)

        if (profileErr) {
            console.error('[Prodamus Webhook] Error updating profile:', profileErr)
        } else {
            console.log('[Prodamus Webhook] ✓ Subscription activated for user:', userId)
            await notifyPaymentConfirmed(userId, amount)
        }
        return
    }

    // Нет pending — определяем тариф по сумме (fallback) и вставляем confirmed
    console.log('[Prodamus Webhook] No pending found — inserting confirmed payment for user:', userId)

    let plan_months = 1
    let plan_type = '1_month'
    let includes_nutrition = false

    if (amount >= 50000) {
        plan_months = 6
        plan_type = '6_months'
        includes_nutrition = true
    } else if (amount >= 30000) {
        plan_months = 3
        plan_type = '3_months'
    }

    const { error: insErr } = await supabase
        .from('payments')
        .insert({
            user_id: userId,
            amount,
            currency: 'RUB',
            status: 'confirmed',
            payment_method: 'prodamus',
            confirmed_at: new Date().toISOString(),
            confirmed_by: null,
            renewal_type: 'initial',
            plan_months,
            plan_type,
            includes_nutrition,
        })

    if (insErr) {
        console.error('[Prodamus Webhook] DB insert error:', insErr)
        return
    }

    const subscriptionEndDate = new Date()
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + plan_months)

    const { error: profileErr } = await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_end_date: subscriptionEndDate.toISOString().split('T')[0],
            has_nutrition_plan: includes_nutrition,
        })
        .eq('id', userId)

    if (profileErr) {
        console.error('[Prodamus Webhook] Error updating profile (no-pending branch):', profileErr)
    } else {
        console.log('[Prodamus Webhook] ✓ Subscription activated (no-pending branch) for user:', userId)
        await notifyPaymentConfirmed(userId, amount)
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Продление тарифа
// ──────────────────────────────────────────────────────────────────────────
async function handleRenewalPayment(
    supabase: ReturnType<typeof getAdminClient>,
    userId: string,
    paymentId: string,
    amount: number,
) {
    const { data: payment, error: payErr } = await supabase
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            payment_method: 'prodamus',
        })
        .eq('id', paymentId)
        .eq('user_id', userId)
        .select('plan_months, includes_nutrition')
        .single()

    if (payErr || !payment) {
        console.error('[Prodamus Webhook] Renewal: payment update error:', payErr)
        return
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_end_date')
        .eq('id', userId)
        .single()

    const currentEnd = profile?.subscription_end_date
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
    newEnd.setMonth(newEnd.getMonth() + (payment.plan_months ?? 1))
    newEnd.setDate(newEnd.getDate() - 1)

    await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_end_date: newEnd.toISOString().split('T')[0],
            has_nutrition_plan: payment.includes_nutrition ? true : undefined,
            renewal_pending: false,
        })
        .eq('id', userId)

    await supabase
        .from('subscription_renewals')
        .update({
            status: 'confirmed',
            new_start_date: newStart.toISOString().split('T')[0],
            new_end_date: newEnd.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId)
        .eq('user_id', userId)

    await notifyPaymentConfirmed(userId, amount)
    console.log('[Prodamus Webhook] ✓ Renewal confirmed, new end:', newEnd.toISOString().split('T')[0])
}

// ──────────────────────────────────────────────────────────────────────────
// Докупка питания
// ──────────────────────────────────────────────────────────────────────────
async function handleNutritionUpgrade(
    supabase: ReturnType<typeof getAdminClient>,
    userId: string,
    paymentId: string,
) {
    const { error: payErr } = await supabase
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            payment_method: 'prodamus',
        })
        .eq('id', paymentId)
        .eq('user_id', userId)

    if (payErr) {
        console.error('[Prodamus Webhook] Nutrition upgrade: payment update error:', payErr)
        return
    }

    await supabase
        .from('profiles')
        .update({
            has_nutrition_plan: true,
            renewal_pending: false,
        })
        .eq('id', userId)

    await supabase
        .from('subscription_renewals')
        .update({
            status: 'confirmed',
            updated_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId)
        .eq('user_id', userId)

    console.log('[Prodamus Webhook] ✓ Nutrition upgrade confirmed for user:', userId)
}

// Health check
export async function GET() {
    const hasSecret = !!process.env.PRODAMUS_SECRET_KEY
    const hasFormUrl = !!process.env.NEXT_PUBLIC_PRODAMUS_FORM_URL
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    return NextResponse.json({
        status: 'ok',
        service: 'prodamus-webhook',
        config: { hasSecret, hasFormUrl, hasServiceKey }
    })
}
