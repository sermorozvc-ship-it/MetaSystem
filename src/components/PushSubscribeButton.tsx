'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    setMounted(true)
    if (!isPushSupported()) return
    setSupported(true)
    setPermission(getNotificationPermission())
    isPushSubscribed().then(setSubscribed)
  }, [])

  // Не рендерим на сервере и если не поддерживается
  if (!mounted || !supported || permission === 'denied') return null

  const handleToggle = async () => {
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
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={subscribed ? 'Отключить уведомления' : 'Включить уведомления'}
      className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
        subscribed
          ? 'bg-accent/20 text-accent hover:bg-accent/30'
          : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
      }`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : subscribed ? (
        <>
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </>
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </button>
  )
}
