// MetaSystem v2 — Nutrition Questionnaire Service
// Анкета по питанию — доступ есть только у клиентов, купивших план питания
// (includes_nutrition = true в последнем подтверждённом платеже)

import { createClient, safeGetUser, getAccessTokenWithRecovery } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/utils/with-timeout'

// ──────────────────────────────────────────────────────────────────────────
// Типы ответов — хранятся в поле answers (jsonb)
// ──────────────────────────────────────────────────────────────────────────

export interface NutritionAnswers {
  // Блок 1. Основные данные и цель
  current_weight_kg?: number
  height_cm?: number
  age?: number
  gender?: 'male' | 'female'
  nutrition_goal?:
    | 'cut_keep_muscle'       // Снизить жир при сохранении мышц
    | 'bulk_lean'             // Набрать массу с минимальным жиром
    | 'recomp'                // Рекомпозиция
    | 'maintain'              // Поддерживать вес
  target_weight?: string      // желаемый вес / % жира (свободный формат)
  target_deadline?: string    // дата или срок — свободный формат

  // Блок 2. Активность и образ жизни
  job_activity?: 'sedentary' | 'mixed' | 'active' | 'physical'
  workouts_per_week?: number
  workout_duration_min?: number
  workout_type?: string       // 'strength' | 'cardio' | 'mixed' | 'other' — свободный
  steps_per_day?: number

  // Блок 3. Текущее питание
  meals_per_day?: number
  breakfast_habit?: 'yes' | 'no' | 'sometimes'
  first_meal_time?: string
  last_meal_time?: string
  current_diet_description?:
    | 'eat_anything'
    | 'trying_healthy'
    | 'tracks_calories'
    | 'tracks_calories_protein'
    | 'other'
  current_diet_other?: string
  tracked_kcal_before?: string   // "да/нет, ~ X ккал"
  portion_size?: 'small' | 'medium' | 'large'

  // Блок 4. Ограничения и предпочтения
  allergies?: string
  excluded_by_principle?: string
  disliked_foods?: string
  diet_type?: 'omnivore' | 'vegetarian' | 'pescatarian_no' | 'vegan' | 'other'
  diet_type_other?: string
  lactose_gluten_intolerance?: string
  dairy_attitude?: 'normal' | 'limited' | 'avoid'

  // Блок 5. Условия и реальность жизни
  cooking_mode?: 'self_daily' | 'self_partial' | 'ready_food' | 'mixed'
  cooking_time?: 'under_15' | '15_30' | '30_60' | 'no_limit'
  can_take_to_work?: 'yes' | 'no' | 'sometimes'
  weekday_eating?: string
  weekend_eating?: string

  // Блок 6. Сложности и паттерны
  late_evening_eating?: string
  binges_frequency?: string
  binge_triggers?: Array<'stress' | 'boredom' | 'social' | 'see_food' | 'other'>
  binge_triggers_other?: string
  sweet_craving?: string       // слабая/средняя/сильная или свободный
  salty_fatty_craving?: string
  alcohol_frequency?: string

  // Блок 7. Здоровье и медицина
  metabolic_conditions?: string   // диабет, ИР, гипотиреоз и т.д.
  gi_issues?: string              // ЖКТ
  medications?: string
  female_cycle?: string           // только для женщин

  // Блок 8. Спортивное питание
  current_supplements?: string
  protein_ok?: 'yes' | 'no' | 'unsure'

  // Блок 9. Ожидания от плана
  plan_format?: 'ready_menu' | 'flexible_template' | 'products_list'
  comfortable_meals_count?: '2_3' | '4_5' | 'any'
  favorite_foods?: string
  past_diets_experience?: string
}

