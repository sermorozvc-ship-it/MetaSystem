'use client'

import { useState } from 'react'
import { Send, Loader2, Check, ExternalLink } from 'lucide-react'

interface Props {
    programId: string
    /** ID клиента (нужен для предупреждения если slug не задан) */
    userId: string
    /** Slug в training-brain — если null, кнопка показывает подсказку */
    trainingBrainClientId?: string | null
}

/**
 * Кнопка "Отправить дневник в training-brain" для карточки программы.
 * Пушит заполненный markdown в clients/<slug>/mesocycle-N/week-N-filled.md в main.
 */
export default function PushDiaryButton({ programId, trainingBrainClientId }: Props) {
    const [pushing, setPushing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hint, setHint] = useState<string | null>(null)
    const [success, setSuccess] = useState<{ path: string; htmlUrl: string } | null>(null)

    const isSlugSet = !!trainingBrainClientId?.trim()

    const handlePush = async () => {
        setPushing(true)
        setError(null)
        setHint(null)
        setSuccess(null)

        // Клиентский таймаут: если сервер не ответил за 60 сек — разблокируем UI.
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 60_000)

        try {
            const { getAccessTokenWithRecovery } = await import('@/lib/supabase/client')
            const { token } = await getAccessTokenWithRecovery()
            if (!token) throw new Error('Сессия истекла. Перезайдите в админку.')

            const res = await fetch('/api/admin/training-brain/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ programId }),
                signal: controller.signal,
            })
            const json = await res.json()
            if (!res.ok) {
                setError(json.error || `Ошибка ${res.status}`)
                if (json.hint) setHint(json.hint)
                return
            }
            setSuccess({ path: json.path, htmlUrl: json.htmlUrl })
        } catch (e: any) {
            if (e?.name === 'AbortError') {
                setError('Сервер не отвечает (60+ сек). Попробуй ещё раз через минуту.')
            } else {
                setError(e?.message || 'Не удалось отправить дневник')
            }
        } finally {
            clearTimeout(timeout)
            setPushing(false)
        }
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                disabled={!isSlugSet || pushing}
                onClick={handlePush}
                className="glass-button-secondary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isSlugSet
                    ? 'Сначала задай client_id для клиента (выше на странице)'
                    : 'Запушить заполненный дневник в training-brain'}
            >
                {pushing
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Отправляю...</>
                    : success
                        ? <><Check className="w-4 h-4 text-success" />Отправлено</>
                        : <><Send className="w-4 h-4" />В training-brain</>
                }
            </button>
            {success && (
                <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <span>Файл:</span>
                    <a
                        href={success.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline inline-flex items-center gap-1"
                    >
                        <code className="font-mono">{success.path}</code>
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            )}
            {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
                    <p>{error}</p>
                    {hint && <p className="text-text-muted mt-1">{hint}</p>}
                </div>
            )}
        </div>
    )
}
