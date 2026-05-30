// Prodamus — построение платёжной ссылки и кодирование order_id.
//
// Этот модуль НЕ импортирует 'crypto' и безопасен для клиента (payment/renew страницы).
// Подпись для исходящей ссылки НЕ требуется: Продамус принимает обычную ссылку с
// параметрами do=pay (см. пример в официальной документации). Подпись нужна только
// для проверки ВХОДЯЩЕГО вебхука — это в prodamus-signature.ts (серверный модуль).

export type ProdamusOrderType = 'init' | 'renewal' | 'nutrition'

/**
 * Кодирует тип платежа + пользователя + запись платежа в order_id.
 * Формат: <type>_<userId(36)>_<paymentId(36)>
 * UUID не содержит '_' и имеет фиксированную длину 36 — парсится однозначно.
 */
export function buildOrderId(type: ProdamusOrderType, userId: string, paymentId: string): string {
    return `${type}_${userId}_${paymentId}`
}

export interface ParsedOrderId {
    type: ProdamusOrderType | 'unknown'
    userId: string
    paymentId: string
}

/**
 * Разбирает order_id обратно в { type, userId, paymentId }.
 * Стойко к мусору — при неудаче вернёт type='unknown'.
 */
export function parseOrderId(orderId: string): ParsedOrderId {
    const sep = orderId.indexOf('_')
    if (sep === -1) {
        return { type: 'unknown', userId: '', paymentId: '' }
    }
    const rawType = orderId.slice(0, sep)
    const rest = orderId.slice(sep + 1)
    const userId = rest.slice(0, 36)
    const paymentId = rest.slice(37) // +1 за разделитель '_'

    const type: ParsedOrderId['type'] =
        rawType === 'init' || rawType === 'renewal' || rawType === 'nutrition'
            ? rawType
            : 'unknown'

    return { type, userId, paymentId }
}

export interface ProdamusLinkParams {
    /** Базовый URL платёжной формы, напр. https://metasystem.payform.ru */
    formUrl: string
    /** Наш номер заказа (см. buildOrderId) */
    orderId: string
    /** Наименование товара — попадёт в чек */
    productName: string
    /** Цена за единицу в рублях */
    price: number
    /** Количество (по умолчанию 1) */
    quantity?: number
    /** E-mail клиента (для чека и привязки) */
    customerEmail?: string | null
    /** Телефон клиента (необязательно) */
    customerPhone?: string | null
    /** Куда вернуть пользователя при успешной оплате */
    urlSuccess?: string
    /** Куда вернуть пользователя, если он ушёл без оплаты */
    urlReturn?: string
    /** Описание заказа (поле «Дополнительные данные») */
    customerExtra?: string
}

/**
 * Собирает ссылку на оплату Продамус для прямого перехода (do=pay).
 *
 * Подпись намеренно не добавляется: для пользовательского редиректа она не нужна,
 * а факт оплаты подтверждается только вебхуком с валидной подписью.
 */
export function buildProdamusLink(params: ProdamusLinkParams): string {
    const {
        formUrl,
        orderId,
        productName,
        price,
        quantity = 1,
        customerEmail,
        customerPhone,
        urlSuccess,
        urlReturn,
        customerExtra,
    } = params

    const sp = new URLSearchParams()
    sp.set('order_id', orderId)
    sp.set('do', 'pay')

    // Товарная позиция (формат массива products[0][...])
    sp.set('products[0][name]', productName)
    sp.set('products[0][price]', String(price))
    sp.set('products[0][quantity]', String(quantity))

    if (customerEmail) sp.set('customer_email', customerEmail)
    if (customerPhone) sp.set('customer_phone', customerPhone)
    if (customerExtra) sp.set('customer_extra', customerExtra)
    if (urlSuccess) sp.set('urlSuccess', urlSuccess)
    if (urlReturn) sp.set('urlReturn', urlReturn)

    const base = formUrl.replace(/\/+$/, '')
    return `${base}/?${sp.toString()}`
}
