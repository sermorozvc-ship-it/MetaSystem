'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Home, Dumbbell, TrendingUp, MessageCircle, LogOut, Apple, BarChart3 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import NotificationBell from './NotificationBell'

export default function Navigation() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const noNavPaths = ['/', '/auth', '/payment', '/questionnaire', '/onboarding']
  if (!user || noNavPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return null
  }

  const ADMIN_EMAILS = ['dgmukhin@gmail.com']
  const isAdminUser = ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')
    || user.user_metadata?.role === 'admin'
    || user.user_metadata?.role === 'curator'
    || user.user_metadata?.role === 'trainer'

  const clientLinks = [
    { href: '/dashboard', icon: Home, label: 'Главная' },
    { href: '/programs', icon: Dumbbell, label: 'Программы' },
    { href: '/progress', icon: BarChart3, label: 'Прогресс' },
    { href: '/nutrition', icon: Apple, label: 'Питание' },
    { href: '/metrics', icon: TrendingUp, label: 'Метрики' },
    { href: '/messages', icon: MessageCircle, label: 'Чат' },
  ]

  const adminLinks = [
    { href: '/admin', icon: Home, label: 'Главная' },
    { href: '/admin/clients', icon: Dumbbell, label: 'Клиенты' },
    { href: '/messages', icon: MessageCircle, label: 'Чат' },
  ]

  const links = isAdminUser ? adminLinks : clientLinks

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

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
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <button
                    key={link.href}
                    onClick={() => router.push(link.href)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm ${
                      isActive
                        ? 'bg-accent text-bg-main font-semibold'
                        : 'text-text-secondary hover:text-white hover:bg-bg-elevated'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </button>
                )
              })}
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button onClick={handleSignOut} className="glass-button-secondary p-2.5 rounded-xl" title="Выйти">
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
            <NotificationBell />
            <button onClick={handleSignOut} className="glass-button-secondary p-2.5 rounded-xl" title="Выйти">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Мобильный нижний таббар ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-sidebar border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
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
