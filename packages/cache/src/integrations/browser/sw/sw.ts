/**
 * Castmill Player Service Worker (c) 2022 OptimalBits Sweden.
 *
 * This service worker enables the player to work offline.
 *
 *
 */
/// <reference lib="webworker" />

self.addEventListener('install', function (event) {
  console.log('Installed worker');
});

self.addEventListener('activate', function (event) {
  console.log('Activated worker version');
});

const NETWORK_FIRST_CACHE_MODES = ['no-cache', 'reload', 'no-store'];

self.addEventListener('fetch', async function (event) {
  const request = (<FetchEvent>event).request;

  // StorageBrowser refreshes resources with `cache: 'no-cache'`, so prefer the
  // network over the stale copy. Fall back to the cache when offline because
  // browsers (e.g. DevTools "Disable cache") may also mark regular reads so.
  if (NETWORK_FIRST_CACHE_MODES.indexOf(request.cache) !== -1) {
    (<FetchEvent>event).respondWith(
      (async () => {
        try {
          return await fetch(request.clone());
        } catch (err) {
          const response = await caches.match(request);
          if (response) {
            return response;
          }
          throw err;
        }
      })()
    );
    return;
  }

  (<FetchEvent>event).respondWith(
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
});
