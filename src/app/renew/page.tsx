'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  RefreshCw, Check, Loader2, Gift, Zap, CreditCard,
  ArrowRight, Clock, CheckCircle2, ExternalLink, Apple,
  ArrowLeft, Shield
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  getMySubscriptionInfo,
  createRenewalRequest,
  createTestRenewal,
  RENEWAL_PRICES,
  RENEWAL_MONTHS,
  NUTRITION_ADDON_PRICE,
  type PlanType,
  type SubscriptionInfo,
} from '@/lib/services/renewal'
import { buildProdamusLink } from '@/lib/payments/prodamus-link'

const PRODAMUS_FORM_URL = process.env.NEXT_PUBLIC_PRODAMUS_FORM_URL || 'https://metasystem.payform.ru'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meta-system-ja1o.vercel.app'

const PLAN_LABELS: Record<PlanType, string> = {
  '1_month': '1 месяц',
  '3_months': '3 месяца',
  '6_months': '6 месяцев',
}

/**
 * Ссылка на оплату продления через Продамус.
 * order_id = paymentId — по нему вебхук находит запись и продлевает подписку.
 */
function buildRenewalLink(
  paymentId: string,
  amount: number,
  planType: PlanType,
  includesNutrition: boolean,
  email?: string | null,
) {
  const label = PLAN_LABELS[planType] ?? 'Тариф'
  const productName = includesNutrition
    ? `MetaSystem — продление ${label} + питание`
    : `MetaSystem — продление ${label}`

  return buildProdamusLink({
    formUrl: PRODAMUS_FORM_URL,
    orderId: paymentId,
    productName,
    price: amount,
    customerEmail: email,
    urlSuccess: `${APP_URL}/dashboard?renewed=true`,
    customerExtra: productName,
  })
}

export default function RenewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    }>
      <RenewContent />
    </Suspense>
  )
}

function RenewContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromExpired = searchParams.get('expired') === 'true'

  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('1_month')
  const [includeNutrition, setIncludeNutrition] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const info = await getMySubscriptionInfo()
        setSubInfo(info)
        // Предлагаем тот же тариф что был
        if (info.planType) setSelectedPlan(info.planType)
        // Если питание уже было — включаем по умолчанию
        if (info.hasNutrition) setIncludeNutrition(true)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user?.id])

  const baseAmount = RENEWAL_PRICES[selectedPlan]
  const nutritionAmount = selectedPlan === '6_months' ? 0 : (includeNutrition ? NUTRITION_ADDON_PRICE : 0)
  const totalAmount = baseAmount + nutritionAmount
  const finalIncludesNutrition = selectedPlan === '6_months' || includeNutrition

  // Вычисляем новую дату окончания
  const getNewEndDate = () => {
    const months = RENEWAL_MONTHS[selectedPlan]
    let startFrom: Date

    if (subInfo?.endDate) {
      const end = new Date(subInfo.endDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      startFrom = end >= today
        ? new Date(end.getTime() + 24 * 60 * 60 * 1000)
        : today
    } else {
      startFrom = new Date()
    }

    const newEnd = new Date(startFrom)
    newEnd.setMonth(newEnd.getMonth() + months)
    newEnd.setDate(newEnd.getDate() - 1)
    return newEnd
  }

  const handleRenew = async () => {
    if (!user) return
    setError('')
    setIsSubmitting(true)

    try {
      const { paymentId, amount, error: reqError } = await createRenewalRequest(
        selectedPlan,
        finalIncludesNutrition,
        'renewal'
      )

      if (reqError || !paymentId) {
        setError(reqError ?? 'Ошибка создания платежа')
        setIsSubmitting(false)
        return
      }

      setIsPending(true)
      const payUrl = buildRenewalLink(
        paymentId,
        amount,
        selectedPlan,
        finalIncludesNutrition,
        user.email,
      )
      window.location.href = payUrl
    } catch {
      setError('Произошла ошибка. Попробуйте позже.')
      setIsSubmitting(false)
    }
  }

  const handleTestRenew = async () => {
    if (!user) return
    setIsSubmitting(true)
    try {
      const result = await createTestRenewal(selectedPlan, finalIncludesNutrition)
      if (result.success) {
        router.push('/dashboard?renewed=true')
      } else {
        setError(result.error ?? 'Ошибка')
        setIsSubmitting(false)
      }
    } catch {
      setError('Ошибка тестового продления')
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
              После оплаты подписка продлится <span className="text-white font-semibold">автоматически</span>.
              Все ваши данные сохранятся.
            </p>
            <div className="p-4 rounded-xl bg-bg-elevated border border-border text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Тариф</span>
                <span className="text-white">{PLAN_LABELS[selectedPlan]}</span>
              </div>
              {finalIncludesNutrition && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Питание</span>
                  <span className="text-accent">
                    {selectedPlan === '6_months' ? '🎁 В подарок' : `+${NUTRITION_ADDON_PRICE.toLocaleString('ru-RU')} ₽`}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span className="text-text-secondary">Итого</span>
                <span className="text-accent">{totalAmount.toLocaleString('ru-RU')} ₽</span>
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

  const newEndDate = getNewEndDate()

  return (
    <div className="min-h-screen bg-bg-main p-4 py-12">
      <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4 shadow-glow-accent">
            <RefreshCw className="w-9 h-9 text-bg-main" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Продление тарифа</h1>
          <p className="text-text-secondary">
            {fromExpired
              ? 'Ваш тариф истёк. Выберите новый план — все данные сохранены.'
              : 'Выберите тариф для продления. Вся история и данные сохранятся.'
            }
          </p>
        </div>

        {/* Текущая подписка */}
        {subInfo && (
          <div className="glass-card p-5 mb-8 border-border-accent">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary">
                  {subInfo.isExpired
                    ? <span className="text-danger font-medium">Тариф истёк</span>
                    : subInfo.isExpiringSoon
                    ? <span className="text-warning font-medium">Истекает через {subInfo.daysLeft} дн.</span>
                    : <span className="text-success font-medium">Активен ещё {subInfo.daysLeft} дн.</span>
                  }
                  {subInfo.endDate && (
                    <span className="text-text-muted ml-2">
                      (до {new Date(subInfo.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })})
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {subInfo.hasNutrition ? '✓ Питание подключено' : 'Без питания'}
                  {subInfo.planType && ` · Тариф: ${PLAN_LABELS[subInfo.planType]}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-text-muted">Новая дата окончания</p>
                <p className="text-sm font-semibold text-white">
                  {newEndDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Тарифные карточки */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {(Object.keys(RENEWAL_PRICES) as PlanType[]).map((planKey) => {
            const price = RENEWAL_PRICES[planKey]
            const months = RENEWAL_MONTHS[planKey]
            const isSelected = selectedPlan === planKey
            const isPopular = planKey === '3_months'
            const isBest = planKey === '6_months'
            const isSamePlan = subInfo?.planType === planKey

            return (
              <div
                key={planKey}
                onClick={() => setSelectedPlan(planKey)}
                className={`glass-card p-6 cursor-pointer transition-all duration-300 relative ${
                  isSelected ? 'border-accent shadow-glow-accent' : 'hover:border-border-accent'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-bg-main text-xs font-display font-semibold rounded-full whitespace-nowrap">
                    <Zap className="w-3 h-3 inline mr-1" />
                    Популярный
                  </div>
                )}
                {isBest && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-bg-main text-xs font-display font-semibold rounded-full whitespace-nowrap">
                    <Gift className="w-3 h-3 inline mr-1" />
                    Лучшее предложение
                  </div>
                )}
                {isSamePlan && !isPopular && !isBest && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-bg-elevated border border-border text-text-secondary text-xs font-semibold rounded-full whitespace-nowrap">
                    Текущий тариф
                  </div>
                )}

                <div className="text-center mb-6 mt-2">
                  <h3 className="text-xl font-display font-bold text-white mb-2">{PLAN_LABELS[planKey]}</h3>
                  <div className="text-4xl font-display font-bold text-accent mb-1">
                    {price.toLocaleString('ru-RU')} ₽
                  </div>
                  <p className="text-sm text-text-muted">
                    {Math.round(price / months).toLocaleString('ru-RU')} ₽/мес
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-text-secondary">Индивидуальные программы</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-text-secondary">Вся история сохраняется</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-text-secondary">Чат с тренером 24/7</span>
                  </div>
                  {isBest && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30">
                      <Gift className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gold font-semibold">
                        {subInfo?.hasNutrition ? 'Питание продолжается' : 'План питания в подарок!'}
                      </span>
                    </div>
                  )}
                </div>

                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-4 h-4 text-bg-main" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Опция питания */}
        {selectedPlan !== '6_months' && (
          <div className="glass-card p-6 mb-8">
            <label className="flex items-start gap-4 cursor-pointer">
              <div
                onClick={() => {
                  // Если питание уже было — нельзя убрать
                  if (!subInfo?.hasNutrition) setIncludeNutrition(!includeNutrition)
                }}
                className={`custom-checkbox mt-0.5 ${includeNutrition ? 'checked' : ''} ${subInfo?.hasNutrition ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {includeNutrition && <Check className="w-3 h-3 text-bg-main" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Apple className="w-4 h-4 text-accent" />
                  <span className="text-white font-semibold">
                    {subInfo?.hasNutrition ? 'Питание продолжается' : 'Добавить план питания'}
                  </span>
                  {!subInfo?.hasNutrition && (
                    <span className="text-accent font-bold">+{NUTRITION_ADDON_PRICE.toLocaleString('ru-RU')} ₽</span>
                  )}
                  {subInfo?.hasNutrition && (
                    <span className="text-success text-sm">✓ уже подключено</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">
                  {subInfo?.hasNutrition
                    ? 'Ваш план питания продолжится вместе с тарифом'
                    : 'Индивидуальный план питания с расчётом калорий и макронутриентов'
                  }
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Итог */}
        <div className="glass-card p-6 mb-6">
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Тариф</span>
              <span className="text-white font-medium">{PLAN_LABELS[selectedPlan]}</span>
            </div>
            {finalIncludesNutrition && (
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">План питания</span>
                <span className="text-accent font-medium">
                  {selectedPlan === '6_months' || subInfo?.hasNutrition
                    ? '🎁 Включено'
                    : `+${NUTRITION_ADDON_PRICE.toLocaleString('ru-RU')} ₽`
                  }
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm text-text-muted">
              <span>Подписка до</span>
              <span>{newEndDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="border-t border-border pt-4 flex justify-between items-center">
            <span className="text-xl font-display font-bold text-white">Итого</span>
            <span className="text-3xl font-display font-bold text-accent">
              {totalAmount.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Гарантия сохранения данных */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-success/5 border border-success/20 mb-6">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            <span className="text-white font-semibold">Все данные сохранятся:</span>{' '}
            тренировочные программы, метрики, замеры, история чата и анкеты — ничего не удаляется при продлении.
          </p>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-xl bg-danger/10 border border-danger/30">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Кнопка оплаты */}
        <button
          onClick={handleRenew}
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
              Продлить за {totalAmount.toLocaleString('ru-RU')} ₽
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* DEV кнопки */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <p className="text-xs text-text-muted text-center">DEV инструменты</p>
            <button
              onClick={handleTestRenew}
              disabled={isSubmitting}
              className="glass-button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Пропустить оплату (тест продления)
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
