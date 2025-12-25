// Service Worker for "从日本看中国" PWA
// Version: 1.0.0
// Strategy: Network First with Cache Fallback

const CACHE_NAME = 'cnjp-cache-v2';
const STATIC_CACHE_NAME = 'cnjp-static-v2';

// Core assets to pre-cache during install
const PRECACHE_ASSETS = [
    '/',
    '/logo.png',
    '/manifest.json'
];

// Install event - pre-cache core assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching core assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - Network First strategy for API, Stale-While-Revalidate for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) return;

    // API requests (data.json, live_data.json) - Network First
    if (url.pathname.endsWith('.json') && url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Static assets (JS, CSS, images) - Stale-While-Revalidate
    if (isStaticAsset(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // HTML pages - Network First
    event.respondWith(networkFirst(request));
});

// Check if the request is for a static asset
function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/i.test(pathname);
}

// Network First strategy - try network, fallback to cache
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network request failed, trying cache:', request.url);
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // If it's a navigation request, return cached index
        if (request.mode === 'navigate') {
            const cachedIndex = await caches.match('/');
            if (cachedIndex) return cachedIndex;
        }

        // Return a fallback offline response
        return new Response('Offline - Please check your internet connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Stale-While-Revalidate strategy - return cache immediately, update in background
async function staleWhileRevalidate(request) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Fetch fresh copy in background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => null);

    // Return cached response immediately, or wait for network
    return cachedResponse || fetchPromise;
}

// Push notification event handler (placeholder for future FCM/OneSignal integration)
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    const options = {
        body: event.data?.text() || '您有新的重大新闻更新',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'open', title: '查看详情' },
            { action: 'close', title: '关闭' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('从日本看中国', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
