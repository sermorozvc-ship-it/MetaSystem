// GET  /api/admin/users — список всех пользователей для админки
// POST /api/admin/users — ручное создание клиента админом
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { fetchAllUsersForAdmin } from '@/lib/server/admin-users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    try {
        const users = await fetchAllUsersForAdmin(auth.service)
        return NextResponse.json({ users })
    } catch (e: any) {
        console.error('[GET /api/admin/users]', e)
        return NextResponse.json({ error: e?.message || 'Ошибка загрузки' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const {
        email,
        password,
        full_name,
        amount,
        plan_months,
        includes_nutrition,
        subscription_start,
        subscription_end,
    } = body

    if (!email || !password || !full_name) {
        return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // 1. Создаём auth-юзера
    const { data: newUser, error: createError } = await auth.service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
    })

    if (createError || !newUser.user) {
        return NextResponse.json({ error: createError?.message || 'Ошибка создания пользователя' }, { status: 500 })
    }

    const userId = newUser.user.id

    // 2. Профиль
    const { error: profileError } = await auth.service.from('profiles').upsert({
        id: userId,
        email,
        full_name,
        role: 'user',
        is_blocked: false,
        subscription_status: 'active',
        subscription_start_date: subscription_start,
        subscription_end_date: subscription_end,
        has_nutrition_plan: !!includes_nutrition,
        questionnaire_completed: false,
    })

    if (profileError) {
        return NextResponse.json({ error: 'Профиль: ' + profileError.message }, { status: 500 })
    }

    // 3. Платёж
    if (typeof amount === 'number' && amount > 0) {
        const { error: paymentError } = await auth.service.from('payments').insert({
            user_id: userId,
            amount,
            currency: 'RUB',
            status: 'confirmed',
            payment_method: 'manual',
            plan_months: plan_months || 1,
            includes_nutrition: !!includes_nutrition,
            confirmed_by: auth.userId,
            confirmed_at: new Date().toISOString(),
            cohort_start: subscription_start,
            base_amount: amount,
            nutrition_amount: includes_nutrition ? 3000 : 0,
            renewal_type: 'initial',
        })

        if (paymentError) {
            return NextResponse.json({ error: 'Платёж: ' + paymentError.message }, { status: 500 })
        }
    }

    return NextResponse.json({ userId })
}
