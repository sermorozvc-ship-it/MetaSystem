// MetaSystem — Exercise Library
//
// Каноничная библиотека упражнений берётся из training-brain:
// https://github.com/dgmuk/training-brain/blob/main/knowledge-base/exercises/exercise-library.md
//
// Этот файл умеет:
// - распарсить markdown библиотеки в структуру { name, videoUrl, group } [];
// - сверить программу пользователя с библиотекой и подсветить расхождения;
// - подставить недостающие [Видео](...) ссылки в имеющийся markdown.

export interface LibraryExercise {
    /** Каноничное имя из библиотеки, "Жим штанги лёжа" */
    name: string
    /** Полная ссылка на видео или undefined если в библиотеке плейсхолдер */
    videoUrl?: string
    /** Раздел библиотеки, например "Грудные" */
    group: string
}

export interface ExerciseValidationIssue {
    /** Имя упражнения как написано в программе тренера */
    nameInProgram: string
    /** Тип проблемы */
    kind: 'unknown' | 'placeholder-video'
    /** Если imя похоже на одно из библиотечных — подсказка */
    suggestion?: string
}

export interface ExerciseValidationResult {
    /** Список упражнений из программы и их статус */
    matched: Array<{ nameInProgram: string; canonical: LibraryExercise }>
    /** Список проблем */
    issues: ExerciseValidationIssue[]
}

/**
 * Парсит markdown exercise-library.md в плоский список упражнений.
 *
 * Формат блока (см. training-brain):
 *   ## 🛡️ Грудные         ← раздел (group)
 *
 *   ### Жим штанги лёжа    ← имя
 *   [Видео](https://...)   ← ссылка, опционально
 *   Техника: ...           ← опционально, игнорируем
 */
export function parseExerciseLibrary(md: string): LibraryExercise[] {
    if (!md) return []
    const lines = md.split('\n')
    const exercises: LibraryExercise[] = []
    let currentGroup = ''
    let pending: { name: string; videoUrl?: string } | null = null

    const flush = () => {
        if (!pending) return
        exercises.push({
            name: pending.name,
            videoUrl: pending.videoUrl,
            group: currentGroup,
        })
        pending = null
    }

    for (const raw of lines) {
        const line = raw.trim()

        // Раздел уровня 2: ## Грудные / ## 🛡️ Грудные
        if (line.startsWith('## ')) {
            flush()
            // Срезаем эмодзи и спецсимволы, оставляем читаемое имя группы
            currentGroup = line.replace(/^##\s*/, '').replace(/[^\p{L}\p{N}\s/()-]/gu, '').trim()
            continue
        }

        // Имя упражнения: ### Точное имя
        if (line.startsWith('### ')) {
            flush()
            const name = line.replace(/^###\s*/, '').trim()
            if (name) pending = { name }
            continue
        }

        // Ссылка: [Видео](url)
        if (pending && !pending.videoUrl) {
            const m = line.match(/^\[Видео\]\(([^)]+)\)/i)
            if (m) {
                const url = m[1].trim()
                // Игнорируем плейсхолдеры https://... и пустые
                if (url && url !== 'https://...' && /^https?:\/\//i.test(url) && !url.endsWith('//...')) {
                    pending.videoUrl = url
                }
                continue
            }
        }
    }
    flush()
    return exercises
}

/** Нормализует имя для сравнения: нижний регистр, убирает ё→е, схлопывает пробелы. */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}\s()-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Расстояние Левенштейна для подсказок похожих упражнений. */
function levenshtein(a: string, b: string): number {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length
    const v0: number[] = new Array(b.length + 1)
    const v1: number[] = new Array(b.length + 1)
    for (let i = 0; i <= b.length; i++) v0[i] = i
    for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1
        for (let j = 0; j < b.length; j++) {
            const cost = a[i] === b[j] ? 0 : 1
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
        }
        for (let j = 0; j <= b.length; j++) v0[j] = v1[j]
    }
    return v1[b.length]
}

/**
 * Извлекает имена всех упражнений из markdown программы.
 * Считает строки `### …`, исключая чек-ин и статистику.
 */
