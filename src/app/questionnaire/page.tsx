'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Target, Dumbbell, Heart, Camera, Activity,
  ArrowRight, ArrowLeft, Check, Loader2, Info, Zap, Shield
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  upsertQuestionnaire,
  uploadQuestionnairePhoto,
  isQuestionnaireCompleted,
  type QuestionnaireFormData,
} from '@/lib/services/questionnaire'

// ──────────────────────────────────────────────────────────────────────────
// Шаги
// ──────────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: 'Основные данные', icon: User },
  { id: 2, title: 'Цель и опыт', icon: Target },
  { id: 3, title: 'Условия', icon: Dumbbell },
  { id: 4, title: 'Здоровье', icon: Heart },
  { id: 5, title: 'Образ жизни', icon: Activity },
  { id: 6, title: 'Замеры и фото', icon: Camera },
]

// ──────────────────────────────────────────────────────────────────────────
// Вспомогательные компоненты
// ──────────────────────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-2xl font-display font-bold text-white mb-6">{title}</h2>
}

function Field({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
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
          <label key={opt.value} className={`flex items-start gap-3 cursor-pointer px-4 py-3 rounded-xl transition-all border ${
            selected ? 'bg-accent/20 border-accent/50' : 'bg-bg-elevated border-transparent hover:border-border'
          }`}>
            <input type="radio" checked={selected} onChange={() => onChange(opt.value)}
              className="w-4 h-4 mt-0.5 accent-accent flex-shrink-0" />
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

function CheckGroup({ values, onChange, options }: {
  values: string[]
  onChange: (v: string[]) => void
  options: Array<{ value: string; label: string; desc?: string }>
}) {
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {options.map(opt => {
        const selected = values.includes(opt.value)
        return (
          <label key={opt.value} className={`flex items-start gap-3 cursor-pointer px-4 py-3 rounded-xl transition-all border ${
            selected ? 'bg-accent/20 border-accent/50' : 'bg-bg-elevated border-transparent hover:border-border'
          }`}>
            <input type="checkbox" checked={selected} onChange={() => toggle(opt.value)}
              className="w-4 h-4 mt-0.5 accent-accent flex-shrink-0" />
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

// ──────────────────────────────────────────────────────────────────────────
// Главный компонент
// ──────────────────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState<Partial<QuestionnaireFormData>>({
    preferred_training_days: 3,
    previous_training_types: [],
    injury_zones: [],
    chronic_conditions: [],
    supplements: [],
    has_injuries: false,
    goal_motivation: 7,
  })

  const [photoFront, setPhotoFront] = useState<File | null>(null)
  const [photoSide, setPhotoSide] = useState<File | null>(null)
  const [photoBack, setPhotoBack] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
    if (!authLoading && !user) router.replace('/auth')
  }, [user, authLoading, router])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
    if (!user) return
    const check = async () => {
      const done = await isQuestionnaireCompleted()
      if (done) {
        try {
          const { isNutritionQuestionnaireRequired, isNutritionQuestionnaireCompleted } =
            await import('@/lib/services/nutrition')
          const needsNutrition = await isNutritionQuestionnaireRequired()
          if (needsNutrition) {
            const nutritionDone = await isNutritionQuestionnaireCompleted()
            if (!nutritionDone) { router.replace('/questionnaire/nutrition'); return }
          }
        } catch {}
        router.replace('/dashboard')
      }
    }
    check()
  }, [user, router])

  const upd = (field: keyof QuestionnaireFormData, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const handlePhotoUpload = async (file: File, type: 'front' | 'side' | 'back') => {
    setPhotoUploading(p => ({ ...p, [type]: true }))
    try {
      const compressed = await compressImage(file, 1200, 0.8)
      const url = await uploadQuestionnairePhoto(compressed, type)
      upd(`photo_${type}` as keyof QuestionnaireFormData, url)
    } catch (e: any) {
      console.error('Photo upload error:', e)
      setError('Ошибка загрузки фото: ' + (e?.message || 'Попробуйте другой файл.'))
    } finally {
      // Всегда снимаем спиннер — даже если compressImage завис или uploadQuestionnairePhoto упал
      setPhotoUploading(p => ({ ...p, [type]: false }))
    }
  }

  const compressImage = (file: File, maxSize: number, quality: number): Promise<File> =>
    new Promise((resolve, reject) => {
      // Таймаут 15 сек — если img.onload не сработал, не висим вечно
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
        console.warn('compressImage timeout, using original file')
        resolve(file)
      }, 15_000)

      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        clearTimeout(timeout)
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
      img.onerror = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Не удалось прочитать изображение'))
      }
      img.src = objectUrl
    })

  const handleNext = () => { setError(''); setCurrentStep(s => Math.min(s + 1, STEPS.length)) }
  const handleBack = () => { setError(''); setCurrentStep(s => Math.max(s - 1, 1)) }

  const handleSubmit = async () => {
    setError('')
    if (!formData.age || !formData.gender || !formData.height_cm || !formData.weight_kg) {
      setError('Заполните возраст, пол, рост и вес')
      return
    }
    if (!formData.goal) { setError('Укажите главную цель'); return }
    if (!formData.training_location) { setError('Укажите место тренировок'); return }

    // Не даём сохранить пока фото ещё загружаются
    if (Object.values(photoUploading).some(Boolean)) {
      setError('Подождите, фото ещё загружаются...')
      return
    }

    setIsSubmitting(true)
    try {
      // Таймаут 20 сек на сохранение анкеты
      await Promise.race([
        upsertQuestionnaire(formData as QuestionnaireFormData),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Превышено время ожидания сохранения (20 сек). Проверьте соединение.')), 20_000)
        ),
      ])

      // Сохранили — сразу на dashboard. Если нужна анкета по питанию, dashboard
      // сам покажет баннер и предложит её заполнить. Не блокируем переход
      // дополнительными сетевыми проверками — это создавало впечатление,
      // что после "Завершить" страница зависла.
      router.push('/dashboard')
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения анкеты')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!authLoading && !user) {
    return <div className="min-h-screen bg-bg-main flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
    </div>
  }

  const progress = (currentStep / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-bg-main p-4 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/20 mb-3">
            <Dumbbell className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Анкета клиента</h1>
          <p className="text-text-secondary">Заполните информацию для составления индивидуальной программы</p>
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
          {/* Step icons */}
          <div className="flex justify-between mt-3">
            {STEPS.map(step => {
              const Icon = step.icon
              const done = currentStep > step.id
              const active = currentStep === step.id
              return (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    done ? 'bg-accent text-bg-main' : active ? 'bg-accent text-bg-main shadow-glow-accent' : 'bg-bg-elevated text-text-muted'
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs hidden md:block ${active ? 'text-white font-semibold' : 'text-text-muted'}`}>
                    {step.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="glass-card p-6 md:p-8 mb-6">
          {currentStep === 1 && <Step1 data={formData} upd={upd} />}
          {currentStep === 2 && <Step2 data={formData} upd={upd} />}
          {currentStep === 3 && <Step3 data={formData} upd={upd} />}
          {currentStep === 4 && <Step4 data={formData} upd={upd} />}
          {currentStep === 5 && <Step5 data={formData} upd={upd} />}
          {currentStep === 6 && (
            <Step6
              data={formData} upd={upd}
              photoFront={photoFront} setPhotoFront={setPhotoFront}
              photoSide={photoSide} setPhotoSide={setPhotoSide}
              photoBack={photoBack} setPhotoBack={setPhotoBack}
              photoUploading={photoUploading}
              onPhotoUpload={handlePhotoUpload}
            />
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
          {currentStep > 1 ? (
            <button onClick={handleBack} className="glass-button-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />Назад
            </button>
          ) : <div />}

          {currentStep < STEPS.length ? (
            <button onClick={handleNext} className="glass-button flex items-center gap-2 ml-auto">
              Далее<ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.values(photoUploading).some(Boolean)}
              className="glass-button flex items-center gap-2 ml-auto"
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Сохранение...</>
                : Object.values(photoUploading).some(Boolean)
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Загрузка фото...</>
                  : <><Check className="w-4 h-4" />Завершить</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ШАГ 1: Основные данные
// ──────────────────────────────────────────────────────────────────────────
function Step1({ data, upd }: { data: Partial<QuestionnaireFormData>; upd: (f: any, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Основные данные" />

      <Field label="Имя" hint="Как к вам обращаться">
        <input type="text" value={data.full_name ?? ''} onChange={e => upd('full_name', e.target.value)}
          className="glass-input w-full" placeholder="Иван" />
      </Field>

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Возраст" required>
          <input type="number" value={data.age ?? ''} onChange={e => upd('age', parseInt(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="28" min="14" max="80" />
        </Field>
        <Field label="Пол" required>
          <select value={data.gender ?? ''} onChange={e => upd('gender', e.target.value || undefined)}
            className="glass-input w-full">
            <option value="">Выберите</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </Field>
        <Field label="Вес (кг)" required>
          <input type="number" step="0.1" value={data.weight_kg ?? ''} onChange={e => upd('weight_kg', parseFloat(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="75" />
        </Field>
        <Field label="Рост (см)" required>
          <input type="number" value={data.height_cm ?? ''} onChange={e => upd('height_cm', parseInt(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="178" />
        </Field>
      </div>

      {data.gender === 'female' && (
        <Field label="Менструальный цикл" hint="Помогает учесть гормональные особенности при составлении программы">
          <RadioGroup
            value={data.female_cycle}
            onChange={v => upd('female_cycle', v)}
            options={[
              { value: 'regular', label: 'Регулярный цикл' },
              { value: 'hormonal', label: 'Принимаю гормональные контрацептивы' },
              { value: 'irregular', label: 'Нерегулярный или отсутствует' },
              { value: 'menopause', label: 'Менопауза / перименопауза' },
            ]}
          />
        </Field>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ШАГ 2: Цель и опыт
// ──────────────────────────────────────────────────────────────────────────
function Step2({ data, upd }: { data: Partial<QuestionnaireFormData>; upd: (f: any, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Цель и тренировочный опыт" />

      <Field label="Главная цель на ближайшие 3–6 месяцев" required>
        <RadioGroup
          value={data.goal as any}
          onChange={v => upd('goal', v)}
          options={[
            { value: 'muscle_gain', label: 'Набор мышечной массы' },
            { value: 'fat_loss', label: 'Похудение / снижение % жира' },
            { value: 'strength', label: 'Развитие силы' },
            { value: 'general_fitness', label: 'Улучшение общей физической формы' },
            { value: 'competition', label: 'Подготовка к соревнованиям' },
            { value: 'rehabilitation', label: 'Реабилитация и восстановление' },
          ]}
        />
      </Field>

      <Field label="Дата или событие к которому нужен результат" hint="Если есть конкретный срок">
        <input type="text" value={data.goal_deadline ?? ''} onChange={e => upd('goal_deadline', e.target.value)}
          className="glass-input w-full" placeholder="Например: лето 2026, свадьба в июне" />
      </Field>

      <Field label={`Насколько важен результат прямо сейчас: ${data.goal_motivation ?? 7}/10`}>
        <input type="range" min="1" max="10" value={data.goal_motivation ?? 7}
          onChange={e => upd('goal_motivation', parseInt(e.target.value))}
          className="w-full mt-1" />
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span>Не очень важно</span><span>Очень важно</span>
        </div>
      </Field>

      <div className="border-t border-border pt-6">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Тренировочный опыт</p>
      </div>

      <Field label="Как давно тренируешься регулярно" required>
        <RadioGroup
          value={data.training_experience as any}
          onChange={v => upd('training_experience', v)}
          options={[
            { value: 'none', label: 'Никогда не тренировался(ась)', desc: 'Или перерыв больше года' },
            { value: 'under_1', label: 'До 1 года' },
            { value: '1_3', label: '1–3 года' },
            { value: 'over_3', label: 'Более 3 лет' },
          ]}
        />
      </Field>

      <Field label="Текущий уровень подготовки">
        <RadioGroup
          value={data.fitness_level as any}
          onChange={v => upd('fitness_level', v)}
          options={[
            { value: 'beginner', label: 'Новичок', desc: 'Базовые упражнения даются с трудом' },
            { value: 'intermediate', label: 'Средний', desc: 'Уверенно выполняю базовые упражнения' },
            { value: 'advanced', label: 'Продвинутый', desc: 'Работаю с тяжёлыми весами, хорошая техника' },
          ]}
        />
      </Field>

      <Field label="Какие виды тренировок делал(а) раньше" hint="Можно выбрать несколько">
        <CheckGroup
          values={data.previous_training_types ?? []}
          onChange={v => upd('previous_training_types', v)}
          options={[
            { value: 'weights', label: 'Силовые', desc: 'Штанги, гантели' },
            { value: 'machines', label: 'Тренажёры' },
            { value: 'crossfit', label: 'Кроссфит / функциональный тренинг' },
            { value: 'cardio', label: 'Кардио', desc: 'Бег, велосипед, плавание' },
            { value: 'martial_arts', label: 'Единоборства / командный спорт' },
            { value: 'none', label: 'Ничего из перечисленного' },
          ]}
        />
      </Field>

      <Field label="Были ли длительные перерывы за последний год">
        <RadioGroup
          value={data.training_breaks as any}
          onChange={v => upd('training_breaks', v)}
          options={[
            { value: 'none', label: 'Нет, тренировался(ась) стабильно' },
            { value: '1_3', label: 'Да, перерыв 1–3 месяца' },
            { value: 'over_3', label: 'Да, перерыв более 3 месяцев' },
          ]}
        />
      </Field>

      <Field label="Если тренировался(ась) по программе — по какой и что не устраивало?" hint="Необязательно">
        <textarea value={data.previous_program ?? ''} onChange={e => upd('previous_program', e.target.value)}
          className="glass-input w-full h-20 resize-none"
          placeholder="Например: программа 5x5, не устраивало отсутствие кардио..." />
      </Field>

      <div className="border-t border-border pt-6">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Текущие показатели силы</p>
        <p className="text-sm text-text-muted mb-4">Заполни если знаешь — пропусти если нет. Рабочий вес на 5–8 повторений.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Присед со штангой (кг)">
          <input type="number" value={data.strength_squat ?? ''} onChange={e => upd('strength_squat', parseFloat(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="60" />
        </Field>
        <Field label="Жим штанги лёжа (кг)">
          <input type="number" value={data.strength_bench ?? ''} onChange={e => upd('strength_bench', parseFloat(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="50" />
        </Field>
        <Field label="Становая / румынская тяга (кг)">
          <input type="number" value={data.strength_deadlift ?? ''} onChange={e => upd('strength_deadlift', parseFloat(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="80" />
        </Field>
        <Field label="Подтягивания (раз без веса)">
          <input type="number" value={data.strength_pullups ?? ''} onChange={e => upd('strength_pullups', parseInt(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="8" />
        </Field>
        <Field label="Отжимания от пола (раз)">
          <input type="number" value={data.strength_pushups ?? ''} onChange={e => upd('strength_pushups', parseInt(e.target.value) || undefined)}
            className="glass-input w-full" placeholder="20" />
        </Field>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ШАГ 3: Условия тренировок
// ──────────────────────────────────────────────────────────────────────────
function Step3({ data, upd }: { data: Partial<QuestionnaireFormData>; upd: (f: any, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Условия тренировок" />

      <Field label="Где будешь тренироваться" required>
        <RadioGroup
          value={data.training_location as any}
          onChange={v => upd('training_location', v)}
          options={[
            { value: 'gym', label: 'Тренажёрный зал', desc: 'Полное оборудование' },
            { value: 'home_equipment', label: 'Дома с оборудованием', desc: 'Гантели, турник, скамья' },
            { value: 'home_bodyweight', label: 'Дома без оборудования', desc: 'Только вес тела' },
            { value: 'mixed', label: 'Смешанно', desc: 'Зал и дома' },
          ]}
        />
      </Field>

      {(data.training_location === 'home_equipment' || data.training_location === 'mixed') && (
        <Field label="Какое оборудование есть дома?" hint="Гантели, штанга, турник, петли TRX, резинки и т.д.">
          <input type="text" value={data.home_equipment ?? ''} onChange={e => upd('home_equipment', e.target.value)}
            className="glass-input w-full" placeholder="Гантели до 30 кг, турник, резинки" />
        </Field>
      )}

      <Field label={`Сколько дней в неделю готов(а) тренироваться: ${data.preferred_training_days ?? 3} дня`}>
        <div className="grid grid-cols-5 gap-2 mt-1">
          {[2, 3, 4, 5, 6].map(d => (
            <button key={d} type="button"
              onClick={() => upd('preferred_training_days', d)}
              className={`py-3 rounded-xl font-display font-bold text-lg transition-all ${
                data.preferred_training_days === d
                  ? 'bg-accent text-bg-main shadow-glow-accent'
                  : 'bg-bg-elevated text-text-secondary hover:border-border border border-transparent'
              }`}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-2 px-1">
          <span>2 дня</span><span>6 дней</span>
        </div>
      </Field>

      <Field label="Сколько времени на одну тренировку">
        <RadioGroup
          value={data.session_duration as any}
          onChange={v => upd('session_duration', v)}
          options={[
            { value: 'under_45', label: 'До 45 минут' },
            { value: '45_60', label: '45–60 минут' },
            { value: '60_90', label: '60–90 минут' },
            { value: 'over_90', label: 'Более 90 минут' },
          ]}
        />
      </Field>

      <Field label="В какое время суток обычно тренируешься">
        <RadioGroup
          value={data.training_time as any}
          onChange={v => upd('training_time', v)}
          options={[
            { value: 'morning', label: 'Утро', desc: '6:00–10:00' },
            { value: 'day', label: 'День', desc: '10:00–16:00' },
            { value: 'evening', label: 'Вечер', desc: '16:00–21:00' },
            { value: 'varies', label: 'По-разному' },
          ]}
        />
      </Field>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ШАГ 4: Здоровье и ограничения
// ──────────────────────────────────────────────────────────────────────────
function Step4({ data, upd }: { data: Partial<QuestionnaireFormData>; upd: (f: any, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Здоровье и ограничения" />

      <Field label="Есть ли травмы или боли которые влияют на тренировки прямо сейчас">
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: false, label: 'Нет, всё в порядке' },
            { value: true, label: 'Да, есть' },
          ].map(opt => {
            const selected = data.has_injuries === opt.value
            return (
              <label key={String(opt.value)} className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl transition-all border ${
                selected ? 'bg-accent/20 border-accent/50' : 'bg-bg-elevated border-transparent hover:border-border'
              }`}>
                <input type="radio" checked={selected} onChange={() => upd('has_injuries', opt.value)}
                  className="w-4 h-4 accent-accent" />
                <span className={`text-sm font-medium ${selected ? 'text-accent' : 'text-white'}`}>{opt.label}</span>
              </label>
            )
          })}
        </div>
      </Field>

      {data.has_injuries && (
        <>
          <Field label="Укажи зоны" hint="Можно выбрать несколько">
            <CheckGroup
              values={data.injury_zones ?? []}
              onChange={v => upd('injury_zones', v)}
              options={[
                { value: 'lower_back', label: 'Поясница' },
                { value: 'knees', label: 'Колени' },
                { value: 'shoulders', label: 'Плечи' },
                { value: 'neck', label: 'Шея' },
                { value: 'elbows', label: 'Локти / запястья' },
                { value: 'hips', label: 'Тазобедренный сустав' },
              ]}
            />
            <textarea value={data.injuries ?? ''} onChange={e => upd('injuries', e.target.value)}
              className="glass-input w-full h-16 resize-none mt-2"
              placeholder="Другое — опиши подробнее..." />
          </Field>

          <Field label="Как травма влияет на тренировки">
            <RadioGroup
              value={data.injury_impact as any}
              onChange={v => upd('injury_impact', v)}
              options={[
                { value: 'mild', label: 'Лёгкий дискомфорт', desc: 'Могу тренироваться' },
                { value: 'avoid', label: 'Избегаю определённых упражнений' },
                { value: 'severe', label: 'Серьёзно ограничивает тренировки' },
              ]}
            />
          </Field>
        </>
      )}

      <Field label="Были ли операции на суставах или позвоночнике?" hint="Если да — на чём и когда">
        <input type="text" value={data.surgeries ?? ''} onChange={e => upd('surgeries', e.target.value)}
          className="glass-input w-full" placeholder="Нет / Артроскопия колена 2022" />
      </Field>

      <Field label="Хронические заболевания" hint="Можно выбрать несколько">
        <CheckGroup
          values={data.chronic_conditions ?? []}
          onChange={v => upd('chronic_conditions', v)}
          options={[
            { value: 'cardiovascular', label: 'Сердечно-сосудистые заболевания' },
            { value: 'diabetes', label: 'Диабет / нарушение обмена веществ' },
            { value: 'hypertension', label: 'Гипертония' },
            { value: 'spine', label: 'Проблемы с позвоночником', desc: 'Грыжа, сколиоз' },
            { value: 'none', label: 'Нет ничего из перечисленного' },
          ]}
        />
      </Field>

      <Field label="Принимаешь ли препараты которые влияют на тренировки или восстановление?" hint="Если да — какие">
        <input type="text" value={data.medications ?? ''} onChange={e => upd('medications', e.target.value)}
          className="glass-input w-full" placeholder="Нет / перечисли препараты" />
      </Field>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ШАГ 5: Образ жизни и дополнительно
