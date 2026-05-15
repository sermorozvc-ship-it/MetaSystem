// MetaSystem Service Worker — Web Push Notifications
// v2.1

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Получение push-уведомления
self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      try {
        data = { title: 'MetaSystem', body: event.data.text() }
      } catch {
        data = {}
      }
    }
  }

  const title = data.title || 'MetaSystem'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: data.tag || 'metasystem-notification',
    renotify: true,
  }

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('[SW] showNotification failed:', err)
    })
  )
})

// Клик по уведомлению — открываем нужную страницу
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Если вкладка уже открыта — фокусируемся на ней
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          if ('navigate' in client) {
            try { client.navigate(url) } catch {}
          }
          return
        }
      }
      // Иначе открываем новую вкладку
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
