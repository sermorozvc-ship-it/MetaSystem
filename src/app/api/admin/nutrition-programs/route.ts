// POST /api/admin/nutrition-programs — создать новый план питания клиенту
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const {
        userId,
        planNumber,
        title,
        startDate,
        endDate,
        planMd,
        planData,
    } = body

    if (!userId || !planNumber || !startDate || !endDate || !planMd) {
        return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // Проверим клиента
    const { data: clientProfile, error: clientError } = await auth.service
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

    if (clientError || !clientProfile) {
        return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }

    const { data, error } = await auth.service
        .from('nutrition_programs')
        .insert({
            user_id: userId,
            plan_number: planNumber,
            title: title || `План питания №${planNumber}`,
            start_date: startDate,
            end_date: endDate,
            plan_md: planMd,
            plan_data: planData || {},
            status: 'active',
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: 'Ошибка БД: ' + error.message }, { status: 500 })

    // In-app уведомление (Web Push отправит клиент через /api/push/send отдельным вызовом)
    const notifTitle = 'Новый план питания! 🥗'
    const notifMessage = `Тренер загрузил план питания №${planNumber}.`
    await auth.service.from('notifications').insert({
        user_id: userId,
        type: 'nutrition_plan_uploaded',
        title: notifTitle,
        message: notifMessage,
        link: '/nutrition',
        read: false,
    })

    return NextResponse.json({ plan: data })
}
