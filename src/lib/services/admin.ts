import { createClient, safeGetUser } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/utils/with-timeout'

export interface UserProfile {
    id: string
    email: string
    full_name: string | null
    role: 'client' | 'user' | 'admin' | 'trainer' | 'curator'
    is_blocked: boolean
    blocked_at: string | null
    blocked_reason: string | null
    is_archived: boolean
    archived_at: string | null
    archived_reason: string | null
    created_at: string
    subscription_status?: 'inactive' | 'active' | 'paused' | 'expired'
    subscription_end_date?: string | null
    has_nutrition_plan?: boolean
    /** Slug клиента в репозитории training-brain (clients/<slug>/...) */
    training_brain_client_id?: string | null
    /** Видит ли клиент свои тренировочные программы */
    programs_visible?: boolean
}

export interface UserWithProgress extends UserProfile {
    completed_days: number
    total_reports: number
    last_activity: string | null
    payment_status: 'none' | 'pending' | 'confirmed' | 'refunded'
    payment_created_at: string | null
    plan_type?: '1_month' | '3_months' | '6_months'
}

export interface AdminMessage {
    id: number
    from_user_id: string | null
    to_user_id: string
    message: string
    is_read: boolean
    message_type: 'message' | 'warning' | 'announcement'
    created_at: string
    from_user?: { full_name: string; email: string }
    to_user?: { full_name: string; email: string }
}

export interface DayReportWithUser {
    id: number
    user_id: string
    day_number: number
    comment: string | null
    files: { name: string; url: string; type: string }[]
    status: 'pending' | 'approved' | 'rejected'
    curator_comment: string | null
    created_at: string
    user?: { full_name: string; email: string }
}

export interface AdminPayment {
    id: string
    user_id: string
    amount: number
    currency: string
    status: 'pending' | 'confirmed' | 'refunded'
    payment_method: string
    created_at: string
    confirmed_at: string | null
    plan_type?: '1_month' | '3_months' | '6_months'
    plan_months?: number
    includes_nutrition?: boolean
    user?: { full_name: string; email: string }
}

// --- SERVICES ---

// Кеш результата isAdmin — чтобы не делать запрос при каждой навигации
let adminCacheResult: boolean | null = null
let adminCacheUserId: string | null = null

// Check if current user is admin
// Принимает user параметром чтобы не делать лишний getSession()
export async function isAdmin(userParam?: { id?: string; email?: string | null; user_metadata?: any } | null): Promise<boolean> {
    // Используем переданного user — НЕ вызываем safeGetUser если user уже передан
    let user: { id?: string; email?: string | null; user_metadata?: any } | null = userParam ?? null

    if (!user) {
        user = await safeGetUser()
    }

    if (!user) {
        console.log('[isAdmin] No user session — instant false')
        return false
    }

    // Кеш — если тот же пользователь, возвращаем мгновенно
    if (adminCacheResult !== null && adminCacheUserId === (user.id ?? user.email)) {
        return adminCacheResult
    }

    const setCache = (result: boolean) => {
        adminCacheResult = result
        adminCacheUserId = user.id ?? user.email ?? null
        return result
    }

    // 1. Check Owner Emails (Hardcoded bypass — самый быстрый путь, без сетевых запросов)
    const owners = ['dgmukhin@gmail.com']
    if (owners.includes(user.email?.toLowerCase() || '')) {
        console.log('[isAdmin] Emergency admin access granted for owner:', user.email)
        return setCache(true)
    }

    // 2. Check User Metadata в JWT токене (без запроса к БД)
    if (user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'curator') {
        console.log('[isAdmin] Access granted via token metadata')
        return setCache(true)
    }

    // 3. Проверяем через RPC с таймаутом (SECURITY DEFINER — надёжно)
    const supabase = createClient()
    try {
        console.log('[isAdmin] Checking DB via RPC is_admin...')
        const rpcResult = await Promise.race([
            supabase.rpc('is_admin'),
            new Promise<{ data: null; error: { code: string; message: string } }>((resolve) =>
                setTimeout(() => resolve({ data: null, error: { code: 'TIMEOUT', message: 'RPC timeout 2s' } }), 2000)
            )
        ])

        const { data: isRpcAdmin, error: rpcError } = rpcResult

        if (!rpcError && isRpcAdmin === true) {
            console.log('[isAdmin] RPC check successful: IS ADMIN')
            return setCache(true)
        }

        if (rpcError) {
            console.warn('[isAdmin] RPC error:', rpcError.code, rpcError.message)
        }
    } catch (e: any) {
        console.warn('[isAdmin] RPC exception:', e.message)
    }

    // 4. Fallback — прямой запрос к profiles с таймаутом
    if (!user.id) return false
    console.log('[isAdmin] Falling back to direct profile query...')
    try {
        const profileResult = await Promise.race([
            supabase.from('profiles').select('role').eq('id', user.id).single(),
            new Promise<{ data: null; error: { message: string } }>((resolve) =>
                setTimeout(() => resolve({ data: null, error: { message: 'Profile query timeout 2s' } }), 2000)
            )
        ])

        const { data: profile, error: profileError } = profileResult

        if (profileError) {
            console.error('[isAdmin] Profile query failed:', profileError.message)
            return setCache(false)
        }

        const hasAccess = profile?.role === 'admin' || profile?.role === 'curator'
        console.log('[isAdmin] Profile role check result:', profile?.role, '-> Access:', hasAccess)
        return setCache(hasAccess)
    } catch (e: any) {
        console.error('[isAdmin] Profile query exception:', e.message)
        return setCache(false)
    }
}

