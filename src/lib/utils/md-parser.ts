// MetaSystem v2 — Markdown Parser

import type { ProgramData, TrainingDay, Exercise, AlternativeExercise } from '@/lib/services/training'

/**
 * Формат MD:
 *
 * # Неделя 1
 * **Период:** 2026-05-14 — 2026-05-21
 * **Рекомендация:** Неделя средняя по нагрузке. Закрываем базовый объём.
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

  // Рекомендация на неделю (строка до первого ##)
  let weeklyNote = ''
  for (const l of lines) {
    if (l.startsWith('## ')) break
    const m = l.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
    if (m) { weeklyNote = m[1].trim(); break }
  }

  const days: TrainingDay[] = []
  let currentDay: TrainingDay | null = null
  let currentExercise: Exercise | null = null
  let parsingAlternatives = false  // флаг: сейчас читаем блок альтернатив

  for (const line of lines) {
    // День: ## День N: Название
    const dayMatch =
      line.match(/^##\s+(?:.*?)?День\s*(\d+):?\s*(.*)/i) ||
      line.match(/^##\s+(?:.*?)?Тренировка\s*(\d+):?\s*(.*)/i) ||
      line.match(/^##\s+(?:.*?)?Day\s*(\d+):?\s*(.*)/i)

    if (dayMatch) {
      if (currentExercise && currentDay) { currentDay.exercises.push(currentExercise); currentExercise = null }
      if (currentDay) days.push(currentDay)
      parsingAlternatives = false
      currentDay = {
        dayNumber: parseInt(dayMatch[1]),
        dayOfWeek: getDayOfWeek(parseInt(dayMatch[1])),
        title: dayMatch[2].trim() || `День ${dayMatch[1]}`,
        exercises: [],
        coachNote: '',
      }
      continue
    }

    // Рекомендация на день (строка после ## и до первого ###)
    if (currentDay && !currentExercise) {
      const noteMatch = line.match(/^\*\*Рекомендация[^:]*:\*\*\s*(.+)/i)
      if (noteMatch) { currentDay.coachNote = noteMatch[1].trim(); continue }
    }

    // Упражнение: ### Название
    if (line.startsWith('###')) {
      if (currentExercise && currentDay) currentDay.exercises.push(currentExercise)
      parsingAlternatives = false
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
    // или: - Название | N x reps
    // или: - Название
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

      // Ищем видео и параметры в остальных частях
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

  return { weekNumber, startDate, endDate, days, weeklyNote }
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
