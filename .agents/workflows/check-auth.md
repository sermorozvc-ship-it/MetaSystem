---
description: Проверка архитектуры auth перед изменениями в Supabase, аутентификации или Admin панели
---

# Проверка архитектуры Auth

Этот workflow ОБЯЗАТЕЛЕН при любых изменениях, затрагивающих:
- `src/lib/supabase/client.ts`
- `src/lib/auth/AuthContext.tsx`
- `src/app/admin/page.tsx`
- `middleware.ts`
- `src/components/layout/Sidebar.tsx` (навигация в admin)
- Любые файлы, использующие `navigator.locks`, `getUser()`, `safeGetUser()`

## Шаги

1. **Прочитать архитектурный журнал:**
   Открыть и полностью прочитать файл `docs/ARCHITECTURE.md` в корне проекта.
   Обратить особое внимание на секции:
   - 🔒 Supabase Auth: Управление блокировками
   - ⚠️ Правила для разработчиков
   - 📋 Чеклист при возникновении Auth проблем

2. **Проверить что `auth.lock: inTabLock` присутствует** в `createBrowserClient` в `client.ts`

3. **Проверить что `disableLocks.ts` НЕ импортируется** нигде:
   Выполнить поиск `disableLocks` по всему проекту.

4. **Проверить навигацию в admin** — только `router.push('/admin')`, НИКОГДА `window.open`

5. **После внесения изменений** — проверить сценарий:
   - Dashboard загружается
   - F5 refresh — данные не пропадают
   - Переход в admin — admin загружается
   - Возврат на dashboard — данные работают
