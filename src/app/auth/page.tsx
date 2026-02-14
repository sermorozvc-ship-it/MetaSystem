'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

type AuthMode = 'login' | 'register'

export default function AuthPage() {
    const [mode, setMode] = useState<AuthMode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    const { signIn, signUp, user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && user) {
            router.replace('/dashboard')
        }
    }, [user, authLoading, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccessMessage('')
        setIsLoading(true)

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password)
                if (error) {
                    setError(getErrorMessage(error.message))
                } else {
                    router.push('/dashboard')
                }
            } else {
                if (password.length < 6) {
                    setError('Пароль должен содержать минимум 6 символов')
                    setIsLoading(false)
                    return
                }

                const { error } = await signUp(email, password, fullName)
                if (error) {
                    setError(getErrorMessage(error.message))
                } else {
                    setSuccessMessage('Письмо с подтверждением отправлено на вашу почту')
                }
            }
        } catch (err) {
            setError('Произошла ошибка. Попробуйте позже.')
        } finally {
            setIsLoading(false)
        }
    }

    const getErrorMessage = (message: string): string => {
        if (message.includes('Invalid login credentials')) {
            return 'Неверный email или пароль'
        }
        if (message.includes('Email not confirmed')) {
            return 'Email не подтверждён. Проверьте почту.'
        }
        if (message.includes('User already registered')) {
            return 'Пользователь с таким email уже зарегистрирован'
        }
        return message
    }

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
                            onClick={() => { setMode('login'); setError(''); setSuccessMessage('') }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'login'
                                ? 'bg-meta-orange text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Вход
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError(''); setSuccessMessage('') }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'register'
                                ? 'bg-meta-orange text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Регистрация
                        </button>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="p-4 mb-4 rounded-xl bg-green-500/10 border border-green-500/30">
                            <p className="text-sm text-green-400">{successMessage}</p>
                        </div>
                    )}

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

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="glass-button w-full flex items-center justify-center gap-2 py-4 mt-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {mode === 'login' ? 'Вход...' : 'Регистрация...'}
                                </>
                            ) : (
                                <>
                                    {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Demo Mode */}
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="glass-button-secondary w-full text-sm"
                        >
                            Демо-режим (без регистрации)
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-500 mt-6">
                    Продолжая, вы соглашаетесь с условиями использования
                </p>
            </div>
        </div>
    )
}
