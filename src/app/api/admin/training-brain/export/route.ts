// MetaSystem — Экспорт дневника в training-brain
//
// POST /api/admin/training-brain/export
//   body: { programId: string }
//   возвращает: {
//     path: string,    // clients/<slug>/mesocycle-N/week-N-filled.md
//     htmlUrl: string, // ссылка на файл в GitHub UI
//     sha: string,
//   }
//
// Алгоритм:
//   1. Авторизуем как админа.
//   2. Берём программу + её training_entries из БД.
//   3. Из profile берём training_brain_client_id.
//   4. Из program_md / program_data достаём mesocycle (frontmatter).
//   5. Собираем дневник через buildDiaryMd.
//   6. Пушим прямо в main: clients/<slug>/mesocycle-N/week-N-filled.md.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    putFile,
    GitHubError,
    GITHUB_TRAINING_BRAIN_OWNER,
    GITHUB_TRAINING_BRAIN_REPO,
} from '@/lib/services/github-training-brain'
import { buildDiaryMd } from '@/lib/utils/diary-export'
import type { TrainingProgram, TrainingEntry } from '@/lib/services/training'

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

/** Извлекает mesocycle из YAML frontmatter, иначе 1. */
function extractMesocycle(md: string): number {
    const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fm) return 1
    const m = fm[1].match(/^\s*mesocycle:\s*(\d+)\s*$/m)
    if (!m) return 1
    const n = parseInt(m[1], 10)
    return Number.isFinite(n) && n > 0 ? n : 1
}

export async function POST(req: Request) {
    const adminId = await requireAdmin(req)
    if (!adminId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { programId?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const programId = body.programId
    if (!programId) {
        return NextResponse.json({ error: 'programId required' }, { status: 400 })
    }

    const db = getServiceClient()

    // 1. Программа
    const { data: program, error: progErr } = await db
        .from('training_programs')
        .select('*')
        .eq('id', programId)
        .single<TrainingProgram>()
    if (progErr || !program) {
        return NextResponse.json({ error: 'Программа не найдена' }, { status: 404 })
    }

    // 2. Slug клиента
    const { data: profile, error: profErr } = await db
        .from('profiles')
        .select('training_brain_client_id, full_name')
        .eq('id', program.user_id)
        .single()
    if (profErr || !profile) {
        return NextResponse.json({ error: 'Профиль клиента не найден' }, { status: 404 })
    }
    const slug = profile.training_brain_client_id
    if (!slug) {
        return NextResponse.json(
            {
                error: 'У клиента не указан client_id для training-brain',
                hint: 'Заполни поле training_brain_client_id в карточке клиента, например "dimon".',
            },
            { status: 400 },
        )
    }

    // 3. Тренировочные записи (entries)
    const { data: entries, error: entryErr } = await db
        .from('training_entries')
        .select('*')
        .eq('program_id', programId)
        .order('day_number', { ascending: true })
    if (entryErr) {
        return NextResponse.json({ error: 'Ошибка загрузки entries: ' + entryErr.message }, { status: 500 })
    }

    // 3b. Ответы клиента на чек-ин недели (опционально, может отсутствовать).
    const { data: checkin } = await db
        .from('weekly_checkins')
        .select('answers')
        .eq('program_id', programId)
        .maybeSingle()
    const checkinAnswers = (checkin?.answers as Record<string, string> | null) || null

    // 4. Сборка markdown дневника
    const md = buildDiaryMd(program, (entries || []) as TrainingEntry[], {
        clientName: profile.full_name,
        clientId: slug,
        checkinAnswers,
    })

    // 5. Куда пушить
    const mesocycle = extractMesocycle(program.program_md || md)
    const path = `clients/${slug}/mesocycle-${mesocycle}/week-${program.week_number}-filled.md`
    const message = `chore(${slug}): дневник недели ${program.week_number} (mesocycle ${mesocycle})`

    // 6. Пушим прямо в main (без PR)
    try {
        const result = await putFile({
            path,
            content: md,
            message,
        })
        return NextResponse.json({
            path,
            htmlUrl: result.htmlUrl,
            sha: result.sha,
            owner: GITHUB_TRAINING_BRAIN_OWNER,
            repo: GITHUB_TRAINING_BRAIN_REPO,
        })
    } catch (e) {
        if (e instanceof GitHubError) {
            return NextResponse.json({ error: e.message }, { status: e.status === 401 ? 401 : 502 })
        }
        const msg = e instanceof Error ? e.message : 'Failed to push diary'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
