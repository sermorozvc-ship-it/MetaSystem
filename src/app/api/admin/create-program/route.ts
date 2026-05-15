import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
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

        // Уведомление клиенту (in-app + Web Push)
        const notifTitle = 'Новая программа! 💪'
        const notifMessage = `Ваш тренер загрузил программу на неделю ${weekNumber}. Приступайте к тренировкам!`

        adminClient.from('notifications').insert({
            user_id: userId,
            type: 'program_uploaded',
            title: notifTitle,
            message: notifMessage,
            link: '/programs',
            read: false,
        }).then(({ error: e }) => {
            if (e) {
                console.warn('[create-program] notification error:', e.message)
                return
            }
            // Отправляем Web Push после успешной вставки уведомления
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
            if (appUrl) {
                fetch(`${appUrl}/api/push/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({
                        userId,
                        title: notifTitle,
                        body: notifMessage,
                        url: '/programs',
                    }),
                }).catch((err) => console.warn('[create-program] push send error:', err))
            }
        })

        return NextResponse.json({ program: data })
    } catch (e: any) {
        console.error('[API create-program] error:', e)
        return NextResponse.json({ error: e.message || 'Неизвестная ошибка' }, { status: 500 })
    }
}
