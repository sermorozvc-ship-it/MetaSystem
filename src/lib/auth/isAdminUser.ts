/**
 * Единая точка определения «административного» пользователя.
 *
 * Используется на клиенте для UI-разветвлений (рендер админских пунктов меню,
 * редирект на /admin после логина и т.п.). Это НЕ заменяет серверную проверку
 * прав — для критичных действий используется `isAdmin()` из
 * `@/lib/services/admin`, который дополнительно ходит в БД через RPC `is_admin`.
 *
 * Источник правды для UI-уровня:
 *  1. email из списка владельцев (`OWNER_EMAILS`)
 *  2. user_metadata.role в JWT (admin / curator / trainer)
 */

export const OWNER_EMAILS: readonly string[] = ['dgmukhin@gmail.com']

type AdminLikeUser = {
    email?: string | null
    user_metadata?: { role?: string } | any
} | null | undefined

const PRIVILEGED_ROLES = new Set(['admin', 'curator', 'trainer'])

/**
 * UI-проверка: является ли текущий пользователь админом / куратором / тренером.
 *
 * @param user объект пользователя Supabase (или произвольный совместимый)
 * @param roles какие роли в metadata считать привилегированными.
 *              По умолчанию — admin / curator / trainer.
 */
export function isAdminUser(
    user: AdminLikeUser,
    roles: ReadonlyArray<string> = ['admin', 'curator', 'trainer']
): boolean {
    if (!user) return false

    const email = user.email?.toLowerCase() ?? ''
    if (email && OWNER_EMAILS.includes(email)) return true

    const role = user.user_metadata?.role
    if (typeof role === 'string') {
        const allowed = roles.length === PRIVILEGED_ROLES.size && roles.every(r => PRIVILEGED_ROLES.has(r))
            ? PRIVILEGED_ROLES
            : new Set(roles)
        if (allowed.has(role)) return true
    }

    return false
}
