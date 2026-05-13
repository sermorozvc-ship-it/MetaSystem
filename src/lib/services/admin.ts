import { createClient, safeGetUser } from '@/lib/supabase/client'

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

    // 1. Check Owner Emails (Hardcoded bypass — самый быстрый путь, без сетевых запросов)
    const owners = ['dgmukhin@gmail.com']
    if (owners.includes(user.email?.toLowerCase() || '')) {
        console.log('[isAdmin] Emergency admin access granted for owner:', user.email)
        return true
    }

    // 2. Check User Metadata в JWT токене (без запроса к БД)
    if (user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'curator') {
        console.log('[isAdmin] Access granted via token metadata')
        return true
    }

    // 3. Проверяем через RPC с таймаутом (SECURITY DEFINER — надёжно)
    const supabase = createClient()
    try {
        console.log('[isAdmin] Checking DB via RPC is_admin...')
        const rpcResult = await Promise.race([
            supabase.rpc('is_admin'),
            new Promise<{ data: null; error: { code: string; message: string } }>((resolve) =>
                setTimeout(() => resolve({ data: null, error: { code: 'TIMEOUT', message: 'RPC timeout 5s' } }), 5000)
            )
        ])

        const { data: isRpcAdmin, error: rpcError } = rpcResult

        if (!rpcError && isRpcAdmin === true) {
            console.log('[isAdmin] RPC check successful: IS ADMIN')
            return true
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
                setTimeout(() => resolve({ data: null, error: { message: 'Profile query timeout 5s' } }), 5000)
            )
        ])

        const { data: profile, error: profileError } = profileResult

        if (profileError) {
            console.error('[isAdmin] Profile query failed:', profileError.message)
            return false
        }

        const hasAccess = profile?.role === 'admin' || profile?.role === 'curator'
        console.log('[isAdmin] Profile role check result:', profile?.role, '-> Access:', hasAccess)
        return hasAccess
    } catch (e: any) {
        console.error('[isAdmin] Profile query exception:', e.message)
        return false
    }
}