function extractExerciseNamesFromProgram(md: string): string[] {
    const names: string[] = []
    for (const raw of md.split('\n')) {
        const line = raw.trim()
        if (!line.startsWith('### ')) continue
        const name = line.replace(/^###\s*/, '').trim()
        if (!name) continue
        // Пропускаем служебные ### блоки — статистика, чек-ин, и т.п.
        if (/^📊/.test(name)) continue
        if (/^чек.?ин/i.test(name)) continue
        names.push(name)
    }
    return names
}

/**
 * Извлекает имена альтернатив из строк блока `**Альтернативы:**`.
 * Формат строки: `- Название | [Видео](url) | 4 x 10-12`
 */
function extractAlternativeNames(md: string): string[] {
    const names: string[] = []
    let inAlts = false
    for (const raw of md.split('\n')) {
        const line = raw.trim()
        if (/^\*\*Альтернатив[ыа]:\*\*/i.test(line)) { inAlts = true; continue }
        if (inAlts && line.startsWith('- ')) {
            const altName = line.slice(2).split('|')[0].trim()
            if (altName) names.push(altName)
        } else if (inAlts && line && !line.startsWith('- ')) {
            inAlts = false
        }
    }
    return names
}

/**
 * Проверяет программу против библиотеки: какие упражнения нашлись точно,
 * какие отсутствуют (с подсказкой ближайшего по Левенштейну), какие имеют
 * только плейсхолдер ссылки в библиотеке.
 */
export function validateProgramAgainstLibrary(
    programMd: string,
    library: LibraryExercise[],
): ExerciseValidationResult {
    const result: ExerciseValidationResult = { matched: [], issues: [] }
    if (library.length === 0) return result

    const libByNorm = new Map<string, LibraryExercise>()
    for (const ex of library) libByNorm.set(normalizeName(ex.name), ex)

    const allNames = [
        ...extractExerciseNamesFromProgram(programMd),
        ...extractAlternativeNames(programMd),
    ]
    const seen = new Set<string>()
    for (const rawName of allNames) {
        // Очищаем хвосты типа " *(альтернатива к: ...)*"
        const name = rawName.replace(/\*\(альтернатива[^)]*\)\*/gi, '').trim()
        if (!name || seen.has(name)) continue
        seen.add(name)

        const norm = normalizeName(name)
        const exact = libByNorm.get(norm)
        if (exact) {
            result.matched.push({ nameInProgram: name, canonical: exact })
            if (!exact.videoUrl) {
                result.issues.push({
                    nameInProgram: name,
                    kind: 'placeholder-video',
                })
            }
            continue
        }

        // Не нашлось — подбираем ближайший по Левенштейну
        let best: { name: string; dist: number } | null = null
        for (const lib of library) {
            const d = levenshtein(norm, normalizeName(lib.name))
            if (best === null || d < best.dist) best = { name: lib.name, dist: d }
        }
        const suggestion = best && best.dist <= Math.max(3, Math.floor(norm.length * 0.3))
            ? best.name
            : undefined
        result.issues.push({ nameInProgram: name, kind: 'unknown', suggestion })
    }

    return result
}

/**
 * Подставляет недостающие `[Видео](url)` ссылки в markdown программы для
 * упражнений, которые есть в библиотеке. Не меняет имена, не добавляет
 * упражнения которых нет, не трогает уже стоящие ссылки.
 *
 * Также подставляет ссылку для альтернатив, у которых пусто.
 */
export function applyLibraryVideos(
    programMd: string,
    library: LibraryExercise[],
): { md: string; addedCount: number } {
    if (!programMd || library.length === 0) return { md: programMd, addedCount: 0 }

    const libByNorm = new Map<string, LibraryExercise>()
    for (const ex of library) libByNorm.set(normalizeName(ex.name), ex)

    const lines = programMd.split('\n')
    const out: string[] = []
    let addedCount = 0

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        out.push(line)
        const trimmed = line.trim()

        // Основное упражнение: ### Имя, и СЛЕДУЮЩАЯ строка не [Видео](...)
        if (trimmed.startsWith('### ')) {
            const name = trimmed.replace(/^###\s*/, '').trim()
            if (!name || /^📊/.test(name) || /^чек.?ин/i.test(name)) continue
            const lib = libByNorm.get(normalizeName(name))
            if (!lib?.videoUrl) continue

            const next = (lines[i + 1] ?? '').trim()
            if (next.startsWith('[Видео](')) continue // уже есть
            // Вставляем [Видео](url) сразу после заголовка
            out.push(`[Видео](${lib.videoUrl})`)
            addedCount++
            continue
        }

        // Альтернативы: - Название | [Видео](url) | 4 x 10-12
        // или         - Название | 4 x 10-12  (без видео — пробуем подставить)
        if (trimmed.startsWith('- ') && trimmed.includes('|')) {
            const parts = trimmed.slice(2).split('|').map(s => s.trim())
            const altName = parts[0]
            if (!altName) continue
            const hasVideo = parts.some(p => /^\[Видео\]\(/i.test(p))
            if (hasVideo) continue
            const lib = libByNorm.get(normalizeName(altName))
            if (!lib?.videoUrl) continue
            // Перевыводим строку с подставленной ссылкой между именем и параметрами
            const rest = parts.slice(1)
            const newLine = `- ${[altName, `[Видео](${lib.videoUrl})`, ...rest].join(' | ')}`
            // Заменяем уже вставленную в out
            out[out.length - 1] = line.replace(trimmed, newLine)
            addedCount++
        }
    }

    return { md: out.join('\n'), addedCount }
}
