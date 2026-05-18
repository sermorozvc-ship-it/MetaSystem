# Руководство по деплою MetaSystem v2

## Шаг 1: Миграции Supabase ✅

### Инструкция:
1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект: `bzyypoyvihqhrbllgffh`
3. Перейдите в **SQL Editor**
4. Выполните миграции по порядку:

#### Миграция 1: Основная схема v2
Файл: `supabase/migrations/20260510_metasystem_v2_schema.sql`

```sql
-- Скопируйте содержимое файла и выполните в SQL Editor
```

#### Миграция 2: Уведомления
Файл: `supabase/migrations/20260511_notifications.sql`

```sql
-- Скопируйте содержимое файла и выполните в SQL Editor
```

### Проверка миграций:
После выполнения проверьте, что созданы таблицы:
- `client_questionnaires`
- `training_programs`
- `training_entries`
- `client_metrics`
- `notifications`

Команда для проверки:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

## Шаг 2: Переменные окружения ✅

### Локальные переменные (.env.local) — уже настроены:
```env
NEXT_PUBLIC_SUPABASE_URL=https://bzyypoyvihqhrbllgffh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key из Supabase Dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role key из Supabase Dashboard>
YOOMONEY_WALLET=410014990008683
YOOMONEY_SECRET=<секрет из настроек ЮMoney>
NEXT_PUBLIC_YOOMONEY_WALLET=410014990008683
NEXT_PUBLIC_APP_URL=https://meta-system-ja1o.vercel.app
```

Актуальные значения — в `.env.local` (не коммитится в git).

### Для Vercel:
1. Откройте проект: https://vercel.com/dashboard → Settings → Environment Variables
2. Добавьте все переменные из `.env.local`
3. Выберите окружения: **Production**, **Preview**, **Development**
4. После добавления — **Redeploy**

### Настройки проекта Vercel:
```
Framework Preset: Next.js
Build Command:    npm run build
Output Directory: .next
Node.js Version:  20.x
```

---

## Шаг 3: Тестирование по чеклисту

См. файл: `docs/manual_testing_checklist.md`

### Быстрая проверка:
```bash
# Запуск локально
npm run dev

# Проверка сборки
npm run build
npm run start

# Проверка типов
npx tsc --noEmit

# Линтер
npm run lint
```

### Тестовые аккаунты:
- **Клиент:** test-client@example.com / TestClient123!
- **Админ:** admin@metasystem.ru / AdminPass123!

---

## Шаг 4: Деплой на Vercel

### Через GitHub (рекомендуется):
1. Запушить код на GitHub
2. Подключить репозиторий к Vercel
3. Vercel автоматически задеплоит

### Через CLI:
```bash
# Установить Vercel CLI
npm i -g vercel

# Деплой
vercel --prod
```

---

## Локальная разработка

```bash
npm run dev          # Dev-сервер (http://localhost:3001)
npm run build        # Production-сборка
npm run start        # Запуск production локально
npm run type-check   # Проверка типов
npm run lint         # Линтер
```

### Если dev-сервер не запускается (ошибка lock):
```powershell
# Остановить все процессы Node.js и очистить .next
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

### Настройки проекта Vercel:
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node Version:** 20.x

---

## Шаг 5: Настройка вебхука ЮMoney

### Инструкция:
1. Войдите в кошелек ЮMoney: https://yoomoney.ru
2. Перейдите в **Настройки** → **Уведомления**
3. Добавьте HTTP-уведомление:
   - **URL:** `https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook`
   - **Секрет:** `STtr6NB+i52qaZAKS7PgLwA2`
   - **События:** Успешный платеж
4. Сохраните настройки

### Проверка вебхука:
После настройки сделайте тестовый платеж и проверьте:
- Статус платежа обновился в БД
- Подписка активировалась
- Уведомление создано

---

## Шаг 6: Push на GitHub

### Команды:
```bash
# Проверить статус
git status

# Добавить все файлы
git add .

# Коммит
git commit -m "feat: MetaSystem v2 - полная реализация платформы онлайн-ведения"

# Добавить remote (если еще не добавлен)
git remote add origin https://github.com/dgmuk/MetaSystem.git

# Push
git push -u origin main
```

### Если нужно форсировать push:
```bash
git push -f origin main
```

---

## Чеклист деплоя

- [ ] Миграции выполнены в Supabase
- [ ] Переменные окружения настроены
- [ ] Локальное тестирование пройдено
- [ ] Код запушен на GitHub
- [ ] Проект задеплоен на Vercel
- [ ] Вебхук ЮMoney настроен
- [ ] Тестовый платеж прошел успешно
- [ ] Создан тестовый клиент
- [ ] Создан админ-аккаунт
- [ ] Загружена тестовая программа
- [ ] Realtime работает

---

## Полезные ссылки

- **Supabase Dashboard:** https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/dgmuk/MetaSystem
- **Production URL:** https://meta-system-ja1o.vercel.app
- **ЮMoney:** https://yoomoney.ru

---

## Troubleshooting

### Проблема: Миграции не применяются
**Решение:** Проверьте, что у вас есть права на выполнение SQL в Supabase Dashboard

### Проблема: RLS блокирует запросы
**Решение:** Проверьте политики RLS для каждой таблицы

### Проблема: Вебхук не работает
**Решение:** 
1. Проверьте URL вебхука
2. Проверьте секрет
3. Проверьте логи в Vercel

### Проблема: Build fails на Vercel
**Решение:**
1. Проверьте переменные окружения
2. Запустите `npm run build` локально
3. Проверьте логи сборки

---

**Дата создания:** 2026-05-11  
**Версия:** v2.0.0  
**Статус:** Готово к деплою ✅
