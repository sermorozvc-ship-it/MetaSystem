'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAdmin } from '@/lib/services/admin'
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react'

export default function DiagnosePage() {
    const [status, setStatus] = useState<any>({
        auth: { status: 'pending', user: null },
        adminCheck: { status: 'pending', result: null },
        dbProfiles: { status: 'pending', count: 0 },
        dbRPCs: { status: 'pending', get_all_users_secure: null, is_admin: null }
    })
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    const runDiagnostics = async () => {
        setLoading(true)
        const newStatus = { ...status }

        try {
            // 1. Auth Check
            const { data: { session } } = await supabase.auth.getSession()
            newStatus.auth = {
                status: session ? 'success' : 'error',
                user: session?.user ? { id: session.user.id, email: session.user.email } : null
            }

            // 2. Admin Service Check
            const adminResult = await isAdmin()
            newStatus.adminCheck = { status: 'success', result: adminResult }

            // 3. Profiles Table Check
            const { data: profiles, error: pError, count } = await supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .limit(5)

            newStatus.dbProfiles = {
                status: pError ? 'error' : 'success',
                count: count || 0,
                error: pError?.message,
                data: profiles
            }

            // 4. RPC Checks
            console.log('Testing RPCs...')
            let is_admin_msg = 'Pending...'
            let get_all_users_msg = 'Pending...'

            try {
                const { data: r1, error: e1 } = await supabase.rpc('is_admin')
                is_admin_msg = e1 ? `Failed: ${e1.message}` : `Success: ${r1}`
            } catch (e: any) {
                is_admin_msg = `Crash: ${e.message}`
            }

            try {
                const { error: e2 } = await supabase.rpc('get_all_users_secure').limit(1)
                get_all_users_msg = e2 ? `Failed: ${e2.message}` : 'Success (Checked)'
            } catch (e: any) {
                get_all_users_msg = `Crash: ${e.message}`
            }

            newStatus.dbRPCs = {
                status: 'done',
                is_admin: is_admin_msg,
                get_all_users_secure: get_all_users_msg
            }

        } catch (e: any) {
            console.error('Diagnostic crashed:', e)
        } finally {
            setStatus(newStatus)
            setLoading(false)
        }
    }

    useEffect(() => {
        runDiagnostics()
    }, [])

    const StatusIcon = ({ stat }: { stat: string }) => {
        if (stat === 'success') return <CheckCircle className="w-5 h-5 text-green-500" />
        if (stat === 'error') return <XCircle className="w-5 h-5 text-red-500" />
        if (stat === 'pending') return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    }

    return (
        <div className="min-h-screen bg-deep-dark text-white p-8">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Shield className="w-10 h-10 text-meta-orange" />
                    <div>
                        <h1 className="text-2xl font-bold">Диагностика системы</h1>
                        <p className="text-gray-400">Проверка прав и подключения к БД</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Auth Step */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-400" />
                                Авторизация
                            </h2>
                            <StatusIcon stat={status.auth.status} />
                        </div>
                        <div className="text-sm font-mono bg-black/30 p-4 rounded">
                            {status.auth.user ? (
                                <>
                                    <p>ID: {status.auth.user.id}</p>
                                    <p>Email: {status.auth.user.email}</p>
                                </>
                            ) : (
                                <p className="text-red-400">Пользователь не авторизован</p>
                            )}
                        </div>
                    </div>

                    {/* Admin Check */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold">Проверка прав (isAdmin)</h2>
                            <StatusIcon stat={status.adminCheck.status} />
                        </div>
                        <p className={`text-xl font-bold ${status.adminCheck.result ? 'text-green-400' : 'text-red-400'}`}>
                            {status.adminCheck.result === true ? 'ДОСТУП РАЗРЕШЕН' : 'ДОСТУП ЗАПРЕЩЕН'}
                        </p>
                    </div>

                    {/* Database Check */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold">База данных (Profiles)</h2>
                            <StatusIcon stat={status.dbProfiles.status} />
                        </div>
                        <div className="space-y-2">
                            <p>Записей в таблице: <span className="text-meta-orange font-bold">{status.dbProfiles.count}</span></p>
                            {status.dbProfiles.error && (
                                <p className="text-red-400 text-xs p-2 bg-red-400/10 rounded">Error: {status.dbProfiles.error}</p>
                            )}
                        </div>
                    </div>

                    {/* RPC Check */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold">Функции Supabase (RPC)</h2>
                            <StatusIcon stat={status.dbRPCs.status} />
                        </div>
                        <div className="text-xs font-mono space-y-2">
                            <div className="p-2 bg-black/20 rounded">
                                <p className="text-gray-500 mb-1">is_admin():</p>
                                <p className={status.dbRPCs.is_admin?.includes('Success') ? 'text-green-400' : 'text-yellow-500'}>
                                    {status.dbRPCs.is_admin || 'Wait...'}
                                </p>
                            </div>
                            <div className="p-2 bg-black/20 rounded">
                                <p className="text-gray-500 mb-1">get_all_users_secure():</p>
                                <p className={status.dbRPCs.get_all_users_secure?.includes('Success') ? 'text-green-400' : 'text-yellow-500'}>
                                    {status.dbRPCs.get_all_users_secure || 'Wait...'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={runDiagnostics}
                        disabled={loading}
                        className="glass-button w-full flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Запустить повторно
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => window.location.href = '/admin'}
                        className="text-gray-500 underline hover:text-white"
                    >
                        Вернуться к админ-панели
                    </button>
                </div>
            </div>
        </div>
    )
}
