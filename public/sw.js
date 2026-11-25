// Service Worker ringan untuk mendukung pemasangan aplikasi MyPajak (PWA) di HP
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Selalu gunakan jaringan langsung agar data pajak & sesi login selalu real-time
})
