'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    User, Target, Dumbbell, Heart, Camera, ArrowRight,
    ArrowLeft, Check, Loader2, Upload, X
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
        if (!authLoading && !user) {
            router.replace('/auth')
        }
    }, [user, authLoading, router])

    // Check if already completed
    useEffect(() => {
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
            const url = await uploadQuestionnairePhoto(file, type)
            setPhotoUrls((prev) => ({ ...prev, [type]: url }))
            updateField(`photo_${type}` as keyof QuestionnaireFormData, url)
        } catch (e) {
            console.error('Photo upload error:', e)
            setError('Ошибка загрузки фото')
        }
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
            // Validate required fields
            if (!formData.age || !formData.gender || !formData.height_cm || !formData.weight_kg) {
                setError('Заполните все обязательные поля')
                setIsSubmitting(false)
                return
            }

            if (!formData.goal || !formData.training_experience) {
                setError('Укажите цель и опыт тренировок')
                setIsSubmitting(false)
                return
            }

            await upsertQuestionnaire(formData as QuestionnaireFormData)
            router.push('/dashboard')
        } catch (e) {
            console.error('Submit error:', e)
            setError('Ошибка сохранения анкеты')
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
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Доступное оборудование
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['Гантели', 'Штанга', 'Турник', 'Брусья', 'Тренажеры', 'Только вес тела'].map(
                                        (equipment) => (
                                            <label key={equipment} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.available_equipment?.includes(equipment)}
                                                    onChange={(e) => {
                                                        const current = formData.available_equipment || []
                                                        if (e.target.checked) {
                                                            updateField('available_equipment', [...current, equipment])
                                                        } else {
                                                            updateField(
                                                                'available_equipment',
                                                                current.filter((eq) => eq !== equipment)
                                                            )
                                                        }
                                                    }}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-text-secondary">{equipment}</span>
                                            </label>
                                        )
                                    )}
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

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Талия (см)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.waist_cm || ''}
                                        onChange={(e) => updateField('waist_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Бедра (см)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.hips_cm || ''}
                                        onChange={(e) => updateField('hips_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Грудь (см)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.chest_cm || ''}
                                        onChange={(e) => updateField('chest_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Рука (см)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.arm_cm || ''}
                                        onChange={(e) => updateField('arm_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Бедро (см)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.thigh_cm || ''}
                                        onChange={(e) => updateField('thigh_cm', parseFloat(e.target.value))}
                                        className="glass-input w-full"
                                    />
                                </div>
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

                            <div>
                                <p className="text-sm text-text-secondary mb-4">
                                    Фото помогут тренеру лучше оценить вашу форму и отслеживать прогресс (необязательно)
                                </p>
                                <div className="grid grid-cols-3 gap-4">
                                    {['front', 'side', 'back'].map((type) => (
                                        <div key={type} className="text-center">
                                            <label className="block text-sm font-medium text-text-secondary mb-2 capitalize">
                                                {type === 'front' ? 'Спереди' : type === 'side' ? 'Сбоку' : 'Сзади'}
                                            </label>
                                            <label className="glass-card p-4 cursor-pointer hover:border-accent transition-all flex flex-col items-center justify-center h-32">
                                                <Upload className="w-6 h-6 text-text-muted mb-2" />
                                                <span className="text-xs text-text-muted">Загрузить</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            handlePhotoUpload(file, type as 'front' | 'side' | 'back')
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    ))}
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
