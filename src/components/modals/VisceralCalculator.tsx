'use client'

import { useState } from 'react'
import { X, Calculator, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

interface VisceralCalculatorProps {
    isOpen: boolean
    onClose: () => void
    onSave?: (data: CalculatorResult) => void
}

interface CalculatorResult {
    height: number
    waist: number
    hips: number
    gender: 'male' | 'female'
    whr: number
    whtr: number
    riskLevel: 'low' | 'moderate' | 'high'
}

type Gender = 'male' | 'female'

export default function VisceralCalculator({ isOpen, onClose, onSave }: VisceralCalculatorProps) {
    const [gender, setGender] = useState<Gender>('male')
    const [height, setHeight] = useState('')
    const [waist, setWaist] = useState('')
    const [hips, setHips] = useState('')
    const [result, setResult] = useState<CalculatorResult | null>(null)

    const calculateRisk = () => {
        const h = parseFloat(height)
        const w = parseFloat(waist)
        const hp = parseFloat(hips)

        if (!h || !w || !hp) return

        // WHR (Waist-to-Hip Ratio)
        const whr = w / hp

        // WHtR (Waist-to-Height Ratio)
        const whtr = w / h

        // Определение уровня риска
        let riskLevel: 'low' | 'moderate' | 'high' = 'low'

        if (gender === 'male') {
            if (whr > 0.95 || whtr > 0.57) {
                riskLevel = 'high'
            } else if (whr > 0.90 || whtr > 0.53) {
                riskLevel = 'moderate'
            }
        } else {
            if (whr > 0.85 || whtr > 0.53) {
                riskLevel = 'high'
            } else if (whr > 0.80 || whtr > 0.49) {
                riskLevel = 'moderate'
            }
        }

        const calculatorResult: CalculatorResult = {
            height: h,
            waist: w,
            hips: hp,
            gender,
            whr: Math.round(whr * 100) / 100,
            whtr: Math.round(whtr * 100) / 100,
            riskLevel
        }

        setResult(calculatorResult)
    }

    const handleSave = () => {
        if (result) {
            onSave?.(result)
            onClose()
        }
    }

    const resetForm = () => {
        setHeight('')
        setWaist('')
        setHips('')
        setResult(null)
    }

    if (!isOpen) return null

    const getRiskConfig = (level: 'low' | 'moderate' | 'high') => {
        switch (level) {
            case 'low':
                return {
                    icon: CheckCircle,
                    color: 'text-green-400',
                    bg: 'bg-green-500/20',
                    border: 'border-green-500/30',
                    title: 'Низкий риск',
                    description: 'Отличные показатели! Продолжайте поддерживать здоровый образ жизни.'
                }
            case 'moderate':
                return {
                    icon: AlertCircle,
                    color: 'text-yellow-400',
                    bg: 'bg-yellow-500/20',
                    border: 'border-yellow-500/30',
                    title: 'Умеренный риск',
                    description: 'Рекомендуется обратить внимание на питание и увеличить физическую активность.'
                }
            case 'high':
                return {
                    icon: AlertTriangle,
                    color: 'text-red-400',
                    bg: 'bg-red-500/20',
                    border: 'border-red-500/30',
                    title: 'Высокий риск',
                    description: 'Висцеральный жир превышает норму. Рекомендуется консультация специалиста.'
                }
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content max-w-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-meta-orange/20 flex items-center justify-center">
                            <Calculator className="w-5 h-5 text-meta-orange" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Калькулятор висцерального жира</h2>
                            <p className="text-sm text-gray-400">Оценка риска для здоровья</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-deep-dark-200 flex items-center justify-center
                       text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {!result ? (
                    <>
                        {/* Gender Selection */}
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Пол</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setGender('male')}
                                    className={`py-3 px-4 rounded-xl border transition-all duration-200 ${gender === 'male'
                                            ? 'bg-meta-orange/20 border-meta-orange text-white'
                                            : 'bg-deep-dark-200/60 border-white/10 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    Мужской
                                </button>
                                <button
                                    onClick={() => setGender('female')}
                                    className={`py-3 px-4 rounded-xl border transition-all duration-200 ${gender === 'female'
                                            ? 'bg-meta-orange/20 border-meta-orange text-white'
                                            : 'bg-deep-dark-200/60 border-white/10 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    Женский
                                </button>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Рост (см)
                                </label>
                                <input
                                    type="number"
                                    value={height}
                                    onChange={(e) => setHeight(e.target.value)}
                                    placeholder="175"
                                    className="glass-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Обхват талии (см)
                                </label>
                                <input
                                    type="number"
                                    value={waist}
                                    onChange={(e) => setWaist(e.target.value)}
                                    placeholder="85"
                                    className="glass-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Обхват бёдер (см)
                                </label>
                                <input
                                    type="number"
                                    value={hips}
                                    onChange={(e) => setHips(e.target.value)}
                                    placeholder="100"
                                    className="glass-input w-full"
                                />
                            </div>
                        </div>

                        {/* Calculate Button */}
                        <button
                            onClick={calculateRisk}
                            disabled={!height || !waist || !hips}
                            className="glass-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Рассчитать риск
                        </button>
                    </>
                ) : (
                    <>
                        {/* Results */}
                        <div className="space-y-4">
                            {/* Risk Level Card */}
                            {(() => {
                                const config = getRiskConfig(result.riskLevel)
                                const Icon = config.icon
                                return (
                                    <div className={`p-5 rounded-2xl ${config.bg} border ${config.border}`}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <Icon className={`w-6 h-6 ${config.color}`} />
                                            <span className={`text-lg font-bold ${config.color}`}>
                                                {config.title}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-300">
                                            {config.description}
                                        </p>
                                    </div>
                                )
                            })()}

                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="glass-card p-4 bg-deep-dark-200/40">
                                    <p className="text-xs text-gray-400 mb-1">WHR (талия/бёдра)</p>
                                    <p className="text-2xl font-bold text-white">{result.whr}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Норма: {result.gender === 'male' ? '< 0.90' : '< 0.80'}
                                    </p>
                                </div>
                                <div className="glass-card p-4 bg-deep-dark-200/40">
                                    <p className="text-xs text-gray-400 mb-1">WHtR (талия/рост)</p>
                                    <p className="text-2xl font-bold text-white">{result.whtr}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Норма: {result.gender === 'male' ? '< 0.53' : '< 0.49'}
                                    </p>
                                </div>
                            </div>

                            {/* Visual Meter */}
                            <div className="mt-4">
                                <p className="text-sm text-gray-400 mb-2">Шкала риска</p>
                                <div className="h-4 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 relative overflow-hidden">
                                    <div
                                        className="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500"
                                        style={{
                                            left: `${result.riskLevel === 'low' ? 15 : result.riskLevel === 'moderate' ? 50 : 85}%`
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Низкий</span>
                                    <span>Умеренный</span>
                                    <span>Высокий</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={resetForm}
                                className="glass-button-secondary flex-1"
                            >
                                Пересчитать
                            </button>
                            <button
                                onClick={handleSave}
                                className="glass-button flex-1"
                            >
                                Сохранить
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
