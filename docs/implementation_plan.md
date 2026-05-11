# Платформа онлайн-ведения подопечных — MetaSystem v2

## Финализированный план реализации

---

## Исходные данные (от заказчика)

| Параметр | Значение |
|----------|----------|
| **Тренировочные дни** | Индивидуально для каждого клиента (3, 4, 5 дней/нед) |
| **Масштаб** | 20 клиентов в среднем, архитектура с запасом на 40+ |
| **ИИ** | Пока внешний, в будущем встраивается в платформу |
| **Оплата** | Разовая, 3 тарифа (см. ниже) |

### Тарифная сетка

| Тариф | Цена | План питания |
|-------|------|-------------|
| **1 месяц** | 14 900 ₽ | +3 000 ₽ (опция, галочка) |
| **3 месяца** | 35 900 ₽ | +3 000 ₽ (опция, галочка) |
| **6 месяцев** | 59 900 ₽ | 🎁 В подарок (включено) |

---

## Архитектура решения

### Стек (переиспользуется)
- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Backend/БД:** Supabase (Auth, PostgreSQL, Realtime, Storage)
- **Оплата:** ЮMoney
- **Иконки:** Lucide React
- **Новое:** react-markdown, remark-gfm, recharts, date-fns

### Структура маршрутов

```
src/app/
├── page.tsx                # Лендинг (переделать под ведение)
├── auth/                   # Авторизация ✅ оставить
├── payment/                # Оплата (переделать — 3 тарифа + галочка питание)
├── questionnaire/          # 🆕 Анкета клиента (после оплаты)
├── dashboard/              # Клиентский дашборд (переделать)
├── programs/               # 🆕 Тренировочные программы
│   ├── page.tsx            # Навигация по неделям
│   └── [weekId]/page.tsx   # Программа недели + заполнение
├── metrics/                # 🆕 Метрики, замеры, графики
├── journal/                # Дневник (расширить)
├── messages/               # Чат ✅ оставить
├── settings/               # Профиль (расширить)
├── admin/                  # Админ-панель (расширить)
│   └── clients/[userId]/   # 🆕 Детальный профиль клиента
└── api/
    ├── webhooks/            # Вебхуки ЮMoney ✅ оставить
    └── export/              # 🆕 Экспорт MD
```

---

## Схема базы данных (новые таблицы)

### Модификация `profiles`

```sql
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'client'
  CHECK (role IN ('client', 'admin', 'trainer'));
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN telegram TEXT;
ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN questionnaire_completed BOOLEAN DEFAULT false;
-- Убираем когортные поля, добавляем подписку
ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'inactive'
  CHECK (subscription_status IN ('inactive', 'active', 'paused', 'expired'));
ALTER TABLE profiles ADD COLUMN subscription_end_date DATE;
ALTER TABLE profiles ADD COLUMN has_nutrition_plan BOOLEAN DEFAULT false;
```

### Таблица тарифов/оплат (переделка существующей `payments`)

```sql
-- Переделка payments под тарифы
ALTER TABLE payments ADD COLUMN plan_type TEXT
  CHECK (plan_type IN ('1_month', '3_months', '6_months'));
ALTER TABLE payments ADD COLUMN plan_months INTEGER;
ALTER TABLE payments ADD COLUMN includes_nutrition BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN base_amount DECIMAL(10,2);
ALTER TABLE payments ADD COLUMN nutrition_amount DECIMAL(10,2) DEFAULT 0;
```

### Анкета клиента

