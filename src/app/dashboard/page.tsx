'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { WeekGrid, ActionPanel, DayData } from '@/components/dashboard'
import { VisceralCalculator, BodyMeasurements } from '@/components/modals'
import { courseData } from '@/lib/data/courseData'
import { getCurrentCourseDay, getNextMondayStart, isCohortActive } from '@/lib/utils/cohort'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function DashboardPage() {
    const { user } = useAuth()
    const router = useRouter()

    // Для демо: курс уже активен (день 1)
    // В реальном приложении используйте: const cohortStart = getNextMondayStart()
    const [cohortStart] = useState(() => {
        // Для демо устанавливаем старт на сегодня
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return today
    })

    const [currentDay, setCurrentDay] = useState(1)
    const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(1)
    const [completedDays, setCompletedDays] = useState<number[]>([])
    const [taskProgress, setTaskProgress] = useState<Record<number, number[]>>({})

    // Mobile bottom sheet
    const [showMobileSheet, setShowMobileSheet] = useState(false)

    // Модальные окна
    const [isVisceralOpen, setIsVisceralOpen] = useState(false)
    const [isMeasurementsOpen, setIsMeasurementsOpen] = useState(false)

    // Проверка когорты при загрузке (закомментировано для демо)
    useEffect(() => {
        // const active = isCohortActive(cohortStart)
        // if (!active) {
        //   router.push('/waiting-room')
        // }
        setCurrentDay(getCurrentCourseDay(cohortStart))
    }, [cohortStart, router])

    // Получить данные выбранного дня с прогрессом
    const getSelectedDayWithProgress = useCallback((): DayData | null => {
        if (!selectedDayNumber) return null

        const dayData = courseData.find(d => d.dayNumber === selectedDayNumber)
        if (!dayData) return null

        const completedTaskIds = taskProgress[selectedDayNumber] || []

        return {
            ...dayData,
            tasks: dayData.tasks.map(task => ({
                ...task,
                completed: completedTaskIds.includes(task.id)
            }))
        }
    }, [selectedDayNumber, taskProgress])

    // Загрузка прогресса из БД
    useEffect(() => {
        const loadProgress = async () => {
            try {
                const { getUserProgress } = await import('@/lib/services/progress')
                const progress = await getUserProgress()
                setTaskProgress(progress)
            } catch (e) {
                console.error('Failed to load progress', e)
            }
        }
        loadProgress()
    }, [cohortStart])

    // Переключение статуса задания
    const handleTaskToggle = async (dayNumber: number, taskId: number) => {
        // Оптимистичное обновление UI
        setTaskProgress(prev => {
            const dayTasks = prev[dayNumber] || []
            const isCompleted = dayTasks.includes(taskId)

            const newDayTasks = isCompleted
                ? dayTasks.filter(id => id !== taskId)
                : [...dayTasks, taskId]

            return {
                ...prev,
                [dayNumber]: newDayTasks
            }
        })

        // Сохранение в БД
        try {
            const { toggleTaskProgress } = await import('@/lib/services/progress')
            const currentDayProgress = taskProgress[dayNumber] || []
            const isCompleted = !currentDayProgress.includes(taskId) // Обратное состояние, т.к. стейт мог еще не обновиться в замыкании, но лучше вычислить явно

            // Но мы уже обновили стейт, поэтому reliable way is just to pass explicit toggle intention
            // Для простоты передадим "новое" состояние, которое мы ожидаем.
            // Но здесь в замыкании handleTaskToggle мы не видим "будущего" стейта. 
            // Поэтому вычислим isNextStateCompleted исходя из prev стейта (как в setTaskProgress выше).

            // Внимание: taskProgress в замыкании - это "старый" стейт.
            const isCurrentlyCompleted = (taskProgress[dayNumber] || []).includes(taskId)
            await toggleTaskProgress(dayNumber, taskId, !isCurrentlyCompleted)
        } catch (e) {
            console.error('Failed to save progress', e)
            // Здесь можно добавить откат стейта в случае ошибки, но для простоты пропустим
        }
    }

    // Проверка и отметка завершённого дня
    useEffect(() => {
        Object.entries(taskProgress).forEach(([dayStr, completedIds]) => {
            const dayNumber = parseInt(dayStr)
            const dayData = courseData.find(d => d.dayNumber === dayNumber)

            if (dayData && completedIds.length === dayData.tasks.length) {
                if (!completedDays.includes(dayNumber)) {
                    setCompletedDays(prev => [...prev, dayNumber])
                }
            }
        })
    }, [taskProgress, completedDays])

    // Открытие инструмента
    const handleOpenTool = (toolName: string) => {
        if (toolName === 'visceral_calculator') {
            setIsVisceralOpen(true)
        } else if (toolName === 'body_measurements') {
            setIsMeasurementsOpen(true)
        }
    }

    // Получить данные всех дней с прогрессом
    const daysWithProgress = courseData.map(day => ({
        ...day,
        tasks: day.tasks.map(task => ({
            ...task,
            completed: (taskProgress[day.dayNumber] || []).includes(task.id)
        }))
    }))

    // Выбор дня — открывает шторку на мобильных
    const handleDaySelect = (dayNumber: number) => {
        setSelectedDayNumber(dayNumber)
        // Открываем шторку только на мобильных (< lg = 1024px)
        if (window.innerWidth < 1024) {
            setShowMobileSheet(true)
        }
    }

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Атлет'

    return (
        <>
            <DashboardLayout
                userName={userName}
                currentDay={currentDay}
                showMobileSheet={showMobileSheet}
                onCloseMobileSheet={() => setShowMobileSheet(false)}
                rightPanel={
                    <ActionPanel
                        selectedDay={getSelectedDayWithProgress()}
                        onTaskToggle={handleTaskToggle}
                        onOpenTool={handleOpenTool}
                    />
                }
            >
                <WeekGrid
                    days={daysWithProgress}
                    currentDay={currentDay}
                    selectedDayNumber={selectedDayNumber}
                    onDaySelect={handleDaySelect}
                    completedDays={completedDays}
                />
            </DashboardLayout>

            {/* Модальные окна */}
            <VisceralCalculator
                isOpen={isVisceralOpen}
                onClose={() => setIsVisceralOpen(false)}
                onSave={(data) => {
                    console.log('Visceral data saved:', data)
                    // Автоматически отмечаем задание как выполненное
                    if (selectedDayNumber === 1) {
                        handleTaskToggle(1, 3) // Task ID 3 = калькулятор
                    }
                }}
            />

            <BodyMeasurements
                isOpen={isMeasurementsOpen}
                onClose={() => setIsMeasurementsOpen(false)}
                onSave={(data) => {
                    console.log('Measurements saved:', data)
                    if (selectedDayNumber === 7) {
                        handleTaskToggle(7, 1) // Task ID 1 = финальные измерения
                    }
                }}
            />
        </>
    )
}