/** Клиентский fallback: прямой Supabase, если API недоступен */
async function getAllUsersClientFallback(): Promise<UserWithProgress[]> {
    const supabase = createClient()
    let profiles: any[] | null = null

    try {
        const { data, error } = await withTimeout<{ data: any[] | null; error: any }>(
            supabase.rpc('get_all_users_secure'),
            'getAllUsers:rpc',
            8_000,
        )
        if (!error && data) {
            profiles = data
        } else {
            const fallback = await withTimeout<{ data: any[] | null; error: any }>(
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                'getAllUsers:profiles',
                8_000,
            )
            if (fallback.error) throw new Error(fallback.error.message)
            profiles = fallback.data
        }
    } catch (e: any) {
        console.error('[Admin] Client fallback failed:', e)
        throw e
    }

    if (!profiles?.length) return []

    const [progressResult, reportsResult, paymentsResult] = await Promise.all([
        withTimeout<{ data: any[] | null }>(
            supabase.from('user_progress').select('user_id, completed').eq('completed', true),
            'getAllUsers:progress', 6_000,
        ).catch(() => ({ data: [] })),
        withTimeout<{ data: any[] | null }>(
            supabase.from('day_reports').select('user_id, created_at').order('created_at', { ascending: false }),
            'getAllUsers:reports', 6_000,
        ).catch(() => ({ data: [] })),
        withTimeout<{ data: any[] | null }>(
            supabase.from('payments').select('user_id, status, plan_type, created_at').order('created_at', { ascending: false }),
            'getAllUsers:payments', 6_000,
        ).catch(() => ({ data: [] })),
    ])

    const progressMap = new Map<string, number>()
    ;(progressResult.data || []).forEach((p: any) => {
        progressMap.set(p.user_id, (progressMap.get(p.user_id) || 0) + 1)
    })

    const reportsMap = new Map<string, { count: number; last: string | null }>()
    ;(reportsResult.data || []).forEach((r: any) => {
        const stats = reportsMap.get(r.user_id) || { count: 0, last: null }
        if (!stats.last) stats.last = r.created_at
        stats.count++
        reportsMap.set(r.user_id, stats)
    })

    const paymentsMap = new Map<string, { status: string; plan_type: string | null; created_at: string }>()
    ;(paymentsResult.data || []).forEach((p: any) => {
        if (!paymentsMap.has(p.user_id)) {
            paymentsMap.set(p.user_id, { status: p.status, plan_type: p.plan_type, created_at: p.created_at })
        }
    })

    return profiles.map((profile: any) => {
        const reportStats = reportsMap.get(profile.id)
        const paymentInfo = paymentsMap.get(profile.id)
        return {
            ...profile,
            completed_days: progressMap.get(profile.id) || 0,
            total_reports: reportStats?.count || 0,
            last_activity: reportStats?.last || profile.created_at,
            payment_status: paymentInfo?.status || 'none',
            payment_created_at: paymentInfo?.created_at || null,
            plan_type: paymentInfo?.plan_type || null,
        }
    })
}

