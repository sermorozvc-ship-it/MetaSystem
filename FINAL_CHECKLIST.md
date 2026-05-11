# ✅ Финальный чеклист настройки MetaSystem v2

## Статус выполнения

### ✅ Завершено автоматически:
- ✅ TypeScript компиляция проверена
- ✅ Production build успешно собран
- ✅ Все файлы добавлены в git
- ✅ Коммит создан
- ✅ Код запушен на GitHub: https://github.com/dgmuk/MetaSystem

### 📋 Требуется ручное выполнение:

---

## 1️⃣ Применить миграции в Supabase (5 минут)

### Инструкция:
1. Откройте: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh/sql
2. Нажмите **New Query**
3. Откройте файл `supabase/migrations/20260510_metasystem_v2_schema.sql`
4. Скопируйте **весь** код и вставьте в SQL Editor
5. Нажмите **Run** (Ctrl+Enter)
6. Дождитесь "Success"
7. Повторите для файла `supabase/migrations/20260511_notifications.sql`

### Проверка:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'client_questionnaires',
  'training_programs', 
  'training_entries',
  'client_metrics',
  'notifications'
)
ORDER BY table_name;
```
**Ожидается:** 5 таблиц

**Статус:** [ ] Выполнено

---

## 2️⃣ Настроить переменные окружения на Vercel (3 минуты)

### Если проект уже существует на Vercel:
1. Откройте: https://vercel.com/dashboard
2. Выберите проект MetaSystem (или meta-system-ja1o)
3. Settings → Environment Variables
4. Проверьте/добавьте переменные:

```
NEXT_PUBLIC_SUPABASE_URL=https://bzyypoyvihqhrbllgffh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Nzk0ODMsImV4cCI6MjA4NTQ1NTQ4M30.a4WXfvBU98YbqUPxrxVdkG6U-MaUodsVxd53qhI1apM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA
YOOMONEY_WALLET=410014990008683
YOOMONEY_SECRET=STtr6NB+i52qaZAKS7PgLwA2
NEXT_PUBLIC_YOOMONEY_WALLET=410014990008683
NEXT_PUBLIC_APP_URL=https://meta-system-ja1o.vercel.app
```

5. Выберите окружения: **Production**, **Preview**, **Development**
6. Сохраните

### Если проект НЕ существует на Vercel:
1. Откройте: https://vercel.com/new
2. Import Git Repository → выберите `dgmuk/MetaSystem`
3. Configure Project:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Добавьте все переменные окружения (см. выше)
5. Нажмите **Deploy**

**Статус:** [ ] Выполнено

---

## 3️⃣ Дождаться деплоя на Vercel (2-3 минуты)

После push на GitHub, Vercel автоматически начнет деплой (если проект подключен).

### Проверка:
1. Откройте: https://vercel.com/dashboard
2. Найдите проект MetaSystem
3. Проверьте статус последнего деплоя
4. Дождитесь статуса **Ready**

### Если деплой не начался автоматически:
1. Deployments → New Deployment
2. Выберите ветку `main`
3. Deploy

**Production URL:** https://meta-system-ja1o.vercel.app

**Статус:** [ ] Выполнено

---

## 4️⃣ Создать админ-аккаунт (2 минуты)

### Шаг 1: Регистрация
1. Откройте: https://meta-system-ja1o.vercel.app/auth
2. Зарегистрируйтесь:
   - Email: `admin@metasystem.ru`
   - Пароль: `AdminPass123!`
3. Подтвердите email (если требуется)

### Шаг 2: Назначение роли админа
1. Откройте Supabase SQL Editor: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh/sql
2. Выполните запрос:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@metasystem.ru';
```

### Проверка:
1. Обновите страницу
2. В навигации должна появиться кнопка **Админ-панель**

**Статус:** [ ] Выполнено

---

## 5️⃣ Создать тестового клиента (3 минуты)

### Вариант А: Через регистрацию и оплату
1. Откройте: https://meta-system-ja1o.vercel.app
2. Зарегистрируйтесь как новый пользователь
3. Выберите тариф (1 месяц)
4. Оплатите через ЮMoney
5. Заполните анкету

### Вариант Б: Создать вручную в БД (для тестирования)
1. Зарегистрируйтесь: `test-client@example.com` / `TestClient123!`
2. В Supabase SQL Editor выполните:

```sql
-- Активировать подписку
UPDATE profiles 
SET 
  subscription_status = 'active',
  subscription_end_date = CURRENT_DATE + INTERVAL '30 days',
  has_nutrition_plan = true,
  questionnaire_completed = true
WHERE email = 'test-client@example.com';

-- Создать запись оплаты
INSERT INTO payments (user_id, amount, status, plan_type, plan_months, includes_nutrition)
SELECT 
  id, 
  17900, 
  'completed', 
  '1_month', 
  1, 
  true
FROM profiles 
WHERE email = 'test-client@example.com';
```

