// MetaSystem — Импорт недели из training-brain
//
// POST /api/admin/training-brain/import
//   body: { userId: string }
//   возвращает: {
//     md: string,           // markdown недели, готовый к загрузке через handleUploadProgram
//     weekNumber: number,
//     mesocycle: number,
//     period_start?: string,
//     period_end?: string,
//     path: string,         // clients/<slug>/mesocycle-N/week-N.md
//     trainingBrainClientId: string,
//   }
//
// Алгоритм:
//   1. Авторизуем как админа.
//   2. Достаём из profile training_brain_client_id для userId.
//   3. Идём в репо, ищем последнюю week-N.md в clients/<slug>/.
//   4. Возвращаем содержимое + распарсенные метаданные.
//
// Ничего в БД не пишем — клиент-сторона решит что делать с md
// (например, открыть форму загрузки с предзаполненными полями).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    findLatestWeek,
    GitHubError,
} from '@/lib/services/github-training-brain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase service credentials missing')
    return createClient(url, key, { auth: { persistSession: false } })
}

async function requireAdmin(req: Request): Promise<string | null> {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return null
    const token = auth.slice(7)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    const db = getServiceClient()
    const { data } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (!data || data.role !== 'admin') return null
    return user.id
}

/** Извлекает заголовок периода из md: **Период:** YYYY-MM-DD — YYYY-MM-DD */
function extractPeriod(md: string): { start?: string; end?: string } {
    const m = md.match(/\*\*Период:\*\*\s*([\d-]+)\s*[—-]\s*([\d-]+)/)
    if (!m) return {}
    return { start: m[1], end: m[2] }
}

export async function POST(req: Request) {
    const adminId = await requireAdmin(req)
    if (!adminId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { userId?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const userId = body.userId
    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Достаём slug клиента в training-brain
    const db = getServiceClient()
    const { data: profile, error } = await db
        .from('profiles')
        .select('training_brain_client_id, full_name, email')
        .eq('id', userId)
        .single()
    if (error || !profile) {
        return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }
    const slug = profile.training_brain_client_id
    if (!slug) {
        return NextResponse.json(
            {
                error: 'У клиента не указан client_id для training-brain',
                hint: 'Открой карточку клиента в админке и заполни поле training_brain_client_id (например, "dimon" или "dmitry-mukhin").',
            },
            { status: 400 },
        )
    }

    try {
        const found = await findLatestWeek(slug)
        if (!found) {
            return NextResponse.json(
                {
                    error: `Не нашёл ни одной недели в clients/${slug}/`,
                    hint: 'Проверь, что в репозитории training-brain есть папка clients/' + slug + '/mesocycle-N/week-N.md и что неделя коммитнута в main.',
                },
                { status: 404 },
            )
        }
        const period = extractPeriod(found.md)
        return NextResponse.json({
            md: found.md,
            weekNumber: found.weekNumber,
            mesocycle: found.mesocycle,
            period_start: period.start,
            period_end: period.end,
            path: found.path,
            trainingBrainClientId: slug,
        })
    } catch (e) {
        if (e instanceof GitHubError) {
            return NextResponse.json({ error: e.message }, { status: e.status === 401 ? 401 : 502 })
        }
        const msg = e instanceof Error ? e.message : 'Failed to import week'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
