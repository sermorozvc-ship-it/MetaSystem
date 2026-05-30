// Prodamus — построение платёжной ссылки.
//
// Этот модуль НЕ импортирует 'crypto' и безопасен для клиента (payment/renew страницы).
// Подпись для исходящей ссылки НЕ требуется: Продамус принимает обычную ссылку с
// параметрами do=pay (см. пример в официальной документации). Подпись нужна только
// для проверки ВХОДЯЩЕГО вебхука — это в prodamus-signature.ts (серверный модуль).
//
// ⚠️ order_id = ТОЛЬКО paymentId (UUID, 36 символов).
// Форма Prodamus отдаёт 500 на слишком длинных order_id (>~50 символов), поэтому
// мы НЕ кодируем туда тип/userId. Вебхук находит запись payments по этому id и
// берёт user_id + renewal_type из самой строки БД.

export interface ProdamusLinkParams {
    /** Базовый URL платёжной формы, напр. https://metasystem.payform.ru */
    formUrl: string
    /** id записи в таблице payments — он же order_id */
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
