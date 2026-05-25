// DELETE /api/admin/users/[userId] — полное удаление пользователя со всеми данными
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const { userId } = await ctx.params

    try {
        // Удаляем все связанные данные явно (большинство имеют CASCADE, но
        // явно — надёжнее).
        const tables: Array<{ table: string; col: string }> = [
            { table: 'training_entries', col: 'user_id' },
            { table: 'training_programs', col: 'user_id' },
            { table: 'client_metrics', col: 'user_id' },
            { table: 'client_questionnaires', col: 'user_id' },
            { table: 'payments', col: 'user_id' },
            { table: 'notifications', col: 'user_id' },
            { table: 'journal_entries', col: 'user_id' },
            { table: 'user_progress', col: 'user_id' },
            { table: 'body_measurements', col: 'user_id' },
            { table: 'day_reports', col: 'user_id' },
        ]

        for (const { table, col } of tables) {
            await auth.service.from(table).delete().eq(col, userId)
        }
        await auth.service.from('admin_messages').delete().eq('to_user_id', userId)
        await auth.service.from('admin_messages').delete().eq('from_user_id', userId)

        await auth.service.from('profiles').delete().eq('id', userId)

        const { error: authError } = await auth.service.auth.admin.deleteUser(userId)
        if (authError) {
            return NextResponse.json({ error: 'Auth delete failed: ' + authError.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Ошибка удаления' }, { status: 500 })
    }
}
