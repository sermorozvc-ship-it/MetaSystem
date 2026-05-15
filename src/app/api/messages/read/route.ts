import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TRAINER_ID = '2c87d862-8f21-4ca0-ac69-eafe5a343ee1'

/**
 * POST /api/messages/read
 * Помечает сообщения как прочитанные.
 * Для клиента — помечает сообщения от тренера к нему.
 * Для тренера — помечает сообщения от конкретного клиента (передать clientId).
 */
export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json().catch(() => ({}))
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const isTrainer = user.id === TRAINER_ID

    if (isTrainer) {
      // Тренер помечает сообщения от клиента как прочитанные
      const { clientId } = body
      if (!clientId) {
        return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
      }
      await db
        .from('admin_messages')
        .update({ is_read: true })
        .eq('from_user_id', clientId)
        .eq('to_user_id', TRAINER_ID)
        .eq('is_read', false)
    } else {
      // Клиент помечает сообщения от тренера как прочитанные
      await db
        .from('admin_messages')
        .update({ is_read: true })
        .eq('from_user_id', TRAINER_ID)
        .eq('to_user_id', user.id)
        .eq('is_read', false)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[messages/read] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
