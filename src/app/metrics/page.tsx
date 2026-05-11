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
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function MetricsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [metrics, setMetrics] = useState<ClientMetric[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

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
    }, [user])

    const updateField = (field: keyof MetricFormData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSaveMetric = async () => {
        setIsSaving(true)
        try {
            await upsertMetric(formData as MetricFormData)
            const updatedMetrics = await getMyMetrics()
            setMetrics(updatedMetrics)
            setShowAddModal(false)
            setFormData({ measured_at: new Date().toISOString().split('T')[0] })
        } catch (e) {
            console.error('Error saving metric:', e)
        } finally {
            setIsSaving(false)
        }
    }

    const handlePhotoUpload = async (file: File, type: 'front' | 'side' | 'back') => {
        try {
            const url = await uploadProgressPhoto(file, type, formData.measured_at || new Date().toISOString().split('T')[0])
            updateField(`photo_${type}` as keyof MetricFormData, url)
        } catch (e) {
            console.error('Photo upload error:', e)
        }
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
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white mb-2">Метрики</h1>
                        <p className="text-text-secondary">Отслеживайте свой прогресс</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="glass-button flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Добавить замер
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
                    <div className="space-y-8">
                        {/* Weight Chart */}
                        {weightData.length > 0 && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Weight className="w-5 h-5 text-accent" />
                                    <h2 className="text-xl font-display font-bold text-white">Динамика веса</h2>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={weightData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#8a8a82" />
                                        <YAxis stroke="#8a8a82" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1a1a1a',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="weight"
                                            stroke="#c8f542"
                                            strokeWidth={3}
                                            dot={{ fill: '#c8f542', r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Measurements Chart */}
                        {measurementsData.length > 0 && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Ruler className="w-5 h-5 text-accent" />
                                    <h2 className="text-xl font-display font-bold text-white">Объемы</h2>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={measurementsData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#8a8a82" />
                                        <YAxis stroke="#8a8a82" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1a1a1a',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                            }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="waist" stroke="#c8f542" name="Талия" />
                                        <Line type="monotone" dataKey="hips" stroke="#60a5fa" name="Бедра" />
                                        <Line type="monotone" dataKey="chest" stroke="#f5c842" name="Грудь" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Lifestyle Chart */}
                        {lifestyleData.length > 0 && (
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Activity className="w-5 h-5 text-accent" />
                                    <h2 className="text-xl font-display font-bold text-white">Образ жизни</h2>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={lifestyleData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#8a8a82" />
                                        <YAxis stroke="#8a8a82" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1a1a1a',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                            }}
                                        />
                                        <Legend />
                                        <Bar dataKey="sleep" fill="#60a5fa" name="Сон (ч)" />
                                        <Bar dataKey="stress" fill="#ff4d4d" name="Стресс" />
                                        <Bar dataKey="water" fill="#34d399" name="Вода (л)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Progress Photos */}
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Camera className="w-5 h-5 text-accent" />
                                <h2 className="text-xl font-display font-bold text-white">Фото прогресса</h2>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {metrics
                                    .filter((m) => m.photo_front || m.photo_side || m.photo_back)
                                    .slice(0, 6)
                                    .map((metric) => (
                                        <div key={metric.id} className="space-y-2">
                                            <p className="text-xs text-text-muted text-center">
                                                {format(new Date(metric.measured_at), 'dd MMM yyyy', { locale: ru })}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {metric.photo_front && (
                                                    <img
                                                        src={metric.photo_front}
                                                        alt="Front"
                                                        className="w-full aspect-square object-cover rounded-lg"
                                                    />
                                                )}
                                                {metric.photo_side && (
                                                    <img
                                                        src={metric.photo_side}
                                                        alt="Side"
                                                        className="w-full aspect-square object-cover rounded-lg"
                                                    />
                                                )}
                                                {metric.photo_back && (
                                                    <img
                                                        src={metric.photo_back}
                                                        alt="Back"
                                                        className="w-full aspect-square object-cover rounded-lg"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
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
                            <button onClick={() => setShowAddModal(false)} className="glass-button-secondary p-2">
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

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowAddModal(false)}
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
