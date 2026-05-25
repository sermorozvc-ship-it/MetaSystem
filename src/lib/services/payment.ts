import { createClient } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/utils/with-timeout'

export interface Payment {
    id: string
    user_id: string
    amount: number
    currency: string
    status: 'pending' | 'confirmed' | 'refunded'
    payment_method: 'manual' | 'stripe' | 'yookassa'
    confirmed_by: string | null
    confirmed_at: string | null
    // MetaSystem v2: новые поля для тарифов
    plan_type?: '1_month' | '3_months' | '6_months'
    plan_months?: number
    includes_nutrition?: boolean
    base_amount?: number
    nutrition_amount?: number
    // Дата начала когорты (ISO 8601 format)
    cohort_start?: string
    created_at: string
    updated_at: string
}

/**
 * Получить статус оплаты текущего пользователя.
 * Возвращает последний CONFIRMED платёж, или последний pending если confirmed нет.
 * Fallback: если profiles.subscription_status = 'active' — создаём виртуальный confirmed-объект.
 *
 * Все Supabase-запросы обёрнуты в withTimeout — функция вызывается на старте
 * /auth, /dashboard, /programs и любая зависшая сетевая операция здесь
 * приводит к вечному «Переходим...» / лоадеру (см. desktop-page-load.md).
 */
export async function getUserPayment(): Promise<Payment | null> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    try {
        // Сначала ищем подтверждённый платёж — он приоритетнее pending
        const { data: confirmed } = await withTimeout<{ data: Payment | null; error: any }>(
            supabase
                .from('payments')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'confirmed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            'getUserPayment:confirmed',
        )

        if (confirmed) return confirmed as Payment

        // Нет confirmed — проверяем профиль как fallback
        // (вебхук мог не прийти, но подписка активирована вручную)
        const { data: profile } = await withTimeout<{ data: any; error: any }>(
            supabase
                .from('profiles')
                .select('subscription_status, subscription_end_date, has_nutrition_plan')
                .eq('id', user.id)
                .single(),
            'getUserPayment:profile',
        )

        if (profile?.subscription_status === 'active') {
            // Возвращаем синтетический confirmed-объект чтобы не блокировать пользователя
            return {
                id: 'profile-fallback',
                user_id: user.id,
                amount: 0,
                currency: 'RUB',
                status: 'confirmed',
                payment_method: 'manual',
                confirmed_by: null,
                confirmed_at: null,
                includes_nutrition: profile.has_nutrition_plan ?? false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as Payment
        }

        // Нет ни confirmed, ни активного профиля — возвращаем последний pending (или null)
        const { data: pending, error } = await withTimeout<{ data: Payment | null; error: any }>(
            supabase
                .from('payments')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            'getUserPayment:pending',
        )

        if (error) {
            console.error('[Payment] Error fetching payment:', error)
            return null
        }

        return pending as Payment | null
    } catch (e) {
        console.error('[Payment] getUserPayment timeout/network:', e)
        return null
    }
}

/**
 * Проверить, есть ли подтверждённая оплата у текущего пользователя
 */
export async function hasActivePayment(): Promise<boolean> {
    const payment = await getUserPayment()
    return payment?.status === 'confirmed'
}

/**
 * Проверить, есть ли ожидающая оплата (pending)
 */
export async function hasPendingPayment(): Promise<boolean> {
    const payment = await getUserPayment()
    return payment?.status === 'pending'
}

/**
 * Создать запрос на оплату
 */
