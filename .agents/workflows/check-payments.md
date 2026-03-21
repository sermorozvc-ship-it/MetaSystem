---
description: Проверка платёжного флоу ЮMoney — диагностика всех компонентов
---

## /check-payments — Диагностика платёжного флоу ЮMoney

Этот воркфлоу проверяет полный платёжный цикл: БД, webhook, переменные окружения и статусы платежей.

### Шаг 1: Проверить webhook endpoint доступен

Открой в браузере:
```
https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "config": {
    "hasSecret": true,
    "hasWallet": true,
    "hasServiceKey": true
  }
}
```

❌ Если `hasServiceKey: false` — добавь `SUPABASE_SERVICE_ROLE_KEY` в Vercel Environment Variables.  
❌ Если `hasSecret: false` — добавь `YOOMONEY_SECRET` в Vercel.

---

### Шаг 2: Проверить все платежи в БД через MCP

Попроси агента выполнить:
```
Проверь таблицу payments в Supabase проекте bzyypoyvihqhrbllgffh — покажи все записи с email и именем пользователя
```

// turbo
Агент использует mcp_supabase-mcp-server_execute_sql с запросом:
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

Ожидаемый результат должен включать `'yoomoney'` в списке допустимых значений.  
Если нет — выполни:
```sql
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('manual', 'stripe', 'yookassa', 'yoomoney'));
```

---

### Шаг 6: Проверить Vercel Logs

Открой:
```
https://vercel.com/dashboard → Проект → Logs
```

Фильтруй по `/api/payments/yoomoney-webhook`.

Успешный лог выглядит так:
```
[YooMoney Webhook] RAW BODY: notification_type=p2p-incoming&...
[YooMoney Webhook] ✓ Signature OK
[YooMoney Webhook] ✓ Payment CONFIRMED for user: UUID amount: 10.00
```

Признаки ошибок:
- `SIGNATURE MISMATCH` → неверный `YOOMONEY_SECRET`
- `DB update error` → проблема с RLS или constraint
- `No label` → платёж без user_id (оплата не через сайт)

---

### Шаг 7: Сверить настройки ЮMoney P2P

В личном кабинете ЮMoney → **Переводы и платежи → Настройки уведомлений**:

| Параметр | Значение |
|---|---|
| HTTP-уведомления | ✅ Включены |
| URL уведомлений | `https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook` |
| Секрет | Совпадает с `YOOMONEY_SECRET` в Vercel |

---

### Итоговый статус флоу

| Компонент | Проверка | OK? |
|---|---|---|
| Webhook endpoint | GET /api/payments/yoomoney-webhook | — |
| SUPABASE_SERVICE_ROLE_KEY | hasServiceKey в конфиге | — |
| YOOMONEY_SECRET | hasSecret в конфиге | — |
| payment_method constraint | содержит 'yoomoney' | — |
| Триггер профилей | handle_new_user на auth.users | — |
| URL в ЮMoney ЛК | совпадает с продакшн URL | — |

---

📖 Полная документация: [docs/PAYMENT_FLOW.md](../docs/PAYMENT_FLOW.md)
