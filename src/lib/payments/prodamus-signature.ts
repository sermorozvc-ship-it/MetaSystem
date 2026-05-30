// Prodamus — проверка подписи вебхука (СЕРВЕРНЫЙ модуль, использует node:crypto).
//
// Алгоритм подписи (из официальной документации Продамуса, метод Hmac::create):
//   1. Все значения привести к строкам (рекурсивно).
//   2. Отсортировать содержимое по ключам в алфавитном порядке, в т.ч. вглубь (ksort).
//   3. Перевести в JSON-строку (как PHP json_encode c JSON_UNESCAPED_UNICODE:
//      кириллица остаётся как есть).
//   4. В JSON-строке экранировать '/' → '\/' (PHP по умолчанию это делает).
//   5. Подписать получившуюся строку через HMAC-SHA256 секретным ключом → hex.
//
// Подпись приходит в HTTP-заголовке `Sign`. Тело — application/x-www-form-urlencoded
// с вложенными полями вида products[0][name]=... Подтверждением оплаты считается
// ТОЛЬКО валидный вебхук (не возврат пользователя на urlSuccess).

import { createHmac, timingSafeEqual } from 'crypto'

// ──────────────────────────────────────────────────────────────────────────
// Парсер тела x-www-form-urlencoded с поддержкой вложенности key[a][b]=v
// ──────────────────────────────────────────────────────────────────────────

type NestedValue = string | NestedNode
interface NestedNode {
    [key: string]: NestedValue
}

/**
 * Разбирает путь ключа "products[0][name]" → ['products','0','name'].
 */
function parseKeyPath(key: string): string[] {
    const out: string[] = []
    const firstBracket = key.indexOf('[')
    if (firstBracket === -1) return [key]

    out.push(key.slice(0, firstBracket))
    const rest = key.slice(firstBracket)
    const re = /\[([^\]]*)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(rest)) !== null) {
        out.push(m[1])
    }
    return out
}

/**
 * Кладёт значение в дерево по сегментам пути, создавая промежуточные узлы.
 * Пустой сегмент '' (синтаксис key[]) превращается в следующий числовой индекс.
 */
function assignNested(root: NestedNode, path: string[], value: string): void {
    let node: NestedNode = root
    for (let i = 0; i < path.length; i++) {
        let seg = path[i]
        const isLast = i === path.length - 1

        if (seg === '') {
            // авто-индекс для синтаксиса []
            let idx = 0
            while (Object.prototype.hasOwnProperty.call(node, String(idx))) idx++
            seg = String(idx)
        }

        if (isLast) {
            node[seg] = value
        } else {
            const existing = node[seg]
            if (existing === undefined || typeof existing === 'string') {
                const next: NestedNode = {}
                node[seg] = next
                node = next
            } else {
                node = existing
            }
        }
    }
}

/**
 * Парсит сырое тело формы (x-www-form-urlencoded) в дерево объектов.
 */
export function parseFormBody(rawBody: string): NestedNode {
    const params = new URLSearchParams(rawBody)
    return parseFormEntries(params.entries())
}

/**
 * Парсит произвольный набор пар [key, value] в дерево объектов.
 * Подходит и для URLSearchParams, и для FormData (multipart/form-data).
 * Значения-файлы (не строки) игнорируются — в вебхуке Продамуса их нет.
 */
export function parseFormEntries(
    entries: Iterable<[string, FormDataEntryValue]> | Iterable<[string, string]>,
): NestedNode {
    const root: NestedNode = {}
    for (const [key, value] of entries as Iterable<[string, FormDataEntryValue]>) {
        if (typeof value !== 'string') continue
        assignNested(root, parseKeyPath(key), value)
    }
    return root
}

// ──────────────────────────────────────────────────────────────────────────
// Сериализация как PHP json_encode($data, JSON_UNESCAPED_UNICODE) после ksort
// ──────────────────────────────────────────────────────────────────────────

/**
 * Проверяет, является ли узел «списком» (ключи 0..n-1) — тогда PHP кодирует
 * его как JSON-массив [...], иначе как объект {...}.
 */
function isList(node: NestedNode): boolean {
    const keys = Object.keys(node)
    if (keys.length === 0) return true // PHP: пустой массив → []
    for (let i = 0; i < keys.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(node, String(i))) return false
    }
    return true
}

/**
 * Сравнение ключей в стиле PHP ksort (SORT_REGULAR):
 * числовые ключи сравниваются как числа, иначе как строки.
 */
function compareKeys(a: string, b: string): number {
    const na = Number(a)
    const nb = Number(b)
    const aNum = a !== '' && Number.isFinite(na)
    const bNum = b !== '' && Number.isFinite(nb)
    if (aNum && bNum) return na - nb
    if (a < b) return -1
    if (a > b) return 1
    return 0
}

/**
 * Рекурсивная сериализация дерева в JSON-строку, повторяющая поведение PHP:
 * - значения-строки кодируются как JSON (юникод остаётся литералом);
 * - объекты сортируются по ключам (ksort) вглубь;
 * - списки кодируются как массивы в порядке индексов.
 * Экранирование '/' выполняется отдельно на финальной строке.
 */
function phpJsonEncode(node: NestedValue): string {
    if (typeof node === 'string') {
        // JSON.stringify не экранирует unicode и не трогает '/', что совпадает
        // с JSON_UNESCAPED_UNICODE. Слэши экранируем глобально в самом конце.
        return JSON.stringify(node)
    }

    if (isList(node)) {
        const keys = Object.keys(node)
            .map((k) => Number(k))
            .sort((a, b) => a - b)
        const items = keys.map((k) => phpJsonEncode(node[String(k)]))
        return `[${items.join(',')}]`
    }

    const keys = Object.keys(node).sort(compareKeys)
    const parts = keys.map((k) => `${JSON.stringify(k)}:${phpJsonEncode(node[k])}`)
    return `{${parts.join(',')}}`
}

/**
 * Формирует подпись данных (соответствует Hmac::create в библиотеке Продамуса).
 */
export function createSignature(data: NestedNode, secretKey: string): string {
    let json = phpJsonEncode(data)
    // Шаг 4: экранируем '/' → '\/'. Слэш встречается только внутри строковых
    // значений, структурные символы JSON его не содержат, поэтому глобально безопасно.
    json = json.replace(/\//g, '\\/')
    return createHmac('sha256', secretKey).update(json, 'utf8').digest('hex')
}

/**
 * Проверяет подпись входящего вебхука.
 *
 * @param data       распарсенное тело запроса (см. parseFormBody)
 * @param secretKey  секретный ключ платёжной страницы Продамуса
 * @param receivedSign значение заголовка `Sign`
 */
export function verifySignature(
    data: NestedNode,
    secretKey: string,
    receivedSign: string | null | undefined,
): boolean {
    if (!receivedSign) return false
    const expected = createSignature(data, secretKey)

    // Сравнение постоянного времени. Подписи — hex одинаковой длины (64 симв.),
    // но на всякий случай защищаемся от разной длины.
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(receivedSign, 'utf8')
    if (a.length !== b.length) return false
    try {
        return timingSafeEqual(a, b)
    } catch {
        return false
    }
}
