'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

/**
 * Хук для получения количества непрочитанных сообщений.
 * - Обновляется через Supabase Realtime (INSERT новых сообщений)
 * - Принудительно сбрасывается в 0 когда пользователь на /messages
 * - Polling каждые 5 секунд как fallback если Realtime не работает
 */
export function useUnreadMessages(userId: string | undefined, isAdmin: boolean) {
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const isOnMessages = pathname === '/messages' || pathname.startsWith('/messages/')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUnread = useCallback(async () => {
    if (!userId) return

    // Если на странице чата — сразу 0, не делаем запрос
    if (isOnMessages) {
      setUnreadCount(0)
      return
    }

    const supabase = createClient()

    if (isAdmin) {
      const { count } = await supabase
        .from('admin_messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', TRAINER_ID)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    } else {
      const { count } = await supabase
        .from('admin_messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_user_id', TRAINER_ID)
        .eq('to_user_id', userId)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    }
  }, [userId, isAdmin, isOnMessages])

  // Сбрасываем мгновенно при переходе на /messages
  useEffect(() => {
    if (isOnMessages) {
      setUnreadCount(0)
    }
  }, [isOnMessages])

  useEffect(() => {
    if (!userId) return

    fetchUnread()

    // Realtime подписка
    const supabase = createClient()
    const channel = supabase
      .channel(`unread-messages-${userId}-${isAdmin}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_messages' },
        () => { fetchUnread() }
      )
      .subscribe()

    // Polling каждые 5 секунд как fallback (Realtime может не работать на Vercel)
    pollingRef.current = setInterval(() => {
      fetchUnread()
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [userId, isAdmin, fetchUnread])

  return unreadCount
}
