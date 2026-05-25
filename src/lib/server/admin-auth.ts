// MetaSystem — admin auth helper for API routes
//
// До этого в админских клиентских компонентах был захардкожен Supabase
// service_role JWT. Это утечка ключа в публичный JS-бандл — любой
// посетитель сайта мог его вытащить и обходить RLS. Теперь все админские
// операции проходят через API-роуты, которые используют этот хелпер:
//   1. читают Authorization: Bearer <user_access_token>;
//   2. валидируют токен через supabase.auth.getUser;
//   3. проверяют profiles.role в ['admin','trainer','curator'];
//   4. возвращают service-role клиента для безопасной работы в обход RLS.
//
// Если аутентификация не прошла — отвечаем NextResponse с 401/403,
// и хендлеры маршрутов просто возвращают этот ответ как есть.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js'

const ALLOWED_ROLES = ['admin', 'trainer', 'curator']

function getServiceUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL!
}

function getServiceKey(): string {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server')
    }
    return key
}

/**
 * Возвращает service-role клиента (без сессии). Используй ТОЛЬКО на сервере.
 */
export function getServiceClient(): SupabaseClient {
    return createSupabaseAdmin(getServiceUrl(), getServiceKey(), {
        auth: { persistSession: false },
    })
}

export type AdminAuthResult =
    | { ok: true; userId: string; role: string; service: SupabaseClient }
    | { ok: false; response: NextResponse }

/**
 * Проверяет, что запрос пришёл от пользователя с ролью админ/тренер/куратор.
 * При успехе возвращает userId + готовый service-role клиент.
 * При провале — NextResponse, который маршрут должен сразу вернуть.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
        return { ok: false, response: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }) }
    }

    let service: SupabaseClient
    try {
        service = getServiceClient()
    } catch (e: any) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Сервер не настроен: ' + (e?.message || 'нет SUPABASE_SERVICE_ROLE_KEY') },
                { status: 500 },
            ),
        }
    }

    const { data: { user }, error: authError } = await service.auth.getUser(token)
    if (authError || !user) {
        return { ok: false, response: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }) }
    }

    const { data: profile, error: profileError } = await service
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        return { ok: false, response: NextResponse.json({ error: 'Профиль не найден' }, { status: 403 }) }
    }

    if (!ALLOWED_ROLES.includes(profile.role)) {
        return { ok: false, response: NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 }) }
    }

    return { ok: true, userId: user.id, role: profile.role, service }
}
