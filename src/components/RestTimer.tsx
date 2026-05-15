'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, RotateCcw, Timer } from 'lucide-react'

const STEP = 30 // секунд за одно нажатие +

// Один короткий пронзительный бип (для обратного отсчёта 3-2-1)
function playCountdownBeep() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'square'          // square — резче и пронзительнее sine
        osc.frequency.value = 1200   // высокая частота — пронзительный звук
        gain.gain.setValueAtTime(0.9, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.12)
        setTimeout(() => ctx.close(), 500)
    } catch {}
}

// Тройной пронзительный бип — финал (таймер дошёл до 0)
function playFinishBeep() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        // Три бипа подряд с нарастающей частотой
        const beeps = [
            { offset: 0,    freq: 1200 },
            { offset: 0.18, freq: 1400 },
            { offset: 0.36, freq: 1600 },
        ]
        beeps.forEach(({ offset, freq }) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.type = 'square'
            osc.frequency.value = freq
            gain.gain.setValueAtTime(0.9, ctx.currentTime + offset)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.14)
            osc.start(ctx.currentTime + offset)
            osc.stop(ctx.currentTime + offset + 0.14)
        })
        setTimeout(() => ctx.close(), 1000)
    } catch {}
}

interface RestTimerProps {
    onClose: () => void
}

export default function RestTimer({ onClose }: RestTimerProps) {
    const [total, setTotal] = useState(STEP)       // изначальное время (сек)
    const [remaining, setRemaining] = useState(STEP) // оставшееся время (сек)
    const [running, setRunning] = useState(true)    // запущен ли таймер
    const [finished, setFinished] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    // Тик
    useEffect(() => {
        if (!running || finished) return
        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    stop()
                    setRunning(false)
                    setFinished(true)
                    playFinishBeep()
                    return 0
                }
                // Обратный отсчёт 3-2-1: одиночный пронзительный бип
                if (prev <= 4) {
                    playCountdownBeep()
                }
                return prev - 1
            })
        }, 1000)
        return stop
    }, [running, finished, stop])

    // Добавить +30 сек
    const addTime = () => {
        const add = STEP
        setTotal(t => t + add)
        setRemaining(r => r + add)
        setFinished(false)
        if (!running) setRunning(true)
    }

    // Сброс
    const reset = () => {
        stop()
        setTotal(STEP)
        setRemaining(STEP)
        setFinished(false)
        setRunning(true)
    }

    const progress = total > 0 ? remaining / total : 0 // 1 → 0

    // Цвет бара: зелёный → жёлтый → красный
    const barColor = finished
        ? '#ff4d4d'
        : progress > 0.5
        ? '#c8f542'
        : progress > 0.25
        ? '#f5c842'
        : '#ff4d4d'

    const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
    const ss = String(remaining % 60).padStart(2, '0')

    return (
        <div className="rest-timer-panel animate-slide-up">
            {/* Шапка */}
            <div className="rest-timer-header">
                <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-accent" />
                    <span className="text-sm font-semibold text-white">Отдых между подходами</span>
                </div>
                <button onClick={onClose} className="rest-timer-close">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Прогресс-бар */}
            <div className="rest-timer-bar-track">
                <div
                    className="rest-timer-bar-fill"
                    style={{
                        width: `${progress * 100}%`,
                        backgroundColor: barColor,
                        transition: 'width 1s linear, background-color 0.5s',
                    }}
                />
            </div>

            {/* Цифры + кнопки */}
            <div className="rest-timer-body">
                <div className={`rest-timer-digits ${finished ? 'rest-timer-digits-done' : ''}`}>
                    {finished ? 'Готово!' : `${mm}:${ss}`}
                </div>

                <div className="rest-timer-actions">
                    <button onClick={reset} className="rest-timer-btn-secondary" title="Сбросить">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={addTime} className="rest-timer-btn-primary">
                        <Plus className="w-4 h-4" />
                        <span>+{STEP}с</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
