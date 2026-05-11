'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
  type Notification,
} from '@/lib/services/notifications'

export default function NotificationBell() {
  const { user } = useAuth()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Загрузка непрочитанных уведомлений
  useEffect(() => {
    if (!user) return

    const loadNotifications = async () => {
      const data = await getUnreadNotifications()
      setNotifications(data)
    }

    loadNotifications()

    // Подписка на новые уведомления (Realtime)
    const unsubscribe = subscribeToNotifications(user.id, (newNotification) => {
      setNotifications((prev) => [newNotification, ...prev])
    })

    return () => {
      unsubscribe()
    }
  }, [user])

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id)
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    setIsOpen(false)
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleMarkAllAsRead = async () => {
    setIsLoading(true)
    await markAllAsRead()
    setNotifications([])
    setIsLoading(false)
  }

  if (!user) return null

  const unreadCount = notifications.length

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative glass-button-secondary p-3 rounded-xl"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] glass-card p-4 z-50 max-h-[80vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-bold text-white">
                Уведомления
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isLoading}
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Прочитать все
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary">
                  Нет новых уведомлений
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="p-3 rounded-xl bg-bg-elevated hover:bg-bg-card cursor-pointer transition-all border border-transparent hover:border-accent"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-white">
                        {notification.title}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNotificationClick(notification)
                        }}
                        className="text-text-muted hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-text-muted mt-2">
                      {new Date(notification.created_at).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
