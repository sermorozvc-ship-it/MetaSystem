// Minimal Service Worker for PWA installation
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Service worker must have a fetch handler
    event.respondWith(fetch(event.request));
});
