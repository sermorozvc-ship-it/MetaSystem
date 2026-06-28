// MetaSystem v2 — Renewal Service
// Сервис продления тарифов и докупки питания

import { createClient, safeGetUser } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/utils/with-timeout'
import {
  PLAN_PRICES,
  PLAN_MONTHS,
  NUTRITION_ADDON_PRICE as PRICING_NUTRITION_ADDON,
} from '@/lib/payments/pricing'

export type PlanType = '1_month' | '3_months' | '6_months'
export type RenewalType = 'renewal' | 'nutrition_upgrade' | 'plan_change'

export interface SubscriptionRenewal {
  id: string
  user_id: string
  previous_plan_type: string | null
  previous_end_date: string | null
  previous_had_nutrition: boolean
  new_plan_type: PlanType
  new_plan_months: number
  includes_nutrition: boolean
  payment_id: string | null
  amount: number | null
  renewal_type: RenewalType
  status: 'pending' | 'confirmed' | 'cancelled'
  new_start_date: string | null
  new_end_date: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionInfo {
  status: 'inactive' | 'active' | 'paused' | 'expired'
  endDate: string | null
  daysLeft: number | null
  hasNutrition: boolean
  planType: PlanType | null
  planMonths: number | null
  isExpiringSoon: boolean  // <= 14 дней
  isExpired: boolean
}

// ──────────────────────────────────────────────────────────────────────────
// Получение информации о подписке
// ──────────────────────────────────────────────────────────────────────────

/**
 * Получить полную информацию о подписке текущего пользователя
 */
export async function getMySubscriptionInfo(): Promise<SubscriptionInfo> {
  const supabase = createClient()

  const user = await safeGetUser()
  if (!user) {
    return {
      status: 'inactive',
      endDate: null,
      daysLeft: null,
      hasNutrition: false,
      planType: null,
      planMonths: null,
      isExpiringSoon: false,
      isExpired: true,
    }
  }

  // Получаем профиль
  const { data: profile } = await withTimeout<{ data: any; error: any }>(
    supabase
      .from('profiles')
      .select('subscription_status, subscription_end_date, has_nutrition_plan')
      .eq('id', user.id)
      .single(),
    'getMySubscriptionInfo:profile',
  ).catch(() => ({ data: null, error: null } as any))

  // Получаем последний подтверждённый платёж для plan_type
  const { data: payment } = await withTimeout<{ data: any; error: any }>(
    supabase
      .from('payments')
      .select('plan_type, plan_months, includes_nutrition')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'getMySubscriptionInfo:payment',
  ).catch(() => ({ data: null, error: null } as any))

  const endDate = profile?.subscription_end_date ?? null
  const status = profile?.subscription_status ?? 'inactive'

  let daysLeft: number | null = null
  if (endDate) {
    const end = new Date(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    status: status as SubscriptionInfo['status'],
    endDate,
    daysLeft,
    hasNutrition: profile?.has_nutrition_plan ?? false,
    planType: (payment?.plan_type as PlanType) ?? null,
    planMonths: payment?.plan_months ?? null,
    isExpiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 14,
    isExpired: status === 'expired' || (daysLeft !== null && daysLeft < 0),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Создание запроса на продление
// ──────────────────────────────────────────────────────────────────────────

export const RENEWAL_PRICES: Record<PlanType, number> = PLAN_PRICES

export const RENEWAL_MONTHS: Record<PlanType, number> = PLAN_MONTHS

export const NUTRITION_ADDON_PRICE = PRICING_NUTRITION_ADDON

/**
 * Создать запрос на продление тарифа
 * Возвращает payment_id для перенаправления на ЮMoney
 */
export async function createRenewalRequest(
  planType: PlanType,
  includesNutrition: boolean,
  renewalType: RenewalType = 'renewal'
): Promise<{ paymentId: string | null; amount: number; error: string | null }> {
  const supabase = createClient()

  const user = await safeGetUser()
  if (!user) return { paymentId: null, amount: 0, error: 'Пользователь не авторизован' }

  // Получаем текущую подписку для снапшота
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_end_date, has_nutrition_plan')
    .eq('id', user.id)
    .single()

  const { data: lastPayment } = await supabase
    .from('payments')
    .select('plan_type')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Рассчитываем стоимость
  const baseAmount = RENEWAL_PRICES[planType]
  const nutritionAmount = planType === '6_months' ? 0 : (includesNutrition ? NUTRITION_ADDON_PRICE : 0)
  const totalAmount = baseAmount + nutritionAmount
  const planMonths = RENEWAL_MONTHS[planType]
  const finalIncludesNutrition = planType === '6_months' ? true : includesNutrition

  // Создаём платёж
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      amount: totalAmount,
      currency: 'RUB',
      status: 'pending',
      payment_method: 'prodamus',
      plan_type: planType,
      plan_months: planMonths,
      includes_nutrition: finalIncludesNutrition,
      base_amount: baseAmount,
      nutrition_amount: nutritionAmount,
      renewal_type: renewalType,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    console.error('[Renewal] Error creating payment:', paymentError)
    return { paymentId: null, amount: totalAmount, error: 'Ошибка создания платежа' }
  }

  // Создаём запись о продлении
  const { error: renewalError } = await supabase
    .from('subscription_renewals')
    .insert({
      user_id: user.id,
      previous_plan_type: lastPayment?.plan_type ?? null,
      previous_end_date: profile?.subscription_end_date ?? null,
      previous_had_nutrition: profile?.has_nutrition_plan ?? false,
      new_plan_type: planType,
      new_plan_months: planMonths,
      includes_nutrition: finalIncludesNutrition,
      payment_id: payment.id,
      amount: totalAmount,
      renewal_type: renewalType,
      status: 'pending',
    })

  if (renewalError) {
    console.error('[Renewal] Error creating renewal record:', renewalError)
    // Не критично — платёж создан, продолжаем
  }

  // Помечаем профиль как ожидающий продления
  await supabase
    .from('profiles')
    .update({ renewal_pending: true })
    .eq('id', user.id)

  return { paymentId: payment.id, amount: totalAmount, error: null }
}

/**
 * Создать запрос на докупку питания (без смены тарифа)
 */
export async function createNutritionUpgradeRequest(): Promise<{
  paymentId: string | null
  amount: number
  error: string | null
}> {
  const supabase = createClient()

  const user = await safeGetUser()
  if (!user) return { paymentId: null, amount: 0, error: 'Пользователь не авторизован' }

  // Проверяем что подписка активна
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_end_date, has_nutrition_plan')
    .eq('id', user.id)
    .single()

  if (!profile || profile.subscription_status !== 'active') {
    return { paymentId: null, amount: 0, error: 'Подписка не активна' }
  }

  if (profile.has_nutrition_plan) {
    return { paymentId: null, amount: 0, error: 'Питание уже подключено' }
  }

  const { data: lastPayment } = await supabase
    .from('payments')
    .select('plan_type, plan_months')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const planType = (lastPayment?.plan_type as PlanType) ?? '1_month'
  const planMonths = lastPayment?.plan_months ?? 1

  // Создаём платёж на сумму докупки питания
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      amount: NUTRITION_ADDON_PRICE,
      currency: 'RUB',
      status: 'pending',
      payment_method: 'prodamus',
      plan_type: planType,
      plan_months: planMonths,
      includes_nutrition: true,
      base_amount: 0,
      nutrition_amount: NUTRITION_ADDON_PRICE,
      renewal_type: 'nutrition_upgrade',
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return { paymentId: null, amount: NUTRITION_ADDON_PRICE, error: 'Ошибка создания платежа' }
  }

  // Создаём запись о продлении
  await supabase
    .from('subscription_renewals')
    .insert({
      user_id: user.id,
      previous_plan_type: planType,
      previous_end_date: profile.subscription_end_date,
      previous_had_nutrition: false,
      new_plan_type: planType,
      new_plan_months: planMonths,
      includes_nutrition: true,
      payment_id: payment.id,
      amount: NUTRITION_ADDON_PRICE,
      renewal_type: 'nutrition_upgrade',
      status: 'pending',
    })

  return { paymentId: payment.id, amount: NUTRITION_ADDON_PRICE, error: null }
}

/**
 * Подтвердить продление (вызывается из вебхука ЮMoney или вручную админом)
 */
export async function confirmRenewal(
  paymentId: string,
  renewalType: RenewalType
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Получаем данные платежа
  const { data: payment } = await supabase
    .from('payments')
    .select('user_id, plan_months, includes_nutrition, plan_type')
    .eq('id', paymentId)
    .single()

  if (!payment) return { success: false, error: 'Платёж не найден' }

  // Подтверждаем платёж
  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  if (paymentError) return { success: false, error: paymentError.message }

  if (renewalType === 'nutrition_upgrade') {
    // Только включаем питание, не трогаем даты
    const { error } = await supabase
      .from('profiles')
      .update({
        has_nutrition_plan: true,
        renewal_pending: false,
      })
      .eq('id', payment.user_id)

    if (error) return { success: false, error: error.message }

    await supabase
      .from('subscription_renewals')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('payment_id', paymentId)
  } else {
    // Продление: пересчитываем даты
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_end_date')
      .eq('id', payment.user_id)
      .single()

    const currentEnd = profile?.subscription_end_date
    let newStart: Date
    let newEnd: Date

    if (currentEnd) {
      const endDate = new Date(currentEnd)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      // Если подписка ещё активна — продлеваем от конца
      newStart = endDate >= today
        ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
        : today
    } else {
      newStart = new Date()
    }

    newEnd = new Date(newStart)
    newEnd.setMonth(newEnd.getMonth() + (payment.plan_months ?? 1))
    newEnd.setDate(newEnd.getDate() - 1)

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_start_date: newStart.toISOString().split('T')[0],
        subscription_end_date: newEnd.toISOString().split('T')[0],
        has_nutrition_plan: payment.includes_nutrition
          ? true
          : undefined, // не перезаписываем если уже было
        renewal_pending: false,
      })
      .eq('id', payment.user_id)

    if (error) return { success: false, error: error.message }

    await supabase
      .from('subscription_renewals')
      .update({
        status: 'confirmed',
        new_start_date: newStart.toISOString().split('T')[0],
        new_end_date: newEnd.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('payment_id', paymentId)
  }

  return { success: true }
}

/**
 * Получить историю продлений пользователя
 */
export async function getMyRenewalHistory(): Promise<SubscriptionRenewal[]> {
  const supabase = createClient()

  const user = await safeGetUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('subscription_renewals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

/**
 * Получить историю продлений клиента (для админа)
 */
export async function getClientRenewalHistory(userId: string): Promise<SubscriptionRenewal[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('subscription_renewals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

/**
 * Тестовое продление (только dev)
 */
export async function createTestRenewal(
  planType: PlanType = '1_month',
  includesNutrition: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const user = await safeGetUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  const { paymentId, error } = await createRenewalRequest(planType, includesNutrition, 'renewal')
  if (error || !paymentId) return { success: false, error: error ?? 'Ошибка' }

  const result = await confirmRenewal(paymentId, 'renewal')
  return result
}
