/**
 * Cohort utilities for managing program start dates and timers
 */

/**
 * Get the next Monday at 00:00 UTC
 */
export function getNextMondayStart(): Date {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    
    // Calculate days until next Monday (1 = Monday)
    const daysUntilMonday = dayOfWeek === 1 ? 7 : (1 - dayOfWeek + 7) % 7
    
    const nextMonday = new Date(now)
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday)
    nextMonday.setUTCHours(0, 0, 0, 0)
    
    return nextMonday
}

/**
 * Get the next future Monday (not today if today is Monday)
 */
export function getNextFutureMondayStart(): Date {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    
    // Always get the next Monday, even if today is Monday
    const daysUntilMonday = dayOfWeek === 1 ? 7 : (1 - dayOfWeek + 7) % 7
    
    const nextMonday = new Date(now)
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday)
    nextMonday.setUTCHours(0, 0, 0, 0)
    
    return nextMonday
}

/**
 * Check if a cohort is currently active
 * A cohort is active if the current time is >= cohort start time
 */
export function isCohortActive(cohortStart: Date): boolean {
    const now = new Date()
    return now >= cohortStart
}

/**
 * Get time remaining until cohort starts
 */
export function getTimeUntilStart(cohortStart: Date): {
    days: number
    hours: number
    minutes: number
    seconds: number
    totalSeconds: number
} {
    const now = new Date()
    const diff = cohortStart.getTime() - now.getTime()
    
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
 * Format a date for display
 */
export function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    }
    
    return new Intl.DateTimeFormat('ru-RU', options).format(date)
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date)
    const day = d.getUTCDay()
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
    
    const weekStart = new Date(d.setUTCDate(diff))
    weekStart.setUTCHours(0, 0, 0, 0)
    
    return weekStart
}

/**
 * Get the end of the current week (Sunday)
 */
export function getWeekEnd(date: Date = new Date()): Date {
    const weekStart = getWeekStart(date)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    weekEnd.setUTCHours(23, 59, 59, 999)
    
    return weekEnd
}

/**
 * Check if a date is within a cohort week
 */
export function isDateInCohortWeek(date: Date, cohortStart: Date): boolean {
    const weekStart = getWeekStart(cohortStart)
    const weekEnd = getWeekEnd(cohortStart)
    
    return date >= weekStart && date <= weekEnd
}
