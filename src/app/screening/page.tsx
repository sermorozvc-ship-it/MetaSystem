'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity, Camera, ChevronDown, ChevronUp, Check, Loader2,
  AlertTriangle, Shield, Play, Link as LinkIcon, Video,
  ClipboardCheck, User, Calendar, Phone, ChevronRight,
  Info, CheckCircle2, AlertCircle, Upload, FileVideo, X
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { upsertScreening, uploadScreeningVideo, type UploadProgress } from '@/lib/services/screening'
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
  filmingAngles: number
  filmingLabels?: string[]
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
    filming: 'Два отдельных видео: спереди и сбоку. Каждый ракурс — отдельный файл, загрузите по одному.',
    filmingIcon: <><Camera className="w-4 h-4" /> Спереди + Сбоку</>,
    filmingAngles: 2,
    filmingLabels: ['Спереди (основной)', 'Сбоку (основной)'],
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
      '3 повтора в каждом ракурсе с задержкой внизу 2 секунды.',
    ],
    filming: 'Два отдельных видео: сбоку и сзади. Каждый ракурс — отдельный файл, загрузите по одному.',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку + Сзади</>,
    filmingAngles: 2,
    filmingLabels: ['Сбоку (основной)', 'Сзади'],
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
      'Выпрямляемая нога должна быть почти прямой и не сгибаться в колене.',
      'Замри 3 секунды, 2 повтора на каждую ногу.',
    ],
    filming: 'Два отдельных видео: с правой и с левой ноги. Каждый ракурс — отдельный файл, загрузите по одному.',
    filmingIcon: <><Camera className="w-4 h-4" /> Правая + Левая нога</>,
    filmingAngles: 2,
    filmingLabels: ['Правая нога (основная)', 'Левая нога (основная)'],
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
    filming: 'Сбоку, чтобы было видно отрыв рук и поясницы от стены.',
    filmingIcon: <><Camera className="w-4 h-4" /> Сбоку</>,
    filmingAngles: 1,
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
      'Вторая нога прижата к полу, таз не проворачивается.',
      '3 повтора на каждую ногу.',
    ],
    filming: 'Два отдельных видео: правая и левая нога. Каждый ракурс — отдельный файл, загрузите по одному.',
    filmingIcon: <><Camera className="w-4 h-4" /> Правая + Левая нога</>,
    filmingAngles: 2,
    filmingLabels: ['Правая нога (основная)', 'Левая нога (основная)'],
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
      'Не опирайся на другую ногу — она свободно свисает.',
      '5 медленных повторов на каждую ногу.',
    ],
    filming: 'Два отдельных видео: правая и левая нога. Каждый ракурс — отдельный файл, загрузите по одному.',
    filmingIcon: <><Camera className="w-4 h-4" /> Правая + Левая нога</>,
    filmingAngles: 2,
    filmingLabels: ['Правая нога (основная)', 'Левая нога (основная)'],
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
      '2 поворота в каждую сторону, одно видео на весь тест.',
    ],
    filming: 'Одно видео: снимай спереди, 2 поворота влево и 2 вправо.',
    filmingIcon: <><Camera className="w-4 h-4" /> Сверху-спереди</>,
    filmingAngles: 1,
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
  const [clientName, setClientName] = useState('')
  const [videoUrls, setVideoUrls] = useState<Record<number, string[]>>({})
  const [uploadingSlots, setUploadingSlots] = useState<Set<string>>(new Set())
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})

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
        if (data.client_contact) setClientName(data.client_contact)
        if (Array.isArray(data.tests)) {
          const newVideoUrls: Record<number, string[]> = {}
          const newCompleted = new Set<number>()
          for (const t of data.tests) {
            // Поддержка нового формата (video_urls) и старого (video_url)
            const urls: string[] = t.video_urls || (t.video_url ? [t.video_url] : [])
            if (urls.length > 0) {
              newVideoUrls[t.id] = urls
              newCompleted.add(t.id)
            }
          }
          setVideoUrls(newVideoUrls)
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

  const handleFileUpload = useCallback(async (testId: number, slot: number, file: File) => {
    if (!clientName.trim()) {
      setUploadErrors(prev => ({ ...prev, [`${testId}-${slot}`]: 'Сначала введите имя и фамилию' }))
      return
    }

    const slotKey = `${testId}-${slot}`
    setUploadingSlots(prev => new Set(prev).add(slotKey))
    setUploadErrors(prev => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
    setUploadProgress(prev => ({ ...prev, [slotKey]: 0 }))

    try {
      const result = await uploadScreeningVideo(file, testId, slot, clientName.trim(), (progress) => {
        setUploadProgress(prev => ({ ...prev, [slotKey]: progress.percent }))
      })

      setVideoUrls(prev => {
        const existing = prev[testId] || []
        const next = [...existing]
        next[slot] = result.url
        const updated = { ...prev, [testId]: next }

        // Помечаем тест как выполненный только если все ракурсы загружены
        const test = TESTS.find(t => t.id === testId)
        if (test) {
          const filled = (next || []).filter(u => u && u.trim()).length
          if (filled >= test.filmingAngles) {
            setCompletedTests(prev => new Set(prev).add(testId))
          }
        }

        return updated
      })
    } catch (e: any) {
      setUploadErrors(prev => ({ ...prev, [slotKey]: e?.message || 'Ошибка загрузки' }))
    } finally {
      setUploadingSlots(prev => {
        const next = new Set(prev)
        next.delete(slotKey)
        return next
      })
      setUploadProgress(prev => {
        const next = { ...prev }
        delete next[slotKey]
        return next
      })
    }
  }, [clientName])

  const handleRemoveVideo = useCallback((testId: number, slot: number) => {
    setVideoUrls(prev => {
      const existing = prev[testId] || []
      const next = [...existing]
      next[slot] = ''  // Обнуляем слот, не сдвигая индексы
      const hasAny = next.some(u => u && u.trim())

      // Снимаем "выполнено" если не все ракурсы загружены
      const test = TESTS.find(t => t.id === testId)
      if (test) {
        const filled = next.filter(u => u && u.trim()).length
        if (filled < test.filmingAngles) {
          setCompletedTests(prev => {
            const s = new Set(prev)
            s.delete(testId)
            return s
          })
        }
      }

      return hasAny ? { ...prev, [testId]: next } : (() => {
        const copy = { ...prev }
        delete copy[testId]
        return copy
      })()
    })
  }, [])

  const allLinksFilled = TESTS.every(t => {
    const urls = videoUrls[t.id] || []
    return urls.filter(u => u.trim()).length >= t.filmingAngles
  })
  const filledCount = TESTS.filter(t => {
    const urls = videoUrls[t.id] || []
    return urls.filter(u => u.trim()).length >= t.filmingAngles
  }).length
  const allPrechecked = Object.values(precheckItems).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allLinksFilled) {
      setError('Загрузите видео для всех 7 тестов')
      return
    }

    setIsSubmitting(true)

    try {
      await upsertScreening({
        client_date: clientDate,
        client_contact: clientName.trim(),
        tests: TESTS.map(t => ({
          id: t.id,
          title: t.title,
          video_url: videoUrls[t.id]?.[0] || '',
          video_urls: videoUrls[t.id] || [],
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
              Я просмотрю все видео и составлю персональный разбор.
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
              загрузите файлы, и я составлю персональный разбор с программой коррекции.
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
                  Имя и фамилия
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="glass-input"
                  placeholder="Иван Иванов"
                  required
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
                  uploadedUrls={videoUrls[test.id] || []}
                  onFileUpload={(slot, file) => handleFileUpload(test.id, slot, file)}
                  onRemoveVideo={(slot) => handleRemoveVideo(test.id, slot)}
                  uploadingSlots={uploadingSlots}
                  uploadProgress={uploadProgress}
                  uploadErrors={uploadErrors}
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
                    Загружено видео: {filledCount} из 7
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

              {/* Чек-лист видео */}
              <div className="space-y-1.5 mb-6">
                {TESTS.map(t => {
                  const urls = videoUrls[t.id] || []
                  const filled = urls.filter(u => u.trim()).length >= t.filmingAngles
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
                  Запишите каждое упражнение на телефон, затем нажмите «Выберите видео»
                  и загрузите файл напрямую. Поддерживаются форматы MP4, MOV, WebM и AVI (до 100MB).
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

function TestSection({ test, isExpanded, onToggle, uploadedUrls, onFileUpload, onRemoveVideo, uploadingSlots, uploadProgress, uploadErrors, isCompleted }: {
  test: Test
  isExpanded: boolean
  onToggle: () => void
  uploadedUrls: string[]
  onFileUpload: (slot: number, file: File) => void
  onRemoveVideo: (slot: number) => void
  uploadingSlots: Set<string>
  uploadProgress: Record<string, number>
  uploadErrors: Record<string, string>
  isCompleted: boolean
}) {
  const slots = Array.from({ length: test.filmingAngles }, (_, i) => i)

  return (
    <div className={`glass-card overflow-hidden transition-all duration-300 ${
      isCompleted ? 'screening-test-completed' : ''
    }`}>
      {/* Заголовок */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 md:p-6 flex items-start gap-3 md:gap-4 group"
      >
        <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          isCompleted ? 'bg-success/20' : 'bg-accent/15 group-hover:bg-accent/25'
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <span className="text-xs md:text-sm font-display font-bold text-accent">{test.id}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm md:text-lg font-display font-semibold text-white mb-1 pr-8 leading-snug">
            Тест {test.id}. {test.title}
          </h2>
          <p className="text-xs md:text-sm text-text-secondary leading-relaxed mb-2">{test.subtitle}</p>
          <div className="px-3 py-2 rounded-lg bg-bg-elevated border border-border">
            <div className="flex items-center gap-2 mb-0.5">
              {test.filmingIcon}
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{test.filming}</p>
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
        isExpanded ? 'max-h-[2400px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-4 md:px-6 pb-5 md:pb-6 space-y-4 md:space-y-5">

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
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2 md:mb-3">
              Инструкция
            </p>
            <ol className="space-y-2">
              {test.instruction.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs md:text-sm text-text-secondary leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Как снимать */}
          <div className="p-3 md:p-4 rounded-xl bg-bg-elevated border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Video className="w-4 h-4 text-accent" />
              <p className="text-xs md:text-sm font-semibold text-white">Как снимать</p>
            </div>
            <p className="text-xs md:text-sm text-text-secondary">{test.filming}</p>
          </div>

          {/* Загрузка видео */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-text-secondary mb-2">
              Ваше видео <span className="text-accent">*</span>
              {test.filmingAngles > 1 && (
                <span className="text-xs text-text-muted ml-1">(два ракурса)</span>
              )}
            </label>

            <div className="space-y-3">
              {slots.map((slot) => {
                const slotKey = `${test.id}-${slot}`
                const url = uploadedUrls[slot]
                const isUploading = uploadingSlots.has(slotKey)
                const progress = uploadProgress[slotKey]
                const error = uploadErrors[slotKey]

                const slotLabels = test.filmingLabels
                  || (test.filmingAngles === 2
                    ? ['Ракурс 1 (основной)', 'Ракурс 2 (дополнительный)']
                    : ['Видео'])

                return (
                  <div key={slot}>
                    {test.filmingAngles > 1 && (
                      <p className="text-xs text-text-muted mb-1.5">{slotLabels[slot]}</p>
                    )}

                    {url ? (
                      /* Видео загружено */
                      <div className="relative rounded-xl border border-success/30 bg-success/5 p-3 md:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-success/20 flex items-center justify-center flex-shrink-0">
                            <FileVideo className="w-5 h-5 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium text-white truncate">Видео загружено</p>
                            <p className="text-xs text-text-muted">Нажмите чтобы посмотреть</p>
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:underline flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Открыть
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveVideo(slot)}
                          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-danger/20 transition-colors"
                        >
                          <X className="w-4 h-4 text-text-muted hover:text-danger" />
                        </button>
                      </div>
                    ) : isUploading ? (
                      /* Загрузка в процессе */
                      <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 md:p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Loader2 className="w-5 h-5 text-accent animate-spin" />
                          <p className="text-xs md:text-sm font-medium text-white">Загрузка видео...</p>
                        </div>
                        {progress !== undefined && (
                          <div>
                            <div className="flex justify-between mb-1 text-xs text-text-muted">
                              <span>Прогресс</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Кнопка загрузки */
                      <div>
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/avi"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) onFileUpload(slot, file)
                            e.target.value = ''
                          }}
                          className="hidden"
                          id={`video-upload-${test.id}-${slot}`}
                        />
                        <label
                          htmlFor={`video-upload-${test.id}-${slot}`}
                          className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl border-2 border-dashed border-border hover:border-accent/50 bg-bg-elevated hover:bg-accent/5 cursor-pointer transition-all"
                        >
                          <Upload className="w-7 h-7 md:w-8 md:h-8 text-text-muted mb-2 md:mb-3" />
                          <p className="text-xs md:text-sm font-medium text-text-secondary mb-1">
                            Нажмите чтобы выбрать видео
                          </p>
                          <p className="text-[10px] md:text-xs text-text-muted">
                            MP4, MOV, WebM или AVI (до 100MB)
                          </p>
                        </label>
                        {error && (
                          <p className="mt-2 text-xs text-danger">{error}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Демо-интерпретация (свёрнутая) */}
          <details className="group/details">
            <summary className="flex items-center gap-2 cursor-pointer text-xs md:text-sm font-medium text-text-secondary hover:text-accent transition-colors select-none">
              <Info className="w-4 h-4" />
              <span>Что этот тест может показать</span>
              <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open/details:rotate-180" />
            </summary>
            <div className="mt-2 md:mt-3 p-3 md:p-4 rounded-xl bg-accent/5 border border-accent/15 space-y-2">
              {test.interpretation.map((line, i) => (
                <p key={i} className="text-xs md:text-sm text-text-secondary leading-relaxed">{line}</p>
              ))}
            </div>
          </details>

        </div>
      </div>
    </div>
  )
}
