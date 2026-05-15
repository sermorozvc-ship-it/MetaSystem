/**
 * Web Push — серверная отправка
 * Используется только из API routes / server-side кода.
 * Не импортировать в клиентских компонентах.
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

interface PushSubRow {
  endpoint: string
  p256dh: string
  auth: string
}

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true

  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    console.warn('[push-server] VAPID keys not configured')
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

/**
 * Отправить Web Push конкретному пользователю напрямую (без HTTP).
 * Безопасно вызывать из любого серверного кода (API routes, webhooks, server actions).
 * Невалидные подписки (410/404) автоматически удаляются.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string = '/dashboard'
): Promise<{ sent: number; total: number }> {
  if (!ensureVapid()) return { sent: 0, total: 0 }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('[push-server] Supabase service key not configured')
    return { sent: 0, total: 0 }
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    console.warn('[push-server] fetch subs error:', error.message)
    return { sent: 0, total: 0 }
  }

  const subscriptions = (data || []) as PushSubRow[]
  if (!subscriptions.length) {
    console.log('[push-server] no subscriptions for user', userId)
    return { sent: 0, total: 0 }
  }

  const payload = JSON.stringify({ title, body, url })

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  const expiredEndpoints: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as any
      console.warn(`[push-server] push failed for endpoint ${i}:`, err?.statusCode, err?.message)
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push(subscriptions[i].endpoint)
      }
    }
  })

  if (expiredEndpoints.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    console.log(`[push-server] removed ${expiredEndpoints.length} expired subscription(s)`)
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return { sent, total: subscriptions.length }
}
