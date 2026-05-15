import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import webpush from 'web-push'

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

interface PushSubscription {
    endpoint: string
    p256dh: string
    auth: string
}

// Отправляем Web Push напрямую, без HTTP-прыжка через /api/push/send
async function sendPushDirect(
    userId: string,
    title: string,
    body: string,
    url: string
) {
    try {
        const vapidSubject = process.env.VAPID_SUBJECT
        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY

        if (!vapidSubject || !vapidPublic || !vapidPrivate) {
            console.warn('[create-program] VAPID keys not configured, skipping push')
            return
        }

        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

        // Используем отдельный клиент с service role для чтения подписок
        const db = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        )

        const { data, error } = await db
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('user_id', userId)

        if (error) {
            console.warn('[create-program] push_subscriptions fetch error:', error.message)
            return
        }

        const subscriptions = (data || []) as PushSubscription[]

        if (!subscriptions.length) {
            console.log('[create-program] no push subscriptions for user', userId)
            return
        }

        console.log(`[create-program] sending push to ${subscriptions.length} subscription(s) for user ${userId}`)

        const payload = JSON.stringify({ title, body, url })

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
                console.warn(`[create-program] push failed for endpoint ${i}:`, err?.statusCode, err?.message)
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                    expiredEndpoints.push(subscriptions[i].endpoint)
                }
            } else {
                console.log(`[create-program] push sent OK for endpoint ${i}`)
            }
        })

        if (expiredEndpoints.length > 0) {
            await db.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
            console.log(`[create-program] removed ${expiredEndpoints.length} expired subscription(s)`)
        }
    } catch (e: any) {
        console.error('[create-program] sendPushDirect error:', e)
    }
}

export async function POST(request: NextRequest) {
    try {
        const adminClient = getAdminClient()

        // Получаем токен из Authorization header
        const authHeader = request.headers.get('authorization') || ''
        const token = authHeader.replace('Bearer ', '').trim()

        if (!token) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        // Проверяем роль
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Профиль не найден' }, { status: 403 })
        }

        const allowedRoles = ['admin', 'trainer', 'curator']
        if (!allowedRoles.includes(profile.role)) {
            return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, weekNumber, startDate, endDate, trainingDaysCount, programMd, programData, notesTrainer } = body

        if (!userId || !weekNumber || !startDate || !endDate || !programMd) {
            return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
        }

        // Проверяем что клиент существует
        const { data: clientProfile, error: clientError } = await adminClient
            .from('profiles').select('id').eq('id', userId).single()

        if (clientError || !clientProfile) {
            return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
        }

        // Удаляем существующую программу для этой недели
        await adminClient.from('training_programs').delete().eq('user_id', userId).eq('week_number', weekNumber)

        // Создаём программу
        const { data, error } = await adminClient
            .from('training_programs')
            .insert({
                user_id: userId,
                week_number: weekNumber,
                start_date: startDate,
                end_date: endDate,
                training_days_count: trainingDaysCount || 3,
                program_md: programMd,
                program_data: programData || {},
                notes_trainer: notesTrainer || null,
                status: 'active',
            })
            .select()
            .single()

        if (error) {
            console.error('[API create-program] DB error:', error)
            return NextResponse.json({ error: 'Ошибка БД: ' + error.message }, { status: 500 })
        }

        // Уведомление клиенту (in-app + Web Push) — fire-and-forget, не блокируем ответ
        const notifTitle = 'Новая программа! 💪'
        const notifMessage = `Ваш тренер загрузил программу на неделю ${weekNumber}. Приступайте к тренировкам!`

        Promise.resolve().then(async () => {
            // 1. In-app уведомление
            const { error: notifError } = await adminClient.from('notifications').insert({
                user_id: userId,
                type: 'program_uploaded',
                title: notifTitle,
                message: notifMessage,
                link: '/programs',
                read: false,
            })
            if (notifError) {
                console.warn('[create-program] notification insert error:', notifError.message)
            }

            // 2. Web Push — напрямую, без HTTP-прыжка
            await sendPushDirect(userId, notifTitle, notifMessage, '/programs')
        }).catch((e) => console.error('[create-program] async notification error:', e))

        return NextResponse.json({ program: data })
    } catch (e: any) {
        console.error('[API create-program] error:', e)
        return NextResponse.json({ error: e.message || 'Неизвестная ошибка' }, { status: 500 })
    }
}
