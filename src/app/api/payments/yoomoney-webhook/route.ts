import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { notifyPaymentConfirmed } from '@/lib/services/notifications'

// Supabase admin client — tries service role key first, fallback to anon
function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseAdmin(url, key, {
        auth: { persistSession: false }
    })
}

/**
 * YooMoney P2P webhook handler
 *
 * ЮMoney sends POST with application/x-www-form-urlencoded body.
 * SHA1 format: notification_type&operation_id&amount&currency&datetime&sender&codepro&secret&label
 *
 * Label formats:
 *   - <userId>                          → первичная оплата (initial)
 *   - renewal_<userId>_<paymentId>      → продление тарифа
 *   - nutrition_<userId>_<paymentId>    → докупка питания
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.text()
    console.log('[YooMoney Webhook] RAW BODY:', rawBody)

    const params = new URLSearchParams(rawBody)

    const notification_type = params.get('notification_type') ?? ''
    const operation_id = params.get('operation_id') ?? ''
    const amount = params.get('amount') ?? ''
    const currency = params.get('currency') ?? ''
    const datetime = params.get('datetime') ?? ''
    const sender = params.get('sender') ?? ''
    const codepro = params.get('codepro') ?? ''
    const label = params.get('label') ?? ''
    const sha1_hash = params.get('sha1_hash') ?? ''

    console.log('[YooMoney Webhook] Parsed fields:', {
        notification_type, operation_id, amount, currency, label, codepro,
        sha1_hash: sha1_hash.substring(0, 8) + '...',
    })

    if (!notification_type || !operation_id || !amount || !sha1_hash) {
        console.error('[YooMoney Webhook] Missing required fields')
        return new NextResponse('Bad Request', { status: 400 })
    }

    const secret = process.env.YOOMONEY_SECRET?.trim()
    if (!secret) {
        console.error('[YooMoney Webhook] YOOMONEY_SECRET not set!')
        return new NextResponse('Config Error', { status: 500 })
    }

    const hashString = [
        notification_type, operation_id, amount, currency,
        datetime, sender, codepro, secret, label,
    ].join('&')

    const computedHash = createHash('sha1').update(hashString).digest('hex')
    console.log('[YooMoney Webhook] Hash check:', { match: computedHash === sha1_hash })

    if (computedHash !== sha1_hash) {
        console.error('[YooMoney Webhook] SIGNATURE MISMATCH')
        return new NextResponse('Forbidden', { status: 403 })
    }

    if (codepro === 'true') {
        console.warn('[YooMoney Webhook] Code-protected payment — skipping')
        return new NextResponse('OK', { status: 200 })
    }

    if (!label) {
        console.warn('[YooMoney Webhook] No label — cannot match user')
        return new NextResponse('OK', { status: 200 })
    }

    const supabase = getAdminClient()

    // ──────────────────────────────────────────────────────────────────────
    // Определяем тип платежа по формату label
    // ──────────────────────────────────────────────────────────────────────

    // renewal_<userId>_<paymentId>
    if (label.startsWith('renewal_')) {
        const parts = label.split('_')
        // renewal_ + UUID (5 parts) + _ + UUID (5 parts) = "renewal" + 10 UUID segments
        // Формат: renewal_<8>-<4>-<4>-<4>-<12>_<8>-<4>-<4>-<4>-<12>
        const withoutPrefix = label.slice('renewal_'.length)
        const uuidLen = 36 // UUID length
        const userId = withoutPrefix.slice(0, uuidLen)
        const paymentId = withoutPrefix.slice(uuidLen + 1) // +1 for underscore

        console.log('[YooMoney Webhook] RENEWAL payment for user:', userId, 'paymentId:', paymentId)
        await handleRenewalPayment(supabase, userId, paymentId, parseFloat(amount))
        return new NextResponse('OK', { status: 200 })
    }

    // nutrition_<userId>_<paymentId>
    if (label.startsWith('nutrition_')) {
        const withoutPrefix = label.slice('nutrition_'.length)
        const uuidLen = 36
        const userId = withoutPrefix.slice(0, uuidLen)
        const paymentId = withoutPrefix.slice(uuidLen + 1)

        console.log('[YooMoney Webhook] NUTRITION UPGRADE for user:', userId, 'paymentId:', paymentId)
        await handleNutritionUpgrade(supabase, userId, paymentId)
        return new NextResponse('OK', { status: 200 })
    }

    // ──────────────────────────────────────────────────────────────────────
    // Первичная оплата (label = userId)
    // ──────────────────────────────────────────────────────────────────────
    const userId = label
    console.log('[YooMoney Webhook] INITIAL payment for user:', userId)

    const { data: pending, error: findErr } = await supabase
        .from('payments')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (findErr) {
        console.error('[YooMoney Webhook] DB find error:', findErr)
    }

    if (pending) {
        const { data: paymentData, error: paymentErr } = await supabase
            .from('payments')
            .select('*')
            .eq('id', pending.id)
            .single()

        if (paymentErr) {
            console.error('[YooMoney Webhook] Error fetching payment:', paymentErr)
            return new NextResponse('DB Error', { status: 500 })
        }

        const { error: updErr } = await supabase
            .from('payments')
            .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
                confirmed_by: null,
            })
            .eq('id', pending.id)

        if (updErr) {
            console.error('[YooMoney Webhook] DB update error:', updErr)
            return new NextResponse('DB Error', { status: 500 })
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
            console.error('[YooMoney Webhook] Error updating profile:', profileErr)
        } else {
            console.log('[YooMoney Webhook] ✓ Subscription activated for user:', userId)
            await notifyPaymentConfirmed(userId, parseFloat(amount))
        }
    } else {
        console.log('[YooMoney Webhook] No pending found — inserting confirmed payment for user:', userId)

        const { error: insErr } = await supabase
            .from('payments')
            .insert({
                user_id: userId,
                amount: parseFloat(amount),
                currency: 'RUB',
                status: 'confirmed',
                payment_method: 'yoomoney',
                confirmed_at: new Date().toISOString(),
                confirmed_by: null,
                renewal_type: 'initial',
            })

        if (insErr) {
            console.error('[YooMoney Webhook] DB insert error:', insErr)
            return new NextResponse('DB Error', { status: 500 })
        }
    }

    return new NextResponse('OK', { status: 200 })
}

// ──────────────────────────────────────────────────────────────────────────
// Обработчик продления тарифа
// ──────────────────────────────────────────────────────────────────────────
async function handleRenewalPayment(
    supabase: ReturnType<typeof getAdminClient>,
    userId: string,
    paymentId: string,
    amount: number
) {
    // Подтверждаем платёж
    const { data: payment, error: payErr } = await supabase
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .eq('user_id', userId)
        .select('plan_months, includes_nutrition')
        .single()

    if (payErr || !payment) {
        console.error('[YooMoney Webhook] Renewal: payment update error:', payErr)
        return
    }

    // Получаем текущую дату окончания подписки
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_end_date')
        .eq('id', userId)
        .single()

    const currentEnd = profile?.subscription_end_date
    let newStart: Date
    let newEnd: Date

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

    newEnd = new Date(newStart)
    newEnd.setMonth(newEnd.getMonth() + (payment.plan_months ?? 1))
    newEnd.setDate(newEnd.getDate() - 1)

    // Обновляем профиль
    await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_end_date: newEnd.toISOString().split('T')[0],
            has_nutrition_plan: payment.includes_nutrition ? true : undefined,
            renewal_pending: false,
        })
        .eq('id', userId)

    // Обновляем запись о продлении
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
    console.log('[YooMoney Webhook] ✓ Renewal confirmed, new end:', newEnd.toISOString().split('T')[0])
}

// ──────────────────────────────────────────────────────────────────────────
// Обработчик докупки питания
// ──────────────────────────────────────────────────────────────────────────
async function handleNutritionUpgrade(
    supabase: ReturnType<typeof getAdminClient>,
    userId: string,
    paymentId: string
) {
    // Подтверждаем платёж
    const { error: payErr } = await supabase
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .eq('user_id', userId)

    if (payErr) {
        console.error('[YooMoney Webhook] Nutrition upgrade: payment update error:', payErr)
        return
    }

    // Включаем питание в профиле
    await supabase
        .from('profiles')
        .update({
            has_nutrition_plan: true,
            renewal_pending: false,
        })
        .eq('id', userId)

    // Обновляем запись о продлении
    await supabase
        .from('subscription_renewals')
        .update({
            status: 'confirmed',
            updated_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId)
        .eq('user_id', userId)

    console.log('[YooMoney Webhook] ✓ Nutrition upgrade confirmed for user:', userId)
}

// Health check
export async function GET() {
    const hasSecret = !!process.env.YOOMONEY_SECRET
    const hasWallet = !!process.env.YOOMONEY_WALLET
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    return NextResponse.json({
        status: 'ok',
        service: 'yoomoney-webhook',
        config: { hasSecret, hasWallet, hasServiceKey }
    })
}
