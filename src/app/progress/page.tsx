'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
    TrendingUp, ArrowLeft, Flame, Target, Zap,
    Calendar, CheckCircle, Clock, Award, Star,
    ChevronRight, BarChart3, Activity, Trophy,
    Play, Headphones, Dumbbell, Calculator,
    Moon, Droplets, Heart, Brain, Info
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { courseData } from '@/lib/data/courseData'
import { getJournalEntries, JournalEntry } from '@/lib/services/journal'

// Типы для вкладок
type TabType = 'course' | 'health'

export default function ProgressPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState<TabType>('course')
    const [taskProgress, setTaskProgress] = useState<Record<number, number[]>>({})
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedDay, setExpandedDay] = useState<number | null>(null)

    const loadData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Загрузка прогресса курса (с предохранителем)
            const { getUserProgress } = await import('@/lib/services/progress')

            // Если юзера нет, ставим пустой прогресс, чтобы не блокировать UI
            if (!user) {
                setTaskProgress({})
            } else {
                // Пытаемся загрузить прогресс, но если виснет дольше 4 сек - скипаем
                const progressPromise = getUserProgress()
                const timeoutPromise = new Promise<Record<number, number[]>>((res) =>
                    setTimeout(() => res({}), 4000)
                )

                const progress = await Promise.race([progressPromise, timeoutPromise])
                setTaskProgress(progress || {})
            }
        } catch (e) {
            console.error('Failed to load course progress', e)
            setTaskProgress({}) // Фоллбэк, чтобы не сломать UI
        }

        try {
            // Загрузка записей дневника
            if (user) {
                const entriesPromise = getJournalEntries()
                const timeoutPromise = new Promise<JournalEntry[]>((res) =>
                    setTimeout(() => res([]), 4000)
                )
                const entries = await Promise.race([entriesPromise, timeoutPromise])
                setJournalEntries(Array.isArray(entries) ? entries : [])
            } else {
                const stored = localStorage.getItem('demo_journal')
                try {
                    const parsed = stored ? JSON.parse(stored) : []
                    setJournalEntries(Array.isArray(parsed) ? parsed : [])
                } catch {
                    setJournalEntries([])
                }
            }
        } catch (e) {
            console.error('Failed to load journal data', e)
        } finally {
            setIsLoading(false)
        }
    }, [user])

    useEffect(() => {
        let isMounted = true

        if (!authLoading) {
            loadData().finally(() => {
                if (isMounted) setIsLoading(false)
            })
        }

        return () => { isMounted = false }
    }, [authLoading, loadData])

    // --- Логика курса ---
    const totalTasks = courseData.reduce((acc, day) => acc + day.tasks.length, 0)

    const safeTaskProgress = taskProgress || {}
    const completedTasks = Object.values(safeTaskProgress).reduce((acc, tasks) => acc + (Array.isArray(tasks) ? tasks.length : 0), 0)
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const completedDaysCount = courseData.filter(day => {
        const completed = safeTaskProgress[day.dayNumber] || []
        return Array.isArray(completed) && completed.length === day.tasks.length
    }).length

    let streak = 0
    for (let i = 1; i <= 7; i++) {
        const dayData = courseData.find(d => d.dayNumber === i)
        if (!dayData) break
        const completed = safeTaskProgress[i] || []
        if (Array.isArray(completed) && completed.length === dayData.tasks.length) streak++
        else break
    }

    // --- Логика здоровья (Дневник) ---
    const safeJournalEntries = Array.isArray(journalEntries) ? journalEntries : []

    const last7DaysJournal = useMemo(() => {
        // Берем последние 7 записей и переворачиваем для графика (от старых к новым)
        return [...safeJournalEntries].slice(0, 7).reverse()
    }, [safeJournalEntries])

    const avgSleep = useMemo(() => {
        if (!last7DaysJournal || last7DaysJournal.length === 0) return "0"
        const sum = last7DaysJournal.reduce((acc, curr) => acc + (curr?.sleep_hours || 0), 0)
        return (sum / last7DaysJournal.length).toFixed(1)
    }, [last7DaysJournal])

    const avgMood = useMemo(() => {
        if (!last7DaysJournal || last7DaysJournal.length === 0) return "0"
        const sum = last7DaysJournal.reduce((acc, curr) => acc + (curr?.mood || 0), 0)
        return (sum / last7DaysJournal.length).toFixed(1)
    }, [last7DaysJournal])

    // Построение пути для SVG графика (Mood & Energy)
    const generatePath = (data: number[], max: number) => {
        if (!Array.isArray(data) || data.length < 2) return ""
        const width = 100
        const height = 40
        const step = width / (data.length - 1)

        return data.reduce((path, val, i) => {
            const x = i * step
            const y = height - (val / max) * height
            return path + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`)
        }, "")
    }

    const moodPath = useMemo(() => generatePath(last7DaysJournal.map(e => e?.mood || 0), 5), [last7DaysJournal])
    const energyPath = useMemo(() => generatePath(last7DaysJournal.map(e => e?.energy || 0), 5), [last7DaysJournal])

    // Достижения
    const achievements = [
        { id: 'first_task', title: 'Первый шаг', description: 'Выполните первое задание', icon: Star, color: 'text-yellow-400 bg-yellow-500/20', unlocked: completedTasks >= 1 },
        { id: 'day_complete', title: 'Полный день', description: 'Выполните все задания за день', icon: CheckCircle, color: 'text-green-400 bg-green-500/20', unlocked: completedDaysCount >= 1 },
        { id: 'streak_3', title: 'Три дня подряд', description: '3 дня без пропусков', icon: Flame, color: 'text-orange-400 bg-orange-500/20', unlocked: streak >= 3 },
        { id: 'journal_pro', title: 'Осознанность', description: '7 записей в дневнике', icon: Brain, color: 'text-purple-400 bg-purple-500/20', unlocked: safeJournalEntries.length >= 7 },
    ]

    const getTaskIcon = (type: string) => {
        switch (type) {
            case 'video': return <Play className="w-3.5 h-3.5" />
            case 'audio': return <Headphones className="w-3.5 h-3.5" />
            case 'workout': return <Dumbbell className="w-3.5 h-3.5" />
            default: return <CheckCircle className="w-3.5 h-3.5" />
        }
    }


    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="progress" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10
                                       flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-lg"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tight">АНАЛИТИКА ПРОГРЕССА</h1>
                            <p className="text-xs text-meta-orange font-bold uppercase tracking-[3px] mt-1">твои показатели успеха</p>
                        </div>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex p-1.5 bg-deep-dark-200/50 rounded-2xl border border-white/5 w-fit">
                        <button
                            onClick={() => setActiveTab('course')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all
                                ${activeTab === 'course' ? 'bg-meta-orange text-white shadow-lg shadow-meta-orange/20' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Курс
                        </button>
                        <button
                            onClick={() => setActiveTab('health')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all
                                ${activeTab === 'health' ? 'bg-meta-orange text-white shadow-lg shadow-meta-orange/20' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Здоровье
                        </button>
                    </div>
                </div>

                {(authLoading || isLoading) ? (
                    <div className="space-y-6 animate-pulse">
                        <div className="h-40 rounded-3xl bg-white/5" />
                        <div className="h-64 rounded-3xl bg-white/5" />
                        <div className="h-32 rounded-3xl bg-white/5" />
                    </div>
                ) : activeTab === 'course' ? (
                    <div className="animate-fade-in space-y-8">
                        {/* Course Progress Summary */}
                        <div className="glass-card p-6 md:p-10">
                            <div className="flex flex-col lg:flex-row items-center gap-10">
                                {/* Circular Progress */}
                                <div className="relative w-40 h-40 md:w-56 md:h-56 shrink-0 group">
                                    <div className="absolute inset-0 bg-meta-orange/10 rounded-full blur-3xl group-hover:bg-meta-orange/20 transition-all duration-700" />
                                    <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                                        <circle
                                            cx="60" cy="60" r="54" fill="none"
                                            stroke="url(#progGrad)"
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${completionPercent * 3.39} ${339 - completionPercent * 3.39}`}
                                            className="transition-all duration-1000 ease-out"
                                        />
                                        <defs>
                                            <linearGradient id="progGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#FF4500" />
                                                <stop offset="100%" stopColor="#FFA500" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                        <span className="text-4xl md:text-6xl font-black text-white italic">{completionPercent}%</span>
                                        <span className="text-[10px] font-black text-meta-orange uppercase tracking-[2px] mt-1">завершено</span>
                                    </div>
                                </div>

                                {/* Stats Info */}
                                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                                    {[
                                        { label: 'Заданий', val: completedTasks, total: totalTasks, icon: CheckCircle, color: 'text-emerald-400' },
                                        { label: 'Дней', val: completedDaysCount, total: 7, icon: Calendar, color: 'text-blue-400' },
                                        { label: 'Серия', val: streak, total: null, icon: Flame, color: 'text-orange-500' },
                                        { label: 'Наград', val: achievements.filter(a => a.unlocked).length, total: achievements.length, icon: Trophy, color: 'text-purple-400' }
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white/[0.03] border border-white/5 p-5 rounded-[2rem] hover:bg-white/[0.05] transition-all group">
                                            <stat.icon className={`w-5 h-5 ${stat.color} mb-3 group-hover:scale-110 transition-transform`} />
                                            <div className="text-2xl font-black text-white italic">
                                                {stat.val}{stat.total && <span className="text-xs text-gray-700 not-italic ml-1">/{stat.total}</span>}
                                            </div>
                                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Day-by-Day Progress */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-meta-orange" /> Прогресс по дням
                                </h3>
                                {courseData.map(day => {
                                    const completedIds = safeTaskProgress[day.dayNumber] || []
                                    const validCompletedIds = Array.isArray(completedIds) ? completedIds : []
                                    const isFullyDone = validCompletedIds.length === day.tasks.length
                                    const isExpanded = expandedDay === day.dayNumber

                                    return (
                                        <div key={day.dayNumber} className="group">
                                            <div
                                                onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                                                className={`flex items-center gap-5 p-5 rounded-[2rem] cursor-pointer transition-all border
                                                    ${isFullyDone ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                                            >
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl italic
                                                    ${isFullyDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-600'}`}>
                                                    {isFullyDone ? '✓' : day.dayNumber}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-black text-white uppercase tracking-wider">{day.title}</h4>
                                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-gray-600 uppercase">
                                                        <span>Выполнено: {validCompletedIds.length}/{day.tasks.length}</span>
                                                        <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden max-w-[100px]">
                                                            <div className={`h-full transition-all duration-500 ${isFullyDone ? 'bg-emerald-500' : 'bg-meta-orange'}`}
                                                                style={{ width: `${(validCompletedIds.length / day.tasks.length) * 100}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className={`w-5 h-5 text-gray-700 transition-transform ${isExpanded ? 'rotate-90 text-white' : ''}`} />
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-3 ml-12 space-y-2 animate-fade-in pr-4">
                                                    {day.tasks.map(task => (
                                                        <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.01] border border-white/[0.02]">
                                                            <div className={`w-2 h-2 rounded-full ${validCompletedIds.includes(task.id) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-800'}`} />
                                                            <span className={`text-xs font-medium ${validCompletedIds.includes(task.id) ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{task.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Sidebar Stats: Achievements & Motivation */}
                            <div className="space-y-8">
                                <div className="glass-card p-6">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[2px] mb-6 flex items-center gap-2">
                                        <Award className="w-4 h-4 text-meta-orange" /> Достижения
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {achievements.map(ach => (
                                            <div key={ach.id} className={`p-4 rounded-3xl border flex flex-col items-center text-center gap-3 transition-all
                                                ${ach.unlocked ? 'bg-white/[0.03] border-white/10' : 'bg-transparent border-white/5 opacity-20 grayscale'}`}>
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ach.color}`}>
                                                    <ach.icon className="w-5 h-5" />
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-tighter leading-tight text-white">{ach.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-meta-orange to-orange-600 shadow-2xl shadow-meta-orange/20 relative overflow-hidden group">
                                    <Zap className="absolute -right-6 -bottom-6 w-32 h-32 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                                    <h4 className="text-xl font-black text-white italic mb-2">ВПЕРЕД К ЦЕЛИ</h4>
                                    <p className="text-xs text-white/80 font-medium leading-relaxed mb-6">Каждое выполненное действие сегодня — это твой результат завтра.</p>
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className="w-full py-3 bg-white text-meta-orange font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-deep-dark hover:text-white transition-all shadow-xl"
                                    >
                                        Продолжить курс
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-8">
                        {/* Health Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="glass-card p-8 group">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                                        <Moon className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Средний сон</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-white italic">{avgSleep}</span>
                                    <span className="text-sm font-bold text-gray-700 uppercase">часов</span>
                                </div>
                                <div className="mt-6 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(parseFloat(avgSleep) / 10) * 100}%` }} />
                                </div>
                            </div>

                            <div className="glass-card p-8 group">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                        <Heart className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Твое настроение</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-white italic">{avgMood}</span>
                                    <span className="text-sm font-bold text-gray-700 uppercase">из 5</span>
                                </div>
                                <div className="mt-6 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${(parseFloat(avgMood) / 5) * 100}%` }} />
                                </div>
                            </div>

                            <div className="glass-card p-8 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Droplets className="w-24 h-24 text-cyan-400" />
                                </div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                                        <Droplets className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Всего воды</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-white italic">
                                        {safeJournalEntries.reduce((acc, curr) => acc + (curr?.water_liters || 0), 0).toFixed(1)}
                                    </span>
                                    <span className="text-sm font-bold text-gray-700 uppercase">литров</span>
                                </div>
                                <p className="text-[10px] font-bold text-cyan-400/60 uppercase tracking-widest mt-4">за весь период лога</p>
                            </div>
                        </div>

                        {/* Line Chart Section */}
                        <div className="glass-card p-8 md:p-12">
                            <div className="flex flex-col md:flex-row justify-between gap-6 mb-12">
                                <div>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[2px] flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-meta-orange" /> Динамика настроения и энергии
                                    </h3>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 rounded-full bg-gradient-to-r from-[#FF4500] to-[#FFA500]" />
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Настроение</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 rounded-full bg-[#FF4500]/30" />
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Энергия</span>
                                    </div>
                                </div>
                            </div>

                            {last7DaysJournal.length > 1 ? (
                                <div className="relative h-64 w-full group">
                                    {/* SVG Lines */}
                                    <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d overflow-visible" preserveAspectRatio="none">
                                        {/* Grid Lines */}
                                        {[0, 10, 20, 30, 40].map(y => (
                                            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.1" />
                                        ))}

                                        {/* Energy Path - Lower opacity background line */}
                                        <path
                                            d={energyPath}
                                            fill="none"
                                            stroke="rgba(255,69,0,0.15)"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="transition-all duration-1000"
                                        />

                                        {/* Mood Path - Main bold line */}
                                        <path
                                            d={moodPath}
                                            fill="none"
                                            stroke="url(#chartGrad)"
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="drop-shadow-[0_4px_8px_rgba(255,69,0,0.4)] transition-all duration-1000"
                                        />

                                        <defs>
                                            <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#FF4500" />
                                                <stop offset="100%" stopColor="#FFA500" />
                                            </linearGradient>
                                        </defs>

                                        {/* Data Dots for Interactions */}
                                        {last7DaysJournal.map((entry, i) => {
                                            const step = 100 / (last7DaysJournal.length - 1)
                                            return (
                                                <g key={i}>
                                                    <circle
                                                        cx={i * step}
                                                        cy={40 - ((entry?.mood || 0) / 5) * 40}
                                                        r="0.8"
                                                        fill="#FF4500"
                                                        className="hover:r-1.5 transition-all cursor-pointer shadow-lg"
                                                    />
                                                </g>
                                            )
                                        })}
                                    </svg>

                                    {/* X-Axis Dates */}
                                    <div className="flex justify-between mt-8 px-1">
                                        {last7DaysJournal.map((entry, i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">
                                                    {entry?.date ? new Date(entry.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-48 border border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center text-center p-8">
                                    <Info className="w-8 h-8 text-gray-800 mb-4" />
                                    <p className="text-sm font-black text-gray-700 uppercase tracking-[2px]">Недостаточно данных для графика</p>
                                    <p className="text-[10px] text-gray-800 mt-2">Заполни дневник минимум 2 дня подряд</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Insights Panel */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="glass-card p-10">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[2px] mb-8 flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-meta-orange" /> Анализ сна
                                </h3>
                                <div className="space-y-6">
                                    {last7DaysJournal.map((entry, i) => (
                                        <div key={i} className="flex items-center gap-6 group">
                                            <div className="w-12 text-[10px] font-black text-gray-600 uppercase tracking-widest truncate">{entry?.date ? new Date(entry.date).toLocaleDateString('ru-RU', { weekday: 'short' }) : ''}</div>
                                            <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${(entry?.sleep_hours || 0) >= 7 ? 'bg-blue-500' : 'bg-orange-500/50'}`}
                                                    style={{ width: `${((entry?.sleep_hours || 0) / 10) * 100}%` }}
                                                />
                                            </div>
                                            <div className="w-10 text-xs font-black text-white italic">{entry?.sleep_hours || 0}ч</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-deep-dark-200/50 to-deep-dark-300/50 border border-white/10 rounded-[3rem] p-10 relative overflow-hidden flex flex-col justify-center">
                                <Activity className="absolute -top-10 -right-10 w-48 h-48 text-emerald-500/5 -rotate-12" />
                                <h4 className="text-2xl font-black text-white italic mb-4 uppercase tracking-tighter">Связь факторов</h4>
                                <p className="text-sm text-gray-400 leading-relaxed font-medium mb-8">
                                    За последние 7 дней твое среднее настроение составило <span className="text-emerald-400">{avgMood}</span>.
                                    Обычно оно достигает пика, когда сон составляет более <span className="text-blue-400">7.5 часов</span>.
                                </p>
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
                                    <Info className="w-6 h-6 text-meta-orange shrink-0" />
                                    <p className="text-xs font-bold text-gray-500 italic uppercase leading-relaxed">
                                        «Продолжай вести лог, чтобы система могла давать более точные рекомендации по тренировкам и питанию.»
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
