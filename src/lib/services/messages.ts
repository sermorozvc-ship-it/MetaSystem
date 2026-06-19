// MetaSystem — Messages service (клиент <-> тренер)
//
// Все чтения теперь идут через серверные API-роуты, чтобы не таскать
// service_role ключ в браузере.

import { createClient } from '@/lib/supabase/client'

// ID тренера/админа — хардкодим для надёжности
const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

async function authHeaders(): Promise<HeadersInit> {
    const supabase = createClient()
    const { error: authErr } = await supabase.auth.getUser()
    if (authErr) return {}
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return {}
    return { Authorization: `Bearer ${session.access_token}` }
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
    try {
        const headers = await authHeaders()
        const res = await fetch('/api/messages/conversation', { headers })
        if (!res.ok) return []
        const body = await res.json()
        return body.messages || []
    } catch (e) {
        console.error('[messages] getMyConversation error:', e)
        return []
    }
}

/**
 * Получить переписку тренера с конкретным клиентом (для админа)
 */
export async function getConversationWithClient(clientId: string): Promise<ChatMessage[]> {
    try {
        const headers = await authHeaders()
        const res = await fetch(`/api/messages/conversation?clientId=${encodeURIComponent(clientId)}`, { headers })
        if (!res.ok) return []
        const body = await res.json()
        return body.messages || []
    } catch (e) {
        console.error('[messages] getConversationWithClient error:', e)
        return []
    }
}

/**
 * Получить список клиентов у которых есть сообщения (для админа)
 */
export async function getClientsWithMessages(): Promise<{ userId: string; lastMessage: string; lastDate: string; unread: number }[]> {
    try {
        const headers = await authHeaders()
        const res = await fetch('/api/messages/clients', { headers })
        if (!res.ok) return []
        const body = await res.json()
        return body.clients || []
    } catch (e) {
        console.error('[messages] getClientsWithMessages error:', e)
        return []
    }
}

/**
 * Пометить сообщения как прочитанные (для тренера — от конкретного клиента)
 */
export async function markConversationRead(clientId: string): Promise<void> {
    await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId }),
    }).catch(() => {})
}

/**
 * Пометить сообщения от тренера как прочитанные (для клиента)
 */
export async function markTrainerMessagesRead(_clientId: string): Promise<void> {
    await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
    }).catch(() => {})
}

// Legacy export для совместимости
export async function getConversation(_userId: string): Promise<ChatMessage[]> {
    return getMyConversation()
}

export async function sendReply(_toUserId: string, message: string): Promise<{ success: boolean; error?: string }> {
    return sendMessageToTrainer(message)
}
