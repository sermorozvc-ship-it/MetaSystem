// Централизованные цены тарифов и плана питания.
//
// Тест-режим: если NEXT_PUBLIC_PAYMENT_TEST_MODE === 'true', используются
// символические суммы (5/6/7 ₽, питание 2 ₽) — чтобы прогнать живую оплату
// через Prodamus без реальных трат. Без флага — боевые цены.
//
// Флаг должен быть NEXT_PUBLIC_*, т.к. цены читаются и на клиенте (страницы
// оплаты/продления), и в клиентских сервисах (payment.ts, renewal.ts).
//
// ⚠️ Чтобы вернуть боевые цены — убери NEXT_PUBLIC_PAYMENT_TEST_MODE (или
//    поставь false) локально и на Vercel, затем Redeploy. Правок кода не нужно.

export type PlanType = '1_month' | '3_months' | '6_months'

export const IS_PAYMENT_TEST_MODE =
    process.env.NEXT_PUBLIC_PAYMENT_TEST_MODE === 'true'

const PROD_PLAN_PRICES: Record<PlanType, number> = {
    '1_month': 14900,
    '3_months': 35900,
    '6_months': 59900,
}

const TEST_PLAN_PRICES: Record<PlanType, number> = {
    '1_month': 5,
    '3_months': 6,
    '6_months': 7,
}

const PROD_NUTRITION_ADDON = 3000
const TEST_NUTRITION_ADDON = 2

/** Цены тарифов (₽) с учётом тест-режима */
export const PLAN_PRICES: Record<PlanType, number> = IS_PAYMENT_TEST_MODE
    ? TEST_PLAN_PRICES
    : PROD_PLAN_PRICES

/** Цена докупки/опции плана питания (₽) с учётом тест-режима */
export const NUTRITION_ADDON_PRICE = IS_PAYMENT_TEST_MODE
    ? TEST_NUTRITION_ADDON
    : PROD_NUTRITION_ADDON

/** Длительность тарифа в месяцах */
export const PLAN_MONTHS: Record<PlanType, number> = {
    '1_month': 1,
    '3_months': 3,
    '6_months': 6,
}
