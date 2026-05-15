'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, Plus, Smartphone } from 'lucide-react'

const STORAGE_KEY = 'pwa-install-dismissed'

export default function InstallPWABanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Не показываем если уже установлено (standalone режим)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return

    // Не показываем если уже закрыл
    if (localStorage.getItem(STORAGE_KEY)) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const android = /android/i.test(ua)
    const iosSafari = ios && /safari/i.test(ua) && !/chrome/i.test(ua)

    setIsIOS(iosSafari)
    setIsAndroid(android)

    // Перехватываем Chrome-промпт если есть
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Показываем баннер всегда (и с промптом, и без — с инструкцией)
    setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Chrome Android/Desktop — нативный диалог
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
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!show) return null

  // iOS Safari — только инструкция
  if (isIOS) {
    return (
      <div className="w-full mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold mb-2">Установить приложение</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              Чтобы добавить MetaSystem на главный экран:
            </p>
            <ol className="mt-2 space-y-1 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="text-accent font-bold">1.</span>
                Нажмите <Share className="w-3.5 h-3.5 text-accent inline mx-0.5" /> внизу браузера
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent font-bold">2.</span>
                Выберите <span className="text-accent font-medium">"На экран «Домой»"</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent font-bold">3.</span>
                Нажмите <span className="text-accent font-medium">"Добавить"</span>
              </li>
            </ol>
          </div>
          <button onClick={handleDismiss} className="flex-shrink-0 text-text-muted hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button onClick={handleDismiss} className="mt-3 text-xs text-text-muted hover:text-white transition-colors">
          Не сейчас
        </button>
      </div>
    )
  }

  // Android Chrome с нативным промптом
  if (isAndroid && deferredPrompt) {
    return (
      <div className="w-full mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <Download className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold mb-1">Установить приложение</p>
            <p className="text-text-secondary text-sm">
              Добавьте MetaSystem на главный экран — быстрый доступ без браузера
            </p>
          </div>
          <button onClick={handleDismiss} className="flex-shrink-0 text-text-muted hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleInstall} disabled={installing} className="glass-button flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            {installing ? 'Устанавливаем...' : 'Установить'}
          </button>
          <button onClick={handleDismiss} className="glass-button-secondary text-sm px-4 py-2 rounded-xl">
            Не сейчас
          </button>
        </div>
      </div>
    )
  }

  // Android без промпта или Desktop — инструкция через меню браузера
  return (
    <div className="w-full mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold mb-1">Установить приложение</p>
          <p className="text-text-secondary text-sm leading-relaxed">
            {isAndroid
              ? 'Нажмите ⋮ в браузере → «Добавить на главный экран» — и MetaSystem появится как приложение'
              : 'Нажмите ⋮ в браузере → «Установить MetaSystem» — и приложение появится на рабочем столе'
            }
          </p>
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 text-text-muted hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      <button onClick={handleDismiss} className="mt-3 text-xs text-text-muted hover:text-white transition-colors">
        Не сейчас
      </button>
    </div>
  )
}
