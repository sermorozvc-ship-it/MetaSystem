# Архитектурный журнал MetaSystem

> Этот документ фиксирует критические архитектурные решения проекта.  
> **Обязательно читать перед внесением изменений** в auth, Supabase или admin панель.

---

## 🔒 Supabase Auth: Управление блокировками (КРИТИЧНО!)

### Проблема
Supabase Auth использует `navigator.locks` (Web Locks API) для синхронизации
обновления токенов между вкладками. Это вызывает **deadlock** когда:
- Несколько компонентов одновременно вызывают `getUser()`
- Открыто несколько вкладок приложения
- При F5 refresh — внутренние операции Supabase гонятся друг с другом

### ❌ Что НЕ работает

1. **Глобальный полифилл `disableLocks.ts`** — убирает ВСЮ блокировку → race condition при F5 refresh → токен обновляется дважды → сессия ломается
2. **Импорт `disableLocks` в Server Component (`layout.tsx`)** — код НЕ выполняется на клиенте в Next.js App Router, это мёртвый код
3. **`window.open('/admin', '_blank')`** — новая вкладка создаёт кросс-табовое состязание за refresh token

### ✅ Правильное решение (текущее)

**Файл: `src/lib/supabase/client.ts`**

Кастомная `inTabLock` функция передаётся в `createBrowserClient` через параметр `auth.lock`:

```typescript
client = createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
        lock: inTabLock, // Кастомная lock-функция
    }
})
```

Логика `inTabLock`:
- **Сериализует** операции **внутри** одной вкладки (предотвращает race condition)
- **НЕ блокирует** **между** вкладками (предотвращает deadlock)
- Имеет `acquireTimeout` для предотвращения бесконечного ожидания

### ⚠️ Правила для разработчиков

1. **НИКОГДА** не импортировать `disableLocks.ts` — он оставлен как справка, но не используется
2. **НИКОГДА** не патчить `navigator.locks` глобально — это ломает refresh при F5
3. **НИКОГДА** не открывать admin в новой вкладке (`window.open('_blank')`) — использовать `router.push('/admin')`
4. Все блокировки управляются ТОЛЬКО через `auth.lock` в `createBrowserClient`

---

## 🔑 Аутентификация: Архитектура

### Поток данных
```
AuthProvider (AuthContext.tsx)
    ├── onAuthStateChange → setCachedUser()
    ├── Единственный источник правды о user/session
    └── Все компоненты получают user через useAuth()

createClient() (client.ts)
    ├── Singleton — один экземпляр на приложение
    ├── auth.lock = inTabLock (кастомная блокировка)
    └── safeGetUser() — с кешем и семафором

Middleware (middleware.ts)
    └── getUser() на сервере — обновляет cookies
```

### Ключевые файлы

| Файл | Роль | НЕЛЬЗЯ менять без проверки |
|------|------|---------------------------|
| `src/lib/supabase/client.ts` | Supabase клиент + `inTabLock` + `safeGetUser` | ⚠️ Критично |
| `src/lib/auth/AuthContext.tsx` | AuthProvider, `useAuth()` hook | ⚠️ Критично |
| `middleware.ts` | Server-side token refresh | ⚠️ Критично |
| `src/lib/supabase/disableLocks.ts` | **НЕ ИСПОЛЬЗУЕТСЯ** — оставлен как справка | 🚫 Не импортировать |
| `src/app/layout.tsx` | Root layout (Server Component) | ℹ️ Не добавлять клиентские импорты |

### safeGetUser() — безопасное получение пользователя

```
Приоритет:
1. Кеш из AuthContext (мгновенно, без сети) — TTL 60 сек
2. Семафор (один запрос за раз)
3. getUser() с таймаутом 4 сек
4. При ошибке — возврат кешированного значения
```

---

## 👤 Admin Panel

### Контрольный список
- [ ] Навигация в admin — только `router.push('/admin')`, НИКОГДА `window.open`
- [ ] `isAdmin()` — получает user параметром, НЕ вызывает `safeGetUser()` если user передан
- [ ] Данные загружаются через `Promise.allSettled` — параллельно
- [ ] `getAdminStats()` — 5 запросов через `Promise.all`, не последовательно
- [ ] Redirect неавторизованных — в `useEffect`, НИКОГДА в render body

### Проверка isAdmin

```
1. Hardcoded email (мгновенно)     → owners = ['dgmukhin@gmail.com']
2. JWT metadata (без запроса к БД) → user.user_metadata.role
3. RPC is_admin (с таймаутом 5с)   → supabase.rpc('is_admin')
4. Fallback profiles query (5с)    → select role from profiles
```

---

## 🏗️ Next.js App Router: Важные нюансы

### Server vs Client Components

```
layout.tsx          → Server Component (без 'use client')
                      ⚠️ Импорты НЕ выполняются на клиенте!
                      ⚠️ Нельзя импортировать клиентские side-effects

AuthContext.tsx     → Client Component ('use client')
                      ✅ Можно использовать useState, useEffect
                      ✅ Импорты выполняются на клиенте

admin/page.tsx      → Client Component ('use client')
                      ✅ Доступ к router, hooks
```

### Middleware
- Выполняется на **каждый** запрос (кроме статики)
- `getUser()` в middleware обновляет cookies → НЕ удалять!
- Matcher: все маршруты кроме `_next/static`, `_next/image`, favicon, медиа

---

## 📋 Чеклист при возникновении Auth проблем

Если после изменений в коде возникают проблемы с аутентификацией:

1. **Проверить `client.ts`** — есть ли `auth.lock: inTabLock` в `createBrowserClient`?
2. **Проверить что `disableLocks.ts` НЕ импортируется** нигде
3. **Проверить Sidebar** — admin открывается через `router.push`, не `window.open`?
4. **Проверить admin page** — `router.push` не в render body, а в `useEffect`?
5. **Очистить кеш браузера** — localStorage (ключи `sb-*`)
6. **Перезапустить dev server** — `npm run dev`

### Воспроизведение проблемы
```
1. Открыть dashboard — данные загружаются? ✅/❌
2. Нажать F5 — данные загружаются после refresh? ✅/❌
3. Перейти в admin — admin загружается? ✅/❌
4. Вернуться на dashboard — данные ещё работают? ✅/❌
```

---

## 📦 Зависимости (версии на момент фиксации)

```json
{
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "next": "^16.1.6",
    "react": "^19.0.0"
}
```

> **При обновлении `@supabase/ssr` или `@supabase/supabase-js`:**  
> Убедиться что параметр `auth.lock` всё ещё поддерживается.  
> Проверить changelog на изменения в механизме блокировок.

---

*Последнее обновление: 2026-03-12*  
*Автор: AI Assistant (Antigravity)*