// Get all users with progress stats
export async function getAllUsers(): Promise<UserWithProgress[]> {
    const supabase = createClient()
    console.log('[Admin] Fetching all users...')

    let profiles: any[] | null = null

    // 1. Попробовать RPC, если не сработает — прямой запрос к profiles
    try {
        const { data, error } = await supabase.rpc('get_all_users_secure')
        if (!error && data) {
            profiles = data
        } else {
            console.warn('[Admin] RPC failed, trying direct query:', error?.message)
            const fallback = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (fallback.error) {
                throw new Error(fallback.error.message)
            }
            profiles = fallback.data
        }
    } catch (e: any) {
        console.error('[Admin] Exception fetching profiles:', e)
        throw new Error(`Ошибка загрузки: ${e.message}`)
    }

    if (!profiles || profiles.length === 0) {
        return []
    }

    // 2. Параллельная загрузка прогресса, отчётов и платежей
    let allProgress: any[] = []
    let allReports: any[] = []
    let allPayments: any[] = []

    try {
        const [progressResult, reportsResult, paymentsResult] = await Promise.all([
            supabase.from('user_progress').select('user_id, completed').eq('completed', true),
            supabase.from('day_reports').select('user_id, created_at').order('created_at', { ascending: false }),
            supabase.from('payments').select('user_id, status, plan_type, created_at').order('created_at', { ascending: false })
        ])

        allProgress = progressResult.data || []
        allReports = reportsResult.data || []
        allPayments = paymentsResult.data || []
    } catch (e) {
        console.warn('[Admin] Progress/reports/payments fetch failed:', e)
    }

    // Aggregate
    const progressMap = new Map<string, number>()
    allProgress.forEach((p: any) => {
        progressMap.set(p.user_id, (progressMap.get(p.user_id) || 0) + 1)
    })

    const reportsMap = new Map<string, { count: number, last: string | null }>()
    allReports.forEach((r: any) => {
        const stats = reportsMap.get(r.user_id) || { count: 0, last: null }
        if (!stats.last) stats.last = r.created_at
        stats.count++
        reportsMap.set(r.user_id, stats)
    })

    // Берём последний (свежий) платёж каждого пользователя
    const paymentsMap = new Map<string, { status: string, plan_type: string | null, created_at: string }>()
    allPayments.forEach((p: any) => {
        if (!paymentsMap.has(p.user_id)) {
            paymentsMap.set(p.user_id, {
                status: p.status,
                plan_type: p.plan_type,
                created_at: p.created_at
            })
        }
    })

    const usersWithProgress = profiles.map((profile: any) => {
        const reportStats = reportsMap.get(profile.id)
        const paymentInfo = paymentsMap.get(profile.id)
        return {
            ...profile,
            completed_days: progressMap.get(profile.id) || 0,
            total_reports: reportStats?.count || 0,
            last_activity: reportStats?.last || profile.created_at,
            payment_status: paymentInfo?.status || 'none',
            payment_created_at: paymentInfo?.created_at || null,
            plan_type: paymentInfo?.plan_type || null
        }
    })

    console.log(`[Admin] Fetched ${usersWithProgress.length} users`)
    return usersWithProgress
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
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { success: false, error: 'Не авторизован' }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    // Service role key — используется только в admin-контексте, как и в других местах проекта
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA'

    const { createClient: createDirectClient } = await import('@supabase/supabase-js')
    const db = createDirectClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // 1. Create auth user (email confirmed — no verification needed)
    const { data: newUser, error: createError } = await db.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: { full_name: params.full_name },
    })

    if (createError || !newUser.user) {
        return { success: false, error: createError?.message || 'Ошибка создания пользователя' }
    }

    const userId = newUser.user.id

    // 2. Upsert profile
    const { error: profileError } = await db.from('profiles').upsert({
        id: userId,
        email: params.email,
        full_name: params.full_name,
        role: 'user',
        is_blocked: false,
        subscription_status: 'active',
        subscription_end_date: params.subscription_end,
        has_nutrition_plan: params.includes_nutrition,
        questionnaire_completed: false,
    })

    if (profileError) {
        return { success: false, error: 'Профиль: ' + profileError.message }
    }

    // 3. Create confirmed payment
    if (params.amount > 0) {
        const { error: paymentError } = await db.from('payments').insert({
            user_id: userId,
            amount: params.amount,
            currency: 'RUB',
            status: 'confirmed',
            payment_method: 'manual',
            plan_months: params.plan_months,
            includes_nutrition: params.includes_nutrition,
            confirmed_by: session.user.id,
            confirmed_at: new Date().toISOString(),
            cohort_start: params.subscription_start,
            base_amount: params.amount,
            nutrition_amount: params.includes_nutrition ? 3000 : 0,
            renewal_type: 'initial',
        })

        if (paymentError) {
            return { success: false, error: 'Платёж: ' + paymentError.message }
        }
    }

    return { success: true, userId }
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

