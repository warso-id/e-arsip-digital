// sw.js - Enterprise Service Worker 2026
/**
 * E-Arsip Digital - Advanced Service Worker
 * Version: 2026.1.0
 * Features: Smart caching, background sync, push notifications,
 *           periodic sync, cache warming, version migration
 * Strategy: Stale-while-revalidate untuk assets, Network-first untuk API
 */

// ============================================
// CONFIGURATION
// ============================================
const APP_VERSION = '2026.1.0';
const CACHE_PREFIX = 'e-arsip';

const CACHE_NAMES = {
    static: `${CACHE_PREFIX}-static-v${APP_VERSION}`,
    runtime: `${CACHE_PREFIX}-runtime-v${APP_VERSION}`,
    dynamic: `${CACHE_PREFIX}-dynamic-v${APP_VERSION}`,
    images: `${CACHE_PREFIX}-images-v${APP_VERSION}`,
    fonts: `${CACHE_PREFIX}-fonts-v${APP_VERSION}`,
    pages: `${CACHE_PREFIX}-pages-v${APP_VERSION}`
};

const CACHE_LIMITS = {
    [CACHE_NAMES.static]: 50,
    [CACHE_NAMES.runtime]: 200,
    [CACHE_NAMES.dynamic]: 100,
    [CACHE_NAMES.images]: 200,
    [CACHE_NAMES.fonts]: 20,
    [CACHE_NAMES.pages]: 30
};

const CACHE_STRATEGIES = {
    images: 'cache-first',
    api: 'network-first',
    static: 'stale-while-revalidate',
    html: 'stale-while-revalidate',
    fonts: 'cache-first',
    scripts: 'stale-while-revalidate',
    styles: 'stale-while-revalidate',
    documents: 'network-first'
};

// Files to precache on install
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/login.html',
    '/404.html',
    '/offline.html',
    '/manifest.json'
];

