// MetaSystem v2 — Markdown Parser

import type { ProgramData, TrainingDay, Exercise, AlternativeExercise } from '@/lib/services/training'

/**
 * Формат MD:
 *
 * # Неделя 1
 * **Период:** 2026-05-14 — 2026-05-21
 * **Рекомендация:** Неделя средняя по нагрузке. Закрываем базовый объём.
 * **Контекст недели:** Многострочный текст...
 * **Красные флаги:** Многострочный текст...
 *
 * ## День 1: Верх тела (Push)
 * **Рекомендация дня:** Сегодня работаем не до отказа, RIR 2-3 на всех подходах.
 *
 * ### Жим гантелей лёжа
 * [Видео](url)
 * - 4 x 10-12 • 20/22.5/25/30 кг
 * **Альтернативы:**
 * - Жим штанги лёжа | [Видео](url) | 4 x 10-12
 * - Отжимания на брусьях | 4 x 10-12
 */

// Типы текущего многострочного блока
type MultilineBlock =
  | 'weeklyNote'
  | 'weekContext'
  | 'redFlags'
  | 'coachNote'
  | 'dayContext'
  | null

export function parseMdToJson(markdown: string): ProgramData {
  const lines = markdown.split('\n').map((line) => line.trim())

  // Номер недели
  const weekMatch = lines.find((l) => l.startsWith('# Неделя'))
  const weekNumber = weekMatch ? parseInt(weekMatch.replace('# Неделя', '').trim()) : 1

  // Даты
  const dateMatch = lines.find((l) => l.includes('**Период:**'))
  let startDate = ''
  let endDate = ''
  if (dateMatch) {
    const dateStr = dateMatch.replace('**Период:**', '').trim()
    const dates = dateStr.split('—').map((d) => d.trim())
    startDate = dates[0] || ''
    endDate = dates[1] || ''
  }

  const days: TrainingDay[] = []
  let currentDay: TrainingDay | null = null
  let currentExercise: Exercise | null = null
  let parsingAlternatives = false

  // Многострочные блоки уровня недели
  let weeklyNote = ''
  let weekContext = ''
  let redFlags = ''

  // Текущий активный многострочный блок
  let currentBlock: MultilineBlock = null

  // Добавляет текст в нужный блок (неделя или день)
  const appendToBlock = (text: string) => {
    if (!currentBlock) return
    const sep = text ? '\n' : ''
    if (currentBlock === 'weeklyNote') weeklyNote += (weeklyNote ? sep : '') + text
    else if (currentBlock === 'weekContext') weekContext += (weekContext ? sep : '') + text
    else if (currentBlock === 'redFlags') redFlags += (redFlags ? sep : '') + text
    else if (currentBlock === 'coachNote' && currentDay) {
      currentDay.coachNote = (currentDay.coachNote ? currentDay.coachNote + sep : '') + text
    } else if (currentBlock === 'dayContext' && currentDay) {
      currentDay.dayContext = (currentDay.dayContext ? currentDay.dayContext + sep : '') + text
    }
  }

  for (const line of lines) {
    // ── Переход к новому дню — сбрасываем всё ──────────────────────────────
    const dayMatch =
      line.match(/^##\s+(?:.*?)?День\s*(\d+):?\s*(.*)/i) ||
      line.match(/^##\s+(?:.*?)?Тренировка\s*(\d+):?\s*(.*)/i) ||
      line.match(/^##\s+(?:.*?)?Day\s*(\d+):?\s*(.*)/i)

    if (dayMatch) {
      if (currentExercise && currentDay) { currentDay.exercises.push(currentExercise); currentExercise = null }
      if (currentDay) days.push(currentDay)
      parsingAlternatives = false
      currentBlock = null
      currentDay = {
        dayNumber: parseInt(dayMatch[1]),
        dayOfWeek: getDayOfWeek(parseInt(dayMatch[1])),
        title: dayMatch[2].trim() || `День ${dayMatch[1]}`,
        exercises: [],
        coachNote: '',
      }
      continue
    }

    // ── Переход к упражнению — сбрасываем блок ─────────────────────────────
    if (line.startsWith('###')) {
      if (currentExercise && currentDay) currentDay.exercises.push(currentExercise)
      parsingAlternatives = false
      currentBlock = null
      const exerciseName = line.replace(/^###\s*/, '').trim()
      currentExercise = {
        id: generateExerciseId(exerciseName),
        name: exerciseName,
        sets: 3,
        reps: '10-12',
        targetWeights: [],
        alternatives: [],
      }
      continue
    }

    // ── Разделитель --- сбрасывает блок ────────────────────────────────────
    if (line === '---') {
      currentBlock = null
      continue
    }

    // ── Заголовки многострочных блоков ─────────────────────────────────────
    // Уровень недели (до первого ##)
    if (!currentDay) {
      const weeklyNoteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.*)/i)
      if (weeklyNoteMatch) {
        currentBlock = 'weeklyNote'
        const inline = weeklyNoteMatch[1].trim()
        if (inline) weeklyNote = inline
        continue
      }
      const weekContextMatch = line.match(/^\*\*Контекст[^:]*:\*\*\s*(.*)/i)
      if (weekContextMatch) {
        currentBlock = 'weekContext'
        const inline = weekContextMatch[1].trim()
        if (inline) weekContext = inline
        continue
      }
      const redFlagsMatch = line.match(/^\*\*Красн[^:]*:\*\*\s*(.*)/i)
      if (redFlagsMatch) {
        currentBlock = 'redFlags'
        const inline = redFlagsMatch[1].trim()
        if (inline) redFlags = inline
        continue
      }
    }

    // Уровень дня (до первого ###)
    if (currentDay && !currentExercise) {
      const coachNoteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.*)/i)
      if (coachNoteMatch) {
        currentBlock = 'coachNote'
        const inline = coachNoteMatch[1].trim()
        if (inline) currentDay.coachNote = inline
        continue
      }
      // «Контекст недели» внутри дня не используем, но на случай если тренер напишет
      const dayContextMatch = line.match(/^\*\*Контекст[^:]*:\*\*\s*(.*)/i)
      if (dayContextMatch) {
        currentBlock = 'dayContext'
        const inline = dayContextMatch[1].trim()
        if (inline) currentDay.dayContext = inline
        continue
      }
    }

    // ── Продолжение многострочного блока ───────────────────────────────────
    // Новый **Заголовок:** на уровне недели/дня прерывает текущий блок
    if (currentBlock && line.match(/^\*\*[^*]+:\*\*/)) {
      currentBlock = null
      // Не continue — обрабатываем строку дальше (может быть кардио и т.п.)
    }

    if (currentBlock && !currentExercise) {
      // Пустая строка — разделитель абзацев, сохраняем как пустую строку
      appendToBlock(line)
      continue
    }

    // ── Дальше — логика упражнений ─────────────────────────────────────────
    if (!currentExercise && !currentDay) continue

    // Видео основного упражнения
    if (currentExercise && !parsingAlternatives && line.includes('[Видео]')) {
      const m = line.match(/\[Видео\]\((.*?)\)/)
      if (m) currentExercise.videoUrl = m[1]
      continue
    }

    // Начало блока альтернатив
    if (currentExercise && line.match(/^\*\*Альтернатив[ыа]:\*\*/i)) {
      parsingAlternatives = true
      continue
    }

    // Строка альтернативы: - Название | [Видео](url) | N x reps
    if (currentExercise && parsingAlternatives && line.startsWith('- ')) {
      const altLine = line.slice(2).trim()
      if (!altLine) continue

      const parts = altLine.split('|').map(p => p.trim())
      const altName = parts[0]
      if (!altName) continue

      const alt: AlternativeExercise = {
        id: generateExerciseId(altName),
        name: altName,
        sets: currentExercise.sets,
        reps: currentExercise.reps,
      }

      for (const part of parts.slice(1)) {
        const videoMatch = part.match(/\[Видео\]\((.*?)\)/)
        if (videoMatch) { alt.videoUrl = videoMatch[1]; continue }

        const setsRepsMatch = part.match(/(\d+)\s*x\s*([\d\-]+)/)
        if (setsRepsMatch) {
          alt.sets = parseInt(setsRepsMatch[1])
          alt.reps = setsRepsMatch[2]
        }
      }

      if (!currentExercise.alternatives) currentExercise.alternatives = []
      currentExercise.alternatives.push(alt)
      continue
    }

    // Если встретили не-список после начала альтернатив — выходим из режима
    if (parsingAlternatives && !line.startsWith('- ') && line !== '') {
      parsingAlternatives = false
    }

    if (!currentExercise) continue

    // НОВЫЙ формат: - 4 x 10-12 • 20/22.5/25/30 кг
    if (!parsingAlternatives) {
      const newFmt = line.match(/^-\s*(\d+)\s*x\s*([\d\-]+)\s*[•·]\s*([\d./\s]+)\s*кг/i)
      if (newFmt) {
        currentExercise.sets = parseInt(newFmt[1])
        currentExercise.reps = newFmt[2]
        const weights = newFmt[3].trim().split('/').map(w => parseFloat(w.trim())).filter(w => !isNaN(w))
        currentExercise.targetWeights = weights
        if (weights.length > 0) currentExercise.targetWeight = weights[0]
        continue
      }

      // СТАРЫЙ формат: - 3 x 10-12
      const oldSR = line.match(/^-\s*(\d+)\s*x\s*([\d\-]+)/)
      if (oldSR) {
        currentExercise.sets = parseInt(oldSR[1])
        currentExercise.reps = oldSR[2]
        continue
      }

      // СТАРЫЙ формат: - Вес: 20 кг
      const oldW = line.match(/^-\s*Вес:\s*([\d.]+)/)
      if (oldW) {
        const w = parseFloat(oldW[1])
        currentExercise.targetWeight = w
        if (currentExercise.targetWeights.length === 0) {
          currentExercise.targetWeights = Array(currentExercise.sets).fill(w)
        }
        continue
      }
    }

    // Кардио
    if (currentDay && line.includes('**Кардио:**')) {
      currentDay.cardio = line.replace('**Кардио:**', '').trim()
    }
  }

  if (currentExercise && currentDay) currentDay.exercises.push(currentExercise)
  if (currentDay) days.push(currentDay)

  // Нормализация targetWeights
  for (const day of days) {
    for (const ex of day.exercises) {
      if (!ex.targetWeights || ex.targetWeights.length === 0) {
        ex.targetWeights = Array(ex.sets).fill(0)
      } else if (ex.targetWeights.length < ex.sets) {
        const last = ex.targetWeights[ex.targetWeights.length - 1]
        while (ex.targetWeights.length < ex.sets) ex.targetWeights.push(last)
      }
    }
  }

  // Обрезаем лишние пустые строки по краям многострочных блоков
  const trim = (s: string) => s.replace(/^\n+|\n+$/g, '').trim()

  return {
    weekNumber,
    startDate,
    endDate,
    days,
    weeklyNote: trim(weeklyNote) || undefined,
    weekContext: trim(weekContext) || undefined,
    redFlags: trim(redFlags) || undefined,
  }
}

