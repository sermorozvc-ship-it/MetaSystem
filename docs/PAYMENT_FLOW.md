# 💳 PAYMENT FLOW — Документация и отладка

> Этот файл описывает полную конфигурацию платёжной системы ЮMoney P2P.
> При любых сбоях используй этот документ как чеклист.

---

## 📊 Общая схема флоу

```
Регистрация (/auth)
    ↓ автоматический вход (email confirmation ОТКЛЮЧЁН)
Страница оплаты (/payment)
    ↓ нажимает "Оплатить 10 ₽"
ЮMoney QuickPay (внешняя страница)
    ↓ пользователь оплачивает
ЮMoney → HTTP Notification (webhook) → /api/payments/yoomoney-webhook
    ↓ webhook верифицирует SHA1, обновляет payments.status = 'confirmed'
Страница оплаты автополлинг (каждые 3 сек) → обнаруживает 'confirmed'
    ↓ window.location.href = '/onboarding'
Онбординг (/onboarding)
    ↓ нажимает "Перейти в зал ожидания"
Зал ожидания (/waiting-room) — таймер до старта когорты в понедельник 07:00
    ↓ автоматически при наступлении времени
Dashboard (/dashboard) — основной курс
```

---

## ⚙️ Переменные окружения

### `.env.local` (локально)
```env
NEXT_PUBLIC_SUPABASE_URL=https://bzyypoyvihqhrbllgffh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Для webhook — обходит RLS

YOOMONEY_WALLET=410014990008683    # Номер кошелька получателя
YOOMONEY_SECRET=STtr6NB+i52qaZAKS7PgLwA2   # Секрет для SHA1
NEXT_PUBLIC_YOOMONEY_WALLET=410014990008683
NEXT_PUBLIC_APP_URL=https://meta-system-ja1o.vercel.app
```

### Vercel Environment Variables (продакшн)
Все те же переменные должны быть в:
**Vercel Dashboard → Project → Settings → Environment Variables**

> ⚠️ После изменения переменных на Vercel — сделайте Redeploy!

---

## 🏗️ Файлы платёжной системы

| Файл | Назначение |
|---|---|
| `src/app/payment/page.tsx` | Страница оплаты — UI + polling |
| `src/app/api/payments/yoomoney-webhook/route.ts` | Webhook от ЮMoney |
| `src/lib/services/payment.ts` | Функции работы с payments таблицей |
| `src/app/onboarding/page.tsx` | После оплаты — расписание курса |
| `src/app/waiting-room/page.tsx` | Зал ожидания с таймером |

---

## 🗄️ База данных Supabase

### Проект
- **ID:** `bzyypoyvihqhrbllgffh`
- **Регион:** eu-central-1

### Таблица `payments`
```sql
id            UUID PRIMARY KEY
user_id       UUID → auth.users
amount        DECIMAL(10,2) DEFAULT 10.00
currency      TEXT DEFAULT 'RUB'
status        TEXT CHECK IN ('pending', 'confirmed', 'refunded')
payment_method TEXT CHECK IN ('manual', 'stripe', 'yookassa', 'yoomoney')
confirmed_by  UUID → auth.users (NULL для webhook-подтверждений)
confirmed_at  TIMESTAMPTZ
cohort_start  DATE
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

### RLS политики
```sql
-- Пользователь видит только свои платежи
"Users can view own payments" → SELECT WHERE auth.uid() = user_id

-- Пользователь создаёт pending запрос
"Users can create payment requests" → INSERT WHERE status = 'pending'

-- Админ управляет всеми
"Admins can manage all payments" → ALL WHERE role = 'admin'
```

### Триггеры
```sql
-- Автосоздание профиля при регистрации (критично!)
handle_new_user() → AFTER INSERT ON auth.users
```

---

## 🔗 ЮMoney настройки

### QuickPay URL
```
https://yoomoney.ru/quickpay/confirm?receiver=WALLET&quickpay-form=button
  &paymentType=AC&sum=AMOUNT&label=USER_ID&successURL=APP_URL/onboarding
```

Параметр **`label=USER_ID`** — это ключ связки webhook → пользователь!

### HTTP Notification (webhook)
- **URL в настройках ЮMoney:** `https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook`
- **Метод:** POST, `application/x-www-form-urlencoded`
- **Секрет:** `YOOMONEY_SECRET` (совпадает с настройкой в ЛК ЮMoney)

### Верификация SHA1
```
hash = SHA1(notification_type & operation_id & amount & currency 
            & datetime & sender & codepro & secret & label)
```

---

## 🔧 Диагностика неполадок

### Webhook не срабатывает
1. Проверь **Vercel Logs** → найди `/api/payments/yoomoney-webhook`
2. Зайди по URL вручную — должно вернуть:
   ```json
   {"status":"ok","config":{"hasSecret":true,"hasWallet":true,"hasServiceKey":true}}
   ```
3. Если `hasServiceKey: false` — добавь `SUPABASE_SERVICE_ROLE_KEY` в Vercel

### После оплаты не редиректит на /onboarding
1. Проверь таблицу `payments` в Supabase — статус должен быть `confirmed`
2. Если `pending` — webhook не пришёл или упал
3. Если запись `yoomoney` не появилась — проверь constraint:
   ```sql
   -- Должен включать 'yoomoney'
   SELECT constraint_name FROM information_schema.table_constraints 
   WHERE table_name = 'payments';
   ```

### Пользователь платит но не в БД
Запрос для поиска:
```sql
-- Все payments с профилями
SELECT p.id, p.user_id, p.amount, p.status, p.payment_method, 
       pr.email, pr.full_name
FROM payments p
LEFT JOIN profiles pr ON pr.id = p.user_id
ORDER BY p.created_at DESC;
```

Ручное подтверждение:
```sql
UPDATE payments SET status = 'confirmed', confirmed_at = now()
WHERE user_id = 'USER_UUID';
```

### Профиль пользователя не создался (показывает "Без имени")
```sql
-- Создать пропущенные профили
INSERT INTO profiles (id, email, full_name, role, is_blocked)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''),
       'user', false
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

### email rate limit exceeded при регистрации
- **Причина:** Supabase лимитирует 3-4 email/час на бесплатном плане
- **Решение:** Supabase Dashboard → Authentication → Providers → Email → **отключить "Confirm email"**

---

## 🔒 Supabase Auth настройки

| Настройка | Значение |
|---|---|
| Email Confirm | ❌ ОТКЛЮЧЕНО |
| Password min length | 6 символов |
| Site URL | https://meta-system-ja1o.vercel.app |

---

## 🚀 Деплой чеклист

```bash
# 1. Изменения кода
git add .
git commit -m "описание"
git push   # → Vercel автодеплой за ~1-2 мин

# 2. Проверить переменные на Vercel
# Dashboard → Settings → Environment Variables

# 3. SQL миграции — выполнить в Supabase SQL Editor
# или через MCP: mcp_supabase-mcp-server_apply_migration
```

---

## 📱 Тестовый флоу (end-to-end)

1. Открыть `https://meta-system-ja1o.vercel.app` в режиме инкогнито
2. Нажать «Начать» → попасть на `/auth`
3. Зарегистрироваться → должен появиться экран «Аккаунт создан!» + redirect на `/payment`
4. Нажать «Оплатить 10 ₽» → откроется ЮMoney в новом окне
5. Оплатить → через 3-10 сек автоматически перейти на `/onboarding`
6. Нажать «Перейти в зал ожидания» → `/waiting-room` с таймером
7. Проверить в Supabase: `payments` → статус `confirmed`, `profiles` → запись создана

---

*Последнее обновление: 2026-03-21*
