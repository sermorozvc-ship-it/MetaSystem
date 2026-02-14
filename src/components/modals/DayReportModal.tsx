'use client'

import { useState } from 'react'
import { X, Send, Camera, CheckCircle, AlertCircle } from 'lucide-react'
import FileUpload from '../ui/FileUpload'
import { submitDayReport, ReportFile } from '@/lib/services/reports'

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
            // Convert uploaded files to ReportFile format
            // For demo mode (no auth), we'll save file info locally
            const reportFiles: ReportFile[] = files.map(f => ({
                name: f.name,
                url: f.preview || '',
                type: f.file.type
            }))

            // Submit the report
            const result = await submitDayReport(dayNumber, reportFiles, comment || undefined)

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
        } catch (error) {
            setSubmitStatus('error')
            setErrorMessage('Произошла ошибка при отправке')
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
            'Скриншот времени отхода ко сну',
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
                className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-meta-orange/20 flex items-center justify-center">
                            <Camera className="w-6 h-6 text-meta-orange" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Отчёт по Дню {dayNumber}</h2>
                            <p className="text-sm text-gray-400">Загрузите фото для проверки</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-deep-dark-200 flex items-center justify-center
                                   text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Error Message */}
                {submitStatus === 'error' && (
                    <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/30">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <p className="text-sm text-red-400">{errorMessage}</p>
                    </div>
                )}

                {/* Requirements */}
                {requirements.length > 0 && (
                    <div className="glass-card p-4 mb-6 bg-deep-dark-200/40">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Что нужно загрузить:
                        </h3>
                        <ul className="space-y-2">
                            {requirements.map((req, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                                    <span className="text-meta-orange font-semibold">{index + 1}.</span>
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
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Комментарий (опционально)
                    </label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Как прошёл день? Какие ощущения?"
                        className="glass-input w-full h-24 resize-none"
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={files.length === 0 || isSubmitting}
                    className={`
                        w-full mt-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2
                        transition-all duration-200
                        ${files.length === 0
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'glass-button'
                        }
                    `}
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Отправка...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Отправить отчёт
                        </>
                    )}
                </button>

                {/* Demo Notice */}
                <p className="text-xs text-gray-500 text-center mt-4">
                    💡 Демо-режим: отчёты сохраняются локально
                </p>
            </div>
        </div>
    )
}
