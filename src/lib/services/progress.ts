import { createClient } from '@/lib/supabase/client'

export interface TaskProgress {
    user_id: string
    day_number: number
    task_id: number
    completed: boolean
    completed_at: string | null
}

// Get all progress for current user
export async function getUserProgress(): Promise<Record<number, number[]>> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Demo mode - get from localStorage
        return JSON.parse(localStorage.getItem('demo_task_progress') || '{}')
    }

    const { data, error } = await supabase
        .from('user_progress')
        .select('day_number, task_id')
        .eq('user_id', user.id)
        .eq('completed', true)

    if (error) {
        console.error('Error fetching progress:', error)
        return {}
    }

    // Group by day
    const progress: Record<number, number[]> = {}
    data?.forEach(item => {
        if (!progress[item.day_number]) {
            progress[item.day_number] = []
        }
        progress[item.day_number].push(item.task_id)
    })

    return progress
}

// Toggle task completion
export async function toggleTaskProgress(
    dayNumber: number,
    taskId: number,
    completed: boolean
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Demo mode - save to localStorage
        const progress = JSON.parse(localStorage.getItem('demo_task_progress') || '{}')
        if (!progress[dayNumber]) progress[dayNumber] = []

        if (completed) {
            if (!progress[dayNumber].includes(taskId)) {
                progress[dayNumber].push(taskId)
            }
        } else {
            progress[dayNumber] = progress[dayNumber].filter((id: number) => id !== taskId)
        }

        localStorage.setItem('demo_task_progress', JSON.stringify(progress))
        return { success: true }
    }

    if (completed) {
        // Insert or update
        const { error } = await supabase
            .from('user_progress')
            .upsert({
                user_id: user.id,
                day_number: dayNumber,
                task_id: taskId,
                completed: true,
                completed_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,day_number,task_id'
            })

        if (error) {
            console.error('Error saving progress:', error)
            return { success: false, error: error.message }
        }
    } else {
        // Delete the record
        const { error } = await supabase
            .from('user_progress')
            .delete()
            .eq('user_id', user.id)
            .eq('day_number', dayNumber)
            .eq('task_id', taskId)

        if (error) {
            console.error('Error deleting progress:', error)
            return { success: false, error: error.message }
        }
    }

    return { success: true }
}

// Get progress for a specific user (admin only)
export async function getUserProgressById(userId: string): Promise<Record<number, number[]>> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('user_progress')
        .select('day_number, task_id, completed_at')
        .eq('user_id', userId)
        .eq('completed', true)
        .order('completed_at', { ascending: true })

    if (error) {
        console.error('Error fetching user progress:', error)
        return {}
    }

    // Group by day
    const progress: Record<number, number[]> = {}
    data?.forEach(item => {
        if (!progress[item.day_number]) {
            progress[item.day_number] = []
        }
        progress[item.day_number].push(item.task_id)
    })

    return progress
}

// Get detailed progress with timestamps for admin
export async function getDetailedUserProgress(userId: string): Promise<TaskProgress[]> {
    console.log('getDetailedUserProgress called for userId:', userId)
    const supabase = createClient()

    try {
        // Try secure RPC first
        const { data, error } = await supabase.rpc('get_user_progress_secure', {
            p_user_id: userId
        })

        if (!error && data) {
            console.log('Successfully fetched progress via RPC')
            return data
        }

        if (error) {
            console.warn('RPC progress fetch failed, trying fallback:', error)
        }

        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', userId)
            .eq('completed', true)
            .order('day_number', { ascending: true })
            .order('task_id', { ascending: true })

        if (fallbackError) {
            console.error('Error fetching detailed progress (fallback):', fallbackError)
            return []
        }

        return fallbackData || []
    } catch (e) {
        console.error('Exception in getDetailedUserProgress:', e)
        return []
    }
}