// Delete user permanently — uses service role key directly (same pattern as rest of admin code)
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA'

    try {
        const { createClient: createDirectClient } = await import('@supabase/supabase-js')
        const db = createDirectClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

        // Delete all user data explicitly (most have CASCADE but be explicit)
        const tables: Array<{ table: string; col: string }> = [
            { table: 'training_entries', col: 'user_id' },
            { table: 'training_programs', col: 'user_id' },
            { table: 'client_metrics', col: 'user_id' },
            { table: 'client_questionnaires', col: 'user_id' },
            { table: 'payments', col: 'user_id' },
            { table: 'notifications', col: 'user_id' },
            { table: 'journal_entries', col: 'user_id' },
            { table: 'user_progress', col: 'user_id' },
            { table: 'body_measurements', col: 'user_id' },
            { table: 'day_reports', col: 'user_id' },
        ]

        for (const { table, col } of tables) {
            await db.from(table).delete().eq(col, userId)
        }
        // Messages: delete both sent and received
        await db.from('admin_messages').delete().eq('to_user_id', userId)
        await db.from('admin_messages').delete().eq('from_user_id', userId)

        // Delete profile
        await db.from('profiles').delete().eq('id', userId)

        // Delete from auth.users
        const { error: authError } = await db.auth.admin.deleteUser(userId)
        if (authError) {
            return { success: false, error: 'Auth delete failed: ' + authError.message }
        }

        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || 'Ошибка удаления' }
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

    // Параллельно выполняем все запросы
    const [totalR, activeR, blockedR, pendingR, completedR, pendingPayR, confirmedPayR] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', false),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
        supabase.from('day_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('completed', true).gte('completed_at', today.toISOString()),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
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

// Get all payments
export async function getAllPayments(): Promise<AdminPayment[]> {
    const supabase = createClient()

    // Шаг 1: Получаем все платежи
    const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[Admin] Error fetching payments:', error)
        return []
    }

    if (!payments || payments.length === 0) return []

    // Шаг 2: Получаем профили отдельным запросом по user_id
    const userIds = [...new Set(payments.map((p: any) => p.user_id))]

    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

    if (profilesError) {
        console.error('[Admin] Error fetching profiles for payments:', profilesError)
    }

    // Шаг 3: Объединяем payment + profile
    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    return payments.map((p: any) => ({
        ...p,
        user: profilesMap.get(p.user_id) || null
    }))
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
    const subscriptionEndDate = new Date()
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + (payment.plan_months || 1))

    await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_end_date: subscriptionEndDate.toISOString().split('T')[0],
            has_nutrition_plan: payment.includes_nutrition || false,
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
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eXlwb3l2aWhxaHJibGxnZmZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg3OTQ4MywiZXhwIjoyMDg1NDU1NDgzfQ.lD6aWFkbLLtO_5TVhzeKpUiw8VP-a_wsBpNrrRUvJSA'

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { success: false, error: 'Не авторизован' }

    const { createClient: createDirectClient } = await import('@supabase/supabase-js')
    const db = createDirectClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Получаем текущую дату окончания подписки
    const { data: profile } = await db
        .from('profiles')
        .select('subscription_end_date, has_nutrition_plan')
        .eq('id', params.userId)
        .single()

    const currentEnd = profile?.subscription_end_date
    let newStart: Date
    let newEnd: Date

    if (currentEnd) {
        const endDate = new Date(currentEnd)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        newStart = endDate >= today
            ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
            : today
    } else {
        newStart = new Date()
    }

    newEnd = new Date(newStart)
    newEnd.setMonth(newEnd.getMonth() + params.planMonths)
    newEnd.setDate(newEnd.getDate() - 1)

    const newEndStr = newEnd.toISOString().split('T')[0]

    // Создаём платёж
    const { data: payment, error: paymentError } = await db
        .from('payments')
        .insert({
            user_id: params.userId,
            amount: params.amount,
            currency: 'RUB',
            status: 'confirmed',
            payment_method: 'manual',
            plan_type: params.planType,
            plan_months: params.planMonths,
            includes_nutrition: params.includesNutrition,
            base_amount: params.amount,
            nutrition_amount: params.includesNutrition ? 3000 : 0,
            confirmed_by: session.user.id,
            confirmed_at: new Date().toISOString(),
            renewal_type: 'renewal',
        })
        .select('id')
        .single()

    if (paymentError || !payment) {
        return { success: false, error: 'Ошибка создания платежа: ' + paymentError?.message }
    }

    // Создаём запись о продлении
    await db.from('subscription_renewals').insert({
        user_id: params.userId,
        previous_end_date: currentEnd ?? null,
        previous_had_nutrition: profile?.has_nutrition_plan ?? false,
        new_plan_type: params.planType,
        new_plan_months: params.planMonths,
        includes_nutrition: params.includesNutrition,
        payment_id: payment.id,
        amount: params.amount,
        renewal_type: 'renewal',
        status: 'confirmed',
        new_start_date: newStart.toISOString().split('T')[0],
        new_end_date: newEndStr,
    })

    // Обновляем профиль
    const { error: profileError } = await db
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_end_date: newEndStr,
            has_nutrition_plan: params.includesNutrition ? true : (profile?.has_nutrition_plan ?? false),
            renewal_pending: false,
        })
        .eq('id', params.userId)

    if (profileError) {
        return { success: false, error: 'Ошибка обновления профиля: ' + profileError.message }
    }

    return { success: true, newEndDate: newEndStr }
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
