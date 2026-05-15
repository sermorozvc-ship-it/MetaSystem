import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Настраиваем VAPID один раз
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function POST(req: NextRequest) {
  try {
    // Проверяем что запрос внутренний (от нашего сервера)
    const authHeader = req.headers.get('authorization')
    const internalSecret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (authHeader !== `Bearer ${internalSecret}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, title, body, url } = await req.json()

    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 })
    }

    // Получаем все подписки пользователя
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data: subscriptions, error } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error || !subscriptions?.length) {
      return NextResponse.json({ sent: 0 })
    }

    const payload = JSON.stringify({ title, body, url: url || '/dashboard' })
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    // Удаляем невалидные подписки (410 Gone — браузер отписался)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason as any
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(subscriptions[i].endpoint)
        }
      }
    })

    if (expiredEndpoints.length > 0) {
      await db
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return NextResponse.json({ sent, total: subscriptions.length })
  } catch (e: any) {
    console.error('[Push] Send error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
