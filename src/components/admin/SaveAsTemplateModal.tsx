'use client'

import { useState } from 'react'
import { Check, Loader2, Save, X } from 'lucide-react'
import { createTemplate } from '@/lib/services/program-templates'
import { parseMdToJson } from '@/lib/utils/md-parser'

interface Props {
    open: boolean
    onClose: () => void
    /** Markdown программы, который нужно сохранить как шаблон */
    programMd: string
    /** Кол-во тренировочных дней — подставится в шаблон */
    trainingDaysCount: number
    /** Дефолтное имя (можно подкинуть «Неделя N — клиент») */
    suggestedName?: string
    onSaved?: () => void
}

/**
 * Модалка «Сохранить как шаблон».
 * Берёт существующий MD из формы загрузки программы и сохраняет в библиотеку.
 */
export default function SaveAsTemplateModal({
    open,
    onClose,
    programMd,
    trainingDaysCount,
    suggestedName,
    onSaved,
}: Props) {
    const [name, setName] = useState(suggestedName ?? '')
    const [description, setDescription] = useState('')
    const [tagsRaw, setTagsRaw] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (!open) return null

    const handleSave = async () => {
        setError('')
        if (!name.trim()) {
            setError('Введи имя шаблона')
            return
        }
        if (!programMd.trim()) {
            setError('MD программы пустой — сохранять нечего')
            return
        }

        setSaving(true)
        try {
            const tags = tagsRaw
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean)

            let programData = null
            try {
                programData = parseMdToJson(programMd)
            } catch {
                // если MD кривой — сохраним без program_data, парсер починят при применении
                programData = null
            }

            await createTemplate({
                name,
                description,
                trainingDaysCount,
                programMd,
                programData,
                tags,
            })
            onSaved?.()
            onClose()
            // ресет формы
            setName('')
            setDescription('')
            setTagsRaw('')
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сохранения'
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative z-10 glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-accent" />
                        <h2 className="text-xl font-display font-bold text-white">
                            Сохранить как шаблон
                        </h2>
                    </div>
                    <button onClick={onClose} className="glass-button-secondary p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-text-secondary mb-2">
                            Имя шаблона *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="glass-input w-full"
                            placeholder="Например: Масса 4 дня — толкай/тяни"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-text-secondary mb-2">
                            Описание (необязательно)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="glass-input w-full h-20 resize-none"
                            placeholder="Для каких клиентов, какая идея, особенности..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-text-secondary mb-2">
                            Теги через запятую (необязательно)
                        </label>
                        <input
                            type="text"
                            value={tagsRaw}
                            onChange={(e) => setTagsRaw(e.target.value)}
                            className="glass-input w-full"
                            placeholder="масса, начинающие, 4 дня"
                        />
                        <p className="text-xs text-text-muted mt-1">
                            По тегам потом удобно фильтровать в библиотеке.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="glass-button-secondary flex-1"
                            disabled={saving}
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="glass-button flex-1 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Сохранить
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
