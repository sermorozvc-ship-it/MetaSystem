// MetaSystem v2 — Markdown Parser
// Конвертация между Markdown и JSON для тренировочных программ

import type { ProgramData, TrainingDay, Exercise } from '@/lib/services/training'

/**
 * Парсинг Markdown в JSON
 * 
 * Формат MD:
 * # Неделя 1
 * **Период:** 2026-05-12 — 2026-05-18
 * 
 * ## День 1: Верх тела (Push)
 * 
 * ### Жим гантелей лёжа
 * [Видео](https://youtube.com/watch?v=xxx)
 * - 3 x 10-12
 * - Вес: 20 кг
 * 
 * ### Жим гантелей на наклонной скамье
 * - 3 x 10-12
 * 
 * **Кардио:** 15 мин ходьба (ЧСС 120-130)
 */
export function parseMdToJson(markdown: string): ProgramData {
  const lines = markdown.split('\n').map((line) => line.trim())
  
  // Извлекаем номер недели
  const weekMatch = lines.find((line) => line.startsWith('# Неделя'))
  const weekNumber = weekMatch ? parseInt(weekMatch.replace('# Неделя', '').trim()) : 1
  
  // Извлекаем даты
  const dateMatch = lines.find((line) => line.includes('**Период:**'))
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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // День тренировки: ## День 1: Верх тела
    if (line.startsWith('## День')) {
      if (currentDay && currentExercise) {
        currentDay.exercises.push(currentExercise)
        currentExercise = null
      }
      if (currentDay) {
        days.push(currentDay)
      }
      
      const dayMatch = line.match(/## День (\d+):?\s*(.*)/)
      if (dayMatch) {
        const dayNumber = parseInt(dayMatch[1])
        const title = dayMatch[2].trim()
        
        currentDay = {
          dayNumber,
          dayOfWeek: getDayOfWeek(dayNumber),
          title,
          exercises: [],
        }
      }
    }
    
    // Упражнение: ### Жим гантелей
    else if (line.startsWith('###')) {
      if (currentExercise && currentDay) {
        currentDay.exercises.push(currentExercise)
      }
      
      const exerciseName = line.replace('###', '').trim()
      currentExercise = {
        id: generateExerciseId(exerciseName),
        name: exerciseName,
        sets: 3,
        reps: '10-12',
        clientData: {},
      }
    }
    
    // Видео: [Видео](url)
    else if (line.includes('[Видео]') && currentExercise) {
      const urlMatch = line.match(/\[Видео\]\((.*?)\)/)
      if (urlMatch) {
        currentExercise.videoUrl = urlMatch[1]
      }
    }
    
    // Подходы и повторения: - 3 x 10-12
    else if (line.match(/^-\s*\d+\s*x\s*[\d\-]+/) && currentExercise) {
      const setsRepsMatch = line.match(/^-\s*(\d+)\s*x\s*([\d\-]+)/)
      if (setsRepsMatch) {
        currentExercise.sets = parseInt(setsRepsMatch[1])
        currentExercise.reps = setsRepsMatch[2]
      }
    }
    
    // Целевой вес: - Вес: 20 кг
    else if (line.match(/^-\s*Вес:\s*\d+/) && currentExercise) {
      const weightMatch = line.match(/^-\s*Вес:\s*(\d+)/)
      if (weightMatch) {
        currentExercise.targetWeight = parseInt(weightMatch[1])
      }
    }
    
    // Кардио: **Кардио:** 15 мин ходьба
    else if (line.includes('**Кардио:**') && currentDay) {
      currentDay.cardio = line.replace('**Кардио:**', '').trim()
    }
  }
  
  // Добавляем последнее упражнение и день
  if (currentExercise && currentDay) {
    currentDay.exercises.push(currentExercise)
  }
  if (currentDay) {
    days.push(currentDay)
  }
  
  return {
    weekNumber,
    startDate,
    endDate,
    days,
  }
}

/**
 * Конвертация JSON в Markdown
 */
export function jsonToMd(programData: ProgramData): string {
  let md = `# Неделя ${programData.weekNumber}\n\n`
  md += `**Период:** ${programData.startDate} — ${programData.endDate}\n\n`
  
  programData.days.forEach((day) => {
    md += `## День ${day.dayNumber}: ${day.title}\n\n`
    
    day.exercises.forEach((exercise) => {
      md += `### ${exercise.name}\n`
      
      if (exercise.videoUrl) {
        md += `[Видео](${exercise.videoUrl})\n`
      }
      
      md += `- ${exercise.sets} x ${exercise.reps}\n`
      
      if (exercise.targetWeight) {
        md += `- Вес: ${exercise.targetWeight} кг\n`
      }
      
      md += '\n'
    })
    
    if (day.cardio) {
      md += `**Кардио:** ${day.cardio}\n\n`
    }
    
    md += '---\n\n'
  })
  
  return md
}

/**
 * Генерация ID упражнения из названия
 */
function generateExerciseId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^а-яa-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

/**
 * Получить день недели по номеру дня
 */
function getDayOfWeek(dayNumber: number): string {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  return days[(dayNumber - 1) % 7] || 'monday'
}

/**
 * Валидация программы
 */
export function validateProgram(programData: ProgramData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!programData.weekNumber || programData.weekNumber < 1) {
    errors.push('Некорректный номер недели')
  }
  
  if (!programData.startDate || !programData.endDate) {
    errors.push('Не указаны даты начала и окончания')
  }
  
  if (!programData.days || programData.days.length === 0) {
    errors.push('Программа не содержит тренировочных дней')
  }
  
  programData.days.forEach((day, index) => {
    if (!day.title) {
      errors.push(`День ${index + 1}: отсутствует название`)
    }
    
    if (!day.exercises || day.exercises.length === 0) {
      errors.push(`День ${index + 1}: нет упражнений`)
    }
    
    day.exercises.forEach((exercise, exIndex) => {
      if (!exercise.name) {
        errors.push(`День ${index + 1}, упражнение ${exIndex + 1}: отсутствует название`)
      }
      
      if (!exercise.sets || exercise.sets < 1) {
        errors.push(`День ${index + 1}, ${exercise.name}: некорректное количество подходов`)
      }
      
      if (!exercise.reps) {
        errors.push(`День ${index + 1}, ${exercise.name}: не указаны повторения`)
      }
    })
  })
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Пример программы для тестирования
 */
export const EXAMPLE_PROGRAM_MD = `# Неделя 1

**Период:** 2026-05-12 — 2026-05-18

## День 1: Верх тела (Push)

### Жим гантелей лёжа
[Видео](https://youtube.com/watch?v=example1)
- 3 x 10-12
- Вес: 20 кг

### Жим гантелей на наклонной скамье
[Видео](https://youtube.com/watch?v=example2)
- 3 x 10-12
- Вес: 18 кг

### Разводка гантелей
- 3 x 12-15

**Кардио:** 15 мин ходьба (ЧСС 120-130)

---

## День 2: Низ тела

### Приседания со штангой
[Видео](https://youtube.com/watch?v=example3)
- 4 x 8-10
- Вес: 60 кг

### Румынская тяга
- 3 x 10-12
- Вес: 50 кг

### Жим ногами
- 3 x 12-15

**Кардио:** 10 мин велотренажёр

---

## День 3: Верх тела (Pull)

### Подтягивания
[Видео](https://youtube.com/watch?v=example4)
- 3 x 8-10

### Тяга штанги в наклоне
- 3 x 10-12
- Вес: 40 кг

### Тяга верхнего блока
- 3 x 12-15

**Кардио:** 15 мин ходьба

---
`
