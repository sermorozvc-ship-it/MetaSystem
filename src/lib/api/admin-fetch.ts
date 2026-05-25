// MetaSystem — клиентский хелпер для админских fetch-вызовов
//
// Все админские API-роуты ожидают Authorization: Bearer <user_access_token>.
// Этот хелпер достаёт токен из текущей Supabase-сессии и подставляет его.
// Используется со страниц админки (карточка клиента и т.п.).

import { createClient } from '@/lib/supabase/client'

async function getAccessToken(): Promise<string> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Нет токена сессии. Перезайдите в админку.')
    return session.access_token
}

export async function adminFetch<T = any>(
    path: string,
    init?: RequestInit & { json?: any },
): Promise<T> {
    const token = await getAccessToken()
    const headers = new Headers(init?.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (init?.json !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(path, {
        ...init,
        headers,
        body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    })

    if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
            const body = await res.json()
            if (body?.error) msg = body.error
        } catch {}
        throw new Error(msg)
    }

    return res.json() as Promise<T>
}
