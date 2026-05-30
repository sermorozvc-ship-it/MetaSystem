import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { notifyPaymentConfirmed } from '@/lib/services/notifications'
import { parseFormBody, parseFormEntries, verifySignature } from '@/lib/payments/prodamus-signature'

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
 * order_id = id записи payments (UUID). Тип платежа и пользователя берём из
 * самой строки payments (поля renewal_type и user_id) — в order_id их не кодируем,
 * т.к. форма Prodamus падает на длинных order_id.
 */
export async function POST(request: NextRequest) {
    const sign = request.headers.get('sign') ?? request.headers.get('Sign')
    const contentType = request.headers.get('content-type') ?? ''

    const secret = process.env.PRODAMUS_SECRET_KEY?.trim()
    if (!secret) {
        console.error('[Prodamus Webhook] PRODAMUS_SECRET_KEY not set!')
        return new NextResponse('Config Error', { status: 500 })
    }

    // Тело вебхука может приходить как multipart/form-data или x-www-form-urlencoded.
    // Парсим оба формата в одинаковое дерево объектов.
    let data
    if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        console.log('[Prodamus Webhook] multipart entries:', JSON.stringify(Object.fromEntries(
            Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : '[file]'])
        )))
        data = parseFormEntries(form.entries())
    } else {
        const rawBody = await request.text()
        console.log('[Prodamus Webhook] RAW BODY:', rawBody)
        data = parseFormBody(rawBody)
    }

    // Проверка подписи — критично для безопасности
    if (!verifySignature(data, secret, sign)) {
        console.error('[Prodamus Webhook] SIGNATURE MISMATCH')
        return new NextResponse('Forbidden', { status: 403 })
    }

    // Наш номер заказа Продамус возвращает в order_num (order_id — их внутренний ID).
    // Фолбэк на order_id на случай иных конфигураций.
    const orderNum = typeof data.order_num === 'string' ? data.order_num : ''
    const orderIdRaw = typeof data.order_id === 'string' ? data.order_id : ''
    const orderId = orderNum || orderIdRaw
    const paymentStatus = typeof data.payment_status === 'string' ? data.payment_status : ''
    const sum = typeof data.sum === 'string' ? data.sum : ''
    const amount = parseFloat(sum || '0')

    console.log('[Prodamus Webhook] Parsed:', { orderNum, orderId: orderIdRaw, paymentStatus, sum })

    // Реагируем только на успешную оплату. Прочие статусы (например, частичная
    // оплата/ошибка) подтверждаем 200, чтобы Продамус не ретраил бесконечно.
    if (paymentStatus !== 'success') {
        console.log('[Prodamus Webhook] Status is not success — skipping:', paymentStatus)
        return new NextResponse('OK', { status: 200 })
    }

    if (!orderId) {
        console.warn('[Prodamus Webhook] No order_id — cannot match payment')
        return new NextResponse('OK', { status: 200 })
    }

    const supabase = getAdminClient()

    // order_id = payments.id. Находим запись и берём из неё user_id + renewal_type.
    const { data: paymentRow, error: findErr } = await supabase
        .from('payments')
        .select('id, user_id, renewal_type, status')
        .eq('id', orderId)
        .maybeSingle()

    if (findErr) {
        console.error('[Prodamus Webhook] DB find error:', findErr)
        return new NextResponse('DB Error', { status: 500 })
    }

    if (!paymentRow) {
        // Платёж не через наш сайт (нет записи) — определяем пользователя по email
        // и создаём confirmed-запись как fallback по сумме.
        const email = typeof data.customer_email === 'string' ? data.customer_email : ''
        console.warn('[Prodamus Webhook] No payment row for order_id:', orderId, 'email:', email)
        await handleOrphanPayment(supabase, email, amount)
        return new NextResponse('OK', { status: 200 })
    }

    const userId = paymentRow.user_id as string
    const renewalType = (paymentRow.renewal_type as string) ?? 'initial'

    if (renewalType === 'renewal' || renewalType === 'plan_change') {
        console.log('[Prodamus Webhook] RENEWAL for user:', userId, 'paymentId:', orderId)
        await handleRenewalPayment(supabase, userId, orderId, amount)
        return new NextResponse('OK', { status: 200 })
    }

    if (renewalType === 'nutrition_upgrade') {
        console.log('[Prodamus Webhook] NUTRITION UPGRADE for user:', userId, 'paymentId:', orderId)
        await handleNutritionUpgrade(supabase, userId, orderId)
        return new NextResponse('OK', { status: 200 })
    }

    // Первичная оплата (renewal_type === 'initial')
    console.log('[Prodamus Webhook] INITIAL payment for user:', userId, 'paymentId:', orderId)
    await handleInitialPayment(supabase, userId, orderId, amount)
    return new NextResponse('OK', { status: 200 })
}

// ──────────────────────────────────────────────────────────────────────────
// Платёж без записи в БД (не через сайт) — fallback по email
// ──────────────────────────────────────────────────────────────────────────
async function handleOrphanPayment(
    supabase: ReturnType<typeof getAdminClient>,
    email: string,
    amount: number,
) {
    if (!email) {
        console.warn('[Prodamus Webhook] Orphan payment without email — skipping')
        return
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

    if (!profile) {
        console.warn('[Prodamus Webhook] Orphan payment: no profile for email:', email)
        return
    }

    const userId = profile.id as string

    let plan_months = 1
    let plan_type = '1_month'
    let includes_nutrition = false
    if (amount >= 50000) {
        plan_months = 6; plan_type = '6_months'; includes_nutrition = true
    } else if (amount >= 30000) {
        plan_months = 3; plan_type = '3_months'
    }

    await supabase.from('payments').insert({
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

    const subscriptionEndDate = new Date()
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + plan_months)

    await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_end_date: subscriptionEndDate.toISOString().split('T')[0],
            has_nutrition_plan: includes_nutrition,
        })
        .eq('id', userId)

    console.log('[Prodamus Webhook] ✓ Orphan payment activated for user:', userId)
    await notifyPaymentConfirmed(userId, amount)
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
