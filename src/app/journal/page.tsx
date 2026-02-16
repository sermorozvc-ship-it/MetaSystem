'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    BookOpen, ArrowLeft, Plus, Trash2, Save,
    Calendar, Heart, Frown, Meh, Smile, SmilePlus,
    Droplets, Moon, Dumbbell, Apple, X, Edit2, AlertCircle, RefreshCw
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { getJournalEntries, saveJournalEntry, deleteJournalEntry, JournalEntry } from '@/lib/services/journal'

const moodIcons = [
    { value: 1, icon: Frown, label: 'Ужасно', color: 'text-red-400', bg: 'bg-red-500/10' },
    { value: 2, icon: Frown, label: 'Плохо', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { value: 3, icon: Meh, label: 'Нормально', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { value: 4, icon: Smile, label: 'Хорошо', color: 'text-green-400', bg: 'bg-green-500/10' },
    { value: 5, icon: SmilePlus, label: 'Отлично', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

export default function JournalPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    // State
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)

    const today = new Date().toISOString().split('T')[0]

    const initialFormState: JournalEntry = {
        date: today,
        mood: 3,
        energy: 3,
        sleep_hours: 0, // По умолчанию 0, но в инпуте будет пусто
        water_liters: 0,
        workout_done: false,
        nutrition_notes: '',
        reflection: ''
    }

    const [form, setForm] = useState<JournalEntry>(initialFormState)

    const loadEntries = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            if (authLoading) return; // Wait for auth

            if (!user) {
                // Demo mode fallback
                try {
                    const stored = localStorage.getItem('demo_journal')
                    const demoEntries = stored ? JSON.parse(stored) : []
                    setEntries(Array.isArray(demoEntries) ? demoEntries : [])
                } catch (e) {
                    console.error('Demo journal parse error:', e)
                    setEntries([])
                }
                setIsLoading(false)
                return
            }

            const data = await getJournalEntries()
            setEntries(data)
        } catch (e: any) {
            console.error('Journal fetch error:', e)
            setError('Сессия истекла или возникла ошибка сети. Попробуйте обновить страницу.')
        } finally {
            setIsLoading(false)
        }
    }, [user, authLoading])

    useEffect(() => {
        loadEntries()
    }, [loadEntries, retryCount])

    const handleEdit = (entry: JournalEntry) => {
        setForm({ ...entry })
        setShowForm(true)
    }

    const handleCreateNew = () => {
        setForm(initialFormState)
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!form.date) return

        setSaving(true)
        setError(null)
        try {
            if (!user) {
                // Demo mode save
                const stored = localStorage.getItem('demo_journal')
                const demoEntries = stored ? JSON.parse(stored) : []
                const newEntry = { ...form, id: Date.now(), created_at: new Date().toISOString() }
                const updated = [newEntry, ...demoEntries.filter((e: JournalEntry) => e.date !== form.date)]
                localStorage.setItem('demo_journal', JSON.stringify(updated))
                setEntries(updated)
                setShowForm(false)
                return
            }

            const result = await saveJournalEntry(form)
            if (result.success) {
                await loadEntries()
                setShowForm(false)
            } else {
                setError(result.error || 'Ошибка при сохранении. Проверьте интернет-соединение.')
            }
        } catch (e: any) {
            console.error('Save failed:', e)
            setError('Произошла ошибка при сохранении')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (date: string) => {
        if (!confirm('Вы действительно хотите удалить эту запись?')) return

        try {
            if (!user) {
                const stored = localStorage.getItem('demo_journal')
                const demoEntries = stored ? JSON.parse(stored) : []
                const updated = demoEntries.filter((e: JournalEntry) => e.date !== date)
                localStorage.setItem('demo_journal', JSON.stringify(updated))
                setEntries(updated)
                return
            }

            const result = await deleteJournalEntry(date)
            if (result.success) {
                await loadEntries()
                if (selectedEntry?.date === date) setSelectedEntry(null)
            }
        } catch (e) {
            console.error('Delete failed:', e)
        }
    }

    // Helper for number inputs to remove leading zeros/placeholder issue
    const handleNumberFieldChange = (field: 'sleep_hours' | 'water_liters', val: string) => {
        // Allow empty string for clearing
        if (val === '') {
            setForm(prev => ({ ...prev, [field]: 0 }))
            return
        }

        // Convert comma to dot for localized inputs
        const normalized = val.replace(',', '.')
        const parsed = parseFloat(normalized)

        if (!isNaN(parsed)) {
            setForm(prev => ({ ...prev, [field]: parsed }))
        }
    }

    const getMoodInfo = (mood: number) => moodIcons.find(m => m.value === mood) || moodIcons[2]

    if (authLoading || (isLoading && entries.length === 0)) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-meta-orange/20 rounded-full" />
                        <div className="absolute inset-0 w-12 h-12 border-4 border-meta-orange border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-gray-500 font-bold text-sm uppercase tracking-widest animate-pulse">Загрузка...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="journal" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full transition-all duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-12">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10
                                       flex items-center justify-center text-gray-400 hover:text-white 
                                       hover:bg-deep-dark-300 transition-all duration-300 group shadow-lg"
                        >
                            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-meta-orange" />
                                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">Дневник</h1>
                            </div>
                            <p className="text-sm text-gray-500 font-medium mt-1">Твое состояние — ключ к успеху</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setRetryCount(c => c + 1)}
                            className="p-3 rounded-2xl bg-white/5 border border-white/5 text-gray-500 hover:text-white transition-all"
                            title="Обновить данные"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-meta-orange' : ''}`} />
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-meta-orange text-white font-black uppercase tracking-wider
                                     flex items-center justify-center gap-2 hover:bg-meta-orange-hover 
                                     transition-all duration-300 shadow-xl shadow-meta-orange/25 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Запись
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-8 p-5 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-start gap-4 text-red-400">
                        <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold text-sm mb-1 uppercase tracking-wider">Ошибка доступа</p>
                            <p className="text-sm opacity-80 leading-relaxed font-medium">{error}</p>
                            <button
                                onClick={() => setRetryCount(c => c + 1)}
                                className="mt-3 text-xs font-bold underline hover:no-underline"
                            >
                                Попробовать снова
                            </button>
                        </div>
                    </div>
                )}

                {/* Form Modal */}
                {showForm && (
                    <div className="modal-overlay z-[100] backdrop-blur-xl" onClick={() => setShowForm(false)}>
                        <div
                            className="bg-deep-dark-100/95 border border-white/10 p-6 md:p-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-fade-in mx-4 rounded-[2.5rem] shadow-2xl relative custom-scrollbar"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-10 sticky top-0 bg-deep-dark-100/10 backdrop-blur-md py-2 z-10">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-black text-white italic">
                                        {form.id ? 'ИЗМЕНИТЬ' : 'НОВАЯ ЗАПИСЬ'}
                                    </h2>
                                    <p className="text-xs text-meta-orange font-bold uppercase tracking-[3px] mt-1">метаболический лог</p>
                                </div>
                                <button onClick={() => setShowForm(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all hover:rotate-90">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-8">
                                {/* Date Selection */}
                                <div className="p-4 rounded-3xl bg-white/5 border border-white/5 focus-within:border-meta-orange/50 transition-colors">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] mb-3 block">Дата записи</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-meta-orange" />
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="w-full bg-transparent pl-8 pr-4 py-2 text-xl font-bold text-white focus:outline-none appearance-none"
                                        />
                                    </div>
                                </div>

                                {/* Mood Icons with scroll on mobile */}
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] mb-4 block text-center">Ваше настроение</label>
                                    <div className="flex justify-between md:grid md:grid-cols-5 gap-0 md:gap-3 overflow-x-auto pb-4 md:pb-0 px-2 no-scrollbar">
                                        {moodIcons.map(m => {
                                            const Icon = m.icon
                                            const isActive = form.mood === m.value
                                            return (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setForm({ ...form, mood: m.value })}
                                                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-[2rem] transition-all min-w-[75px] md:min-w-0
                                                        ${isActive
                                                            ? `${m.bg} ${m.color} scale-105 shadow-xl shadow-current/5 ring-1 ring-current/20`
                                                            : 'text-gray-600 hover:text-gray-400'
                                                        }`}
                                                >
                                                    <Icon className={`w-8 h-8 md:w-10 md:h-10 transition-transform ${isActive ? 'scale-110' : ''}`} />
                                                    <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                                        {m.label}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Energy Range Slider */}
                                <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                    <div className="flex justify-between items-end mb-6">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px]">Уровень энергии</label>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-meta-orange leading-none">{form.energy}</span>
                                            <span className="text-sm font-bold text-gray-700">/5</span>
                                        </div>
                                    </div>
                                    <div className="relative group px-1">
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            value={form.energy}
                                            onChange={e => setForm({ ...form, energy: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-meta-orange"
                                        />
                                        <div className="flex justify-between text-[9px] font-black text-gray-600 mt-4 uppercase tracking-[1px]">
                                            <span className={form.energy === 1 ? 'text-red-400' : ''}>сил нет</span>
                                            <span className={form.energy === 5 ? 'text-emerald-400' : ''}>максимум</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Numeric Inputs for Sleep and Water */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 focus-within:border-blue-500/30 transition-all">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                <Moon className="w-3.5 h-3.5 text-blue-400" />
                                            </div>
                                            Сон (часов)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="8"
                                            value={form.sleep_hours || ''}
                                            onChange={e => handleNumberFieldChange('sleep_hours', e.target.value)}
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-gray-800"
                                        />
                                    </div>
                                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 focus-within:border-cyan-500/30 transition-all">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                                            </div>
                                            Вода (л)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="1.5"
                                            value={form.water_liters || ''}
                                            onChange={e => handleNumberFieldChange('water_liters', e.target.value)}
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-gray-800"
                                        />
                                    </div>
                                </div>

                                {/* Workout Toggle - Full Width Card */}
                                <button
                                    onClick={() => setForm({ ...form, workout_done: !form.workout_done })}
                                    className={`w-full group relative overflow-hidden flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all duration-500
                                        ${form.workout_done
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-2xl shadow-emerald-500/10'
                                            : 'bg-white/5 border-transparent text-gray-600 opacity-60 grayscale hover:grayscale-0 hover:border-white/10'
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${form.workout_done ? 'bg-emerald-500/20 rotate-12' : 'bg-white/5'}`}>
                                        <Dumbbell className={`w-7 h-7 ${form.workout_done ? 'animate-bounce' : ''}`} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-black uppercase tracking-[2px]">ТРЕНИРОВКА</p>
                                        <p className="text-xs font-bold opacity-70 mt-1 uppercase tracking-wider">{form.workout_done ? 'ВЫПОЛНЕНА СЕГОДНЯ ✓' : 'ЕЩЕ НЕ ВЫПОЛНЕНА'}</p>
                                    </div>
                                    <div className={`ml-auto w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${form.workout_done ? 'bg-emerald-500 border-emerald-500 scale-110 shadow-lg shadow-emerald-500/40 text-white' : 'border-white/10'}`}>
                                        {form.workout_done ? <Plus className="w-6 h-6 rotate-45" /> : <Plus className="w-5 h-5 opacity-20" />}
                                    </div>
                                </button>

                                {/* Nutrition Notes Expandable Area */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] flex items-center gap-2 ml-2">
                                        <Apple className="w-3.5 h-3.5 text-meta-orange" /> Питание
                                    </label>
                                    <textarea
                                        value={form.nutrition_notes}
                                        onChange={e => setForm({ ...form, nutrition_notes: e.target.value })}
                                        placeholder="Что ели сегодня? Были ли отклонения от плана?"
                                        rows={2}
                                        className="w-full bg-white/5 border-2 border-transparent focus:border-meta-orange/20 rounded-[2rem] p-6
                                                 text-white placeholder:text-gray-700 focus:outline-none transition-all resize-none font-medium leading-relaxed"
                                    />
                                </div>

                                {/* Reflection Card */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] flex items-center gap-2 ml-2">
                                        <Heart className="w-3.5 h-3.5 text-red-400" /> Рефлексия
                                    </label>
                                    <textarea
                                        value={form.reflection}
                                        onChange={e => setForm({ ...form, reflection: e.target.value })}
                                        placeholder="Какие чувства сегодня? Что было самым удачным?"
                                        rows={4}
                                        className="w-full bg-white/5 border-2 border-transparent focus:border-red-400/20 rounded-[2.5rem] p-6 md:p-8
                                                 text-white placeholder:text-gray-700 focus:outline-none transition-all resize-none font-medium leading-relaxed italic"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full py-6 rounded-3xl bg-meta-orange text-white font-black uppercase tracking-[4px]
                                             flex items-center justify-center gap-4 hover:bg-meta-orange-hover 
                                             disabled:opacity-50 disabled:grayscale transition-all duration-500 
                                             shadow-2xl shadow-meta-orange/30 active:scale-95 text-lg"
                                >
                                    {saving ? (
                                        <RefreshCw className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-6 h-6" />
                                            {form.id ? 'ОБНОВИТЬ' : 'СОХРАНИТЬ'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Items List - Grid Layout */}
                {entries.length === 0 && !isLoading ? (
                    <div className="glass-card p-12 md:p-24 text-center flex flex-col items-center bg-white/[0.02] border-white/5 rounded-[4rem] group hover:bg-white/[0.04] transition-all">
                        <div className="w-32 h-32 rounded-[3rem] bg-white/5 flex items-center justify-center mb-10 transition-transform group-hover:scale-110 shadow-inner">
                            <BookOpen className="w-16 h-16 text-gray-800" />
                        </div>
                        <h3 className="text-3xl font-black text-white italic mb-4">ЖУРНАЛ ПУСТ</h3>
                        <p className="text-gray-500 mb-12 max-w-sm mx-auto text-lg leading-relaxed font-medium">
                            Твой запуск начинается с ежедневного осознания своего состояния. Сделай первый отчет прямо сейчас.
                        </p>
                        <button
                            onClick={handleCreateNew}
                            className="px-12 py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white font-black uppercase tracking-[2px]
                                     flex items-center gap-4 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                        >
                            <Plus className="w-6 h-6 text-meta-orange" />
                            НАЧАТЬ ЖУРНАЛ
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in no-scrollbar">
                        {entries.map((entry) => {
                            const moodInfo = getMoodInfo(entry.mood)
                            const MoodIcon = moodInfo.icon

                            return (
                                <div
                                    key={entry.date}
                                    className={`relative group bg-deep-dark-100/40 hover:bg-deep-dark-200/60 border border-white/5 
                                              hover:border-meta-orange/20 rounded-[2.5rem] p-7 transition-all duration-500
                                              ${selectedEntry?.date === entry.date ? 'ring-2 ring-meta-orange/50 shadow-2xl shadow-meta-orange/10' : ''}`}
                                >
                                    {/* Edit/Delete Tools */}
                                    <div className="absolute top-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                                            className="w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-meta-orange/20 transition-all border border-white/5"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.date); }}
                                            className="w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-all border border-white/5"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Card Header */}
                                    <div className="flex items-start gap-5 mb-8">
                                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${moodInfo.bg} ${moodInfo.color} shadow-xl shadow-current/5 transition-all group-hover:scale-110 group-hover:-rotate-3`}>
                                            <MoodIcon className="w-9 h-9" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[2px] mb-1">
                                                {new Date(entry.date).toLocaleDateString('ru-RU', { weekday: 'long' })}
                                            </p>
                                            <h4 className="text-xl font-black text-white italic tracking-tight">
                                                {new Date(entry.date).toLocaleDateString('ru-RU', {
                                                    day: 'numeric',
                                                    month: 'long'
                                                })}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Card Content Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-3xl flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <Moon className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-500 uppercase">Сон</p>
                                                <p className="text-lg font-black text-white leading-none mt-0.5">{entry.sleep_hours}<span className="text-[10px] ml-0.5 text-gray-600">Ч</span></p>
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-3xl flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                                                <Droplets className="w-4 h-4 text-cyan-400" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Вода</p>
                                                <p className="text-lg font-black text-white leading-none mt-0.5">{entry.water_liters}<span className="text-[10px] ml-0.5 text-gray-600">Л</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Status Check */}
                                    {entry.workout_done ? (
                                        <div className="mb-6 py-3 px-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Dumbbell className="w-4 h-4 text-emerald-400" />
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Тренировка выполнена</span>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        </div>
                                    ) : (
                                        <div className="mb-6 py-3 px-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                                            <Dumbbell className="w-4 h-4 text-gray-700" />
                                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Без тренировки</span>
                                        </div>
                                    )}

                                    {/* Reflection Preview */}
                                    {entry.reflection ? (
                                        <div className="relative pt-2">
                                            <span className="absolute -top-1 left-2 text-4xl text-meta-orange opacity-20 font-serif leading-none">“</span>
                                            <p className="text-sm text-gray-400 italic font-medium leading-relaxed line-clamp-2 pl-4">
                                                {entry.reflection}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="py-4 border border-dashed border-white/5 rounded-3xl text-center">
                                            <p className="text-[9px] font-black text-gray-700 uppercase tracking-[3px]">ЛОГ ЗАВЕРШЕН</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 24px;
                    height: 24px;
                    background: #FF4500;
                    border: 4px solid #1E1E1E;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(255, 69, 0, 0.4);
                    transition: all 0.2s;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 0 15px rgba(255, 69, 0, 0.6);
                }
            `}</style>
        </div>
    )
}
