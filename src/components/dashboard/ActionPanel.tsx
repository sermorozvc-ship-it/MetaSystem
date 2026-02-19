'use client'

import { useState, useEffect } from 'react'
import {
    Play,
    Headphones,
    Dumbbell,
    Calculator,
    Check,
    ChevronRight,
    ClipboardList,
    Utensils,
    Target,
    Moon,
    BookOpen,
    X,
    Sparkles,
    ArrowRight,
    Camera,
    Clock,
    CheckCircle,
    XCircle
} from 'lucide-react'
import { DayData, DayTask } from './DayCard'
import { DayReportModal } from '../modals'
import { getDayReports, DayReport } from '@/lib/services/reports'

interface ActionPanelProps {
    selectedDay: DayData | null
    onTaskToggle?: (dayNumber: number, taskId: number) => void
    onOpenTool?: (toolName: string) => void
}

// Day 1 specific content
const day1Content = {
    morningBrief: {
        title: 'СТРАТЕГИЯ И ТОЧКА ОТСЧЁТА',
        message: `Добро пожаловать в Неделю Метаболической Перезагрузки! Сегодня мы не бежим марафон. Сегодня мы готовим снаряжение. От того, как вы выполните задания этого дня, зависит 80% вашего результата в воскресенье.

Твои задачи на сегодня:

1️⃣ Посмотри видео «Правила игры» (3 мин). Узнай, почему нельзя голодать и как мы будем работать.

2️⃣ Узнай свой Индекс Висцерального Жира (5 мин). Я внедрил новый инструмент диагностики. Возьми сантиметровую ленту. Измерь свой Рост, Талию и Бёдра. Внеси цифры в Калькулятор. Система рассчитает твои коэффициенты и покажет, находишься ли ты в «Тревожной зоне». 📸 Сделай скриншот результата — это твоя объективная «Точка А».

3️⃣ Настрой Инструмент. Открой приложение и посмотри видео-инструкцию. Попробуй составить меню на завтра.

4️⃣ Заполни холодильник. Посмотри видео с моей кухни. Выкинь (или спрячь) всё, что в "Стоп-листе", и купи продукты по списку "Anti-Water".

🎧 Вечером: Обязательно послушай аудио-подкаст про "Ломку". Пришлю вечером.

👇 ОТЧЁТ ПО ДНЮ 1: В личном сообщении пришли:
1. Скриншот твоего результата из Калькулятора (с зоной риска).
2. Фото твоего продуктового набора (открытый холодильник или стол).`,
        icon: Sparkles
    },
    eveningBrief: {
        title: 'Вечерний бриф',
        preview: 'Завтра: Активация жиросжигания',
        message: 'Завтра мы включим режим сжигания жира. Вы узнаете, как инсулин управляет вашим весом и почему перекусы — ваш главный враг. Подготовьтесь к первой тренировке!',
        icon: ArrowRight
    },
    taskDetails: {
        1: {
            title: 'Видео «Правила игры»',
            duration: '12 минут',
            content: `В этом видео вы узнаете:

• Почему 95% диет не работают
• Как работает метаболизм на самом деле
• 3 ключевых принципа программы
• Что ожидать от 7 дней

Это фундамент всего курса. Посмотрите внимательно и сделайте заметки.`,
            videoUrl: 'https://example.com/video1'
        },
        2: {
            title: 'Измерения тела',
            duration: '5 минут',
            content: `Правильные измерения — ключ к отслеживанию прогресса.

📏 Рост — стойте прямо, без обуви
📏 Талия — на уровне пупка, не втягивая живот
📏 Бёдра — в самой широкой точке ягодиц

Измеряйте утром, натощак, для точности.`
        },
        3: {
            title: 'Калькулятор висцерального жира',
            duration: '2 минуты',
            content: `Висцеральный жир — скрытый враг здоровья.

Калькулятор определит ваш уровень риска на основе:
• Соотношения талии к бёдрам (WHR)
• Соотношения талии к росту (WHtR)

Результат покажет, насколько срочно нужно действовать.`
        },
        4: {
            title: 'Чистка холодильника',
            duration: '15 минут',
            content: `Анти-Водный протокол: убираем всё, что задерживает воду.

🚫 Удалить:
• Соусы (кетчуп, майонез, соевый)
• Колбасы и копчёности
• Сладкие напитки
• Чипсы и снеки

✅ Оставить:
• Свежие овощи
• Мясо, рыба, яйца
• Чистая вода`
        },
        5: {
            title: 'Подкаст «Взлом»',
            duration: '18 минут',
            content: `Аудио для прослушивания в любое время.

В этом подкасте:
• История создания методики
• Научные основы программы
• Реальные кейсы трансформаций

Можно слушать на прогулке или перед сном.`,
            audioUrl: 'https://example.com/podcast1'
        }
    }
}

