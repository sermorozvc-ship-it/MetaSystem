'use client'

import DayCard, { DayData, DayStatus } from './DayCard'

interface WeekGridProps {
    days: DayData[]
    currentDay: number
    selectedDayNumber: number | null
    onDaySelect: (dayNumber: number) => void
    completedDays: number[]
}

export default function WeekGrid({
    days,
    currentDay,
    selectedDayNumber,
    onDaySelect,
    completedDays
}: WeekGridProps) {

    const getDayStatus = (dayNumber: number): DayStatus => {
        if (completedDays.includes(dayNumber)) {
            return 'completed'
        }
        if (dayNumber === currentDay) {
            return 'active'
        }
        if (dayNumber < currentDay) {
            return 'available'
        }
        return 'locked'
    }

    return (
        <div className="glass-card p-4 md:p-6">
            {/* Week Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-2">
                <div>
                    <h2 className="text-lg md:text-xl font-bold text-white">7-дневный курс</h2>
                    <p className="text-xs md:text-sm text-gray-400 mt-1">Метаболический Запуск</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-meta-orange shadow-glow-orange-sm" />
                        <span className="text-[10px] md:text-xs text-gray-400">Текущий</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500" />
                        <span className="text-[10px] md:text-xs text-gray-400">Выполнен</span>
                    </div>
                </div>
            </div>

            {/* Days Grid - responsive columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
                {days.map((day) => (
                    <DayCard
                        key={day.dayNumber}
                        day={day}
                        status={getDayStatus(day.dayNumber)}
                        isSelected={selectedDayNumber === day.dayNumber}
                        onClick={() => onDaySelect(day.dayNumber)}
                    />
                ))}
            </div>

            {/* Progress Summary */}
            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <span className="text-xs md:text-sm text-gray-400">Общий прогресс</span>
                        <div className="text-xl md:text-2xl font-bold text-white mt-1">
                            {completedDays.length} <span className="text-gray-500 text-base md:text-lg font-normal">/ 7 дней</span>
                        </div>
                    </div>
                    <div className="w-full sm:w-48">
                        <div className="progress-bar h-2.5 md:h-3">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${(completedDays.length / 7) * 100}%` }}
                            />
                        </div>
                        <p className="text-right text-[10px] md:text-xs text-gray-500 mt-1">
                            {Math.round((completedDays.length / 7) * 100)}% пройдено
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
