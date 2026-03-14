/*
  sw.js — Service Worker
  
  WHAT IS A SERVICE WORKER?
  It's a background script that runs separately from your app.
  It intercepts network requests and can cache files.
  
  This makes your app:
  - Installable on phone home screen
  - Load faster (cached files)
  - Show a nice offline page if internet is lost
*/

const CACHE_NAME = 'medshop-v1'

// Files to cache for offline use
const STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
]

// ── Install: cache static files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES).catch(() => {
        // Silent fail — some files may not exist yet
      })
    })
  )
  // Activate immediately without waiting
  self.skipWaiting()
})

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch: serve from cache when offline ──
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Skip Firebase requests — always need fresh data
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('firestore')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the fresh response for next time
        const copy = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))
        return response
      })
      .catch(() => {
        // Offline — try cache first
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // If no cache and it's a page request → show offline page
          if (event.request.destination === 'document') {
            return caches.match('/offline.html')
          }
        })
      })
  )
})
