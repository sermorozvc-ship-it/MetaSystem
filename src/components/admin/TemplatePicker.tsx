'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, X, Layers, Calendar, Tag, FileText } from 'lucide-react'
import {
    listTemplates,
    type ProgramTemplate,
} from '@/lib/services/program-templates'

interface Props {
    open: boolean
    onClose: () => void
    /** Колбэк вызывается с выбранным шаблоном */
    onPick: (template: ProgramTemplate) => void
}

/**
 * Модалка выбора шаблона программы.
 * Поиск по имени/описанию/тегам, превью MD, статистика usage_count.
 */
export default function TemplatePicker({ open, onClose, onPick }: Props) {
    const [templates, setTemplates] = useState<ProgramTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')
    const [activeTag, setActiveTag] = useState<string | null>(null)
    const [previewId, setPreviewId] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setLoading(true)
        setError('')
        listTemplates()
            .then(setTemplates)
            .catch((e) => setError(e.message || 'Ошибка загрузки'))
            .finally(() => setLoading(false))
    }, [open])

    const allTags = useMemo(() => {
        const set = new Set<string>()
        templates.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)))
        return Array.from(set).sort()
    }, [templates])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return templates.filter((t) => {
            if (activeTag && !(t.tags || []).includes(activeTag)) return false
            if (!q) return true
            const hay = `${t.name} ${t.description ?? ''} ${(t.tags || []).join(' ')}`.toLowerCase()
            return hay.includes(q)
        })
    }, [templates, query, activeTag])

    const preview = previewId ? templates.find((t) => t.id === previewId) : null

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative z-10 glass-card p-6 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-accent" />
                        <h2 className="text-xl font-display font-bold text-white">
                            Выбрать шаблон программы
                        </h2>
                    </div>
                    <button onClick={onClose} className="glass-button-secondary p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Поиск */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Поиск по имени, описанию, тегам..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="glass-input glass-input-icon w-full"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Теги */}
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
                        <button
                            onClick={() => setActiveTag(null)}
                            className={`px-3 py-1 rounded-full text-xs transition-all ${
                                activeTag === null
                                    ? 'bg-accent text-bg-main font-semibold'
                                    : 'glass-button-secondary text-text-secondary'
                            }`}
                        >
                            Все
                        </button>
                        {allTags.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                                className={`px-3 py-1 rounded-full text-xs transition-all ${
                                    activeTag === tag
                                        ? 'bg-accent text-bg-main font-semibold'
                                        : 'glass-button-secondary text-text-secondary'
                                }`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}

                {/* Контент */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                    {/* Список */}
                    <div className="overflow-y-auto pr-1 space-y-2">
                        {loading && (
                            <div className="flex items-center justify-center py-12 text-text-muted">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        )}
                        {error && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                                {error}
                            </div>
                        )}
                        {!loading && !error && filtered.length === 0 && (
                            <div className="text-center py-12 text-text-muted">
                                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">
                                    {templates.length === 0
                                        ? 'Шаблонов пока нет. Создай первый из существующей программы или вручную.'
                                        : 'По фильтру ничего не найдено.'}
                                </p>
                            </div>
                        )}
                        {!loading &&
                            filtered.map((t) => {
                                const isActive = previewId === t.id
                                const days = t.program_data?.days?.length ?? t.training_days_count
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => setPreviewId(t.id)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                                            isActive
                                                ? 'border-accent bg-accent/10'
                                                : 'border-border bg-bg-elevated hover:border-accent/40'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="text-sm font-semibold text-white truncate">
                                                {t.name}
                                            </h3>
                                            {t.usage_count > 0 && (
                                                <span className="text-xs text-text-muted flex-shrink-0">
                                                    × {t.usage_count}
                                                </span>
                                            )}
                                        </div>
                                        {t.description && (
                                            <p className="text-xs text-text-secondary mb-2 line-clamp-2">
                                                {t.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="text-text-muted flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                                            </span>
                                            {(t.tags || []).slice(0, 3).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="text-accent flex items-center gap-0.5"
                                                >
                                                    <Tag className="w-3 h-3" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                )
                            })}
                    </div>

                    {/* Превью */}
                    <div className="hidden md:flex flex-col bg-bg-elevated rounded-xl border border-border overflow-hidden">
                        {preview ? (
                            <>
                                <div className="p-4 border-b border-border flex-shrink-0">
                                    <h3 className="font-display font-bold text-white">
                                        {preview.name}
                                    </h3>
                                    {preview.description && (
                                        <p className="text-xs text-text-secondary mt-1">
                                            {preview.description}
                                        </p>
                                    )}
                                </div>
                                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono p-4 overflow-y-auto flex-1">
                                    {preview.program_md}
                                </pre>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-text-muted text-sm p-6 text-center">
                                Выбери шаблон слева, чтобы увидеть превью
                            </div>
                        )}
                    </div>
                </div>

                {/* Действия */}
                <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-border flex-shrink-0">
                    <button onClick={onClose} className="glass-button-secondary flex-1">
                        Отмена
                    </button>
                    <button
                        onClick={() => preview && onPick(preview)}
                        disabled={!preview}
                        className="glass-button flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Применить шаблон
                    </button>
                </div>
            </div>
        </div>
    )
}
