'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    ArrowLeft, Plus, Trash2, Save,
    Calendar, Heart, Frown, Meh, Smile, SmilePlus,
    Droplets, Moon, Dumbbell, Apple, X, Edit2, AlertCircle, RefreshCw,
    Camera, Upload, Eye
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { getJournalEntries, saveJournalEntry, deleteJournalEntry, uploadJournalPhoto, JournalEntry } from '@/lib/services/journal'

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
    const [uploading, setUploading] = useState<Record<string, boolean>>({})

    const today = new Date().toISOString().split('T')[0]

    const initialFormState: JournalEntry = {
        date: today,
        mood: 3,
        energy: 3,
        sleep_hours: 0,
        water_liters: 0,
        workout_done: false,
        nutrition_notes: '',
        reflection: '',
        photo_front: '',
        photo_side: '',
        photo_back: ''
    }

    const [form, setForm] = useState<JournalEntry>(initialFormState)

    const loadEntries = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (!user) {
                const stored = localStorage.getItem('demo_journal')
                const demoEntries = stored ? JSON.parse(stored) : []
                setEntries(Array.isArray(demoEntries) ? demoEntries : [])
                return
            }

            const data = await getJournalEntries()
            setEntries(data)
        } catch (e: any) {
            console.error('Journal fetch error:', e)
            setError('Ошибка при загрузке дневника. Попробуйте обновить страницу.')
        } finally {
            setIsLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (authLoading) return
        loadEntries()
    }, [authLoading, loadEntries, retryCount])

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
            }
        } catch (e) {
            console.error('Delete failed:', e)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'side' | 'back') => {
        const file = e.target.files?.[0]
        if (!file) return

        // Показываем локальный превью сразу (для быстрого отклика)
        const previewUrl = URL.createObjectURL(file)
        setForm(prev => ({ ...prev, [`photo_${type}`]: previewUrl }))

        // Если не авторизован — только локальный превью
        if (!user) return

        setUploading(prev => ({ ...prev, [type]: true }))
        try {
            const result = await uploadJournalPhoto(file, type)
            if (result.url) {
                // Заменяем локальный превью на реальный URL из Supabase
                setForm(prev => ({ ...prev, [`photo_${type}`]: result.url }))
            } else {
                // При ошибке оставляем локальный превью (уже установлен выше)
                console.error('Photo upload error:', result.error)
            }
        } catch (error) {
            console.error('Upload failed:', error)
            // Локальный превью уже показан — пользователь видит фото
        } finally {
            setUploading(prev => ({ ...prev, [type]: false }))
        }
    }

    const handleNumberFieldChange = (field: 'sleep_hours' | 'water_liters', val: string) => {
        if (val === '') {
            setForm(prev => ({ ...prev, [field]: 0 }))
            return
        }
        const normalized = val.replace(',', '.')
        const parsed = parseFloat(normalized)
        if (!isNaN(parsed)) {
            setForm(prev => ({ ...prev, [field]: parsed }))
        }
    }

    const getMoodInfo = (mood: number) => moodIcons.find(m => m.value === mood) || moodIcons[2]

    if (authLoading || isLoading) {
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
                            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight italic">ДНЕВНИК</h1>
                            <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-wider">Отслеживание формы и состояния</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setRetryCount(c => c + 1)}
                            className="p-3 rounded-2xl bg-white/5 border border-white/5 text-gray-500 hover:text-white transition-all"
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
                            <div className="flex items-center justify-between mb-10 sticky top-0 bg-[#181818] border-b border-white/5 py-3 -mx-6 px-6 md:-mx-10 md:px-10 z-10">
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
                                {/* Photos Section - NEW */}
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] mb-4 block">Фотоотчет (обязательно для прогресса)</label>
                                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                                        {(['front', 'side', 'back'] as const).map(type => {
                                            const photoUrl = form[`photo_${type}` as keyof JournalEntry] as string
                                            const isUploading = uploading[type]
                                            const inputId = `photo-upload-${type}`

                                            return (
                                                <div key={type} className="relative group">
                                                    <input
                                                        id={inputId}
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => handleFileChange(e, type)}
                                                        disabled={isUploading}
                                                    />
                                                    <label
                                                        htmlFor={inputId}
                                                        className={`aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative
                                                         ${photoUrl ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-white/10 hover:border-meta-orange/30 bg-white/5 active:bg-white/10'}`}
                                                    >
                                                        {photoUrl ? (
                                                            <div className="relative w-full h-full bg-black/40">
                                                                <img src={photoUrl} alt={type} className="w-full h-full object-contain transition-transform group-hover:scale-105" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <Camera className="w-6 h-6 text-white" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center p-2 text-center">
                                                                {isUploading ? (
                                                                    <RefreshCw className="w-6 h-6 text-meta-orange animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Camera className="w-6 h-6 text-gray-600 mb-2 group-hover:text-meta-orange transition-colors" />
                                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">
                                                                            {type === 'front' ? 'Анфас' : type === 'side' ? 'Профиль' : 'Спина'}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </label>
                                                    {photoUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm(prev => ({ ...prev, [`photo_${type}`]: '' }))}
                                                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl z-20 hover:scale-110 active:scale-90 transition-all border-2 border-deep-dark-100"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

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

                                {/* Mood Icons */}
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
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-gray-600"
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
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-gray-600"
                                        />
                                    </div>
                                </div>

                                {/* Workout Toggle */}
                                <button
                                    onClick={() => setForm({ ...form, workout_done: !form.workout_done })}
                                    className={`w-full group relative overflow-hidden flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all duration-500
                                        ${form.workout_done
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-2xl shadow-emerald-500/10'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300'
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

                                {/* Nutrition & Reflection */}
                                <div className="space-y-6">
                                    <textarea
                                        value={form.nutrition_notes}
                                        onChange={e => setForm({ ...form, nutrition_notes: e.target.value })}
                                        placeholder="ПИТАНИЕ ЗА СЕГОДНЯ..."
                                        rows={2}
                                        className="w-full bg-white/5 border-2 border-white/5 focus:border-meta-orange/30 rounded-[2rem] p-6 text-white placeholder:text-gray-500 focus:outline-none transition-all resize-none font-bold italic"
                                    />
                                    <textarea
                                        value={form.reflection}
                                        onChange={e => setForm({ ...form, reflection: e.target.value })}
                                        placeholder="КАКИЕ МЫСЛИ И ЧУВСТВА СЕГОДНЯ?"
                                        rows={4}
                                        className="w-full bg-white/5 border-2 border-white/5 focus:border-meta-orange/30 rounded-[2.5rem] p-6 md:p-8 text-white placeholder:text-gray-500 focus:outline-none transition-all resize-none font-bold italic leading-relaxed"
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving || Object.values(uploading).some(v => v)}
                                    className="w-full py-6 rounded-3xl bg-meta-orange text-white font-black uppercase tracking-[4px]
                                             flex items-center justify-center gap-4 hover:bg-meta-orange-hover 
                                             disabled:opacity-50 disabled:grayscale transition-all duration-500 
                                             shadow-2xl shadow-meta-orange/30 active:scale-95 text-lg"
                                >
                                    {saving ? <RefreshCw className="w-6 h-6 animate-spin" /> : (
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

                {/* Items List */}
                {entries.length === 0 && !isLoading ? (
                    <div className="glass-card p-12 md:p-24 text-center flex flex-col items-center">
                        <div className="w-32 h-32 rounded-[3rem] bg-white/5 flex items-center justify-center mb-10 group-hover:scale-110 transition-all">
                            <Plus className="w-16 h-16 text-gray-800" />
                        </div>
                        <h3 className="text-3xl font-black text-white italic mb-4">ЖУРНАЛ ПУСТ</h3>
                        <button onClick={handleCreateNew} className="px-12 py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white font-black uppercase tracking-[2px] flex items-center gap-4">
                            <Plus className="w-6 h-6 text-meta-orange" /> НАЧАТЬ ЖУРНАЛ
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in no-scrollbar">
                        {entries.map((entry) => {
                            const moodInfo = getMoodInfo(entry.mood)
                            const MoodIcon = moodInfo.icon
                            const hasPhotos = entry.photo_front || entry.photo_side || entry.photo_back

                            return (
                                <div
                                    key={entry.date}
                                    className="relative group bg-deep-dark-100/40 hover:bg-deep-dark-200/60 border border-white/5 hover:border-meta-orange/20 rounded-[2.5rem] p-7 transition-all duration-500 overflow-hidden"
                                >
                                    {/* Actions */}
                                    <div className="absolute top-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all z-20">
                                        <button onClick={() => handleEdit(entry)} className="w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md flex items-center justify-center text-gray-500 hover:text-white border border-white/5"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(entry.date)} className="w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md flex items-center justify-center text-gray-500 hover:text-red-400 border border-white/5"><Trash2 className="w-4 h-4" /></button>
                                    </div>

                                    {/* Card Header */}
                                    <div className="flex items-start gap-5 mb-6 relative z-10">
                                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${moodInfo.bg} ${moodInfo.color} shadow-xl`}>
                                            <MoodIcon className="w-9 h-9" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[2px] mb-1">{new Date(entry.date).toLocaleDateString('ru-RU', { weekday: 'long' })}</p>
                                            <h4 className="text-xl font-black text-white italic tracking-tight">{new Date(entry.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h4>
                                        </div>
                                    </div>

                                    {/* Photo Preview Strip - NEW */}
                                    {hasPhotos && (
                                        <div className="flex gap-2 mb-6 h-48 relative z-10">
                                            {[entry.photo_front, entry.photo_side, entry.photo_back].filter(Boolean).map((url, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => window.open(url!, '_blank')}
                                                    className="flex-1 rounded-2xl overflow-hidden border border-white/5 bg-black/40 shadow-lg group/photo relative cursor-pointer"
                                                >
                                                    <img src={url!} className="w-full h-full object-contain" alt="Progress" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Eye className="w-5 h-5 text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-3xl flex items-center gap-3">
                                            <Moon className="w-4 h-4 text-blue-400" />
                                            <div>
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Сон</p>
                                                <p className="text-lg font-black text-white italic leading-none mt-0.5">{entry.sleep_hours}Ч</p>
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-3xl flex items-center gap-3">
                                            <Droplets className="w-4 h-4 text-cyan-400" />
                                            <div>
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Вода</p>
                                                <p className="text-lg font-black text-white italic leading-none mt-0.5">{entry.water_liters}Л</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reflection */}
                                    {entry.reflection ? (
                                        <p className="text-sm text-gray-400 italic font-medium leading-relaxed line-clamp-2 pl-4 border-l-2 border-meta-orange/30 relative z-10">
                                            {entry.reflection}
                                        </p>
                                    ) : (
                                        <div className="py-4 border border-dashed border-white/5 rounded-3xl text-center relative z-10">
                                            <p className="text-[9px] font-black text-gray-700 uppercase tracking-[3px]">ЛОГ ЗАВЕРШЕН</p>
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
