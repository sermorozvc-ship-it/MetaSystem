'use client'

import { useState } from 'react'
import { X, Send, Camera, CheckCircle, AlertCircle } from 'lucide-react'
import FileUpload from '../ui/FileUpload'
import { submitDayReport, uploadReportFiles, ReportFile } from '@/lib/services/reports'
import { useAuth } from '@/lib/auth'

interface DayReportModalProps {
    isOpen: boolean
    onClose: () => void
    dayNumber: number
}

interface UploadedFile {
    id: string
    name: string
    type: 'image' | 'document'
    preview?: string
    file: File
}

export default function DayReportModal({ isOpen, onClose, dayNumber }: DayReportModalProps) {
    const { user } = useAuth()
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [comment, setComment] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    if (!isOpen) return null

    const handleSubmit = async () => {
        if (files.length === 0) return

        setIsSubmitting(true)
        setSubmitStatus('idle')
        setErrorMessage('')

        try {
            let reportFiles: ReportFile[] = []

            if (user) {
                // Real mode: upload files to storage first
                const rawFiles = files.map(f => f.file)
                reportFiles = await uploadReportFiles(dayNumber, rawFiles, user.id)

                if (reportFiles.length === 0 && files.length > 0) {
                    throw new Error('Не удалось загрузить файлы. Попробуйте еще раз.')
                }
            } else {
                // Demo mode (no auth), we'll save file info locally (previews)
                reportFiles = files.map(f => ({
                    name: f.name,
                    url: f.preview || '',
                    type: f.file.type
                }))
            }

            // Submit the report — передаём user.id явно через параметр чтобы избежать проблемы с кешем
            const result = await submitDayReport(dayNumber, reportFiles, comment || undefined, user?.id)

            if (result.success) {
                setSubmitStatus('success')

                // Reset after showing success
                setTimeout(() => {
                    setSubmitStatus('idle')
                    setFiles([])
                    setComment('')
                    onClose()
                }, 2000)
            } else {
                setSubmitStatus('error')
                setErrorMessage(result.error || 'Произошла ошибка при отправке')
            }
        } catch (error: any) {
            setSubmitStatus('error')
            setErrorMessage(error.message || 'Произошла ошибка при отправке')
            console.error('Submit error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const reportRequirements: Record<number, string[]> = {
        1: [
            'Скриншот результата из Калькулятора (с зоной риска)',
            'Фото продуктового набора (открытый холодильник или стол)'
        ],
        2: [
            'Фото после тренировки',
            'Скриншот трекера питания (3 приёма пищи)'
        ],
        3: [
            'Скриншот шагомера (8000+ шагов)',
            'Фото рабочего места (стоячий режим)'
        ],
        4: [
            'Фото после HIIT-тренировки',
            'Фото обеда со сложными углеводами'
        ],
        5: [
            'Фото ужина (белок + овощи)',
            'Фото после тренировки на мобильность'
        ],
        6: [
            'Фото прогулки на свежем воздухе'
        ],
        7: [
            'Финальные измерения тела (скриншот)',
            'Фото до/после (по желанию)',
            'Заполненный дневник'
        ]
    }

    const requirements = reportRequirements[dayNumber] || []

    if (submitStatus === 'success') {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div
                    className="glass-card p-8 w-full max-w-md animate-fade-in text-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Отчёт отправлен!</h2>
                    <p className="text-gray-400">Куратор проверит ваш отчёт в ближайшее время</p>
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="glass-card w-full max-w-lg animate-fade-in mx-3 flex flex-col overflow-hidden"
                style={{
                    maxHeight: 'calc(100dvh - 80px)',
                    marginBottom: 'max(16px, env(safe-area-inset-bottom, 16px))'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-meta-orange/20 flex items-center justify-center shrink-0">
                                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-meta-orange" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Отчёт по Дню {dayNumber}</h2>
                                <p className="text-xs sm:text-sm text-gray-400">Загрузите фото для проверки</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                   text-gray-400 hover:text-white transition-colors shrink-0"
                        >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    {/* Error Message */}
                    {submitStatus === 'error' && (
                        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            <p className="text-xs sm:text-sm text-red-400">{errorMessage}</p>
                        </div>
                    )}

                    {/* Requirements */}
                    {requirements.length > 0 && (
                        <div className="glass-card p-3 sm:p-4 mb-5 sm:mb-6 bg-deep-dark-200/40">
                            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
                                ЧТО НУЖНО ЗАГРУЗИТЬ:
                            </h3>
                            <ul className="space-y-1.5 sm:space-y-2">
                                {requirements.map((req, index) => (
                                    <li key={index} className="flex items-start gap-2 text-[13px] sm:text-sm text-gray-300 leading-snug">
                                        <span className="text-meta-orange font-semibold shrink-0">{index + 1}.</span>
                                        {req}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* File Upload */}
                    <FileUpload
                        onFilesChange={setFiles}
                        maxFiles={5}
                        acceptImages={true}
                        acceptDocuments={false}
                    />

                    {/* Comment */}
                    <div className="mt-4 sm:mt-6">
                        <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5 sm:mb-2 ml-1">
                            Комментарий (опционально)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={dayNumber === 7 ? "Как прошли эти 7 дней? Какие ощущения?" : "Как прошёл день? Какие ощущения?"}
                            className="glass-input w-full h-20 sm:h-24 resize-none text-sm"
                        />
                    </div>
                </div>

                {/* Sticky Footer with Submit Button */}
                <div className="flex-shrink-0 px-4 sm:px-6 pt-3 border-t border-white/5 bg-deep-dark-100/80 backdrop-blur-sm"
                    style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
                >
                    {/* Demo Notice */}
                    {!user && (
                        <p className="text-[10px] text-gray-600 text-center mb-2">
                            💡 Демо-режим: отчёты сохраняются локально
                        </p>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={files.length === 0 || isSubmitting}
                        className={`
                            w-full py-3.5 sm:py-4 rounded-xl font-semibold flex items-center justify-center gap-2
                            transition-all duration-200 text-sm sm:text-base
                            ${files.length === 0
                                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                                : 'glass-button shadow-lg shadow-meta-orange/10 active:scale-95'
                            }
                        `}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Отправка...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                                Отправить отчёт
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
