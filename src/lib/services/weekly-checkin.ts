// MetaSystem — Weekly Checkin Service
//
// Хранит ответы клиента на вопросы чек-ина в конце недели.
// Используется в UI программы (форма с инпутами) и при экспорте дневника
// (формирует блок "Чек-ин клиента" в markdown).

import { createClient } from '@/lib/supabase/client'

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
    const supabase = createClient()
    const { data, error } = await supabase
        .from('weekly_checkins')
        .select('*')
        .eq('program_id', programId)
        .maybeSingle()

    if (error) {
        console.error('[weekly-checkin] getWeeklyCheckin error:', error)
        return null
    }
    return data as WeeklyCheckin | null
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
    const supabase = createClient()
    const payload: Record<string, unknown> = {
        program_id: params.programId,
        user_id: params.userId,
        answers: params.answers,
    }
    if (params.completed) payload.completed_at = new Date().toISOString()

    const { data, error } = await supabase
        .from('weekly_checkins')
        .upsert(payload, { onConflict: 'program_id' })
        .select()
        .single()

    if (error) {
        console.error('[weekly-checkin] upsertWeeklyCheckin error:', error)
        throw new Error(error.message)
    }
    return data as WeeklyCheckin
}

/**
 * Только проставить completed_at у уже существующей записи.
 * Не трогает answers. Если записи ещё нет — ничего не делает.
 * Используется при нажатии "Завершить неделю" чтобы зафиксировать
 * чек-ин не перезаписывая текущие ответы клиента.
 */
export async function markWeeklyCheckinCompleted(programId: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
        .from('weekly_checkins')
        .update({ completed_at: new Date().toISOString() })
        .eq('program_id', programId)
        .is('completed_at', null)
    if (error) {
        console.error('[weekly-checkin] markWeeklyCheckinCompleted error:', error)
        // Не бросаем — не критично для основного flow
    }
}
