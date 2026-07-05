// MetaSystem v2 — Questionnaire Service
// Сервис для работы с анкетами клиентов

import { createClient, safeGetUser, getAccessTokenWithRecovery } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/utils/with-timeout'

export interface ClientQuestionnaire {
  id: string
  user_id: string

  // Блок 1: Основные данные
  full_name?: string
  age?: number
  gender?: 'male' | 'female'
  height_cm?: number
  weight_kg?: number
  female_cycle?: 'regular' | 'hormonal' | 'irregular' | 'menopause'

  // Блок 2: Цель
  goal?: string
  goal_deadline?: string
  goal_motivation?: number

  // Блок 3: Тренировочный опыт
  training_experience?: string
  fitness_level?: string
  previous_training_types?: string[]
  training_breaks?: string
  previous_program?: string

  // Блок 4: Текущие показатели силы
  strength_squat?: number
  strength_bench?: number
  strength_deadlift?: number
  strength_pullups?: number
  strength_pushups?: number

  // Блок 5: Условия тренировок
  training_location?: string
  home_equipment?: string
  preferred_training_days?: number
  session_duration?: string
  training_time?: string

  // Блок 6: Здоровье и ограничения
  has_injuries?: boolean
  injury_zones?: string[]
  injury_impact?: string
  surgeries?: string
  chronic_conditions?: string[]
  medications?: string

  // Блок 7: Восстановление и образ жизни
  sleep_hours_avg?: number
  sleep_quality?: string
  stress_level?: number
  activity_level?: string
  supplements?: string[]

  // Блок 8: Дополнительно
  nutrition_style?: string
  additional_notes?: string

  // Начальные замеры (остаются)
  waist_cm?: number
  hips_cm?: number
  chest_cm?: number
  arm_cm?: number
  thigh_cm?: number

  // Фото
  photo_front?: string
  photo_side?: string
  photo_back?: string

  // Устаревшие поля (для обратной совместимости)
  available_equipment?: string[]
  injuries?: string
  health_conditions?: string

  created_at: string
  updated_at: string
}

export type QuestionnaireFormData = Omit<ClientQuestionnaire, 'id' | 'user_id' | 'created_at' | 'updated_at'>

// ──────────────────────────────────────────────────────────────────────────
// Форматирование анкеты для копирования (для админа)
// ──────────────────────────────────────────────────────────────────────────

const GOAL_MAP: Record<string, string> = {
  muscle_gain: 'Набор мышечной массы',
  fat_loss: 'Похудение / снижение % жира',
  strength: 'Развитие силы',
  general_fitness: 'Улучшение общей физической формы',
  competition: 'Подготовка к соревнованиям',
  rehabilitation: 'Реабилитация и восстановление',
}

const EXP_MAP: Record<string, string> = {
  none: 'Никогда не тренировался / перерыв больше года',
  under_1: 'До 1 года',
  '1_3': '1–3 года',
  over_3: 'Более 3 лет',
}

const LEVEL_MAP: Record<string, string> = {
  beginner: 'Новичок — базовые упражнения даются с трудом',
  intermediate: 'Средний — уверенно выполняю базовые упражнения',
  advanced: 'Продвинутый — работаю с тяжёлыми весами, хорошая техника',
}

const LOCATION_MAP: Record<string, string> = {
  gym: 'Тренажёрный зал (полное оборудование)',
  home_equipment: 'Дома (гантели, турник, скамья)',
  home_bodyweight: 'Дома (только вес тела)',
  mixed: 'Смешанно (зал и дома)',
}

const DURATION_MAP: Record<string, string> = {
  under_45: 'До 45 минут',
  '45_60': '45–60 минут',
  '60_90': '60–90 минут',
  over_90: 'Более 90 минут',
}

const TIME_MAP: Record<string, string> = {
  morning: 'Утро (6:00–10:00)',
  day: 'День (10:00–16:00)',
  evening: 'Вечер (16:00–21:00)',
  varies: 'По-разному',
}

const INJURY_IMPACT_MAP: Record<string, string> = {
  mild: 'Лёгкий дискомфорт, могу тренироваться',
  avoid: 'Избегаю определённых упражнений',
  severe: 'Серьёзно ограничивает тренировки',
}

const BREAKS_MAP: Record<string, string> = {
  none: 'Нет, тренировался(ась) стабильно',
  '1_3': 'Да, перерыв 1–3 месяца',
  over_3: 'Да, перерыв более 3 месяцев',
}

const SLEEP_QUALITY_MAP: Record<string, string> = {
  good: 'Засыпаю легко, сплю хорошо',
  hard_to_fall: 'Бывают проблемы с засыпанием',
  wake_up: 'Часто просыпаюсь ночью',
  bad: 'Сон плохой регулярно',
}

