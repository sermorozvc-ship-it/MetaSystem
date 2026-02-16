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
    photo_front?: string
    photo_side?: string
    photo_back?: string
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

/**
 * Uploads a photo to Supabase storage
 */
export async function uploadJournalPhoto(file: File, type: 'front' | 'side' | 'back'): Promise<{ url?: string; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { error: 'Требуется авторизация' }

    try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}_${type}.${fileExt}`
        const filePath = `journal/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('journal-photos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
            .from('journal-photos')
            .getPublicUrl(filePath)

        return { url: publicUrl }
    } catch (e: any) {
        console.error('Error uploading photo:', e)
        return { error: e.message }
    }
}