const getTaskIcon = (type: DayTask['type']) => {
    switch (type) {
        case 'video':
            return <Play className="w-4 h-4" />
        case 'audio':
            return <Headphones className="w-4 h-4" />
        case 'workout':
            return <Dumbbell className="w-4 h-4" />
        case 'tool':
        case 'measurement':
            return <Calculator className="w-4 h-4" />
        case 'nutrition':
            return <Utensils className="w-4 h-4" />
        case 'challenge':
            return <Target className="w-4 h-4" />
        case 'rest':
            return <Moon className="w-4 h-4" />
        case 'journal':
            return <BookOpen className="w-4 h-4" />
        default:
            return <ClipboardList className="w-4 h-4" />
    }
}

const getTaskColor = (type: DayTask['type']) => {
    switch (type) {
        case 'video':
            return 'text-blue-400 bg-blue-500/20'
        case 'audio':
            return 'text-purple-400 bg-purple-500/20'
        case 'workout':
            return 'text-green-400 bg-green-500/20'
        case 'tool':
        case 'measurement':
            return 'text-meta-orange bg-meta-orange/20'
        case 'nutrition':
            return 'text-yellow-400 bg-yellow-500/20'
        case 'challenge':
            return 'text-cyan-400 bg-cyan-500/20'
        case 'rest':
            return 'text-indigo-400 bg-indigo-500/20'
        case 'journal':
            return 'text-pink-400 bg-pink-500/20'
        default:
            return 'text-gray-400 bg-gray-500/20'
    }
}

