// MetaSystem — клиентский хелпер для админских fetch-вызовов
//
// Все админские API-роуты ожидают Authorization: Bearer <user_access_token>.
// Этот хелпер достаёт токен из текущей Supabase-сессии и подставляет его.
// Используется со страниц админки (карточка клиента и т.п.).

import {
    getAccessTokenWithRecovery,
    getStoredAccessTokenSync,
} from '@/lib/supabase/client'

const SESSION_RETRY_DELAYS_MS = [0, 300, 800]

/**
 * Быстрый путь: JWT из localStorage (без inTabLock / refresh).
 * Recovery — только если sync-токена нет или он «почти» протух.
 */
async function getAccessToken(): Promise<string> {
    const sync = getStoredAccessTokenSync()
    if (sync) return sync

    let lastStatus = 'missing'

    for (let i = 0; i < SESSION_RETRY_DELAYS_MS.length; i++) {
        const delay = SESSION_RETRY_DELAYS_MS[i]
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay))
        }

        // После паузы снова пробуем sync — AuthContext мог обновить storage
        const again = getStoredAccessTokenSync()
        if (again) return again

        const { token, status } = await getAccessTokenWithRecovery()
        lastStatus = status
        if (token) return token

        // Повторяем только транзиентные сбои (lock/таймаут/гонка на старте).
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
    init?: RequestInit & { json?: any; timeoutMs?: number },
): Promise<T> {
    const token = await getAccessToken()
    const headers = new Headers(init?.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (init?.json !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    const timeoutMs = init?.timeoutMs ?? 20_000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Если снаружи уже передали signal — уважаем оба
    const externalSignal = init?.signal
    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort()
        else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }

    try {
        const res = await fetch(path, {
            ...init,
            headers,
            signal: controller.signal,
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
                const retryController = new AbortController()
                const retryTimer = setTimeout(() => retryController.abort(), timeoutMs)
                try {
                    const retryRes = await fetch(path, {
                        ...init,
                        headers: retryHeaders,
                        signal: retryController.signal,
                        body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
                    })
                    if (retryRes.ok) {
                        return retryRes.json() as Promise<T>
                    }
                    let msg = `HTTP ${retryRes.status}`
                    try {
                        const body = await retryRes.json()
                        if (body?.error) msg = body.error
                    } catch { /* noop */ }
                    if (retryRes.status === 401) {
                        throw new Error('Сессия истекла. Перезайдите в админку.')
                    }
                    throw new Error(msg)
                } finally {
                    clearTimeout(retryTimer)
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
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            throw new Error(`Таймаут запроса (${timeoutMs}ms): ${path}`)
        }
        throw e
    } finally {
        clearTimeout(timer)
        if (externalSignal) {
            externalSignal.removeEventListener('abort', onExternalAbort)
        }
    }
}
