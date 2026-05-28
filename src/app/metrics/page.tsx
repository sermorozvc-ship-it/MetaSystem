'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    TrendingUp, Plus, Calendar, Camera, Loader2, X, Upload,
    Weight, Ruler, Activity, Moon, Droplet, Footprints
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    getMyMetrics,
    getLatestMetric,
    upsertMetric,
    uploadProgressPhoto,
    type ClientMetric,
    type MetricFormData,
} from '@/lib/services/metrics'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useFailsafe } from '@/lib/hooks/useFailsafe'

export default function MetricsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [metrics, setMetrics] = useState<ClientMetric[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [modalPhotoUrls, setModalPhotoUrls] = useState<{ front?: string; side?: string; back?: string }>({})

    const resetModal = () => {
        setFormData({ measured_at: new Date().toISOString().split('T')[0] })
        setModalPhotoUrls({})
        setSaveError('')
    }

    // Form state
    const [formData, setFormData] = useState<Partial<MetricFormData>>({
        measured_at: new Date().toISOString().split('T')[0],
    })

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    useEffect(() => {
        if (!user) return

        const loadMetrics = async () => {
            try {
                const data = await getMyMetrics()
                setMetrics(data)
            } catch (e) {
                console.error('Error loading metrics:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadMetrics()
    }, [user?.id])

    // Аварийный таймер от вечного лоадера на десктопе
    useFailsafe(isLoading, () => setIsLoading(false), 8_000, 'metrics')

    const updateField = (field: keyof MetricFormData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSaveMetric = async () => {
        setIsSaving(true)
        setSaveError('')
        try {
            await upsertMetric(formData as MetricFormData)
            const updatedMetrics = await getMyMetrics()
            setMetrics(updatedMetrics)
            setShowAddModal(false)
            resetModal()
        } catch (e: any) {
            console.error('Error saving metric:', e)
            setSaveError(e?.message || 'Ошибка сохранения')
        } finally {
            setIsSaving(false)
        }
    }

    const handlePhotoUpload = async (file: File, type: 'front' | 'side' | 'back') => {
        // Показываем превью сразу
        const localUrl = URL.createObjectURL(file)
        setModalPhotoUrls(prev => ({ ...prev, [type]: localUrl }))
        try {
            // Сжимаем перед загрузкой
            const compressed = await compressImage(file, 1200, 0.8)
            const url = await uploadProgressPhoto(compressed, type, formData.measured_at || new Date().toISOString().split('T')[0])
            setModalPhotoUrls(prev => ({ ...prev, [type]: url }))
            updateField(`photo_${type}` as keyof MetricFormData, url)
        } catch (e) {
            console.error('Photo upload error:', e)
            setSaveError('Ошибка загрузки фото')
            setModalPhotoUrls(prev => ({ ...prev, [type]: undefined }))
        }
    }

    const compressImage = (file: File, maxSize: number, quality: number): Promise<File> => {
        return new Promise((resolve) => {
            const img = new Image()
            const objectUrl = URL.createObjectURL(file)
            img.onload = () => {
                URL.revokeObjectURL(objectUrl)
                let { width, height } = img
                if (width > maxSize || height > maxSize) {
                    if (width > height) { height = Math.round(height * maxSize / width); width = maxSize }
                    else { width = Math.round(width * maxSize / height); height = maxSize }
                }
                const canvas = document.createElement('canvas')
                canvas.width = width; canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) { resolve(file); return }
                ctx.drawImage(img, 0, 0, width, height)
                canvas.toBlob(blob => {
                    if (!blob) { resolve(file); return }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
                }, 'image/jpeg', quality)
            }
            img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
            img.src = objectUrl
        })
    }

    // Prepare chart data
    const weightData = metrics
        .filter((m) => m.weight_kg)
        .map((m) => ({
            date: format(new Date(m.measured_at), 'dd MMM', { locale: ru }),
            weight: m.weight_kg,
        }))
        .reverse()

    const measurementsData = metrics
        .filter((m) => m.waist_cm || m.hips_cm || m.chest_cm)
        .map((m) => ({
            date: format(new Date(m.measured_at), 'dd MMM', { locale: ru }),
            waist: m.waist_cm,
            hips: m.hips_cm,
            chest: m.chest_cm,
        }))
        .reverse()

    const lifestyleData = metrics
        .filter((m) => m.sleep_hours || m.stress_level || m.water_liters)
        .map((m) => ({
            date: format(new Date(m.measured_at), 'dd MMM', { locale: ru }),
            sleep: m.sleep_hours,
            stress: m.stress_level,
            water: m.water_liters,
        }))
        .reverse()

    if (!authLoading && !user) {
        return null
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-6 md:py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">Метрики</h1>
                        <p className="text-text-secondary text-sm">Отслеживайте свой прогресс</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="glass-button flex items-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Добавить замер</span>
                        <span className="sm:hidden">+</span>
                    </button>
                </div>

                {metrics.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <TrendingUp className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-display font-bold text-white mb-2">Метрик пока нет</h3>
                        <p className="text-text-secondary mb-6">Добавьте первый замер для отслеживания прогресса</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="glass-button flex items-center gap-2 mx-auto"
                        >
                            <Plus className="w-4 h-4" />
                            Добавить замер
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">

                        {/* Последние значения — сводка */}
                        {metrics.length > 0 && (() => {
                            const latest = metrics[0]
                            const prev = metrics[1]
                            const delta = (cur?: number, pre?: number) => {
                                if (!cur || !pre) return null
                                const d = cur - pre
                                return { val: Math.abs(d).toFixed(1), up: d > 0 }
                            }
                            const cards = [
                                { label: 'Вес', value: latest.weight_kg, unit: 'кг', d: delta(latest.weight_kg, prev?.weight_kg), color: 'text-accent' },
                                { label: '% жира', value: latest.body_fat_pct, unit: '%', d: delta(latest.body_fat_pct, prev?.body_fat_pct), color: 'text-blue-400' },
                                { label: 'Талия', value: latest.waist_cm, unit: 'см', d: delta(latest.waist_cm, prev?.waist_cm), color: 'text-yellow-400' },
                                { label: 'Сон', value: latest.sleep_hours, unit: 'ч', d: delta(latest.sleep_hours, prev?.sleep_hours), color: 'text-purple-400' },
                                { label: 'Стресс', value: latest.stress_level, unit: '/10', d: delta(latest.stress_level, prev?.stress_level), color: 'text-red-400' },
                                { label: 'Вода', value: latest.water_liters, unit: 'л', d: delta(latest.water_liters, prev?.water_liters), color: 'text-emerald-400' },
                            ].filter(c => c.value)
                            return (
                                <div>
                                    <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">Последний замер · {format(new Date(latest.measured_at), 'dd MMM yyyy', { locale: ru })}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                        {cards.map(c => (
                                            <div key={c.label} className="glass-card p-4 text-center">
                                                <p className="text-xs text-text-muted mb-1">{c.label}</p>
                                                <p className={`text-2xl font-display font-bold ${c.color}`}>{c.value}</p>
                                                <p className="text-xs text-text-muted">{c.unit}</p>
                                                {c.d && (
                                                    <p className={`text-xs mt-1 font-medium ${c.d.up ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {c.d.up ? '↑' : '↓'} {c.d.val}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* График веса */}
                        {weightData.length > 1 && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Weight className="w-5 h-5 text-accent" />
                                    <h2 className="text-lg font-display font-bold text-white">Динамика веса</h2>
                                </div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#c8f542" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#c8f542" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="#555" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12 }} formatter={(v: any) => [`${v} кг`, 'Вес']} />
                                        <Area type="monotone" dataKey="weight" stroke="#c8f542" strokeWidth={2.5} fill="url(#weightGrad)" dot={{ fill: '#c8f542', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Объёмы */}
                        {measurementsData.length > 1 && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Ruler className="w-5 h-5 text-accent" />
                                    <h2 className="text-lg font-display font-bold text-white">Объёмы</h2>
                                </div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={measurementsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="#555" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12 }} formatter={(v: any, name: any) => [`${v} см`, name]} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Line type="monotone" dataKey="waist" stroke="#c8f542" strokeWidth={2} dot={{ r: 3 }} name="Талия" />
                                        <Line type="monotone" dataKey="hips" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Бёдра" />
                                        <Line type="monotone" dataKey="chest" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Грудь" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Образ жизни — линейные графики вместо баров */}
                        {lifestyleData.length > 1 && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Activity className="w-5 h-5 text-accent" />
                                    <h2 className="text-lg font-display font-bold text-white">Образ жизни</h2>
                                </div>
                                <div className="grid md:grid-cols-3 gap-4">
                                    {[
                                        { key: 'sleep', label: 'Сон', unit: 'ч', color: '#818cf8' },
                                        { key: 'stress', label: 'Стресс', unit: '/10', color: '#f87171' },
                                        { key: 'water', label: 'Вода', unit: 'л', color: '#34d399' },
                                    ].map(({ key, label, unit, color }) => {
                                        const hasData = lifestyleData.some(d => (d as any)[key])
                                        if (!hasData) return null
                                        return (
                                            <div key={key}>
                                                <p className="text-xs text-text-muted mb-2">{label} ({unit})</p>
                                                <ResponsiveContainer width="100%" height={100}>
                                                    <AreaChart data={lifestyleData} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="date" hide />
                                                        <YAxis hide domain={['auto', 'auto']} />
                                                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: 11 }} formatter={(v: any) => [`${v}${unit}`, label]} />
                                                        <Area type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#grad-${key})`} dot={false} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Таблица истории замеров */}
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-display font-bold text-white mb-4">История замеров</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-text-muted border-b border-border">
                                            <th className="text-left pb-2 pr-4">Дата</th>
                                            <th className="text-right pb-2 pr-4">Вес</th>
                                            <th className="text-right pb-2 pr-4">% жира</th>
                                            <th className="text-right pb-2 pr-4">Талия</th>
                                            <th className="text-right pb-2 pr-4">Бёдра</th>
                                            <th className="text-right pb-2 pr-4">Грудь</th>
                                            <th className="text-right pb-2 pr-4">Сон</th>
                                            <th className="text-right pb-2">Стресс</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metrics.map(m => (
                                            <tr key={m.id} className="border-b border-border/40 hover:bg-white/5">
                                                <td className="py-2 pr-4 text-text-secondary">{format(new Date(m.measured_at), 'dd.MM.yyyy')}</td>
                                                <td className="py-2 pr-4 text-right text-white font-medium">{m.weight_kg ? `${m.weight_kg} кг` : '—'}</td>
                                                <td className="py-2 pr-4 text-right text-text-secondary">{m.body_fat_pct ? `${m.body_fat_pct}%` : '—'}</td>
                                                <td className="py-2 pr-4 text-right text-text-secondary">{m.waist_cm ?? '—'}</td>
                                                <td className="py-2 pr-4 text-right text-text-secondary">{m.hips_cm ?? '—'}</td>
                                                <td className="py-2 pr-4 text-right text-text-secondary">{m.chest_cm ?? '—'}</td>
                                                <td className="py-2 pr-4 text-right text-text-secondary">{m.sleep_hours ? `${m.sleep_hours}ч` : '—'}</td>
                                                <td className="py-2 text-right text-text-secondary">{m.stress_level ? `${m.stress_level}/10` : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Фото прогресса */}
                        {metrics.some(m => m.photo_front || m.photo_side || m.photo_back) && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Camera className="w-5 h-5 text-accent" />
                                    <h2 className="text-lg font-display font-bold text-white">Фото прогресса</h2>
                                </div>
                                <div className="space-y-6">
                                    {metrics
                                        .filter(m => m.photo_front || m.photo_side || m.photo_back)
                                        .map(metric => (
                                            <div key={metric.id}>
                                                <p className="text-xs text-text-muted mb-3">
                                                    {format(new Date(metric.measured_at), 'dd MMM yyyy', { locale: ru })}
                                                </p>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {[
                                                        { url: metric.photo_front, label: 'Спереди' },
                                                        { url: metric.photo_side, label: 'Сбоку' },
                                                        { url: metric.photo_back, label: 'Сзади' },
                                                    ].map(({ url, label }) => (
                                                        <div key={label}>
                                                            <p className="text-xs text-text-muted text-center mb-1.5">{label}</p>
                                                            {url ? (
                                                                <a href={url} target="_blank" rel="noopener noreferrer">
                                                                    <img
                                                                        src={url}
                                                                        alt={label}
                                                                        className="w-full h-56 object-contain rounded-xl bg-bg-elevated hover:opacity-90 transition-opacity cursor-pointer"
                                                                    />
                                                                </a>
                                                            ) : (
                                                                <div className="w-full h-56 rounded-xl bg-bg-elevated flex items-center justify-center">
                                                                    <span className="text-xs text-text-muted">Нет фото</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Metric Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div
                        className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-display font-bold text-white">Добавить замер</h2>
                            <button onClick={() => { setShowAddModal(false); resetModal() }} className="glass-button-secondary p-2">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Дата замера</label>
                                <input
                                    type="date"
                                    value={formData.measured_at}
                                    onChange={(e) => updateField('measured_at', e.target.value)}
                                    className="glass-input w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Вес (кг)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.weight_kg || ''}
                                        onChange={(e) => updateField('weight_kg', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">% жира</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.body_fat_pct || ''}
                                        onChange={(e) => updateField('body_fat_pct', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Талия (см)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.waist_cm || ''}
                                        onChange={(e) => updateField('waist_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Бедра (см)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.hips_cm || ''}
                                        onChange={(e) => updateField('hips_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Грудь (см)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.chest_cm || ''}
                                        onChange={(e) => updateField('chest_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Сон (ч)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={formData.sleep_hours || ''}
                                        onChange={(e) => updateField('sleep_hours', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Стресс (1-10)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={formData.stress_level || ''}
                                        onChange={(e) => updateField('stress_level', parseInt(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Вода (л)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.water_liters || ''}
                                        onChange={(e) => updateField('water_liters', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Заметки</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => updateField('notes', e.target.value)}
                                    className="glass-input w-full h-20 resize-none"
                                    placeholder="Самочувствие, наблюдения..."
                                />
                            </div>

                            {/* Фото прогресса */}
                            <div>
                                <label className="block text-sm text-text-secondary mb-3">
                                    Фото прогресса <span className="text-text-muted">(необязательно)</span>
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['front', 'side', 'back'] as const).map((type) => {
                                        const label = type === 'front' ? 'Спереди' : type === 'side' ? 'Сбоку' : 'Сзади'
                                        const url = modalPhotoUrls[type]
                                        return (
                                            <div key={type} className="text-center">
                                                <p className="text-xs text-text-muted mb-1.5">{label}</p>
                                                <label className="glass-card cursor-pointer hover:border-accent transition-all flex flex-col items-center justify-center h-32 relative overflow-hidden">
                                                    {url ? (
                                                        <>
                                                            <img src={url} alt={label} className="absolute inset-0 w-full h-full object-contain rounded-xl p-1" />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                                                                <span className="text-white text-xs font-semibold">Заменить</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-5 h-5 text-text-muted mb-1" />
                                                            <span className="text-xs text-text-muted">Загрузить</span>
                                                        </>
                                                    )}
                                                    <input type="file" accept="image/*" className="hidden"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) await handlePhotoUpload(file, type)
                                                        }}
                                                    />
                                                </label>
                                                {url && (
                                                    <button type="button"
                                                        onClick={() => {
                                                            setModalPhotoUrls(prev => ({ ...prev, [type]: undefined }))
                                                            updateField(`photo_${type}` as keyof MetricFormData, undefined)
                                                        }}
                                                        className="mt-1 text-xs text-danger hover:underline">
                                                        Удалить
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {saveError && (
                                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                                    {saveError}
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setShowAddModal(false); resetModal() }}
                                    className="glass-button-secondary flex-1"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSaveMetric}
                                    disabled={isSaving}
                                    className="glass-button flex-1 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Сохранение...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Сохранить
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
