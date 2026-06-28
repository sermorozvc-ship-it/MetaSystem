// POST /api/admin/users/[userId]/update-dates — ручное изменение дат подписки
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const { subscription_start_date, subscription_end_date } = body

    if (!subscription_start_date || !subscription_end_date) {
        return NextResponse.json({ error: 'Не указана дата начала или окончания' }, { status: 400 })
    }

    // Валидация дат
    const start = new Date(subscription_start_date)
    const end = new Date(subscription_end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Некорректный формат дат' }, { status: 400 })
    }
    if (end <= start) {
        return NextResponse.json({ error: 'Дата окончания должна быть позже даты начала' }, { status: 400 })
    }

    // Обновляем профиль
    const { error: profileError } = await auth.service
        .from('profiles')
        .update({
            subscription_start_date,
            subscription_end_date,
        })
        .eq('id', userId)

    if (profileError) {
        return NextResponse.json({ error: 'Ошибка обновления профиля: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({
        ok: true,
        subscription_start_date,
        subscription_end_date,
    })
}
