# Инструкция по применению миграции продления тарифов

## Файл миграции
`supabase/migrations/20260513_subscription_renewals.sql`

## Как применить

### Вариант 1: Через Supabase Dashboard
1. Открой https://supabase.com/dashboard
2. Выбери проект MetaSystem
3. Перейди в **SQL Editor**
4. Скопируй содержимое файла `supabase/migrations/20260513_subscription_renewals.sql`
5. Выполни запрос

### Вариант 2: Через Supabase CLI
```bash
supabase db push
```

## Что создаёт миграция

1. **Таблица `subscription_renewals`** — история всех продлений и изменений тарифов
2. **Поле `profiles.nutrition_questionnaire_completed`** — флаг заполненности анкеты питания
3. **Поле `profiles.renewal_pending`** — флаг ожидающего продления
4. **Поле `payments.renewal_type`** — тип платежа (initial/renewal/nutrition_upgrade)
5. **Функция `apply_subscription_renewal()`** — применяет продление (для использования в будущем)
6. **Функция `apply_nutrition_upgrade()`** — применяет докупку питания

## RLS политики
Все политики настроены: клиент видит только свои записи, админ — все.
