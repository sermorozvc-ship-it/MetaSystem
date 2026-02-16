'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    BookOpen, ArrowLeft, Plus, Trash2, Save,
    Calendar, Heart, Frown, Meh, Smile, SmilePlus,
    Droplets, Moon, Dumbbell, Apple, X, Edit2, AlertCircle
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

    const today = new Date().toISOString().split('T')[0]

    const initialFormState: JournalEntry = {
        date: today,
        mood: 3,
        energy: 3,
        sleep_hours: 7,
        water_liters: 1.5,
        workout_done: false,
        nutrition_notes: '',
        reflection: ''
    }

    const [form, setForm] = useState<JournalEntry>(initialFormState)

    const loadEntries = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
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
                return
            }

            const data = await getJournalEntries()
            setEntries(data)
        } catch (e: any) {
            console.error('Journal fetch error:', e)
            setError('Не удалось загрузить записи дневника')
        } finally {
            setIsLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (!authLoading) {
            loadEntries()
        }
    }, [user, authLoading, loadEntries])

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
                setError(result.error || 'Ошибка при сохранении')
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

    const getMoodInfo = (mood: number) => moodIcons.find(m => m.value === mood) || moodIcons[2]

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin w-10 h-10 border-3 border-meta-orange border-t-transparent rounded-full" />
                    <p className="text-gray-500 font-medium animate-pulse">Загрузка дневника...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="journal" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                                       flex items-center justify-center text-gray-400 hover:text-white 
                                       hover:bg-deep-dark-300 transition-all duration-200 group"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3">
                                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-meta-orange" />
                                Дневник
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">Отслеживайте свое состояние и прогресс</p>
                        </div>
                    </div>

                    <button
                        onClick={handleCreateNew}
                        className="w-full md:w-auto px-6 py-3 rounded-2xl bg-meta-orange text-white font-bold 
                                 flex items-center justify-center gap-2 hover:bg-meta-orange-hover 
                                 transition-all duration-300 shadow-lg shadow-meta-orange/20 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Добавить запись
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Form Modal */}
                {showForm && (
                    <div className="modal-overlay" onClick={() => setShowForm(false)}>
                        <div
                            className="glass-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-in mx-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-white">
                                    {form.id ? 'Редактировать запись' : 'Новая запись'}
                                </h2>
                                <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Date */}
                                <div>
                                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 block">Дата записи</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-meta-orange/50" />
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="w-full bg-deep-dark-200/60 border border-white/10 rounded-2xl pl-12 pr-4 py-4
                                                     text-white focus:outline-none focus:border-meta-orange/50 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Mood */}
                                <div>
                                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 block">Настроение</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {moodIcons.map(m => {
                                            const Icon = m.icon
                                            const isActive = form.mood === m.value
                                            return (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setForm({ ...form, mood: m.value })}
                                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all
                                                        ${isActive
                                                            ? `${m.bg} ${m.color} border-2 border-current scale-105 shadow-lg`
                                                            : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                                                        }`}
                                                >
                                                    <Icon className="w-6 h-6 md:w-8 md:h-8" />
                                                    <span className="text-[10px] font-bold uppercase tracking-tight">{m.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Energy */}
                                <div>
                                    <div className="flex justify-between items-end mb-4">
                                        <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Уровень энергии</label>
                                        <span className="text-2xl font-black text-meta-orange">{form.energy}<span className="text-xs text-gray-600">/5</span></span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        value={form.energy}
                                        onChange={e => setForm({ ...form, energy: parseInt(e.target.value) })}
                                        className="w-full accent-meta-orange h-2 bg-white/5 rounded-full appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] font-bold text-gray-600 mt-2 uppercase tracking-widest">
                                        <span>Сил нет</span>
                                        <span>Максимум</span>
                                    </div>
                                </div>

                                {/* Sleep & Water */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Moon className="w-4 h-4 text-blue-400" /> Сон (часов)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="24"
                                            step="0.5"
                                            value={form.sleep_hours}
                                            onChange={e => setForm({ ...form, sleep_hours: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none"
                                        />
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Droplets className="w-4 h-4 text-cyan-400" /> Вода (литров)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.25"
                                            value={form.water_liters}
                                            onChange={e => setForm({ ...form, water_liters: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Workout toggle */}
                                <button
                                    onClick={() => setForm({ ...form, workout_done: !form.workout_done })}
                                    className={`w-full flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300
                                        ${form.workout_done
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-lg shadow-green-500/5'
                                            : 'bg-white/5 border-white/5 text-gray-500 grayscale'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.workout_done ? 'bg-green-500/20' : 'bg-white/5'}`}>
                                        <Dumbbell className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold uppercase tracking-widest">Тренировка</p>
                                        <p className="text-xs opacity-70">{form.workout_done ? 'Выполнена сегодня' : 'Не отмечена'}</p>
                                    </div>
                                    <div className={`ml-auto w-6 h-6 rounded-full border-2 flex items-center justify-center ${form.workout_done ? 'bg-green-500 border-green-500' : 'border-white/10'}`}>
                                        {form.workout_done && <Plus className="w-4 h-4 text-white rotate-45" />}
                                    </div>
                                </button>

                                {/* Nutrition Notes */}
                                <div>
                                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Apple className="w-4 h-4 text-meta-orange" /> Заметки о питании
                                    </label>
                                    <textarea
                                        value={form.nutrition_notes}
                                        onChange={e => setForm({ ...form, nutrition_notes: e.target.value })}
                                        placeholder="Что ели сегодня? Были ли срывы?"
                                        rows={2}
                                        className="w-full bg-deep-dark-200/60 border border-white/10 rounded-2xl p-4 md:p-5
                                                 text-white placeholder:text-gray-600 focus:outline-none focus:border-meta-orange/50 transition-all resize-none"
                                    />
                                </div>

                                {/* Reflection */}
                                <div>
                                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Heart className="w-4 h-4 text-red-400" /> Итоги дня (рефлексия)
                                    </label>
                                    <textarea
                                        value={form.reflection}
                                        onChange={e => setForm({ ...form, reflection: e.target.value })}
                                        placeholder="Как вы себя чувствуете? Что было самым важным сегодня?"
                                        rows={4}
                                        className="w-full bg-deep-dark-200/60 border border-white/10 rounded-2xl p-4 md:p-5
                                                 text-white placeholder:text-gray-600 focus:outline-none focus:border-meta-orange/50 transition-all resize-none"
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full py-5 rounded-2xl bg-meta-orange text-white font-black uppercase tracking-[0.2em]
                                             flex items-center justify-center gap-3 hover:bg-meta-orange-hover 
                                             disabled:opacity-50 disabled:grayscale transition-all duration-300 
                                             shadow-xl shadow-meta-orange/20 active:scale-95"
                                >
                                    {saving ? (
                                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            {form.id ? 'Обновить запись' : 'Сохранить запись'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Entries List */}
                {entries.length === 0 ? (
                    <div className="glass-card p-12 md:p-20 text-center flex flex-col items-center">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 flex items-center justify-center mb-8">
                            <BookOpen className="w-12 h-12 text-gray-700" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">Ваш дневник пуст</h3>
                        <p className="text-gray-400 mb-10 max-w-xs mx-auto text-lg leading-relaxed">
                            Начните записывать свои результаты и самочувствие каждый день для лучшего анализа прогресса.
                        </p>
                        <button
                            onClick={handleCreateNew}
                            className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold 
                                     flex items-center gap-3 hover:bg-white/10 transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5 text-meta-orange" />
                            Создать первую запись
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {entries.map((entry, idx) => {
                            const moodInfo = getMoodInfo(entry.mood)
                            const MoodIcon = moodInfo.icon

                            return (
                                <div
                                    key={entry.date}
                                    className={`relative group bg-deep-dark-100 hover:bg-deep-dark-200 border border-white/5 
                                              hover:border-white/10 rounded-[2rem] p-6 transition-all duration-300
                                              ${selectedEntry?.date === entry.date ? 'ring-2 ring-meta-orange/30' : ''}`}
                                >
                                    {/* Action Buttons */}
                                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-meta-orange/20 transition-all"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.date); }}
                                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Date & Mood */}
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${moodInfo.bg} ${moodInfo.color} shadow-lg shadow-current/5 transition-transform group-hover:scale-110`}>
                                            <MoodIcon className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                                {new Date(entry.date).toLocaleDateString('ru-RU', { weekday: 'long' })}
                                            </p>
                                            <h4 className="text-lg font-bold text-white">
                                                {new Date(entry.date).toLocaleDateString('ru-RU', {
                                                    day: 'numeric',
                                                    month: 'long'
                                                })}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <div className="bg-white/5 p-3 rounded-2xl text-center">
                                            <Moon className="w-4 h-4 text-blue-400 mx-auto mb-1.5" />
                                            <p className="text-sm font-bold text-white">{entry.sleep_hours}<span className="text-[10px] text-gray-500 ml-0.5">ч</span></p>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded-2xl text-center">
                                            <Droplets className="w-4 h-4 text-cyan-400 mx-auto mb-1.5" />
                                            <p className="text-sm font-bold text-white">{entry.water_liters}<span className="text-[10px] text-gray-500 ml-0.5">л</span></p>
                                        </div>
                                        <div className={`p-3 rounded-2xl text-center border ${entry.workout_done ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-transparent text-gray-600'}`}>
                                            <Dumbbell className="w-4 h-4 mx-auto mb-1.5" />
                                            <p className="text-[10px] font-bold uppercase">{entry.workout_done ? 'Да' : 'Нет'}</p>
                                        </div>
                                    </div>

                                    {/* Reflection */}
                                    {entry.reflection ? (
                                        <div className="bg-white/5 rounded-2xl p-4">
                                            <p className="text-sm text-gray-300 leading-relaxed line-clamp-3 italic">
                                                «{entry.reflection}»
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="border border-dashed border-white/5 rounded-2xl p-4 text-center">
                                            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Нет рефлексии</p>
                                        </div>
                                    )}

                                    {entry.nutrition_notes && (
                                        <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                                            <Apple className="w-3.5 h-3.5 text-meta-orange" />
                                            <span className="truncate">{entry.nutrition_notes}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