**Статус:** [ ] Выполнено

---

## 6️⃣ Загрузить тестовую программу (2 минуты)

### Инструкция:
1. Войдите как админ: https://meta-system-ja1o.vercel.app/admin
2. Выберите тестового клиента
3. Перейдите на вкладку **Программы**
4. Нажмите **Загрузить программу**
5. Скопируйте содержимое файла `docs/test_program_example.md`
6. Вставьте в поле Markdown
7. Укажите:
   - Номер недели: **1**
   - Дата начала: **текущая дата**
   - Дата окончания: **+7 дней**
   - Количество дней: **4**
8. Нажмите **Загрузить**

### Проверка:
1. Войдите как клиент
2. Перейдите в **Программы**
3. Должна отображаться "Неделя 1"

**Статус:** [ ] Выполнено

---

## 7️⃣ Протестировать основной функционал (10 минут)

### Тест 1: Заполнение тренировки
- [ ] Откройте программу недели
- [ ] Заполните упражнения (веса, подходы)
- [ ] Проверьте автосохранение (должно появиться "✓ Сохранено")
- [ ] Завершите тренировку

### Тест 2: Добавление метрик
- [ ] Перейдите в **Метрики**
- [ ] Нажмите **Добавить замер**
- [ ] Заполните данные (вес, объемы)
- [ ] Сохраните
- [ ] Проверьте, что график обновился

### Тест 3: Чат
- [ ] Откройте **Сообщения**
- [ ] Отправьте сообщение от клиента
- [ ] Войдите как админ в другой вкладке
- [ ] Проверьте, что сообщение отображается
- [ ] Ответьте от админа
- [ ] Проверьте Realtime-обновление

### Тест 4: Уведомления
- [ ] Проверьте колокольчик уведомлений
- [ ] Должны быть уведомления о загруженной программе
- [ ] Отметьте как прочитанное

### Тест 5: Мобильная версия
- [ ] Откройте сайт на телефоне (или DevTools → Mobile)
- [ ] Проверьте навигацию
- [ ] Проверьте заполнение тренировки
- [ ] Проверьте графики

**Статус:** [ ] Выполнено

---

## 8️⃣ Настроить вебхук ЮMoney (5 минут)

### Инструкция:
1. Войдите в ЮMoney: https://yoomoney.ru
2. Настройки → Уведомления → HTTP-уведомления
3. Добавьте новое уведомление:
   - **URL:** `https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook`
   - **Секрет:** `STtr6NB+i52qaZAKS7PgLwA2`
   - **События:** ✅ Успешный платеж
4. Сохраните

### Проверка вебхука:
1. Сделайте тестовый платеж (минимальная сумма)
2. Проверьте в Supabase, что:
   - Статус платежа обновился на `completed`
   - Подписка активировалась
   - Создано уведомление

**Статус:** [ ] Выполнено

---

## 9️⃣ Финальная проверка (5 минут)

### Чеклист:
- [ ] Сайт открывается: https://meta-system-ja1o.vercel.app
- [ ] Регистрация работает
- [ ] Авторизация работает
- [ ] Страница оплаты отображается корректно
- [ ] Анкета работает
- [ ] Дашборд загружается
- [ ] Программы отображаются
- [ ] Заполнение тренировок работает
- [ ] Метрики и графики работают
- [ ] Чат работает
- [ ] Админ-панель доступна
- [ ] Realtime работает
- [ ] Уведомления приходят
- [ ] Мобильная версия работает

---

## 🎉 Готово!

После выполнения всех шагов платформа **MetaSystem v2** полностью готова к использованию!

### Полезные ссылки:
- **Production:** https://meta-system-ja1o.vercel.app
- **GitHub:** https://github.com/dgmuk/MetaSystem
- **Supabase:** https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh
- **Vercel:** https://vercel.com/dashboard
- **ЮMoney:** https://yoomoney.ru

### Документация:
- `README.md` — Общее описание проекта
- `DEPLOY_INSTRUCTIONS.md` — Подробная инструкция по деплою
- `docs/manual_testing_checklist.md` — Чеклист тестирования
- `docs/e2e_test_scenarios.md` — E2E сценарии
- `docs/implementation_plan.md` — План реализации
- `supabase/APPLY_MIGRATIONS.md` — Инструкция по миграциям

---

**Дата:** 2026-05-11  
**Версия:** v2.0.0  
**Статус:** Готово к продакшену ✅
