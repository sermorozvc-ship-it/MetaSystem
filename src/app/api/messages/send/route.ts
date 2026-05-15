import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendPushToUser } from '@/lib/services/push-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

export async function POST(req: NextRequest) {
  try {
    const { toUserId, message, messageType = 'message' } = await req.json()

    if (!toUserId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing toUserId or message' }, { status: 400 })
    }

    // Авторизация через cookie
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

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Вставляем сообщение
    const { error: insertErr } = await db.from('admin_messages').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      message: message.trim(),
      message_type: messageType,
      is_read: false,
    })

    if (insertErr) {
      console.error('[messages/send] insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Определяем имя отправителя для уведомления
    const { data: senderProfile } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const senderName = senderProfile?.full_name || 'Тренер'
    const preview = message.trim().substring(0, 80)

    // Отправляем push получателю — ждём результата для логирования
    try {
      const pushResult = await sendPushToUser(
        toUserId,
        `Новое сообщение от ${senderName} 💬`,
        preview,
        '/messages'
      )
      console.log(`[messages/send] push to ${toUserId}: sent=${pushResult.sent}/${pushResult.total}`)
    } catch (e) {
      console.warn('[messages/send] push error:', e)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[messages/send] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
