import { createClient, safeGetUser } from '@/lib/supabase/client'

export interface AdminMessage {
    id: number
    from_user_id: string | null
    to_user_id: string
    message: string
    is_read: boolean
    message_type: 'message' | 'warning' | 'announcement'
    created_at: string
}

export async function sendReply(
    toUserId: string,
    message: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { success: false, error: 'Требуется авторизация' }

    try {
        const { data, error } = await supabase
            .from('admin_messages')
            .insert({
                from_user_id: user.id,
                to_user_id: toUserId,
                message,
                message_type: 'message',
                is_read: false
            })
            .select()

        if (error) throw error
        return { success: true }
    } catch (e: any) {
        console.error('Error sending reply:', e)
        return { success: false, error: e.message }
    }
}

export async function getConversation(userId: string): Promise<AdminMessage[]> {
    const supabase = createClient()

    try {
        const { data, error } = await supabase
            .from('admin_messages')
            .select('*')
            .or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    } catch (e) {
        console.error('Error fetching conversation:', e)
        return []
    }
}
