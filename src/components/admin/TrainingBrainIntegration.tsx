'use client'

import { useEffect, useState } from 'react'
import { GitBranch, Download, Loader2, Check, X, Pencil } from 'lucide-react'
import { updateTrainingBrainClientId } from '@/lib/services/admin'
import { createClient } from '@/lib/supabase/client'

interface ImportResult {
    md: string
    weekNumber: number
    mesocycle: number
    period_start?: string
    period_end?: string
    path: string
    trainingBrainClientId: string
}

interface Props {
    /** ID клиента в MetaSystem */
    userId: string
    /** Текущий slug в training-brain (или null) */
    initialSlug: string | null | undefined
    /** Колбэк когда клик импорта вернул успех — родитель открывает модалку загрузки с предзаполненными полями */
    onImportSuccess: (data: ImportResult) => void
}

/**
 * Карточка интеграции с training-brain в админке:
 *   - Slug клиента (training_brain_client_id)
 *   - Кнопка "Загрузить из training-brain" (импорт последней week-N.md)
 */
export default function TrainingBrainIntegration({ userId, initialSlug, onImportSuccess }: Props) {
    const [slug, setSlug] = useState(initialSlug || '')
    const [editing, setEditing] = useState(false)
    const [savingSlug, setSavingSlug] = useState(false)
    const [slugError, setSlugError] = useState<string | null>(null)
    const [slugSavedAt, setSlugSavedAt] = useState<number | null>(null)

    const [importing, setImporting] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    const [importHint, setImportHint] = useState<string | null>(null)

    const isSlugSet = !!slug.trim()

    useEffect(() => {
        if (slugSavedAt) {
            const t = setTimeout(() => setSlugSavedAt(null), 2000)
            return () => clearTimeout(t)
        }
    }, [slugSavedAt])

    const handleSaveSlug = async () => {
        setSavingSlug(true)
        setSlugError(null)
        try {
            const value = slug.trim()
            if (value && !/^[a-z0-9-]+$/.test(value)) {
                throw new Error('Slug может содержать только латиницу, цифры и дефис')
            }
            await updateTrainingBrainClientId(userId, value || null)
            setEditing(false)
            setSlugSavedAt(Date.now())
        } catch (e: any) {
            setSlugError(e?.message || 'Ошибка сохранения')
        } finally {
            setSavingSlug(false)
        }
    }

    const handleImport = async () => {
        if (!isSlugSet) return
        setImporting(true)
        setImportError(null)
        setImportHint(null)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 60_000)

        try {
            const sb = createClient()
            const { data: { session } } = await sb.auth.getSession()
            if (!session?.access_token) throw new Error('Нет токена сессии')

            const res = await fetch('/api/admin/training-brain/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ userId }),
                signal: controller.signal,
            })
            const json = await res.json()
            if (!res.ok) {
                setImportError(json.error || `Ошибка ${res.status}`)
                if (json.hint) setImportHint(json.hint)
                return
            }
            onImportSuccess(json as ImportResult)
        } catch (e: any) {
            if (e?.name === 'AbortError') {
                setImportError('Сервер не отвечает (60+ сек). Попробуй ещё раз через минуту.')
            } else {
                setImportError(e?.message || 'Не удалось импортировать неделю')
            }
        } finally {
            clearTimeout(timeout)
            setImporting(false)
        }
    }

    return (
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent flex-shrink-0" />
                <h3 className="text-sm font-display font-semibold text-white">training-brain</h3>
                <span className="text-xs text-text-muted">синхронизация с репозиторием</span>
            </div>

            {/* Slug клиента */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-secondary">client_id:</span>
                {editing ? (
                    <>
                        <input
                            type="text"
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            placeholder="dimon"
                            className="glass-input text-sm py-1.5 px-2 max-w-[200px]"
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveSlug()
                                if (e.key === 'Escape') { setEditing(false); setSlug(initialSlug || '') }
                            }}
                        />
                        <button
                            onClick={handleSaveSlug}
                            disabled={savingSlug}
                            className="glass-button-secondary p-1.5 text-success hover:border-success/40"
                            title="Сохранить"
                        >
                            {savingSlug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={() => { setEditing(false); setSlug(initialSlug || ''); setSlugError(null) }}
                            className="glass-button-secondary p-1.5"
                            title="Отмена"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                ) : (
                    <>
                        <code className={`text-sm px-2 py-1 rounded font-mono ${isSlugSet ? 'bg-accent/10 text-accent' : 'bg-text-muted/10 text-text-muted'}`}>
                            {isSlugSet ? slug : 'не задан'}
                        </code>
                        <button
                            onClick={() => setEditing(true)}
                            className="glass-button-secondary p-1.5"
                            title="Изменить"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {slugSavedAt && (
                            <span className="text-xs text-success flex items-center gap-1">
                                <Check className="w-3 h-3" />Сохранено
                            </span>
                        )}
                    </>
                )}
            </div>
            {slugError && <p className="text-xs text-danger">{slugError}</p>}
            {!isSlugSet && !editing && (
                <p className="text-xs text-text-muted">
                    Введи имя папки клиента в репо training-brain, например <code className="font-mono">dimon</code> или <code className="font-mono">dmitry-mukhin</code>.
                </p>
            )}

            {/* Кнопка импорта */}
            <button
                type="button"
                disabled={!isSlugSet || importing}
                onClick={handleImport}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-3 py-2.5 text-sm font-semibold text-accent"
                title={!isSlugSet ? 'Сначала укажи client_id выше' : 'Загрузить последнюю неделю из training-brain'}
            >
                {importing
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Импортирую...</>
                    : <><Download className="w-4 h-4" />Загрузить неделю из training-brain</>
                }
            </button>
            {importError && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
                    <p>{importError}</p>
                    {importHint && <p className="text-text-muted mt-1">{importHint}</p>}
                </div>
            )}
        </div>
    )
}
