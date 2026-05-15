'use client'

/**
 * Web Push Service — клиентская сторона
 * Управление подпиской на браузерные уведомления
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Проверить поддержку push в браузере
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Получить текущий статус разрешения
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Зарегистрировать Service Worker
 */
async function registerSW(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/**
 * Подписаться на push-уведомления
 * Возвращает true если успешно
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    // Запрашиваем разрешение
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Регистрируем SW
    const registration = await registerSW()
    await navigator.serviceWorker.ready

    // Создаём подписку
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subJson = subscription.toJSON()

    // Сохраняем на сервере
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    })

    return res.ok
  } catch (e) {
    console.error('[Push] Subscribe error:', e)
    return false
  }
}

/**
 * Отписаться от push-уведомлений
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return true

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true

    const endpoint = subscription.endpoint

    // Отписываемся в браузере
    await subscription.unsubscribe()

    // Удаляем с сервера
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })

    return true
  } catch (e) {
    console.error('[Push] Unsubscribe error:', e)
    return false
  }
}

/**
 * Проверить, подписан ли пользователь
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return false
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}
