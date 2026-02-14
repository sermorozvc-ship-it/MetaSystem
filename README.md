# Metabolic Restart (Метаболический Запуск)

Премиум 7-дневный фитнес-курс для перезагрузки метаболизма.

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Glassmorphism Dark Theme)
- **Backend:** Supabase (Auth, PostgreSQL)
- **Icons:** Lucide React

## Quick Start

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Открыть http://localhost:3000
```

## Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Скопируйте `.env.example` в `.env.local`
3. Заполните переменные окружения
4. Выполните миграции в SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/seed.sql`

## Структура проекта

```
src/
├── app/
│   ├── dashboard/       # Главный дашборд
│   ├── waiting-room/    # Комната ожидания
│   └── layout.tsx       # Root layout
├── components/
│   ├── layout/          # Sidebar, Header, DashboardLayout
│   ├── dashboard/       # DayCard, ActionPanel, WeekGrid
│   └── modals/          # VisceralCalculator, BodyMeasurements
├── lib/
│   ├── utils/           # cohort.ts (когортная логика)
│   └── data/            # courseData.ts (контент курса)
└── supabase/
    ├── migrations/      # SQL схема
    └── seed.sql         # Seed данные
```

## Когортная система

- Курс стартует каждый **понедельник**
- До старта пользователи видят **Waiting Room** с таймером
- Дни открываются последовательно (Day 2 недоступен до завершения Day 1)

## Особенности UI

- **Glassmorphism:** `backdrop-blur`, полупрозрачные карточки
- **Color Palette:** MetaOrange (#FF4500), DeepDark (#121212)
- **Animations:** Glow effects, fade-in, slide-in

## Лицензия

MIT