const STRESS_MAP: Record<string, string> = {
  low: 'Низкий — всё спокойно',
  medium: 'Средний — бывает напряжённо',
  high: 'Высокий — постоянный стресс',
}

const ACTIVITY_MAP: Record<string, string> = {
  sedentary: 'Сидячая (офис, компьютер)',
  mixed: 'Смешанная (и сижу, и хожу)',
  active: 'Активная (на ногах весь день)',
  physical: 'Физически тяжёлая',
}

const NUTRITION_MAP: Record<string, string> = {
  healthy: 'Стараюсь питаться правильно',
  chaotic: 'Питаюсь хаотично',
  tracking: 'Слежу за калориями и белком',
  restricted: 'Есть ограничения (вегетарианство, аллергии)',
}

const FEMALE_CYCLE_MAP: Record<string, string> = {
  regular: 'Регулярный цикл',
  hormonal: 'Принимаю гормональные контрацептивы',
  irregular: 'Нерегулярный или отсутствует',
  menopause: 'Менопауза / перименопауза',
}

const TRAINING_TYPES_MAP: Record<string, string> = {
  weights: 'Силовые (штанги, гантели)',
  machines: 'Тренажёры',
  crossfit: 'Кроссфит / функциональный тренинг',
  cardio: 'Кардио (бег, велосипед, плавание)',
  martial_arts: 'Единоборства / командный спорт',
  none: 'Ничего из перечисленного',
}

const INJURY_ZONES_MAP: Record<string, string> = {
  lower_back: 'Поясница',
  knees: 'Колени',
  shoulders: 'Плечи',
  neck: 'Шея',
  elbows: 'Локти / запястья',
  hips: 'Тазобедренный сустав',
}

const CHRONIC_MAP: Record<string, string> = {
  cardiovascular: 'Сердечно-сосудистые заболевания',
  diabetes: 'Диабет / нарушение обмена веществ',
  hypertension: 'Гипертония',
  spine: 'Проблемы с позвоночником (грыжа, сколиоз)',
  none: 'Нет ничего из перечисленного',
}

const SUPPLEMENTS_MAP: Record<string, string> = {
  protein: 'Протеин',
  creatine: 'Креатин',
  vitamins: 'Витамины / омега-3',
  none: 'Ничего не принимаю',
}

