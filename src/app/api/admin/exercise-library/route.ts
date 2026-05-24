// MetaSystem — API для получения exercise-library из training-brain
import { NextResponse } from 'next/server'
import { getFileContent, GitHubError } from '@/lib/services/github-training-brain'

export const runtime = 'nodejs'
// Не используем декларативный revalidate — кеш ведёт к устаревшему sha при чтении/обновлении.
// Кеширование на стороне клиента происходит через UI (компонент тащит библиотеку один раз
// при монтировании и переиспользует данные).
export const dynamic = 'force-dynamic'

const PATH = process.env.GITHUB_TRAINING_BRAIN_PATH || 'knowledge-base/exercises/exercise-library.md'

export async function GET() {
    try {
        const { md, sha } = await getFileContent(PATH)
        return NextResponse.json({
            md,
            source: 'github',
            sha,
            fetchedAt: new Date().toISOString(),
        })
    } catch (e) {
        if (e instanceof GitHubError) {
            return NextResponse.json(
                {
                    error: e.message,
                    hint: e.status === 401
                        ? 'Создай токен в Settings → Developer settings → Personal access tokens (classic), scope "repo".'
                        : undefined,
                },
                { status: e.status === 401 ? 401 : 502 },
            )
        }
        const msg = e instanceof Error ? e.message : 'Failed to fetch exercise library'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
