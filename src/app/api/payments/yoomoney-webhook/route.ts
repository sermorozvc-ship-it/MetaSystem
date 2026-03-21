import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

// Supabase admin client (server-side, bypasses RLS)
function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseAdmin(url, serviceKey)
}

/**
 * YooMoney P2P webhook handler
 * 
 * YooMoney sends POST with form-urlencoded body:
 * - notification_type: p2p-incoming
 * - operation_id: unique operation ID
 * - amount: payment amount
 * - currency: 643 (RUB)
 * - datetime: ISO date string
 * - sender: sender wallet (or empty)
 * - codepro: true/false (code protection)
 * - label: our custom label (user_id)
 * - sha1_hash: signature for verification
 * - unaccepted: true if needs manual accept
 */

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        // Extract all fields
        const notification_type = formData.get('notification_type') as string
        const operation_id = formData.get('operation_id') as string
        const amount = formData.get('amount') as string
        const currency = formData.get('currency') as string
        const datetime = formData.get('datetime') as string
        const sender = formData.get('sender') as string || ''
        const codepro = formData.get('codepro') as string
        const label = formData.get('label') as string
        const sha1_hash = formData.get('sha1_hash') as string

        console.log('[YooMoney Webhook] Received:', {
            notification_type,
            operation_id,
            amount,
            label,
            codepro,
        })

        // Validate required fields
        if (!notification_type || !operation_id || !amount || !sha1_hash) {
            console.error('[YooMoney Webhook] Missing required fields')
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        // Verify SHA1 hash
        // Format: notification_type&operation_id&amount&currency&datetime&sender&codepro&notification_secret&label
        const secret = process.env.YOOMONEY_SECRET
        if (!secret) {
            console.error('[YooMoney Webhook] YOOMONEY_SECRET not configured')
            return NextResponse.json({ error: 'Server config error' }, { status: 500 })
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

        if (computedHash !== sha1_hash) {
            console.error('[YooMoney Webhook] Hash mismatch!', {
                computed: computedHash,
                received: sha1_hash,
            })
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
        }

        console.log('[YooMoney Webhook] Signature verified ✓')

        // label = user_id — find and confirm payment
        if (!label) {
            console.warn('[YooMoney Webhook] No label (user_id) in payment')
            return NextResponse.json({ ok: true, note: 'No label' })
        }

        // Don't process code-protected payments
        if (codepro === 'true') {
            console.warn('[YooMoney Webhook] Code-protected payment, skipping auto-confirm')
            return NextResponse.json({ ok: true, note: 'Code protected' })
        }

        const supabase = getAdminClient()

        // Find pending payment for this user
        const { data: pendingPayment, error: findError } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', label)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (findError || !pendingPayment) {
            // No pending payment — create a new confirmed one
            console.log('[YooMoney Webhook] No pending payment found, creating confirmed record for user:', label)

            const { error: insertError } = await supabase
                .from('payments')
                .insert({
                    user_id: label,
                    amount: parseFloat(amount),
                    currency: 'RUB',
                    status: 'confirmed',
                    payment_method: 'yoomoney',
                    confirmed_at: new Date().toISOString(),
                    confirmed_by: 'yoomoney-webhook',
                })

            if (insertError) {
                console.error('[YooMoney Webhook] Insert error:', insertError)
                return NextResponse.json({ error: 'DB insert error' }, { status: 500 })
            }

            console.log('[YooMoney Webhook] Created confirmed payment for user:', label)
            return NextResponse.json({ ok: true, action: 'created_confirmed' })
        }

        // Update existing pending payment → confirmed
        const { error: updateError } = await supabase
            .from('payments')
            .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
                confirmed_by: 'yoomoney-webhook',
            })
            .eq('id', pendingPayment.id)

        if (updateError) {
            console.error('[YooMoney Webhook] Update error:', updateError)
            return NextResponse.json({ error: 'DB update error' }, { status: 500 })
        }

        console.log('[YooMoney Webhook] Payment confirmed for user:', label, 'amount:', amount)
        return NextResponse.json({ ok: true, action: 'confirmed' })

    } catch (error: any) {
        console.error('[YooMoney Webhook] Exception:', error.message)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// YooMoney may also send GET to check endpoint availability
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'yoomoney-webhook' })
}