// Get all users with progress stats (серверный API + retry, fallback на клиент)
export async function getAllUsers(): Promise<UserWithProgress[]> {
    const { adminFetch } = await import('@/lib/api/admin-fetch')
    const delays = [0, 500, 1500]

    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
            await new Promise((r) => setTimeout(r, delays[attempt]))
        }
        try {
            const { users } = await adminFetch<{ users: UserWithProgress[] }>('/api/admin/users')
            console.log(`[Admin] Fetched ${users?.length ?? 0} users via API (attempt ${attempt + 1})`)
            return users ?? []
        } catch (e) {
            console.warn(`[Admin] getAllUsers API attempt ${attempt + 1} failed:`, e)
            if (attempt === delays.length - 1) {
                try {
                    const users = await getAllUsersClientFallback()
                    console.log(`[Admin] Fetched ${users.length} users via client fallback`)
                    return users
                } catch (fallbackErr) {
                    console.error('[Admin] All getAllUsers paths failed:', fallbackErr)
                    throw fallbackErr
                }
            }
        }
    }

    return []
}

// Get single user details
export async function getUserDetails(userId: string): Promise<UserWithProgress | null> {
    const supabase = createClient()

    const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (error || !user) return null

    // Get progress
    const { data: progress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)

    // Get reports count
    const { count } = await supabase
        .from('day_reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

    return {
        ...user,
        completed_days: progress?.filter(p => p.completed).length || 0,
        total_reports: count || 0,
        last_activity: user.created_at
    }
}

/**
 * Обновить slug клиента в training-brain (поле profiles.training_brain_client_id).
 * Используется в админке для связки клиента с папкой clients/<slug>/ в репозитории.
 * Передавай null или пустую строку чтобы очистить поле.
 */
export async function updateTrainingBrainClientId(
    userId: string,
    slug: string | null,
): Promise<void> {
    const supabase = createClient()
    const value = slug && slug.trim() ? slug.trim() : null
    const { error } = await supabase
        .from('profiles')
        .update({ training_brain_client_id: value })
        .eq('id', userId)
    if (error) throw new Error(error.message)
}

// Get user's day reports
export async function getUserReports(userId: string): Promise<DayReportWithUser[]> {
    const supabase = createClient()

    try {
        const { data, error } = await supabase.rpc('get_user_reports_secure', {
            p_user_id: userId
        })

        if (!error && data) return data

        // Fallback
        const fallback = await supabase
            .from('day_reports')
            .select('*')
            .eq('user_id', userId)
            .order('day_number', { ascending: true })

        return fallback.data || []
    } catch (e) {
        console.error('Error in getUserReports:', e)
        return []
    }
}

// Get all pending reports
export async function getPendingReports(): Promise<DayReportWithUser[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('day_reports')
        .select('*, user:profiles(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching reports:', error)
        return []
    }

    return data || []
}

// Get all reports with user info
export async function getAllReports(): Promise<DayReportWithUser[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('day_reports')
        .select('*, user:profiles(full_name, email)')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching all reports:', error)
        return []
    }

    return data || []
}

