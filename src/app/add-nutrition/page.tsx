'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Apple, Check, Loader2, CreditCard, ArrowRight,
  ArrowLeft, CheckCircle2, Clock, Zap
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  getMySubscriptionInfo,
  createNutritionUpgradeRequest,
  NUTRITION_ADDON_PRICE,
  type SubscriptionInfo,
} from '@/lib/services/renewal'
import { buildProdamusLink } from '@/lib/payments/prodamus-link'

const PRODAMUS_FORM_URL = process.env.NEXT_PUBLIC_PRODAMUS_FORM_URL || 'https://metasystem.payform.ru'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meta-system-ja1o.vercel.app'

function buildNutritionLink(paymentId: string, email?: string | null) {
  const productName = 'MetaSystem — план питания'
  return buildProdamusLink({
    formUrl: PRODAMUS_FORM_URL,
    orderId: paymentId,
    productName,
    price: NUTRITION_ADDON_PRICE,
    customerEmail: email,
    urlSuccess: `${APP_URL}/questionnaire/nutrition?upgraded=true`,
    customerExtra: productName,
  })
}

export default function AddNutritionPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const info = await getMySubscriptionInfo()
        setSubInfo(info)

        // Если питание уже есть — редиректим
        if (info.hasNutrition) {
          router.replace('/dashboard')
          return
        }

        // Если подписка не активна — на продление
        if (info.isExpired || info.status !== 'active') {
          router.replace('/renew')
          return
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user, router])

  const handleAddNutrition = async () => {
    if (!user) return
    setError('')
    setIsSubmitting(true)

    try {
      const { paymentId, error: reqError } = await createNutritionUpgradeRequest()

      if (reqError || !paymentId) {
        setError(reqError ?? 'Ошибка создания платежа')
        setIsSubmitting(false)
        return
      }

      setIsPending(true)
      const payUrl = buildNutritionLink(paymentId, user.email)
      window.location.href = payUrl
    } catch {
      setError('Произошла ошибка. Попробуйте позже.')
      setIsSubmitting(false)
    }
  }

  // DEV: тестовое подключение питания
  const handleTestAddNutrition = async () => {
    if (!user) return
    setIsSubmitting(true)
    try {
      const { paymentId, error: reqError } = await createNutritionUpgradeRequest()
      if (reqError || !paymentId) {
        setError(reqError ?? 'Ошибка')
        setIsSubmitting(false)
        return
      }

      // Подтверждаем вручную
      const { confirmRenewal } = await import('@/lib/services/renewal')
      const result = await confirmRenewal(paymentId, 'nutrition_upgrade')
      if (result.success) {
        router.push('/questionnaire/nutrition?upgraded=true')
      } else {
        setError(result.error ?? 'Ошибка подтверждения')
        setIsSubmitting(false)
      }
    } catch {
      setError('Ошибка тестового подключения')
      setIsSubmitting(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-accent mb-8 shadow-glow-accent">
            <Clock className="w-10 h-10 text-bg-main" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-4">Ожидаем оплату</h1>
          <div className="glass-card p-8 mb-6">
            <p className="text-text-secondary mb-4">
              После оплаты питание подключится <span className="text-white font-semibold">автоматически</span>.
              Вы сразу перейдёте к заполнению анкеты по питанию.
            </p>
            <div className="p-4 rounded-xl bg-bg-elevated border border-border text-sm">
              <div className="flex justify-between font-semibold">
                <span className="text-text-secondary">Сумма</span>
                <span className="text-accent">{NUTRITION_ADDON_PRICE.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="glass-button-secondary w-full"
          >
            Вернуться в кабинет
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main p-4 py-12">
      <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 pointer-events-none" />

      <div className="relative max-w-2xl mx-auto">
        {/* Назад */}
        <button
          onClick={() => router.push('/dashboard')}
          className="glass-button-secondary flex items-center gap-2 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          В кабинет
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 mb-4">
            <Apple className="w-9 h-9 text-accent" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Подключить питание</h1>
          <p className="text-text-secondary">
            Добавьте индивидуальный план питания к вашей активной подписке
          </p>
        </div>

        {/* Что входит */}
        <div className="glass-card p-8 mb-8">
          <h2 className="text-xl font-display font-bold text-white mb-6">Что вы получите</h2>
          <div className="space-y-4">
            {[
              'Индивидуальный план питания под ваши цели',
              'Расчёт калорий и макронутриентов (КБЖУ)',
              'Анкета по питанию — тренер учтёт все ваши предпочтения',
              'Корректировка плана по ходу работы',
              'Рецепты и варианты блюд',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Текущая подписка */}
        {subInfo && (
          <div className="glass-card p-5 mb-8">
            <p className="text-sm text-text-muted mb-1">Ваша подписка</p>
            <p className="text-white font-semibold">
              Активна до{' '}
              {subInfo.endDate
                ? new Date(subInfo.endDate).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })
                : '—'
              }
            </p>
            <p className="text-sm text-text-muted mt-1">
              Питание подключится к текущей подписке — срок не изменится
            </p>
          </div>
        )}

        {/* Цена */}
        <div className="glass-card p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-text-secondary mb-1">Подключение питания</p>
              <p className="text-xs text-text-muted">Разовая оплата, питание на весь срок подписки</p>
            </div>
            <span className="text-3xl font-display font-bold text-accent">
              {NUTRITION_ADDON_PRICE.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Гарантия */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-success/5 border border-success/20 mb-6">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            <span className="text-white font-semibold">Срок подписки не изменится.</span>{' '}
            Питание подключается к вашему текущему тарифу. При следующем продлении вы сможете выбрать — продолжать с питанием или без.
          </p>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-xl bg-danger/10 border border-danger/30">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Кнопка */}
        <button
          onClick={handleAddNutrition}
          disabled={isSubmitting}
          className="glass-button w-full flex items-center justify-center gap-2 py-4 text-lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Подготовка...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Подключить за {NUTRITION_ADDON_PRICE.toLocaleString('ru-RU')} ₽
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* DEV */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <p className="text-xs text-text-muted text-center">DEV инструменты</p>
            <button
              onClick={handleTestAddNutrition}
              disabled={isSubmitting}
              className="glass-button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Пропустить оплату (тест)
            </button>
          </div>
        )}

        <p className="text-center text-xs text-text-muted mt-4">
          Безопасная оплата через Продамус
        </p>
      </div>
    </div>
  )
}
