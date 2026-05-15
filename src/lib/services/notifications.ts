/**
 * Notifications Service
 * Управление уведомлениями для клиентов и админов
 */

import { createClient } from '@/lib/supabase/client'

export type NotificationType =
  | 'payment_confirmed'
  | 'program_uploaded'
  | 'training_completed'
  | 'metric_added'
  | 'message_received'
  | 'subscription_expiring'
  | 'subscription_expired'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  read: boolean
  created_at: string
}

/**
 * Создать уведомление
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<{ notification: Notification | null; error: string | null }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        read: false,
      })
      .select()
      .single()

    if (error) throw error

    // Отправляем Web Push параллельно (не блокируем если не получится)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      if (baseUrl) {
        fetch(`${baseUrl}/api/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ userId, title, body: message, url: link }),
        }).catch(() => {}) // fire-and-forget
      }
    } catch {}

    return { notification: data, error: null }
  } catch (e: any) {
    console.error('[Notifications] Create error:', e)
    return { notification: null, error: e.message }
  }
}

/**
 * Получить уведомления пользователя
 */
export async function getMyNotifications(limit = 20): Promise<Notification[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (e) {
    console.error('[Notifications] Get error:', e)
    return []
  }
}

/**
 * Получить непрочитанные уведомления
 */
export async function getUnreadNotifications(): Promise<Notification[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (e) {
    console.error('[Notifications] Get unread error:', e)
    return []
  }
}

/**
 * Отметить уведомление как прочитанное
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) throw error
    return true
  } catch (e) {
    console.error('[Notifications] Mark as read error:', e)
    return false
  }
}

/**
 * Отметить все уведомления как прочитанные
 */
export async function markAllAsRead(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)

    if (error) throw error
    return true
  } catch (e) {
    console.error('[Notifications] Mark all as read error:', e)
    return false
  }
}

/**
 * Удалить уведомление
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) throw error
    return true
  } catch (e) {
    console.error('[Notifications] Delete error:', e)
    return false
  }
}

/**
 * Подписаться на новые уведомления (Realtime)
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
  const supabase = createClient()
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ============================================
// Хелперы для создания специфичных уведомлений
// ============================================

/**
 * Уведомление: Оплата подтверждена
 */
export async function notifyPaymentConfirmed(userId: string, amount: number) {
  return createNotification(
    userId,
    'payment_confirmed',
    'Оплата подтверждена! 🎉',
    `Ваш платеж на сумму ${amount} ₽ успешно обработан. Добро пожаловать в MetaSystem!`,
    '/dashboard'
  )
}

/**
 * Уведомление: Программа загружена
 */
export async function notifyProgramUploaded(userId: string, weekNumber: number) {
  return createNotification(
    userId,
    'program_uploaded',
    'Новая программа! 💪',
    `Ваш тренер загрузил программу на неделю ${weekNumber}. Приступайте к тренировкам!`,
    '/programs'
  )
}

/**
 * Уведомление: Тренировка завершена (для админа)
 */
export async function notifyTrainingCompleted(
  adminId: string,
  clientName: string,
  weekNumber: number,
  dayNumber: number
) {
  return createNotification(
    adminId,
    'training_completed',
    'Тренировка завершена ✅',
    `${clientName} завершил тренировку: Неделя ${weekNumber}, День ${dayNumber}`,
    '/admin/clients'
  )
}

/**
 * Уведомление: Метрика добавлена (для админа)
 */
export async function notifyMetricAdded(adminId: string, clientName: string) {
  return createNotification(
    adminId,
    'metric_added',
    'Новый замер 📊',
    `${clientName} добавил новый замер. Проверьте прогресс!`,
    '/admin/clients'
  )
}

/**
 * Уведомление: Новое сообщение
 */
export async function notifyMessageReceived(
  userId: string,
  senderName: string,
  preview: string
) {
  return createNotification(
    userId,
    'message_received',
    `Новое сообщение от ${senderName}`,
    preview.substring(0, 100),
    '/messages'
  )
}

/**
 * Уведомление: Подписка истекает
 */
export async function notifySubscriptionExpiring(userId: string, daysLeft: number) {
  return createNotification(
    userId,
    'subscription_expiring',
    'Подписка истекает ⏰',
    `Ваша подписка истекает через ${daysLeft} дней. Продлите, чтобы продолжить тренировки!`,
    '/payment'
  )
}

/**
 * Уведомление: Подписка истекла
 */
export async function notifySubscriptionExpired(userId: string) {
  return createNotification(
    userId,
    'subscription_expired',
    'Подписка истекла 🔒',
    'Ваша подписка истекла. Продлите подписку, чтобы продолжить доступ к программам.',
    '/payment'
  )
}