// Content Modal Component
function ContentModal({
    isOpen,
    onClose,
    title,
    content,
    duration,
    type
}: {
    isOpen: boolean
    onClose: () => void
    title: string
    content: string
    duration?: string
    type?: 'morning' | 'evening' | 'task'
}) {
    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="glass-card p-4 sm:p-6 md:p-8 w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto animate-fade-in mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{title}</h2>
                        {duration && (
                            <span className="text-xs sm:text-sm text-meta-orange mt-1 block">{duration}</span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                   text-gray-400 hover:text-white transition-colors shrink-0"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                        {content}
                    </div>
                </div>

                {/* Action Button */}
                {type === 'task' && (
                    <button
                        onClick={onClose}
                        className="glass-button w-full mt-6"
                    >
                        Понятно, приступаю!
                    </button>
                )}
            </div>
        </div>
    )
}

export default function ActionPanel({ selectedDay, onTaskToggle, onOpenTool }: ActionPanelProps) {
    const [modalState, setModalState] = useState<{
        isOpen: boolean
        title: string
        content: string
        duration?: string
        type?: 'morning' | 'evening' | 'task'
    }>({
        isOpen: false,
        title: '',
        content: ''
    })
    const [isReportOpen, setIsReportOpen] = useState(false)
    const [reportStatus, setReportStatus] = useState<DayReport | null>(null)
    const [loadingStatus, setLoadingStatus] = useState(false)

    const openModal = (title: string, content: string, duration?: string, type?: 'morning' | 'evening' | 'task') => {
        setModalState({ isOpen: true, title, content, duration, type })
    }

    const closeModal = () => {
        setModalState({ ...modalState, isOpen: false })
    }

    // Загружаем статус отчёта при смене дня
    useEffect(() => {
        if (!selectedDay) return
        setReportStatus(null) // Очищаем статус при смене дня
        let cancelled = false

        const loadStatus = async () => {
            // Если у нас уже есть статус, не показываем состояние загрузки (фоновое обновление)
            if (!reportStatus) {
                setLoadingStatus(true)
            }

            // Предохранительный таймер на 5 секунд
            const safetyTimer = setTimeout(() => {
                if (!cancelled) setLoadingStatus(false)
            }, 5000)

            try {
                const reports = await getDayReports(selectedDay.dayNumber)
                if (!cancelled) {
                    // Ищем "лучший" статус: сначала approved, потом pending, потом rejected
                    const preferredReport = reports.find(r => r.status === 'approved')
                        || reports.find(r => r.status === 'pending')
                        || reports[0]
                        || null
                    setReportStatus(preferredReport)
                }
            } catch (e) {
                console.error('Failed to load report status:', e)
            } finally {
                if (!cancelled) {
                    setLoadingStatus(false)
                    clearTimeout(safetyTimer)
                }
            }
        }

        loadStatus()

        // Добавляем слушатель фокуса окна для авто-обновления статуса
        const handleFocus = () => loadStatus()
        window.addEventListener('focus', handleFocus)

        return () => {
            cancelled = true
            window.removeEventListener('focus', handleFocus)
        }
    }, [selectedDay?.dayNumber])

    // После закрытия модалки — обновляем статус
    const handleReportClose = async () => {
        setIsReportOpen(false)
        if (!selectedDay) return
        try {
            const reports = await getDayReports(selectedDay.dayNumber)
            // Ищем "лучший" статус: сначала approved, потом pending, потом rejected
            const preferredReport = reports.find(r => r.status === 'approved')
                || reports.find(r => r.status === 'pending')
                || reports[0]
                || null
            setReportStatus(preferredReport)
        } catch (e) {
            console.error('Failed to refresh report status:', e)
        }
    }

    if (!selectedDay) {
        return (
            <div className="glass-card h-full p-6 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-deep-dark-200 flex items-center justify-center mb-4">
                    <ClipboardList className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Выберите день</h3>
                <p className="text-sm text-gray-400">
                    Нажмите на карточку дня, чтобы увидеть задания
                </p>
            </div>
        )
    }

    const completedCount = selectedDay.tasks.filter(t => t.completed).length

    // Get day-specific content (currently only Day 1)
    const dayContent = selectedDay.dayNumber === 1 ? day1Content : null

    return (
        <>
            <div className="glass-card h-full p-4 md:p-6 flex flex-col animate-slide-in-right overflow-hidden">
                {/* Header */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-meta-orange">День {selectedDay.dayNumber}</span>
                        <span className="text-xs text-gray-400">
                            {completedCount}/{selectedDay.tasks.length} выполнено
                        </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white mb-1">{selectedDay.title}</h2>
                    <p className="text-sm text-gray-400">{selectedDay.subtitle}</p>
                </div>

                {/* Morning Brief Block (Day 1) */}
                {dayContent && (
                    <div
                        onClick={() => openModal(
                            dayContent.morningBrief.title,
                            dayContent.morningBrief.message,
                            undefined,
                            'morning'
                        )}
                        className="glass-card p-4 mb-4 bg-gradient-to-r from-meta-orange/20 to-meta-orange/5 
                                   border-meta-orange/30 cursor-pointer hover:border-meta-orange/50 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-meta-orange/30 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-meta-orange" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-meta-orange mb-1">
                                    {dayContent.morningBrief.title}
                                </h4>
                                <p className="text-xs text-gray-300 line-clamp-2">
                                    {dayContent.morningBrief.message}
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-meta-orange shrink-0" />
                        </div>
                    </div>
                )}

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Задания на сегодня
                    </h3>

                    {selectedDay.tasks.map((task) => {
                        const taskDetail = dayContent?.taskDetails?.[task.id as keyof typeof day1Content.taskDetails]

                        return (
                            <div
                                key={task.id}
                                onClick={() => {
                                    if (taskDetail) {
                                        openModal(
                                            taskDetail.title,
                                            taskDetail.content,
                                            taskDetail.duration,
                                            'task'
                                        )
                                    } else {
                                        onTaskToggle?.(selectedDay.dayNumber, task.id)
                                    }
                                }}
                                className={`
                                    group flex items-center gap-3 p-4 rounded-2xl cursor-pointer
                                    transition-all duration-200 border
                                    ${task.completed
                                        ? 'bg-green-500/10 border-green-500/20'
                                        : 'bg-deep-dark-200/40 border-white/5 hover:border-white/10'
                                    }
                                `}
                            >
                                {/* Checkbox */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onTaskToggle?.(selectedDay.dayNumber, task.id)
                                    }}
                                    className={`
                                        w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0
                                        transition-all duration-200
                                        ${task.completed
                                            ? 'bg-green-500 border-green-500'
                                            : 'border-gray-600 group-hover:border-meta-orange/50'
                                        }
                                    `}
                                >
                                    {task.completed && <Check className="w-4 h-4 text-white" />}
                                </div>

                                {/* Icon */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getTaskColor(task.type)}`}>
                                    {getTaskIcon(task.type)}
                                </div>

                                {/* Text */}
                                <span className={`flex-1 text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                                    {task.text}
                                </span>

                                {/* Arrow */}
                                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-meta-orange transition-colors shrink-0" />
                            </div>
                        )
                    })}
                </div>

                {/* Evening Brief Block (Day 1) */}
                {dayContent && (
                    <div
                        onClick={() => openModal(
                            dayContent.eveningBrief.title,
                            dayContent.eveningBrief.message,
                            undefined,
                            'evening'
                        )}
                        className="glass-card p-4 mt-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/10 
                                   border-indigo-500/30 cursor-pointer hover:border-indigo-500/50 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center shrink-0">
                                <Moon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-indigo-400 mb-1">
                                    {dayContent.eveningBrief.title}
                                </h4>
                                <p className="text-xs text-gray-300">
                                    {dayContent.eveningBrief.preview}
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />
                        </div>
                    </div>
                )}

                {/* Tool Button (if applicable) */}
                {selectedDay.hasTool && (
                    <button
                        onClick={() => onOpenTool?.(selectedDay.hasTool!)}
                        className="glass-button w-full mt-4 flex items-center justify-center gap-2"
                    >
                        <Calculator className="w-5 h-5" />
                        {selectedDay.hasTool === 'visceral_calculator'
                            ? 'Калькулятор висцерального жира'
                            : 'Измерения тела'
                        }
                    </button>
                )}

                {/* Report Button — динамический статус */}
                {(() => {
                    if (loadingStatus) {
                        return (
                            <div className="w-full mt-3 py-3.5 rounded-xl bg-white/5 flex items-center justify-center gap-2 text-gray-500 text-sm">
                                <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                                Загрузка...
                            </div>
                        )
                    }

                    if (!reportStatus) {
                        // Отчёт не отправлен
                        return (
                            <button
                                onClick={() => setIsReportOpen(true)}
                                className="glass-button-secondary w-full mt-3 flex items-center justify-center gap-2"
                            >
                                <Camera className="w-5 h-5" />
                                Отправить отчёт дня
                            </button>
                        )
                    }

                    if (reportStatus.status === 'pending') {
                        // Отчёт отправлен, ожидает проверки
                        return (
                            <div className="w-full mt-3 py-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30
                                           flex items-center justify-center gap-2 text-yellow-400 text-sm font-semibold">
                                <Clock className="w-5 h-5" />
                                Отчёт отправлен — ожидает проверки
                            </div>
                        )
                    }

                    if (reportStatus.status === 'approved') {
                        // Отчёт принят куратором
                        return (
                            <div className="w-full mt-3 py-3.5 rounded-xl bg-green-500/10 border border-green-500/30
                                           flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                                    <CheckCircle className="w-5 h-5" />
                                    Отчёт принят куратором ✓
                                </div>
                                {reportStatus.curator_comment && (
                                    <p className="text-xs text-green-300/70 text-center px-2">
                                        {reportStatus.curator_comment}
                                    </p>
                                )}
                            </div>
                        )
                    }

                    if (reportStatus.status === 'rejected') {
                        // Нужна доработка
                        return (
                            <div className="w-full mt-3 rounded-xl bg-red-500/10 border border-red-500/30 overflow-hidden">
                                <div className="py-3 flex items-center justify-center gap-2 text-red-400 text-sm font-semibold">
                                    <XCircle className="w-5 h-5" />
                                    Требуется доработка
                                </div>
                                {reportStatus.curator_comment && (
                                    <div className="px-4 pb-3 text-xs text-red-300/80 text-center border-t border-red-500/20 pt-2">
                                        {reportStatus.curator_comment}
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsReportOpen(true)}
                                    className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold
                                               transition-all flex items-center justify-center gap-1.5 border-t border-red-500/20"
                                >
                                    <Camera className="w-4 h-4" />
                                    Отправить повторно
                                </button>
                            </div>
                        )
                    }

                    return null
                })()}
            </div>

            {/* Content Modal */}
            <ContentModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                title={modalState.title}
                content={modalState.content}
                duration={modalState.duration}
                type={modalState.type}
            />

            {/* Day Report Modal */}
            <DayReportModal
                isOpen={isReportOpen}
                onClose={handleReportClose}
                dayNumber={selectedDay.dayNumber}
            />
        </>
    )
}
