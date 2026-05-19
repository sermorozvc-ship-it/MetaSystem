'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Flame, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, CheckCircle, ShieldCheck, CreditCard } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

type AuthMode = 'login' | 'register'

export default function AuthPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-deep-dark flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-meta-orange animate-spin" />
            </div>
        }>
            <AuthContent />
        </Suspense>
    )
}

function AuthContent() {
    const searchParams = useSearchParams()
    const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login'
    const returnTo = searchParams.get('returnTo') || '/questionnaire'
    const isPaymentFlow = returnTo.includes('/payment')
    const [mode, setMode] = useState<AuthMode>(isPaymentFlow ? 'register' : initialMode)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)

    // Состояние перехода — показывается после успешного входа/регистрации
    const [isRedirecting, setIsRedirecting] = useState(false)
    const [redirectMessage, setRedirectMessage] = useState('')

    const { signIn, signUp, user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    // Определяем куда редиректить после входа
    const getRedirectTarget = async (loggedInUser: { id?: string; email?: string | null; user_metadata?: any }) => {
        const ADMIN_EMAILS = ['dgmukhin@gmail.com']
        const isAdminUser = ADMIN_EMAILS.includes(loggedInUser.email?.toLowerCase() || '')
            || loggedInUser.user_metadata?.role === 'admin'
            || loggedInUser.user_metadata?.role === 'curator'
            || loggedInUser.user_metadata?.role === 'trainer'

        if (isAdminUser) return '/admin'

        // Определяем фактическое состояние клиента: оплата → анкета → питание → дашборд.
        // Это базовая правда, которая важнее returnTo из URL — иначе залипший в истории
        // returnTo=/payment кидает уже оплатившего клиента обратно на форму оплаты.
        try {
            const { getUserPayment } = await import('@/lib/services/payment')
            const { isQuestionnaireCompleted } = await import('@/lib/services/questionnaire')

            const payment = await getUserPayment()
            const isPaid = payment?.status === 'confirmed'

            // Не оплачено — на оплату (или на returnTo, если он явно ведёт на оплату/онбординг)
            if (!isPaid) {
                if (returnTo && (returnTo.startsWith('/payment') || returnTo.startsWith('/onboarding'))) {
                    return returnTo
                }
                return '/payment'
            }

            // Оплачено — проверяем анкеты
            const done = await isQuestionnaireCompleted()
            if (!done) return '/questionnaire'

            try {
                const { isNutritionQuestionnaireRequired, isNutritionQuestionnaireCompleted } =
                    await import('@/lib/services/nutrition')
                const needsNutrition = await isNutritionQuestionnaireRequired()
                if (needsNutrition) {
                    const nutritionDone = await isNutritionQuestionnaireCompleted()
                    if (!nutritionDone) return '/questionnaire/nutrition'
                }
            } catch {}

            // Всё пройдено. Если returnTo указывает на нормальную клиентскую страницу —
            // уважаем его (например, после refresh сессии). На /payment и /auth не возвращаем.
            if (
                returnTo &&
                returnTo !== '/questionnaire' &&
                !returnTo.startsWith('/payment') &&
                !returnTo.startsWith('/auth')
            ) {
                return returnTo
            }

            return '/dashboard'
        } catch {
            // Фолбэк: на дашборд, оттуда middleware/страницы сами разрулят
            return '/dashboard'
        }
    }

    // Если пользователь уже авторизован — редиректим
    useEffect(() => {
        if (!authLoading && user && !isRedirecting) {
            setIsRedirecting(true)
            setRedirectMessage('Перенаправляем...')
            const ADMIN_EMAILS = ['dgmukhin@gmail.com']
            const isAdminUser = ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')
                || user.user_metadata?.role === 'admin'
                || user.user_metadata?.role === 'curator'
                || user.user_metadata?.role === 'trainer'
            if (isAdminUser) {
                window.location.href = '/admin'
            } else {
                getRedirectTarget(user).then(target => { window.location.href = target })
            }
        }
    }, [user, authLoading, isRedirecting])

    // Таймер кулдауна для повторной отправки письма
    useEffect(() => {
        if (resendCooldown <= 0) return
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [resendCooldown])

    const handleResendConfirmation = async () => {
        if (resendCooldown > 0 || !email) return
        setResendCooldown(60)
        const supabase = createClient()
        await supabase.auth.resend({ type: 'signup', email })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setEmailNotConfirmed(false)
        setIsSubmitting(true)

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password)
                if (error) {
                    if (error.message.includes('Email not confirmed')) {
                        setEmailNotConfirmed(true)
                        setError('Email не подтверждён. Проверьте почту или отправьте письмо повторно.')
                    } else {
                        setError(getErrorMessage(error.message))
                    }
                    setIsSubmitting(false)
                } else {
                    setIsRedirecting(true)
                    setRedirectMessage('Добро пожаловать! Переходим...')
                    const { createClient } = await import('@/lib/supabase/client')
                    const { data: { user: loggedUser } } = await createClient().auth.getUser()
                    const target = loggedUser ? await getRedirectTarget(loggedUser) : returnTo
                    setTimeout(() => { window.location.href = target }, 800)
                }
            } else {
                if (password.length < 6) {
                    setError('Пароль должен содержать минимум 6 символов')
                    setIsSubmitting(false)
                    return
                }
                if (password !== confirmPassword) {
                    setError('Пароли не совпадают')
                    setIsSubmitting(false)
                    return
                }

                const { error } = await signUp(email, password, fullName)
                if (error) {
                    setError(getErrorMessage(error.message))
                    setIsSubmitting(false)
                } else {
                    setIsRedirecting(true)
                    setRedirectMessage(`Аккаунт создан! Переходим к оплате...`)
                    const { createClient } = await import('@/lib/supabase/client')
                    const { data: { user: loggedUser } } = await createClient().auth.getUser()
                    let target = loggedUser ? await getRedirectTarget(loggedUser) : returnTo
                    // Если возвращаемся на страницу оплаты — добавляем флаг чтобы показать приветствие
                    if (target.includes('/payment')) {
                        target += (target.includes('?') ? '&' : '?') + 'registered=true'
                    }
                    setTimeout(() => { window.location.href = target }, 1500)
                }
            }
        } catch (err) {
            setError('Произошла ошибка. Попробуйте позже.')
            setIsSubmitting(false)
        }
    }

    const getErrorMessage = (message: string): string => {
        if (message.includes('Invalid login credentials')) return 'Неверный email или пароль'
        if (message.includes('Email not confirmed')) return 'Email не подтверждён. Проверьте почту.'
        if (message.includes('User already registered')) return 'Пользователь с таким email уже зарегистрирован'
        if (message.includes('email rate limit exceeded') || message.includes('rate limit')) {
            return 'Слишком много попыток. Подождите несколько минут и попробуйте снова.'
        }
        if (message.includes('Password should be at least')) return 'Пароль должен содержать минимум 6 символов'
        if (message.includes('Unable to validate email address')) return 'Некорректный email адрес'
        if (message.includes('signup_disabled')) return 'Регистрация временно отключена'
        return message
    }


    // ── ЭКРАН ПЕРЕХОДА ──────────────────────────────────────────────────
    if (isRedirecting) {
        return (
            <div className="min-h-screen bg-deep-dark flex flex-col items-center justify-center p-4">
                <div className="fixed inset-0 bg-gradient-to-br from-meta-orange/10 via-transparent to-green-500/10 pointer-events-none" />

                <div className="relative text-center">
                    {/* Анимированная иконка */}
                    <div className="relative mb-8 inline-flex items-center justify-center">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-meta-orange to-meta-orange-600 flex items-center justify-center shadow-glow-orange">
                            <CheckCircle className="w-12 h-12 text-white" />
                        </div>
                        {/* Пульсирующий ореол */}
                        <div className="absolute inset-0 rounded-3xl bg-meta-orange/30 animate-ping" />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-3">
                        {mode === 'register' ? '🎉 Аккаунт создан!' : '✅ Вход выполнен!'}
                    </h1>

                    <p className="text-gray-400 text-lg mb-8">{redirectMessage}</p>

                    {/* Прогресс-бар */}
                    <div className="w-64 h-1.5 bg-white/10 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-meta-orange to-yellow-400 rounded-full animate-progress" />
                    </div>

                    <p className="text-xs text-gray-600 mt-4">Пожалуйста, не закрывайте страницу</p>
                </div>

                <style jsx>{`
                    @keyframes progress {
                        from { width: 0%; }
                        to { width: 100%; }
                    }
                    .animate-progress {
                        animation: progress 1.4s ease-in-out forwards;
                    }
                `}</style>
            </div>
        )
    }

    // ── ФОРМА АВТОРИЗАЦИИ ────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-deep-dark flex items-start justify-center p-4 py-6 overflow-y-auto">
            <div className="w-full max-w-md my-auto">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                    flex items-center justify-center mx-auto mb-3 shadow-glow-orange">
                        <Flame className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Архитектура твоего тела</h1>
                    <p className="text-gray-400 mt-1 text-sm">Научная система трансформации, построенная на принципах адаптации и периодизации</p>
                </div>

                {/* Баннер контекста оплаты */}
                {isPaymentFlow && (
                    <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/5 p-4">
                        {/* Шаги */}
                        <div className="flex items-center justify-center gap-2 mb-3 text-xs font-medium">
                            <span className="flex items-center gap-1 text-accent">
                                <span className="w-5 h-5 rounded-full bg-accent text-bg-main flex items-center justify-center font-bold text-[10px]">1</span>
                                Тариф выбран
                            </span>
                            <span className="text-white/20">──</span>
                            <span className="flex items-center gap-1 text-white font-semibold">
                                <span className="w-5 h-5 rounded-full bg-white text-bg-main flex items-center justify-center font-bold text-[10px]">2</span>
                                Аккаунт
                            </span>
                            <span className="text-white/20">──</span>
                            <span className="flex items-center gap-1 text-white/40">
                                <span className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center font-bold text-[10px]">3</span>
                                Оплата
                            </span>
                        </div>

                        <p className="text-sm text-white/80 text-center mb-3">
                            Создайте аккаунт — это нужно чтобы привязать платёж к вашему личному кабинету.
                            Займёт 30 секунд.
                        </p>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-xs text-white/60">
                                <ShieldCheck className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                После регистрации вы вернётесь на страницу оплаты
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/60">
                                <CreditCard className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                Оплата через ЮMoney — безопасно и без комиссии
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/60">
                                <ShieldCheck className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                Гарантия возврата в течение 5 дней — без вопросов
                            </div>
                        </div>
                    </div>
                )}

                {/* Auth Card */}
                <div className="glass-card p-6">
                    {/* Mode Tabs */}
                    <div className="flex rounded-xl bg-deep-dark-200 p-1 mb-5">
                        <button
                            onClick={() => { setMode('login'); setError('') }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'login'
                                ? 'bg-meta-orange text-black'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Вход
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError('') }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'register'
                                ? 'bg-meta-orange text-black'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Регистрация
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30">
                            <p className="text-sm text-red-400">{error}</p>
                            {emailNotConfirmed && (
                                <button
                                    onClick={handleResendConfirmation}
                                    disabled={resendCooldown > 0}
                                    className="mt-2 text-xs text-meta-orange underline disabled:opacity-50 disabled:no-underline"
                                >
                                    {resendCooldown > 0
                                        ? `Отправить повторно через ${resendCooldown}с`
                                        : 'Отправить письмо повторно'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name (Register only) */}
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                    Ваше имя
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280', pointerEvents: 'none', zIndex: 1 }} />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Как к вам обращаться?"
                                        className="glass-input glass-input-icon w-full"
                                        required={mode === 'register'}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                Email
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280', pointerEvents: 'none', zIndex: 1 }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="glass-input glass-input-icon w-full"
                                    required
                                    autoFocus={mode === 'login'}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                Пароль
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280', pointerEvents: 'none', zIndex: 1 }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
                                    style={{ paddingRight: '44px' }}
                                    className="glass-input glass-input-icon w-full"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: 0, zIndex: 1 }}
                                >
                                    {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password (Register only) */}
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                    Повторите пароль
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280', pointerEvents: 'none', zIndex: 1 }} />
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        style={{ paddingRight: '44px' }}
                                        className={`glass-input glass-input-icon w-full ${
                                            confirmPassword && confirmPassword !== password
                                                ? 'border-red-500/60'
                                                : confirmPassword && confirmPassword === password
                                                ? 'border-green-500/60'
                                                : ''
                                        }`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: 0, zIndex: 1 }}
                                    >
                                        {showConfirmPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                                    </button>
                                </div>
                                {confirmPassword && confirmPassword !== password && (
                                    <p className="text-xs text-red-400 mt-1.5 ml-1">Пароли не совпадают</p>
                                )}
                                {confirmPassword && confirmPassword === password && (
                                    <p className="text-xs text-green-400 mt-1.5 ml-1">✓ Пароли совпадают</p>
                                )}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="glass-button w-full flex items-center justify-center gap-2 py-4 mt-4"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {mode === 'login' ? 'Входим...' : 'Создаём аккаунт...'}
                                </>
                            ) : (
                                <>
                                    {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Back */}
                    <div className="mt-5 pt-5 border-t border-white/10">
                        <button
                            onClick={() => router.push('/')}
                            className="glass-button-secondary w-full text-sm"
                        >
                            ← На главную
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-500 mt-4 mb-4">
                    Продолжая, вы соглашаетесь с условиями использования
                </p>
            </div>
        </div>
    )
}