export interface NutritionQuestionnaire {
  id: string
  user_id: string
  answers: NutritionAnswers
  current_weight_kg?: number
  height_cm?: number
  age?: number
  gender?: 'male' | 'female'
  nutrition_goal?: string
  diet_type?: string
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Доступ к анкете: 6 месяцев — всегда, иначе только если оплачено
// ──────────────────────────────────────────────────────────────────────────

/**
 * Нужна ли пользователю анкета по питанию.
 * - Тариф 6 месяцев → всегда да (план питания идёт в подарок)
 * - Иначе → только если платёж с includes_nutrition = true
 * - Fallback: profiles.has_nutrition_plan = true
 */
export async function isNutritionQuestionnaireRequired(): Promise<boolean> {
  const user = await safeGetUser()
  if (!user) return false

  const supabase = createClient()
  try {
    // Сначала проверяем профиль — самый надёжный источник после активации подписки
    const { data: profile } = await withTimeout<{ data: any; error: any }>(
      supabase
        .from('profiles')
        .select('has_nutrition_plan, subscription_status')
        .eq('id', user.id)
        .single(),
      'isNutritionQuestionnaireRequired:profile',
    )

    if (profile?.has_nutrition_plan) return true

    // Fallback: смотрим на подтверждённый платёж
    const { data, error } = await withTimeout<{ data: any; error: any }>(
      supabase
        .from('payments')
        .select('plan_type, includes_nutrition, status')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'isNutritionQuestionnaireRequired:payment',
    )

    if (error || !data) return false

    if (data.plan_type === '6_months') return true
    return !!data.includes_nutrition
  } catch (e) {
    console.error('[Nutrition] isNutritionQuestionnaireRequired timeout/network:', e)
    // При сетевом сбое не отправляем на анкету питания — пользователь уже
    // на дашборде получит реальный ответ из БД, а зависшая авторизация
    // не должна стопориться на этой проверке.
    return false
  }
}

/**
 * Есть ли у пользователя (любого) доступ к анкете — для админа.
 */
export async function userHasNutritionAccess(userId: string): Promise<boolean> {
  const supabase = createClient()

  // Сначала проверяем профиль
  const { data: profile } = await supabase
    .from('profiles')
    .select('has_nutrition_plan')
    .eq('id', userId)
    .single()

  if (profile?.has_nutrition_plan) return true

  // Fallback: подтверждённый платёж
  const { data } = await supabase
    .from('payments')
    .select('plan_type, includes_nutrition, status')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return false
  if (data.plan_type === '6_months') return true
  return !!data.includes_nutrition
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────

export async function getMyNutritionQuestionnaire(): Promise<NutritionQuestionnaire | null> {
  const user = await safeGetUser()
  if (!user) return null

  const supabase = createClient()
  try {
    const { data, error } = await withTimeout<{ data: NutritionQuestionnaire | null; error: any }>(
      supabase
        .from('client_nutrition_questionnaires')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      'getMyNutritionQuestionnaire',
    )

    if (error) {
      console.error('[Nutrition] Error fetching questionnaire:', error)
      return null
    }
    return data
  } catch (e) {
    console.error('[Nutrition] getMyNutritionQuestionnaire timeout/network:', e)
    return null
  }
}

export async function getNutritionQuestionnaireByUserId(
  userId: string
): Promise<NutritionQuestionnaire | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_nutrition_questionnaires')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[Nutrition] Error fetching by userId:', error)
    return null
  }
  return data as NutritionQuestionnaire | null
}

/**
 * Сохранение через серверный роут /api/questionnaire/nutrition-save.
 * Причины — см. /api/questionnaire/save и upsertQuestionnaire.
 */
export async function upsertNutritionQuestionnaire(
  answers: NutritionAnswers
): Promise<NutritionQuestionnaire> {
  const { token, status } = await getAccessTokenWithRecovery()
  if (!token) {
    if (status === 'expired' || status === 'refresh_failed') {
      throw new Error('Сессия истекла. Перезайдите.')
    }
    throw new Error('Не удалось определить пользователя. Перезайдите.')
  }

  const res = await withTimeout(
    fetch('/api/questionnaire/nutrition-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answers }),
    }),
    'upsertNutritionQuestionnaire',
    15_000,
  )

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.error) message = j.error
    } catch {}
    throw new Error('Ошибка сохранения анкеты питания: ' + message)
  }

  const j = await res.json()
  return j.data as NutritionQuestionnaire
}

