---
description: Проверка платёжного флоу Prodamus — диагностика всех компонентов
---

## /check-payments — Диагностика платёжного флоу Prodamus

Этот воркфлоу проверяет полный платёжный цикл: БД, webhook, переменные окружения и статусы платежей.

### Шаг 1: Проверить webhook endpoint доступен

Открой в браузере (health-check):
```
https://meta-system-ja1o.vercel.app/api/payments/prodamus-webhook
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "service": "prodamus-webhook",
  "config": {
    "hasSecret": true,
    "hasFormUrl": true,
    "hasServiceKey": true
  }
}
```

❌ Если `hasSecret: false` — добавь `PRODAMUS_SECRET_KEY` в Vercel Environment Variables.
❌ Если `hasFormUrl: false` — добавь `NEXT_PUBLIC_PRODAMUS_FORM_URL` в Vercel.
❌ Если `hasServiceKey: false` — добавь `SUPABASE_SERVICE_ROLE_KEY` в Vercel.

---

### Шаг 2: Проверить все платежи в БД через MCP

Попроси агента выполнить:
```
Проверь таблицу payments в Supabase проекте bzyypoyvihqhrbllgffh — покажи все записи с email и именем пользователя
```

// turbo
Агент использует mcp_supabase_execute_sql с запросом:
```sql
SELECT p.id, p.user_id, p.amount, p.status, p.payment_method,
       p.created_at, p.confirmed_at,
       pr.email, pr.full_name
FROM payments p
LEFT JOIN profiles pr ON pr.id = p.user_id
ORDER BY p.created_at DESC
LIMIT 20;
```

---

### Шаг 3: Найти пользователей без профиля (причина "Без имени")

```sql
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

Если есть записи — создать профили:
```sql
INSERT INTO public.profiles (id, email, full_name, role, is_blocked)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       'user', false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

### Шаг 4: Проверить pending платежи (застрявшие)

```sql
-- Платежи в pending более 30 минут — возможно webhook не пришёл
SELECT p.id, p.user_id, p.amount, p.created_at,
       pr.email, pr.full_name
FROM payments p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.status = 'pending'
  AND p.created_at < now() - interval '30 minutes'
ORDER BY p.created_at DESC;
```

Ручное подтверждение если оплата прошла:
```sql
UPDATE payments
SET status = 'confirmed', confirmed_at = now()
WHERE id = 'PAYMENT_UUID_HERE';
```

---

### Шаг 5: Проверить constraint на payment_method

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.payments'::regclass
  AND contype = 'c';
```

Ожидаемый результат должен включать `'prodamus'` в списке допустимых значений.
Если нет — выполни:
```sql
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('manual', 'stripe', 'yookassa', 'yoomoney', 'prodamus'));
```

---

### Шаг 6: Проверить Vercel Logs

Открой:
```
https://vercel.com/dashboard → Проект → Logs
```

Фильтруй по `/api/payments/prodamus-webhook`.

Успешный лог выглядит так:
```
[Prodamus Webhook] RAW BODY: order_id=init_...&payment_status=success&...
[Prodamus Webhook] Parsed: { orderId: 'init_...', paymentStatus: 'success', sum: '14900.00' }
[Prodamus Webhook] ✓ Subscription activated for user: UUID
```

Признаки ошибок:
- `SIGNATURE MISMATCH` → неверный `PRODAMUS_SECRET_KEY` (или демо-платёж — он
  подписывается иначе и законно не проходит боевую проверку)
- `PRODAMUS_SECRET_KEY not set` → не задана переменная окружения
- `Cannot parse order_id` → платёж не через сайт (нет нашего order_id)

---

### Шаг 7: Сверить настройки Prodamus ЛК

В личном кабинете Prodamus → платёжная страница → раздел «Уведомления» / «Интеграция»:

| Параметр | Значение |
|---|---|
| Режим канала | ✅ Активный (не «Тестовый» для боевых платежей) |
| URL для уведомлений | `https://meta-system-ja1o.vercel.app/api/payments/prodamus-webhook` |
| Секретный ключ | Совпадает с `PRODAMUS_SECRET_KEY` в Vercel |

---

### Итоговый статус флоу

| Компонент | Проверка | OK? |
|---|---|---|
| Webhook endpoint | GET /api/payments/prodamus-webhook | — |
| PRODAMUS_SECRET_KEY | hasSecret в конфиге | — |
| NEXT_PUBLIC_PRODAMUS_FORM_URL | hasFormUrl в конфиге | — |
| SUPABASE_SERVICE_ROLE_KEY | hasServiceKey в конфиге | — |
| payment_method constraint | содержит 'prodamus' | — |
| Триггер профилей | handle_new_user на auth.users | — |
| URL в Prodamus ЛК | совпадает с продакшн URL | — |

---

📖 Полная документация: [docs/PAYMENT_FLOW.md](../docs/PAYMENT_FLOW.md)
