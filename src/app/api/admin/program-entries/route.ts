import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

export async function GET(request: NextRequest) {
    try {
        const adminClient = getAdminClient()

        // Получаем токен из Authorization header (Bearer <token>)
        const authHeader = request.headers.get('authorization') || ''
        const token = authHeader.replace('Bearer ', '').trim()

        if (!token) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        // Верифицируем токен через Supabase
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
        }

        // Проверяем роль
        const { data: profile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const allowedRoles = ['admin', 'trainer', 'curator']
        if (!profile || !allowedRoles.includes(profile.role)) {
            return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const programId = searchParams.get('programId')
        if (!programId) {
            return NextResponse.json({ error: 'programId обязателен' }, { status: 400 })
        }

        // Получаем программу
        const { data: program, error: progError } = await adminClient
            .from('training_programs')
            .select('*')
            .eq('id', programId)
            .single()

        if (progError || !program) {
            return NextResponse.json({ error: 'Программа не найдена' }, { status: 404 })
        }

        // Получаем все записи тренировок
        const { data: entries, error: entriesError } = await adminClient
            .from('training_entries')
            .select('*')
            .eq('program_id', programId)
            .order('day_number', { ascending: true })

        if (entriesError) {
            console.error('[API program-entries] entries error:', entriesError)
        }

        return NextResponse.json({ program, entries: entries || [] })
    } catch (e: any) {
        console.error('[API program-entries] error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
