// MetaSystem — Muscle Group Auto-Detection + Manual Override
// Вариант В: автоопределение по ключевым словам + ручное переопределение через localStorage

export type MuscleGroup =
  | 'chest'       // Грудь
  | 'back'        // Спина
  | 'legs'        // Ноги
  | 'shoulders'   // Плечи
  | 'arms'        // Руки
  | 'core'        // Пресс/Кор
  | 'cardio'      // Кардио
  | 'other'       // Другое

export interface MuscleGroupInfo {
  id: MuscleGroup
  label: string
  emoji: string
  color: string
}

export const MUSCLE_GROUPS: MuscleGroupInfo[] = [
  { id: 'chest',     label: 'Грудь',   emoji: '💪', color: '#ef4444' },
  { id: 'back',      label: 'Спина',   emoji: '🔙', color: '#3b82f6' },
  { id: 'legs',      label: 'Ноги',    emoji: '🦵', color: '#22c55e' },
  { id: 'shoulders', label: 'Плечи',   emoji: '🏋️', color: '#f59e0b' },
  { id: 'arms',      label: 'Руки',    emoji: '💪', color: '#a855f7' },
  { id: 'core',      label: 'Пресс',   emoji: '🎯', color: '#06b6d4' },
  { id: 'cardio',    label: 'Кардио',  emoji: '❤️', color: '#f43f5e' },
  { id: 'other',     label: 'Другое',  emoji: '⚡', color: '#6b7280' },
]

// Ключевые слова для автоопределения (нижний регистр)
const KEYWORDS: Record<MuscleGroup, string[]> = {
  chest: [
    'жим', 'грудь', 'грудной', 'разводка', 'кроссовер', 'пек', 'флай', 'bench', 'chest', 'fly', 'pec',
    'наклонн', 'горизонтальн',
  ],
  back: [
    'тяга', 'подтягивани', 'спина', 'спин', 'широчайш', 'ромбовидн', 'трапеци',
    'row', 'pull', 'lat', 'back', 'deadlift', 'становая', 'гиперэкстензи',
  ],
  legs: [
    'присед', 'выпад', 'нога', 'ног', 'квадрицепс', 'бицепс бедра', 'икр', 'голень',
    'жим ног', 'разгибани', 'сгибани', 'squat', 'lunge', 'leg', 'calf', 'hamstring',
    'румынская', 'болгарский', 'гакк',
  ],
  shoulders: [
    'плеч', 'дельт', 'жим сидя', 'жим стоя', 'махи', 'подъём', 'arnold',
    'shoulder', 'delt', 'lateral', 'overhead', 'press',
  ],
  arms: [
    'бицепс', 'трицепс', 'curl', 'extension', 'сгибани', 'разгибани рук',
    'молоток', 'hammer', 'skull', 'french', 'концентрирован',
  ],
  core: [
    'пресс', 'планка', 'скручивани', 'подъём ног', 'abs', 'core', 'plank',
    'crunch', 'twist', 'вакуум', 'гиперэкстензи',
  ],
  cardio: [
    'кардио', 'ходьба', 'бег', 'велотренажёр', 'велосипед', 'эллипс',
    'cardio', 'run', 'walk', 'bike', 'treadmill',
  ],
  other: [],
}

/**
 * Автоопределение мышечной группы по названию упражнения
 */
export function detectMuscleGroup(exerciseName: string): MuscleGroup {
  const lower = exerciseName.toLowerCase()

  for (const [group, keywords] of Object.entries(KEYWORDS) as [MuscleGroup, string[]][]) {
    if (group === 'other') continue
    if (keywords.some(kw => lower.includes(kw))) return group
  }

  return 'other'
}

const STORAGE_KEY = 'ms_exercise_muscle_groups'

/**
 * Получить все ручные переопределения из localStorage
 */
export function getManualOverrides(): Record<string, MuscleGroup> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Сохранить ручное переопределение для упражнения
 */
export function setManualOverride(exerciseId: string, group: MuscleGroup): void {
  if (typeof window === 'undefined') return
  try {
    const overrides = getManualOverrides()
    overrides[exerciseId] = group
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {}
}

/**
 * Получить мышечную группу: сначала ручное переопределение, потом авто
 */
export function getMuscleGroup(exerciseId: string, exerciseName: string): MuscleGroup {
  const overrides = getManualOverrides()
  if (overrides[exerciseId]) return overrides[exerciseId]
  return detectMuscleGroup(exerciseName)
}

export function getMuscleGroupInfo(group: MuscleGroup): MuscleGroupInfo {
  return MUSCLE_GROUPS.find(g => g.id === group) ?? MUSCLE_GROUPS[MUSCLE_GROUPS.length - 1]
}
