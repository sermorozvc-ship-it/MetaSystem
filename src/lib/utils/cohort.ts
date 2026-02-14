/**
 * Утилиты для работы с когортной системой (понедельничный старт)
 */

/**
 * Получить дату старта когорты (ближайший понедельник).
 * Если сегодня понедельник и до 00:00, возвращает сегодня.
 */
export function getNextMondayStart(): Date {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = воскресенье, 1 = понедельник

    let daysUntilMonday: number

    if (dayOfWeek === 0) {
        // Воскресенье -> следующий понедельник через 1 день
        daysUntilMonday = 1
    } else if (dayOfWeek === 1) {
        // Понедельник -> сегодня
        daysUntilMonday = 0
    } else {
        // Вторник-суббота -> до следующего понедельника
        daysUntilMonday = 8 - dayOfWeek
    }

    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilMonday)
    nextMonday.setHours(0, 0, 0, 0)

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
