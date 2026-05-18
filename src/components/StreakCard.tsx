'use client'

import { Flame, Trophy, AlertTriangle } from 'lucide-react'
import type { StreakStats } from '@/lib/services/streaks'

interface Props {
  stats: StreakStats
  compact?: boolean
  showLink?: boolean
  onLinkClick?: () => void
}

export default function StreakCard({ stats, compact, showLink, onLinkClick }: Props) {
  const { currentStreak, bestStreak, nextMilestone, weeksToMilestone, isInDanger } = stats

  const flameColor = currentStreak >= 4
    ? 'text-orange-400'
    : currentStreak >= 1
      ? 'text-accent'
      : 'text-text-muted'

  if (compact) {
    return (
      <button
        onClick={onLinkClick}
        type="button"
        className="glass-card p-4 text-left w-full hover:border-accent/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Flame className={`w-5 h-5 ${flameColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text-muted">Стрик недель</p>
            <p className="text-xl font-display font-bold text-white leading-tight">
              {currentStreak}
              <span className="text-sm text-text-muted ml-1 font-normal">
                {currentStreak === 1 ? 'неделя' : currentStreak >= 2 && currentStreak <= 4 ? 'недели' : 'недель'}
              </span>
            </p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            currentStreak >= 1 ? 'bg-accent/15' : 'bg-bg-elevated'
          }`}>
            <Flame className={`w-6 h-6 ${flameColor}`} />
          </div>
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider">Стрик</p>
            <p className="text-3xl font-display font-bold text-white leading-tight">
              {currentStreak}
              <span className="text-base text-text-muted ml-1.5 font-normal">
                {currentStreak === 1 ? 'неделя' : currentStreak >= 2 && currentStreak <= 4 ? 'недели' : 'недель'} подряд
              </span>
            </p>
          </div>
        </div>
        {bestStreak > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted bg-bg-elevated/60 rounded-full px-2.5 py-1">
            <Trophy className="w-3.5 h-3.5 text-warning" />
            <span>Лучший: {bestStreak}</span>
          </div>
        )}
      </div>

      {isInDanger && currentStreak === 0 && bestStreak > 0 && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg p-2.5 mb-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Прошлая неделя не закрыта. Начни новую серию.</span>
        </div>
      )}

      {nextMilestone && weeksToMilestone !== null && weeksToMilestone > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
            <span>До следующей вехи</span>
            <span className="text-white font-semibold">{weeksToMilestone} нед. до {nextMilestone}</span>
          </div>
          <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, (currentStreak / nextMilestone) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {currentStreak === 0 && bestStreak === 0 && (
        <p className="text-xs text-text-muted">
          Закрой первую неделю — все запланированные тренировки — и стрик начнёт расти.
        </p>
      )}

      {showLink && (
        <button
          onClick={onLinkClick}
          type="button"
          className="mt-4 text-xs text-accent hover:underline"
        >
          Открыть календарь →
        </button>
      )}
    </div>
  )
}
