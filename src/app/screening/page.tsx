'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity, Camera, ChevronDown, ChevronUp, Check, Loader2,
  AlertTriangle, Shield, Play, Link as LinkIcon, Video,
  ClipboardCheck, User, Calendar, Phone, ChevronRight,
  Info, CheckCircle2, AlertCircle
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { upsertScreening } from '@/lib/services/screening'
import { createClient } from '@/lib/supabase/client'

// ──────────────────────────────────────────────────────────────────────────
// Данные 7 тестов
// ──────────────────────────────────────────────────────────────────────────

interface Test {
  id: number
  title: string
  subtitle: string
  instruction: string[]
  filming: string
  filmingIcon: React.ReactNode
  interpretation: string[]
  placeholder: string
  videoUrl?: string
  vertical?: boolean
}

const TESTS: Test[] = [
  {
    id: 1,
    title: 'Глубокий присед с руками над головой',
    subtitle: 'Оцениваем работу всего тела сразу: голеностопы, колени, таз, спину и плечи.',
    instruction: [
      'Стопы на ширине плеч, носки вперёд.',
      'Прямые руки вверх над головой.',
      'Медленно присядь как можешь глубоко, пятки на полу.',
      'Медленно встань, 5 повторов.',
    ],
    filming: 'Два дубля, спереди и сбоку, телефон на уровне таза.',
    filmingIcon: <><Camera className="w-4 h-4" /> Спереди + Сбоку</>,
    interpretation: [
      'Если колени заваливаются внутрь, пятки отрываются или корпус сильно падает вперёд, это часто говорит о зажатости голеностопов и слабых ягодичных.',
      'Точный разбор и программу я составлю лично по вашему видео.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/3vpl5MeyOdQ',
    vertical: true,
  },
  {
    id: 2,
    title: 'Наклон вперёд к стопам',
    subtitle: 'Проверяем гибкость задней поверхности тела и подвижность спины.',
    instruction: [
      'Стопы вместе, колени прямые.',
      'Медленно наклоняйся вниз, тянись к пальцам стоп.',
      'Опустись максимум без боли, задержись 2 секунды.',
    ],
    filming: 'Сбоку (главный), дополнительно сзади.',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку + Сзади</>,
    interpretation: [
      'Если не дотягиваетесь до пальцев, приходится сгибать колени или спина остаётся жёсткой доской, вероятна зажатость задней поверхности бедра или ограничение подвижности поясницы.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/7jfonl3lIDE',
    vertical: true,
  },
  {
    id: 3,
    title: 'Тест Томаса (длина сгибателей бедра)',
    subtitle: 'Проверяем, не укорочены ли мышцы передней поверхности бедра (часто от сидячей работы).',
    instruction: [
      'Сядь на край кровати, ляг на спину, подтяни оба колена к груди.',
      'Удерживая одно колено руками, медленно опусти вторую ногу, полностью расслабь её.',
      'Замри 3 секунды, повтори другой ногой.',
    ],
    filming: 'Сбоку со стороны опускаемой ноги.',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку</>,
    interpretation: [
      'Если опущенное бедро не ложится вниз, голень уходит вперёд или бедро уезжает в сторону, это признаки укорочения мышц-сгибателей, которые тянут таз и перегружают поясницу.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/XBHh_ne1Hcg',
    vertical: true,
  },
  {
    id: 4,
    title: 'Стеновой ангел',
    subtitle: 'Проверяем подвижность плеч и грудного отдела (осанка).',
    instruction: [
      'Встань спиной к стене, прижми поясницу, верх спины и затылок.',
      'Руки в позе вратаря (буква W), прижаты к стене.',
      'Медленно скользи руками вверх в букву Y, не отрывая запястья. Поясница не выгибается.',
    ],
    filming: '',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку</>,
    interpretation: [
      'Если запястья отрываются от стены, поясница сильно выгибается или голова уходит вперёд, это частый признак сутулости и зажатых грудных мышц.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/TahARuKEvyI',
    vertical: true,
  },
  {
    id: 5,
    title: 'Подъём прямой ноги лёжа',
    subtitle: 'Проверяем подвижность бёдер и стабильность корпуса.',
    instruction: [
      'Ляг на спину, ноги прямые.',
      'Не сгибая колено, медленно подними одну ногу как можно выше.',
      'Вторая нога прижата к полу, таз не проворачивается. Повтори другой ногой.',
    ],
    filming: 'Сбоку, телефон на уровне пола.',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку</>,
    interpretation: [
      'Если нога поднимается невысоко, вторая нога отрывается или таз крутит, это говорит о зажатости задней поверхности или слабом контроле центра тела.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/qrHV5c0JYRk',
    vertical: true,
  },
  {
    id: 6,
    title: 'Приседание на одной ноге',
    subtitle: 'Проверяем баланс и стабильность каждой ноги отдельно.',
    instruction: [
      'Встань на одну ногу, руки на поясе.',
      'Медленно присядь насколько уверенно держишь равновесие.',
      '5 медленных повторов на каждую ногу.',
    ],
    filming: '',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку</>,
    interpretation: [
      'Если колено заваливается внутрь или таз проваливается в сторону, это признак слабых стабилизаторов таза.',
      'Часто заметна разница между правой и левой ногой.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/ftEXls6SmOU',
    vertical: true,
  },
  {
    id: 7,
    title: 'Поворот корпуса сидя',
    subtitle: 'Проверяем подвижность грудного отдела в повороте.',
    instruction: [
      'Сядь на край стула, колени вместе.',
      'Скрести руки на груди.',
      'Медленно повернись максимум вправо, потом влево, не двигая тазом.',
    ],
    filming: 'Сверху-спереди (телефон чуть выше головы).',
    filmingIcon: <><Camera className="w-4 h-4" /> Сверху-спереди</>,
    interpretation: [
      'Если в одну сторону поворот заметно меньше, чем в другую, или поворот идёт за счёт таза, это говорит о скованности грудного отдела.',
    ],
    placeholder: 'Вставьте ссылку на видео (YouTube, VK, файловый хостинг)',
    videoUrl: 'https://www.youtube.com/embed/skDUax0Kp54',
    vertical: true,
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Хук для scroll-reveal анимаций
// ──────────────────────────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// ──────────────────────────────────────────────────────────────────────────
// Анимированный контейнер
// ──────────────────────────────────────────────────────────────────────────

function RevealSection({ children, delay = 0, className = '' }: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, isVisible } = useScrollReveal()
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Главный компонент
// ──────────────────────────────────────────────────────────────────────────

export default function ScreeningPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set())
  const [completedTests, setCompletedTests] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [precheckItems, setPrecheckItems] = useState<Record<string, boolean>>({
    clothing: false,
    lighting: false,
    space: false,
    battery: false,
    warmup: false,
  })
  const [clientDate, setClientDate] = useState('')
  const [clientContact, setClientContact] = useState('')
  const [links, setLinks] = useState<Record<number, string>>({})

  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  // Auth check отключён для разработки. Включить перед продом:
  // useEffect(() => {
  //   if (process.env.NEXT_PUBLIC_DISABLE_REDIRECTS === 'true') return
  //   if (authLoading) return
  //   if (!user) {
  //     const t = setTimeout(() => {
  //       if (!userRef.current) router.replace('/auth')
  //     }, 3000)
  //     return () => clearTimeout(t)
  //   }
  // }, [user, authLoading, router])

  useEffect(() => {
    if (!clientDate) {
      setClientDate(new Date().toISOString().split('T')[0])
    }
  }, [])

  // Загрузка существующего скрининга
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const load = async () => {
      try {
        const { data } = await supabase
          .from('client_screenings')
          .select('client_date, client_contact, tests')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!data) return
        if (data.client_date) setClientDate(data.client_date)
        if (data.client_contact) setClientContact(data.client_contact)
        if (Array.isArray(data.tests)) {
          const newLinks: Record<number, string> = {}
          const newCompleted = new Set<number>()
          for (const t of data.tests) {
            if (t.video_url) {
              newLinks[t.id] = t.video_url
              newCompleted.add(t.id)
            }
          }
          setLinks(newLinks)
          setCompletedTests(newCompleted)
        }
      } catch {}
    }
    load()
  }, [user])

  const toggleTest = useCallback((id: number) => {
    setExpandedTests(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const updateLink = useCallback((testId: number, value: string) => {
    setLinks(prev => ({ ...prev, [testId]: value }))
    if (value.trim()) {
      setCompletedTests(prev => new Set(prev).add(testId))
    } else {
      setCompletedTests(prev => {
        const next = new Set(prev)
        next.delete(testId)
        return next
      })
    }
  }, [])

  const allLinksFilled = TESTS.every(t => links[t.id]?.trim())
  const filledCount = TESTS.filter(t => links[t.id]?.trim()).length
  const allPrechecked = Object.values(precheckItems).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allLinksFilled) {
      setError('Вставьте ссылки на все 7 видео')
      return
    }

    setIsSubmitting(true)

    try {
      await upsertScreening({
        client_date: clientDate,
        client_contact: clientContact.trim(),
        tests: TESTS.map(t => ({
          id: t.id,
          title: t.title,
          video_url: links[t.id]?.trim() || '',
        })),
      })
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setError(e?.message || 'Ошибка отправки. Попробуйте ещё раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Auth guard отключён для разработки. Включить перед продом:
  // if (!authLoading && !user) {
  //   return (
  //     <div className="min-h-screen bg-bg-main flex items-center justify-center">
  //       <Loader2 className="w-8 h-8 text-accent animate-spin" />
  //     </div>
  //   )
  // }

  if (success) {
    return (
      <div className="min-h-screen bg-bg-main p-4 py-12">
        <div className="max-w-2xl mx-auto text-center animate-fade-in">
          <div className="glass-card p-8 md:p-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-success/20 mb-6">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-3">
              Видео отправлены!
            </h1>
            <p className="text-text-secondary text-lg mb-2">
              Я просмотрю все 7 видео и составлю персональный разбор.
            </p>
            <p className="text-text-muted text-sm mb-8">
              Обратная связь в течение 48 часов в разделе «Сообщения».
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="glass-button inline-flex items-center gap-2"
            >
              Вернуться в кабинет
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main p-4 py-12">
      <div className="max-w-3xl mx-auto">

        {/* ═══════════════ ШАПКА ═══════════════ */}
        <RevealSection>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/15 mb-4 screening-icon-glow">
              <Activity className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-3 screening-title">
              Скрининг тела
            </h1>
            <p className="text-lg text-text-secondary mb-1">Домашняя диагностика движения</p>
            <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed mt-3">
              Семь простых тестов покажут, как работает ваше тело. Запишите видео по инструкции,
              вставьте ссылки, и я составлю персональный разбор с программой коррекции.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-5 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:text-white hover:border-accent/50 hover:bg-accent/10 transition-all"
            >
              Пропустить пока
            </button>
          </div>
        </RevealSection>

        {/* ═══════════════ КАРТОЧКА КЛИЕНТА ═══════════════ */}
        <RevealSection delay={100}>
          <div className="glass-card p-5 md:p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                <User className="w-4.5 h-4.5 text-accent" />
              </div>
              <h2 className="text-lg font-display font-semibold text-white">Ваши данные</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Дата съёмки
                </label>
                <input
                  type="date"
                  value={clientDate}
                  onChange={e => setClientDate(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Связь
                </label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={e => setClientContact(e.target.value)}
                  className="glass-input"
                  placeholder="Телефон или Telegram"
                />
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════ БЛОК БЕЗОПАСНОСТИ ═══════════════ */}
        <RevealSection delay={150}>
          <div className="glass-card p-5 md:p-6 mb-6 screening-danger-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-danger/15 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-danger" />
              </div>
              <h2 className="text-lg font-display font-semibold text-white">Важно: безопасность</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-bg-elevated border border-border">
                <p className="text-sm font-semibold text-white mb-2">Правила съёмки</p>
                <ul className="text-sm text-text-secondary space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span>Снимай в свободной одежде, босиком или в носках</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span>Обеспечь хорошее освещение, чтобы было видно тело</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span>Поставь телефон на устойчивую поверхность или попроси помочь</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span>Выполняй движения медленно и контролируемо</span>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-danger/5 border border-danger/20">
                <p className="text-sm font-semibold text-danger mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Красные флаги: когда тесты делать нельзя
                </p>
                <ul className="text-sm text-text-secondary space-y-1.5">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                    <span>Острая боль в суставах или спине</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                    <span>Недавняя травма или операция (менее 3 месяцев)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                    <span>Обострение хронических заболеваний опорно-двигательного аппарата</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                    <span>Беременность (без разрешения врача)</span>
                  </li>
                </ul>
                <p className="text-xs text-text-muted mt-3">
                  Если хотя бы один пункт про вас, проконсультируйтесь с врачом перед началом тестирования.
                </p>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════ ЧЕК-ЛИСТ ПЕРЕД СТАРТОМ ═══════════════ */}
        <RevealSection delay={200}>
          <div className="glass-card p-5 md:p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                <ClipboardCheck className="w-4.5 h-4.5 text-accent" />
              </div>
              <h2 className="text-lg font-display font-semibold text-white">Чек-лист перед стартом</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {([
                { key: 'clothing', label: 'Свободная одежда, босиком/носки' },
                { key: 'lighting', label: 'Хорошее освещение' },
                { key: 'space', label: 'Достаточно места для движений' },
                { key: 'battery', label: 'Заряд телефона достаточный' },
                { key: 'warmup', label: 'Лёгкая разминка 3-5 минут' },
              ] as const).map(({ key, label }) => {
                const checked = precheckItems[key]
                return (
                  <label
                    key={key}
                    onClick={() => setPrecheckItems(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                      checked
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-bg-elevated border-transparent hover:border-border'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? 'bg-accent border-accent' : 'border-text-muted'
                    }`}>
                      {checked && <Check className="w-3 h-3 text-bg-main" />}
                    </div>
                    <span className={`text-sm ${checked ? 'text-accent' : 'text-text-secondary'}`}>
                      {label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════ 7 ТЕСТОВ ═══════════════ */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {TESTS.map((test, idx) => (
              <RevealSection key={test.id} delay={Math.min(250 + idx * 60, 600)}>
                <TestSection
                  test={test}
                  isExpanded={expandedTests.has(test.id)}
                  onToggle={() => toggleTest(test.id)}
                  link={links[test.id] || ''}
                  onLinkChange={(v) => updateLink(test.id, v)}
                  isCompleted={completedTests.has(test.id)}
                />
              </RevealSection>
            ))}
          </div>

          {/* ═══════════════ ФИНАЛЬНЫЙ БЛОК ═══════════════ */}
          <RevealSection delay={700}>
            <div className="glass-card p-5 md:p-6 mt-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                  <LinkIcon className="w-4.5 h-4.5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-semibold text-white">Готово к отправке</h2>
                  <p className="text-xs text-text-muted">
                    Загружено ссылок: {filledCount} из 7
                  </p>
                </div>
              </div>

              {/* Прогресс */}
              <div className="mb-5">
                <div className="flex justify-between mb-2 text-xs text-text-muted">
                  <span>Прогресс</span>
                  <span>{Math.round((filledCount / 7) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out screening-progress-fill"
                    style={{ width: `${(filledCount / 7) * 100}%` }}
                  />
                </div>
              </div>

              {/* Чек-лист ссылок */}
              <div className="space-y-1.5 mb-6">
                {TESTS.map(t => {
                  const filled = !!links[t.id]?.trim()
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 text-sm">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        filled ? 'bg-success' : 'bg-bg-elevated border border-text-muted'
                      }`}>
                        {filled && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={filled ? 'text-text-secondary line-through' : 'text-text-secondary'}>
                        Тест {t.id}: {t.title}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Инструкция по отправке */}
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 mb-6">
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-white">Как отправить видео:</span>{' '}
                  Запишите каждое упражнение на телефон, загрузите на YouTube (скрытое видео),
                  VK, Google Диск или любой файловый хостинг и вставьте ссылку в поле под тестом.
                  Видео должны быть видны по ссылке.
                </p>
                <p className="text-xs text-text-muted mt-2">
                  Срок обратной связи: до 48 часов после отправки всех 7 видео.
                </p>
              </div>

              {/* Ошибки */}
              {error && (
                <div className="p-4 mb-5 rounded-xl bg-danger/10 border border-danger/30 animate-fade-in">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              {/* Кнопка отправки */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="glass-button w-full flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Отправка...</>
                ) : (
                  <><Check className="w-5 h-5" /> Отправить скрининг</>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-full mt-3 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:text-white hover:border-accent/50 hover:bg-accent/10 transition-all"
              >
                Вернуться позже
              </button>
            </div>
          </RevealSection>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Компонент секции теста
// ──────────────────────────────────────────────────────────────────────────

function TestSection({ test, isExpanded, onToggle, link, onLinkChange, isCompleted }: {
  test: Test
  isExpanded: boolean
  onToggle: () => void
  link: string
  onLinkChange: (v: string) => void
  isCompleted: boolean
}) {
  return (
    <div className={`glass-card overflow-hidden transition-all duration-300 ${
      isCompleted ? 'screening-test-completed' : ''
    }`}>
      {/* Заголовок */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-5 md:p-6 flex items-start gap-4 group"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          isCompleted ? 'bg-success/20' : 'bg-accent/15 group-hover:bg-accent/25'
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <span className="text-sm font-display font-bold text-accent">{test.id}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-display font-semibold text-white mb-1 pr-8">
            Тест {test.id}. {test.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">{test.subtitle}</p>
          <div className="flex items-center gap-2 mt-2">
            {test.filmingIcon}
            <span className="text-xs text-text-muted">{test.filming}</span>
          </div>
        </div>
        <div className="mt-1 flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
          )}
        </div>
      </button>

      {/* Содержимое */}
      <div className={`transition-all duration-500 ease-out overflow-hidden ${
        isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-5 md:px-6 pb-6 space-y-5">

          {/* Видео тренера */}
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
              Как выполнять
            </p>
            {test.videoUrl ? (
              <div className={`rounded-xl overflow-hidden border border-border screening-video-placeholder ${test.vertical ? 'max-w-[280px] mx-auto' : ''}`}>
                <div className={test.vertical ? 'aspect-[9/16]' : 'aspect-video'}>
                  <iframe
                    src={test.videoUrl}
                    title={`Демонстрация: ${test.title}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div
                data-role="trainer-video"
                data-test={test.id}
                className="relative aspect-video rounded-xl bg-bg-elevated border border-border flex items-center justify-center overflow-hidden screening-video-placeholder"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5" />
                <div className="relative flex flex-col items-center gap-3 z-10">
                  <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center screening-play-pulse">
                    <Play className="w-6 h-6 text-accent ml-0.5" />
                  </div>
                  <span className="text-sm font-medium text-text-muted">
                    Видео-демонстрация
                  </span>
                  <span className="text-xs text-text-muted/60">
                    Тренер подставит видео позже
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Инструкция */}
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
              Инструкция
            </p>
            <ol className="space-y-2.5">
              {test.instruction.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-text-secondary leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Как снимать */}
          <div className="p-4 rounded-xl bg-bg-elevated border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Video className="w-4 h-4 text-accent" />
              <p className="text-sm font-semibold text-white">Как снимать</p>
            </div>
            <p className="text-sm text-text-secondary">{test.filming}</p>
          </div>

          {/* Поле ссылки */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Ваше видео <span className="text-accent">*</span>
            </label>
            <input
              type="url"
              name={`video_test_${test.id}`}
              value={link}
              onChange={e => onLinkChange(e.target.value)}
              className="glass-input"
              placeholder={test.placeholder}
              required
            />
          </div>

          {/* Демо-интерпретация (свёрнутая) */}
          <details className="group/details">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-secondary hover:text-accent transition-colors select-none">
              <Info className="w-4 h-4" />
              <span>Что этот тест может показать</span>
              <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open/details:rotate-180" />
            </summary>
            <div className="mt-3 p-4 rounded-xl bg-accent/5 border border-accent/15 space-y-2">
              {test.interpretation.map((line, i) => (
                <p key={i} className="text-sm text-text-secondary leading-relaxed">{line}</p>
              ))}
            </div>
          </details>

        </div>
      </div>
    </div>
  )
}
