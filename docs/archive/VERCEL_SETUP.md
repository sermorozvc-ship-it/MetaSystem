# Настройка Vercel для MetaSystem v2

## Быстрая настройка (5 минут)

### Вариант 1: Проект уже существует на Vercel

1. **Откройте проект:**
   - https://vercel.com/dashboard
   - Найдите проект `meta-system-ja1o` или `MetaSystem`

2. **Проверьте подключение к GitHub:**
   - Settings → Git
   - Должен быть подключен: `dgmuk/MetaSystem`
   - Ветка: `main`

3. **Добавьте переменные окружения:**
   - Settings → Environment Variables
   - Нажмите **Add New**
   - Добавьте каждую переменную (см. ниже)
   - Выберите окружения: **Production**, **Preview**, **Development**

4. **Redeploy:**
   - Deployments → Latest Deployment → ⋯ → Redeploy

---

### Вариант 2: Создать новый проект

1. **Импортировать репозиторий:**
   - https://vercel.com/new
   - Import Git Repository
   - Выберите: `dgmuk/MetaSystem`

2. **Настроить проект:**
   ```
   Project Name: metasystem
   Framework Preset: Next.js
   Root Directory: ./
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   Node.js Version: 20.x
   ```

3. **Добавить переменные окружения** (см. ниже)

4. **Deploy**

---

## Переменные окружения

### Скопируйте и вставьте каждую переменную:

#### 1. NEXT_PUBLIC_SUPABASE_URL
```
https://bzyypoyvihqhrbllgffh.supabase.co
```

#### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Nzk0ODMsImV4cCI6MjA4NTQ1NTQ4M30.a4WXfvBU98YbqUPxrxVdkG6U-MaUodsVxd53qhI1apM
```

#### 3. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA
```

#### 4. YOOMONEY_WALLET
```
410014990008683
```

#### 5. YOOMONEY_SECRET
```
STtr6NB+i52qaZAKS7PgLwA2
```

#### 6. NEXT_PUBLIC_YOOMONEY_WALLET
```
410014990008683
```

#### 7. NEXT_PUBLIC_APP_URL
```
https://meta-system-ja1o.vercel.app
```

**Важно:** Если у вас другой URL на Vercel, замените последнюю переменную на ваш URL.

---

## Проверка деплоя

### 1. Статус сборки
- Deployments → Latest
- Статус должен быть: **Ready** ✅
- Время сборки: ~2-3 минуты

### 2. Логи сборки
Должны быть строки:
```
✓ Compiled successfully
✓ Finished TypeScript
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### 3. Проверка маршрутов
Должны быть созданы:
```
○ /
○ /auth
○ /payment
○ /questionnaire
○ /dashboard
○ /programs
ƒ /programs/[programId]
○ /metrics
○ /messages
○ /admin
ƒ /admin/clients/[userId]
ƒ /api/payments/yoomoney-webhook
```

---

## Проверка работы сайта

### 1. Откройте production URL:
```
https://meta-system-ja1o.vercel.app
```

### 2. Проверьте основные страницы:
- [ ] Главная страница загружается
- [ ] `/auth` — страница авторизации
- [ ] `/payment` — страница оплаты с 3 тарифами
- [ ] Нет ошибок в консоли браузера (F12)

### 3. Проверьте подключение к Supabase:
- Попробуйте зарегистрироваться
- Если регистрация работает — Supabase подключен ✅

---

## Автоматический деплой

После настройки каждый push в `main` будет автоматически деплоиться:

```bash
git add .
git commit -m "update"
git push origin main
```

Vercel автоматически:
1. Обнаружит изменения
2. Запустит сборку
3. Задеплоит новую версию
4. Обновит production URL

---

## Настройка домена (опционально)

### Если у вас есть свой домен:

1. **Добавить домен:**
   - Settings → Domains
   - Add Domain
   - Введите: `metasystem.ru` (или ваш домен)

2. **Настроить DNS:**
   - Добавьте A-запись или CNAME в настройках вашего регистратора
   - Vercel покажет нужные значения

3. **Обновить переменную:**
   - Settings → Environment Variables
   - Измените `NEXT_PUBLIC_APP_URL` на ваш домен
   - Redeploy

---

## Мониторинг

### Логи:
- Deployments → Latest → View Function Logs
- Здесь видны все запросы и ошибки

### Аналитика:
- Analytics → Overview
- Статистика посещений, производительность

### Ошибки:
- Deployments → Latest → Build Logs
- Если деплой упал — здесь причина

---

## Troubleshooting

### Проблема: Build fails
**Причина:** Ошибка в коде или отсутствуют переменные  
**Решение:**
1. Проверьте Build Logs
2. Убедитесь, что все переменные добавлены
3. Попробуйте собрать локально: `npm run build`

### Проблема: 500 Internal Server Error
**Причина:** Ошибка на сервере (обычно в API routes)  
**Решение:**
1. Проверьте Function Logs
2. Проверьте подключение к Supabase
3. Проверьте переменные окружения

### Проблема: Supabase connection failed
**Причина:** Неверные ключи Supabase  
**Решение:**
1. Проверьте переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Убедитесь, что нет лишних пробелов
3. Redeploy после исправления

### Проблема: Вебхук не работает
**Причина:** Неверный URL или секрет  
**Решение:**
1. Проверьте URL вебхука в ЮMoney
2. Должен быть: `https://ваш-домен.vercel.app/api/payments/yoomoney-webhook`
3. Проверьте секрет: `STtr6NB+i52qaZAKS7PgLwA2`

---

## Полезные команды Vercel CLI

### Установка CLI:
```bash
npm i -g vercel
```

### Вход:
```bash
vercel login
```

### Деплой:
```bash
vercel --prod
```

### Просмотр логов:
```bash
vercel logs
```

### Список деплоев:
```bash
vercel ls
```

---

## Готово! ✅

После настройки Vercel ваш сайт будет доступен по адресу:
**https://meta-system-ja1o.vercel.app**

Следующий шаг: **Применить миграции в Supabase** (см. `FINAL_CHECKLIST.md`)

---

**Дата:** 2026-05-11  
**Версия:** v2.0.0
