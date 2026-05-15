'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'

const STORAGE_KEY = 'pwa-install-dismissed'

export default function InstallPWABanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Не показываем если уже установлено (работает в standalone режиме)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) return

    // Не показываем если пользователь уже закрыл баннер
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const safari = /safari/i.test(ua) && !/chrome/i.test(ua)
    setIsIOS(ios && safari)

    if (ios && safari) {
      // iOS Safari — показываем инструкцию сразу (нет beforeinstallprompt)
      setShow(true)
      return
    }

    // Android/Desktop Chrome — ждём beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        handleDismiss()
      }
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!show) return null

  return (
    <div className="w-full mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        {/* Иконка */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
          <Download className="w-6 h-6 text-accent" />
        </div>

        {/* Текст */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold mb-1">Установить приложение</p>
          {isIOS ? (
            <p className="text-text-secondary text-sm leading-relaxed">
              Нажмите{' '}
              <span className="inline-flex items-center gap-0.5 text-accent font-medium">
                <Share className="w-3.5 h-3.5" /> Поделиться
              </span>
              {' '}→{' '}
              <span className="inline-flex items-center gap-0.5 text-accent font-medium">
                <Plus className="w-3.5 h-3.5" /> На экран «Домой»
              </span>
              {' '}— и MetaSystem появится как приложение
            </p>
          ) : (
            <p className="text-text-secondary text-sm">
              Добавьте MetaSystem на главный экран — быстрый доступ без браузера
            </p>
          )}
        </div>

        {/* Кнопка закрыть */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-text-muted hover:text-white transition-colors p-1"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Кнопка установки (только для Android/Desktop) */}
      {!isIOS && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="glass-button flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            {installing ? 'Устанавливаем...' : 'Установить'}
          </button>
          <button
            onClick={handleDismiss}
            className="glass-button-secondary text-sm px-4 py-2 rounded-xl"
          >
            Не сейчас
          </button>
        </div>
      )}
    </div>
  )
}
