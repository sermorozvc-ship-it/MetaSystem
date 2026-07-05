// Серверная загрузка списка пользователей для админки.
// Обходит браузерный inTabLock и таймауты клиентского Supabase RPC.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserWithProgress } from '@/lib/services/admin'

export async function fetchAllUsersForAdmin(service: SupabaseClient): Promise<UserWithProgress[]> {
    let profiles: any[] | null = null

    const { data: rpcData, error: rpcError } = await service.rpc('get_all_users_secure')
    if (!rpcError && rpcData) {
        profiles = rpcData
    } else {
        console.warn('[admin-users] RPC failed, direct query:', rpcError?.message)
        const { data, error } = await service
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        profiles = data
    }

    if (!profiles || profiles.length === 0) return []

    const [progressRes, reportsRes, paymentsRes] = await Promise.all([
        service.from('user_progress').select('user_id, completed').eq('completed', true),
        service.from('day_reports').select('user_id, created_at').order('created_at', { ascending: false }),
        service.from('payments').select('user_id, status, plan_type, created_at').order('created_at', { ascending: false }),
    ])

    const allProgress = progressRes.data || []
    const allReports = reportsRes.data || []
    const allPayments = paymentsRes.data || []

    const progressMap = new Map<string, number>()
    allProgress.forEach((p: any) => {
        progressMap.set(p.user_id, (progressMap.get(p.user_id) || 0) + 1)
    })

    const reportsMap = new Map<string, { count: number; last: string | null }>()
    allReports.forEach((r: any) => {
        const stats = reportsMap.get(r.user_id) || { count: 0, last: null }
        if (!stats.last) stats.last = r.created_at
        stats.count++
        reportsMap.set(r.user_id, stats)
    })

    const paymentsMap = new Map<string, { status: string; plan_type: string | null; created_at: string }>()
    allPayments.forEach((p: any) => {
        if (!paymentsMap.has(p.user_id)) {
            paymentsMap.set(p.user_id, {
                status: p.status,
                plan_type: p.plan_type,
                created_at: p.created_at,
            })
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