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
 */
export async function POST(request: NextRequest) {
    // Log raw request for debugging
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
        notification_type,
        operation_id,
        amount,
        currency,
        label,
        codepro,
        sha1_hash: sha1_hash.substring(0, 8) + '...',
    })

    // Missing required fields
    if (!notification_type || !operation_id || !amount || !sha1_hash) {
        console.error('[YooMoney Webhook] Missing required fields')
        return new NextResponse('Bad Request', { status: 400 })
    }

    // Verify SHA1
    const secret = process.env.YOOMONEY_SECRET?.trim()
    if (!secret) {
        console.error('[YooMoney Webhook] YOOMONEY_SECRET not set!')
        return new NextResponse('Config Error', { status: 500 })
    }

    const hashString = [
        notification_type,
        operation_id,
        amount,
        currency,
        datetime,
        sender,
        codepro,
        secret,
        label,
    ].join('&')

    const computedHash = createHash('sha1').update(hashString).digest('hex')
    console.log('[YooMoney Webhook] Hash check:', { computedHash, sha1_hash, match: computedHash === sha1_hash })

    if (computedHash !== sha1_hash) {
        console.error('[YooMoney Webhook] SIGNATURE MISMATCH — возможная атака или неверный секрет!')
        return new NextResponse('Forbidden', { status: 403 })
    }

    console.log('[YooMoney Webhook] ✓ Signature OK')

    // Skip code-protected
    if (codepro === 'true') {
        console.warn('[YooMoney Webhook] Code-protected payment — skipping')
        return new NextResponse('OK', { status: 200 })
    }

    // No label = no user to match
    if (!label) {
        console.warn('[YooMoney Webhook] No label — cannot match user')
        return new NextResponse('OK', { status: 200 })
    }

    const supabase = getAdminClient()
    console.log('[YooMoney Webhook] Supabase client ready, service_role =', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Try to find + update pending payment
    const { data: pending, error: findErr } = await supabase
        .from('payments')
        .select('id')
        .eq('user_id', label)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (findErr) {
        console.error('[YooMoney Webhook] DB find error:', findErr)
    }

    if (pending) {
        // Получаем полную информацию о платеже
        const { data: paymentData, error: paymentErr } = await supabase
            .from('payments')
            .select('*')
            .eq('id', pending.id)
            .single()

        if (paymentErr) {
            console.error('[YooMoney Webhook] Error fetching payment:', paymentErr)
            return new NextResponse('DB Error', { status: 500 })
        }

        // Обновляем статус платежа
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

        // Активируем подписку пользователя
        const subscriptionEndDate = new Date()
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + (paymentData.plan_months || 1))

        const { error: profileErr } = await supabase
            .from('profiles')
            .update({
                subscription_status: 'active',
                subscription_end_date: subscriptionEndDate.toISOString().split('T')[0],
                has_nutrition_plan: paymentData.includes_nutrition || false,
            })
            .eq('id', label)

        if (profileErr) {
            console.error('[YooMoney Webhook] Error updating profile:', profileErr)
        } else {
            console.log('[YooMoney Webhook] ✓ Subscription activated for user:', label)
            
            // Отправить уведомление о подтверждении оплаты
            await notifyPaymentConfirmed(label, parseFloat(amount))
        }

        console.log('[YooMoney Webhook] ✓ Payment CONFIRMED for user:', label, 'amount:', amount)
    } else {
        // Create confirmed payment from scratch
        console.log('[YooMoney Webhook] No pending found — inserting confirmed payment for user:', label)

        const { error: insErr } = await supabase
            .from('payments')
            .insert({
                user_id: label,
                amount: parseFloat(amount),
                currency: 'RUB',
                status: 'confirmed',
                payment_method: 'yoomoney',
                confirmed_at: new Date().toISOString(),
                confirmed_by: null, // UUID column — null для автоподтверждения
            })

        if (insErr) {
            console.error('[YooMoney Webhook] DB insert error:', insErr)
            return new NextResponse('DB Error', { status: 500 })
        }

        console.log('[YooMoney Webhook] ✓ Created confirmed payment for user:', label)
    }

    // YooMoney requires plain 200 OK (not JSON!)
    return new NextResponse('OK', { status: 200 })
}

// For manual endpoint health check
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