```sql
CREATE TABLE client_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- Базовые данные
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  height_cm INTEGER,
  weight_kg DECIMAL(5,2),
  -- Цели и опыт
  goal TEXT,
  training_experience TEXT,
  preferred_training_days INTEGER CHECK (preferred_training_days BETWEEN 2 AND 7),
  available_equipment TEXT[],
  -- Ограничения
  injuries TEXT,
  health_conditions TEXT,
  -- Образ жизни
  sleep_hours_avg DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  activity_level TEXT,
  -- Начальные замеры
  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  arm_cm DECIMAL(5,1),
  thigh_cm DECIMAL(5,1),
  -- Фото (начальные)
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  -- Доп. информация
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Тренировочные программы

```sql
CREATE TABLE training_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  training_days_count INTEGER NOT NULL CHECK (training_days_count BETWEEN 2 AND 7),
  program_md TEXT NOT NULL,          -- Markdown для экспорта/ИИ
  program_data JSONB NOT NULL,       -- Структурированные данные для UI
  status TEXT DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  notes_trainer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_number)
);
```

### Тренировочные записи клиента

```sql
CREATE TABLE training_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL,
  entry_data JSONB NOT NULL DEFAULT '{}',
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, day_number)
);
```

### Метрики клиента

```sql
CREATE TABLE client_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg DECIMAL(5,2),
  body_fat_pct DECIMAL(4,1),
  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  arm_left_cm DECIMAL(5,1),
  arm_right_cm DECIMAL(5,1),
  thigh_left_cm DECIMAL(5,1),
  thigh_right_cm DECIMAL(5,1),
  sleep_hours DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  steps_avg INTEGER,
  water_liters DECIMAL(3,1),
  photo_front TEXT,
  photo_side TEXT,
  photo_back TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, measured_at)
);
```

---

## Пофазный план реализации

### Фаза 1 — Фундамент БД и сервисы (3-4 дня)

**Цель:** Создать основу — новую схему БД и сервисный слой

- [ ] Миграция: обновление `profiles`, `payments`
- [ ] Миграция: создание `client_questionnaires`
- [ ] Миграция: создание `training_programs` + `training_entries`
- [ ] Миграция: создание `client_metrics`
- [ ] RLS-политики для всех новых таблиц
- [ ] Сервисы: `questionnaire.ts`, `training.ts`, `metrics.ts`
- [ ] Убрать когортную логику из всех файлов
- [ ] MD-парсер: функции `parseMdToJson()` и `jsonToMd()`

---

### Фаза 2 — Оплата + Анкета (2-3 дня)

**Цель:** Новый платёжный флоу с 3 тарифами

- [ ] Переделать `/payment`:
  - 3 карточки тарифов (1 мес / 3 мес / 6 мес)
  - Чекбокс «Добавить план питания +3 000 ₽» (для 1 и 3 мес)
  - На 6-мес. тарифе — бейдж «🎁 План питания в подарок»
  - Динамический расчёт итоговой суммы
  - Интеграция с ЮMoney (сумма из выбранного тарифа)
- [ ] Создать `/questionnaire`:
  - Пошаговая форма (4-5 шагов) с прогресс-баром
  - Загрузка стартовых фото (front/side/back)
  - Валидация обязательных полей
  - После завершения → `/dashboard`
- [ ] Обновить вебхук ЮMoney для новой структуры оплат

---

### Фаза 3 — Тренировочные программы (4-5 дней)

**Цель:** Ключевая функциональность — MD-программы

#### Клиентская часть:
- [ ] `/programs` — список недель (timeline/карточки)
  - Текущая неделя выделена
  - Статусы: «Активная», «Заполнено», «Ожидает программу»
- [ ] `/programs/[weekId]` — программа недели:
  - Рендеринг JSON → красивые таблицы с упражнениями
  - YouTube-ссылки кликабельные (модалка или новая вкладка)
  - Input-поля: вес, подходы, RPE, комментарий
  - **Автосохранение** с debounce (1 сек)
  - Индикация заполненности каждого дня (прогресс-бар)
  - Навигация по дням (tabs или swipe)

#### Админская часть:
- [ ] В карточке клиента — вкладка «Программы»
  - Кнопка «Загрузить программу» → модалка:
    - Textarea для вставки MD
    - Автоматический парсинг MD → JSON
    - Указание номера недели, дат
    - Указание количества тренировочных дней
    - Предпросмотр перед сохранением
  - Просмотр заполненных данных клиента (read-only)
  - «Скопировать MD» / «Скачать .md» для отправки в ИИ
  - **Supabase Realtime**: изменения клиента видны мгновенно

---

### Фаза 4 — Метрики и графики (3 дня)

**Цель:** Визуализация прогресса клиента

#### Клиентская часть `/metrics`:
- [ ] Форма внесения замеров (быстрый ввод)
- [ ] Графики (recharts):
  - Динамика веса (линейный)
  - Динамика объёмов (мульти-линейный)
  - Сон / стресс (bar chart)
  - Водный баланс (area chart)
- [ ] Фото-галерея прогресса (сетка по датам, сравнение «было/стало»)

#### Админская часть:
- [ ] Те же графики в карточке клиента
- [ ] Сводная таблица: Δ за неделю / месяц / весь период
- [ ] Быстрый обзор: какие метрики ухудшаются (красные флаги)

---

### Фаза 5 — Дашборды и навигация (2 дня)

**Цель:** Удобные главные экраны

#### Клиентский дашборд:
- [ ] Карточка текущей недели (мини-превью программы)
- [ ] Быстрые метрики: вес, дней до конца подписки
- [ ] Последнее сообщение от тренера
- [ ] CTA: «Заполнить тренировку» / «Внести замеры»
- [ ] Обновлённый Sidebar (Программы, Метрики, Дневник, Чат, Профиль)

#### Админский дашборд:
- [ ] Список клиентов с ключевыми показателями
- [ ] Фильтры: по статусу подписки, по тарифу
- [ ] Индикаторы: кто заполнил тренировку, кто давно не заходил
- [ ] Быстрые действия: загрузить программу, написать клиенту

---

### Фаза 6 — Полировка и тестирование (2 дня)

- [ ] Мобильная адаптация всех новых страниц
- [ ] Полный e2e тест: оплата → анкета → программа → заполнение → экспорт
- [ ] Уведомления (когда клиент заполнил тренировку)
- [ ] Обработка крайних случаев (истёкшая подписка, пустой профиль)
- [ ] Оптимизация загрузки (lazy loading, skeleton screens)

---

## Формат JSON для тренировочной программы

Пример структуры `program_data` (хранится в БД):

```json
{
  "weekNumber": 1,
  "startDate": "2026-05-12",
  "endDate": "2026-05-18",
  "days": [
    {
      "dayNumber": 1,
      "dayOfWeek": "monday",
      "title": "Верх тела (Push)",
      "exercises": [
        {
          "id": "ex1",
          "name": "Жим гантелей лёжа",
          "videoUrl": "https://youtube.com/watch?v=xxx",
          "sets": 3,
          "reps": "10-12",
          "targetWeight": null,
          "clientData": {
            "actualWeight": null,
            "actualReps": null,
            "rpe": null,
            "comment": ""
          }
        }
      ],
      "cardio": "15 мин ходьба (ЧСС 120-130)",
      "clientNotes": ""
    }
  ]
}
```

Парсер MD ↔ JSON будет конвертировать между форматами автоматически.

---

## Оценка трудозатрат

| Фаза | Описание | Дни |
|------|----------|-----|
| 1 | Фундамент БД и сервисы | 3-4 |
| 2 | Оплата + Анкета | 2-3 |
| 3 | Тренировочные программы | 4-5 |
| 4 | Метрики и графики | 3 |
| 5 | Дашборды и навигация | 2 |
| 6 | Полировка | 2 |
| **Итого** | | **16-19 дней** |

> [!NOTE]
> «Дни» — это условные рабочие сессии, а не календарные дни. Каждая сессия — полноценная работа (несколько часов).

---

## Готово к старту

План учитывает:
- ✅ Индивидуальное количество тренировочных дней (2-7)
- ✅ 3 тарифа с опцией питания и подарком на 6 мес.
- ✅ Масштаб 20-40+ клиентов
- ✅ Подготовку к будущей ИИ-интеграции (JSON-структура данных)
- ✅ Переиспользование существующего кода (auth, чаты, дневник, оплата)
