// MetaSystem — Weekly Checkin Service
//
// Хранит ответы клиента на вопросы чек-ина в конце недели.
// Используется в UI программы (форма с инпутами) и при экспорте дневника
// (формирует блок "Чек-ин клиента" в markdown).
//
// Все операции используют directSupabaseFetch (прямой REST) вместо
// Supabase-клиента, чтобы не блокироваться inTabLock при обновлении
// токена. Это предотвращает deadlock: autosave чек-ина держит lock →
// handleCompleteDay не может получить токен → "Not authenticated".

import { directSupabaseFetch } from '@/lib/supabase/client'

export interface WeeklyCheckin {
    id: string
    program_id: string
    user_id: string
    answers: Record<string, string>
    completed_at: string | null
    created_at: string
    updated_at: string
}

/**
 * Получить чек-ин клиента для указанной программы (или null если ещё нет).
 */
export async function getWeeklyCheckin(programId: string): Promise<WeeklyCheckin | null> {
    try {
        const result = await directSupabaseFetch<WeeklyCheckin[]>(
            'weekly_checkins',
            {
                method: 'GET',
                params: `program_id=eq.${programId}&select=*&limit=1`,
            },
            10_000,
        )

        if (!result || !Array.isArray(result) || result.length === 0) {
            return null
        }
        return result[0] as WeeklyCheckin
    } catch (e) {
        console.error('[weekly-checkin] getWeeklyCheckin (network):', e)
        return null
    }
}

/**
 * Сохранить ответы (создаёт или обновляет запись для текущего пользователя).
 * Если completed=true — проставляет completed_at.
 */
export async function upsertWeeklyCheckin(params: {
    programId: string
    userId: string
    answers: Record<string, string>
    completed?: boolean
}): Promise<WeeklyCheckin | null> {
    const payload: Record<string, unknown> = {
        program_id: params.programId,
        user_id: params.userId,
        answers: params.answers,
    }
    if (params.completed) payload.completed_at = new Date().toISOString()

    const result = await directSupabaseFetch<WeeklyCheckin[]>(
        'weekly_checkins',
        {
            method: 'POST',
            body: payload,
            params: 'on_conflict=program_id',
            prefer: 'return=representation,resolution=merge-duplicates',
        },
        10_000,
    )

    const row = Array.isArray(result) ? result[0] : result
    if (!row) throw new Error('upsertWeeklyCheckin: no data returned')
    return row as WeeklyCheckin
}

/**
 * Только проставить completed_at у уже существующей записи.
 * Не трогает answers. Если записи ещё нет — ничего не делает.
 * Используется при нажатии "Завершить неделю" чтобы зафиксировать
 * чек-ин не перезаписывая текущие ответы клиента.
 */
export async function markWeeklyCheckinCompleted(programId: string): Promise<void> {
    try {
        await directSupabaseFetch(
            'weekly_checkins',
            {
                method: 'PATCH',
                body: { completed_at: new Date().toISOString() },
                params: `program_id=eq.${programId}&completed_at=is.null`,
                prefer: 'return=minimal',
            },
            10_000,
        )
    } catch (e) {
        console.error('[weekly-checkin] markWeeklyCheckinCompleted (network):', e)
        // Не бросаем — не критично для основного flow
    }
}
