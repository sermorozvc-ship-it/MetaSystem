'use client'

import { useState } from 'react'
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, BarChart2, Users, RefreshCw } from 'lucide-react'
import type { MonthlyPaymentStat } from '@/lib/services/admin'

interface PaymentsChartProps {
    data: MonthlyPaymentStat[]
}

type ChartMode = 'revenue' | 'count' | 'clients'

const MODE_CONFIG: Record<ChartMode, { label: string; icon: React.ElementType; color: string; key: keyof MonthlyPaymentStat }> = {
    revenue:  { label: 'Выручка',       icon: TrendingUp, color: '#ADFF2F', key: 'revenue' },
    count:    { label: 'Платежи',        icon: BarChart2,  color: '#60a5fa', key: 'count' },
    clients:  { label: 'Новые клиенты', icon: Users,      color: '#a78bfa', key: 'new_clients' },
}

// Форматирование подписи оси Y
function formatYAxis(value: number, mode: ChartMode) {
    if (mode === 'revenue') {
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}М`
        if (value >= 1_000) return `${(value / 1_000).toFixed(0)}К`
        return String(value)
    }
    return String(value)
}

// Кастомный тултип
function CustomTooltip({ active, payload, label, mode }: any) {
    if (!active || !payload?.length) return null

    const stat: MonthlyPaymentStat = payload[0]?.payload
    const cfg = MODE_CONFIG[mode as ChartMode]

    return (
        <div className="bg-bg-card border border-white/10 rounded-xl p-4 shadow-xl min-w-[180px]">
            <p className="text-white font-semibold mb-3">{label}</p>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Выручка</span>
                    <span className="text-accent font-bold">
                        {stat.revenue.toLocaleString('ru-RU')} ₽
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Платежей</span>
                    <span className="text-blue-400 font-semibold">{stat.count}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Новых клиентов</span>
                    <span className="text-violet-400 font-semibold">{stat.new_clients}</span>
                </div>
                {stat.refundCount > 0 && (
                    <div className="flex justify-between gap-4 pt-1 border-t border-white/10">
                        <span className="text-text-muted">Возвраты</span>
                        <span className="text-danger font-semibold">
                            -{stat.refunded.toLocaleString('ru-RU')} ₽ ({stat.refundCount})
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function PaymentsChart({ data }: PaymentsChartProps) {
    const [mode, setMode] = useState<ChartMode>('revenue')
    const [chartType, setChartType] = useState<'area' | 'bar'>('area')

    const cfg = MODE_CONFIG[mode]

    // Итоги за весь период
    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
    const totalCount   = data.reduce((s, d) => s + d.count, 0)
    const totalClients = data.reduce((s, d) => s + d.new_clients, 0)
    const totalRefunds = data.reduce((s, d) => s + d.refunded, 0)

    // Лучший месяц
    const bestMonth = data.reduce((best, d) => d.revenue > best.revenue ? d : best, data[0] ?? { revenue: 0, label: '—' })

    return (
        <div className="glass-card p-6 mb-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-display font-bold text-white">История оплат</h2>
                    <p className="text-xs text-text-muted mt-0.5">За последние {data.length} месяцев</p>
                </div>

                {/* Переключатели */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Тип графика */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setChartType('area')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                chartType === 'area' ? 'bg-white/15 text-white' : 'text-text-muted hover:text-white'
                            }`}
                        >
                            Линия
                        </button>
                        <button
                            onClick={() => setChartType('bar')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                chartType === 'bar' ? 'bg-white/15 text-white' : 'text-text-muted hover:text-white'
                            }`}
                        >
                            Столбцы
                        </button>
                    </div>

                    {/* Метрика */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {(Object.entries(MODE_CONFIG) as [ChartMode, typeof MODE_CONFIG[ChartMode]][]).map(([key, c]) => {
                            const Icon = c.icon
                            return (
                                <button
                                    key={key}
                                    onClick={() => setMode(key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        mode === key ? 'bg-white/15 text-white' : 'text-text-muted hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {c.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Мини-статистика */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Выручка за период</p>
                    <p className="text-lg font-display font-bold text-accent">
                        {totalRevenue.toLocaleString('ru-RU')} ₽
                    </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Платежей</p>
                    <p className="text-lg font-display font-bold text-blue-400">{totalCount}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Новых клиентов</p>
                    <p className="text-lg font-display font-bold text-violet-400">{totalClients}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Лучший месяц</p>
                    <p className="text-lg font-display font-bold text-white">{bestMonth?.label ?? '—'}</p>
                    {bestMonth && bestMonth.revenue > 0 && (
                        <p className="text-xs text-text-muted">{bestMonth.revenue.toLocaleString('ru-RU')} ₽</p>
                    )}
                </div>
            </div>

            {/* График */}
            {data.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-text-muted text-sm">
                    Нет данных за выбранный период
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    {chartType === 'area' ? (
                        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorRefund" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={v => formatYAxis(v, mode)}
                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                width={50}
                            />
                            <Tooltip content={<CustomTooltip mode={mode} />} />
                            <Area
                                type="monotone"
                                dataKey={cfg.key as string}
                                stroke={cfg.color}
                                strokeWidth={2.5}
                                fill="url(#colorMain)"
                                dot={{ fill: cfg.color, r: 3, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                            {mode === 'revenue' && (
                                <Area
                                    type="monotone"
                                    dataKey="refunded"
                                    stroke="#ef4444"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 3"
                                    fill="url(#colorRefund)"
                                    dot={false}
                                />
                            )}
                        </AreaChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={v => formatYAxis(v, mode)}
                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                width={50}
                            />
                            <Tooltip
                                content={<CustomTooltip mode={mode} />}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar
                                dataKey={cfg.key as string}
                                fill={cfg.color}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={48}
                                fillOpacity={0.85}
                            />
                            {mode === 'revenue' && (
                                <Bar
                                    dataKey="refunded"
                                    fill="#ef4444"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={48}
                                    fillOpacity={0.6}
                                />
                            )}
                        </BarChart>
                    )}
                </ResponsiveContainer>
            )}

            {/* Легенда для режима выручки */}
            {mode === 'revenue' && (
                <div className="flex items-center gap-4 mt-3 justify-end">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
                        Выручка
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="w-3 h-0.5 rounded-full inline-block bg-red-500" />
                        Возвраты
                    </div>
                </div>
            )}
        </div>
    )
}
