import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const VAPID_SUBJECT = process.env.VAPID_SUBJECT
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

if (VAPID_SUBJECT && VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function POST(req: NextRequest) {
  try {
    if (!VAPID_SUBJECT || !VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.warn('[Push send] VAPID keys not configured')
      return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
    }

    const { userId, title, body, url } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    }

    // Авторизация: либо внутренний серверный вызов с service-role в Bearer,
    // либо запрос от залогиненного пользователя (только себе)
    const authHeader = req.headers.get('authorization') || ''
    const isInternal =
      authHeader === `Bearer ${SERVICE_KEY}` && SERVICE_KEY.length > 0

    let targetUserId: string | null = null

    if (isInternal) {
      if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
      }
      targetUserId = userId
    } else {
      // Проверяем сессию через cookie
      const cookieStore = await cookies()
      const supabase = createServerClient(
        SUPABASE_URL,
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Если передан userId и это не сам пользователь — проверяем что он админ/тренер
      if (userId && userId !== user.id) {
        const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
        const { data: profile } = await db
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        const allowedRoles = ['admin', 'trainer', 'curator']
        if (!profile || !allowedRoles.includes(profile.role)) {
          return NextResponse.json({ error: 'Forbidden: not an admin' }, { status: 403 })
        }
        targetUserId = userId
      } else {
        // Обычный пользователь — только себе
        targetUserId = user.id
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'No target user' }, { status: 400 })
    }

    // Получаем все подписки пользователя через service-role
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data: subscriptions, error } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', targetUserId)

    if (error) {
      console.error('[Push send] fetch subs error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ sent: 0, total: 0 })
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
        console.warn('[Push send] failed:', err?.statusCode, err?.message)
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
    console.error('[Push send] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
