// MetaSystem — GitHub Training Brain Service (server-side)
//
// Утилиты для работы с приватным репозиторием training-brain через GitHub API.
// Используются server-side (api routes) с GITHUB_TOKEN из env.

const OWNER = process.env.GITHUB_TRAINING_BRAIN_OWNER || 'dgmuk'
const REPO = process.env.GITHUB_TRAINING_BRAIN_REPO || 'training-brain'
const REF = process.env.GITHUB_TRAINING_BRAIN_REF || 'main'

const API_BASE = 'https://api.github.com'

export class GitHubError extends Error {
    constructor(message: string, public status: number) {
        super(message)
        this.name = 'GitHubError'
    }
}

function requireToken(): string {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
        throw new GitHubError(
            'GITHUB_TOKEN не задан. Добавь его в .env.local — нужен токен с scope "repo".',
            401,
        )
    }
    return token
}

async function ghFetch(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const token = requireToken()
    const headers: Record<string, string> = {
        'User-Agent': 'MetaSystem-Admin',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
    }
    // Серверный таймаут чтобы fetch не висел вечно если GitHub медленный или сеть упала.
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, {
            ...init,
            headers,
            signal: controller.signal,
            // ВАЖНО: не кешируем — иначе при повторном чтении файла получаем устаревший sha
            // и обновление в GitHub падает с 409 conflict.
            cache: 'no-store',
        })
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            throw new GitHubError(`GitHub не ответил за ${timeoutMs / 1000} сек. Попробуй ещё раз.`, 504)
        }
        throw e
    } finally {
        clearTimeout(t)
    }
}

/**
 * Тип ответа Contents API: либо файл, либо список файлов в директории.
 */
interface ContentsItem {
    type: 'file' | 'dir' | 'submodule' | 'symlink'
    name: string
    path: string
    sha: string
    size: number
    download_url: string | null
}

interface ContentsFile extends ContentsItem {
    type: 'file'
    content?: string // base64
    encoding?: 'base64'
}

/**
 * Получить содержимое файла из репозитория.
 * Возвращает { md, sha } или бросает GitHubError.
 */
export async function getFileContent(path: string, ref: string = REF): Promise<{ md: string; sha: string }> {
    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`
    const res = await ghFetch(url)
    if (res.status === 404) throw new GitHubError(`Файл не найден: ${path}@${ref}`, 404)
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new GitHubError(`GitHub ${res.status} ${res.statusText}: ${text.slice(0, 200)}`, res.status)
    }
    const json = (await res.json()) as ContentsFile
    if (!json.content || json.encoding !== 'base64') {
        throw new GitHubError('Неожиданный формат ответа GitHub Contents API', 502)
    }
    const md = Buffer.from(json.content, 'base64').toString('utf-8')
    return { md, sha: json.sha }
}

/**
 * Получить список файлов в директории.
 */
export async function listDirectory(path: string, ref: string = REF): Promise<ContentsItem[]> {
    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`
    const res = await ghFetch(url)
    if (res.status === 404) return []
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new GitHubError(`GitHub ${res.status} ${res.statusText}: ${text.slice(0, 200)}`, res.status)
    }
    const json = await res.json()
    return Array.isArray(json) ? json as ContentsItem[] : []
}

/**
 * Создать или обновить файл в репозитории.
 * Если файла ещё нет — создать. Если есть — обновить с указанием sha.
 *
 * Если GitHub отдаёт 409 (sha устарел, кто-то изменил файл между нашим
 * чтением и записью), один раз перечитываем актуальный sha и пробуем снова.
 */
export async function putFile(params: {
    path: string
    content: string
    message: string
    branch?: string
    sha?: string
}): Promise<{ sha: string; htmlUrl: string }> {
    const branch = params.branch || REF
    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(params.path).replace(/%2F/g, '/')}`
    const contentBase64 = Buffer.from(params.content, 'utf-8').toString('base64')

    // Если sha не передали, попытаемся получить — для обновления нужен sha существующего файла
    let sha = params.sha
    if (!sha) {
        try {
            const existing = await getFileContent(params.path, branch)
            sha = existing.sha
        } catch (e) {
            if (!(e instanceof GitHubError && e.status === 404)) throw e
            // Если 404 — файла нет, sha не нужен
        }
    }

    const doPut = async (currentSha: string | undefined) => {
        const body: Record<string, unknown> = {
            message: params.message,
            content: contentBase64,
            branch,
        }
        if (currentSha) body.sha = currentSha

        return ghFetch(url, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })
    }

    let res = await doPut(sha)

    // 409 conflict или 422 (sha mismatch) — перечитываем sha и пробуем ещё один раз
    if ((res.status === 409 || res.status === 422) && !params.sha) {
        try {
            const fresh = await getFileContent(params.path, branch)
            res = await doPut(fresh.sha)
        } catch (e) {
            if (!(e instanceof GitHubError && e.status === 404)) throw e
            res = await doPut(undefined)
        }
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new GitHubError(`GitHub PUT ${res.status} ${res.statusText}: ${text.slice(0, 300)}`, res.status)
    }
    const json = await res.json() as { content?: { sha: string; html_url: string } }
    if (!json.content?.sha || !json.content.html_url) {
        throw new GitHubError('Неожиданный ответ GitHub PUT contents', 502)
    }
    return { sha: json.content.sha, htmlUrl: json.content.html_url }
}

/**
 * Найти последнюю week-N.md в папке клиента.
 *
 * Перебирает все мезоциклы (mesocycle-1, mesocycle-2, ...) и в каждом
 * ищет максимальный week-N.md. Возвращает информацию о найденном файле или null.
 */
export async function findLatestWeek(clientId: string): Promise<{
    path: string
    weekNumber: number
    mesocycle: number
    md: string
    sha: string
} | null> {
    const clientPath = `clients/${clientId}`
    const items = await listDirectory(clientPath)
    if (items.length === 0) return null

    // Ищем папки mesocycle-N
    const mesoFolders = items
        .filter(i => i.type === 'dir' && /^mesocycle-\d+$/.test(i.name))
        .map(i => ({ name: i.name, num: parseInt(i.name.replace('mesocycle-', ''), 10) }))
        .sort((a, b) => b.num - a.num) // от большего к меньшему

    if (mesoFolders.length === 0) return null

    // Идём по мезоциклам от свежего к старому, ищем max week-N.md
    for (const meso of mesoFolders) {
        const mesoPath = `${clientPath}/${meso.name}`
        const files = await listDirectory(mesoPath)
        const weeks = files
            .filter(f => f.type === 'file' && /^week-\d+\.md$/.test(f.name))
            .map(f => ({ name: f.name, num: parseInt(f.name.replace(/^week-(\d+)\.md$/, '$1'), 10), path: f.path }))
            .sort((a, b) => b.num - a.num)

        if (weeks.length > 0) {
            const latest = weeks[0]
            const { md, sha } = await getFileContent(latest.path)
            return {
                path: latest.path,
                weekNumber: latest.num,
                mesocycle: meso.num,
                md,
                sha,
            }
        }
    }

    return null
}

export const GITHUB_TRAINING_BRAIN_REF = REF
export const GITHUB_TRAINING_BRAIN_OWNER = OWNER
export const GITHUB_TRAINING_BRAIN_REPO = REPO
