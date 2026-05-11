import { createClient } from '@/lib/supabase/client'

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
 * Получить статус оплаты текущего пользователя
 */
export async function getUserPayment(): Promise<Payment | null> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('[Payment] Error fetching payment:', error)
        return null
    }

    return data as Payment | null
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
        '1_month': 14900,
        '3_months': 35900,
        '6_months': 59900,
    }
    
    const baseAmount = prices[planType]
    const nutritionAmount = planType === '6_months' ? 0 : (includesNutrition ? 3000 : 0)
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