export function formatQuestionnaireForAdmin(
  q: ClientQuestionnaire,
  profile?: { full_name?: string; email?: string }
): string {
  const val = (v: any) => (v === undefined || v === null || v === '' ? '—' : v)
  const pick = (map: Record<string, string>, key?: string) =>
    key ? map[key] || key : '—'
  const pickArr = (map: Record<string, string>, arr?: string[]) =>
    arr && arr.length > 0 ? arr.map(k => map[k] || k).join(', ') : '—'

  const lines: string[] = []
  lines.push(`💪 АНКЕТА КЛИЕНТА: ${q.full_name || profile?.full_name || '—'} (${profile?.email || '—'})`)
  lines.push(`Дата заполнения: ${new Date(q.created_at).toLocaleDateString('ru-RU')}`)
  lines.push('')

  lines.push('━━━ БЛОК 1. Основные данные ━━━')
  lines.push(`Имя: ${val(q.full_name || profile?.full_name)}`)
  lines.push(`Возраст: ${val(q.age)}`)
  lines.push(`Пол: ${q.gender === 'male' ? 'Мужской' : q.gender === 'female' ? 'Женский' : '—'}`)
  lines.push(`Вес: ${q.weight_kg ? q.weight_kg + ' кг' : '—'}`)
  lines.push(`Рост: ${q.height_cm ? q.height_cm + ' см' : '—'}`)
  if (q.gender === 'female') {
    lines.push(`Цикл: ${pick(FEMALE_CYCLE_MAP, q.female_cycle)}`)
  }
  lines.push('')

  lines.push('━━━ БЛОК 2. Цель ━━━')
  lines.push(`Главная цель: ${pick(GOAL_MAP, q.goal)}`)
  lines.push(`Дата / событие: ${val(q.goal_deadline)}`)
  lines.push(`Важность результата: ${q.goal_motivation ? q.goal_motivation + '/10' : '—'}`)
  lines.push('')

  lines.push('━━━ БЛОК 3. Тренировочный опыт ━━━')
  lines.push(`Стаж тренировок: ${pick(EXP_MAP, q.training_experience)}`)
  lines.push(`Уровень подготовки: ${pick(LEVEL_MAP, q.fitness_level)}`)
  lines.push(`Виды тренировок: ${pickArr(TRAINING_TYPES_MAP, q.previous_training_types)}`)
  lines.push(`Перерывы за год: ${pick(BREAKS_MAP, q.training_breaks)}`)
  lines.push(`Предыдущая программа: ${val(q.previous_program)}`)
  lines.push('')

  lines.push('━━━ БЛОК 4. Текущие показатели силы ━━━')
  lines.push(`Присед: ${q.strength_squat ? q.strength_squat + ' кг' : '—'}`)
  lines.push(`Жим лёжа: ${q.strength_bench ? q.strength_bench + ' кг' : '—'}`)
  lines.push(`Становая / румынская: ${q.strength_deadlift ? q.strength_deadlift + ' кг' : '—'}`)
  lines.push(`Подтягивания: ${q.strength_pullups !== undefined && q.strength_pullups !== null ? q.strength_pullups + ' раз' : '—'}`)
  lines.push(`Отжимания: ${q.strength_pushups !== undefined && q.strength_pushups !== null ? q.strength_pushups + ' раз' : '—'}`)
  lines.push('')

  lines.push('━━━ БЛОК 5. Условия тренировок ━━━')
  lines.push(`Место: ${pick(LOCATION_MAP, q.training_location)}`)
  if (q.training_location === 'home_equipment') {
    lines.push(`Оборудование дома: ${val(q.home_equipment)}`)
  }
  lines.push(`Дней в неделю: ${val(q.preferred_training_days)}`)
  lines.push(`Длительность тренировки: ${pick(DURATION_MAP, q.session_duration)}`)
  lines.push(`Время тренировок: ${pick(TIME_MAP, q.training_time)}`)
  lines.push('')

  lines.push('━━━ БЛОК 6. Здоровье и ограничения ━━━')
  lines.push(`Травмы / боли: ${q.has_injuries ? 'Да' : 'Нет'}`)
  if (q.has_injuries) {
    lines.push(`Зоны: ${pickArr(INJURY_ZONES_MAP, q.injury_zones)}`)
    lines.push(`Влияние на тренировки: ${pick(INJURY_IMPACT_MAP, q.injury_impact)}`)
  }
  lines.push(`Операции: ${val(q.surgeries)}`)
  lines.push(`Хронические заболевания: ${pickArr(CHRONIC_MAP, q.chronic_conditions)}`)
  lines.push(`Препараты: ${val(q.medications)}`)
  lines.push('')

  lines.push('━━━ БЛОК 7. Восстановление и образ жизни ━━━')
  lines.push(`Сон: ${q.sleep_hours_avg ? q.sleep_hours_avg + ' ч' : '—'}`)
  lines.push(`Качество сна: ${pick(SLEEP_QUALITY_MAP, q.sleep_quality)}`)
  lines.push(`Стресс: ${pick(STRESS_MAP, q.stress_level?.toString())}`)
  lines.push(`Деятельность: ${pick(ACTIVITY_MAP, q.activity_level)}`)
  lines.push(`Спортпит: ${pickArr(SUPPLEMENTS_MAP, q.supplements)}`)
  lines.push('')

  lines.push('━━━ БЛОК 8. Дополнительно ━━━')
  lines.push(`Питание: ${pick(NUTRITION_MAP, q.nutrition_style)}`)
  lines.push(`Доп. информация: ${val(q.additional_notes)}`)

  if (q.waist_cm || q.hips_cm || q.chest_cm || q.arm_cm || q.thigh_cm) {
    lines.push('')
    lines.push('━━━ НАЧАЛЬНЫЕ ЗАМЕРЫ ━━━')
    if (q.waist_cm) lines.push(`Талия: ${q.waist_cm} см`)
    if (q.hips_cm) lines.push(`Бёдра: ${q.hips_cm} см`)
    if (q.chest_cm) lines.push(`Грудь: ${q.chest_cm} см`)
    if (q.arm_cm) lines.push(`Рука: ${q.arm_cm} см`)
    if (q.thigh_cm) lines.push(`Бедро: ${q.thigh_cm} см`)
  }

  return lines.join('\n')
}

