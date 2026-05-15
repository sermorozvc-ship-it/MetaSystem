import { createClient } from '@/lib/supabase/client'
import { createClient as createDirectClient } from '@supabase/supabase-js'

// ID и email тренера/админа — хардкодим для надёжности
const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

function getServiceClient() {
    return createDirectClient(
        'https://bzyypoyvihqhrbllgffh.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA',
        { auth: { persistSession: false } }
    )
}

export interface ChatMessage {
    id: number
    from_user_id: string | null
    to_user_id: string
    message: string
    is_read: boolean
    message_type: 'message' | 'warning' | 'announcement'
    created_at: string
}

/**
 * Клиент отправляет сообщение тренеру
 */
export async function sendMessageToTrainer(message: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toUserId: TRAINER_ID, message }),
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { success: false, error: data.error || 'Ошибка отправки' }
    }
    return { success: true }
}

/**
 * Тренер отправляет сообщение клиенту
 */
export async function sendMessageToClient(clientId: string, message: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toUserId: clientId, message }),
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { success: false, error: data.error || 'Ошибка отправки' }
    }
    return { success: true }
}

/**
 * Получить переписку клиента с тренером (для клиента)
 */
export async function getMyConversation(): Promise<ChatMessage[]> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const db = getServiceClient()
    const { data, error } = await db
        .from('admin_messages')
        .select('*')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${TRAINER_ID}),and(from_user_id.eq.${TRAINER_ID},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[messages] getMyConversation error:', error)
        return []
    }
    return data || []
}

/**
 * Получить переписку тренера с конкретным клиентом (для админа)
 */
export async function getConversationWithClient(clientId: string): Promise<ChatMessage[]> {
    const db = getServiceClient()
    const { data, error } = await db
        .from('admin_messages')
        .select('*')
        .or(`and(from_user_id.eq.${clientId},to_user_id.eq.${TRAINER_ID}),and(from_user_id.eq.${TRAINER_ID},to_user_id.eq.${clientId})`)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[messages] getConversationWithClient error:', error)
        return []
    }
    return data || []
}

/**
 * Получить список клиентов у которых есть сообщения (для админа)
 */
export async function getClientsWithMessages(): Promise<{ userId: string; lastMessage: string; lastDate: string; unread: number }[]> {
    const db = getServiceClient()
    const { data, error } = await db
        .from('admin_messages')
        .select('from_user_id, to_user_id, message, created_at, is_read')
        .or(`from_user_id.eq.${TRAINER_ID},to_user_id.eq.${TRAINER_ID}`)
        .order('created_at', { ascending: false })

    if (error || !data) return []

    // Группируем по клиенту
    const clientMap = new Map<string, { lastMessage: string; lastDate: string; unread: number }>()
    for (const msg of data) {
        const clientId = msg.from_user_id === TRAINER_ID ? msg.to_user_id : msg.from_user_id
        if (!clientId || clientId === TRAINER_ID) continue
        if (!clientMap.has(clientId)) {
            clientMap.set(clientId, {
                lastMessage: msg.message,
                lastDate: msg.created_at,
                unread: 0,
            })
        }
        // Считаем непрочитанные от клиента к тренеру
        if (msg.from_user_id === clientId && !msg.is_read) {
            const entry = clientMap.get(clientId)!
            entry.unread++
        }
    }

    return Array.from(clientMap.entries()).map(([userId, v]) => ({ userId, ...v }))
}

/**
 * Пометить сообщения как прочитанные
 */
export async function markConversationRead(clientId: string): Promise<void> {
    const db = getServiceClient()
    await db
        .from('admin_messages')
        .update({ is_read: true })
        .eq('from_user_id', clientId)
        .eq('to_user_id', TRAINER_ID)
        .eq('is_read', false)
}

// Legacy export для совместимости
export async function getConversation(userId: string): Promise<ChatMessage[]> {
    return getMyConversation()
}

export async function sendReply(toUserId: string, message: string): Promise<{ success: boolean; error?: string }> {
    return sendMessageToTrainer(message)
}
