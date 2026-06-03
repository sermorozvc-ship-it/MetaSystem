# 💳 PAYMENT FLOW — Документация и отладка (Prodamus)

> Этот файл описывает полную конфигурацию платёжной системы Prodamus.
> При любых сбоях используй этот документ как чеклист.
>
> ⚠️ Миграция с ЮMoney → Prodamus выполнена 2026-05-30. Старый вебхук
> `/api/payments/yoomoney-webhook` удалён, оплаты полностью на Prodamus.

---

## 📊 Общая схема флоу

```
Регистрация (/auth)
    ↓ автоматический вход (email confirmation ОТКЛЮЧЁН)
Страница оплаты (/payment)
    ↓ создаётся pending-запись в payments, нажимает «Оплатить»
Prodamus (платёжная форма metasystem.payform.ru)
    ↓ пользователь оплачивает
Prodamus → HTTP Notification (webhook) → /api/payments/prodamus-webhook
    ↓ webhook проверяет подпись (заголовок Sign, HMAC-SHA256),
      обновляет payments.status = 'confirmed', активирует подписку
Страница оплаты автополлинг (каждые 3 сек) → обнаруживает 'confirmed'
    ↓ window.location.href = '/onboarding'
Онбординг (/onboarding) → Зал ожидания → Dashboard
```

Подтверждением оплаты считается **только webhook с валидной подписью**.
Возврат пользователя на `urlSuccess` фактом оплаты НЕ является.

---

## ⚙️ Переменные окружения

### `.env.local` (локально) и Vercel (продакшн)
```env
NEXT_PUBLIC_SUPABASE_URL=https://bzyypoyvihqhrbllgffh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # Для webhook — обходит RLS

# Prodamus
NEXT_PUBLIC_PRODAMUS_FORM_URL=https://metasystem.payform.ru
PRODAMUS_SECRET_KEY=...              # Секрет для проверки подписи вебхука
NEXT_PUBLIC_APP_URL=https://meta-system-ja1o.vercel.app
```

> ⚠️ После изменения переменных на Vercel — сделайте Redeploy!
> `PRODAMUS_SECRET_KEY` берётся в ЛК Prodamus → Настройки платёжной страницы →
> вкладка «Интеграция» (там же, где URL для уведомлений).

---

## 🏗️ Файлы платёжной системы

| Файл | Назначение |
|---|---|
| `src/app/payment/page.tsx` | Первичная оплата — UI + polling |
| `src/app/renew/page.tsx` | Продление тарифа |
| `src/app/add-nutrition/page.tsx` | Докупка плана питания |
| `src/lib/payments/prodamus-link.ts` | Сборка ссылки + кодирование order_id (клиент-safe) |
| `src/lib/payments/prodamus-signature.ts` | Проверка подписи вебхука (сервер) |
| `src/app/api/payments/prodamus-webhook/route.ts` | Webhook от Prodamus |
| `src/lib/services/payment.ts` | Функции работы с payments (первичная оплата) |
| `src/lib/services/renewal.ts` | Продление + докупка питания |
| `docs/INSTALLMENTS_INFO.md` | Рассрочки — комиссии, расчёты, управление |

---

## 🔗 Связка платёж ↔ пользователь: order_id

`order_id` = **id записи в таблице `payments`** (UUID, 36 символов).

> ⚠️ Форма Prodamus отдаёт 500 на слишком длинных `order_id` (>~50 символов),
> поэтому тип платежа и `userId` в `order_id` НЕ кодируются. Вебхук находит
> строку `payments` по этому id и берёт `user_id` + `renewal_type` из неё:
> - `renewal_type = 'initial'` → первичная оплата
> - `renewal_type = 'renewal' | 'plan_change'` → продление тарифа
> - `renewal_type = 'nutrition_upgrade'` → докупка питания
>
> Если записи нет (платёж не через сайт) — fallback по `customer_email`.

---

## 🔐 Алгоритм подписи Prodamus

Используется и для проверки вебхука (`prodamus-signature.ts`). Подпись приходит
в HTTP-заголовке **`Sign`**. Шаги (как в библиотеке Hmac от Prodamus):

1. Все значения привести к строкам (рекурсивно).
2. Отсортировать ключи по алфавиту, в том числе вглубь (PHP `ksort`).
3. Перевести в JSON-строку (кириллица остаётся литералом — `JSON_UNESCAPED_UNICODE`).
4. Экранировать `/` → `\/`.
5. HMAC-SHA256 от строки секретным ключом → hex.

