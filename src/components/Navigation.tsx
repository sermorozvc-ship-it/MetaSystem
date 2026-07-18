'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Home, Dumbbell, TrendingUp, MessageCircle, LogOut, Apple, BarChart3, Library, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isAdminUser } from '@/lib/auth/isAdminUser'
import NotificationBell from './NotificationBell'
import PushSubscribeButton from './PushSubscribeButton'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'

export default function Navigation() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  // Откладываем тяжёлые подписки (Realtime, polling) на 1.5с после mount,
  // чтобы не блокировать загрузку основного контента страницы.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const noNavPaths = ['/', '/auth', '/payment', '/questionnaire', '/onboarding', '/get-started', '/screening']
  if (!user || noNavPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return null
  }

  const isAdmin = isAdminUser(user)

  const clientLinks = [
    { href: '/dashboard', icon: Home, label: 'Главная' },
    { href: '/programs', icon: Dumbbell, label: 'Программы' },
    { href: '/calendar', icon: Calendar, label: 'Календарь' },
    { href: '/progress', icon: BarChart3, label: 'Прогресс' },
    { href: '/nutrition', icon: Apple, label: 'Питание' },
    { href: '/metrics', icon: TrendingUp, label: 'Метрики' },
    { href: '/messages', icon: MessageCircle, label: 'Чат' },
  ]

  const adminLinks = [
    { href: '/admin', icon: Home, label: 'Главная' },
    { href: '/admin/clients', icon: Dumbbell, label: 'Клиенты' },
    { href: '/admin/templates', icon: Library, label: 'Шаблоны' },
    { href: '/messages', icon: MessageCircle, label: 'Чат' },
  ]

  const links = isAdmin ? adminLinks : clientLinks

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  return (
    <NavigationInner
      links={links}
      pathname={pathname}
      isAdmin={isAdmin}
      userId={user.id}
      ready={ready}
      onNavigate={(href) => router.push(href)}
      onSignOut={handleSignOut}
    />
  )
}

// Вынесено в отдельный компонент чтобы хуки работали корректно
function NavigationInner({
  links,
  pathname,
  isAdmin,
  userId,
  ready,
  onNavigate,
  onSignOut,
}: {
  links: { href: string; icon: React.ElementType; label: string }[]
  pathname: string
  isAdmin: boolean
  userId: string
  ready: boolean
  onNavigate: (href: string) => void
  onSignOut: () => void
}) {
  // Запускаем подписки на непрочитанные сообщения ТОЛЬКО после ready,
  // чтобы не блокировать загрузку основного контента страницы.
  const unreadCount = useUnreadMessages(ready ? userId : undefined, isAdmin)
  const isOnMessages = pathname === '/messages' || pathname.startsWith('/messages/')

  return (
    <>
      {/* ── Десктоп навбар (md+) ── */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 glass-sidebar border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-bg-main font-display font-bold text-sm">M</span>
              </div>
              <span className="font-display font-bold text-white">MetaSystem</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-1">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = link.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === link.href || pathname.startsWith(link.href + '/')
                const isChat = link.href === '/messages'
                const showBadge = isChat && unreadCount > 0 && !isOnMessages

                return (
                  <button
                    key={link.href}
                    onClick={() => onNavigate(link.href)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm ${
                      isActive
                        ? 'bg-accent text-bg-main font-semibold'
                        : 'text-text-secondary hover:text-white hover:bg-bg-elevated'
                    }`}
                  >
                    <span className="relative">
                      <Icon className="w-4 h-4" />
                      {showBadge && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                    {link.label}
                  </button>
                )
              })}
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <PushSubscribeButton />
              <NotificationBell />
              <button onClick={onSignOut} className="glass-button-secondary p-2.5 rounded-xl" title="Выйти">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Мобильный верхний хедер ── */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 glass-sidebar border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-bg-main font-display font-bold text-sm">M</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PushSubscribeButton />
            {/* Иконка чата с бейджем непрочитанных */}
            <button
              onClick={() => onNavigate('/messages')}
              className={`relative glass-button-secondary p-2.5 rounded-xl ${isOnMessages ? 'text-accent border-accent/40' : ''}`}
              title="Чат"
            >
              <MessageCircle className="w-4 h-4" />
              {unreadCount > 0 && !isOnMessages && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationBell />
            <button onClick={onSignOut} className="glass-button-secondary p-2.5 rounded-xl" title="Выйти">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Мобильный нижний таббар ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-sidebar border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {links.filter(link => link.href !== '/messages').map((link) => {
            const Icon = link.icon
            const isActive = link.href === '/admin'
              ? pathname === '/admin'
              : pathname === link.href || pathname.startsWith(link.href + '/')

            return (
              <button
                key={link.href}
                onClick={() => onNavigate(link.href)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all min-w-0 ${
                  isActive ? 'text-accent' : 'text-text-muted'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-accent' : ''}`} />
                <span className="text-[10px] font-medium truncate">{link.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
