// MetaSystem v2 — Nutrition Plan Markdown Parser
// Поддерживает: месячные планы (недели → дни), рецепты, КБЖУ

import type {
  NutritionPlanData, NutritionWeek, NutritionDay,
  NutritionMeal, NutritionDish, NutritionRecipe,
  SportSupplement, SportSupplementsSection,
} from '@/lib/services/nutrition-programs'

// ──────────────────────────────────────────────────────────────────────────
// Вспомогательные функции
// ──────────────────────────────────────────────────────────────────────────

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

/** Парсит "450 ккал | Б: 35г | Ж: 15г | У: 45г" */
function parseMacros(str: string): { kcal?: number; protein?: number; fat?: number; carbs?: number } {
  const r: { kcal?: number; protein?: number; fat?: number; carbs?: number } = {}
  const kcal = str.match(/(\d+)\s*ккал/i)
  if (kcal) r.kcal = parseInt(kcal[1])
  const prot = str.match(/[Бб]:\s*(\d+)/i)
  if (prot) r.protein = parseInt(prot[1])
  const fat = str.match(/[Жж]:\s*(\d+)/i)
  if (fat) r.fat = parseInt(fat[1])
  const carbs = str.match(/[Уу]:\s*(\d+)/i)
  if (carbs) r.carbs = parseInt(carbs[1])
  return r
}

/** Парсит строку блюда: "- Куриная грудка — 200 г | 220 ккал | Б: 46г | Ж: 3г | У: 0г" */
function parseDishLine(line: string): NutritionDish | null {
  const clean = line.replace(/^-\s*/, '').trim()
  if (!clean) return null
  const parts = clean.split(/\s*[—–]\s*/)
  const name = parts[0].trim()
  if (!name) return null
  const rest = parts.slice(1).join(' — ')
  const macros = parseMacros(rest)
  const amountMatch = rest.match(/^([^|]+?)(?:\s*\||\s*$)/)
  let amount: string | undefined
  if (amountMatch) {
    const candidate = amountMatch[1].trim()
    if (!candidate.match(/ккал|[БбЖжУу]:/i)) amount = candidate
  }
  return { id: generateId(name), name, amount, ...macros }
}

// ──────────────────────────────────────────────────────────────────────────
// Парсер рецептов
// Формат:
// # Рецепты
// ## Завтраки
// ### Овсянка с бананом
// **КБЖУ:** 350 ккал | Б: 12г | Ж: 6г | У: 60г
// **Порция:** 1 порция (300 г)
// **Ингредиенты:**
// - Овсянка — 80 г
// - Банан — 1 шт
// **Приготовление:**
// 1. Сварить овсянку на воде
// 2. Добавить нарезанный банан
// ──────────────────────────────────────────────────────────────────────────

