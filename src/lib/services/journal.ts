import { createClient } from '../supabase/client'
import { safeGetUser } from '../supabase/client'

export interface JournalEntry {
    id?: number
    user_id?: string
    date: string
    mood: number
    energy: number
    sleep_hours: number
    water_liters: number
    workout_done: boolean
    nutrition_notes: string
    reflection: string
    created_at?: string
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return []

    try {
        const { data, error } = await supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })

        if (error) throw error
        return data || []
    } catch (e) {
        console.error('Error fetching journal entries:', e)
        return []
    }
}

export async function saveJournalEntry(entry: Partial<JournalEntry>): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { success: false, error: 'Требуется авторизация' }

    try {
        // Remove id if it's there to let DB handle it or upsert handle it
        const { id, ...dataToSave } = entry

        const { error } = await supabase
            .from('journal_entries')
            .upsert({
                user_id: user.id,
                ...dataToSave
            }, {
                onConflict: 'user_id,date',
                ignoreDuplicates: false
            })

        if (error) throw error
        return { success: true }
    } catch (e: any) {
        console.error('Error saving journal entry:', e)
        return { success: false, error: e.message }
    }
}

export async function deleteJournalEntry(date: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { success: false, error: 'Требуется авторизация' }

    try {
        const { error } = await supabase
            .from('journal_entries')
            .delete()
            .eq('user_id', user.id)
            .eq('date', date)

        if (error) throw error
        return { success: true }
    } catch (e: any) {
        console.error('Error deleting journal entry:', e)
        return { success: false, error: e.message }
    }
}
