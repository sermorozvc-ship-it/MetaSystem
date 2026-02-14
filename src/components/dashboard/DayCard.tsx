'use client'

import { Check, Play, Headphones, Dumbbell, Calculator } from 'lucide-react'

export type DayStatus = 'locked' | 'available' | 'active' | 'completed'

export interface DayTask {
    id: number
    text: string
    type: 'video' | 'audio' | 'workout' | 'tool' | 'measurement' | 'action' | 'nutrition' | 'challenge' | 'rest' | 'journal'
    completed?: boolean
}

export interface DayData {
    dayNumber: number
    title: string
    subtitle: string
    context: string
    tasks: DayTask[]
    hasWorkout: boolean
    hasVideo: boolean
    hasAudio: boolean
    hasTool?: string | null
}

interface DayCardProps {
    day: DayData
    status: DayStatus
    isSelected?: boolean
    onClick?: () => void
}

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const getStatusIcon = (status: DayStatus) => {
    switch (status) {
        case 'completed':
            return <Check className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
        default:
            return null
    }
}

const getCardClasses = (status: DayStatus, isSelected: boolean) => {
    const baseClasses = 'relative p-3 md:p-5 rounded-2xl md:rounded-3xl transition-all duration-300 min-h-[140px] md:min-h-[180px] flex flex-col cursor-pointer hover:scale-[1.02]'

    if (isSelected) {
        return `${baseClasses} day-card-active`
    }

    switch (status) {
        case 'completed':
            return `${baseClasses} day-card-completed`
        case 'active':
            return `${baseClasses} day-card-active`
        case 'available':
        case 'locked':
        default:
            return `${baseClasses} day-card-available`
    }
}

export default function DayCard({ day, status, isSelected = false, onClick }: DayCardProps) {
    // All cards are now clickable
    const completedTasks = day.tasks.filter(t => t.completed).length
    const totalTasks = day.tasks.length
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    return (
        <div
            onClick={onClick}
            className={getCardClasses(status, isSelected)}
        >
            {/* Day Header */}
            <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-gray-400">
                    {dayNames[day.dayNumber - 1]}
                </span>
                {getStatusIcon(status)}
            </div>

            {/* Day Number */}
            <div className={`text-3xl md:text-4xl font-bold mb-1 md:mb-2 ${isSelected ? 'text-meta-orange' : 'text-white'}`}>
                {day.dayNumber}
            </div>

            {/* Title */}
            <h3 className="text-xs md:text-sm font-semibold text-white mb-0.5 md:mb-1 line-clamp-1">
                {day.title}
            </h3>
            <p className="text-[10px] md:text-xs text-gray-400 line-clamp-1 mb-2 md:mb-3">
                {day.subtitle}
            </p>

            {/* Content Indicators */}
            <div className="flex items-center gap-1.5 md:gap-2 mt-auto">
                {day.hasVideo && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Play className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-400" />
                    </div>
                )}
                {day.hasAudio && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Headphones className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-400" />
                    </div>
                )}
                {day.hasWorkout && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Dumbbell className="w-3 h-3 md:w-3.5 md:h-3.5 text-green-400" />
                    </div>
                )}
                {day.hasTool && (
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-meta-orange/20 flex items-center justify-center">
                        <Calculator className="w-3 h-3 md:w-3.5 md:h-3.5 text-meta-orange" />
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            {totalTasks > 0 && (
                <div className="mt-2 md:mt-3">
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                        {completedTasks}/{totalTasks} заданий
                    </p>
                </div>
            )}

        </div>
    )
}
