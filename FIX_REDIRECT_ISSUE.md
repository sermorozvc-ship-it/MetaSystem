# Исправление проблемы с редиректом на анкету

## Проблема
Пользователь застревает в цикле редиректов на страницу `/questionnaire`, даже если анкета уже заполнена.

## Что было исправлено

### 1. Улучшена проверка заполненности анкеты
**Файл:** `src/lib/services/questionnaire.ts`

Функция `isQuestionnaireCompleted()` теперь:
- Проверяет наличие записи в таблице `client_questionnaires` (более надежно)
- Автоматически обновляет флаг `questionnaire_completed` в профиле
- Добавлено логирование для отладки

### 2. Исправлена логика редиректов
**Файлы:** 
- `src/app/payment/page.tsx`
- `src/app/page.tsx`
- `src/app/questionnaire/page.tsx`

Теперь правильная последовательность:
1. Авторизация → проверка оплаты
2. Оплата подтверждена → проверка анкеты
3. Анкета не заполнена → `/questionnaire`
4. Анкета заполнена → `/onboarding`
5. Когорта началась → `/dashboard`

## Как проверить, что проблема решена

### Шаг 1: Проверьте консоль браузера
Откройте DevTools (F12) и посмотрите логи:
```
[Questionnaire] Checking for user: <user_id>
[Questionnaire] Query result: { questionnaire: {...}, error: null }
[Payment] Questionnaire completed: true
[Payment] Redirecting to onboarding
```

### Шаг 2: Проверьте базу данных
Выполните SQL запрос в Supabase:
```sql
SELECT 
  p.id,
  p.email,
  p.questionnaire_completed,
  CASE WHEN q.id IS NOT NULL THEN 'Да' ELSE 'Нет' END as has_questionnaire
FROM profiles p
LEFT JOIN client_questionnaires q ON q.user_id = p.id
WHERE p.email = 'ваш@email.com';
```

### Шаг 3: Исправьте флаг вручную (если нужно)
Если в базе данных есть анкета, но флаг `questionnaire_completed = false`, выполните:
```sql
-- Используйте скрипт fix_questionnaire_flag.sql
-- Или выполните вручную:
UPDATE profiles
SET questionnaire_completed = true
WHERE id = 'ваш_user_id';
```

## Тестирование

### Сценарий 1: Новый пользователь
1. Регистрация → `/auth`
2. После регистрации → `/payment`
3. После оплаты → `/questionnaire`
4. После заполнения анкеты → `/onboarding`

### Сценарий 2: Пользователь с заполненной анкетой
1. Вход → `/auth`
2. После входа → `/onboarding` (минуя `/questionnaire`)

### Сценарий 3: Пользователь с активной когортой
1. Вход → `/auth`
2. После входа → `/dashboard` (минуя все промежуточные страницы)

## Если проблема не решена

1. **Очистите кеш браузера:**
   - Ctrl+Shift+Delete
   - Очистите cookies и кеш
   - Перезагрузите страницу

2. **Проверьте localStorage:**
   - Откройте DevTools → Application → Local Storage
   - Удалите все ключи, начинающиеся с `sb-`

3. **Проверьте базу данных:**
   - Убедитесь, что запись в `client_questionnaires` существует
   - Убедитесь, что `profiles.questionnaire_completed = true`

4. **Проверьте логи:**
   - Откройте консоль браузера (F12)
   - Посмотрите на логи с префиксом `[Questionnaire]`, `[Payment]`, `[Landing]`
   - Отправьте скриншот логов для дальнейшей диагностики

## Дополнительная информация

### Структура редиректов
```
/ (landing)
  ├─ Не авторизован → /auth
  └─ Авторизован
      ├─ Нет оплаты → /payment
      └─ Есть оплата
          ├─ Нет анкеты → /questionnaire
          └─ Есть анкета
              ├─ Когорта не началась → /onboarding
              └─ Когорта началась → /dashboard
```

### Важные файлы
- `src/lib/services/questionnaire.ts` - логика проверки анкеты
- `src/app/payment/page.tsx` - страница оплаты с редиректами
- `src/app/page.tsx` - главная страница с проверкой статуса
- `src/app/questionnaire/page.tsx` - страница анкеты
- `supabase/fix_questionnaire_flag.sql` - скрипт для исправления флага