export async function isNutritionQuestionnaireCompleted(): Promise<boolean> {
  const user = await safeGetUser()
  if (!user) return false

  const supabase = createClient()
  try {
    const { data } = await withTimeout<{ data: { id: string } | null; error: any }>(
      supabase
        .from('client_nutrition_questionnaires')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
      'isNutritionQuestionnaireCompleted',
    )

    return !!data
  } catch (e) {
    console.error('[Nutrition] isNutritionQuestionnaireCompleted timeout/network:', e)
    // Безопасный дефолт — false. При сетевой ошибке лучше дать пользователю
    // увидеть форму анкеты (она сама проверит state на сервере и предзаполнит
    // данные если они есть), чем оставить его на dashboard без возможности
    // вернуться к заполнению.
    return false
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Форматирование для копирования админом (единым блоком текста)
// ──────────────────────────────────────────────────────────────────────────

const GOAL_MAP: Record<string, string> = {
  cut_keep_muscle: 'Снизить жир при сохранении мышц',
  bulk_lean: 'Набор мышечной массы с минимальным жиром',
  recomp: 'Рекомпозиция (худеть и набирать одновременно)',
  maintain: 'Поддерживать вес, улучшить качество питания',
}

const JOB_MAP: Record<string, string> = {
  sedentary: 'Сидячая',
  mixed: 'Смешанная',
  active: 'Активная',
  physical: 'Физически тяжёлая',
}

const DIET_CURRENT_MAP: Record<string, string> = {
  eat_anything: 'Ем всё подряд, не слежу',
  trying_healthy: 'Стараюсь питаться правильно, но без системы',
  tracks_calories: 'Слежу за калориями',
  tracks_calories_protein: 'Слежу за калориями и белком',
  other: 'Другое',
}

const PORTION_MAP: Record<string, string> = {
  small: 'Маленькая',
  medium: 'Средняя',
  large: 'Большая',
}

const DIET_TYPE_MAP: Record<string, string> = {
  omnivore: 'Ем всё',
  vegetarian: 'Вегетарианец (не ем мясо)',
  pescatarian_no: 'Не ем мясо и рыбу',
  vegan: 'Веган',
  other: 'Другое',
}

const DAIRY_MAP: Record<string, string> = {
  normal: 'Ем нормально',
  limited: 'Ограниченно',
  avoid: 'Избегаю',
}

const COOKING_MAP: Record<string, string> = {
  self_daily: 'Готовлю сам каждый день',
  self_partial: 'Готовлю несколько раз в неделю',
  ready_food: 'В основном готовая еда / доставка',
  mixed: 'Смешанно',
}

const COOK_TIME_MAP: Record<string, string> = {
  under_15: 'До 15 минут',
  '15_30': '15–30 минут',
  '30_60': '30–60 минут',
  no_limit: 'Время не ограничено',
}

const TRIGGER_MAP: Record<string, string> = {
  stress: 'Стресс',
  boredom: 'Скука / усталость',
  social: 'Компания и социальные ситуации',
  see_food: 'Вижу еду — не могу остановиться',
  other: 'Другое',
}

const PLAN_FORMAT_MAP: Record<string, string> = {
  ready_menu: 'Готовое меню с блюдами и рецептами',
  flexible_template: 'Гибкий шаблон по КБЖУ — подставляю свои продукты',
  products_list: 'Список продуктов и порций без привязки к блюдам',
}

const MEALS_COUNT_MAP: Record<string, string> = {
  '2_3': '2–3 раза (крупные порции)',
  '4_5': '4–5 раз (средние порции)',
  any: 'Не принципиально',
}

export function formatNutritionForAdmin(
  q: NutritionQuestionnaire,
  profile?: { full_name?: string; email?: string }
): string {
  const a = q.answers || {}
  const val = (v: any) => (v === undefined || v === null || v === '' ? '—' : v)
  const pick = (map: Record<string, string>, key?: string) =>
    key ? map[key] || key : '—'

  const lines: string[] = []
  lines.push(`🥗 АНКЕТА ПО ПИТАНИЮ: ${profile?.full_name || '—'} (${profile?.email || '—'})`)
  lines.push(`Дата заполнения: ${new Date(q.created_at).toLocaleDateString('ru-RU')}`)
  lines.push('')

  lines.push('━━━ БЛОК 1. Основные данные и цель ━━━')
  lines.push(`Вес: ${val(a.current_weight_kg)}${a.current_weight_kg ? ' кг' : ''}`)
  lines.push(`Рост: ${val(a.height_cm)}${a.height_cm ? ' см' : ''}`)
  lines.push(`Возраст: ${val(a.age)}`)
  lines.push(`Пол: ${a.gender === 'male' ? 'Мужской' : a.gender === 'female' ? 'Женский' : '—'}`)
  lines.push(`Цель: ${pick(GOAL_MAP, a.nutrition_goal)}`)
  lines.push(`Желаемый вес / % жира: ${val(a.target_weight)}`)
  lines.push(`Срок: ${val(a.target_deadline)}`)
  lines.push('')

  lines.push('━━━ БЛОК 2. Активность и образ жизни ━━━')
  lines.push(`Деятельность: ${pick(JOB_MAP, a.job_activity)}`)
  lines.push(`Тренировок в неделю: ${val(a.workouts_per_week)}`)
  lines.push(`Длительность тренировки: ${a.workout_duration_min ? `${a.workout_duration_min} мин` : '—'}`)
  lines.push(`Тип тренировок: ${val(a.workout_type)}`)
  lines.push(`Шагов в день: ${val(a.steps_per_day)}`)
  lines.push('')

  lines.push('━━━ БЛОК 3. Текущее питание ━━━')
  lines.push(`Приёмов пищи в день: ${val(a.meals_per_day)}`)
  lines.push(`Завтракает: ${a.breakfast_habit === 'yes' ? 'Да' : a.breakfast_habit === 'no' ? 'Нет' : a.breakfast_habit === 'sometimes' ? 'Иногда' : '—'}`)
  lines.push(`Первый приём пищи: ${val(a.first_meal_time)}`)
  lines.push(`Последний приём пищи: ${val(a.last_meal_time)}`)
  lines.push(`Описание питания: ${pick(DIET_CURRENT_MAP, a.current_diet_description)}${a.current_diet_other ? ` — ${a.current_diet_other}` : ''}`)
  lines.push(`Раньше считал(а) КБЖУ: ${val(a.tracked_kcal_before)}`)
  lines.push(`Размер порции: ${pick(PORTION_MAP, a.portion_size)}`)
  lines.push('')

  lines.push('━━━ БЛОК 4. Ограничения и предпочтения ━━━')
  lines.push(`Аллергии: ${val(a.allergies)}`)
  lines.push(`Не ем принципиально: ${val(a.excluded_by_principle)}`)
  lines.push(`Не нравятся продукты: ${val(a.disliked_foods)}`)
  lines.push(`Тип питания: ${pick(DIET_TYPE_MAP, a.diet_type)}${a.diet_type_other ? ` — ${a.diet_type_other}` : ''}`)
  lines.push(`Непереносимость лактозы/глютена: ${val(a.lactose_gluten_intolerance)}`)
  lines.push(`Молочные продукты: ${pick(DAIRY_MAP, a.dairy_attitude)}`)
  lines.push('')

  lines.push('━━━ БЛОК 5. Условия и реальность жизни ━━━')
  lines.push(`Готовит: ${pick(COOKING_MAP, a.cooking_mode)}`)
  lines.push(`Готов тратить на готовку: ${pick(COOK_TIME_MAP, a.cooking_time)}`)
  lines.push(`Возможность брать еду на работу: ${a.can_take_to_work === 'yes' ? 'Да' : a.can_take_to_work === 'no' ? 'Нет' : a.can_take_to_work === 'sometimes' ? 'Иногда' : '—'}`)
  lines.push(`Будни: ${val(a.weekday_eating)}`)
  lines.push(`Выходные: ${val(a.weekend_eating)}`)
  lines.push('')

  lines.push('━━━ БЛОК 6. Сложности и паттерны ━━━')
  lines.push(`Поздние ужины: ${val(a.late_evening_eating)}`)
  lines.push(`Срывы / переедания: ${val(a.binges_frequency)}`)
  const triggers = (a.binge_triggers || []).map(t => TRIGGER_MAP[t] || t).join(', ')
  lines.push(`Провоцирует срыв: ${triggers || '—'}${a.binge_triggers_other ? ` (${a.binge_triggers_other})` : ''}`)
  lines.push(`Тяга к сладкому: ${val(a.sweet_craving)}`)
  lines.push(`Тяга к солёному/жирному: ${val(a.salty_fatty_craving)}`)
  lines.push(`Алкоголь: ${val(a.alcohol_frequency)}`)
  lines.push('')

  lines.push('━━━ БЛОК 7. Здоровье и медицина ━━━')
  lines.push(`Заболевания обмена веществ: ${val(a.metabolic_conditions)}`)
  lines.push(`Проблемы с ЖКТ: ${val(a.gi_issues)}`)
  lines.push(`Препараты, влияющие на вес/аппетит: ${val(a.medications)}`)
  if (a.gender === 'female') {
    lines.push(`Цикл / СПКЯ: ${val(a.female_cycle)}`)
  }
  lines.push('')

  lines.push('━━━ БЛОК 8. Спортивное питание ━━━')
  lines.push(`Текущие добавки: ${val(a.current_supplements)}`)
  lines.push(`Готов принимать протеин: ${a.protein_ok === 'yes' ? 'Да' : a.protein_ok === 'no' ? 'Нет' : a.protein_ok === 'unsure' ? 'Не уверен' : '—'}`)
  lines.push('')

  lines.push('━━━ БЛОК 9. Ожидания от плана ━━━')
  lines.push(`Формат плана: ${pick(PLAN_FORMAT_MAP, a.plan_format)}`)
  lines.push(`Кол-во приёмов пищи: ${pick(MEALS_COUNT_MAP, a.comfortable_meals_count)}`)
  lines.push(`Любимые продукты: ${val(a.favorite_foods)}`)
  lines.push(`Прошлый опыт диет: ${val(a.past_diets_experience)}`)

  return lines.join('\n')
}

// Экспорт карт для использования на странице/в админке
export const NUTRITION_LABELS = {
  GOAL_MAP,
  JOB_MAP,
  DIET_CURRENT_MAP,
  PORTION_MAP,
  DIET_TYPE_MAP,
  DAIRY_MAP,
  COOKING_MAP,
  COOK_TIME_MAP,
  TRIGGER_MAP,
  PLAN_FORMAT_MAP,
  MEALS_COUNT_MAP,
}
