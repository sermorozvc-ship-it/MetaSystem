// MetaSystem — Парсер вопросов чек-ина из markdown
//
// Из текста раздела `## 📊 Чек-ин в конце недели` вытаскивает только
// строки списка `- ...` и приводит их к виду {key, label, hint}.
// Используется в двух местах:
// - UI клиента (форма для ответов).
// - Сборщик дневника (при экспорте подставляет ответы по тем же ключам).

export interface CheckinQuestion {
    /** Уникальный ключ для хранения ответа в БД. Используется label как ключ для устойчивости. */
    key: string
    /** Текст вопроса как видит клиент */
    label: string
    /** Подсказка/уточнение в скобках, типа "(да / пропущено, причина)" */
    hint?: string
    /** Тип инпута, выбирается по эвристике */
    inputType: 'number' | 'text' | 'textarea'
    /** min/max для number полей если в label есть "(1-10)" */
    min?: number
    max?: number
}

/**
 * Извлекает вопросы из markdown чек-ина.
 *
 * Алгоритм: берём все строки начинающиеся с `- ` (это пункты списка),
 * обрезаем `**bold**`, отделяем хвост в скобках как hint, выбираем тип
 * инпута по виду текста (число для "1-10" и "Вес", textarea для "Заметки").
 */
export function parseCheckinQuestions(checkinMd: string): CheckinQuestion[] {
    if (!checkinMd) return []
    const out: CheckinQuestion[] = []

    for (const raw of checkinMd.split('\n')) {
        const line = raw.trim()
        if (!line.startsWith('- ')) continue
        let body = line.slice(2).trim()

        // Убираем markdown bold/italic
        body = body
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')

        // Отделяем "(подсказка)" в конце строки от label
        // Пример: "Все ли тренировки выполнены? (да / пропущено, причина)"
        let label = body
        let hint: string | undefined
        const hintMatch = body.match(/^(.*?)(\s*\([^)]+\))\s*$/)
        if (hintMatch) {
            label = hintMatch[1].trim()
            hint = hintMatch[2].trim().replace(/^\(/, '').replace(/\)$/, '')
        }

        // Убираем завершающее двоеточие у label, чтобы UI отрисовал его сам
        const cleanLabel = label.replace(/\s*:\s*$/, '').trim()
        if (!cleanLabel) continue

        // Тип инпута: эвристика
        // - "1-10" → number с min=1 max=10
        // - "1-5"  → number с min=1 max=5
        // - "Вес" → number без жёстких границ
        // - "Заметки", "вопросы тренеру" → textarea
        // - всё остальное → text
        let inputType: CheckinQuestion['inputType'] = 'text'
        let min: number | undefined
        let max: number | undefined

        const rangeMatch = cleanLabel.match(/\((\d+)\s*[-–]\s*(\d+)\)/)
        if (rangeMatch) {
            inputType = 'number'
            min = parseInt(rangeMatch[1], 10)
            max = parseInt(rangeMatch[2], 10)
        } else if (/\bвес\b/i.test(cleanLabel)) {
            inputType = 'number'
        } else if (/заметк|вопрос|причин|пожелан|комментар/i.test(cleanLabel)) {
            inputType = 'textarea'
        }

        out.push({
            key: cleanLabel, // key совпадает с label — устойчиво и читаемо в БД
            label: cleanLabel,
            hint,
            inputType,
            min,
            max,
        })
    }

    return out
}

/**
 * Форматирует ответы клиента в markdown-блок для дневника.
 * Возвращает пустую строку если ответов нет вообще.
 */
export function formatCheckinAnswers(
    questions: CheckinQuestion[],
    answers: Record<string, string>,
): string {
    const filled = questions.filter(q => {
        const a = answers[q.key]
        return a !== undefined && a !== null && String(a).trim() !== ''
    })
    if (filled.length === 0) return ''

    const lines: string[] = []
    lines.push('## 💬 Чек-ин клиента')
    lines.push('')
    for (const q of filled) {
        const value = String(answers[q.key]).trim()
        // Многострочный ответ форматируем как блок
        if (value.includes('\n')) {
            lines.push(`- **${q.label}:**`)
            for (const ln of value.split('\n')) {
                lines.push(`  ${ln}`)
            }
        } else {
            lines.push(`- **${q.label}:** ${value}`)
        }
    }
    return lines.join('\n')
}
