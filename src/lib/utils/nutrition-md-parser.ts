// MetaSystem v2 — Nutrition Plan Markdown Parser
// Парсер плана питания из Markdown в структурированный JSON

import type { NutritionPlanData, NutritionDay, NutritionMeal, NutritionDish } from '@/lib/services/nutrition-programs'

/**
 * Формат Markdown плана питания:
 *
 * # План питания №1
 * **Период:** 2026-05-14 — 2026-05-21
 * **Калории:** 2200 ккал | **Белок:** 180 г | **Жиры:** 70 г | **Углеводы:** 220 г
 * **Рекомендация:** Общая рекомендация тренера на неделю.
 *
 * ## День 1: Тренировочный день
 * **Рекомендация дня:** Сегодня тренировка — увеличь углеводы в обеде.
 * **Вода:** 2.5 л
 *
 * ### 🌅 Завтрак (08:00) | 450 ккал | Б: 35г | Ж: 15г | У: 45г
 * - Овсянка на воде — 80 г | 290 ккал | Б: 10г | Ж: 5г | У: 55г
 * - Яйца варёные — 2 шт | 140 ккал | Б: 12г | Ж: 10г | У: 1г
 * - Банан — 1 шт | 90 ккал | Б: 1г | Ж: 0г | У: 23г
 * > Приготовление: Сварить овсянку на воде, добавить банан. Яйца вкрутую.
 *
 * ### ☀️ Обед (13:00) | 650 ккал | Б: 55г | Ж: 20г | У: 65г
 * - Куриная грудка — 200 г | 220 ккал | Б: 46г | Ж: 3г | У: 0г
 * - Гречка — 100 г (сухой) | 330 ккал | Б: 13г | Ж: 3г | У: 68г
 * - Огурец + помидор — 200 г | 40 ккал | Б: 2г | Ж: 0г | У: 8г
 * > Приготовление: Куриную грудку запечь или отварить. Гречку сварить.
 *
 * ### 🌙 Ужин (19:00) | 500 ккал | Б: 45г | Ж: 20г | У: 35г
 * - Лосось — 150 г | 280 ккал | Б: 30г | Ж: 17г | У: 0г
 * - Брокколи — 200 г | 70 ккал | Б: 6г | Ж: 1г | У: 12г
 * - Рис бурый — 60 г (сухой) | 210 ккал | Б: 5г | Ж: 2г | У: 44г
 *
 * ---
 */

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

function getDayOfWeek(dayNumber: number): string {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][
    (dayNumber - 1) % 7
  ] || 'monday'
}

/**
 * Парсит строку вида "450 ккал | Б: 35г | Ж: 15г | У: 45г"
 */
function parseMacros(str: string): { kcal?: number; protein?: number; fat?: number; carbs?: number } {
  const result: { kcal?: number; protein?: number; fat?: number; carbs?: number } = {}

  const kcalMatch = str.match(/(\d+)\s*ккал/i)
  if (kcalMatch) result.kcal = parseInt(kcalMatch[1])

  const proteinMatch = str.match(/[Бб]:\s*(\d+)/i)
  if (proteinMatch) result.protein = parseInt(proteinMatch[1])

  const fatMatch = str.match(/[Жж]:\s*(\d+)/i)
  if (fatMatch) result.fat = parseInt(fatMatch[1])

  const carbsMatch = str.match(/[Уу]:\s*(\d+)/i)
  if (carbsMatch) result.carbs = parseInt(carbsMatch[1])

  return result
}

/**
 * Парсит строку блюда вида:
 * "- Куриная грудка — 200 г | 220 ккал | Б: 46г | Ж: 3г | У: 0г"
 */
function parseDishLine(line: string): NutritionDish | null {
  // Убираем ведущий дефис
  const clean = line.replace(/^-\s*/, '').trim()
  if (!clean) return null

  // Разбиваем по " — " или " - " для отделения названия от количества
  const parts = clean.split(/\s*[—–-]\s*/)
  const name = parts[0].trim()
  if (!name) return null

  const rest = parts.slice(1).join(' — ')
  const macros = parseMacros(rest)

  // Ищем количество (первая часть после тире до |)
  const amountMatch = rest.match(/^([^|]+?)(?:\s*\||\s*$)/)
  let amount: string | undefined
  if (amountMatch) {
    const candidate = amountMatch[1].trim()
    // Проверяем что это не КБЖУ
    if (!candidate.match(/ккал|[БбЖжУу]:/i)) {
      amount = candidate
    }
  }

  return {
    id: generateId(name),
    name,
    amount,
    ...macros,
  }
}

