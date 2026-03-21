/**
 * Утилиты для работы с когортной системой (понедельничный старт)
 */

/**
 * Получить дату старта когорты (ближайший понедельник в 07:00).
 * Если сегодня понедельник и ещё до 07:00, возвращает сегодня 07:00.
 * Если понедельник и уже после 07:00, когорта уже началась — возвращает сегодня 07:00.
 */
export function getNextMondayStart(): Date {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = воскресенье, 1 = понедельник

    let daysUntilMonday: number

    if (dayOfWeek === 0) {
        // Воскресенье -> следующий понедельник через 1 день
        daysUntilMonday = 1
    } else if (dayOfWeek === 1) {
        // Понедельник -> сегодня (когорта стартует/стартовала в 07:00)
        daysUntilMonday = 0
    } else {
        // Вторник-суббота -> до следующего понедельника
        daysUntilMonday = 8 - dayOfWeek
    }

    const nextMonday = new Date(now)
    nextMonday.setDate(now.getDate() + daysUntilMonday)
    nextMonday.setHours(7, 0, 0, 0) // Старт в 07:00 по местному времени

    return nextMonday
}

/**
 * Получить дату старта СЛЕДУЮЩЕЙ когорты (всегда будущий понедельник 07:00).
 * Используется для таймера ожидания — всегда показывает будущую дату.
 */
export function getNextFutureMondayStart(): Date {
    const now = new Date()
    const dayOfWeek = now.getDay()

    let daysUntilMonday: number

    if (dayOfWeek === 0) {
        daysUntilMonday = 1
    } else if (dayOfWeek === 1) {
        // Если понедельник и уже после 07:00, следующий понедельник через 7 дней
        const todayAt7 = new Date(now)
        todayAt7.setHours(7, 0, 0, 0)
        daysUntilMonday = now >= todayAt7 ? 7 : 0
    } else {
        daysUntilMonday = 8 - dayOfWeek
    }

    const nextMonday = new Date(now)
    nextMonday.setDate(now.getDate() + daysUntilMonday)
    nextMonday.setHours(7, 0, 0, 0)

    return nextMonday
}

/**
 * Проверить, активна ли когорта (начался ли курс)
 */
export function isCohortActive(startDate: Date): boolean {
    const now = new Date()
    return now >= startDate
}

/**
 * Получить текущий день курса (1-7)
 * Возвращает 0, если курс ещё не начался
 */
export function getCurrentCourseDay(startDate: Date): number {
    const now = new Date()

    if (now < startDate) {
        return 0 // Курс ещё не начался
    }

    const diffTime = now.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    // День курса от 1 до 7
    return Math.min(Math.max(diffDays + 1, 1), 7)
}

/**
 * Получить оставшееся время до старта когорты
 */
export function getTimeUntilStart(startDate: Date): {
    days: number
    hours: number
    minutes: number
    seconds: number
    totalSeconds: number
} {
    const now = new Date()
    const diff = startDate.getTime() - now.getTime()

    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 }
    }

    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / (24 * 60 * 60))
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds, totalSeconds }
}

/**
 * Форматировать дату для отображения
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    })
}

/**
 * Получить дату конкретного дня курса
 */
export function getCourseDayDate(startDate: Date, dayNumber: number): Date {
    const date = new Date(startDate)
    date.setDate(date.getDate() + (dayNumber - 1))
    return date
}
