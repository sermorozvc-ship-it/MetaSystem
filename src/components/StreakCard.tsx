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
  const { currentStreak, bestStreak, nextMilestone, weeksToMilestone, isInDanger, currentWeekProgress } = stats

  const flameColor = currentStreak >= 4
    ? 'text-orange-400'
    : currentStreak >= 1
      ? 'text-accent'
      : currentWeekProgress && currentWeekProgress.completed > 0
        ? 'text-accent/60'
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
            {currentStreak === 0 && currentWeekProgress && currentWeekProgress.completed > 0 && (
              <p className="text-xs text-accent mt-0.5">
                {currentWeekProgress.completed}/{currentWeekProgress.required} тренировок на этой неделе
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            currentStreak >= 1 ? 'bg-accent/15' : currentWeekProgress && currentWeekProgress.completed > 0 ? 'bg-accent/10' : 'bg-bg-elevated'
          }`}>
            <Flame className={`w-6 h-6 ${flameColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted uppercase tracking-wider">Стрик</p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-display font-bold text-white leading-tight">
                {currentStreak}
              </span>
              <span className="text-sm text-text-muted font-normal whitespace-nowrap">
                {currentStreak === 1 ? 'неделя' : currentStreak >= 2 && currentStreak <= 4 ? 'недели' : 'недель'} подряд
              </span>
            </div>
          </div>
        </div>
        {bestStreak > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted bg-bg-elevated/60 rounded-full px-2.5 py-1 flex-shrink-0 whitespace-nowrap">
            <Trophy className="w-3.5 h-3.5 text-warning flex-shrink-0" />
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

      {/* Прогресс текущей незакрытой недели */}
      {currentWeekProgress && currentWeekProgress.completed > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-accent font-semibold">Текущая неделя в процессе</span>
            <span className="text-xs font-bold text-white">
              {currentWeekProgress.completed}/{currentWeekProgress.required}
            </span>
          </div>
          <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{
                width: `${Math.min(100, (currentWeekProgress.completed / currentWeekProgress.required) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            {currentWeekProgress.required - currentWeekProgress.completed === 0
              ? 'Все тренировки выполнены — неделя закроется!'
              : `Ещё ${currentWeekProgress.required - currentWeekProgress.completed} ${
                  currentWeekProgress.required - currentWeekProgress.completed === 1 ? 'тренировка' : 'тренировки'
                } до закрытия недели`
            }
          </p>
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

      {currentStreak === 0 && bestStreak === 0 && !currentWeekProgress?.completed && (
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
