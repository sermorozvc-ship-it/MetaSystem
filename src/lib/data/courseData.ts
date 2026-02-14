import { DayData } from '@/components/dashboard/DayCard'

/**
 * Статические данные курса (7 дней)
 * В реальном приложении будут загружаться из Supabase
 */
export const courseData: DayData[] = [
    {
        dayNumber: 1,
        title: 'Стратегия и Точка А',
        subtitle: 'Диагностика',
        context: 'Голодать не нужно. Используем инструменты диагностики для определения стартовой точки. Узнаем, где находится ваш метаболизм прямо сейчас.',
        hasWorkout: false,
        hasVideo: true,
        hasAudio: true,
        hasTool: 'visceral_calculator',
        tasks: [
            { id: 1, text: 'Посмотреть видео «Правила игры»', type: 'video' },
            { id: 2, text: 'Измерить рост/талию/бёдра', type: 'measurement' },
            { id: 3, text: 'Использовать калькулятор висцерального жира', type: 'tool' },
            { id: 4, text: 'Чистка холодильника (Анти-Водный протокол)', type: 'action' },
            { id: 5, text: 'Прослушать подкаст «Взлом»', type: 'audio' }
        ]
    },
    {
        dayNumber: 2,
        title: 'Активация',
        subtitle: 'Переключение топлива',
        context: 'Переключаем тело с сахара на жир. Строгий режим питания без перекусов — это ключ к активации жиросжигания.',
        hasWorkout: true,
        hasVideo: true,
        hasAudio: false,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Тренировка #1 (15 мин)', type: 'workout' },
            { id: 2, text: 'Посмотреть урок «Инсулин»', type: 'video' },
            { id: 3, text: 'Выполнить норму белка', type: 'nutrition' },
            { id: 4, text: 'БЕЗ перекусов (строго 3 приёма пищи)', type: 'action' }
        ]
    },
    {
        dayNumber: 3,
        title: 'Скрытое жиросжигание',
        subtitle: 'NEAT-активность',
        context: 'Коррекция осанки и повседневная активность для скрытого сжигания калорий. NEAT — ваш секретный союзник.',
        hasWorkout: false,
        hasVideo: true,
        hasAudio: true,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Посмотреть «Тазовый замок» (коррекция осанки)', type: 'video' },
            { id: 2, text: 'Прослушать подкаст «Феномен NEAT»', type: 'audio' },
            { id: 3, text: 'Челлендж: 8000 шагов + вставать каждые 45 мин', type: 'challenge' }
        ]
    },
    {
        dayNumber: 4,
        title: 'Ускорение',
        subtitle: 'HIIT и EPOC',
        context: 'HIIT vs обычное кардио. Эффект дожигания калорий (EPOC) — сжигаем жир даже после тренировки.',
        hasWorkout: true,
        hasVideo: false,
        hasAudio: true,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Прослушать подкаст «EPOC-эффект»', type: 'audio' },
            { id: 2, text: 'HIIT-тренировка (20 мин)', type: 'workout' },
            { id: 3, text: 'Сложные углеводы на обед', type: 'nutrition' }
        ]
    },
    {
        dayNumber: 5,
        title: 'Анти-Срыв',
        subtitle: 'Стресс и алкоголь',
        context: 'Влияние алкоголя на метаболизм и тестостерон. Управление стрессом — профилактика срывов.',
        hasWorkout: true,
        hasVideo: false,
        hasAudio: true,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Прослушать «Алкоголь и Тестостерон»', type: 'audio' },
            { id: 2, text: 'Тренировка #3 «Мобильность/Релакс»', type: 'workout' },
            { id: 3, text: 'Ужин: только белок + овощи', type: 'nutrition' }
        ]
    },
    {
        dayNumber: 6,
        title: 'Биохимия Сна',
        subtitle: 'Гормон роста',
        context: 'Гормон роста активен с 23:00 до 02:00. Оптимизация сна для максимального восстановления и жиросжигания.',
        hasWorkout: false,
        hasVideo: false,
        hasAudio: false,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Сегодня без тренировки', type: 'rest' },
            { id: 2, text: 'Прогулка на свежем воздухе', type: 'action' },
            { id: 3, text: 'Заполнить дневник (обязательно)', type: 'journal' },
            { id: 4, text: 'Лечь спать до 23:00', type: 'action' }
        ]
    },
    {
        dayNumber: 7,
        title: 'Финал',
        subtitle: 'Итоги',
        context: 'Косметический ремонт vs Капитальный ремонт. Анализ результатов и планирование следующих шагов.',
        hasWorkout: false,
        hasVideo: true,
        hasAudio: false,
        hasTool: 'body_measurements',
        tasks: [
            { id: 1, text: 'Финальные измерения тела', type: 'measurement' },
            { id: 2, text: 'Заполнить дневник', type: 'journal' },
            { id: 3, text: 'Посмотреть видео «Следующие шаги»', type: 'video' }
        ]
    }
]

/**
 * Получить данные дня по номеру
 */
export function getDayData(dayNumber: number): DayData | undefined {
    return courseData.find(d => d.dayNumber === dayNumber)
}

/**
 * Получить все дни курса
 */
export function getAllDays(): DayData[] {
    return courseData
}
