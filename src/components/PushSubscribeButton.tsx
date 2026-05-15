'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '@/lib/services/push'

export default function PushSubscribeButton() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showDeniedTip, setShowDeniedTip] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isPushSupported()) return
    setSupported(true)
    const perm = getNotificationPermission()
    setPermission(perm)
    if (perm !== 'denied') {
      isPushSubscribed().then(setSubscribed)
    }
  }, [])

  // Не рендерим на сервере и если браузер вообще не поддерживает
  if (!mounted || !supported) return null

  const handleToggle = async () => {
    // Если уже запрещено — показываем подсказку
    if (permission === 'denied') {
      setShowDeniedTip((v) => !v)
      return
    }

    setLoading(true)
    try {
      if (subscribed) {
        const ok = await unsubscribeFromPush()
        if (ok) setSubscribed(false)
      } else {
        const ok = await subscribeToPush()
        if (ok) {
          setSubscribed(true)
          setPermission('granted')
        } else {
          // Пользователь отказал — обновляем статус
          const newPerm = getNotificationPermission()
          setPermission(newPerm)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Иконка и стиль в зависимости от состояния
  const isDenied = permission === 'denied'

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={loading}
        title={
          isDenied
            ? 'Уведомления заблокированы — разрешите в настройках браузера'
            : subscribed
            ? 'Отключить уведомления'
            : 'Включить уведомления'
        }
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
          isDenied
            ? 'bg-white/5 text-text-muted opacity-50 cursor-pointer'
            : subscribed
            ? 'bg-accent/20 text-accent hover:bg-accent/30'
            : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isDenied ? (
          <BellOff className="w-4 h-4" />
        ) : subscribed ? (
          <>
            <BellRing className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </>
        ) : (
          <Bell className="w-4 h-4" />
        )}
      </button>

      {/* Подсказка при заблокированных уведомлениях */}
      {showDeniedTip && isDenied && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDeniedTip(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 glass-card p-3 z-50 animate-fade-in">
            <p className="text-xs text-text-secondary leading-relaxed">
              Уведомления заблокированы в браузере.
            </p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Чтобы включить: откройте настройки браузера → Уведомления → найдите этот сайт и разрешите.
            </p>
            <button
              onClick={() => setShowDeniedTip(false)}
              className="mt-2 text-xs text-accent hover:underline"
            >
              Понятно
            </button>
          </div>
        </>
      )}
    </div>
  )
}