// Get all messages
export async function getAllMessages(): Promise<AdminMessage[]> {
    const supabase = createClient()

    // Using alias for joins
    const { data: messages, error } = await supabase
        .from('admin_messages')
        .select(`
            *,
            from_user:profiles!from_user_id(full_name, email),
            to_user:profiles!to_user_id(full_name, email)
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching all messages:', error)
        return []
    }

    // Map fetched data to match AdminMessage interface
    return (messages || []).map((msg: any) => ({
        ...msg,
        from_user: msg.from_user,
        to_user: msg.to_user
    }))
}

// Update report status
export async function updateReportStatus(
    reportId: number,
    status: 'approved' | 'rejected',
    curatorComment?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('day_reports')
        .update({
            status,
            curator_comment: curatorComment,
            updated_at: new Date().toISOString()
        })
        .eq('id', reportId)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function deleteReport(reportId: number): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const { error } = await supabase.from('day_reports').delete().eq('id', reportId)
    if (error) return { success: false, error: error.message }
    return { success: true }
}

// Send message to user
export async function sendMessageToUser(
    toUserId: string,
    message: string,
    messageType: 'message' | 'warning' | 'announcement' = 'message'
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { success: false, error: 'Требуется авторизация' }

    console.log('Sending message:', { from: user.id, to: toUserId, message, messageType })

    const { data, error } = await supabase
        .from('admin_messages')
        .insert({
            from_user_id: user.id,
            to_user_id: toUserId,
            message,
            message_type: messageType
        })
        .select()

    if (error) {
        console.error('Send message error:', error)
        return { success: false, error: error.message }
    }

    console.log('Message sent successfully:', data)
    return { success: true }
}

// Get messages for user (fixed two-way query)
export async function getUserMessages(userId: string): Promise<AdminMessage[]> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return []

    try {
        // We use a direct query with .or to ensure we get both directions:
        // 1. Sent TO this user
        // 2. Sent BY this user
        const { data, error } = await supabase
            .from('admin_messages')
            .select('*, from_user:profiles!from_user_id(full_name, email)')
            .or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`)
            .order('created_at', { ascending: true }) // Ascending for chat history

        if (error) throw error
        return data || []
    } catch (e) {
        console.error('Error in getUserMessages:', e)
        return []
    }
}

// Block user
export async function blockUser(
    userId: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_reason: reason
        })
        .eq('id', userId)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

// Unblock user
export async function unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            is_blocked: false,
            blocked_at: null,
            blocked_reason: null
        })
        .eq('id', userId)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

// Create client manually (admin bypass — no payment flow)
export async function createClientManually(params: {
    email: string
    password: string
    full_name: string
    amount: number
    plan_months: number
    includes_nutrition: boolean
    subscription_start: string
    subscription_end: string
}): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
        const { adminFetch } = await import('@/lib/api/admin-fetch')
        const { userId } = await adminFetch<{ userId: string }>('/api/admin/users', {
            method: 'POST',
            json: params,
        })
        return { success: true, userId }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Ошибка создания пользователя' }
    }
}
export async function archiveUser(
    userId: string,
    reason: string = ''
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_reason: reason || null,
        })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// Unarchive user (restore from archive)
export async function unarchiveUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            is_archived: false,
            archived_at: null,
            archived_reason: null,
        })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// Delete user permanently — through server API (no service_role in browser)
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { adminFetch } = await import('@/lib/api/admin-fetch')
        await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Ошибка удаления' }
    }
}

