// GET /api/admin/clients/[userId]/detail
// Полный payload карточки клиента одним запросом (service_role).
// Клиентская soft-навигация в админке зависала на параллельных
// browser-supabase select (inTabLock / getSession) — после F5 всё
// появлялось. Здесь нет браузерного клиента и нет RLS-гонок.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const db = auth.service

    const [
        profileRes,
        progressRes,
        reportsCountRes,
        questionnaireRes,
        nutritionQRes,
        programsRes,
        nutritionPlansRes,
        paymentRes,
    ] = await Promise.all([
        db.from('profiles').select('*').eq('id', userId).maybeSingle(),
        db.from('user_progress').select('completed').eq('user_id', userId),
        db.from('day_reports').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        db.from('client_questionnaires').select('*').eq('user_id', userId).maybeSingle(),
        db.from('client_nutrition_questionnaires').select('*').eq('user_id', userId).maybeSingle(),
        db.from('training_programs').select('*').eq('user_id', userId).order('week_number', { ascending: false }),
        db.from('nutrition_programs').select('*').eq('user_id', userId).order('plan_number', { ascending: false }),
        db.from('payments')
            .select('plan_type, plan_months, confirmed_at, status, includes_nutrition')
            .eq('user_id', userId)
            .eq('status', 'confirmed')
            .order('confirmed_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ])

    if (profileRes.error) {
        console.error('[admin/clients/detail] profile:', profileRes.error.message)
        return NextResponse.json({ error: profileRes.error.message }, { status: 500 })
    }
    if (!profileRes.data) {
        return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }

    // nutrition access: has_nutrition_plan OR last confirmed payment
    let nutritionAccess = !!profileRes.data.has_nutrition_plan
    if (!nutritionAccess && paymentRes.data) {
        nutritionAccess =
            paymentRes.data.plan_type === '6_months' || !!paymentRes.data.includes_nutrition
    }

    const profile = {
        ...profileRes.data,
        completed_days: (progressRes.data || []).filter((p: { completed?: boolean }) => p.completed).length,
        total_reports: reportsCountRes.count || 0,
        last_activity: profileRes.data.created_at,
        payment_status: paymentRes.data?.status || 'none',
        payment_created_at: paymentRes.data?.confirmed_at || null,
        plan_type: paymentRes.data?.plan_type || null,
    }

    // Soft-fail secondary queries: better partial data than empty card
    if (programsRes.error) console.error('[admin/clients/detail] programs:', programsRes.error.message)
    if (questionnaireRes.error && questionnaireRes.error.code !== 'PGRST116') {
        console.error('[admin/clients/detail] questionnaire:', questionnaireRes.error.message)
    }
    if (nutritionQRes.error) console.error('[admin/clients/detail] nutritionQ:', nutritionQRes.error.message)
    if (nutritionPlansRes.error) console.error('[admin/clients/detail] nutPlans:', nutritionPlansRes.error.message)
    if (paymentRes.error) console.error('[admin/clients/detail] payment:', paymentRes.error.message)

    return NextResponse.json({
        profile,
        questionnaire: questionnaireRes.data || null,
        nutritionQuestionnaire: nutritionQRes.data || null,
        nutritionAccess,
        programs: programsRes.data || [],
        nutritionPlans: nutritionPlansRes.data || [],
        payment: paymentRes.data || null,
    })
}
