'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Settings, ArrowLeft, User, Bell, Globe,
    LogOut, ChevronRight, Shield, Trash2, Eye, EyeOff, Save, X,
    Volume2, Smartphone, Info, Mail
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'

export default function SettingsPage() {
    const { user, signOut, isLoading: authLoading } = useAuth()
    const router = useRouter()

    // Settings state

    const [showPasswordForm, setShowPasswordForm] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Profile state
    const [fullName, setFullName] = useState('')
    const [editingName, setEditingName] = useState(false)

    useEffect(() => {
        if (user) {
            setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
        }
    }, [user])

    const handleSignOut = async () => {
        try {
            await signOut()
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    const handleSaveName = async () => {
        if (!user) return
        setSaving(true)
        try {
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            })

            if (error) {
                setMessage({ type: 'error', text: 'Не удалось обновить имя' })
            } else {
                setMessage({ type: 'success', text: 'Имя обновлено!' })
                setEditingName(false)
            }
        } catch {
            setMessage({ type: 'error', text: 'Ошибка при сохранении' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Пароль должен быть не менее 6 символов' })
            return
        }
        setSaving(true)
        try {
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (error) {
                setMessage({ type: 'error', text: error.message })
            } else {
                setMessage({ type: 'success', text: 'Пароль изменен!' })
                setShowPasswordForm(false)
                setNewPassword('')
                setCurrentPassword('')
            }
        } catch {
            setMessage({ type: 'error', text: 'Ошибка при смене пароля' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }


    return (
        <div className="flex min-h-screen bg-deep-dark">
            <Sidebar activeItem="settings" />

            <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-3xl">
                {/* Header */}
                <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-xl bg-deep-dark-200/60 border border-white/10
                                   flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
                            <Settings className="w-5 h-5 md:w-7 md:h-7 text-meta-orange" />
                            Настройки
                        </h1>
                        <p className="text-xs md:text-sm text-gray-400 mt-1">Управление аккаунтом и предпочтениями</p>
                    </div>
                </div>

                {/* Status Message */}
                {message && (
                    <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in ${message.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                        }`}>
                        {message.type === 'success' ? '✓' : '✗'} {message.text}
                    </div>
                )}

                {authLoading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-32 rounded-2xl bg-white/5" />
                        <div className="h-24 rounded-2xl bg-white/5" />
                        <div className="h-16 rounded-2xl bg-white/5" />
                    </div>
                ) : (
                    <>
                        {/* Profile Section */}
                        <div className="glass-card p-4 md:p-6 mb-4 md:mb-6">
                            <h2 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-meta-orange" />
                                Профиль
                            </h2>

                            {/* Avatar & Name */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-meta-orange to-meta-orange-600
                                        flex items-center justify-center text-white font-bold text-xl shrink-0">
                                    {(fullName || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {editingName ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={fullName}
                                                onChange={e => setFullName(e.target.value)}
                                                className="glass-input flex-1 py-2 text-sm"
                                                autoFocus
                                            />
                                            <button onClick={handleSaveName} disabled={saving} className="text-green-400 p-2">
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditingName(false)} className="text-gray-400 p-2">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div onClick={() => setEditingName(true)} className="cursor-pointer group">
                                            <h3 className="text-base font-semibold text-white group-hover:text-meta-orange transition-colors">
                                                {fullName || 'Нет имени'}
                                            </h3>
                                            <p className="text-xs text-gray-500">Нажмите для изменения</p>
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-400 mt-1">{user?.email || 'Демо-режим'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Security Section */}
                        {user && (
                            <div className="glass-card p-4 md:p-6 mb-4 md:mb-6">
                                <h2 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-meta-orange" />
                                    Безопасность
                                </h2>

                                {/* Change Password */}
                                <button
                                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-deep-dark-200/40
                                       border border-white/5 hover:border-white/10 transition-all mb-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <span className="text-sm text-white">Сменить пароль</span>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`} />
                                </button>

                                {showPasswordForm && (
                                    <div className="p-4 rounded-2xl bg-deep-dark-200/40 border border-white/5 mb-3 space-y-3 animate-fade-in">
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Новый пароль (мин. 6 символов)"
                                                className="glass-input w-full pr-10"
                                            />
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleChangePassword}
                                            disabled={saving || newPassword.length < 6}
                                            className="glass-button w-full text-sm py-2.5 disabled:opacity-50"
                                        >
                                            {saving ? 'Сохранение...' : 'Сохранить пароль'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* About Section */}
                        <div className="glass-card p-4 md:p-6 mb-4 md:mb-6">
                            <h2 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Info className="w-5 h-5 text-meta-orange" />
                                О приложении
                            </h2>

                            <div className="space-y-3 text-sm text-gray-400">

                                <div className="flex items-center justify-between p-3 rounded-xl bg-deep-dark-200/40">
                                    <span>Курс</span>
                                    <span className="text-white">Метаболический Запуск</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl bg-deep-dark-200/40">
                                    <span>Длительность</span>
                                    <span className="text-white">7 дней</span>
                                </div>
                            </div>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl
                               bg-red-500/10 border border-red-500/20 hover:border-red-500/40
                               text-red-400 hover:text-red-300 transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Выйти из аккаунта</span>
                        </button>
                    </>
                )}
            </main>
        </div>
    )
}
