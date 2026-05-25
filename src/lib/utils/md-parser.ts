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
 * Опционально — статистика за прошлую неделю (показывается клиенту вверху страницы):
 * **Резюме прошлой недели:** Что сделано, недочёты, общий обзор и мысли тренера.
 * **Объём прошлой недели:** Тоннаж, интенсивность, выполнение плана (объективно по фактам).
 * **Самочувствие прошлой недели:** Обобщение комментариев клиента (сон, энергия, жалобы).
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
  | 'warmup'
  | 'cooldown'
  | 'checkin'
  | 'loggingNote'
  | 'prevCoachSummary'
  | 'prevVolumeSummary'
  | 'prevWellnessSummary'
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
  let checkin = ''
  let loggingNote = ''

  // Статистика за прошлую неделю — три независимых многострочных блока
  let prevCoachSummary = ''
  let prevVolumeSummary = ''
  let prevWellnessSummary = ''

  // Текущий активный многострочный блок
  let currentBlock: MultilineBlock = null

  // Добавляет текст в нужный блок (неделя или день)
  const appendToBlock = (text: string) => {
    if (!currentBlock) return
    const sep = text ? '\n' : ''
    if (currentBlock === 'weeklyNote') weeklyNote += (weeklyNote ? sep : '') + text
    else if (currentBlock === 'weekContext') weekContext += (weekContext ? sep : '') + text
    else if (currentBlock === 'redFlags') redFlags += (redFlags ? sep : '') + text
    else if (currentBlock === 'checkin') checkin += (checkin ? sep : '') + text
    else if (currentBlock === 'loggingNote') loggingNote += (loggingNote ? sep : '') + text
    else if (currentBlock === 'prevCoachSummary') prevCoachSummary += (prevCoachSummary ? sep : '') + text
    else if (currentBlock === 'prevVolumeSummary') prevVolumeSummary += (prevVolumeSummary ? sep : '') + text
    else if (currentBlock === 'prevWellnessSummary') prevWellnessSummary += (prevWellnessSummary ? sep : '') + text
    else if (currentBlock === 'coachNote' && currentDay) {
      currentDay.coachNote = (currentDay.coachNote ? currentDay.coachNote + sep : '') + text
    } else if (currentBlock === 'dayContext' && currentDay) {
      currentDay.dayContext = (currentDay.dayContext ? currentDay.dayContext + sep : '') + text
    } else if (currentBlock === 'warmup' && currentDay) {
      currentDay.warmup = (currentDay.warmup ? currentDay.warmup + sep : '') + text
    } else if (currentBlock === 'cooldown' && currentDay) {
      currentDay.cooldown = (currentDay.cooldown ? currentDay.cooldown + sep : '') + text
    }
  }

  for (const line of lines) {
    // ── Специальные ## секции (Чек-ин, Памятка) ────────────────────────────
    if (line.match(/^##\s+.*чек.?ин/i)) {
      if (currentExercise && currentDay) { currentDay.exercises.push(currentExercise); currentExercise = null }
      if (currentDay) { days.push(currentDay); currentDay = null }
      parsingAlternatives = false
      currentBlock = 'checkin'
      continue
    }
    if (line.match(/^##\s+.*памятк/i) || line.match(/^##\s+.*логирован/i)) {
      if (currentExercise && currentDay) { currentDay.exercises.push(currentExercise); currentExercise = null }
      if (currentDay) { days.push(currentDay); currentDay = null }
      parsingAlternatives = false
      currentBlock = 'loggingNote'
      continue
    }
    // ВАЖНО: НЕ добавлять здесь «## Сводка...» как источник prevCoachSummary.
    // Раньше этот блок жадно собирал всю markdown-таблицу «нед N → нед N+1»
    // в Резюме тренера, и UI получал нечитаемое полотно строк.
    // Источником prevWeekStats служат ТОЛЬКО короткие именованные блоки
    // **Резюме прошлой недели:** / **Объём прошлой недели:** /
    // **Самочувствие прошлой недели:** / **По чек-ину:** в шапке файла —
    // см. ветку «Заголовки многострочных блоков» ниже.

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

      // Статистика за прошлую неделю — три блока
      const prevCoachMatch = line.match(/^\*\*(?:Резюме|Итоги|Обзор)[^:]*:\*\*\s*(.*)/i)
      if (prevCoachMatch) {
        currentBlock = 'prevCoachSummary'
        const inline = prevCoachMatch[1].trim()
        if (inline) prevCoachSummary = inline
        continue
      }
      const prevVolumeMatch = line.match(/^\*\*(?:Объ[её]м|Тоннаж|Нагрузка)[^:]*:\*\*\s*(.*)/i)
      if (prevVolumeMatch) {
        currentBlock = 'prevVolumeSummary'
        const inline = prevVolumeMatch[1].trim()
        if (inline) prevVolumeSummary = inline
        continue
      }
      const prevWellnessMatch = line.match(/^\*\*Самочувствие[^:]*:\*\*\s*(.*)/i)
      if (prevWellnessMatch) {
        currentBlock = 'prevWellnessSummary'
        const inline = prevWellnessMatch[1].trim()
        if (inline) prevWellnessSummary = inline
        continue
      }
      // «По чек-ину» — синоним для блока самочувствия (тренеры часто пишут
      // именно так, разбирая ответы клиента на недельный чек-ин).
      const prevByCheckinMatch = line.match(/^\*\*По\s*чек.?ину[^:]*:\*\*\s*(.*)/i)
      if (prevByCheckinMatch) {
        currentBlock = 'prevWellnessSummary'
        const inline = prevByCheckinMatch[1].trim()
        if (inline) prevWellnessSummary = (prevWellnessSummary ? prevWellnessSummary + '\n\n' : '') + inline
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
      // Разминка дня — многострочный блок (общая+специальная разминка перед упражнениями)
      const warmupMatch = line.match(/^\*\*Размин[^:]*:\*\*\s*(.*)/i)
      if (warmupMatch) {
        currentBlock = 'warmup'
        const inline = warmupMatch[1].trim()
        if (inline) currentDay.warmup = inline
        continue
      }
      // Заминка дня — многострочный блок (растяжка/МФР после тренировки)
      const cooldownMatch = line.match(/^\*\*Замин[^:]*:\*\*\s*(.*)/i)
      if (cooldownMatch) {
        currentBlock = 'cooldown'
        const inline = cooldownMatch[1].trim()
        if (inline) currentDay.cooldown = inline
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

  // Собираем prevWeekStats только если хотя бы одно поле заполнено
  const prevCoach = trim(prevCoachSummary)
  const prevVolume = trim(prevVolumeSummary)
  const prevWellness = trim(prevWellnessSummary)
  const prevWeekStats = (prevCoach || prevVolume || prevWellness)
    ? {
        coachSummary: prevCoach || undefined,
        volumeSummary: prevVolume || undefined,
        wellnessSummary: prevWellness || undefined,
      }
    : undefined

  return {
    weekNumber,
    startDate,
    endDate,
    days,
    weeklyNote: trim(weeklyNote) || undefined,
    weekContext: trim(weekContext) || undefined,
    redFlags: trim(redFlags) || undefined,
    checkin: trim(checkin) || undefined,
    loggingNote: trim(loggingNote) || undefined,
    prevWeekStats,
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
export const EXAMPLE_PROGRAM_MD = `---
client_id: client-slug
client_name: Имя клиента
mesocycle: 1
week: 2
period_start: 2026-05-21
period_end: 2026-05-28
type: standard
---

# Неделя 2

**Период:** 2026-05-21 — 2026-05-28
**Рекомендация:** Поднимаем рабочие веса на 2.5 кг там, где RIR на прошлой неделе был ≥3. Жим штанги — техника прежняя.

**Контекст недели:** Вторая неделя адаптационного блока. Объём держим, добавляем интенсивность только там, где запас по RIR позволяет. Если в течение недели появляется усталость — снижаем вес на 5%, подходы и повторы оставляем как есть.

**Красные флаги:** Любая острая боль (а не «непривычное ощущение») в спине или коленях — стоп упражнение, сообщить в чат. Если сон проседает 2 дня подряд (≤4/5) — пропускаем тренировку с приседом, не двигаем её на другой день.

**Резюме прошлой недели:** Неделя выполнена полностью, все 3 тренировки закрыты. Технику жима ты подтянул — комментарий «локоть стал на месте» это подтверждает. Из недочётов: на приседаниях во второй и третий день RIR был 0-1, ты на грани отказа — это слишком тяжело для адаптационного блока, на этой неделе снизим вес и поднимем повторы.

**Объём прошлой недели:** Суммарный тоннаж 14 280 кг (+8% к плану — ты осознанно докинул вес в подтягиваниях). Интенсивность по жиму 72.5% от 1ПМ (план 70%), по приседу 78% (план 75% — отсюда низкий RIR). Все запланированные подходы выполнены, дроп-сетов не было.

**Самочувствие прошлой недели:** По комментариям: сон 4/5 в среднем, в день 2 «не выспался» — это совпало с просадкой на приседе. Энергия стабильно 6-7/10. Жалобы на тянущее ощущение в пояснице после тяги в день 3, ты написал «непривычно, но не больно». Учли — на этой неделе тяга идёт первой, пока спина свежая.

## День 1: Верх тела (Push)
**Рекомендация дня:** Жим штанги — рабочий вес 65 кг. Если первый подход идёт легко (RIR 4+), во втором накидываем 2.5 кг.

### Жим штанги лёжа
- 4 x 8-10 • 60/65/65/65 кг
**Альтернативы:**
- Жим гантелей лёжа | 4 x 10-12
- Отжимания на брусьях | 4 x 10-12

### Жим гантелей на наклонной скамье
- 3 x 10-12 • 22/24/24 кг

### Разводка гантелей лёжа
- 3 x 12-15 • 12/14/14 кг

**Кардио:** 15 мин ходьба (ЧСС 120-130)

---

## День 2: Низ тела
**Рекомендация дня:** Присед — снижаем до 65 кг (с 70). Цель — 10 чистых повторов с RIR 2-3, не до отказа.

### Приседания со штангой
- 4 x 10-12 • 55/60/65/65 кг

### Румынская тяга
- 3 x 10-12 • 50/55/55 кг

### Жим ногами
- 3 x 12-15 • 80/90/90 кг

**Кардио:** 10 мин велотренажёр

---

## День 3: Верх тела (Pull)
**Рекомендация дня:** Тяга идёт первой — пока спина свежая. Локоть ведёт движение.

### Тяга штанги в наклоне
- 4 x 8-10 • 40/45/45/45 кг

### Подтягивания прямым хватом
- 3 x 8-10 • 0/0/0 кг

### Тяга верхнего блока (паралл. хват)
- 3 x 12-15 • 50/55/55 кг

**Кардио:** 15 мин ходьба

---

## 📊 Чек-ин в конце недели

> Заполни в свободной форме и отправь отдельным сообщением тренеру (мне), без этого следующая неделя не строится.

- **Качество сна (1-10):**
- **Мышечная боль / DOMS (1-10):**
- **Уровень энергии (1-10):**
- **Мотивация (1-10):**
- **Состояние суставов и зон-ограничений (плечи, локти):**
- **Вес на конец недели:**
- **Все ли тренировки выполнены?** (да / пропущено, причина)
- **На каких упражнениях оставался запас (RIR выше планового)?**
- **На каких было тяжелее планового?**
- **Заметки и вопросы тренеру:**

> Это критически важно для построения следующей недели.
`
