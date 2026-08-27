/**
 * Castmill Player Service Worker (c) 2022 OptimalBits Sweden.
 *
 * This service worker enables the player to work offline.
 *
 *
 */
/// <reference lib="webworker" />

// Version number - update this to force cache refresh
const SW_VERSION = '1.0.1';
const APP_CACHE_NAME = `castmill-app-${SW_VERSION}`;

// File patterns that should use network-first strategy (app code that may be updated)
const NETWORK_FIRST_PATTERNS = [/\.js$/, /\.html$/, /\.css$/];

// Check if a URL should use network-first strategy
function shouldUseNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url));
}

self.addEventListener('install', function (event) {
  console.log(`Installed worker version ${SW_VERSION}`);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  console.log(`Activated worker version ${SW_VERSION}`);
  // Clean up old caches
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName.startsWith('castmill-app-') &&
              cacheName !== APP_CACHE_NAME
            ) {
              console.log(`Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  const url = new URL(request.url);

  // Use network-first for app code (JS, HTML, CSS)
  if (shouldUseNetworkFirst(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const fetchRequest = request.clone();
          const networkResponse = await fetch(fetchRequest);

          // Cache the new response
          if (networkResponse.ok) {
            const cache = await caches.open(APP_CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }

          return networkResponse;
        } catch (err) {
          // Network failed, try cache
          console.log(
            'Network failed, falling back to cache for:',
            url.pathname
          );
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          throw err;
        }
      })()
    );
  } else {
    // Use cache-first for other assets (media, fonts, etc.)
    event.respondWith(
      (async () => {
        const response = await caches.match(request);
        if (response) {
          return response;
        } else {
          const fetchRequest = request.clone();
          try {
            const result = await fetch(fetchRequest);
            return result;
          } catch (err) {
            console.error('Error fetching', err);
          }
        }
      })()
    );
  }
});
