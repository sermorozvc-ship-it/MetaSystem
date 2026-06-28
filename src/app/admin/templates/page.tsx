'use client'

// Страница управления библиотекой шаблонов программ.
// Только для админов/тренеров/кураторов.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Library, Loader2, Plus, Search, Tag, Calendar,
    Pencil, Trash2, X, Check, Save, FileText, Download, Copy,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdmin } from '@/lib/services/admin'
import { ensureSession } from '@/lib/supabase/client'
import {
    listTemplates, createTemplate, updateTemplate, deleteTemplate,
    type ProgramTemplate, type ProgramTemplateInput,
} from '@/lib/services/program-templates'
import { parseMdToJson, EXAMPLE_PROGRAM_MD } from '@/lib/utils/md-parser'

interface EditState {
    id: string | null   // null = создание, string = редактирование
    name: string
    description: string
    trainingDaysCount: number
    programMd: string
    tagsRaw: string
}

const EMPTY_EDIT: EditState = {
    id: null,
    name: '',
    description: '',
    trainingDaysCount: 3,
    programMd: '',
    tagsRaw: '',
}

export default function AdminTemplatesPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [isAdminUser, setIsAdminUser] = useState(false)
    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<ProgramTemplate[]>([])
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')
    const [activeTag, setActiveTag] = useState<string | null>(null)

    // Состояние модалки создания/редактирования
    const [edit, setEdit] = useState<EditState>(EMPTY_EDIT)
    const [editorOpen, setEditorOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editError, setEditError] = useState('')

    // Подтверждение удаления
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [toast, setToast] = useState('')

    // Превью на десктопе
    const [previewId, setPreviewId] = useState<string | null>(null)

    useEffect(() => {
        if (authLoading) return
        if (!user) { router.replace('/auth'); return }

        let cancelled = false
        const init = async () => {
            try {
                const sessionOk = await ensureSession()
                if (!sessionOk) { router.replace('/auth'); return }
                const admin = await isAdmin(user)
                if (cancelled) return
                if (!admin) { router.replace('/dashboard'); return }
                setIsAdminUser(true)
                const data = await listTemplates()
                if (!cancelled) setTemplates(data)
            } catch (e: unknown) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        init()

        // Аварийный таймаут: если данные не успели загрузиться за 8с —
        // снимаем спиннер, чтобы пользователь не сидел на лоадере вечно
        // (см. .kiro/steering/desktop-page-load.md).
        const failsafe = setTimeout(() => {
            if (!cancelled) {
                console.warn('[Templates] Failsafe — forcing loading=false')
                setLoading(false)
            }
        }, 8000)

        return () => { cancelled = true; clearTimeout(failsafe) }
        // user?.id стабилен — см. коммент в admin/page.tsx про гонку с onAuthStateChange.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading])

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

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(''), 2500)
    }

    const openCreate = () => {
        setEdit({ ...EMPTY_EDIT, programMd: EXAMPLE_PROGRAM_MD })
        setEditError('')
        setEditorOpen(true)
    }

    const openEdit = (t: ProgramTemplate) => {
        setEdit({
            id: t.id,
            name: t.name,
            description: t.description ?? '',
            trainingDaysCount: t.training_days_count,
            programMd: t.program_md,
            tagsRaw: (t.tags || []).join(', '),
        })
        setEditError('')
        setEditorOpen(true)
    }

    const handleSave = async () => {
        setEditError('')
        if (!edit.name.trim()) { setEditError('Введи имя шаблона'); return }
        if (!edit.programMd.trim()) { setEditError('Программа не может быть пустой'); return }

        setSaving(true)
        try {
            const tags = edit.tagsRaw
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean)

            let programData = null
            try {
                programData = parseMdToJson(edit.programMd)
            } catch {
                programData = null
            }

            const payload: ProgramTemplateInput = {
                name: edit.name,
                description: edit.description,
                trainingDaysCount: edit.trainingDaysCount,
                programMd: edit.programMd,
                programData,
                tags,
            }

            if (edit.id) {
                const updated = await updateTemplate(edit.id, payload)
                setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                showToast('Шаблон обновлён')
            } else {
                const created = await createTemplate(payload)
                setTemplates((prev) => [created, ...prev])
                showToast('Шаблон создан')
            }
            setEditorOpen(false)
        } catch (e: unknown) {
            setEditError(e instanceof Error ? e.message : 'Ошибка сохранения')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id)
            setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 4000)
            return
        }
        setDeletingId(id)
        try {
            await deleteTemplate(id)
            setTemplates((prev) => prev.filter((t) => t.id !== id))
            if (previewId === id) setPreviewId(null)
            showToast('Шаблон удалён')
        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : 'Ошибка удаления')
        } finally {
            setDeletingId(null)
            setConfirmDeleteId(null)
        }
    }

    const handleDownload = (t: ProgramTemplate) => {
        const blob = new Blob([t.program_md], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${t.name.replace(/[^\wа-яё\-_ ]+/giu, '').trim() || 'template'}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleCopy = async (t: ProgramTemplate) => {
        try {
            await navigator.clipboard.writeText(t.program_md)
            showToast('MD скопирован в буфер')
        } catch {
            showToast('Не удалось скопировать')
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    // Права не подтвердились (редирект уже инициирован) — не мигаем контентом
    if (!isAdminUser) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-main p-4 py-6 md:py-12">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8 min-w-0">
                    <button
                        onClick={() => router.push('/admin')}
                        className="glass-button-secondary flex items-center gap-2 flex-shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Назад</span>
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-white flex items-center gap-2">
                            <Library className="w-7 h-7 text-accent flex-shrink-0" />
                            <span className="truncate">Библиотека шаблонов</span>
                        </h1>
                        <p className="text-sm text-text-secondary">
                            Сохраняй типовые программы и применяй их одной кнопкой при загрузке клиенту
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="glass-button flex items-center gap-2 flex-shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Новый шаблон</span>
                    </button>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger mb-6">
                        {error}
                    </div>
                )}

                {/* Поиск */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Поиск по имени, описанию, тегам..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="glass-input glass-input-icon w-full"
                    />
                </div>

                {/* Теги */}
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
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
                {templates.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
                        <h3 className="text-xl font-display font-bold text-white mb-2">Шаблонов пока нет</h3>
                        <p className="text-text-secondary mb-6">
                            Создай первый шаблон вручную или сохрани существующую программу клиента в библиотеку.
                        </p>
                        <button onClick={openCreate} className="glass-button flex items-center gap-2 mx-auto">
                            <Plus className="w-4 h-4" />
                            Создать первый шаблон
                        </button>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-2 gap-4">
                        {/* Список */}
                        <div className="space-y-3">
                            {filtered.length === 0 && (
                                <div className="glass-card p-6 text-center text-text-muted text-sm">
                                    По фильтру ничего не найдено
                                </div>
                            )}
                            {filtered.map((t) => {
                                const isActive = previewId === t.id
                                const days = t.program_data?.days?.length ?? t.training_days_count
                                const isConfirming = confirmDeleteId === t.id
                                return (
                                    <div
                                        key={t.id}
                                        className={`glass-card p-4 cursor-pointer transition-all ${
                                            isActive ? 'border-accent/50' : ''
                                        }`}
                                        onClick={() => setPreviewId(t.id)}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-base font-display font-bold text-white truncate">
                                                    {t.name}
                                                </h3>
                                                {t.description && (
                                                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                                                        {t.description}
                                                    </p>
                                                )}
                                            </div>
                                            {t.usage_count > 0 && (
                                                <span className="text-xs text-text-muted flex-shrink-0">
                                                    использован × {t.usage_count}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                                            <span className="text-text-muted flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                                            </span>
                                            {(t.tags || []).map((tag) => (
                                                <span key={tag} className="text-accent flex items-center gap-0.5">
                                                    <Tag className="w-3 h-3" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Действия */}
                                        <div
                                            className="flex flex-wrap items-center gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={() => openEdit(t)}
                                                className="glass-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs hover:text-white"
                                                title="Редактировать"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                Изменить
                                            </button>
                                            <button
                                                onClick={() => handleCopy(t)}
                                                className="glass-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs hover:text-white"
                                                title="Копировать MD"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                Копировать
                                            </button>
                                            <button
                                                onClick={() => handleDownload(t)}
                                                className="glass-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs hover:text-white"
                                                title="Скачать .md"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Скачать
                                            </button>
                                            {isConfirming ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        disabled={deletingId === t.id}
                                                        className="px-3 py-1.5 rounded-xl bg-danger/20 border border-danger/40 text-danger text-xs font-semibold flex items-center gap-1.5"
                                                    >
                                                        {deletingId === t.id
                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            : <Trash2 className="w-3.5 h-3.5" />
                                                        }
                                                        Точно удалить
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="px-3 py-1.5 rounded-xl glass-button-secondary text-xs"
                                                    >
                                                        Отмена
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleDelete(t.id)}
                                                    className="glass-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:border-danger/40"
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Удалить
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Превью на десктопе */}
                        <div className="hidden lg:flex flex-col bg-bg-elevated rounded-xl border border-border overflow-hidden sticky top-6 h-[calc(100vh-8rem)]">
                            {preview ? (
                                <>
                                    <div className="p-4 border-b border-border flex-shrink-0">
                                        <h3 className="font-display font-bold text-white">{preview.name}</h3>
                                        {preview.description && (
                                            <p className="text-xs text-text-secondary mt-1">{preview.description}</p>
                                        )}
                                    </div>
                                    <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono p-4 overflow-y-auto flex-1">
                                        {preview.program_md}
                                    </pre>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-text-muted text-sm p-6 text-center">
                                    Выбери шаблон, чтобы увидеть превью
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Модалка создания/редактирования */}
            {editorOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => !saving && setEditorOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                    <div
                        className="relative z-10 glass-card p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                                {edit.id ? <Pencil className="w-5 h-5 text-accent" /> : <Plus className="w-5 h-5 text-accent" />}
                                {edit.id ? 'Редактировать шаблон' : 'Новый шаблон'}
                            </h2>
                            <button
                                onClick={() => !saving && setEditorOpen(false)}
                                className="glass-button-secondary p-2"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm text-text-secondary mb-2">Имя *</label>
                                    <input
                                        type="text"
                                        value={edit.name}
                                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                                        className="glass-input w-full"
                                        placeholder="Например: Масса 4 дня — толкай/тяни"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-2">Дней тренировок</label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="7"
                                        value={edit.trainingDaysCount}
                                        onChange={(e) => setEdit({ ...edit, trainingDaysCount: parseInt(e.target.value) || 3 })}
                                        className="glass-input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Описание</label>
                                <textarea
                                    value={edit.description}
                                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                                    className="glass-input w-full h-20 resize-none"
                                    placeholder="Для каких клиентов, какая идея, особенности..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Теги через запятую</label>
                                <input
                                    type="text"
                                    value={edit.tagsRaw}
                                    onChange={(e) => setEdit({ ...edit, tagsRaw: e.target.value })}
                                    className="glass-input w-full"
                                    placeholder="масса, начинающие, 4 дня"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm text-text-secondary">Программа (Markdown) *</label>
                                    <button
                                        onClick={() => setEdit({ ...edit, programMd: EXAMPLE_PROGRAM_MD })}
                                        className="text-xs text-accent hover:underline"
                                    >
                                        Загрузить пример
                                    </button>
                                </div>
                                <textarea
                                    value={edit.programMd}
                                    onChange={(e) => setEdit({ ...edit, programMd: e.target.value })}
                                    className="glass-input w-full h-96 resize-none font-mono text-sm"
                                    placeholder="# Неделя 1&#10;&#10;## День 1: ..."
                                />
                                <p className="text-xs text-text-muted mt-1">
                                    При применении даты и номер недели подставятся автоматически.
                                </p>
                            </div>

                            {editError && (
                                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
                                    {editError}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                    onClick={() => !saving && setEditorOpen(false)}
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
                                        <><Loader2 className="w-4 h-4 animate-spin" />Сохранение...</>
                                    ) : (
                                        <><Save className="w-4 h-4" />{edit.id ? 'Сохранить' : 'Создать'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-[70] glass-card px-4 py-3 flex items-center gap-2 text-sm text-accent border border-accent/30">
                    <Check className="w-4 h-4" />
                    {toast}
                </div>
            )}
        </div>
    )
}