export async function createPaymentRequest(
    planType: '1_month' | '3_months' | '6_months',
    includesNutrition: boolean
): Promise<{ payment: Payment | null; error: string | null }> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { payment: null, error: 'Пользователь не авторизован' }

    // Проверяем, нет ли уже активной оплаты
    const existing = await getUserPayment()
    if (existing?.status === 'confirmed') {
        return { payment: existing, error: null }
    }
    if (existing?.status === 'pending') {
        return { payment: existing, error: null }
    }

    // Рассчитываем стоимость
    const prices = {
        '1_month': 5,
        '3_months': 6,
        '6_months': 7,
    }
    
    const baseAmount = prices[planType]
    const nutritionAmount = planType === '6_months' ? 0 : (includesNutrition ? 2 : 0)
    const totalAmount = baseAmount + nutritionAmount
    
    const planMonths = planType === '1_month' ? 1 : planType === '3_months' ? 3 : 6

    const { data, error } = await supabase
        .from('payments')
        .insert({
            user_id: user.id,
            amount: totalAmount,
            currency: 'RUB',
            status: 'pending',
            payment_method: 'yookassa',
            plan_type: planType,
            plan_months: planMonths,
            includes_nutrition: planType === '6_months' ? true : includesNutrition,
            base_amount: baseAmount,
            nutrition_amount: nutritionAmount,
        })
        .select()
        .single()

    if (error) {
        console.error('[Payment] Error creating payment:', error)
        return { payment: null, error: 'Ошибка создания оплаты' }
    }

    return { payment: data as Payment, error: null }
}

/**
 * Получить статус оплаты по user_id (для серверных компонентов / middleware)
 */
export async function getPaymentStatus(userId: string): Promise<'none' | 'pending' | 'confirmed' | 'refunded'> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('payments')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !data) return 'none'
    return data.status as Payment['status']
}

/**
 * Создать тестовый платеж (для разработки)
 * ВНИМАНИЕ: Использовать только в dev режиме!
 */
export async function createTestPayment(
    planType: '1_month' | '3_months' | '6_months' = '3_months',
    includesNutrition: boolean = true
): Promise<{ payment: Payment | null; error: string | null }> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { payment: null, error: 'Пользователь не авторизован' }

    // Удаляем ВСЕ старые платежи пользователя
    await supabase.from('payments').delete().eq('user_id', user.id)

    // Рассчитываем стоимость
    const prices = {
        '1_month': 5,
        '3_months': 6,
        '6_months': 7,
    }
    
    const baseAmount = prices[planType]
    const nutritionAmount = planType === '6_months' ? 0 : (includesNutrition ? 2 : 0)
    const totalAmount = baseAmount + nutritionAmount
    const planMonths = planType === '1_month' ? 1 : planType === '3_months' ? 3 : 6

    const getNextMonday = () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
        const nextMonday = new Date(today)
        nextMonday.setDate(today.getDate() + daysUntilMonday)
        return nextMonday.toISOString().split('T')[0]
    }

    // Шаг 1: Создаём pending платёж (RLS разрешает)
    const { data: insertData, error: insertError } = await supabase
        .from('payments')
        .insert({
            user_id: user.id,
            amount: totalAmount,
            currency: 'RUB',
            status: 'pending',
            payment_method: 'manual',
            plan_type: planType,
            plan_months: planMonths,
            includes_nutrition: planType === '6_months' ? true : includesNutrition,
            base_amount: baseAmount,
            nutrition_amount: nutritionAmount,
            cohort_start: getNextMonday(),
        })
        .select()

    if (insertError) {
        console.error('[Payment] Error creating pending payment:', insertError)
        return { payment: null, error: 'Ошибка создания платежа: ' + insertError.message }
    }

    const pendingPayment = Array.isArray(insertData) ? insertData[0] : insertData
    if (!pendingPayment) {
        return { payment: null, error: 'Платёж не создан' }
    }

    // Шаг 2: Обновляем на confirmed
    const { data: updateData, error: updateError } = await supabase
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_by: null,
            confirmed_at: new Date().toISOString(),
        })
        .eq('id', pendingPayment.id)
        .select()

    if (updateError) {
        console.error('[Payment] Error confirming payment:', updateError)
        return { payment: null, error: 'Ошибка подтверждения: ' + updateError.message }
    }

    const confirmedPayment = Array.isArray(updateData) ? updateData[0] : updateData
    return { payment: (confirmedPayment || pendingPayment) as Payment, error: null }
}
