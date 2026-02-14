'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    BookOpen, ArrowLeft, Plus, Trash2, Save,
    Calendar, Heart, Frown, Meh, Smile, SmilePlus,
    Droplets, Moon, Dumbbell, Apple, X
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'

interface JournalEntry {
    id?: number
    user_id?: string
    date: string
    mood: number // 1-5
    energy: number // 1-5
    sleep_hours: number
    water_liters: number
    workout_done: boolean
    nutrition_notes: string
    reflection: string
    created_at?: string
}

const moodIcons = [
    { value: 1, icon: Frown, label: 'Ужасно', color: 'text-red-400' },
    { value: 2, icon: Frown, label: 'Плохо', color: 'text-orange-400' },
    { value: 3, icon: Meh, label: 'Нормально', color: 'text-yellow-400' },
    { value: 4, icon: Smile, label: 'Хорошо', color: 'text-green-400' },
    { value: 5, icon: SmilePlus, label: 'Отлично', color: 'text-emerald-400' },
]

export default function JournalPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

    const today = new Date().toISOString().split('T')[0]

    const [form, setForm] = useState<JournalEntry>({
        date: today,
        mood: 3,
        energy: 3,
        sleep_hours: 7,
        water_liters: 1.5,
        workout_done: false,
        nutrition_notes: '',
        reflection: ''
    })

    useEffect(() => {
        loadEntries()
    }, [user])

    const loadEntries = async () => {
        try {
            const supabase = createClient()
            const { data: { user: currentUser } } = await supabase.auth.getUser()

            if (!currentUser) {
                // Demo mode
                const demoEntries = JSON.parse(localStorage.getItem('demo_journal') || '[]')
                setEntries(demoEntries)
                setIsLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('date', { ascending: false })

            if (error) {
                console.error('Error loading journal:', error)
                // Таблица может не существовать — используем localStorage
                const fallback = JSON.parse(localStorage.getItem('demo_journal') || '[]')
                setEntries(fallback)
            } else {
                setEntries(data || [])
            }
        } catch (e) {
            console.error('Journal fetch error:', e)
            const fallback = JSON.parse(localStorage.getItem('demo_journal') || '[]')
            setEntries(fallback)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const supabase = createClient()
            const { data: { user: currentUser } } = await supabase.auth.getUser()

            if (!currentUser) {
                // Demo mode
                const demoEntries = JSON.parse(localStorage.getItem('demo_journal') || '[]')
                const newEntry = { ...form, id: Date.now(), created_at: new Date().toISOString() }
                const updated = [newEntry, ...demoEntries.filter((e: JournalEntry) => e.date !== form.date)]
                localStorage.setItem('demo_journal', JSON.stringify(updated))
                setEntries(updated)
            } else {
                const { error } = await supabase
                    .from('journal_entries')
                    .upsert({
                        user_id: currentUser.id,
                        ...form
                    }, { onConflict: 'user_id,date' })

                if (error) {
                    console.error('Save error:', error)
                    // Fallback to localStorage
                    const demoEntries = JSON.parse(localStorage.getItem('demo_journal') || '[]')
                    const newEntry = { ...form, id: Date.now(), created_at: new Date().toISOString() }
                    const updated = [newEntry, ...demoEntries.filter((e: JournalEntry) => e.date !== form.date)]
                    localStorage.setItem('demo_journal', JSON.stringify(updated))
                    setEntries(updated)
                } else {
                    await loadEntries()
                }
            }

            setShowForm(false)
            setForm({
                date: today,
                mood: 3,
                energy: 3,
                sleep_hours: 7,
                water_liters: 1.5,
                workout_done: false,
                nutrition_notes: '',
                reflection: ''
            })
        } catch (e) {
            console.error('Save failed:', e)
        } finally {
            setSaving(false)
        }
    }

    const getMoodInfo = (mood: number) => moodIcons.find(m => m.value === mood) || moodIcons[2]

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-meta-orange border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="journal" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                                       flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
                                <BookOpen className="w-5 h-5 md:w-7 md:h-7 text-meta-orange" />
                                Дневник
                            </h1>
                            <p className="text-xs md:text-sm text-gray-400 mt-1">Ваши ежедневные записи</p>
                        </div>
                    </div>

                    <button
                        onClick={() => { setShowForm(true); setSelectedEntry(null) }}
                        className="glass-button flex items-center gap-2 text-sm px-4 py-2.5"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Новая запись</span>
                    </button>
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="modal-overlay" onClick={() => setShowForm(false)}>
                        <div
                            className="glass-card p-5 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-in mx-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Запись на {form.date}</h2>
                                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Date */}
                            <div className="mb-5">
                                <label className="text-sm text-gray-400 mb-2 block">Дата</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="glass-input w-full"
                                />
                            </div>

                            {/* Mood */}
                            <div className="mb-5">
                                <label className="text-sm text-gray-400 mb-3 block">Настроение</label>
                                <div className="flex items-center gap-2 justify-between">
                                    {moodIcons.map(m => {
                                        const Icon = m.icon
                                        return (
                                            <button
                                                key={m.value}
                                                onClick={() => setForm({ ...form, mood: m.value })}
                                                className={`flex flex-col items-center gap-1 p-2 md:p-3 rounded-xl transition-all flex-1
                                                    ${form.mood === m.value
                                                        ? `${m.color} bg-white/10 border border-white/20 scale-105`
                                                        : 'text-gray-500 hover:text-gray-300'
                                                    }`}
                                            >
                                                <Icon className="w-6 h-6 md:w-7 md:h-7" />
                                                <span className="text-[10px] md:text-xs">{m.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Energy */}
                            <div className="mb-5">
                                <label className="text-sm text-gray-400 mb-2 block">Энергия: {form.energy} из 5</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={form.energy}
                                    onChange={e => setForm({ ...form, energy: parseInt(e.target.value) })}
                                    className="w-full accent-meta-orange"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Нет сил</span>
                                    <span>Энергия на максимуме</span>
                                </div>
                            </div>

                            {/* Sleep & Water */}
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-1.5">
                                        <Moon className="w-3.5 h-3.5" /> Сон (часов)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                        value={form.sleep_hours}
                                        onChange={e => setForm({ ...form, sleep_hours: parseFloat(e.target.value) || 0 })}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-1.5">
                                        <Droplets className="w-3.5 h-3.5" /> Вода (литров)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.25"
                                        value={form.water_liters}
                                        onChange={e => setForm({ ...form, water_liters: parseFloat(e.target.value) || 0 })}
                                        className="glass-input w-full"
                                    />
                                </div>
                            </div>

                            {/* Workout toggle */}
                            <div className="mb-5">
                                <button
                                    onClick={() => setForm({ ...form, workout_done: !form.workout_done })}
                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all
                                        ${form.workout_done
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : 'bg-deep-dark-200/40 border-white/5 text-gray-400'
                                        }`}
                                >
                                    <Dumbbell className="w-5 h-5" />
                                    <span className="text-sm font-medium">
                                        {form.workout_done ? 'Тренировка выполнена ✓' : 'Была ли тренировка сегодня?'}
                                    </span>
                                </button>
                            </div>

                            {/* Nutrition Notes */}
                            <div className="mb-5">
                                <label className="text-sm text-gray-400 mb-2 flex items-center gap-1.5">
                                    <Apple className="w-3.5 h-3.5" /> Питание (заметки)
                                </label>
                                <textarea
                                    value={form.nutrition_notes}
                                    onChange={e => setForm({ ...form, nutrition_notes: e.target.value })}
                                    placeholder="Что ели сегодня? Придерживались плана?"
                                    rows={2}
                                    className="glass-input w-full resize-none"
                                />
                            </div>

                            {/* Reflection */}
                            <div className="mb-6">
                                <label className="text-sm text-gray-400 mb-2 flex items-center gap-1.5">
                                    <Heart className="w-3.5 h-3.5" /> Рефлексия дня
                                </label>
                                <textarea
                                    value={form.reflection}
                                    onChange={e => setForm({ ...form, reflection: e.target.value })}
                                    placeholder="Что было хорошо? Что можно улучшить?"
                                    rows={3}
                                    className="glass-input w-full resize-none"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="glass-button w-full flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Сохранение...' : 'Сохранить запись'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Entries List */}
                {entries.length === 0 ? (
                    <div className="glass-card p-8 md:p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">Дневник пуст</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Начните вести ежедневные записи для отслеживания прогресса
                        </p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="glass-button inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Создать первую запись
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {entries.map((entry, idx) => {
                            const moodInfo = getMoodInfo(entry.mood)
                            const MoodIcon = moodInfo.icon

                            return (
                                <div
                                    key={entry.id || idx}
                                    onClick={() => setSelectedEntry(selectedEntry?.date === entry.date ? null : entry)}
                                    className={`glass-card p-4 md:p-5 cursor-pointer transition-all hover:border-white/20
                                        ${selectedEntry?.date === entry.date ? 'border-meta-orange/30' : ''}`}
                                >
                                    {/* Date & Mood */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm text-gray-300">
                                                {new Date(entry.date).toLocaleDateString('ru-RU', {
                                                    day: 'numeric',
                                                    month: 'long'
                                                })}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-1.5 ${moodInfo.color}`}>
                                            <MoodIcon className="w-5 h-5" />
                                            <span className="text-xs">{moodInfo.label}</span>
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Moon className="w-3.5 h-3.5" /> {entry.sleep_hours}ч
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Droplets className="w-3.5 h-3.5" /> {entry.water_liters}л
                                        </span>
                                        {entry.workout_done && (
                                            <span className="flex items-center gap-1 text-green-400">
                                                <Dumbbell className="w-3.5 h-3.5" /> Тренировка
                                            </span>
                                        )}
                                    </div>

                                    {/* Reflection preview */}
                                    {entry.reflection && (
                                        <p className={`text-sm text-gray-400 ${selectedEntry?.date === entry.date ? '' : 'line-clamp-2'}`}>
                                            {entry.reflection}
                                        </p>
                                    )}

                                    {/* Expanded View */}
                                    {selectedEntry?.date === entry.date && entry.nutrition_notes && (
                                        <div className="mt-3 pt-3 border-t border-white/5">
                                            <p className="text-xs text-gray-500 mb-1">Питание:</p>
                                            <p className="text-sm text-gray-400">{entry.nutrition_notes}</p>
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