// ──────────────────────────────────────────────────────────────────────────
function Step5({ data, upd }: { data: Partial<QuestionnaireFormData>; upd: (f: any, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Образ жизни" />

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Сколько часов в среднем спишь">
          <RadioGroup
            value={data.sleep_hours_avg?.toString() as any}
            onChange={v => upd('sleep_hours_avg', parseFloat(v))}
            options={[
              { value: '5', label: 'Менее 6 часов' },
              { value: '6.5', label: '6–7 часов' },
              { value: '7.5', label: '7–8 часов' },
              { value: '9', label: 'Более 8 часов' },
            ]}
          />
        </Field>

        <Field label="Качество сна">
          <RadioGroup
            value={data.sleep_quality as any}
            onChange={v => upd('sleep_quality', v)}
            options={[
              { value: 'good', label: 'Засыпаю легко, сплю хорошо' },
              { value: 'hard_to_fall', label: 'Бывают проблемы с засыпанием' },
              { value: 'wake_up', label: 'Часто просыпаюсь ночью' },
              { value: 'bad', label: 'Сон плохой регулярно' },
            ]}
          />
        </Field>
      </div>

      <Field label="Уровень стресса в жизни прямо сейчас">
        <RadioGroup
          value={data.stress_level?.toString() as any}
          onChange={v => upd('stress_level', parseInt(v))}
          options={[
            { value: '2', label: 'Низкий', desc: 'Всё спокойно' },
            { value: '5', label: 'Средний', desc: 'Бывает напряжённо' },
            { value: '8', label: 'Высокий', desc: 'Постоянный стресс' },
          ]}
        />
      </Field>

      <Field label="Тип основной работы или деятельности">
        <RadioGroup
          value={data.activity_level as any}
          onChange={v => upd('activity_level', v)}
          options={[
            { value: 'sedentary', label: 'Сидячая', desc: 'Офис, компьютер' },
            { value: 'mixed', label: 'Смешанная', desc: 'И сижу, и хожу' },
            { value: 'active', label: 'Активная', desc: 'На ногах весь день' },
            { value: 'physical', label: 'Физически тяжёлая' },
          ]}
        />
      </Field>

      <Field label="Принимаешь ли спортивное питание" hint="Можно выбрать несколько">
        <CheckGroup
          values={data.supplements ?? []}
          onChange={v => upd('supplements', v)}
          options={[
            { value: 'protein', label: 'Протеин' },
            { value: 'creatine', label: 'Креатин' },
            { value: 'vitamins', label: 'Витамины / омега-3' },
            { value: 'none', label: 'Ничего не принимаю' },
          ]}
        />
      </Field>

      <div className="border-t border-border pt-6">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Дополнительно</p>
      </div>

      <Field label="Как питаешься в целом">
        <RadioGroup
          value={data.nutrition_style as any}
          onChange={v => upd('nutrition_style', v)}
          options={[
            { value: 'healthy', label: 'Стараюсь питаться правильно' },
            { value: 'chaotic', label: 'Питаюсь хаотично' },
            { value: 'tracking', label: 'Слежу за калориями и белком' },
            { value: 'restricted', label: 'Есть ограничения', desc: 'Вегетарианство, аллергии' },
          ]}
        />
      </Field>

      <Field label="Есть ли что-то важное что не попало в вопросы выше?" hint="Свободный ответ — необязательно">
        <textarea value={data.additional_notes ?? ''} onChange={e => upd('additional_notes', e.target.value)}
          className="glass-input w-full h-24 resize-none"
          placeholder="Любая информация которая поможет тренеру составить программу..." />
      </Field>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// ШАГ 6: Замеры и фото
// ──────────────────────────────────────────────────────────────────────────
function Step6({ data, upd, photoFront, setPhotoFront, photoSide, setPhotoSide, photoBack, setPhotoBack, photoUploading, onPhotoUpload }: {
  data: Partial<QuestionnaireFormData>
  upd: (f: any, v: any) => void
  photoFront: File | null
  setPhotoFront: (f: File | null) => void
  photoSide: File | null
  setPhotoSide: (f: File | null) => void
  photoBack: File | null
  setPhotoBack: (f: File | null) => void
  photoUploading: Record<string, boolean>
  onPhotoUpload: (file: File, type: 'front' | 'side' | 'back') => Promise<void>
}) {
  const MEASUREMENTS = [
    {
      field: 'waist_cm' as const,
      label: 'Талия (см)',
      tip: 'На уровне пупка, в самом узком месте. Лента горизонтально, без натяжения. Утром натощак.',
    },
    {
      field: 'hips_cm' as const,
      label: 'Бёдра (см)',
      tip: 'В самом широком месте ягодиц. Ноги вместе, лента горизонтально.',
    },
    {
      field: 'chest_cm' as const,
      label: 'Грудь (см)',
      tip: 'Мужчины: по линии сосков. Женщины: под грудью по самому широкому месту.',
    },
    {
      field: 'arm_cm' as const,
      label: 'Рука (см)',
      tip: 'Бицепс в самом широком месте при согнутой руке под 90°. Мышца напряжена.',
    },
    {
      field: 'thigh_cm' as const,
      label: 'Бедро (см)',
      tip: 'В самом широком месте бедра, ~10–15 см ниже паховой складки.',
    },
  ]

  const PHOTOS: Array<{ type: 'front' | 'side' | 'back'; label: string; desc: string; file: File | null; setFile: (f: File | null) => void }> = [
    { type: 'front', label: 'Спереди', desc: 'Лицом к камере, руки вдоль тела', file: photoFront, setFile: setPhotoFront },
    { type: 'side', label: 'Сбоку', desc: 'Боком к камере, руки вдоль тела', file: photoSide, setFile: setPhotoSide },
    { type: 'back', label: 'Сзади', desc: 'Спиной к камере, руки вдоль тела', file: photoBack, setFile: setPhotoBack },
  ]

  return (
    <div className="space-y-6">
      <SectionTitle title="Начальные замеры и фото" />

      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 text-sm text-text-secondary">
        <p className="font-semibold text-white mb-1">Этот шаг необязательный</p>
        <p>Замеры и фото помогают отслеживать прогресс. Можно заполнить позже в разделе «Метрики».</p>
      </div>

      {/* Замеры */}
      <div>
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Замеры</p>
        <div className="grid md:grid-cols-2 gap-4">
          {MEASUREMENTS.map(({ field, label, tip }) => (
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
              <input type="number" step="0.1"
                value={(data[field] as number) ?? ''}
                onChange={e => upd(field, parseFloat(e.target.value) || undefined)}
                className="glass-input w-full" placeholder="0.0" />
            </div>
          ))}
        </div>
      </div>

      {/* Фото */}
      <div>
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Стартовые фото</p>
        <div className="grid grid-cols-3 gap-3">
          {PHOTOS.map(({ type, label, desc, file, setFile }) => {
            const uploaded = !!(data[`photo_${type}` as keyof QuestionnaireFormData])
            const uploading = photoUploading[type]
            return (
              <label key={type} className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all min-h-[120px] ${
                uploaded ? 'border-accent/50 bg-accent/10' : 'border-border hover:border-accent/40 bg-bg-elevated'
              }`}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setFile(f)
                    await onPhotoUpload(f, type)
                  }} />
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                ) : uploaded ? (
                  <Check className="w-6 h-6 text-accent" />
                ) : (
                  <Camera className="w-6 h-6 text-text-muted" />
                )}
                <p className={`text-sm font-semibold ${uploaded ? 'text-accent' : 'text-white'}`}>{label}</p>
                <p className="text-xs text-text-muted text-center">{uploaded ? 'Загружено ✓' : desc}</p>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
