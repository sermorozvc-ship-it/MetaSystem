'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Apple, Target, Activity, Utensils, Ban, Clock,
  AlertTriangle, HeartPulse, Pill, ClipboardList,
  ArrowLeft, ArrowRight, Check, Loader2
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  upsertNutritionQuestionnaire,
  getMyNutritionQuestionnaire,
  isNutritionQuestionnaireRequired,
  type NutritionAnswers,
} from '@/lib/services/nutrition'
import { getMyQuestionnaire } from '@/lib/services/questionnaire'

const STEPS = [
  { id: 1, title: 'Основные данные', icon: Target },
  { id: 2, title: 'Активность', icon: Activity },
  { id: 3, title: 'Текущее питание', icon: Utensils },
  { id: 4, title: 'Ограничения', icon: Ban },
  { id: 5, title: 'Условия', icon: Clock },
  { id: 6, title: 'Сложности', icon: AlertTriangle },
  { id: 7, title: 'Здоровье', icon: HeartPulse },
  { id: 8, title: 'Спортпит', icon: Pill },
  { id: 9, title: 'Ожидания', icon: ClipboardList },
]

export default function NutritionQuestionnairePage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [formData, setFormData] = useState<NutritionAnswers>({})

  // Проверка: авторизация + доступ к анкете
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth')
      return
    }
    const run = async () => {
      try {
        // Таймаут 10 сек на проверку доступа
        const allowed = await Promise.race([
          isNutritionQuestionnaireRequired(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
        ])
        if (!allowed) {
          router.replace('/dashboard')
          return
        }
        // Если уже заполнена — предзаполняем
        const existing = await getMyNutritionQuestionnaire()
        if (existing?.answers) {
          setFormData(existing.answers)
        } else {
          // Анкета питания ещё не заполнена — берём базовые данные из анкеты тренировок
          try {
            const trainingQ = await getMyQuestionnaire()
            if (trainingQ) {
              setFormData(prev => ({
                ...prev,
                current_weight_kg: trainingQ.weight_kg ?? prev.current_weight_kg,
                height_cm: trainingQ.height_cm ?? prev.height_cm,
                age: trainingQ.age ?? prev.age,
                gender: trainingQ.gender ?? prev.gender,
              }))
            }
          } catch {}
        }
      } finally {
        setChecking(false)
      }
    }
    run()
  }, [user, authLoading, router])

  const update = <K extends keyof NutritionAnswers>(field: K, value: NutritionAnswers[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleTrigger = (t: NonNullable<NutritionAnswers['binge_triggers']>[number]) => {
    const cur = formData.binge_triggers || []
    update('binge_triggers', cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t])
  }

  const handleNext = () => {
    setError('')
    // Мягкая валидация Шага 1
    if (currentStep === 1) {
      if (!formData.current_weight_kg || !formData.height_cm || !formData.age || !formData.gender) {
        setError('Заполните вес, рост, возраст и пол')
        return
      }
      if (!formData.nutrition_goal) {
        setError('Выберите цель по питанию')
        return
      }
    }
    if (currentStep < STEPS.length) setCurrentStep(s => s + 1)
  }

  const handleBack = () => {
    setError('')
    if (currentStep > 1) setCurrentStep(s => s - 1)
  }

  const handleSubmit = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      await Promise.race([
        upsertNutritionQuestionnaire(formData),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Превышено время ожидания сохранения (20 сек). Проверьте соединение.')), 20_000)
        ),
      ])
      router.push('/dashboard')
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения анкеты')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || checking) {
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/20 mb-3">
            <Apple className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Анкета по питанию</h1>
          <p className="text-text-secondary">
            Ответы помогут составить индивидуальный план питания под ваши цели и образ жизни
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-3 text-xs text-text-muted">
            <span>Шаг {currentStep} из {STEPS.length}</span>
            <span>{STEPS[currentStep - 1].title}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Content */}
        <div className="glass-card p-6 md:p-8 mb-6">
          {currentStep === 1 && <Step1 data={formData} update={update} />}
          {currentStep === 2 && <Step2 data={formData} update={update} />}
          {currentStep === 3 && <Step3 data={formData} update={update} />}
          {currentStep === 4 && <Step4 data={formData} update={update} />}
          {currentStep === 5 && <Step5 data={formData} update={update} />}
          {currentStep === 6 && <Step6 data={formData} update={update} toggleTrigger={toggleTrigger} />}
          {currentStep === 7 && <Step7 data={formData} update={update} />}
          {currentStep === 8 && <Step8 data={formData} update={update} />}
          {currentStep === 9 && <Step9 data={formData} update={update} />}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-danger/10 border border-danger/30">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-4">
          {currentStep > 1 ? (
            <button onClick={handleBack} className="glass-button-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>
          ) : <div />}

          {currentStep < STEPS.length ? (
            <button onClick={handleNext} className="glass-button flex items-center gap-2 ml-auto">
              Далее
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="glass-button flex items-center gap-2 ml-auto"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Сохранение...</>
              ) : (
                <><Check className="w-4 h-4" />Завершить</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Вспомогательные компоненты
// ────────────────────────────────────────────────────────────────────────

type Upd = <K extends keyof NutritionAnswers>(field: K, value: NutritionAnswers[K]) => void

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  )
}

