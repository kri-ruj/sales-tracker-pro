const CACHE_NAME = 'sales-tracker-pro-v3.6.8';
const urlsToCache = [
  '/',
  '/index.html',
  '/index-refactored.html',
  '/manifest.json',
  '/css/main.css',
  '/js/app.js',
  '/js/config/appConfig.js',
  '/js/modules/ActivityManager.js',
  '/js/modules/APIService.js',
  '/js/modules/LIFFManager.js',
  '/js/modules/ErrorHandler.js',
  '/js/modules/OfflineManager.js',
  '/js/modules/StateManager.js',
  '/js/modules/UIRenderer.js',
  'https://static.line-scdn.net/liff/edge/2/sdk.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing v3.6.7...');
  // Force immediate activation
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files for v3.6.7');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete v3.6.7');
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then(response => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(error => {
        console.error('Service Worker: Fetch failed', error);
        
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sync-activities') {
    event.waitUntil(syncActivities());
  }
});

// Push notification handler
self.addEventListener('push', event => {
  console.log('Service Worker: Push received', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New activity milestone reached!',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%234A90E2"/><text y=".9em" font-size="60" x="50%" text-anchor="middle" fill="white">📊</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%234A90E2"/><text y=".9em" font-size="60" x="50%" text-anchor="middle" fill="white">📊</text></svg>',
    vibrate: [200, 100, 200],
    tag: 'sales-tracker-notification',
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Sales Tracker Pro', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Helper function to sync activities when back online
async function syncActivities() {
  console.log('Service Worker: Syncing activities...');
  
  try {
    // Get pending activities from IndexedDB or localStorage
    const pendingActivities = JSON.parse(localStorage.getItem('pendingActivities') || '[]');
    
    if (pendingActivities.length > 0) {
      // Simulate API sync (replace with actual API call)
      console.log('Service Worker: Syncing', pendingActivities.length, 'activities');
      
      // Clear pending activities after successful sync
      localStorage.removeItem('pendingActivities');
      
      // Show sync success notification
      self.registration.showNotification('Sales Tracker Pro', {
        body: `Synced ${pendingActivities.length} activities`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%234A90E2"/><text y=".9em" font-size="60" x="50%" text-anchor="middle" fill="white">📊</text></svg>',
        tag: 'sync-success'
      });
    }
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

// Utility functions
console.log('Service Worker: Loaded successfully');