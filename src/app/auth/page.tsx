'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Flame, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'

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
    const [mode, setMode] = useState<AuthMode>(initialMode)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Состояние перехода — показывается после успешного входа/регистрации
    const [isRedirecting, setIsRedirecting] = useState(false)
    const [redirectMessage, setRedirectMessage] = useState('')

    const { signIn, signUp, user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    // Если пользователь уже авторизован — сразу редиректим
    useEffect(() => {
        if (!authLoading && user && !isRedirecting) {
            setIsRedirecting(true)
            setRedirectMessage('Перенаправляем...')
            router.replace('/payment')
        }
    }, [user, authLoading, router, isRedirecting])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsSubmitting(true)

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password)
                if (error) {
                    setError(getErrorMessage(error.message))
                    setIsSubmitting(false)
                } else {
                    // Успешный вход — показываем плавный экран перехода
                    setIsRedirecting(true)
                    setRedirectMessage('Добро пожаловать! Переходим к оплате...')
                    setTimeout(() => router.replace('/payment'), 800)
                }
            } else {
                if (password.length < 6) {
                    setError('Пароль должен содержать минимум 6 символов')
                    setIsSubmitting(false)
                    return
                }

                const { error } = await signUp(email, password, fullName)
                if (error) {
                    setError(getErrorMessage(error.message))
                    setIsSubmitting(false)
                } else {
                    // Успешная регистрация — показываем экран перехода
                    setIsRedirecting(true)
                    setRedirectMessage(`Аккаунт создан! Переходим к оплате...`)
                    // Дадим время Supabase установить сессию, потом редиректим
                    setTimeout(() => router.replace('/payment'), 1500)
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
        <div className="min-h-screen bg-deep-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                    flex items-center justify-center mx-auto mb-4 shadow-glow-orange">
                        <Flame className="w-9 h-9 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Метаболический Запуск</h1>
                    <p className="text-gray-400 mt-2">7-дневная программа перезагрузки</p>
                </div>

                {/* Auth Card */}
                <div className="glass-card p-8">
                    {/* Mode Tabs */}
                    <div className="flex rounded-xl bg-deep-dark-200 p-1 mb-6">
                        <button
                            onClick={() => { setMode('login'); setError('') }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'login'
                                ? 'bg-meta-orange text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Вход
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError('') }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'register'
                                ? 'bg-meta-orange text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Регистрация
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/30">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name (Register only) */}
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Ваше имя
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Как к вам обращаться?"
                                        className="glass-input w-full pl-12"
                                        required={mode === 'register'}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="glass-input w-full pl-12"
                                    required
                                    autoFocus={mode === 'login'}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Пароль
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
                                    className="glass-input w-full pl-12 pr-12"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="glass-button w-full flex items-center justify-center gap-2 py-4 mt-6"
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
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <button
                            onClick={() => router.push('/')}
                            className="glass-button-secondary w-full text-sm"
                        >
                            ← На главную
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-500 mt-6">
                    Продолжая, вы соглашаетесь с условиями использования
                </p>
            </div>
        </div>
    )
}