export const QUESTIONNAIRE_LABELS = {
  GOAL_MAP, EXP_MAP, LEVEL_MAP, LOCATION_MAP, DURATION_MAP, TIME_MAP,
  INJURY_IMPACT_MAP, BREAKS_MAP, SLEEP_QUALITY_MAP, STRESS_MAP,
  ACTIVITY_MAP, NUTRITION_MAP, FEMALE_CYCLE_MAP, TRAINING_TYPES_MAP,
  INJURY_ZONES_MAP, CHRONIC_MAP, SUPPLEMENTS_MAP,
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────

export async function getMyQuestionnaire(): Promise<ClientQuestionnaire | null> {
  const supabase = createClient()
  // safeGetUser использует кеш + таймаут 4с — не висит, если сеть подвисла
  const user = await safeGetUser()
  if (!user) return null

  try {
    const { data, error } = await withTimeout<{ data: ClientQuestionnaire | null; error: any }>(
      supabase
        .from('client_questionnaires')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      'getMyQuestionnaire',
    )

    if (error) {
      // PGRST116 = "no rows" — это нормально для новой анкеты
      if (error.code !== 'PGRST116') {
        console.error('[Questionnaire] getMyQuestionnaire error:', error)
      }
      return null
    }
    return data
  } catch (e) {
    // Таймаут или сеть — возвращаем null, чтобы UI показал пустую форму,
    // а не висел на спиннере. Анкета всё равно сохранится при отправке.
    console.error('[Questionnaire] getMyQuestionnaire timeout/network:', e)
    return null
  }
}

export async function getQuestionnaireByUserId(userId: string): Promise<ClientQuestionnaire | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('client_questionnaires')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.error('Error fetching questionnaire:', error)
    return null
  }
  return data
}

/**
 * Сохранение анкеты идёт через серверный роут /api/questionnaire/save.
 *
 * Причина: прямой supabase-js upsert из браузера в инкогнито/при флапающей
 * сети висел >15с (см. dev_log fix(questionnaire)). Серверный роут идёт
 * на собственный домен Vercel — без CORS preflight, без клиентского
 * inTabLock, без auto-refresh JWT в середине запроса.
 */
export async function upsertQuestionnaire(
  formData: QuestionnaireFormData
): Promise<ClientQuestionnaire> {
  const { token, status } = await getAccessTokenWithRecovery()
  if (!token) {
    if (status === 'expired' || status === 'refresh_failed') {
      throw new Error('Сессия истекла. Перезайдите.')
    }
    throw new Error('Не удалось определить пользователя. Перезайдите.')
  }

  const res = await withTimeout(
    fetch('/api/questionnaire/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    }),
    'upsertQuestionnaire',
    15_000,
  )

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.error) message = j.error
    } catch {}
    throw new Error('Ошибка сохранения: ' + message)
  }

  const j = await res.json()
  return j.data as ClientQuestionnaire
}

/**
 * Загрузка фото идёт через серверный роут /api/questionnaire/upload-photo.
 * Причины те же, что и в upsertQuestionnaire — обходим CORS/lock/JWT-refresh.
 */
export async function uploadQuestionnairePhoto(
  file: File,
  type: 'front' | 'side' | 'back'
): Promise<string> {
  const { token, status } = await getAccessTokenWithRecovery()
  if (!token) {
    if (status === 'expired' || status === 'refresh_failed') {
      throw new Error('Сессия истекла. Перезайдите.')
    }
    throw new Error('Не удалось определить пользователя. Перезайдите.')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('type', type)

  const res = await withTimeout(
    fetch('/api/questionnaire/upload-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }),
    'uploadQuestionnairePhoto',
    30_000,
  )

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.error) message = j.error
    } catch {}
    throw new Error('Ошибка загрузки фото: ' + message)
  }

  const j = await res.json()
  return j.url as string
}

export async function isQuestionnaireCompleted(): Promise<boolean> {
  const user = await safeGetUser()
  if (!user) return false

  const supabase = createClient()
  try {
    const { data: questionnaire } = await withTimeout<{ data: { id: string } | null; error: any }>(
      supabase
        .from('client_questionnaires')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
      'isQuestionnaireCompleted',
    )

    if (questionnaire) {
      // Обновление флага в profiles делаем fire-and-forget — не блокируем UI:
      // если оно зависнет, страница всё равно идёт дальше с правильным результатом.
      void withTimeout<{ error: any }>(
        supabase
          .from('profiles')
          .update({ questionnaire_completed: true })
          .eq('id', user.id),
        'isQuestionnaireCompleted:updateProfile',
      ).catch(() => {})
      return true
    }
    return false
  } catch (e) {
    console.error('[Questionnaire] isQuestionnaireCompleted timeout/network:', e)
    // Безопасный дефолт — false (НЕ заполнено). Раньше тут было true,
    // и при флапающей сети новичка кидало сразу на /dashboard без анкеты,
    // а с /questionnaire его оттуда снова сносило. Сейчас при ошибке
    // лучше показать форму анкеты — если она реально заполнена,
    // Supabase отдаст данные при предзагрузке и пользователь сможет
    // нажать «Завершить», чтобы вернуться на dashboard.
    return false
  }
}
