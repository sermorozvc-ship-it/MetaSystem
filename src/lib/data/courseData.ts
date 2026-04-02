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
            { id: 1, text: 'Посмотри видео «Правила игры» (2 мин)', type: 'video' },
            { id: 2, text: 'Узнай свой Индекс Висцерального Жира', type: 'measurement' },
            { id: 3, text: 'Настрой инструмент', type: 'tool' },
            { id: 4, text: 'Заполни холодильник', type: 'action' },
            { id: 5, text: 'Прослушать аудио-подкаст про "Ломку"', type: 'audio' }
        ]
    },
    {
        dayNumber: 2,
        title: 'Активация',
        subtitle: 'Переключение топлива',
        context: 'Переключаем тело с сахара на жир. Строгий режим питания без перекусов — это ключ к активации жиросжигания.',
        hasWorkout: true,
        hasVideo: true,
        hasAudio: true,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Тренировка #1 (15 мин)', type: 'workout' },
            { id: 2, text: 'Утренний подкаст', type: 'audio' },
            { id: 3, text: 'Посмотреть урок «Инсулин»', type: 'video' },
            { id: 4, text: 'Выполнить норму белка', type: 'nutrition' },
            { id: 5, text: 'БЕЗ перекусов (строго 3 приёма пищи)', type: 'action' }
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
        hasVideo: true,
        hasAudio: false,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Тренировка №2 (HIIT)', type: 'workout' },
            { id: 2, text: 'Углеводная загрузка (в обед)', type: 'nutrition' },
            { id: 3, text: 'Следить за гидратацией', type: 'action' }
        ]
    },
    {
        dayNumber: 5,
        title: 'Анти-Срыв',
        subtitle: 'Стресс и алкоголь',
        context: 'Влияние алкоголя на метаболизм и тестостерон. Управление стрессом — профилактика срывов.',
        hasWorkout: true,
        hasVideo: true,
        hasAudio: true,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Подкаст: Алкоголь и Тестостерон', type: 'audio' },
            { id: 2, text: 'Тренировка №3 «Мобильность»', type: 'workout' },
            { id: 3, text: 'Ужин Стратега', type: 'nutrition' }
        ]
    },
    {
        dayNumber: 6,
        title: 'Ментальная перезагрузка',
        subtitle: 'Сон и Жиры',
        context: 'Гормон роста активен с 23:00 до 02:00. Разбор психологии срывов, оптимизация сна для максимального жиросжигания.',
        hasWorkout: false,
        hasVideo: true,
        hasAudio: true,
        hasTool: null,
        tasks: [
            { id: 1, text: 'Лекция: «Невидимые тормоза»', type: 'video' },
            { id: 2, text: 'Подкаст: «Сон и Жиры»', type: 'audio' },
            { id: 3, text: 'Активность: «Прогулка фермера» (60 мин)', type: 'action' },
            { id: 4, text: 'Меню: «Жировая загрузка»', type: 'nutrition' },
            { id: 5, text: 'Бортовой журнал: Инсайт дня', type: 'journal' }
        ]
    },
    {
        dayNumber: 7,
        title: 'Финал',
        subtitle: 'Итоги',
        context: 'Косметический ремонт vs Капитальный ремонт. Анализ результатов и планирование следующих шагов.',
        hasWorkout: false,
        hasVideo: true,
        hasAudio: true,
        hasTool: 'body_measurements',
        tasks: [
            { id: 1, text: 'Утренний подкаст', type: 'audio' },
            { id: 2, text: 'Финальные замеры', type: 'measurement' },
            { id: 3, text: 'Фото «После»', type: 'journal' },
            { id: 4, text: 'Видео: «Дорожная карта»', type: 'video' }
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
