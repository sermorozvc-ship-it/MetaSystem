'use client'

import { useState } from 'react'
import { Trophy, ShieldAlert, Trash2, LogOut, CheckCircle2, ArrowRight } from 'lucide-react'
import { purgeUserData } from '@/lib/services/user'

interface CourseConclusionModalProps {
    isOpen: boolean
    onClose: () => void
    userName: string
}

export default function CourseConclusionModal({ isOpen, onClose, userName }: CourseConclusionModalProps) {
    const [step, setStep] = useState<'congrats' | 'confirm'>('congrats')
    const [isPurging, setIsPurging] = useState(false)

    if (!isOpen) return null

    const handlePurge = async () => {
        setIsPurging(true)
        const result = await purgeUserData()
        if (result.success) {
            window.location.href = '/' // Редирект на главную после удаления
        } else {
            alert('Ошибка при удалении данных: ' + result.error)
            setIsPurging(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
                onClick={step === 'congrats' ? onClose : undefined}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-deep-dark-100 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
                {step === 'congrats' ? (
                    <div className="p-8 text-center">
                        <div className="w-24 h-24 bg-meta-orange/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-glow-orange-sm">
                            <Trophy className="w-12 h-12 text-meta-orange animate-bounce" />
                        </div>

                        <h2 className="text-3xl font-black text-white mb-4 leading-tight">
                            Поздравляем, <span className="text-meta-orange">{userName}</span>!
                        </h2>

                        <p className="text-gray-400 text-lg mb-10 leading-relaxed font-medium">
                            Вы успешно завершили 7-дневный курс «Метаболический Запуск».
                            Это невероятный результат и важный шаг к вашей идеальной форме!
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => setStep('confirm')}
                                className="w-full py-5 rounded-2xl bg-white text-black font-black flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
                            >
                                <ShieldAlert className="w-6 h-6" />
                                Завершить и очистить данные
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:text-white transition-all underline underline-offset-4 decoration-white/10"
                            >
                                Посмотреть результаты ещё раз
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Удаление данных</h3>
                                <p className="text-sm text-gray-400">Конфиденциальность превыше всего</p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 mb-8 space-y-4">
                            <div className="flex gap-3 text-sm text-gray-300">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p>Все ваши отчеты и фото будут **навсегда удалены** из нашего облака.</p>
                            </div>
                            <div className="flex gap-3 text-sm text-gray-300">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p>История сообщений и прогресс будут стерты без возможности восстановления.</p>
                            </div>
                            <div className="flex gap-3 text-sm text-gray-300">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p>Ваш профиль будет удален, и мы автоматически разлогиним вас.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handlePurge}
                                disabled={isPurging}
                                className="flex-[2] py-4 rounded-2xl bg-red-600 text-white font-black flex items-center justify-center gap-3 hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isPurging ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <LogOut className="w-5 h-5" />
                                        Удалить всё навсегда
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setStep('congrats')}
                                disabled={isPurging}
                                className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all"
                            >
                                Назад
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
