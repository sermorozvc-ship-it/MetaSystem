// MetaSystem v2 — Nutrition Programs Service
// Сервис для работы с планами питания (аналог training.ts)

import { createClient } from '@/lib/supabase/client'

// ──────────────────────────────────────────────────────────────────────────
// Типы
// ──────────────────────────────────────────────────────────────────────────

export interface NutritionMeal {
  id: string
  name: string           // Завтрак / Обед / Ужин / Перекус 1 и т.д.
  time?: string          // Рекомендуемое время: "08:00"
  kcal?: number
  protein?: number       // г белка
  fat?: number           // г жиров
  carbs?: number         // г углеводов
  dishes: NutritionDish[]
  note?: string          // Заметка тренера к приёму пищи
}

export interface NutritionDish {
  id: string
  name: string
  amount?: string        // "200 г", "1 шт", "2 ст.л."
  kcal?: number
  protein?: number
  fat?: number
  carbs?: number
  recipe?: string        // Краткий рецепт или способ приготовления
}

export interface NutritionDay {
  dayNumber: number      // Сквозная нумерация: 1–28/30
  weekNumber: number     // Номер недели: 1–4
  dayOfWeek: string      // monday, tuesday, ...
  title: string          // "День 1: Тренировочный день"
  totalKcal?: number
  totalProtein?: number
  totalFat?: number
  totalCarbs?: number
  meals: NutritionMeal[]
  coachNote?: string     // Рекомендация тренера на день
  waterGoal?: string     // "2.5 л"
}

export interface NutritionWeek {
  weekNumber: number
  title: string          // "Неделя 1: Адаптация"
  weeklyNote?: string    // Рекомендация тренера на неделю
  days: NutritionDay[]
}

export interface NutritionRecipe {
  id: string
  name: string
  category?: string      // "Завтраки" / "Обеды" / "Ужины" / "Перекусы"
  kcal?: number
  protein?: number
  fat?: number
  carbs?: number
  servings?: string      // "1 порция (250 г)"
  ingredients: string[]  // ["200 г куриной грудки", "100 г гречки"]
  steps: string[]        // ["Отварить курицу", "Сварить гречку"]
  note?: string
}

export interface NutritionPlanData {
  planNumber: number
  startDate: string
  endDate: string
  weeks: NutritionWeek[]
  // Для обратной совместимости — плоский список дней
  days: NutritionDay[]
  weeklyNote?: string    // Общая рекомендация тренера (для однонедельных планов)
  dailyKcal?: number     // Целевые калории
  dailyProtein?: number
  dailyFat?: number
  dailyCarbs?: number
  recipes?: NutritionRecipe[]  // Рецепты
}

export interface NutritionProgram {
  id: string
  user_id: string
  plan_number: number
  title: string
  start_date: string
  end_date: string
  plan_md: string
  plan_data: NutritionPlanData
  status: 'draft' | 'active' | 'completed' | 'archived'
  notes_trainer?: string
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Клиентские функции
// ──────────────────────────────────────────────────────────────────────────

/**
 * Получить все планы питания текущего пользователя
 */
export async function getMyNutritionPrograms(): Promise<NutritionProgram[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('nutrition_programs')
    .select('*')
    .eq('user_id', user.id)
    .order('plan_number', { ascending: false })

  if (error) {
    console.error('[NutritionPrograms] Error fetching:', error)
    throw error
  }

  return data || []
}

/**
 * Получить план питания по ID
 */
export async function getNutritionProgramById(planId: string): Promise<NutritionProgram | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('nutrition_programs')
    .select('*')
    .eq('id', planId)
    .maybeSingle()

  if (error) {
    console.error('[NutritionPrograms] Error fetching by id:', error)
    return null
  }

  return data
}

/**
 * Получить текущий активный план питания
 */
export async function getCurrentNutritionProgram(): Promise<NutritionProgram | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().split('T')[0]

  // Ищем план, в диапазон которого попадает сегодня
  const { data: exact } = await supabase
    .from('nutrition_programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle()

  if (exact) return exact

  // Fallback: последний активный план
  const { data: latest } = await supabase
    .from('nutrition_programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('plan_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return latest ?? null
}

/**
 * Получить планы питания клиента (для админа)
 */
export async function getClientNutritionPrograms(userId: string): Promise<NutritionProgram[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('nutrition_programs')
    .select('*')
    .eq('user_id', userId)
    .order('plan_number', { ascending: false })

  if (error) {
    console.error('[NutritionPrograms] Error fetching client plans:', error)
    return []
  }

  return data || []
}
