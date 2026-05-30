# MetaSystem v2 — Платформа онлайн-ведения

> Персональная платформа для онлайн-ведения клиентов. Индивидуальные тренировочные программы, отслеживание прогресса, метрики и аналитика.

![Version](https://img.shields.io/badge/version-2.0.0-brightgreen)
![Status](https://img.shields.io/badge/status-production-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## 🎯 Возможности

### Для клиентов:
- ✅ **Регистрация и оплата** — 3 тарифа (1/3/6 месяцев) с опцией плана питания
- ✅ **Анкета** — пошаговая форма для сбора данных о клиенте
- ✅ **Тренировочные программы** — недельные программы с упражнениями, видео, автосохранением
- ✅ **Метрики и графики** — отслеживание веса, объемов, образа жизни
- ✅ **Фото прогресса** — галерея фото до/после
- ✅ **Чат с тренером** — Realtime-чат для общения
- ✅ **Уведомления** — мгновенные уведомления о новых программах, сообщениях
- ✅ **Мобильная версия** — полностью адаптирована для телефонов

### Для тренеров/админов:
- ✅ **Админ-панель** — управление клиентами, статистика
- ✅ **Загрузка программ** — Markdown → JSON парсинг
- ✅ **Просмотр прогресса** — анкеты, заполненные тренировки, метрики клиентов
- ✅ **Realtime-обновления** — мгновенное отображение изменений клиента
- ✅ **Управление оплатами** — подтверждение платежей, активация подписок

---

## 🛠 Технологии

### Frontend:
- **Next.js 14** (App Router)
- **React 18** + TypeScript
- **Tailwind CSS** — дизайн-система с Glassmorphism
- **Recharts** — графики и аналитика
- **Lucide React** — иконки

### Backend:
- **Supabase** — Auth, PostgreSQL, Realtime, Storage
- **Prodamus** — прием платежей (вебхук)

### Дизайн:
- **Dark Theme** — темная тема с lime accent (#c8f542)
- **Шрифты:** Unbounded (заголовки) + Golos Text (тело)
- **Glassmorphism** — стеклянные карточки с blur-эффектом

---

## 📦 Установка

### 1. Клонировать репозиторий
```bash
git clone https://github.com/your-username/metasystem.git
cd metasystem
```

### 2. Установить зависимости
```bash
npm install
```

### 3. Настроить переменные окружения
Создайте файл `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Prodamus
NEXT_PUBLIC_PRODAMUS_FORM_URL=https://metasystem.payform.ru
PRODAMUS_SECRET_KEY=your_prodamus_secret_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Запустить миграции БД
Выполните SQL-миграции из папки `supabase/migrations/` в вашей Supabase БД:
1. `20260510_metasystem_v2_schema.sql` — основная схема
2. `20260511_notifications.sql` — таблица уведомлений

### 5. Запустить проект
```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

---

## 🗂 Структура проекта

```
metasystem/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── auth/               # Авторизация
│   │   ├── payment/            # Оплата
│   │   ├── questionnaire/      # Анкета
│   │   ├── dashboard/          # Дашборд клиента
│   │   ├── programs/           # Тренировочные программы
│   │   ├── calendar/           # Календарь и стрики
│   │   ├── metrics/            # Метрики и графики
│   │   ├── messages/           # Чат
│   │   ├── admin/              # Админ-панель
│   │   └── api/                # API routes (вебхуки)
│   ├── components/             # React компоненты
│   │   ├── Navigation.tsx      # Навигация
│   │   ├── NotificationBell.tsx # Колокольчик уведомлений
│   │   ├── StreakCard.tsx       # Карточка стрика
│   │   └── CalendarGrid.tsx    # Месячная сетка
│   ├── lib/
│   │   ├── services/           # Сервисы для работы с БД
│   │   │   ├── payment.ts
│   │   │   ├── questionnaire.ts
│   │   │   ├── training.ts
│   │   │   ├── metrics.ts
│   │   │   ├── admin.ts
│   │   │   ├── notifications.ts
│   │   │   └── streaks.ts      # Логика стриков
│   │   ├── utils/              # Утилиты
│   │   │   └── md-parser.ts    # Markdown → JSON парсер
│   │   ├── auth.tsx            # Auth контекст
│   │   └── supabase/           # Supabase клиенты
│   └── app/globals.css         # Глобальные стили
├── supabase/
│   ├── migrations/             # SQL миграции
│   ├── CHECK_AND_FIX.sql       # Диагностика и фиксы
│   └── supabase_setup.sql      # Ручная установка таблиц
├── docs/                       # Документация
│   ├── ARCHITECTURE.md         # Архитектурные решения (читать перед изменениями!)
│   ├── PAYMENT_FLOW.md         # Платёжный флоу и отладка
│   ├── dev_log.md              # Лог разработки
│   ├── implementation_plan.md  # План реализации
│   ├── deployment_guide.md     # Руководство по деплою
│   ├── e2e_test_scenarios.md   # E2E тестовые сценарии
│   ├── manual_testing_checklist.md # Чеклист тестирования
│   ├── renewal_migration_instructions.md # Миграция продлений
│   ├── test_program_example.md # Пример тренировочной программы
│   └── archive/                # Устаревшие инструкции
└── public/                     # Статические файлы
```

---

## 🗄 База данных

### Таблицы:
1. **profiles** — профили пользователей (роль, подписка, питание)
2. **payments** — платежи (тариф, сумма, статус)
3. **client_questionnaires** — анкеты клиентов
4. **training_programs** — тренировочные программы (MD + JSON)
5. **training_entries** — заполненные тренировки клиентов
6. **client_metrics** — метрики и замеры
7. **notifications** — уведомления

### RLS-политики:
- Клиенты видят только свои данные
- Админы видят все данные
- Система может создавать уведомления для любого пользователя

---

## 💳 Тарифы

| Тариф | Цена | План питания |
|-------|------|-------------|
| **1 месяц** | 14 900 ₽ | +3 000 ₽ (опция) |
| **3 месяца** | 35 900 ₽ | +3 000 ₽ (опция) |
| **6 месяцев** | 59 900 ₽ | 🎁 В подарок |

---

## 🧪 Тестирование

### Ручное тестирование:
Следуйте чеклисту в `docs/manual_testing_checklist.md`

### E2E сценарии:
Подробные сценарии в `docs/e2e_test_scenarios.md`

### Тестовые данные:
- **Клиент:** `test-client@example.com` / `TestClient123!`
- **Админ:** `admin@metasystem.ru` / `AdminPass123!`

---

## 🚀 Деплой

Полное руководство: `docs/deployment_guide.md`

### Vercel (рекомендуется):
1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения из `.env.example`
3. Задеплойте

### Настройка вебхука Prodamus:
1. Войдите в ЛК Prodamus → платёжная страница → раздел «Уведомления» / «Интеграция»
2. Укажите URL для уведомлений: `https://your-domain.com/api/payments/prodamus-webhook`
3. Скопируйте секретный ключ в переменную `PRODAMUS_SECRET_KEY`

---

## 📱 Мобильная версия

Проект полностью адаптирован для мобильных устройств:
- Touch-friendly кнопки (минимум 44px)
- Адаптивные сетки и отступы
- Предотвращение зума при фокусе на input
- Safe area insets для устройств с вырезами
- Модальные окна открываются снизу

---

## 🔔 Уведомления

### Типы уведомлений:
- **payment_confirmed** — оплата подтверждена
- **program_uploaded** — новая программа загружена
- **training_completed** — тренировка завершена (для админа)
- **metric_added** — новый замер добавлен (для админа)
- **message_received** — новое сообщение
- **subscription_expiring** — подписка истекает
- **subscription_expired** — подписка истекла

### Realtime:
Уведомления приходят мгновенно через Supabase Realtime без перезагрузки страницы.

---

## 📝 Формат программы (Markdown)

Пример программы для загрузки:

```markdown
# Неделя 1 — Адаптация

## День 1 — Верх тела (Push)

### Жим гантелей лёжа
- Подходы: 3
- Повторения: 10-12
- Видео: https://youtube.com/watch?v=example1

### Жим гантелей сидя
- Подходы: 3
- Повторения: 10-12
- Видео: https://youtube.com/watch?v=example2

**Кардио:** 15 мин ходьба (ЧСС 120-130)

---

## День 2 — Низ тела

### Приседания с гантелями
- Подходы: 4
- Повторения: 10-12
- Видео: https://youtube.com/watch?v=example3

**Кардио:** 10 мин велотренажер
```

Парсер автоматически конвертирует Markdown в JSON для отображения в UI.

---

## 🤝 Вклад

Проект разработан для персонального использования. Если хотите внести изменения:
1. Fork репозитория
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📄 Лицензия

MIT License — свободное использование с указанием авторства.

---

## 📞 Контакты

- **Email:** support@metasystem.ru
- **Telegram:** @metasystem_support

---

## 🎉 Благодарности

- **Supabase** — за отличный BaaS
- **Vercel** — за простой деплой Next.js
- **ЮMoney** — за прием платежей
- **Recharts** — за красивые графики

---

**Сделано с ❤️ для онлайн-тренеров**