// Get admin stats — все запросы параллельно
export async function getAdminStats(): Promise<{
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    pendingReports: number
    completedToday: number
    pendingPayments: number
    confirmedPayments: number
}> {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const safe = <T,>(p: PromiseLike<T>, label: string): Promise<T> =>
        withTimeout<T>(p, label, 6_000).catch((e) => {
            console.warn(`[Admin] ${label} failed:`, e?.message || e)
            return { count: 0 } as any
        })

    // Параллельно выполняем все запросы — каждый с собственным таймаутом
    const [totalR, activeR, blockedR, pendingR, completedR, pendingPayR, confirmedPayR] = await Promise.all([
        safe<{ count: number | null }>(supabase.from('profiles').select('*', { count: 'exact', head: true }), 'stats:total'),
        safe<{ count: number | null }>(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', false), 'stats:active'),
        safe<{ count: number | null }>(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', true), 'stats:blocked'),
        safe<{ count: number | null }>(supabase.from('day_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'), 'stats:pendingReports'),
        safe<{ count: number | null }>(supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('completed', true).gte('completed_at', today.toISOString()), 'stats:completedToday'),
        safe<{ count: number | null }>(supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'), 'stats:pendingPay'),
        safe<{ count: number | null }>(supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'), 'stats:confirmedPay'),
    ])

    return {
        totalUsers: totalR.count || 0,
        activeUsers: activeR.count || 0,
        blockedUsers: blockedR.count || 0,
        pendingReports: pendingR.count || 0,
        completedToday: completedR.count || 0,
        pendingPayments: pendingPayR.count || 0,
        confirmedPayments: confirmedPayR.count || 0,
    }
}

// --- PAYMENT MANAGEMENT ---

// Get all pending payments
export async function getPendingPayments(): Promise<AdminPayment[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('payments')
        .select('*, user:profiles(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[Admin] Error fetching pending payments:', error)
        return []
    }

    return (data || []).map((p: any) => ({
        ...p,
        user: p.user
    }))
}

// ──────────────────────────────────────────────────────────────────────────
// Агрегация платежей по месяцам для CRM-графика
// ──────────────────────────────────────────────────────────────────────────

export interface MonthlyPaymentStat {
    month: string        // 'YYYY-MM'
    label: string        // 'Янв 2026'
    revenue: number      // сумма confirmed
    count: number        // кол-во confirmed
    refunded: number     // сумма refunded
    refundCount: number  // кол-во refunded
    new_clients: number  // уникальных клиентов с первым платежом в этом месяце
}

export async function getPaymentsByMonth(monthsBack: number = 12): Promise<MonthlyPaymentStat[]> {
    const supabase = createClient()

    const since = new Date()
    since.setMonth(since.getMonth() - monthsBack + 1)
    since.setDate(1)
    since.setHours(0, 0, 0, 0)

    let data: any[] | null = null
    let allFirstPayments: any[] | null = null
    try {
        const r1 = await withTimeout<{ data: any[] | null; error: any }>(
            supabase
                .from('payments')
                .select('id, user_id, amount, status, created_at, confirmed_at')
                .in('status', ['confirmed', 'refunded'])
                .gte('created_at', since.toISOString())
                .order('created_at', { ascending: true }),
            'getPaymentsByMonth:list',
            8_000,
        )
        if (r1.error || !r1.data) return []
        data = r1.data

        const r2 = await withTimeout<{ data: any[] | null }>(
            supabase
                .from('payments')
                .select('user_id, created_at')
                .eq('status', 'confirmed')
                .order('created_at', { ascending: true }),
            'getPaymentsByMonth:firsts',
            6_000,
        ).catch(() => ({ data: [] }))
        allFirstPayments = r2.data || []
    } catch (e) {
        console.error('[Admin] getPaymentsByMonth timeout/network:', e)
        return []
    }

    // Строим карту: user_id → первый месяц оплаты
    const firstPaymentMonth = new Map<string, string>()
    ;(allFirstPayments || []).forEach((p: any) => {
        if (!firstPaymentMonth.has(p.user_id)) {
            const d = new Date(p.created_at)
            firstPaymentMonth.set(p.user_id, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
    })

    // Генерируем все месяцы в диапазоне
    const months: string[] = []
    const cur = new Date(since)
    const now = new Date()
    while (cur <= now) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
        cur.setMonth(cur.getMonth() + 1)
    }

    const RU_MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

    const statsMap = new Map<string, MonthlyPaymentStat>()
    months.forEach(m => {
        const [y, mo] = m.split('-')
        statsMap.set(m, {
            month: m,
            label: `${RU_MONTHS[parseInt(mo) - 1]} ${y}`,
            revenue: 0,
            count: 0,
            refunded: 0,
            refundCount: 0,
            new_clients: 0,
        })
    })

    data.forEach((p: any) => {
        const d = new Date(p.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const stat = statsMap.get(key)
        if (!stat) return

        if (p.status === 'confirmed') {
            stat.revenue += Number(p.amount)
            stat.count += 1
            // Новый клиент — если этот месяц совпадает с его первым платежом
            if (firstPaymentMonth.get(p.user_id) === key) {
                stat.new_clients += 1
            }
        } else if (p.status === 'refunded') {
            stat.refunded += Number(p.amount)
            stat.refundCount += 1
        }
    })

    return months.map(m => statsMap.get(m)!)
}

// Get all payments
export async function getAllPayments(): Promise<AdminPayment[]> {
    const supabase = createClient()

    try {
        // Шаг 1: Получаем все платежи
        const { data: payments, error } = await withTimeout<{ data: any[] | null; error: any }>(
            supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false }),
            'getAllPayments:list',
            8_000,
        )

        if (error) {
            console.error('[Admin] Error fetching payments:', error)
            return []
        }

        if (!payments || payments.length === 0) return []

        // Шаг 2: Получаем профили отдельным запросом по user_id
        const userIds = [...new Set(payments.map((p: any) => p.user_id))]

        const { data: profiles, error: profilesError } = await withTimeout<{ data: any[] | null; error: any }>(
            supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds),
            'getAllPayments:profiles',
            6_000,
        )

        if (profilesError) {
            console.error('[Admin] Error fetching profiles for payments:', profilesError)
        }

        // Шаг 3: Объединяем payment + profile
        const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))

        return payments.map((p: any) => ({
            ...p,
            user: profilesMap.get(p.user_id) || null,
        }))
    } catch (e) {
        console.error('[Admin] getAllPayments timeout/network:', e)
        return []
    }
}


