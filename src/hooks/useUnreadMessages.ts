'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

/**
 * Хук для получения количества непрочитанных сообщений.
 * Работает для клиента (сообщения от тренера) и для тренера/админа (сообщения от всех клиентов).
 * Обновляется в реальном времени через Supabase Realtime.
 */
export function useUnreadMessages(userId: string | undefined, isAdmin: boolean) {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnread = useCallback(async () => {
    if (!userId) return

    const supabase = createClient()

    if (isAdmin) {
      // Для тренера: считаем непрочитанные сообщения от клиентов (to_user_id = TRAINER_ID)
      const { count } = await supabase
        .from('admin_messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', TRAINER_ID)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    } else {
      // Для клиента: считаем непрочитанные сообщения от тренера (from_user_id = TRAINER_ID, to_user_id = userId)
      const { count } = await supabase
        .from('admin_messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_user_id', TRAINER_ID)
        .eq('to_user_id', userId)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    }
  }, [userId, isAdmin])

  useEffect(() => {
    if (!userId) return

    fetchUnread()

    const supabase = createClient()

    // Подписываемся на новые сообщения через Realtime
    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_messages',
        },
        () => {
          // При любом изменении в таблице — пересчитываем
          fetchUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, isAdmin, fetchUnread])

  return unreadCount
}
