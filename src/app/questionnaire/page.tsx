'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    User, Target, Dumbbell, Heart, Camera, ArrowRight,
    ArrowLeft, Check, Loader2, Upload, X, Info
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
    upsertQuestionnaire,
    uploadQuestionnairePhoto,
    isQuestionnaireCompleted,
    type QuestionnaireFormData
} from '@/lib/services/questionnaire'

const STEPS = [
    { id: 1, title: 'Основная информация', icon: User },
    { id: 2, title: 'Цели и опыт', icon: Target },
    { id: 3, title: 'Здоровье и образ жизни', icon: Heart },
    { id: 4, title: 'Замеры и фото', icon: Camera },
]

export default function QuestionnairePage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [currentStep, setCurrentStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Form data
    const [formData, setFormData] = useState<Partial<QuestionnaireFormData>>({
        preferred_training_days: 3,
        available_equipment: [],
        stress_level: 5,
        sleep_hours_avg: 7,
    })

    // Photo uploads
    const [photoFront, setPhotoFront] = useState<File | null>(null)
    const [photoSide, setPhotoSide] = useState<File | null>(null)
    const [photoBack, setPhotoBack] = useState<File | null>(null)
    const [photoUrls, setPhotoUrls] = useState<{
        front?: string
        side?: string
        back?: string
    }>({})

    // Redirect if not authenticated
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    // Check if already completed
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
        if (!user) return

        const checkCompleted = async () => {
            const completed = await isQuestionnaireCompleted()
            if (completed) {
                router.replace('/dashboard')
            }
        }
        checkCompleted()
    }, [user, router])

    const updateField = (field: keyof QuestionnaireFormData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handlePhotoUpload = async (file: File, type: 'front' | 'side' | 'back') => {
        try {
            // Сжимаем фото через Canvas перед загрузкой (макс 1200px, качество 0.8)
            const compressed = await compressImage(file, 1200, 0.8)
            const url = await uploadQuestionnairePhoto(compressed, type)
            setPhotoUrls((prev) => ({ ...prev, [type]: url }))
            updateField(`photo_${type}` as keyof QuestionnaireFormData, url)
        } catch (e) {
            console.error('Photo upload error:', e)
            setError('Ошибка загрузки фото. Попробуйте другой файл.')
        }
    }

    // Сжатие изображения через Canvas
    const compressImage = (file: File, maxSize: number, quality: number): Promise<File> => {
        return new Promise((resolve, reject) => {
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
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) { resolve(file); return }
                ctx.drawImage(img, 0, 0, width, height)
                canvas.toBlob(
                    (blob) => {
                        if (!blob) { resolve(file); return }
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
                    },
                    'image/jpeg',
                    quality
                )
            }
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Не удалось загрузить изображение')) }
            img.src = objectUrl
        })
    }

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1)
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleSubmit = async () => {
        setError('')
        setIsSubmitting(true)

        try {
            // Шаг 1 — базовые данные
            if (!formData.age || !formData.gender || !formData.height_cm || !formData.weight_kg) {
                setError('Заполните возраст, пол, рост и вес')
                setIsSubmitting(false)
                return
            }
            // Шаг 2 — цели и опыт
            if (!formData.goal || !formData.training_experience) {
                setError('Укажите цель и опыт тренировок')
                setIsSubmitting(false)
                return
            }
            if (!formData.preferred_training_days) {
                setError('Укажите количество тренировочных дней')
                setIsSubmitting(false)
                return
            }
            if (!formData.available_equipment || formData.available_equipment.length === 0) {
                setError('Выберите место тренировок')
                setIsSubmitting(false)
                return
            }
            // Шаг 3 — образ жизни
            if (!formData.activity_level) {
                setError('Укажите уровень активности')
                setIsSubmitting(false)
                return
            }
            if (!formData.sleep_hours_avg || !formData.stress_level) {
                setError('Заполните данные о сне и стрессе')
                setIsSubmitting(false)
                return
            }

            await upsertQuestionnaire(formData as QuestionnaireFormData)
            router.push('/dashboard')
        } catch (e: any) {
            console.error('Submit error:', e)
            setError(e?.message || 'Ошибка сохранения анкеты')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    const progress = (currentStep / STEPS.length) * 100

    return (
        <div className="min-h-screen bg-bg-main p-4 py-12">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-display font-bold text-white mb-2">Анкета клиента</h1>
                    <p className="text-text-secondary">
                        Заполните информацию для составления индивидуальной программы
                    </p>
                </div>

                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex justify-between mb-4">
                        {STEPS.map((step) => {
                            const Icon = step.icon
                            const isActive = currentStep === step.id
                            const isCompleted = currentStep > step.id

                            return (
                                <div key={step.id} className="flex-1 flex flex-col items-center">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                                            isCompleted
                                                ? 'bg-accent text-bg-main'
                                                : isActive
                                                ? 'bg-accent text-bg-main shadow-glow-accent'
                                                : 'bg-bg-elevated text-text-muted'
                                        }`}
                                    >
                                        {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                    </div>
                                    <span
                                        className={`text-xs text-center hidden md:block ${
                                            isActive ? 'text-white font-semibold' : 'text-text-muted'
                                        }`}
                                    >
                                        {step.title}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Form content */}
                <div className="glass-card p-8 mb-6">
                    {/* Step 1: Basic Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-display font-bold text-white mb-6">Основная информация</h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Возраст *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.age || ''}
                                        onChange={(e) => updateField('age', parseInt(e.target.value))}
                                        className="glass-input w-full"
                                        placeholder="25"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">Пол *</label>
                                    <select
                                        value={formData.gender || ''}
                                        onChange={(e) => updateField('gender', e.target.value)}
                                        className="glass-input w-full"
                                    >
                                        <option value="">Выберите</option>
                                        <option value="male">Мужской</option>
                                        <option value="female">Женский</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Рост (см) *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.height_cm || ''}
                                        onChange={(e) => updateField('height_cm', parseInt(e.target.value))}
                                        className="glass-input w-full"
                                        placeholder="175"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Вес (кг) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.weight_kg || ''}
                                        onChange={(e) => updateField('weight_kg', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                        placeholder="70"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Goals & Experience */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-display font-bold text-white mb-6">Цели и опыт</h2>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Ваша цель *
                                </label>
                                <textarea
                                    value={formData.goal || ''}
                                    onChange={(e) => updateField('goal', e.target.value)}
                                    className="glass-input w-full h-24 resize-none"
                                    placeholder="Например: похудеть на 10 кг, набрать мышечную массу, улучшить выносливость..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Опыт тренировок *
                                </label>
                                <select
                                    value={formData.training_experience || ''}
                                    onChange={(e) => updateField('training_experience', e.target.value)}
                                    className="glass-input w-full"
                                >
                                    <option value="">Выберите</option>
                                    <option value="beginner">Новичок (менее 6 месяцев)</option>
                                    <option value="intermediate">Средний (6 мес - 2 года)</option>
                                    <option value="advanced">Продвинутый (более 2 лет)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Сколько дней в неделю готовы тренироваться? *
                                </label>
                                <input
                                    type="range"
                                    min="2"
                                    max="7"
                                    value={formData.preferred_training_days || 3}
                                    onChange={(e) => updateField('preferred_training_days', parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <div className="text-center text-accent text-2xl font-bold mt-2">
                                    {formData.preferred_training_days} дней
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-3">
                                    Где тренируетесь?
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'Тренажёрный зал (всё оборудование)', label: 'Тренажёрный зал', desc: 'Всё оборудование' },
                                        { value: 'Дома (гантели, турник)', label: 'Дома', desc: 'Гантели, турник, петли' },
                                        { value: 'Улица (турник, брусья)', label: 'Улица', desc: 'Турник, брусья' },
                                        { value: 'Только вес тела', label: 'Без оборудования', desc: 'Только вес тела' },
                                    ].map(({ value, label, desc }) => {
                                        const selected = formData.available_equipment?.includes(value) || false
                                        return (
                                            <label key={value} className={`flex items-start gap-3 cursor-pointer px-4 py-3 rounded-xl transition-all border ${
                                                selected
                                                    ? 'bg-accent/20 border-accent/50'
                                                    : 'bg-bg-elevated border-transparent hover:border-border'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={(e) => {
                                                        const current = formData.available_equipment || []
                                                        updateField('available_equipment',
                                                            e.target.checked
                                                                ? [...current, value]
                                                                : current.filter(eq => eq !== value)
                                                        )
                                                    }}
                                                    className="w-4 h-4 mt-0.5 accent-accent flex-shrink-0"
                                                />
                                                <div>
                                                    <p className={`text-sm font-medium ${selected ? 'text-accent' : 'text-white'}`}>{label}</p>
                                                    <p className="text-xs text-text-muted">{desc}</p>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Health & Lifestyle */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-display font-bold text-white mb-6">
                                Здоровье и образ жизни
                            </h2>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Травмы или ограничения
                                </label>
                                <textarea
                                    value={formData.injuries || ''}
                                    onChange={(e) => updateField('injuries', e.target.value)}
                                    className="glass-input w-full h-20 resize-none"
                                    placeholder="Укажите травмы, боли, ограничения..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Хронические заболевания
                                </label>
                                <textarea
                                    value={formData.health_conditions || ''}
                                    onChange={(e) => updateField('health_conditions', e.target.value)}
                                    className="glass-input w-full h-20 resize-none"
                                    placeholder="Диабет, гипертония и т.д."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Среднее количество сна (часов)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={formData.sleep_hours_avg || 7}
                                    onChange={(e) => updateField('sleep_hours_avg', parseFloat(e.target.value))}
                                    className="glass-input w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Уровень стресса (1-10)
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={formData.stress_level || 5}
                                    onChange={(e) => updateField('stress_level', parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <div className="text-center text-accent text-2xl font-bold mt-2">
                                    {formData.stress_level}/10
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Уровень активности
                                </label>
                                <select
                                    value={formData.activity_level || ''}
                                    onChange={(e) => updateField('activity_level', e.target.value)}
                                    className="glass-input w-full"
                                >
                                    <option value="">Выберите</option>
                                    <option value="sedentary">Сидячий (офис, мало движения)</option>
                                    <option value="light">Легкая активность (прогулки)</option>
                                    <option value="moderate">Умеренная (активная работа)</option>
                                    <option value="high">Высокая (физический труд)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Measurements & Photos */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-display font-bold text-white mb-6">Замеры и фото</h2>

                            {/* Замеры */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {[
                                    {
                                        field: 'waist_cm' as const,
                                        label: 'Талия (см)',
                                        tip: 'Измеряйте на уровне пупка, в самом узком месте живота. Лента должна лежать горизонтально, не затягивайте — просто прилегание. Измеряйте утром натощак, стоя прямо.',
                                    },
                                    {
                                        field: 'hips_cm' as const,
                                        label: 'Бёдра (см)',
                                        tip: 'Измеряйте в самом широком месте ягодиц. Встаньте прямо, ноги вместе. Лента горизонтально, без натяжения.',
                                    },
                                    {
                                        field: 'chest_cm' as const,
                                        label: 'Грудь (см)',
                                        tip: 'Мужчины: по линии сосков. Женщины: под грудью по самому широкому месту. Руки опущены, дышите спокойно, измеряйте на выдохе.',
                                    },
                                    {
                                        field: 'arm_cm' as const,
                                        label: 'Рука (см)',
                                        tip: 'Измеряйте бицепс в самом широком месте при согнутой руке под 90°. Мышца напряжена. Измеряйте рабочую руку (правую для правшей).',
                                    },
                                    {
                                        field: 'thigh_cm' as const,
                                        label: 'Бедро (см)',
                                        tip: 'Измеряйте в самом широком месте бедра — примерно на 10–15 см ниже паховой складки. Стоя прямо, вес равномерно на обеих ногах.',
                                    },
                                ].map(({ field, label, tip }) => (
                                    <div key={field}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <label className="text-sm font-medium text-text-secondary">{label}</label>
                                            <div className="relative group">
                                                <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
                                                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-xl bg-bg-card border border-border text-xs text-text-secondary leading-relaxed z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                                                    {tip}
                                                </div>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={(formData[field] as number) || ''}
                                            onChange={(e) => updateField(field, parseFloat(e.target.value))}
                                            className="glass-input w-full"
                                            placeholder="0.0"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Дополнительная информация
                                </label>
                                <textarea
                                    value={formData.additional_notes || ''}
                                    onChange={(e) => updateField('additional_notes', e.target.value)}
                                    className="glass-input w-full h-24 resize-none"
                                    placeholder="Любая дополнительная информация, которую хотите сообщить тренеру..."
                                />
                            </div>

                            {/* Фото */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <p className="text-sm font-medium text-text-secondary">
                                        Стартовые фото <span className="text-text-muted font-normal">(необязательно)</span>
                                    </p>
                                    <div className="relative group">
                                        <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
                                        <div className="absolute left-0 bottom-full mb-2 w-72 p-3 rounded-xl bg-bg-card border border-border text-xs text-text-secondary leading-relaxed z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                                            <p className="font-semibold text-white mb-1.5">Как сделать фото правильно:</p>
                                            <ul className="space-y-1">
                                                <li>📍 Встаньте в 1–1.5 м от зеркала или попросите кого-то сфотографировать</li>
                                                <li>💡 Хорошее равномерное освещение — лучше дневной свет у окна, без теней</li>
                                                <li>👕 Минимум одежды — шорты/купальник, чтобы были видны контуры тела</li>
                                                <li>📐 Три ракурса: спереди, сбоку (правый бок), сзади</li>
                                                <li>🧍 Стойте прямо, руки вдоль тела, ноги на ширине плеч</li>
                                                <li>🌅 Лучшее время — утром натощак</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-text-muted mb-4">Фото помогут тренеру оценить вашу форму и отслеживать прогресс</p>
                                <div className="grid grid-cols-3 gap-4">
                                    {(['front', 'side', 'back'] as const).map((type) => {
                                        const label = type === 'front' ? 'Спереди' : type === 'side' ? 'Сбоку' : 'Сзади'
                                        const url = photoUrls[type]
                                        return (
                                            <div key={type} className="text-center">
                                                <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
                                                <label className="glass-card cursor-pointer hover:border-accent transition-all flex flex-col items-center justify-center h-48 relative overflow-hidden">
                                                    {url ? (
                                                        <>
                                                            <img src={url} alt={label} className="absolute inset-0 w-full h-full object-contain rounded-xl p-1" />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                                                                <span className="text-white text-xs font-semibold">Заменить</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-6 h-6 text-text-muted mb-2" />
                                                            <span className="text-xs text-text-muted">Загрузить</span>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) {
                                                                const localUrl = URL.createObjectURL(file)
                                                                setPhotoUrls(prev => ({ ...prev, [type]: localUrl }))
                                                                await handlePhotoUpload(file, type)
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPhotoUrls(prev => ({ ...prev, [type]: undefined }))
                                                            updateField(`photo_${type}` as keyof QuestionnaireFormData, undefined)
                                                        }}
                                                        className="mt-1 text-xs text-danger hover:underline"
                                                    >
                                                        Удалить
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 mb-6 rounded-xl bg-danger/10 border border-danger/30">
                        <p className="text-sm text-danger">{error}</p>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between gap-4">
                    {currentStep > 1 && (
                        <button onClick={handleBack} className="glass-button-secondary flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Назад
                        </button>
                    )}

                    {currentStep < STEPS.length ? (
                        <button onClick={handleNext} className="glass-button ml-auto flex items-center gap-2">
                            Далее
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="glass-button ml-auto flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Завершить
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
