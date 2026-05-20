// MetaSystem v2 — Scheduled Checkins Service
// Управление запланированными датами замеров/фото-контроля

import { createClient } from '@/lib/supabase/client'
import { createNotification } from './notifications'

export interface ScheduledCheckin {
  id: string
  user_id: string
  scheduled_date: string   // ISO YYYY-MM-DD
  notes?: string
  created_by?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

// ─── Клиентские функции (RLS: только свои чекины) ──────────────────────────

/**
 * Получить все запланированные чекины текущего пользователя
 */
export async function getMyCheckins(): Promise<ScheduledCheckin[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scheduled_checkins')
    .select('*')
    .order('scheduled_date', { ascending: true })

  if (error) {
    console.error('[Checkins] getMyCheckins error:', error)
    return []
  }
  return data || []
}

/**
 * Получить предстоящие чекины (от сегодня)
 */
export async function getUpcomingCheckins(): Promise<ScheduledCheckin[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('scheduled_checkins')
    .select('*')
    .gte('scheduled_date', today)
    .is('completed_at', null)
    .order('scheduled_date', { ascending: true })
    .limit(5)

  if (error) {
    console.error('[Checkins] getUpcomingCheckins error:', error)
    return []
  }
  return data || []
}

// ─── Административные функции (service role через прямой клиент) ───────────

/**
 * Получить все чекины клиента (для администратора)
 */
export async function getClientCheckins(
  userId: string,
  supabaseAdmin?: any
): Promise<ScheduledCheckin[]> {
  const db = supabaseAdmin || createClient()
  const { data, error } = await db
    .from('scheduled_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true })

  if (error) {
    console.error('[Checkins] getClientCheckins error:', error)
    return []
  }
  return data || []
}

/**
 * Создать запланированный чекин (администратор)
 * Отправляет уведомление клиенту
 */
export async function createCheckin(
  userId: string,
  scheduledDate: string,
  notes?: string,
  createdBy?: string,
  supabaseAdmin?: any
): Promise<{ checkin: ScheduledCheckin | null; error: string | null }> {
  const db = supabaseAdmin || createClient()

  const { data, error } = await db
    .from('scheduled_checkins')
    .upsert(
      {
        user_id: userId,
        scheduled_date: scheduledDate,
        notes: notes || null,
        created_by: createdBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,scheduled_date' }
    )
    .select()
    .single()

  if (error) {
    console.error('[Checkins] createCheckin error:', error)
    return { checkin: null, error: error.message }
  }

  // Уведомление клиенту
  try {
    const dateFormatted = new Date(scheduledDate + 'T12:00:00').toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long',
    })
    await createNotification(
      userId,
      'scheduled_checkin',
      '📏 Запланирован чекин',
      `Тренер назначил замеры и фото-контроль на ${dateFormatted}.${notes ? ` ${notes}` : ''}`,
      '/metrics'
    )
  } catch (e) {
    console.warn('[Checkins] Notification failed (non-critical):', e)
  }

  return { checkin: data, error: null }
}

/**
 * Удалить запланированный чекин (администратор)
 */
export async function deleteCheckin(
  checkinId: string,
  supabaseAdmin?: any
): Promise<boolean> {
  const db = supabaseAdmin || createClient()
  const { error } = await db
    .from('scheduled_checkins')
    .delete()
    .eq('id', checkinId)

  if (error) {
    console.error('[Checkins] deleteCheckin error:', error)
    return false
  }
  return true
}

/**
 * Отметить чекин как выполненный
 */
export async function completeCheckin(
  checkinId: string,
  supabaseAdmin?: any
): Promise<boolean> {
  const db = supabaseAdmin || createClient()
  const { error } = await db
    .from('scheduled_checkins')
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', checkinId)

  if (error) {
    console.error('[Checkins] completeCheckin error:', error)
    return false
  }
  return true
}
