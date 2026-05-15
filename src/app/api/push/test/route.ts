import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/push/test
 * Тестовый эндпоинт — отправляет push текущему залогиненному пользователю.
 * Открой в браузере: https://your-domain.com/api/push/test
 * Ответ покажет что именно произошло (подписки, ошибки FCM и т.д.)
 */
export async function GET(req: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => { logs.push(msg); console.log('[push/test]', msg) }

  try {
    const vapidSubject = process.env.VAPID_SUBJECT
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY

    if (!vapidSubject || !vapidPublic || !vapidPrivate) {
      log('ERROR: VAPID keys not configured in env')
      return NextResponse.json({ ok: false, logs }, { status: 500 })
    }

    log(`VAPID subject: ${vapidSubject}`)
    log(`VAPID public key: ${vapidPublic.substring(0, 20)}...`)

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    // Авторизация через cookie
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          },
        },
      }
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      log(`ERROR: Not authenticated (${authErr?.message || 'no user'})`)
      return NextResponse.json({ ok: false, logs }, { status: 401 })
    }

    log(`User: ${user.id} (${user.email})`)

    // Получаем подписки через service-role
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: subs, error: subsErr } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user.id)

    if (subsErr) {
      log(`ERROR: fetch subscriptions failed: ${subsErr.message}`)
      return NextResponse.json({ ok: false, logs }, { status: 500 })
    }

    if (!subs || subs.length === 0) {
      log('No push subscriptions found for this user. Click the bell icon to subscribe first.')
      return NextResponse.json({ ok: false, logs })
    }

    log(`Found ${subs.length} subscription(s)`)

    const payload = JSON.stringify({
      title: 'Тест push 🔔',
      body: `Если видишь это — push работает! (${new Date().toLocaleTimeString('ru-RU')})`,
      url: '/dashboard',
    })

    const results: { endpoint: string; status: string; error?: string }[] = []

    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]
      log(`Sending to endpoint ${i}: ${sub.endpoint.substring(0, 60)}...`)
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        log(`  -> OK (status ${res.statusCode})`)
        results.push({ endpoint: sub.endpoint.substring(0, 60), status: 'ok' })
      } catch (err: any) {
        const code = err?.statusCode || 'unknown'
        const msg = err?.body || err?.message || 'unknown error'
        log(`  -> FAILED (status ${code}): ${msg}`)
        results.push({ endpoint: sub.endpoint.substring(0, 60), status: 'failed', error: `${code}: ${msg}` })

        // Если 410/404 — подписка мертва, удаляем
        if (code === 410 || code === 404) {
          await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          log(`  -> Deleted expired subscription`)
        }
      }
    }

    const sent = results.filter(r => r.status === 'ok').length
    log(`Done: ${sent}/${subs.length} sent successfully`)

    return NextResponse.json({ ok: sent > 0, sent, total: subs.length, results, logs })
  } catch (e: any) {
    log(`EXCEPTION: ${e.message}`)
    return NextResponse.json({ ok: false, logs, error: e.message }, { status: 500 })
  }
}
