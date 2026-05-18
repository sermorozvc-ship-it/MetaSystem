# 🚀 Инструкция по деплою MetaSystem v2

## ✅ Статус проверки
- ✅ TypeScript компиляция: OK
- ✅ Production build: OK
- ✅ Все маршруты собраны успешно

---

## 📋 Шаги для завершения настройки

### 1️⃣ Запустить миграции в Supabase

**Важно:** Миграции нужно выполнить вручную через Supabase Dashboard

#### Как выполнить:
1. Откройте: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh
2. Перейдите в **SQL Editor** (левое меню)
3. Нажмите **New Query**
4. Скопируйте содержимое файла `supabase/migrations/20260510_metasystem_v2_schema.sql`
5. Вставьте в редактор и нажмите **Run**
6. Повторите для файла `supabase/migrations/20260511_notifications.sql`

#### Проверка:
После выполнения миграций проверьте, что созданы таблицы:
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

Должно вернуть 5 таблиц.

---

### 2️⃣ Настроить переменные окружения на Vercel

#### Переменные для добавления:
```
NEXT_PUBLIC_SUPABASE_URL=https://bzyypoyvihqhrbllgffh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Nzk0ODMsImV4cCI6MjA4NTQ1NTQ4M30.a4WXfvBU98YbqUPxrxVdkG6U-MaUodsVxd53qhI1apM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA
YOOMONEY_WALLET=410014990008683
YOOMONEY_SECRET=STtr6NB+i52qaZAKS7PgLwA2
NEXT_PUBLIC_YOOMONEY_WALLET=410014990008683
NEXT_PUBLIC_APP_URL=https://meta-system-ja1o.vercel.app
```

#### Как добавить:
1. Откройте проект на Vercel: https://vercel.com/dashboard
2. Выберите проект MetaSystem
3. Settings → Environment Variables
4. Добавьте каждую переменную
5. Выберите окружения: Production, Preview, Development

---

### 3️⃣ Протестировать локально

#### Запуск:
```bash
npm run dev
```

#### Чеклист тестирования:
См. файл `docs/manual_testing_checklist.md`

**Минимальная проверка:**
- [ ] Авторизация работает
- [ ] Страница оплаты отображается корректно
- [ ] Анкета открывается
- [ ] Дашборд загружается
- [ ] Админ-панель доступна

---

### 4️⃣ Задеплоить на Vercel

#### Вариант А: Через GitHub (рекомендуется)

```bash
# 1. Проверить статус
git status

# 2. Добавить все файлы
git add .

# 3. Коммит
git commit -m "feat: MetaSystem v2 - готово к продакшену"

# 4. Добавить remote (если еще не добавлен)
git remote add origin https://github.com/dgmuk/MetaSystem.git

# 5. Push
git push -u origin main
```

Если remote уже существует:
```bash
git push origin main
```

Если нужно форсировать:
```bash
git push -f origin main
```

#### Вариант Б: Через Vercel CLI

```bash
# Установить CLI
npm i -g vercel

# Деплой
vercel --prod
```

---

### 5️⃣ Настроить вебхук ЮMoney

**После деплоя на Vercel:**

1. Войдите в ЮMoney: https://yoomoney.ru
2. Настройки → Уведомления → HTTP-уведомления
3. Добавьте новое уведомление:
   - **URL:** `https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook`
   - **Секрет:** `STtr6NB+i52qaZAKS7PgLwA2`
   - **События:** Успешный платеж
4. Сохраните

#### Проверка вебхука:
Сделайте тестовый платеж (минимальная сумма) и проверьте:
- Статус платежа обновился в таблице `payments`
- Подписка активировалась в `profiles`
- Создано уведомление в `notifications`

---

### 6️⃣ Создать тестовые аккаунты

#### Админ:
```
Email: admin@metasystem.ru
Пароль: AdminPass123!
```

После регистрации обновите роль в БД:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@metasystem.ru';
```

#### Тестовый клиент:
```
Email: test-client@example.com
Пароль: TestClient123!
```

---

## 🧪 Финальное тестирование

### E2E сценарий:
1. Регистрация клиента
2. Оплата тарифа (1 месяц + питание)
3. Заполнение анкеты
4. Вход в дашборд
5. Админ загружает программу
6. Клиент заполняет тренировку
7. Клиент добавляет метрики
8. Проверка графиков
9. Обмен сообщениями в чате

### Проверка Realtime:
1. Откройте админ-панель в одной вкладке
2. Откройте клиентский дашборд в другой
3. Отправьте сообщение от админа
4. Проверьте, что уведомление пришло клиенту мгновенно

---

## 📊 Мониторинг после деплоя

### Vercel:
- Логи: https://vercel.com/dashboard → Deployments → Logs
- Аналитика: https://vercel.com/dashboard → Analytics

### Supabase:
- Логи: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh/logs
- Database: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh/editor

### ЮMoney:
- История платежей: https://yoomoney.ru/transfers

---

## 🐛 Troubleshooting

### Проблема: "Cannot find module"
**Решение:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Проблема: Build fails на Vercel
**Решение:**
1. Проверьте переменные окружения
2. Проверьте логи сборки
3. Убедитесь, что Node.js версия 20.x

### Проблема: RLS блокирует запросы
**Решение:**
Проверьте политики RLS в Supabase Dashboard → Authentication → Policies

### Проблема: Вебхук не работает
**Решение:**
1. Проверьте URL вебхука (должен быть HTTPS)
2. Проверьте секрет
3. Проверьте логи в Vercel Functions

---

## ✅ Чеклист готовности к продакшену

- [ ] Миграции выполнены в Supabase
- [ ] Переменные окружения настроены на Vercel
- [ ] Локальное тестирование пройдено
- [ ] Код запушен на GitHub
- [ ] Проект задеплоен на Vercel
- [ ] Вебхук ЮMoney настроен и протестирован
- [ ] Создан админ-аккаунт
- [ ] Создан тестовый клиент
- [ ] Загружена тестовая программа
- [ ] Realtime работает
- [ ] Мобильная версия протестирована

---

## 🎉 Готово!

После выполнения всех шагов платформа будет полностью готова к использованию.

**Production URL:** https://meta-system-ja1o.vercel.app

**Дата:** 2026-05-11  
**Версия:** v2.0.0