function RadioGroup<T extends string>({ value, onChange, options }: {
  value: T | undefined
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; desc?: string }>
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <label
            key={opt.value}
            className={`flex items-start gap-3 cursor-pointer px-4 py-3 rounded-xl transition-all border ${
              selected ? 'bg-accent/20 border-accent/50' : 'bg-bg-elevated border-transparent hover:border-border'
            }`}
          >
            <input
              type="radio"
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="w-4 h-4 mt-0.5 accent-accent flex-shrink-0"
            />
            <div>
              <p className={`text-sm font-medium ${selected ? 'text-accent' : 'text-white'}`}>{opt.label}</p>
              {opt.desc && <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>}
            </div>
          </label>
        )
      })}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-2xl font-display font-bold text-white mb-6">{title}</h2>
}

// ────────────────────────────────────────────────────────────────────────
// Шаги
// ────────────────────────────────────────────────────────────────────────

function Step1({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Основные данные и цель" />

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Вес сейчас (кг) *">
          <input
            type="number" step="0.1"
            value={data.current_weight_kg ?? ''}
            onChange={e => update('current_weight_kg', e.target.value ? parseFloat(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="70"
          />
        </Field>
        <Field label="Рост (см) *">
          <input
            type="number"
            value={data.height_cm ?? ''}
            onChange={e => update('height_cm', e.target.value ? parseInt(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="175"
          />
        </Field>
        <Field label="Возраст *">
          <input
            type="number"
            value={data.age ?? ''}
            onChange={e => update('age', e.target.value ? parseInt(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="28"
          />
        </Field>
        <Field label="Пол *">
          <select
            value={data.gender ?? ''}
            onChange={e => update('gender', e.target.value as 'male' | 'female' || undefined)}
            className="glass-input w-full"
          >
            <option value="">Выберите</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </Field>
      </div>

      <Field label="Цель по питанию *">
        <RadioGroup
          value={data.nutrition_goal}
          onChange={v => update('nutrition_goal', v)}
          options={[
            { value: 'cut_keep_muscle', label: 'Снизить жир', desc: 'При сохранении мышц' },
            { value: 'bulk_lean', label: 'Набрать мышцы', desc: 'С минимальным жиром' },
            { value: 'recomp', label: 'Рекомпозиция', desc: 'Худеть и набирать одновременно' },
            { value: 'maintain', label: 'Поддержать вес', desc: 'Улучшить качество питания' },
          ]}
        />
      </Field>

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Желаемый вес или % жира" hint="Если есть конкретная цифра">
          <input
            type="text"
            value={data.target_weight ?? ''}
            onChange={e => update('target_weight', e.target.value)}
            className="glass-input w-full"
            placeholder="например: 65 кг или 15% жира"
          />
        </Field>
        <Field label="К какой дате" hint="Если есть срок">
          <input
            type="text"
            value={data.target_deadline ?? ''}
            onChange={e => update('target_deadline', e.target.value)}
            className="glass-input w-full"
            placeholder="например: к лету, 3 месяца"
          />
        </Field>
      </div>
    </div>
  )
}

function Step2({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Активность и образ жизни" />

      <Field label="Основная деятельность">
        <RadioGroup
          value={data.job_activity}
          onChange={v => update('job_activity', v)}
          options={[
            { value: 'sedentary', label: 'Сидячая', desc: 'Офис, за компьютером' },
            { value: 'mixed', label: 'Смешанная', desc: 'И сижу, и хожу' },
            { value: 'active', label: 'Активная', desc: 'На ногах весь день' },
            { value: 'physical', label: 'Физически тяжёлая', desc: 'Ручной труд, стройка' },
          ]}
        />
      </Field>

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Тренировок в неделю">
          <input
            type="number" min="0" max="14"
            value={data.workouts_per_week ?? ''}
            onChange={e => update('workouts_per_week', e.target.value ? parseInt(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="3"
          />
        </Field>
        <Field label="Длительность тренировки (мин)">
          <input
            type="number"
            value={data.workout_duration_min ?? ''}
            onChange={e => update('workout_duration_min', e.target.value ? parseInt(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="60"
          />
        </Field>
        <Field label="Тип тренировок">
          <input
            type="text"
            value={data.workout_type ?? ''}
            onChange={e => update('workout_type', e.target.value)}
            className="glass-input w-full"
            placeholder="силовые / кардио / смешанно"
          />
        </Field>
        <Field label="Шагов в день" hint="Если отслеживаешь">
          <input
            type="number"
            value={data.steps_per_day ?? ''}
            onChange={e => update('steps_per_day', e.target.value ? parseInt(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="8000"
          />
        </Field>
      </div>
    </div>
  )
}

function Step3({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Текущее питание" />

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Приёмов пищи в день">
          <input
            type="number" min="1" max="10"
            value={data.meals_per_day ?? ''}
            onChange={e => update('meals_per_day', e.target.value ? parseInt(e.target.value) : undefined)}
            className="glass-input w-full"
            placeholder="3"
          />
        </Field>
        <Field label="Завтракаешь?">
          <select
            value={data.breakfast_habit ?? ''}
            onChange={e => update('breakfast_habit', e.target.value as any || undefined)}
            className="glass-input w-full"
          >
            <option value="">Выберите</option>
            <option value="yes">Да, регулярно</option>
            <option value="sometimes">Иногда</option>
            <option value="no">Нет</option>
          </select>
        </Field>
        <Field label="Первый приём пищи (время)">
          <input
            type="text"
            value={data.first_meal_time ?? ''}
            onChange={e => update('first_meal_time', e.target.value)}
            className="glass-input w-full"
            placeholder="8:00"
          />
        </Field>
        <Field label="Последний приём пищи (время)">
          <input
            type="text"
            value={data.last_meal_time ?? ''}
            onChange={e => update('last_meal_time', e.target.value)}
            className="glass-input w-full"
            placeholder="21:00"
          />
        </Field>
      </div>

      <Field label="Как бы ты описал(а) своё питание сейчас">
        <RadioGroup
          value={data.current_diet_description}
          onChange={v => update('current_diet_description', v)}
          options={[
            { value: 'eat_anything', label: 'Ем всё подряд', desc: 'Не слежу' },
            { value: 'trying_healthy', label: 'Пытаюсь правильно', desc: 'Но без системы' },
            { value: 'tracks_calories', label: 'Слежу за калориями' },
            { value: 'tracks_calories_protein', label: 'Слежу за калориями и белком' },
            { value: 'other', label: 'Другое' },
          ]}
        />
      </Field>

      {data.current_diet_description === 'other' && (
        <Field label="Опиши своё питание">
          <textarea
            value={data.current_diet_other ?? ''}
            onChange={e => update('current_diet_other', e.target.value)}
            className="glass-input w-full h-20 resize-none"
            placeholder="Свободный ответ..."
          />
        </Field>
      )}

      <Field label="Считал(а) ли когда-нибудь КБЖУ?" hint="Если да — укажи, сколько ккал в день выходило">
        <input
          type="text"
          value={data.tracked_kcal_before ?? ''}
          onChange={e => update('tracked_kcal_before', e.target.value)}
          className="glass-input w-full"
          placeholder="например: да, ~1800 ккал"
        />
      </Field>

      <Field label="Примерный размер порции за приём">
        <RadioGroup
          value={data.portion_size}
          onChange={v => update('portion_size', v)}
          options={[
            { value: 'small', label: 'Маленькая', desc: 'Быстро насыщаюсь' },
            { value: 'medium', label: 'Средняя' },
            { value: 'large', label: 'Большая', desc: 'Ем много и не наедаюсь' },
          ]}
        />
      </Field>
    </div>
  )
}

function Step4({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Ограничения и предпочтения" />

      <Field label="Аллергии на продукты" hint="Если есть — укажи, на что именно">
        <textarea
          value={data.allergies ?? ''}
          onChange={e => update('allergies', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Например: орехи, морепродукты"
        />
      </Field>

      <Field label="Не ем принципиально" hint="Религия, этика, личное">
        <textarea
          value={data.excluded_by_principle ?? ''}
          onChange={e => update('excluded_by_principle', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Например: свинина"
        />
      </Field>

      <Field label="Продукты, которые не нравятся" hint="Не хочу видеть в плане">
        <textarea
          value={data.disliked_foods ?? ''}
          onChange={e => update('disliked_foods', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Например: творог, кабачки"
        />
      </Field>

      <Field label="Тип питания">
        <RadioGroup
          value={data.diet_type}
          onChange={v => update('diet_type', v)}
          options={[
            { value: 'omnivore', label: 'Ем всё' },
            { value: 'vegetarian', label: 'Вегетарианец', desc: 'Не ем мясо' },
            { value: 'pescatarian_no', label: 'Не ем мясо и рыбу' },
            { value: 'vegan', label: 'Веган', desc: 'Ничего животного' },
            { value: 'other', label: 'Другое' },
          ]}
        />
      </Field>

      {data.diet_type === 'other' && (
        <Field label="Опиши тип питания">
          <input
            type="text"
            value={data.diet_type_other ?? ''}
            onChange={e => update('diet_type_other', e.target.value)}
            className="glass-input w-full"
            placeholder="Свободный ответ"
          />
        </Field>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Непереносимость лактозы / глютена">
          <input
            type="text"
            value={data.lactose_gluten_intolerance ?? ''}
            onChange={e => update('lactose_gluten_intolerance', e.target.value)}
            className="glass-input w-full"
            placeholder="Нет / лактоза / глютен"
          />
        </Field>
        <Field label="Молочные продукты">
          <select
            value={data.dairy_attitude ?? ''}
            onChange={e => update('dairy_attitude', e.target.value as any || undefined)}
            className="glass-input w-full"
          >
            <option value="">Выберите</option>
            <option value="normal">Ем нормально</option>
            <option value="limited">Ограниченно</option>
            <option value="avoid">Избегаю</option>
          </select>
        </Field>
      </div>
    </div>
  )
}

function Step5({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Условия и реальность жизни" />

      <Field label="Готовишь сам(а) или берёшь готовое?">
        <RadioGroup
          value={data.cooking_mode}
          onChange={v => update('cooking_mode', v)}
          options={[
            { value: 'self_daily', label: 'Готовлю каждый день' },
            { value: 'self_partial', label: 'Несколько раз в неделю', desc: 'Остальное из готового' },
            { value: 'ready_food', label: 'Готовая еда', desc: 'Доставка, кафе' },
            { value: 'mixed', label: 'Смешанно' },
          ]}
        />
      </Field>

      <Field label="Сколько времени готов(а) тратить на готовку в день?">
        <RadioGroup
          value={data.cooking_time}
          onChange={v => update('cooking_time', v)}
          options={[
            { value: 'under_15', label: 'До 15 минут' },
            { value: '15_30', label: '15–30 минут' },
            { value: '30_60', label: '30–60 минут' },
            { value: 'no_limit', label: 'Время не ограничено' },
          ]}
        />
      </Field>

      <Field label="Можешь брать еду с собой на работу?">
        <select
          value={data.can_take_to_work ?? ''}
          onChange={e => update('can_take_to_work', e.target.value as any || undefined)}
          className="glass-input w-full"
        >
          <option value="">Выберите</option>
          <option value="yes">Да</option>
          <option value="sometimes">Иногда</option>
          <option value="no">Нет</option>
        </select>
      </Field>

      <Field label="Как питаешься в будни?" hint="Нормальный обед или на ходу">
        <textarea
          value={data.weekday_eating ?? ''}
          onChange={e => update('weekday_eating', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Например: завтрак дома, обед на работе, ужин дома"
        />
      </Field>

      <Field label="Как питаешься в выходные?" hint="Иначе чем в будни">
        <textarea
          value={data.weekend_eating ?? ''}
          onChange={e => update('weekend_eating', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Свободный ответ"
        />
      </Field>
    </div>
  )
}

function Step6({ data, update, toggleTrigger }: {
  data: NutritionAnswers
  update: Upd
  toggleTrigger: (t: NonNullable<NutritionAnswers['binge_triggers']>[number]) => void
}) {
  const triggers = data.binge_triggers || []
  const triggerList = [
    { value: 'stress' as const, label: 'Стресс' },
    { value: 'boredom' as const, label: 'Скука / усталость' },
    { value: 'social' as const, label: 'Компания' },
    { value: 'see_food' as const, label: 'Вижу еду — не могу остановиться' },
    { value: 'other' as const, label: 'Другое' },
  ]

  return (
    <div className="space-y-6">
      <SectionTitle title="Сложности и паттерны" />

      <Field label="Есть привычка есть поздно вечером?">
        <input
          type="text"
          value={data.late_evening_eating ?? ''}
          onChange={e => update('late_evening_eating', e.target.value)}
          className="glass-input w-full"
          placeholder="Да / нет / иногда"
        />
      </Field>

      <Field label="Срывы и переедания" hint="Как часто примерно">
        <input
          type="text"
          value={data.binges_frequency ?? ''}
          onChange={e => update('binges_frequency', e.target.value)}
          className="glass-input w-full"
          placeholder="Например: 1–2 раза в неделю"
        />
      </Field>

      <Field label="Что чаще всего провоцирует срыв?">
        <div className="grid sm:grid-cols-2 gap-2">
          {triggerList.map(t => {
            const selected = triggers.includes(t.value)
            return (
              <label
                key={t.value}
                className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl transition-all border ${
                  selected ? 'bg-accent/20 border-accent/50' : 'bg-bg-elevated border-transparent hover:border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleTrigger(t.value)}
                  className="w-4 h-4 accent-accent"
                />
                <span className={`text-sm font-medium ${selected ? 'text-accent' : 'text-white'}`}>{t.label}</span>
              </label>
            )
          })}
        </div>
      </Field>

      {triggers.includes('other') && (
        <Field label="Укажи другой триггер">
          <input
            type="text"
            value={data.binge_triggers_other ?? ''}
            onChange={e => update('binge_triggers_other', e.target.value)}
            className="glass-input w-full"
            placeholder="Свободный ответ"
          />
        </Field>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Тяга к сладкому" hint="Слабая / средняя / сильная">
          <input
            type="text"
            value={data.sweet_craving ?? ''}
            onChange={e => update('sweet_craving', e.target.value)}
            className="glass-input w-full"
            placeholder="например: сильная"
          />
        </Field>
        <Field label="Тяга к солёному / жирному">
          <input
            type="text"
            value={data.salty_fatty_craving ?? ''}
            onChange={e => update('salty_fatty_craving', e.target.value)}
            className="glass-input w-full"
            placeholder="например: средняя"
          />
        </Field>
      </div>

      <Field label="Алкоголь" hint="Как часто примерно">
        <input
          type="text"
          value={data.alcohol_frequency ?? ''}
          onChange={e => update('alcohol_frequency', e.target.value)}
          className="glass-input w-full"
          placeholder="например: 1 раз в неделю"
        />
      </Field>
    </div>
  )
}

function Step7({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Здоровье и медицина" />

      <Field label="Заболевания обмена веществ" hint="Диабет, инсулинорезистентность, гипотиреоз и т.д.">
        <textarea
          value={data.metabolic_conditions ?? ''}
          onChange={e => update('metabolic_conditions', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Нет / укажи диагноз"
        />
      </Field>

      <Field label="Проблемы с ЖКТ" hint="Гастрит, СРК, вздутие на определённые продукты">
        <textarea
          value={data.gi_issues ?? ''}
          onChange={e => update('gi_issues', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Нет / опиши"
        />
      </Field>

      <Field label="Препараты, влияющие на вес или аппетит">
        <textarea
          value={data.medications ?? ''}
          onChange={e => update('medications', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Нет / перечисли"
        />
      </Field>

      {data.gender === 'female' && (
        <Field label="Нарушения цикла / СПКЯ" hint="Только для женщин">
          <textarea
            value={data.female_cycle ?? ''}
            onChange={e => update('female_cycle', e.target.value)}
            className="glass-input w-full h-20 resize-none"
            placeholder="Нет / опиши"
          />
        </Field>
      )}
    </div>
  )
}

function Step8({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Спортивное питание" />

      <Field label="Текущие добавки" hint="Протеин, креатин, витамины, омега-3 и т.д.">
        <textarea
          value={data.current_supplements ?? ''}
          onChange={e => update('current_supplements', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Нет / перечисли"
        />
      </Field>

      <Field label="Готов(а) принимать протеин?" hint="Как дополнение к питанию, если не добираешь белок из еды">
        <select
          value={data.protein_ok ?? ''}
          onChange={e => update('protein_ok', e.target.value as any || undefined)}
          className="glass-input w-full"
        >
          <option value="">Выберите</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
          <option value="unsure">Не уверен</option>
        </select>
      </Field>
    </div>
  )
}

function Step9({ data, update }: { data: NutritionAnswers; update: Upd }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Ожидания от плана" />

      <Field label="Как удобнее получить план?">
        <RadioGroup
          value={data.plan_format}
          onChange={v => update('plan_format', v)}
          options={[
            { value: 'ready_menu', label: 'Готовое меню', desc: 'С блюдами и рецептами' },
            { value: 'flexible_template', label: 'Гибкий шаблон по КБЖУ', desc: 'Подставляю свои продукты' },
            { value: 'products_list', label: 'Список продуктов и порций', desc: 'Без привязки к блюдам' },
          ]}
        />
      </Field>

      <Field label="Сколько приёмов пищи в день комфортно?">
        <RadioGroup
          value={data.comfortable_meals_count}
          onChange={v => update('comfortable_meals_count', v)}
          options={[
            { value: '2_3', label: '2–3 раза', desc: 'Крупные порции' },
            { value: '4_5', label: '4–5 раз', desc: 'Средние порции' },
            { value: 'any', label: 'Не принципиально' },
          ]}
        />
      </Field>

      <Field label="Любимые продукты" hint="Которые хочешь обязательно включить в план">
        <textarea
          value={data.favorite_foods ?? ''}
          onChange={e => update('favorite_foods', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Например: курица, рис, яйца, бананы"
        />
      </Field>

      <Field label="Прошлый опыт диет" hint="Что пробовал(а), почему не зашло">
        <textarea
          value={data.past_diets_experience ?? ''}
          onChange={e => update('past_diets_experience', e.target.value)}
          className="glass-input w-full h-24 resize-none"
          placeholder="Свободный ответ"
        />
      </Field>
    </div>
  )
}