function generateExerciseId(name: string): string {
  return name.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50)
}

function getDayOfWeek(dayNumber: number): string {
  return ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][(dayNumber - 1) % 7] || 'monday'
}

/**
 * Пример программы с рекомендациями
 */
export const EXAMPLE_PROGRAM_MD = `# Неделя 1

**Период:** 2026-05-14 — 2026-05-21
**Рекомендация:** Неделя средняя по нагрузке. Закрываем базовый объём. Фокус на технике и контроле веса.

## День 1: Верх тела (Push)
**Рекомендация дня:** Сегодня работаем не до отказа. RIR 2-3 на всех подходах. Если чувствуешь усталость — снижай вес.

### Жим гантелей лёжа
[Видео](https://youtube.com/watch?v=example1)
- 4 x 10-12 • 20/22.5/25/30 кг
**Альтернативы:**
- Жим штанги лёжа | [Видео](https://youtube.com/watch?v=example1b) | 4 x 10-12
- Отжимания на брусьях | 4 x 10-12

### Жим гантелей на наклонной скамье
[Видео](https://youtube.com/watch?v=example2)
- 3 x 10-12 • 18/20/20 кг
**Альтернативы:**
- Жим штанги на наклонной | 3 x 10-12
- Отжимания с ногами на скамье | 3 x 12-15

### Разводка гантелей
- 3 x 12-15 • 12/12/14 кг

**Кардио:** 15 мин ходьба (ЧСС 120-130)

---

## День 2: Низ тела
**Рекомендация дня:** Приседания — полная амплитуда. Не торопись, контролируй опускание.

### Приседания со штангой
[Видео](https://youtube.com/watch?v=example3)
- 4 x 8-10 • 60/65/70/70 кг
**Альтернативы:**
- Приседания с гантелями | 4 x 10-12
- Жим ногами | 4 x 12-15

### Румынская тяга
- 3 x 10-12 • 50/55/55 кг

### Жим ногами
- 3 x 12-15 • 80/90/90 кг

**Кардио:** 10 мин велотренажёр

---

## День 3: Верх тела (Pull)
**Рекомендация дня:** Тяги — локоть ведёт движение, не кисть. Пауза в нижней точке 1 сек.

### Подтягивания
[Видео](https://youtube.com/watch?v=example4)
- 3 x 8-10 • 0/0/0 кг
**Альтернативы:**
- Тяга верхнего блока | [Видео](https://youtube.com/watch?v=example4b) | 3 x 10-12
- Тяга горизонтального блока | 3 x 10-12

### Тяга штанги в наклоне
- 3 x 10-12 • 40/45/45 кг

### Тяга верхнего блока
- 3 x 12-15 • 50/55/55 кг

**Кардио:** 15 мин ходьба

---
`