export function parseNutritionMdToJson(markdown: string): NutritionPlanData {
  const lines = markdown.split('\n').map(l => l.trim())

  // Номер плана
  const planMatch = lines.find(l => l.startsWith('# '))
  const planNumberMatch = planMatch?.match(/№?\s*(\d+)/)
  const planNumber = planNumberMatch ? parseInt(planNumberMatch[1]) : 1

  // Даты
  const dateLine = lines.find(l => l.includes('**Период:**'))
  let startDate = ''
  let endDate = ''
  if (dateLine) {
    const dateStr = dateLine.replace('**Период:**', '').trim()
    const dates = dateStr.split(/[—–]/).map(d => d.trim())
    startDate = dates[0] || ''
    endDate = dates[1] || ''
  }

  // Целевые КБЖУ
  const kcalLine = lines.find(l => l.includes('**Калории:**') || l.includes('**КБЖУ:**'))
  let dailyKcal: number | undefined
  let dailyProtein: number | undefined
  let dailyFat: number | undefined
  let dailyCarbs: number | undefined
  if (kcalLine) {
    const macros = parseMacros(kcalLine)
    dailyKcal = macros.kcal
    dailyProtein = macros.protein
    dailyFat = macros.fat
    dailyCarbs = macros.carbs
  }

  // Общая рекомендация (до первого ##)
  let weeklyNote = ''
  for (const l of lines) {
    if (l.startsWith('## ')) break
    const m = l.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
    if (m) { weeklyNote = m[1].trim(); break }
  }

  const days: NutritionDay[] = []
  let currentDay: NutritionDay | null = null
  let currentMeal: NutritionMeal | null = null
  let currentRecipe = ''

  const pushMeal = () => {
    if (currentMeal && currentDay) {
      if (currentRecipe) {
        // Добавляем рецепт к последнему блюду или к приёму пищи
        if (currentMeal.dishes.length > 0) {
          currentMeal.dishes[currentMeal.dishes.length - 1].recipe = currentRecipe.trim()
        } else {
          currentMeal.note = currentRecipe.trim()
        }
        currentRecipe = ''
      }
      currentDay.meals.push(currentMeal)
      currentMeal = null
    }
  }

  const pushDay = () => {
    pushMeal()
    if (currentDay) {
      // Считаем суммарные КБЖУ дня если не указаны явно
      if (!currentDay.totalKcal) {
        let kcal = 0, prot = 0, fat = 0, carbs = 0
        for (const meal of currentDay.meals) {
          kcal += meal.kcal || 0
          prot += meal.protein || 0
          fat += meal.fat || 0
          carbs += meal.carbs || 0
        }
        if (kcal > 0) currentDay.totalKcal = kcal
        if (prot > 0) currentDay.totalProtein = prot
        if (fat > 0) currentDay.totalFat = fat
        if (carbs > 0) currentDay.totalCarbs = carbs
      }
      days.push(currentDay)
      currentDay = null
    }
  }

  for (const line of lines) {
    // ## День N: Название
    const dayMatch =
      line.match(/^##\s+(?:.*?)?День\s*(\d+):?\s*(.*)/i) ||
      line.match(/^##\s+(?:.*?)?Day\s*(\d+):?\s*(.*)/i)

    if (dayMatch) {
      pushDay()
      currentDay = {
        dayNumber: parseInt(dayMatch[1]),
        dayOfWeek: getDayOfWeek(parseInt(dayMatch[1])),
        title: dayMatch[2].trim() || `День ${dayMatch[1]}`,
        meals: [],
      }
      continue
    }

    if (!currentDay) continue

    // Рекомендация дня
    if (!currentMeal) {
      const noteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
      if (noteMatch) { currentDay.coachNote = noteMatch[1].trim(); continue }

      // Вода
      const waterMatch = line.match(/^\*\*Вода:\*\*\s*(.+)/i)
      if (waterMatch) { currentDay.waterGoal = waterMatch[1].trim(); continue }

      // КБЖУ дня
      const dayKcalMatch = line.match(/^\*\*(?:Итого|КБЖУ|Калории)[^:]*:\*\*\s*(.+)/i)
      if (dayKcalMatch) {
        const macros = parseMacros(dayKcalMatch[1])
        if (macros.kcal) currentDay.totalKcal = macros.kcal
        if (macros.protein) currentDay.totalProtein = macros.protein
        if (macros.fat) currentDay.totalFat = macros.fat
        if (macros.carbs) currentDay.totalCarbs = macros.carbs
        continue
      }
    }

    // ### Приём пищи
    if (line.startsWith('###')) {
      pushMeal()
      const mealTitle = line.replace(/^###\s*/, '').trim()
      const macros = parseMacros(mealTitle)

      // Извлекаем время из скобок: "Завтрак (08:00)"
      const timeMatch = mealTitle.match(/\((\d{1,2}:\d{2})\)/)
      const time = timeMatch ? timeMatch[1] : undefined

      // Чистое название без КБЖУ и времени
      const cleanName = mealTitle
        .replace(/\([\d:]+\)/, '')
        .replace(/\|.*$/, '')
        .replace(/[🌅☀️🌙🍎🥗🌮🍽️]/g, '')
        .trim()

      currentMeal = {
        id: generateId(cleanName || mealTitle),
        name: cleanName || mealTitle,
        time,
        dishes: [],
        ...macros,
      }
      continue
    }

    if (!currentMeal) continue

    // Рецепт/заметка к приёму пищи (строка начинается с >)
    if (line.startsWith('>')) {
      const recipe = line.replace(/^>\s*(?:Приготовление:|Рецепт:|Заметка:)?\s*/i, '').trim()
      currentRecipe += (currentRecipe ? ' ' : '') + recipe
      continue
    }

    // Блюдо: строка начинается с -
    if (line.startsWith('-')) {
      const dish = parseDishLine(line)
      if (dish) currentMeal.dishes.push(dish)
      continue
    }

    // Заметка к приёму пищи (обычный текст после блюд)
    if (currentMeal && line && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-') && !line.startsWith('---')) {
      if (!currentMeal.note) currentMeal.note = line
    }
  }

  pushDay()

  return {
    planNumber,
    startDate,
    endDate,
    days,
    weeklyNote: weeklyNote || undefined,
    dailyKcal,
    dailyProtein,
    dailyFat,
    dailyCarbs,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Шаблон плана питания для примера
// ──────────────────────────────────────────────────────────────────────────

export const EXAMPLE_NUTRITION_MD = `# План питания №1

**Период:** 2026-05-14 — 2026-05-21
**Калории:** 2200 ккал | **Белок:** 180 г | **Жиры:** 70 г | **Углеводы:** 220 г
**Рекомендация:** Первая неделя — адаптационная. Не нужно считать каждый грамм, просто придерживайся структуры приёмов пищи и старайся попадать в белок. Пей воду равномерно в течение дня.

## День 1: Тренировочный день
**Рекомендация дня:** Сегодня тренировка — не пропускай углеводы в обеде, они дадут энергию. После тренировки — обязательно белок в течение 30–60 минут.
**Вода:** 2.5 л

### 🌅 Завтрак (08:00) | 480 ккал | Б: 38г | Ж: 14г | У: 50г
- Овсянка на воде — 80 г | 290 ккал | Б: 10г | Ж: 5г | У: 55г
- Яйца варёные — 2 шт | 140 ккал | Б: 12г | Ж: 10г | У: 1г
- Банан — 1 шт | 90 ккал | Б: 1г | Ж: 0г | У: 23г
> Приготовление: Сварить овсянку на воде без соли и сахара. Добавить нарезанный банан. Яйца вкрутую (8–10 минут).

### ☀️ Обед (13:00) | 680 ккал | Б: 58г | Ж: 18г | У: 68г
- Куриная грудка — 200 г | 220 ккал | Б: 46г | Ж: 3г | У: 0г
- Гречка — 100 г (сухой) | 330 ккал | Б: 13г | Ж: 3г | У: 68г
- Огурец + помидор — 200 г | 40 ккал | Б: 2г | Ж: 0г | У: 8г
- Оливковое масло — 10 г | 90 ккал | Б: 0г | Ж: 10г | У: 0г
> Приготовление: Куриную грудку запечь при 180°C 25 минут или отварить. Гречку сварить 1:2 с водой. Овощи нарезать, заправить маслом.

### 🍎 Перекус (16:00) | 250 ккал | Б: 25г | Ж: 8г | У: 20г
- Творог 5% — 150 г | 160 ккал | Б: 21г | Ж: 7г | У: 3г
- Яблоко — 1 шт | 80 ккал | Б: 0г | Ж: 0г | У: 20г
- Грецкие орехи — 15 г | 100 ккал | Б: 2г | Ж: 10г | У: 2г

### 🌙 Ужин (19:30) | 520 ккал | Б: 48г | Ж: 22г | У: 30г
- Лосось — 150 г | 280 ккал | Б: 30г | Ж: 17г | У: 0г
- Брокколи — 200 г | 70 ккал | Б: 6г | Ж: 1г | У: 12г
- Рис бурый — 60 г (сухой) | 210 ккал | Б: 5г | Ж: 2г | У: 44г
> Приготовление: Лосось запечь с лимоном и специями при 200°C 15–18 минут. Брокколи отварить или приготовить на пару 5–7 минут.

---

## День 2: День отдыха
**Рекомендация дня:** День без тренировки — немного снижаем углеводы, белок оставляем на том же уровне. Можно добавить больше овощей.
**Вода:** 2 л

### 🌅 Завтрак (09:00) | 420 ккал | Б: 35г | Ж: 18г | У: 30г
- Яичница — 3 яйца | 210 ккал | Б: 18г | Ж: 15г | У: 1г
- Цельнозерновой хлеб — 2 ломтика | 140 ккал | Б: 6г | Ж: 2г | У: 28г
- Авокадо — 50 г | 80 ккал | Б: 1г | Ж: 7г | У: 3г
> Приготовление: Яичницу приготовить на сухой сковороде или с минимумом масла. Авокадо намазать на хлеб.

### ☀️ Обед (13:00) | 600 ккал | Б: 52г | Ж: 20г | У: 50г
- Говядина (вырезка) — 180 г | 270 ккал | Б: 36г | Ж: 14г | У: 0г
- Картофель запечённый — 200 г | 160 ккал | Б: 4г | Ж: 0г | У: 36г
- Салат из свежих овощей — 200 г | 60 ккал | Б: 2г | Ж: 3г | У: 8г
> Приготовление: Говядину обжарить на сковороде или запечь. Картофель нарезать дольками, запечь с розмарином при 200°C 30 минут.

### 🍎 Перекус (16:30) | 200 ккал | Б: 20г | Ж: 5г | У: 18г
- Греческий йогурт 2% — 200 г | 120 ккал | Б: 20г | Ж: 2г | У: 6г
- Черника — 100 г | 57 ккал | Б: 1г | Ж: 0г | У: 14г

### 🌙 Ужин (19:00) | 480 ккал | Б: 45г | Ж: 20г | У: 25г
- Треска — 200 г | 160 ккал | Б: 36г | Ж: 1г | У: 0г
- Тушёные овощи (кабачок, перец, лук) — 300 г | 120 ккал | Б: 4г | Ж: 5г | У: 18г
- Оливковое масло — 15 г | 135 ккал | Б: 0г | Ж: 15г | У: 0г
> Приготовление: Треску запечь или приготовить на пару. Овощи потушить на оливковом масле 15–20 минут.

---

## День 3: Тренировочный день
**Рекомендация дня:** Тяжёлая тренировка — максимальные углеводы сегодня. Не бойся есть больше, тело это использует.
**Вода:** 3 л

### 🌅 Завтрак (08:00) | 520 ккал | Б: 40г | Ж: 12г | У: 65г
- Овсянка на молоке — 100 г | 380 ккал | Б: 14г | Ж: 8г | У: 65г
- Яйца варёные — 2 шт | 140 ккал | Б: 12г | Ж: 10г | У: 1г
- Мёд — 10 г | 30 ккал | Б: 0г | Ж: 0г | У: 8г

### ☀️ Обед (12:30) | 720 ккал | Б: 60г | Ж: 18г | У: 80г
- Куриная грудка — 220 г | 242 ккал | Б: 51г | Ж: 3г | У: 0г
- Рис белый — 120 г (сухой) | 420 ккал | Б: 9г | Ж: 1г | У: 93г
- Огурец — 150 г | 20 ккал | Б: 1г | Ж: 0г | У: 4г

### 🍎 Перекус до тренировки (15:30) | 280 ккал | Б: 20г | Ж: 5г | У: 40г
- Банан — 2 шт | 180 ккал | Б: 2г | Ж: 0г | У: 46г
- Творог 5% — 100 г | 107 ккал | Б: 14г | Ж: 5г | У: 2г

### 💪 После тренировки (18:30) | 300 ккал | Б: 35г | Ж: 3г | У: 35г
- Протеиновый коктейль — 1 порция | 150 ккал | Б: 25г | Ж: 2г | У: 5г
- Банан — 1 шт | 90 ккал | Б: 1г | Ж: 0г | У: 23г
- Рисовые хлебцы — 3 шт | 90 ккал | Б: 2г | Ж: 0г | У: 20г

### 🌙 Ужин (20:00) | 450 ккал | Б: 42г | Ж: 18г | У: 28г
- Индейка — 180 г | 220 ккал | Б: 38г | Ж: 6г | У: 0г
- Гречка — 80 г (сухой) | 264 ккал | Б: 10г | Ж: 2г | У: 54г
- Брокколи — 150 г | 52 ккал | Б: 5г | Ж: 1г | У: 9г

---
`
