# Применение миграций в Supabase

## Быстрая инструкция

### Шаг 1: Откройте SQL Editor
1. Перейдите: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh/sql
2. Нажмите **New Query**

### Шаг 2: Выполните миграции по порядку

#### Миграция 1: Основная схема v2
1. Откройте файл: `migrations/20260510_metasystem_v2_schema.sql`
2. Скопируйте **весь** код
3. Вставьте в SQL Editor
4. Нажмите **Run** (или Ctrl+Enter)
5. Дождитесь сообщения "Success"

#### Миграция 2: Уведомления
1. Откройте файл: `migrations/20260511_notifications.sql`
2. Скопируйте **весь** код
3. Вставьте в SQL Editor
4. Нажмите **Run**
5. Дождитесь сообщения "Success"

### Шаг 3: Проверка

Выполните проверочный запрос:

```sql
-- Проверка созданных таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'profiles',
  'payments',
  'client_questionnaires',
  'training_programs', 
  'training_entries',
  'client_metrics',
  'notifications'
)
ORDER BY table_name;
```

**Ожидаемый результат:** 7 таблиц

### Шаг 4: Проверка RLS политик

```sql
-- Проверка политик Row Level Security
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Ожидаемый результат:** Должны быть политики для всех таблиц

---

## Что делают миграции?

### Миграция 1 (20260510_metasystem_v2_schema.sql):
- ✅ Обновляет таблицу `profiles` (добавляет роли, подписки)
- ✅ Обновляет таблицу `payments` (добавляет тарифы)
- ✅ Создает таблицу `client_questionnaires` (анкеты)
- ✅ Создает таблицу `training_programs` (программы)
- ✅ Создает таблицу `training_entries` (заполненные тренировки)
- ✅ Создает таблицу `client_metrics` (метрики и замеры)
- ✅ Настраивает RLS политики для всех таблиц
- ✅ Создает индексы для оптимизации
- ✅ Добавляет триггеры для updated_at
- ✅ Создает функцию проверки истечения подписок

### Миграция 2 (20260511_notifications.sql):
- ✅ Создает таблицу `notifications` (уведомления)
- ✅ Настраивает RLS политики
- ✅ Создает индексы

---

## Откат миграций (если нужно)

### Удаление таблиц v2:
```sql
-- ВНИМАНИЕ: Это удалит все данные!
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS client_metrics CASCADE;
DROP TABLE IF EXISTS training_entries CASCADE;
DROP TABLE IF EXISTS training_programs CASCADE;
DROP TABLE IF EXISTS client_questionnaires CASCADE;

-- Откат изменений в profiles
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS telegram,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS questionnaire_completed,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_end_date,
  DROP COLUMN IF EXISTS has_nutrition_plan;

-- Откат изменений в payments
ALTER TABLE payments
  DROP COLUMN IF EXISTS plan_type,
  DROP COLUMN IF EXISTS plan_months,
  DROP COLUMN IF EXISTS includes_nutrition,
  DROP COLUMN IF EXISTS base_amount,
  DROP COLUMN IF EXISTS nutrition_amount;
```

---

## Частые проблемы

### Ошибка: "relation already exists"
**Причина:** Таблица уже создана  
**Решение:** Миграция уже применена, пропустите этот шаг

### Ошибка: "permission denied"
**Причина:** Недостаточно прав  
**Решение:** Убедитесь, что вы владелец проекта в Supabase

### Ошибка: "syntax error"
**Причина:** Неполный код миграции  
**Решение:** Убедитесь, что скопировали **весь** файл миграции

---

## После применения миграций

1. ✅ Переменные окружения настроены
2. ✅ Миграции применены
3. ➡️ Следующий шаг: Деплой на Vercel (см. DEPLOY_INSTRUCTIONS.md)

---

**Дата:** 2026-05-11  
**Версия:** v2.0.0
