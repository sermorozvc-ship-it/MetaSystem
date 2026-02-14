'use client'

import { useState } from 'react'
import { X, Ruler, Save, TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface BodyMeasurementsProps {
    isOpen: boolean
    onClose: () => void
    onSave?: (data: MeasurementData) => void
    previousMeasurement?: MeasurementData | null
}

export interface MeasurementData {
    date: string
    height: number
    waist: number
    hips: number
    weight: number
    notes?: string
}

export default function BodyMeasurements({
    isOpen,
    onClose,
    onSave,
    previousMeasurement
}: BodyMeasurementsProps) {
    const [height, setHeight] = useState(previousMeasurement?.height?.toString() || '')
    const [waist, setWaist] = useState('')
    const [hips, setHips] = useState('')
    const [weight, setWeight] = useState('')
    const [notes, setNotes] = useState('')

    const handleSave = () => {
        const data: MeasurementData = {
            date: new Date().toISOString(),
            height: parseFloat(height) || 0,
            waist: parseFloat(waist) || 0,
            hips: parseFloat(hips) || 0,
            weight: parseFloat(weight) || 0,
            notes: notes || undefined
        }
        onSave?.(data)
        onClose()
    }

    const getDiff = (current: string, previous: number | undefined) => {
        if (!previous || !current) return null
        const diff = parseFloat(current) - previous
        if (Math.abs(diff) < 0.1) return { value: 0, type: 'same' }
        return { value: diff, type: diff > 0 ? 'up' : 'down' }
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content max-w-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Ruler className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Измерения тела</h2>
                            <p className="text-sm text-gray-400">
                                {new Date().toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </p>
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

                {/* Form */}
                <div className="space-y-4 mb-6">
                    {/* Height */}
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

                    {/* Weight with diff */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Вес (кг)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                placeholder="75.5"
                                step="0.1"
                                className="glass-input w-full pr-16"
                            />
                            {previousMeasurement?.weight && weight && (
                                <DiffBadge diff={getDiff(weight, previousMeasurement.weight)} />
                            )}
                        </div>
                    </div>

                    {/* Waist with diff */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Обхват талии (см)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={waist}
                                onChange={(e) => setWaist(e.target.value)}
                                placeholder="85"
                                className="glass-input w-full pr-16"
                            />
                            {previousMeasurement?.waist && waist && (
                                <DiffBadge diff={getDiff(waist, previousMeasurement.waist)} />
                            )}
                        </div>
                    </div>

                    {/* Hips with diff */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Обхват бёдер (см)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={hips}
                                onChange={(e) => setHips(e.target.value)}
                                placeholder="100"
                                className="glass-input w-full pr-16"
                            />
                            {previousMeasurement?.hips && hips && (
                                <DiffBadge diff={getDiff(hips, previousMeasurement.hips)} />
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Заметки (опционально)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Как вы себя чувствуете?"
                            rows={3}
                            className="glass-input w-full resize-none"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={!weight && !waist && !hips}
                    className="glass-button w-full flex items-center justify-center gap-2 
                     disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="w-4 h-4" />
                    Сохранить измерения
                </button>
            </div>
        </div>
    )
}

// Diff Badge Component
function DiffBadge({ diff }: { diff: { value: number; type: string } | null }) {
    if (!diff) return null

    const { value, type } = diff

    if (type === 'same') {
        return (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
                <Minus className="w-3 h-3" />
                <span className="text-xs">0</span>
            </div>
        )
    }

    const isDown = type === 'down'
    const colorClass = isDown ? 'text-green-400' : 'text-red-400'
    const Icon = isDown ? TrendingDown : TrendingUp

    return (
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 ${colorClass}`}>
            <Icon className="w-3 h-3" />
            <span className="text-xs font-medium">
                {isDown ? '' : '+'}{value.toFixed(1)}
            </span>
        </div>
    )
}
