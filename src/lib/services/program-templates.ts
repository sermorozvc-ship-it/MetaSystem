// MetaSystem v2 — Сервис шаблонов программ.
// Позволяет админу сохранять часто используемые программы и применять их клиентам.

import { createClient, safeGetUser } from '@/lib/supabase/client'
import type { ProgramData } from './training'

export interface ProgramTemplate {
    id: string
    name: string
    description: string | null
    training_days_count: number
    program_md: string
    program_data: ProgramData | null
    tags: string[]
    created_by: string | null
    is_global: boolean
    usage_count: number
    created_at: string
    updated_at: string
}

export interface ProgramTemplateInput {
    name: string
    description?: string | null
    trainingDaysCount: number
    programMd: string
    programData?: ProgramData | null
    tags?: string[]
    isGlobal?: boolean
}

/**
 * Получить все шаблоны (свои + глобальные).
 * Сортировка: сначала самые недавно изменённые.
 */
export async function listTemplates(): Promise<ProgramTemplate[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('program_templates')
        .select('*')
        .order('updated_at', { ascending: false })

    if (error) {
        console.error('[program-templates] list error:', error)
        throw new Error(error.message)
    }
    return data || []
}

/**
 * Получить один шаблон по id.
 */
export async function getTemplate(id: string): Promise<ProgramTemplate | null> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('program_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (error) {
        console.error('[program-templates] get error:', error)
        throw new Error(error.message)
    }
    return data
}

/**
 * Создать шаблон.
 */
export async function createTemplate(input: ProgramTemplateInput): Promise<ProgramTemplate> {
    const supabase = createClient()

    // Используем safeGetUser вместо supabase.auth.getUser() чтобы избежать
    // зависания из-за inTabLock при параллельных auth-запросах
    const user = await safeGetUser()
    if (!user) throw new Error('Not authenticated')

    const payload = {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        training_days_count: input.trainingDaysCount,
        program_md: input.programMd,
        program_data: input.programData ?? null,
        tags: input.tags ?? [],
        is_global: input.isGlobal ?? false,
        created_by: user.id,
    }

    const { data, error } = await supabase
        .from('program_templates')
        .insert(payload)
        .select()
        .single()

    if (error) {
        console.error('[program-templates] create error:', error)
        throw new Error(error.message)
    }
    return data
}

/**
 * Обновить шаблон.
 */
export async function updateTemplate(
    id: string,
    patch: Partial<ProgramTemplateInput>
): Promise<ProgramTemplate> {
    const supabase = createClient()

    const dbPatch: Record<string, unknown> = {}
    if (patch.name !== undefined) dbPatch.name = patch.name.trim()
    if (patch.description !== undefined) dbPatch.description = patch.description?.trim() || null
    if (patch.trainingDaysCount !== undefined) dbPatch.training_days_count = patch.trainingDaysCount
    if (patch.programMd !== undefined) dbPatch.program_md = patch.programMd
    if (patch.programData !== undefined) dbPatch.program_data = patch.programData
    if (patch.tags !== undefined) dbPatch.tags = patch.tags
    if (patch.isGlobal !== undefined) dbPatch.is_global = patch.isGlobal

    const { data, error } = await supabase
        .from('program_templates')
        .update(dbPatch)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('[program-templates] update error:', error)
        throw new Error(error.message)
    }
    return data
}

/**
 * Удалить шаблон.
 */
export async function deleteTemplate(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
        .from('program_templates')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('[program-templates] delete error:', error)
        throw new Error(error.message)
    }
}

/**
 * Инкремент usage_count при применении шаблона.
 * Не блокирует основной flow — ошибки логируем, но не пробрасываем.
 */
export async function bumpUsage(id: string): Promise<void> {
    const supabase = createClient()
    try {
        // Читаем-инкрементируем-пишем (проще чем RPC, у нас нет конкурентной нагрузки)
        const { data: cur } = await supabase
            .from('program_templates')
            .select('usage_count')
            .eq('id', id)
            .maybeSingle()
        if (!cur) return
        await supabase
            .from('program_templates')
            .update({ usage_count: (cur.usage_count ?? 0) + 1 })
            .eq('id', id)
    } catch (e) {
        console.warn('[program-templates] bumpUsage failed (non-critical):', e)
    }
}

/**
 * Подставить недостающие даты в MD-шаблон при применении к клиенту.
 * Если в шаблоне `**Период:** ...` отсутствует или пустой — добавим переданные даты.
 * Если присутствует — заменим.
 */
export function applyDatesToTemplateMd(
    md: string,
    weekNumber: number,
    startDate: string,
    endDate: string
): string {
    let out = md

    // Заменяем заголовок недели
    if (/^#\s+Неделя\s+\d+/m.test(out)) {
        out = out.replace(/^#\s+Неделя\s+\d+/m, `# Неделя ${weekNumber}`)
    } else {
        out = `# Неделя ${weekNumber}\n\n` + out
    }

    // Заменяем/добавляем строку периода
    if (/\*\*Период:\*\*.*$/m.test(out)) {
        out = out.replace(/\*\*Период:\*\*.*$/m, `**Период:** ${startDate} — ${endDate}`)
    } else {
        // Вставляем после заголовка недели
        out = out.replace(
            /^(#\s+Неделя\s+\d+)\s*$/m,
            `$1\n\n**Период:** ${startDate} — ${endDate}`
        )
    }

    return out
}
