'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Home, Dumbbell, TrendingUp, MessageCircle, Settings, Shield, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import NotificationBell from './NotificationBell'

export default function Navigation() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Не показывать навигацию на страницах auth и payment
  if (!user || pathname === '/auth' || pathname === '/payment' || pathname === '/questionnaire') {
    return null
  }

  const isAdmin = user?.user_metadata?.role === 'admin'

  const clientLinks = [
    { href: '/dashboard', icon: Home, label: 'Главная' },
    { href: '/programs', icon: Dumbbell, label: 'Программы' },
    { href: '/metrics', icon: TrendingUp, label: 'Метрики' },
    { href: '/messages', icon: MessageCircle, label: 'Чат' },
    { href: '/settings', icon: Settings, label: 'Настройки' },
  ]

  const adminLinks = [
    { href: '/admin', icon: Shield, label: 'Админ' },
    { href: '/admin/clients', icon: Dumbbell, label: 'Клиенты' },
    { href: '/messages', icon: MessageCircle, label: 'Чат' },
  ]

  const links = isAdmin ? adminLinks : clientLinks

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-sidebar border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-bg-main font-display font-bold text-sm">M</span>
            </div>
            <span className="font-display font-bold text-white hidden sm:inline">MetaSystem</span>
          </div>

          {/* Links (Desktop) */}
          <div className="hidden md:flex items-center gap-2">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-accent text-bg-main font-semibold'
                      : 'text-text-secondary hover:text-white hover:bg-bg-elevated'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{link.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="glass-button-secondary p-3 rounded-xl"
              title="Выйти"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Links (Mobile) */}
        <div className="md:hidden flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-accent text-bg-main font-semibold'
                    : 'text-text-secondary hover:text-white hover:bg-bg-elevated'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs">{link.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
