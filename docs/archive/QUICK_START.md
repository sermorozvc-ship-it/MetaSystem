# 🚀 Быстрый старт MetaSystem v2

## Что уже сделано ✅

- ✅ Код написан и протестирован
- ✅ Production build успешно собран
- ✅ Код запушен на GitHub
- ✅ Переменные окружения настроены локально

---

## Что нужно сделать (30 минут)

### 1. Применить миграции в Supabase (5 мин)
```
1. Откройте: https://supabase.com/dashboard/project/bzyypoyvihqhrbllgffh/sql
2. Скопируйте код из: supabase/migrations/20260510_metasystem_v2_schema.sql
3. Вставьте в SQL Editor → Run
4. Повторите для: supabase/migrations/20260511_notifications.sql
```

### 2. Настроить Vercel (5 мин)
```
Вариант А (если проект существует):
1. Откройте: https://vercel.com/dashboard
2. Выберите проект MetaSystem
3. Settings → Environment Variables
4. Добавьте переменные из .env.local

Вариант Б (новый проект):
1. https://vercel.com/new
2. Import: dgmuk/MetaSystem
3. Добавьте переменные из .env.local
4. Deploy
```

### 3. Создать админа (2 мин)
```
1. Зарегистрируйтесь: admin@metasystem.ru / AdminPass123!
2. В Supabase SQL Editor:
   UPDATE profiles SET role = 'admin' WHERE email = 'admin@metasystem.ru';
```

### 4. Создать тестового клиента (3 мин)
```
1. Зарегистрируйтесь: test-client@example.com / TestClient123!
2. В Supabase SQL Editor выполните скрипт из FINAL_CHECKLIST.md (раздел 5)
```

### 5. Загрузить тестовую программу (2 мин)
```
1. Войдите как админ
2. Админ-панель → Выберите клиента → Программы
3. Загрузить программу → Вставьте код из docs/test_program_example.md
4. Неделя: 1, Дни: 4, Даты: текущая неделя
```

### 6. Настроить вебхук ЮMoney (5 мин)
```
1. https://yoomoney.ru → Настройки → Уведомления
2. URL: https://meta-system-ja1o.vercel.app/api/payments/yoomoney-webhook
3. Секрет: STtr6NB+i52qaZAKS7PgLwA2
```

### 7. Протестировать (10 мин)
```
- Заполните тренировку
- Добавьте метрики
- Отправьте сообщение в чат
- Проверьте уведомления
- Проверьте на телефоне
```

---

## Готово! 🎉

**Production URL:** https://meta-system-ja1o.vercel.app

**Подробная инструкция:** См. `FINAL_CHECKLIST.md`

---

## Быстрые команды

### Локальная разработка:
```bash
npm run dev          # Запуск dev-сервера
npm run build        # Сборка production
npm run start        # Запуск production локально
```

### Git:
```bash
git status           # Проверить изменения
git add .            # Добавить все файлы
git commit -m "..."  # Создать коммит
git push origin main # Запушить на GitHub
```

### Проверка:
```bash
npx tsc --noEmit     # Проверка типов
```

---

## Структура проекта

```
MetaSystem/
├── src/
│   ├── app/                    # Next.js страницы
│   │   ├── auth/               # Авторизация
│   │   ├── payment/            # Оплата
│   │   ├── questionnaire/      # Анкета
│   │   ├── dashboard/          # Дашборд клиента
│   │   ├── programs/           # Программы
│   │   ├── metrics/            # Метрики
│   │   ├── messages/           # Чат
│   │   └── admin/              # Админ-панель
│   ├── components/             # React компоненты
│   └── lib/
│       ├── services/           # Сервисы БД
│       └── utils/              # Утилиты
├── supabase/
│   └── migrations/             # SQL миграции
├── docs/                       # Документация
└── public/                     # Статика
```

---

## Тарифы

| Тариф | Цена | План питания |
|-------|------|-------------|
| 1 месяц | 14 900 ₽ | +3 000 ₽ |
| 3 месяца | 35 900 ₽ | +3 000 ₽ |
| 6 месяцев | 59 900 ₽ | 🎁 В подарок |

---

## Поддержка

- **Документация:** См. папку `docs/`
- **Проблемы:** См. раздел Troubleshooting в `DEPLOY_INSTRUCTIONS.md`
- **GitHub:** https://github.com/dgmuk/MetaSystem

---

**Версия:** v2.0.0  
**Дата:** 2026-05-11
