import { createClient, safeGetUser } from '@/lib/supabase/client'

export interface UserProfile {
    id: string
    email: string
    full_name: string | null
    role: 'user' | 'admin' | 'curator'
    is_blocked: boolean
    blocked_at: string | null
    blocked_reason: string | null
    created_at: string
    cohort_start_date: string | null
}

export interface UserWithProgress extends UserProfile {
    completed_days: number
    total_reports: number
    last_activity: string | null
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

    // 2. Параллельная загрузка прогресса и отчётов
    let allProgress: any[] = []
    let allReports: any[] = []

    try {
        const progressResult = await supabase.from('user_progress').select('user_id, completed').eq('completed', true)
        const reportsResult = await supabase.from('day_reports').select('user_id, created_at').order('created_at', { ascending: false })

        allProgress = progressResult.data || []
        allReports = reportsResult.data || []
    } catch (e) {
        console.warn('[Admin] Progress/reports fetch failed:', e)
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

    const usersWithProgress = profiles.map((profile: any) => {
        const reportStats = reportsMap.get(profile.id)
        return {
            ...profile,
            completed_days: progressMap.get(profile.id) || 0,
            total_reports: reportStats?.count || 0,
            last_activity: reportStats?.last || profile.created_at
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

// Delete user
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    // First block the user
    const { error: blockError } = await supabase
        .from('profiles')
        .update({
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_reason: 'DELETED'
        })
        .eq('id', userId)

    if (blockError) {
        return { success: false, error: blockError.message }
    }

    return { success: true }
}

// Get admin stats — все запросы параллельно
export async function getAdminStats(): Promise<{
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    pendingReports: number
    completedToday: number
}> {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Параллельно выполняем все 5 запросов вместо последовательных await
    const [totalR, activeR, blockedR, pendingR, completedR] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', false),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
        supabase.from('day_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('completed', true).gte('completed_at', today.toISOString())
    ])

    return {
        totalUsers: totalR.count || 0,
        activeUsers: activeR.count || 0,
        blockedUsers: blockedR.count || 0,
        pendingReports: pendingR.count || 0,
        completedToday: completedR.count || 0,
    }
}
