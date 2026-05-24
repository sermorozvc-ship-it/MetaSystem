'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import {
    parseExerciseLibrary,
    validateProgramAgainstLibrary,
    applyLibraryVideos,
    type LibraryExercise,
    type ExerciseValidationResult,
} from '@/lib/utils/exercise-library'

interface Props {
    /** Текущий markdown программы */
    programMd: string
    /** Колбэк для подмены markdown — например когда пользователь жмёт "Подставить ссылки" */
    onProgramMdChange: (md: string) => void
}

/**
 * Блок проверки программы по библиотеке упражнений из training-brain.
 *
 * Показывает:
 * - сколько упражнений нашлось в каталоге;
 * - какие НЕ нашлись (с подсказкой ближайшего по имени);
 * - у каких упражнений в библиотеке только плейсхолдер видео;
 * - кнопку «Подставить ссылки на видео» если есть что подставлять.
 *
 * При первой отрисовке тащит библиотеку через /api/admin/exercise-library.
 */
export default function ExerciseLibraryCheck({ programMd, onProgramMdChange }: Props) {
    const [library, setLibrary] = useState<LibraryExercise[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [validation, setValidation] = useState<ExerciseValidationResult | null>(null)
    const [applied, setApplied] = useState<{ count: number } | null>(null)

    const fetchLibrary = async (force = false) => {
        setLoading(true)
        setError(null)
        try {
            const url = force ? '/api/admin/exercise-library?force=1' : '/api/admin/exercise-library'
            const res = await fetch(url, { cache: force ? 'no-store' : 'default' })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                const msg = j?.error || `Не удалось получить библиотеку (${res.status})`
                const hint = j?.hint ? ` ${j.hint}` : ''
                throw new Error(`${msg}${hint}`)
            }
            const json = await res.json()
            const parsed = parseExerciseLibrary(json.md)
            setLibrary(parsed)
        } catch (e: any) {
            setError(e?.message || 'Ошибка загрузки библиотеки')
            setLibrary([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchLibrary() }, [])

    // Перевалидируем при смене текста или библиотеки
    useEffect(() => {
        if (library.length === 0) { setValidation(null); return }
        if (!programMd.trim()) { setValidation(null); return }
        setValidation(validateProgramAgainstLibrary(programMd, library))
        setApplied(null)
    }, [programMd, library])

    const handleApplyLinks = () => {
        const { md, addedCount } = applyLibraryVideos(programMd, library)
        if (addedCount > 0) {
            onProgramMdChange(md)
            setApplied({ count: addedCount })
        } else {
            setApplied({ count: 0 })
        }
    }

    if (loading) {
        return (
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Загружаем каталог упражнений из training-brain...
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-warning font-semibold">Каталог недоступен</p>
                    <p className="text-text-muted mt-0.5">{error}</p>
                    <button
                        onClick={() => fetchLibrary(true)}
                        className="mt-2 inline-flex items-center gap-1 text-warning hover:underline"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Попробовать снова
                    </button>
                </div>
            </div>
        )
    }

    if (!validation) {
        return (
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-xs text-text-muted">
                Каталог: {library.length} упражнений. Вставь markdown программы — сверим имена и ссылки.
            </div>
        )
    }

    const matchedCount = validation.matched.length
    const unknown = validation.issues.filter(i => i.kind === 'unknown')
    const placeholderVideos = validation.issues.filter(i => i.kind === 'placeholder-video')
    const unknownCount = unknown.length

    // Сколько ссылок можно подставить
    const missingVideoCount = validation.matched.filter(m =>
        m.canonical.videoUrl && !programMd.includes(`[Видео](${m.canonical.videoUrl})`)
    ).length

    const allOk = unknownCount === 0 && matchedCount > 0

    return (
        <div className="space-y-2">
            <div className={`rounded-xl border p-3 text-xs ${
                allOk
                    ? 'border-success/30 bg-success/5'
                    : unknownCount > 0
                        ? 'border-warning/30 bg-warning/5'
                        : 'border-border bg-bg-elevated/50'
            }`}>
                <div className="flex items-start gap-2">
                    {allOk
                        ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0 space-y-1">
                        <p className={`font-semibold ${allOk ? 'text-success' : 'text-warning'}`}>
                            {allOk
                                ? `Все ${matchedCount} упражнений найдены в каталоге`
                                : `Найдено ${matchedCount}, не из каталога: ${unknownCount}`
                            }
                        </p>

                        {unknown.length > 0 && (
                            <ul className="text-text-secondary space-y-0.5 mt-1">
                                {unknown.map(u => (
                                    <li key={u.nameInProgram}>
                                        <span className="text-warning">⚠</span> «{u.nameInProgram}»
                                        {u.suggestion && (
                                            <span className="text-text-muted"> похоже на «{u.suggestion}»?</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {placeholderVideos.length > 0 && (
                            <p className="text-text-muted mt-1">
                                У {placeholderVideos.length}{' '}
                                {placeholderVideos.length === 1 ? 'упражнения' : 'упражнений'} в каталоге
                                нет ссылки на видео — добавь её в exercise-library.md.
                            </p>
                        )}

                        <div className="flex items-center gap-3 pt-1">
                            <button
                                onClick={() => fetchLibrary(true)}
                                className="inline-flex items-center gap-1 text-text-muted hover:text-text-secondary"
                                title="Перечитать каталог из GitHub"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Обновить каталог
                            </button>
                            <span className="text-text-muted">·</span>
                            <span className="text-text-muted">{library.length} упражнений в каталоге</span>
                        </div>
                    </div>
                </div>
            </div>

            {missingVideoCount > 0 && (
                <button
                    type="button"
                    onClick={handleApplyLinks}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/20 transition-colors px-3 py-2 text-xs font-semibold text-accent"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Подставить ссылки на видео из каталога ({missingVideoCount})
                </button>
            )}
            {applied && (
                <p className="text-xs text-text-muted">
                    {applied.count > 0
                        ? `Подставлено ссылок: ${applied.count}`
                        : 'Нечего подставлять — все ссылки уже на месте'}
                </p>
            )}
        </div>
    )
}