`products` кодируется как JSON-массив (`[{...}]`), т.к. ключи 0..n-1.

> Демо-платежи Prodamus намеренно подписываются ключом с суффиксом и НЕ должны
> проходить боевую проверку — это by design, чтобы демо не принимались за реальные.

---

## 💰 Тарифы (боевые)

| Тариф | Цена | Месяцев |
|---|---|---|
| 1 месяц | 14 900 ₽ | 1 |
| 3 месяца | 35 900 ₽ | 3 |
| 6 месяцев | 59 900 ₽ | 6 (питание в подарок) |
| Докупка питания | 3 000 ₽ | — |

Цены заданы в `src/lib/services/payment.ts` (первичная) и
`src/lib/services/renewal.ts` (`RENEWAL_PRICES`, `NUTRITION_ADDON_PRICE`).

---

## 💳 Рассрочки (Яндекс Сплит, Долями)

**Подключены:** Яндекс Сплит (2/4/6/12/24 мес), Долями (3/6/12 мес)  
**Отключены:** СБЕР, ОТП Банк (комиссии 15–21% — дорого)

Рассрочки работают **глобально** — показываются на всех тарифах (1/3/6 мес).
Параметры `available_payment_methods` и `installments_disabled` **не работают**
через API Продамуса (только GET-ссылки с `do=pay`). Управление методами
оплаты — только через запросы в поддержку Продамуса (глобально для всего аккаунта).

**Комиссии:** Яндекс 2/4/6 мес (8,5–12%), Долями (12% на всех сроках), Яндекс
12/24 мес (17,5% — дорого, но отключить нельзя — Яндекс контролирует сам).

**Подробнее:** см. `docs/INSTALLMENTS_INFO.md` (таблица комиссий, расчёты по
тарифам, почему оставили рассрочки).

---

## 🗄️ База данных Supabase

### Таблица `payments` (без изменений структуры)
`payment_method` теперь допускает значение `'prodamus'`
(миграция `20260530_add_prodamus_payment_method.sql`).

```sql
CHECK (payment_method IN ('manual','stripe','yookassa','yoomoney','prodamus'))
```

---

## 🔧 Диагностика неполадок

### Webhook не срабатывает
1. Проверь health-check: `GET https://meta-system-ja1o.vercel.app/api/payments/prodamus-webhook`
   ```json
   {"status":"ok","config":{"hasSecret":true,"hasFormUrl":true,"hasServiceKey":true}}
   ```
2. Если `hasSecret: false` — добавь `PRODAMUS_SECRET_KEY` в Vercel.
3. Проверь Vercel Logs → фильтр `/api/payments/prodamus-webhook`.

### SIGNATURE MISMATCH в логах
- Неверный `PRODAMUS_SECRET_KEY` (не совпадает с ЛК Prodamus).
- Или прилетел демо-платёж (демо подписывается иначе — это норма).

### После оплаты не редиректит на /onboarding
1. Проверь таблицу `payments` — статус должен стать `confirmed`.
2. Если `pending` — webhook не пришёл или упал на подписи (см. логи).

### Поиск платежей в БД
```sql
SELECT p.id, p.user_id, p.amount, p.status, p.payment_method,
       p.created_at, p.confirmed_at, pr.email, pr.full_name
FROM payments p
LEFT JOIN profiles pr ON pr.id = p.user_id
ORDER BY p.created_at DESC LIMIT 20;
```

Ручное подтверждение:
```sql
UPDATE payments SET status = 'confirmed', confirmed_at = now()
WHERE id = 'PAYMENT_UUID';
```

---

## ⚙️ Настройки в ЛК Prodamus

1. **Каналы продаж** → платёжная страница в режиме «Активный» (не «Тестовый»),
   иначе подпись боевых платежей будет отличаться.
2. **Уведомления** (или вкладка «Интеграция») → «URL для уведомлений»:
   ```
   https://meta-system-ja1o.vercel.app/api/payments/prodamus-webhook
   ```
3. Секретный ключ из этой же вкладки → в `PRODAMUS_SECRET_KEY`.

---

## 🚀 Деплой чеклист

```bash
git add <файлы>
git commit -m "feat(payments): миграция на Prodamus"
git push origin main   # → Vercel автодеплой

# Vercel → Settings → Environment Variables:
#   NEXT_PUBLIC_PRODAMUS_FORM_URL, PRODAMUS_SECRET_KEY → Redeploy
# Supabase: применить миграцию 20260530_add_prodamus_payment_method.sql
```

---

*Последнее обновление: 2026-05-30 (миграция ЮMoney → Prodamus)*
