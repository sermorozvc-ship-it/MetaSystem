// MetaSystem — клиентский хелпер для админских fetch-вызовов
//
// Все админские API-роуты ожидают Authorization: Bearer <user_access_token>.
// Этот хелпер достаёт токен из текущей Supabase-сессии и подставляет его.
// Используется со страниц админки (карточка клиента и т.п.).

import { getAccessTokenWithRecovery } from '@/lib/supabase/client'

const SESSION_RETRY_DELAYS_MS = [0, 500, 1500]

async function getAccessToken(): Promise<string> {
    let lastStatus = 'missing'

    for (let i = 0; i < SESSION_RETRY_DELAYS_MS.length; i++) {
        const delay = SESSION_RETRY_DELAYS_MS[i]
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay))
        }

        const { token, status } = await getAccessTokenWithRecovery()
        lastStatus = status
        if (token) return token

        // Повторяем только транзиентные сбои (lock/таймаут/гонка на старте).
        // Полностью expired после всех попыток recovery — смысла долбить нет,
        // но одна-две паузы часто помогают: AuthContext успевает refresh.
        if (status !== 'expired' && status !== 'missing' && status !== 'refresh_failed') {
            break
        }
    }

    if (lastStatus === 'expired' || lastStatus === 'refresh_failed') {
        throw new Error('Сессия истекла. Перезайдите в админку.')
    }
    throw new Error('Нет токена сессии. Перезайдите в админку.')
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

    // 401: токен мог протухнуть между recovery и запросом — один retry с refresh
    if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 400))
        const { token: retryToken } = await getAccessTokenWithRecovery()
        if (retryToken && retryToken !== token) {
            const retryHeaders = new Headers(init?.headers || {})
            retryHeaders.set('Authorization', `Bearer ${retryToken}`)
            if (init?.json !== undefined) {
                retryHeaders.set('Content-Type', 'application/json')
            }
            const retryRes = await fetch(path, {
                ...init,
                headers: retryHeaders,
                body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
            })
            if (retryRes.ok) {
                return retryRes.json() as Promise<T>
            }
            if (!retryRes.ok) {
                let msg = `HTTP ${retryRes.status}`
                try {
                    const body = await retryRes.json()
                    if (body?.error) msg = body.error
                } catch { /* noop */ }
                if (retryRes.status === 401) {
                    throw new Error('Сессия истекла. Перезайдите в админку.')
                }
                throw new Error(msg)
            }
        } else if (!retryToken) {
            throw new Error('Сессия истекла. Перезайдите в админку.')
        }
    }

    if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
            const body = await res.json()
            if (body?.error) msg = body.error
        } catch {}
        if (res.status === 401) {
            throw new Error('Сессия истекла. Перезайдите в админку.')
        }
        throw new Error(msg)
    }

    return res.json() as Promise<T>
}