// Critical CSS/JS files
const CRITICAL_ASSETS = [
    '/css/style.css',
    '/js/init.js',
    '/js/auth.js',
    '/js/api.js',
    '/js/utils.js',
    '/js/router.js',
    '/js/session.js',
    '/js/logger.js'
];

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing v${APP_VERSION}`);

    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAMES.static);
                
                // Precache files individually (one failure doesn't stop others)
                const precachePromises = [...PRECACHE_URLS, ...CRITICAL_ASSETS].map(async (url) => {
                    try {
                        const response = await fetch(url, { cache: 'no-cache' });
                        if (response.ok) {
                            await cache.put(url, response);
                            console.log(`[SW] Precached: ${url}`);
                        }
                    } catch (error) {
                        console.warn(`[SW] Precache failed: ${url}`, error.message);
                    }
                });

                await Promise.allSettled(precachePromises);
                console.log('[SW] Precache complete');
                
                // Force activation
                await self.skipWaiting();
            } catch (error) {
                console.error('[SW] Install failed:', error);
            }
        })()
    );
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating');

    event.waitUntil(
        (async () => {
            // Clean old caches
            await cleanOldCaches();
            
            // Take control of all clients immediately
            await self.clients.claim();
            
            // Warm up critical caches
            await warmupCaches();
            
            // Notify clients of activation
            await notifyClients('SW_ACTIVATED', {
                version: APP_VERSION,
                timestamp: Date.now()
            });
            
            console.log('[SW] Activation complete');
        })()
    );
});

// ============================================
// FETCH EVENT
// ============================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and non-http(s)
    if (!url.protocol.startsWith('http')) return;

    // Skip Google Analytics and other tracking
    if (url.hostname.includes('google-analytics.com') ||
        url.hostname.includes('googletagmanager.com')) {
        return;
    }

    // Determine strategy
    const strategy = getStrategy(request);
    
    switch (strategy) {
        case 'cache-first':
            event.respondWith(cacheFirstStrategy(request));
            break;
        case 'network-first':
            event.respondWith(networkFirstStrategy(request));
            break;
        case 'stale-while-revalidate':
            event.respondWith(staleWhileRevalidateStrategy(request));
            break;
        case 'network-only':
            event.respondWith(fetch(request));
            break;
        default:
            event.respondWith(staleWhileRevalidateStrategy(request));
    }
});

// ============================================
// CACHE STRATEGIES
// ============================================

async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetchWithTimeout(request, 8000);
        if (isCacheable(response)) {
            await putInCache(request, response.clone());
        }
        return response;
    } catch (error) {
        // Return offline fallback for navigation
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirstStrategy(request) {
    try {
        const response = await fetchWithTimeout(request, 10000);
        if (isCacheable(response)) {
            await putInCache(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }
        return new Response('Network error', { status: 503 });
    }
}

async function staleWhileRevalidateStrategy(request) {
    const cachePromise = caches.match(request);
    const networkPromise = fetchWithTimeout(request, 5000)
        .then(async (response) => {
            if (isCacheable(response)) {
                // Update cache in background
                const cache = await caches.open(getCacheName(request));
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    const cached = await cachePromise;
    
    if (cached) {
        // Trigger background revalidation
        networkPromise.then((networkResponse) => {
            if (networkResponse && networkResponse.status !== cached.status) {
                notifyClients('CACHE_UPDATED', { url: request.url });
            }
        });
        return cached;
    }

    // No cache, wait for network
    const networkResponse = await networkPromise;
    if (networkResponse) return networkResponse;
    
    if (request.mode === 'navigate') {
        return caches.match('/offline.html');
    }
    return new Response('Offline', { status: 503 });
}

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event:', event.tag);

    const syncHandlers = {
        'sync-pending-requests': () => syncPendingRequests(),
        'sync-user-data': () => syncUserData(),
        'sync-documents': () => syncDocuments(),
        'sync-offline-ops': () => syncOfflineOperations()
    };

    const handler = syncHandlers[event.tag];
    if (handler) {
        event.waitUntil(handler());
    }
});

// ============================================
// PERIODIC SYNC
// ============================================
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync:', event.tag);

    const handlers = {
        'check-notifications': () => checkNotifications(),
        'update-content': () => updateCachedContent(),
        'clean-caches': () => performMaintenance(),
        'check-updates': () => checkForSWUpdate()
    };

    const handler = handlers[event.tag];
    if (handler) {
        event.waitUntil(handler());
    }
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    const defaultNotification = {
        title: 'E-Arsip Digital',
        body: 'Ada pembaruan baru',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: { url: '/notifikasi/' },
        actions: [
            { action: 'open', title: 'Buka' },
            { action: 'close', title: 'Tutup' }
        ],
        tag: 'default',
        requireInteraction: false,
        renotify: true
    };

    let notification = defaultNotification;

    if (event.data) {
        try {
            const data = event.data.json();
            notification = { ...defaultNotification, ...data };
        } catch {
            notification.body = event.data.text() || defaultNotification.body;
        }
    }

    event.waitUntil(
        self.registration.showNotification(notification.title, {
            ...notification,
            timestamp: notification.data?.timestamp || Date.now()
        })
    );
});

// ============================================
// NOTIFICATION CLICK
// ============================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        (async () => {
            const clients = await self.clients.matchAll({ 
                type: 'window',
                includeUncontrolled: true 
            });

            // Find existing window for this URL
            const matchingClient = clients.find(c => c.url.includes(url));
            if (matchingClient) {
                await matchingClient.focus();
                return;
            }

            // Open new window
            if (self.clients.openWindow) {
                await self.clients.openWindow(url);
            }
        })()
    );
});

// ============================================
// MESSAGE HANDLER
// ============================================
self.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};
    const port = event.ports?.[0];

    const handlers = {
        'SKIP_WAITING': () => self.skipWaiting(),
        'CACHE_URL': () => cacheUrl(payload?.url),
        'CLEAR_CACHES': () => clearAllCaches(),
        'GET_VERSION': () => port?.postMessage({ version: APP_VERSION }),
        'GET_CACHE_STATS': async () => {
            const stats = await getCacheStats();
            port?.postMessage(stats);
        },
        'SYNC_NOW': () => syncPendingRequests(),
        'FORCE_UPDATE': async () => {
            await self.skipWaiting();
            await notifyClients('SW_UPDATE_AVAILABLE', { version: APP_VERSION });
        },
        'LOG_ERROR': () => {
            if (payload) {
                console.warn('[SW] Client error:', payload);
            }
        },
        'TRACK_404': () => {
            if (payload) {
                console.warn('[SW] 404 tracked:', payload.url);
            }
        }
    };

    const handler = handlers[type];
    if (handler) {
        event.waitUntil(handler());
    }
});

// ============================================
// CACHE MANAGEMENT
// ============================================

function getStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();

    // API calls
    if (pathname.includes('/api/') || 
        url.hostname.includes('script.google.com')) {
        return CACHE_STRATEGIES.api;
    }

    // HTML pages - stale-while-revalidate for PWA
    if (request.mode === 'navigate' || pathname.endsWith('.html')) {
        return CACHE_STRATEGIES.html;
    }

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'avif'].includes(ext)) {
        return CACHE_STRATEGIES.images;
    }

    // Fonts
    if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(ext)) {
        return CACHE_STRATEGIES.fonts;
    }

    // JavaScript
    if (ext === 'js') {
        return CACHE_STRATEGIES.scripts;
    }

    // CSS
    if (ext === 'css') {
        return CACHE_STRATEGIES.styles;
    }

    // Default
    return CACHE_STRATEGIES.static;
}

function getCacheName(request) {
    const url = new URL(request.url);
    const ext = url.pathname.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'avif'].includes(ext)) {
        return CACHE_NAMES.images;
    }
    if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(ext)) {
        return CACHE_NAMES.fonts;
    }
    if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        return CACHE_NAMES.pages;
    }
    if (url.pathname.includes('/api/')) {
        return CACHE_NAMES.dynamic;
    }

    return CACHE_NAMES.runtime;
}

async function putInCache(request, response) {
    const cacheName = getCacheName(request);
    if (!cacheName) return;

    try {
        const cache = await caches.open(cacheName);
        const limit = CACHE_LIMITS[cacheName] || 100;
        
        // Enforce limit
        const keys = await cache.keys();
        if (keys.length >= limit) {
            const deleteCount = Math.ceil(keys.length * 0.2); // Delete 20%
            for (let i = 0; i < deleteCount; i++) {
                await cache.delete(keys[i]);
            }
        }

        await cache.put(request, response);
    } catch (error) {
        console.warn('[SW] Cache put failed:', error.message);
    }
}

function isCacheable(response) {
    if (!response || !response.ok) return false;
    if (response.status !== 200) return false;
    if (response.type === 'opaque') return true; // Cross-origin
    
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl) {
        if (cacheControl.includes('no-store') || 
            cacheControl.includes('no-cache')) {
            return false;
        }
    }

    return true;
}

async function cleanOldCaches() {
    const currentCaches = Object.values(CACHE_NAMES);
    const allCaches = await caches.keys();

    const deletePromises = allCaches
        .filter(name => name.startsWith(CACHE_PREFIX) && !currentCaches.includes(name))
        .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
        });

    await Promise.all(deletePromises);
}

async function performMaintenance() {
    console.log('[SW] Performing cache maintenance');
    
    for (const [cacheName, limit] of Object.entries(CACHE_LIMITS)) {
        try {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            
            if (keys.length > limit) {
                // Keep newest entries (keys are ordered by insertion time)
                const deleteCount = keys.length - Math.floor(limit * 0.8);
                for (let i = 0; i < deleteCount; i++) {
                    await cache.delete(keys[i]);
                }
            }
        } catch (error) {
            console.warn(`[SW] Maintenance failed for ${cacheName}:`, error.message);
        }
    }
}

// ============================================
// CACHE WARMING
// ============================================
async function warmupCaches() {
    console.log('[SW] Warming up caches');
    
    // Pre-cache critical assets in background
    const warmupUrls = [
        ...PRECACHE_URLS,
        ...CRITICAL_ASSETS
    ];

    for (const url of warmupUrls) {
        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (isCacheable(response)) {
                await putInCache(url, response);
            }
        } catch {}
    }
}

// ============================================
// SYNC FUNCTIONS
// ============================================
async function syncPendingRequests() {
    console.log('[SW] Syncing pending requests');
    
    try {
        const db = await openDatabase();
        const requests = await getPendingRequests(db);
        
        for (const req of requests) {
            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body
                });
                
                if (response.ok) {
                    await removePendingRequest(db, req.id);
                }
            } catch {}
        }
    } catch (error) {
        console.warn('[SW] Sync failed:', error.message);
    }
}

async function syncUserData() {
    console.log('[SW] Syncing user data');
    // Implement user data sync
}

async function syncDocuments() {
    console.log('[SW] Syncing documents');
    // Implement document sync
}

async function syncOfflineOperations() {
    console.log('[SW] Syncing offline operations');
    // Implement offline operation sync
}

async function checkNotifications() {
    try {
        const response = await fetch('/api/notifications/check');
        if (response.ok) {
            const notifications = await response.json();
            for (const notif of notifications) {
                await self.registration.showNotification(notif.title, {
                    body: notif.body,
                    icon: notif.icon || '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    data: notif.data,
                    tag: notif.id
                });
            }
        }
    } catch (error) {
        console.warn('[SW] Notification check failed:', error.message);
    }
}

async function updateCachedContent() {
    const urls = [...PRECACHE_URLS, ...CRITICAL_ASSETS];
    for (const url of urls) {
        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (isCacheable(response)) {
                await putInCache(url, response);
            }
        } catch {}
    }
}

async function checkForSWUpdate() {
    try {
        const response = await fetch('/api/version', {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.version !== APP_VERSION) {
                await notifyClients('SW_UPDATE_AVAILABLE', {
                    currentVersion: APP_VERSION,
                    newVersion: data.version
                });
            }
        }
    } catch {}
}

// ============================================
// INDEXEDDB HELPERS
// ============================================
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EArsipSW', 2);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            ['pendingRequests', 'syncQueue', 'cacheMeta'].forEach(name => {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: 'id' });
                }
            });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function getPendingRequests(db) {
    if (!db) return [];
    return new Promise((resolve) => {
        try {
            const tx = db.transaction('pendingRequests', 'readonly');
            const store = tx.objectStore('pendingRequests');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        } catch { resolve([]); }
    });
}

async function removePendingRequest(db, id) {
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction('pendingRequests', 'readwrite');
            tx.objectStore('pendingRequests').delete(id);
            tx.oncomplete = resolve;
        } catch { resolve(); }
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
async function fetchWithTimeout(request, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(request, {
            signal: controller.signal,
            credentials: 'same-origin'
        });
        return response;
    } catch (error) {
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function notifyClients(type, data) {
    try {
        const clients = await self.clients.matchAll({ type: 'window' });
        const message = { type, data, timestamp: Date.now() };
        
        clients.forEach(client => {
            client.postMessage(message);
        });
    } catch {}
}

async function cacheUrl(url) {
    try {
        const response = await fetch(url);
        if (isCacheable(response)) {
            await putInCache(url, response);
        }
    } catch {}
}

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames
            .filter(name => name.startsWith(CACHE_PREFIX))
            .map(name => caches.delete(name))
    );
}

async function getCacheStats() {
    const stats = {};
    const cacheNames = await caches.keys();
    
    for (const name of cacheNames) {
        if (name.startsWith(CACHE_PREFIX)) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            stats[name] = {
                count: keys.length,
                limit: CACHE_LIMITS[name] || 'unlimited'
            };
        }
    }
    
    return stats;
}

// ============================================
// ERROR HANDLING
// ============================================
self.addEventListener('error', (event) => {
    console.error('[SW] Error:', event.error?.message || event.message);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled rejection:', event.reason?.message);
});

console.log(`[SW] Service Worker v${APP_VERSION} ready`);