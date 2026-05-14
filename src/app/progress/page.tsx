'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getAllMyTrainingData, type TrainingProgram, type TrainingEntry } from '@/lib/services/training'
import ExerciseProgressView from '@/components/ExerciseProgressView'

export default function ProgressPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [entries, setEntries] = useState<TrainingEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
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
  }, [user])

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
              Прогресс упражнений
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Динамика рабочих весов по всем тренировкам
            </p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 mb-4 border border-danger/30 bg-danger/10">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <ExerciseProgressView programs={programs} entries={entries} />
      </div>
    </div>
  )
}
