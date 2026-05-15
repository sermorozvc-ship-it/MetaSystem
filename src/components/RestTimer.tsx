'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, RotateCcw, Timer } from 'lucide-react'

const STEP = 30 // секунд за одно нажатие +

function playBeep() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        // Три коротких бипа
        const beeps = [0, 0.18, 0.36]
        beeps.forEach((offset) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.type = 'sine'
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.4, ctx.currentTime + offset)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.15)
            osc.start(ctx.currentTime + offset)
            osc.stop(ctx.currentTime + offset + 0.15)
        })
        // Закрываем контекст после воспроизведения
        setTimeout(() => ctx.close(), 1500)
    } catch {
        // Браузер не поддерживает Web Audio — молча игнорируем
    }
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
                    playBeep()
                    return 0
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