function parseRecipesSection(lines: string[]): NutritionRecipe[] {
  const recipes: NutritionRecipe[] = []
  let currentRecipe: NutritionRecipe | null = null
  let currentCategory = ''
  let inIngredients = false
  let inSteps = false

  const pushRecipe = () => {
    if (currentRecipe) recipes.push(currentRecipe)
    currentRecipe = null
    inIngredients = false
    inSteps = false
  }

  for (const line of lines) {
    // Категория: ## Завтраки
    if (line.startsWith('## ')) {
      pushRecipe()
      currentCategory = line.replace(/^##\s*/, '').trim()
      continue
    }

    // Рецепт: ### Название
    if (line.startsWith('### ')) {
      pushRecipe()
      const name = line.replace(/^###\s*/, '').trim()
      currentRecipe = {
        id: generateId(name),
        name,
        category: currentCategory || undefined,
        ingredients: [],
        steps: [],
      }
      inIngredients = false
      inSteps = false
      continue
    }

    if (!currentRecipe) continue

    // КБЖУ
    if (line.match(/^\*\*КБЖУ[^:]*:\*\*/i)) {
      const macros = parseMacros(line)
      Object.assign(currentRecipe, macros)
      continue
    }

    // Порция
    const servingsMatch = line.match(/^\*\*Порция[^:]*:\*\*\s*(.+)/i)
    if (servingsMatch) { currentRecipe.servings = servingsMatch[1].trim(); continue }

    // Заметка
    const noteMatch = line.match(/^\*\*Заметка[^:]*:\*\*\s*(.+)/i)
    if (noteMatch) { currentRecipe.note = noteMatch[1].trim(); continue }

    // Секции
    if (line.match(/^\*\*Ингредиенты[^:]*:\*\*/i)) { inIngredients = true; inSteps = false; continue }
    if (line.match(/^\*\*Приготовление[^:]*:\*\*/i)) { inIngredients = false; inSteps = true; continue }

    // Ингредиенты: - Овсянка — 80 г
    if (inIngredients && line.startsWith('-')) {
      currentRecipe.ingredients.push(line.replace(/^-\s*/, '').trim())
      continue
    }

    // Шаги: 1. Сварить...
    if (inSteps && line.match(/^\d+\.\s/)) {
      currentRecipe.steps.push(line.replace(/^\d+\.\s*/, '').trim())
      continue
    }
  }

  pushRecipe()
  return recipes
}

// ──────────────────────────────────────────────────────────────────────────
// Парсер спортивного питания
// Формат:
// # Спортивное питание
// **Рекомендация:** Базовый набор добавок для поддержки тренировочного процесса.
//
// ## Протеин
// **Доза:** 30 г (1 мерная ложка)
// **Время приёма:** После тренировки, или утром если нет тренировки
// **Цель:** Добор суточного белка до нормы
// **Заметка:** Можно смешивать с водой или молоком
//
// ## Креатин моногидрат
// **Доза:** 5 г
// **Время приёма:** Ежедневно, утром с едой
// **Цель:** Увеличение силы и мышечной выносливости
// ──────────────────────────────────────────────────────────────────────────

function parseSupplementsSection(lines: string[]): SportSupplementsSection {
  const supplements: SportSupplement[] = []
  let coachNote: string | undefined
  let current: Partial<SportSupplement> | null = null

  const pushSupplement = () => {
    if (current?.name) {
      supplements.push({
        id: generateId(current.name),
        name: current.name,
        dose: current.dose,
        timing: current.timing,
        purpose: current.purpose,
        note: current.note,
      })
    }
    current = null
  }

  for (const line of lines) {
    // Общая рекомендация
    const noteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
    if (noteMatch && !current) { coachNote = noteMatch[1].trim(); continue }

    // Название добавки: ## Протеин
    if (line.startsWith('## ')) {
      pushSupplement()
      current = { name: line.replace(/^##\s*/, '').trim() }
      continue
    }

    if (!current) continue

    const doseMatch = line.match(/^\*\*Доза[^:]*:\*\*\s*(.+)/i)
    if (doseMatch) { current.dose = doseMatch[1].trim(); continue }

    const timingMatch = line.match(/^\*\*Время[^:]*:\*\*\s*(.+)/i)
    if (timingMatch) { current.timing = timingMatch[1].trim(); continue }

    const purposeMatch = line.match(/^\*\*Цель[^:]*:\*\*\s*(.+)/i)
    if (purposeMatch) { current.purpose = purposeMatch[1].trim(); continue }

    const suppNoteMatch = line.match(/^\*\*Заметка[^:]*:\*\*\s*(.+)/i)
    if (suppNoteMatch) { current.note = suppNoteMatch[1].trim(); continue }
  }

  pushSupplement()
  return { coachNote, supplements }
}



export function parseNutritionMdToJson(markdown: string): NutritionPlanData {
  const lines = markdown.split('\n').map(l => l.trim())

  // Разделяем секцию рецептов от основного плана
  const recipesStartIdx = lines.findIndex(l => l.match(/^#\s+Рецепты/i))
  const supplementsStartIdx = lines.findIndex(l => l.match(/^#\s+Спортивное\s+питание/i))

  // Определяем границы каждой секции
  const sectionStarts = [
    recipesStartIdx >= 0 ? recipesStartIdx : Infinity,
    supplementsStartIdx >= 0 ? supplementsStartIdx : Infinity,
  ]
  const firstSectionIdx = Math.min(...sectionStarts)

  const planLines = firstSectionIdx < Infinity ? lines.slice(0, firstSectionIdx) : lines

  // Секция рецептов
  let recipeLines: string[] = []
  if (recipesStartIdx >= 0) {
    const nextSection = sectionStarts.filter(s => s > recipesStartIdx)[0] ?? Infinity
    recipeLines = lines.slice(recipesStartIdx + 1, nextSection < Infinity ? nextSection : undefined)
  }

  // Секция спортпита
  let supplementLines: string[] = []
  if (supplementsStartIdx >= 0) {
    const nextSection = sectionStarts.filter(s => s > supplementsStartIdx)[0] ?? Infinity
    supplementLines = lines.slice(supplementsStartIdx + 1, nextSection < Infinity ? nextSection : undefined)
  }

  // Парсим рецепты
  const recipes = recipeLines.length > 0 ? parseRecipesSection(recipeLines) : undefined

  // Парсим спортпит
  const supplements = supplementLines.length > 0 ? parseSupplementsSection(supplementLines) : undefined

  // Номер плана
  const planMatch = planLines.find(l => l.startsWith('# '))
  const planNumberMatch = planMatch?.match(/№?\s*(\d+)/)
  const planNumber = planNumberMatch ? parseInt(planNumberMatch[1]) : 1

  // Даты
  const dateLine = planLines.find(l => l.includes('**Период:**'))
  let startDate = ''
  let endDate = ''
  if (dateLine) {
    const dateStr = dateLine.replace('**Период:**', '').trim()
    const dates = dateStr.split(/[—–]/).map(d => d.trim())
    startDate = dates[0] || ''
    endDate = dates[1] || ''
  }

  // Целевые КБЖУ
  const kcalLine = planLines.find(l => l.includes('**Калории:**') || l.includes('**КБЖУ:**'))
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

  // Общая рекомендация (до первого ## или # Неделя)
  let globalNote = ''
  for (const l of planLines) {
    if (l.startsWith('## ') || l.match(/^#\s+Неделя/i)) break
    const m = l.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
    if (m) { globalNote = m[1].trim(); break }
  }

  // ── Парсим недели и дни ──────────────────────────────────────────────

  const weeks: NutritionWeek[] = []
  let currentWeek: NutritionWeek | null = null
  let currentDay: NutritionDay | null = null
  let currentMeal: NutritionMeal | null = null
  let currentRecipeText = ''
  let globalDayCounter = 0

  const pushMeal = () => {
    if (!currentMeal || !currentDay) return
    if (currentRecipeText) {
      if (currentMeal.dishes.length > 0) {
        currentMeal.dishes[currentMeal.dishes.length - 1].recipe = currentRecipeText.trim()
      } else {
        currentMeal.note = currentRecipeText.trim()
      }
      currentRecipeText = ''
    }
    currentDay.meals.push(currentMeal)
    currentMeal = null
  }

  const pushDay = () => {
    pushMeal()
    if (!currentDay) return
    // Считаем суммарные КБЖУ дня если не указаны явно
    if (!currentDay.totalKcal) {
      let kcal = 0, prot = 0, fat = 0, carbs = 0
      for (const meal of currentDay.meals) {
        kcal += meal.kcal || 0; prot += meal.protein || 0
        fat += meal.fat || 0; carbs += meal.carbs || 0
      }
      if (kcal > 0) currentDay.totalKcal = kcal
      if (prot > 0) currentDay.totalProtein = prot
      if (fat > 0) currentDay.totalFat = fat
      if (carbs > 0) currentDay.totalCarbs = carbs
    }
    if (currentWeek) currentWeek.days.push(currentDay)
    currentDay = null
  }

  const pushWeek = () => {
    pushDay()
    if (currentWeek) weeks.push(currentWeek)
    currentWeek = null
  }

  for (const line of planLines) {
    // # Неделя N: Название  (заголовок первого уровня для недели)
    const weekH1Match = line.match(/^#\s+Неделя\s*(\d+):?\s*(.*)/i)
    if (weekH1Match) {
      pushWeek()
      currentWeek = {
        weekNumber: parseInt(weekH1Match[1]),
        title: weekH1Match[2].trim() || `Неделя ${weekH1Match[1]}`,
        days: [],
      }
      continue
    }

    // ## Неделя N: Название  (заголовок второго уровня для недели)
    const weekH2Match = line.match(/^##\s+Неделя\s*(\d+):?\s*(.*)/i)
    if (weekH2Match) {
      pushWeek()
      currentWeek = {
        weekNumber: parseInt(weekH2Match[1]),
        title: weekH2Match[2].trim() || `Неделя ${weekH2Match[1]}`,
        days: [],
      }
      continue
    }

    // Рекомендация на неделю (строка после заголовка недели, до первого дня)
    if (currentWeek && !currentDay) {
      const weekNoteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
      if (weekNoteMatch) { currentWeek.weeklyNote = weekNoteMatch[1].trim(); continue }
    }

    // ### День N: Название  или  ## День N: Название
    const dayMatch =
      line.match(/^#{2,3}\s+День\s*(\d+):?\s*(.*)/i) ||
      line.match(/^#{2,3}\s+Day\s*(\d+):?\s*(.*)/i)

    if (dayMatch) {
      pushDay()
      // Если нет текущей недели — создаём дефолтную
      if (!currentWeek) {
        currentWeek = { weekNumber: 1, title: 'Неделя 1', days: [] }
      }
      globalDayCounter++
      const localDayNum = parseInt(dayMatch[1])
      currentDay = {
        dayNumber: globalDayCounter,
        weekNumber: currentWeek.weekNumber,
        dayOfWeek: getDayOfWeek(localDayNum),
        title: dayMatch[2].trim() || `День ${localDayNum}`,
        meals: [],
      }
      continue
    }

    if (!currentDay) continue

    // Рекомендация дня
    if (!currentMeal) {
      const noteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
      if (noteMatch) { currentDay.coachNote = noteMatch[1].trim(); continue }
      const waterMatch = line.match(/^\*\*Вода[^:]*:\*\*\s*(.+)/i)
      if (waterMatch) { currentDay.waterGoal = waterMatch[1].trim(); continue }
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

    // #### Приём пищи  или  ### Приём пищи
    if (line.match(/^#{3,4}\s/)) {
      pushMeal()
      const mealTitle = line.replace(/^#{3,4}\s*/, '').trim()
      const macros = parseMacros(mealTitle)
      const timeMatch = mealTitle.match(/\((\d{1,2}:\d{2})\)/)
      const time = timeMatch ? timeMatch[1] : undefined
      const cleanName = mealTitle
        .replace(/\([\d:]+\)/, '').replace(/\|.*$/, '')
        .replace(/[🌅☀️🌙🍎🥗🌮🍽️💪⚡]/g, '').trim()
      currentMeal = {
        id: generateId(cleanName || mealTitle),
        name: cleanName || mealTitle,
        time, dishes: [], ...macros,
      }
      continue
    }

    if (!currentMeal) continue

    // Рецепт/заметка (строка начинается с >)
    if (line.startsWith('>')) {
      const recipe = line.replace(/^>\s*(?:Приготовление:|Рецепт:|Заметка:)?\s*/i, '').trim()
      currentRecipeText += (currentRecipeText ? ' ' : '') + recipe
      continue
    }

    // Блюдо: строка начинается с -
    if (line.startsWith('-')) {
      const dish = parseDishLine(line)
      if (dish) currentMeal.dishes.push(dish)
      continue
    }
  }

  pushWeek()

  // Плоский список дней для обратной совместимости
  const allDays: NutritionDay[] = weeks.flatMap(w => w.days)

  return {
    planNumber,
    startDate,
    endDate,
    weeks,
    days: allDays,
    weeklyNote: globalNote || undefined,
    dailyKcal,
    dailyProtein,
    dailyFat,
    dailyCarbs,
    recipes: recipes && recipes.length > 0 ? recipes : undefined,
    supplements: supplements && supplements.supplements.length > 0 ? supplements : undefined,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Месячный шаблон плана питания
// ──────────────────────────────────────────────────────────────────────────

export const EXAMPLE_NUTRITION_MD = `# План питания №1

**Период:** 2026-06-01 — 2026-06-30
**Калории:** 2200 ккал | **Белок:** 180 г | **Жиры:** 70 г | **Углеводы:** 220 г
**Рекомендация:** Месячный план питания. Первые две недели — адаптация к новому режиму питания. Третья и четвёртая — закрепление привычек. Придерживайся структуры приёмов пищи, не пропускай белок.

---

## Неделя 1: Адаптация
**Рекомендация:** Не нужно считать каждый грамм — просто придерживайся структуры. Главная задача: 4–5 приёмов пищи в день и попадание в белок.

### День 1: Тренировочный день
**Рекомендация дня:** Сегодня тренировка — не пропускай углеводы в обеде. После тренировки — белок в течение 30–60 минут.
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00) | 480 ккал | Б: 38г | Ж: 14г | У: 50г
- Овсянка на воде — 80 г | 290 ккал | Б: 10г | Ж: 5г | У: 55г
- Яйца варёные — 2 шт | 140 ккал | Б: 12г | Ж: 10г | У: 1г
- Банан — 1 шт | 90 ккал | Б: 1г | Ж: 0г | У: 23г
> Приготовление: Сварить овсянку на воде. Яйца вкрутую 8–10 минут.

#### ☀️ Обед (13:00) | 680 ккал | Б: 58г | Ж: 18г | У: 68г
- Куриная грудка — 200 г | 220 ккал | Б: 46г | Ж: 3г | У: 0г
- Гречка — 100 г (сухой) | 330 ккал | Б: 13г | Ж: 3г | У: 68г
- Огурец + помидор — 200 г | 40 ккал | Б: 2г | Ж: 0г | У: 8г
- Оливковое масло — 10 г | 90 ккал | Б: 0г | Ж: 10г | У: 0г
> Приготовление: Курицу запечь при 180°C 25 мин. Гречку сварить 1:2.

#### 🍎 Перекус (16:00) | 250 ккал | Б: 25г | Ж: 8г | У: 20г
- Творог 5% — 150 г | 160 ккал | Б: 21г | Ж: 7г | У: 3г
- Яблоко — 1 шт | 80 ккал | Б: 0г | Ж: 0г | У: 20г

#### 🌙 Ужин (19:30) | 520 ккал | Б: 48г | Ж: 22г | У: 30г
- Лосось — 150 г | 280 ккал | Б: 30г | Ж: 17г | У: 0г
- Брокколи — 200 г | 70 ккал | Б: 6г | Ж: 1г | У: 12г
- Рис бурый — 60 г (сухой) | 210 ккал | Б: 5г | Ж: 2г | У: 44г
> Приготовление: Лосось запечь с лимоном при 200°C 15–18 мин.

---

### День 2: День отдыха
**Рекомендация дня:** День без тренировки — немного снижаем углеводы, белок оставляем на том же уровне.
**Вода:** 2 л

#### 🌅 Завтрак (09:00) | 420 ккал | Б: 35г | Ж: 18г | У: 30г
- Яичница — 3 яйца | 210 ккал | Б: 18г | Ж: 15г | У: 1г
- Цельнозерновой хлеб — 2 ломтика | 140 ккал | Б: 6г | Ж: 2г | У: 28г
- Авокадо — 50 г | 80 ккал | Б: 1г | Ж: 7г | У: 3г

#### ☀️ Обед (13:00) | 600 ккал | Б: 52г | Ж: 20г | У: 50г
- Говядина (вырезка) — 180 г | 270 ккал | Б: 36г | Ж: 14г | У: 0г
- Картофель запечённый — 200 г | 160 ккал | Б: 4г | Ж: 0г | У: 36г
- Салат из свежих овощей — 200 г | 60 ккал | Б: 2г | Ж: 3г | У: 8г

#### 🍎 Перекус (16:30) | 200 ккал | Б: 20г | Ж: 5г | У: 18г
- Греческий йогурт 2% — 200 г | 120 ккал | Б: 20г | Ж: 2г | У: 6г
- Черника — 100 г | 57 ккал | Б: 1г | Ж: 0г | У: 14г

#### 🌙 Ужин (19:00) | 480 ккал | Б: 45г | Ж: 20г | У: 25г
- Треска — 200 г | 160 ккал | Б: 36г | Ж: 1г | У: 0г
- Тушёные овощи — 300 г | 120 ккал | Б: 4г | Ж: 5г | У: 18г
- Оливковое масло — 15 г | 135 ккал | Б: 0г | Ж: 15г | У: 0г

---

### День 3: Тренировочный день
**Рекомендация дня:** Тяжёлая тренировка — максимальные углеводы сегодня.
**Вода:** 3 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 4: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 5: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 6: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 7: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

## Неделя 2: Закрепление режима
**Рекомендация:** Вторая неделя — начинаем отслеживать белок. Цель: 180 г белка в день. Углеводы можно варьировать в зависимости от тренировок.

### День 8: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 9: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 10: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 11: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 12: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 13: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 14: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

## Неделя 3: Прогресс
**Рекомендация:** Третья неделя — начинаем считать калории. Цель: попадать в коридор ±100 ккал от целевого значения. Следи за весом — если не меняется 2 недели, снижаем углеводы на 20–30 г.

### День 15: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 16: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 17: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 18: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 19: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 20: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 21: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

## Неделя 4: Финальная
**Рекомендация:** Четвёртая неделя — подводим итоги. Делаем замеры в начале и конце недели. Если результат устраивает — продолжаем в том же режиме. Если нет — корректируем калории.

### День 22: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 23: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 24: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 25: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 26: Тренировочный день
**Вода:** 2.5 л

#### 🌅 Завтрак (08:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🍎 Перекус (16:00)
> Заполнить

#### 🌙 Ужин (19:30)
> Заполнить

---

### День 27: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

### День 28: День отдыха
**Вода:** 2 л

#### 🌅 Завтрак (09:00)
> Заполнить

#### ☀️ Обед (13:00)
> Заполнить

#### 🌙 Ужин (19:00)
> Заполнить

---

# Рецепты

## Завтраки

### Овсянка с бананом и яйцами
**КБЖУ:** 480 ккал | Б: 38г | Ж: 14г | У: 50г
**Порция:** 1 порция
**Ингредиенты:**
- Овсянка — 80 г
- Банан — 1 шт (120 г)
- Яйца — 2 шт
- Вода — 200 мл
**Приготовление:**
1. Залить овсянку кипятком или сварить на воде 5 минут
2. Нарезать банан и добавить в кашу
3. Яйца сварить вкрутую (8–10 минут), очистить
**Заметка:** Можно добавить щепотку корицы для вкуса. Без сахара и соли.

### Яичница с авокадо и хлебом
**КБЖУ:** 420 ккал | Б: 35г | Ж: 18г | У: 30г
**Порция:** 1 порция
**Ингредиенты:**
- Яйца — 3 шт
- Авокадо — 50 г
- Цельнозерновой хлеб — 2 ломтика
**Приготовление:**
1. Разбить яйца на сухую сковороду, жарить на среднем огне 3–4 минуты
2. Авокадо размять вилкой, намазать на хлеб
3. Подавать вместе

---

## Обеды

### Куриная грудка с гречкой и овощами
**КБЖУ:** 680 ккал | Б: 58г | Ж: 18г | У: 68г
**Порция:** 1 порция
**Ингредиенты:**
- Куриная грудка — 200 г
- Гречка — 100 г (сухой)
- Огурец — 100 г
- Помидор — 100 г
- Оливковое масло — 10 г
- Специи: соль, перец, паприка
**Приготовление:**
1. Куриную грудку натереть специями, запечь при 180°C 25 минут
2. Гречку промыть, залить водой 1:2, варить 15 минут
3. Овощи нарезать, заправить оливковым маслом
**Заметка:** Можно заменить гречку на рис или булгур.

### Говядина с запечённым картофелем
**КБЖУ:** 600 ккал | Б: 52г | Ж: 20г | У: 50г
**Порция:** 1 порция
**Ингредиенты:**
- Говядина (вырезка) — 180 г
- Картофель — 200 г
- Розмарин — щепотка
- Оливковое масло — 10 г
- Соль, перец
**Приготовление:**
1. Картофель нарезать дольками, смешать с маслом и розмарином, запечь при 200°C 30 минут
2. Говядину обжарить на сковороде по 3–4 минуты с каждой стороны
3. Дать мясу отдохнуть 5 минут перед подачей

---

## Ужины

### Лосось с брокколи и рисом
**КБЖУ:** 520 ккал | Б: 48г | Ж: 22г | У: 30г
**Порция:** 1 порция
**Ингредиенты:**
- Лосось — 150 г
- Брокколи — 200 г
- Рис бурый — 60 г (сухой)
- Лимон — 1/2 шт
- Оливковое масло — 10 г
**Приготовление:**
1. Лосось сбрызнуть лимоном, запечь при 200°C 15–18 минут
2. Брокколи отварить или приготовить на пару 5–7 минут
3. Рис сварить 1:2.5 воды, 35–40 минут

### Треска с тушёными овощами
**КБЖУ:** 480 ккал | Б: 45г | Ж: 20г | У: 25г
**Порция:** 1 порция
**Ингредиенты:**
- Треска — 200 г
- Кабачок — 150 г
- Болгарский перец — 100 г
- Лук — 50 г
- Оливковое масло — 15 г
- Специи: соль, перец, прованские травы
**Приготовление:**
1. Овощи нарезать, тушить на оливковом масле 15–20 минут
2. Треску запечь при 180°C 20 минут или приготовить на пару

---

## Перекусы

### Творог с яблоком
**КБЖУ:** 250 ккал | Б: 25г | Ж: 8г | У: 20г
**Порция:** 1 порция
**Ингредиенты:**
- Творог 5% — 150 г
- Яблоко — 1 шт (150 г)
**Приготовление:**
1. Яблоко нарезать кубиками
2. Смешать с творогом
**Заметка:** Можно добавить корицу. Не добавлять сахар или мёд.

### Греческий йогурт с ягодами
**КБЖУ:** 200 ккал | Б: 20г | Ж: 5г | У: 18г
**Порция:** 1 порция
**Ингредиенты:**
- Греческий йогурт 2% — 200 г
- Черника или клубника — 100 г
**Приготовление:**
1. Ягоды промыть
2. Добавить в йогурт, перемешать

---

# Спортивное питание
**Рекомендация:** Базовый набор добавок под твои цели и данные анкеты. Принимай строго по схеме — хаотичный приём не даёт результата.

## Протеин (сывороточный)
**Доза:** 30 г (1 мерная ложка)
**Время приёма:** После тренировки в течение 30–60 минут. В дни отдыха — утром с завтраком если не добираешь белок из еды
**Цель:** Добор суточного белка до нормы 180 г. Ускорение восстановления мышц
**Заметка:** Смешивать с 250–300 мл воды или молока. Не заменяет полноценные приёмы пищи

## Креатин моногидрат
**Доза:** 5 г (1 чайная ложка)
**Время приёма:** Ежедневно, утром с едой. Время приёма не критично — главное регулярность
**Цель:** Увеличение силовых показателей, объём мышц, восстановление между подходами
**Заметка:** Принимать каждый день без перерывов, в том числе в дни отдыха. Запивать большим количеством воды

## Омега-3
**Доза:** 2 капсулы (2 г EPA+DHA)
**Время приёма:** Во время еды, утром или в обед
**Цель:** Снижение воспаления, поддержка суставов и сердечно-сосудистой системы
**Заметка:** Принимать с жирной едой для лучшего усвоения
`
