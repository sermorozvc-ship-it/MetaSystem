'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, TrendingUp, BarChart3 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getAllMyTrainingData, type TrainingProgram, type TrainingEntry } from '@/lib/services/training'
import ExerciseProgressView from '@/components/ExerciseProgressView'
import WeeklyTonnageChart from '@/components/WeeklyTonnageChart'
import { useFailsafe } from '@/lib/hooks/useFailsafe'

type Tab = 'tonnage' | 'exercises'

export default function ProgressPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [entries, setEntries] = useState<TrainingEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('tonnage')

  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const t = setTimeout(() => {
        if (!userRef.current) router.replace('/auth')
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const data = await getAllMyTrainingData()
        setPrograms(data.programs)
        setEntries(data.entries)
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки данных')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user?.id])

  // Аварийный таймер от вечного лоадера на десктопе
  useFailsafe(isLoading, () => setIsLoading(false), 8_000, 'progress')

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main p-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="glass-button-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          <div>
            <h1 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Прогресс
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Статистика тренировок и динамика весов
            </p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 mb-4 border border-danger/30 bg-danger/10">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Вкладки */}
        <div className="flex gap-2 mb-5 p-1 rounded-xl bg-bg-elevated border border-border">
          <button
            onClick={() => setActiveTab('tonnage')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'tonnage'
                ? 'bg-accent text-bg-main'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Тоннаж
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'exercises'
                ? 'bg-accent text-bg-main'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Упражнения
          </button>
        </div>

        {/* Контент вкладок */}
        {activeTab === 'tonnage' && (
          <WeeklyTonnageChart programs={programs} entries={entries} />
        )}

        {activeTab === 'exercises' && (
          <ExerciseProgressView programs={programs} entries={entries} />
        )}
      </div>
    </div>
  )
}
