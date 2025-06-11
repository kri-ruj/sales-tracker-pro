// Dynamic version based on timestamp to ensure cache busting
const VERSION = '3.7.12';
const CACHE_NAME = `sales-tracker-v${VERSION}-${Date.now()}`;
const API_CACHE_NAME = `sales-tracker-api-v${VERSION}`;

// Cache only essential static assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://static.line-scdn.net/liff/edge/2/sdk.js'
];

// API endpoints that should always fetch fresh data
const API_ROUTES = [
  '/api/',
  '/webhook',
  '/health'
];

// Install event - cache essential resources only
self.addEventListener('install', event => {
  console.log(`Service Worker: Installing ${VERSION}...`);
  // Force immediate activation
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`Service Worker: Caching essential files for ${VERSION}`);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log(`Service Worker: Installation complete ${VERSION}`);
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - aggressive cleanup of old caches
self.addEventListener('activate', event => {
  console.log(`Service Worker: Activating ${VERSION}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete ALL old caches
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log(`Service Worker: Activation complete ${VERSION}`);
      // Take control of all pages immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: VERSION
          });
        });
      });
    })
  );
});

// Fetch event - network first for everything, cache as fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!request.url.startsWith('http')) {
    return;
  }

  // Always fetch fresh for API routes
  if (API_ROUTES.some(route => url.pathname.includes(route))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for API calls if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Network first strategy for all other requests
  event.respondWith(
    fetch(request)
      .then(response => {
        // Don't cache if not a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone and cache the response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(request).then(response => {
          if (response) {
            return response;
          }
          // Return index.html for navigation requests
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Message handler for cache control
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_CLEARED',
            version: VERSION
          });
        });
      })
    );
  }
});

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sync-activities') {
    event.waitUntil(syncActivities());
  }
});

// Helper function to sync activities when back online
async function syncActivities() {
  console.log('Service Worker: Syncing activities...');
  
  try {
    // This will be handled by the main app
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ACTIVITIES'
      });
    });
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

console.log(`Service Worker: Loaded successfully (v${VERSION})`);