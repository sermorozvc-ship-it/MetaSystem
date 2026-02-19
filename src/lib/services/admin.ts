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
export async function isAdmin(): Promise<boolean> {
    const supabase = createClient()
    const user = await safeGetUser()

    if (!user) return true // Allow access in demo mode

    // 🚨 EMERGENCY ACCESS override for owners
    if (user.email === 'hunternik005@gmail.com' || user.email === 'dgmukhin@gmail.com') {
        console.log('Emergency admin access granted for owner')
        return true
    }

    try {
        // Try secure RPC function first (bypasses RLS)
        const { data: isRpcAdmin, error: rpcError } = await supabase.rpc('is_admin')
        if (!rpcError && isRpcAdmin === true) {
            return true
        }
    } catch (e) {
        console.warn('RPC admin check failed, falling back to table query')
    }

    // Fallback to table query
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return profile?.role === 'admin' || profile?.role === 'curator'
}

// Helper function to check if error is AbortError
function isAbortError(error: any): boolean {
    return error?.name === 'AbortError' ||
        error?.message?.includes('abort') ||
        error?.message?.includes('AbortError')
}

// Get all users with progress stats (Optimized)
export async function getAllUsers(): Promise<UserWithProgress[]> {
    const supabase = createClient()
    const user = await safeGetUser()
    console.log('[Admin] Current user for fetch:', user?.email || 'None')

    let profiles: any[] | null = null
    let allProgress: any[] | null = null
    let allReports: any[] | null = null
    let lastError: any = null

    // 1. Fetch all profiles using secure RPC to bypass RLS
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const result = await supabase.rpc('get_all_users_secure')

            if (result.error) {
                lastError = result.error
                if (isAbortError(result.error)) {
                    console.warn(`Profiles fetch aborted, attempt ${attempt + 1}/3`)
                    await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
                    continue
                }
                console.warn('[Admin] RPC error (fetching profiles):', result.error.message)

                // Fallback to table query if RPC fails (e.g. if it doesn't exist yet)
                const fallback = await supabase
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (fallback.error && !isAbortError(fallback.error)) {
                    console.error('[Admin] Fallback fetch failed:', fallback.error.message)
                    lastError = fallback.error
                    break
                }
                profiles = fallback.data
                break
            }
            profiles = result.data
            break
        } catch (e: any) {
            lastError = e
            if (isAbortError(e)) {
                console.warn(`Profiles fetch exception aborted, attempt ${attempt + 1}/3`)
                await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
                continue
            }
            console.error('[Admin] Exception fetching profiles:', e)
            break
        }
    }

    if (profiles === null) {
        console.error('[Admin] All profile fetch attempts failed. Last error:', lastError)
        throw new Error(`Ошибка загрузки: ${lastError?.message || 'Неизвестная ошибка базы данных'}`)
    }

    if (profiles.length === 0) {
        console.log('[Admin] No profiles found in DB')
        return []
    }

    // 2. Fetch all progress for stats (no retry needed, just catch AbortError)
    try {
        const result = await supabase
            .from('user_progress')
            .select('user_id, completed')
            .eq('completed', true)

        if (!result.error) {
            allProgress = result.data
        }
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching progress:', e)
    }

    // 3. Fetch all reports for stats
    try {
        const result = await supabase
            .from('day_reports')
            .select('user_id, created_at')
            .order('created_at', { ascending: false })

        if (!result.error) {
            allReports = result.data
        }
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching reports:', e)
    }

    // Aggregate data
    const progressMap = new Map<string, number>()
    allProgress?.forEach((p: any) => {
        // Here row count = tasks count. If we want days, we would need to check unique day_numbers.
        // For now, let's keep it as total tasks completed.
        progressMap.set(p.user_id, (progressMap.get(p.user_id) || 0) + 1)
    })

    const reportsMap = new Map<string, { count: number, last: string | null }>()
    allReports?.forEach((r: any) => {
        const stats = reportsMap.get(r.user_id) || { count: 0, last: null }
        if (!stats.last) stats.last = r.created_at
        stats.count++
        reportsMap.set(r.user_id, stats)
    })

    // Combine results
    const usersWithProgress = profiles.map((profile: any) => {
        const reportStats = reportsMap.get(profile.id)
        return {
            ...profile,
            completed_days: progressMap.get(profile.id) || 0, // This is actually tasks count
            total_reports: reportStats?.count || 0,
            last_activity: reportStats?.last || profile.created_at
        }
    })

    console.log(`Fetched ${usersWithProgress.length} users successfully`)
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

// Get admin stats
export async function getAdminStats(): Promise<{
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    pendingReports: number
    completedToday: number
}> {
    const supabase = createClient()

    // Всегда загружаем реальную статистику
    let totalUsers = 0
    let activeUsers = 0
    let blockedUsers = 0
    let pendingReports = 0
    let completedToday = 0

    try {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
        totalUsers = count || 0
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching totalUsers:', e)
    }

    try {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', false)
        activeUsers = count || 0
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching activeUsers:', e)
    }

    try {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_blocked', true)
        blockedUsers = count || 0
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching blockedUsers:', e)
    }

    try {
        const { count } = await supabase.from('day_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending')
        pendingReports = count || 0
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching pendingReports:', e)
    }

    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { count } = await supabase
            .from('user_progress')
            .select('*', { count: 'exact', head: true })
            .eq('completed', true)
            .gte('completed_at', today.toISOString())
        completedToday = count || 0
    } catch (e: any) {
        if (!isAbortError(e)) console.error('Error fetching completedToday:', e)
    }

    return {
        totalUsers,
        activeUsers,
        blockedUsers,
        pendingReports,
        completedToday
    }
}