// Confirm a payment
export async function confirmPayment(paymentId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return { success: false, error: 'Не авторизован' }

    // Получаем информацию о платеже
    const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single()

    if (fetchError || !payment) {
        return { success: false, error: 'Платёж не найден' }
    }

    // Обновляем статус платежа
    const { error } = await supabase
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_by: user.id,
            confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId)

    if (error) {
        console.error('[Admin] Error confirming payment:', error)
        return { success: false, error: error.message }
    }

    // Обновляем подписку пользователя
    const subscriptionStartDate = payment.cohort_start
        ? new Date(payment.cohort_start)
        : new Date()
    const subscriptionEndDate = new Date(subscriptionStartDate)
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + (payment.plan_months || 1))

    await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_start_date: subscriptionStartDate.toISOString().split('T')[0],
            subscription_end_date: subscriptionEndDate.toISOString().split('T')[0],
            has_nutrition_plan: payment.includes_nutrition || false,
            programs_visible: true,
        })
        .eq('id', payment.user_id)

    return { success: true }
}

// Refund a payment
export async function refundPayment(paymentId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', paymentId)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

// Delete a payment
export async function deletePayment(paymentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { adminFetch } = await import('@/lib/api/admin-fetch')
        await adminFetch(`/api/admin/payments/${paymentId}`, { method: 'DELETE' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Ошибка удаления' }
    }
}

// Update payment (amount, date)
export async function updatePayment(paymentId: string, data: { amount?: number; created_at?: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const { adminFetch } = await import('@/lib/api/admin-fetch')
        await adminFetch(`/api/admin/payments/${paymentId}`, {
            method: 'PATCH',
            json: data,
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Ошибка обновления' }
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Ручное продление подписки клиента (для админа)
// ──────────────────────────────────────────────────────────────────────────

export async function renewClientSubscription(params: {
    userId: string
    planMonths: number
    planType: '1_month' | '3_months' | '6_months'
    includesNutrition: boolean
    amount: number
}): Promise<{ success: boolean; newEndDate?: string; error?: string }> {
    try {
        const { adminFetch } = await import('@/lib/api/admin-fetch')
        const { newEndDate } = await adminFetch<{ ok: true; newEndDate: string }>(
            `/api/admin/users/${params.userId}/renew`,
            {
                method: 'POST',
                json: {
                    planMonths: params.planMonths,
                    planType: params.planType,
                    includesNutrition: params.includesNutrition,
                    amount: params.amount,
                },
            },
        )
        return { success: true, newEndDate }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Ошибка продления' }
    }
}

// Update subscription dates manually (admin)
export async function updateSubscriptionDates(params: {
    userId: string
    subscriptionStartDate: string
    subscriptionEndDate: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { adminFetch } = await import('@/lib/api/admin-fetch')
        await adminFetch<{ ok: true; subscription_start_date: string; subscription_end_date: string }>(
            `/api/admin/users/${params.userId}/update-dates`,
            {
                method: 'POST',
                json: {
                    subscription_start_date: params.subscriptionStartDate,
                    subscription_end_date: params.subscriptionEndDate,
                },
            },
        )
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e?.message || 'Ошибка обновления дат' }
    }
}

/**
 * Ручное подключение питания клиенту (без оплаты)
 */
export async function enableNutritionForClient(
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase
        .from('profiles')
        .update({ has_nutrition_plan: true })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}
