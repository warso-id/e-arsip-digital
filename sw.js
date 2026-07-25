// sw.js - Service Worker 2026
/**
 * E-Arsip Digital - Advanced Service Worker
 * Version: 2026.1.0
 * Features: Advanced caching, background sync, push notifications, periodic sync
 */

const APP_VERSION = '2026.1.0';
const CACHE_NAME = `e-arsip-v${APP_VERSION}`;
const RUNTIME_CACHE = `e-arsip-runtime-v${APP_VERSION}`;
const DYNAMIC_CACHE = `e-arsip-dynamic-v${APP_VERSION}`;
const IMAGE_CACHE = `e-arsip-images-v${APP_VERSION}`;

// Cache strategies configuration
const CACHE_STRATEGIES = {
    images: 'cache-first',
    api: 'network-first',
    static: 'cache-first',
    html: 'network-first',
    fonts: 'cache-first',
    scripts: 'stale-while-revalidate',
    styles: 'stale-while-revalidate',
    documents: 'network-first'
};

// Precache URLs
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/login.html',
    '/404.html',
    '/offline.html',
    '/css/style.css',
    '/css/print.css',
    '/js/init.js',
    '/js/auth.js',
    '/js/api.js',
    '/js/utils.js',
    '/js/router.js',
    '/manifest.json'
];

// Cache limits
const CACHE_LIMITS = {
    [CACHE_NAME]: 50,
    [RUNTIME_CACHE]: 200,
    [DYNAMIC_CACHE]: 100,
    [IMAGE_CACHE]: 500
};

// Install event
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${APP_VERSION}`);
    
    event.waitUntil(
        Promise.all([
            // Precache static assets
            caches.open(CACHE_NAME)
                .then(cache => {
                    console.log('[SW] Precaching static assets');
                    return cache.addAll(PRECACHE_URLS);
                })
                .catch(error => {
                    console.error('[SW] Precaching failed:', error);
                }),
            
            // Skip waiting
            self.skipWaiting()
        ])
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating');
    
    event.waitUntil(
        Promise.all([
            // Clean old caches
            cleanOldCaches(),
            
            // Take control of all clients
            self.clients.claim(),
            
            // Perform maintenance
            performMaintenance()
        ])
    );
});

// Fetch event with advanced strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests and chrome-extension URLs
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Determine cache strategy based on request type
    const strategy = getCacheStrategy(request);
    
    switch (strategy) {
        case 'cache-first':
            event.respondWith(cacheFirst(request));
            break;
        case 'network-first':
            event.respondWith(networkFirst(request));
            break;
        case 'stale-while-revalidate':
            event.respondWith(staleWhileRevalidate(request));
            break;
        case 'network-only':
            event.respondWith(fetch(request));
            break;
        case 'cache-only':
            event.respondWith(cacheOnly(request));
            break;
        default:
            event.respondWith(networkFirst(request));
    }
});

// Background sync
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-pending-requests') {
        event.waitUntil(syncPendingRequests());
    } else if (event.tag === 'sync-user-data') {
        event.waitUntil(syncUserData());
    } else if (event.tag === 'sync-documents') {
        event.waitUntil(syncDocuments());
    }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync:', event.tag);
    
    if (event.tag === 'check-notifications') {
        event.waitUntil(checkNotifications());
    } else if (event.tag === 'update-content') {
        event.waitUntil(updateContent());
    } else if (event.tag === 'clean-caches') {
        event.waitUntil(performMaintenance());
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    
    let notification = {
        title: 'E-Arsip Digital',
        body: 'Ada pembaruan baru',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/notifikasi/index.html',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'open',
                title: 'Buka'
            },
            {
                action: 'close',
                title: 'Tutup'
            }
        ]
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            notification = { ...notification, ...data };
        } catch {
            notification.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notification.title, {
            body: notification.body,
            icon: notification.icon,
            badge: notification.badge,
            vibrate: notification.vibrate,
            data: notification.data,
            actions: notification.actions,
            tag: notification.tag || 'default',
            requireInteraction: notification.requireInteraction || false,
            renotify: notification.renotify || false,
            silent: notification.silent || false,
            timestamp: notification.data.timestamp
        })
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click:', event.action);
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(clientList => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// Message handler
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data?.type);
    
    const { type, payload } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_URL':
            if (payload?.url) {
                event.waitUntil(cacheUrl(payload.url, payload.strategy));
            }
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(clearCache(payload?.cacheName));
            break;
            
        case 'UPDATE_CACHE':
            event.waitUntil(updateCache(payload?.urls));
            break;
            
        case 'GET_CACHE_SIZE':
            event.waitUntil(getCacheSize().then(size => {
                event.ports[0]?.postMessage({ size });
            }));
            break;
            
        case 'SYNC_NOW':
            event.waitUntil(syncPendingRequests());
            break;
            
        case 'CHECK_FOR_UPDATES':
            event.waitUntil(checkForUpdates(event.ports[0]));
            break;
    }
});

// Cache strategies implementation
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (isCacheableResponse(response)) {
            await putInCache(request, response.clone());
        }
        return response;
    } catch (error) {
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }
        throw error;
    }
}

async function networkFirst(request) {
    try {
        const response = await fetchWithTimeout(request, 10000);
        if (isCacheableResponse(response)) {
            await putInCache(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // Return offline fallback
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }
        throw error;
    }
}

async function staleWhileRevalidate(request) {
    const cachePromise = caches.match(request);
    const networkPromise = fetchWithTimeout(request, 5000)
        .then(response => {
            if (isCacheableResponse(response)) {
                putInCache(request, response.clone());
            }
            return response;
        })
        .catch(() => null);
    
    const cached = await cachePromise;
    if (cached) {
        // Revalidate in background
        networkPromise.then(networkResponse => {
            if (networkResponse && networkResponse.status !== cached.status) {
                notifyClients('CACHE_UPDATED', {
                    url: request.url,
                    timestamp: Date.now()
                });
            }
        });
        
        return cached;
    }
    
    return networkPromise;
}

async function cacheOnly(request) {
    const cached = await caches.match(request);
    if (!cached) {
        throw new Error('Resource not in cache');
    }
    return cached;
}

// Helper functions
async function putInCache(request, response) {
    const cacheName = getCacheName(request);
    
    if (!cacheName) return;
    
    try {
        const cache = await caches.open(cacheName);
        await enforceCacheLimit(cache, CACHE_LIMITS[cacheName] || 100);
        await cache.put(request, response);
    } catch (error) {
        console.warn('[SW] Cache put failed:', error);
    }
}

async function enforceCacheLimit(cache, limit) {
    const keys = await cache.keys();
    if (keys.length >= limit) {
        // Remove oldest entries
        const deleteCount = Math.max(1, keys.length - limit + 10);
        for (let i = 0; i < deleteCount; i++) {
            await cache.delete(keys[i]);
        }
    }
}

function getCacheStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const extension = pathname.split('.').pop();
    
    // API calls
    if (pathname.includes('/api/') || url.hostname.includes('script.google.com')) {
        return CACHE_STRATEGIES.api;
    }
    
    // HTML pages
    if (request.mode === 'navigate' || pathname.endsWith('.html')) {
        return CACHE_STRATEGIES.html;
    }
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(extension)) {
        return CACHE_STRATEGIES.images;
    }
    
    // Fonts
    if (['woff', 'woff2', 'ttf', 'eot'].includes(extension)) {
        return CACHE_STRATEGIES.fonts;
    }
    
    // Scripts
    if (extension === 'js') {
        return CACHE_STRATEGIES.scripts;
    }
    
    // Styles
    if (extension === 'css') {
        return CACHE_STRATEGIES.styles;
    }
    
    // Documents
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extension)) {
        return CACHE_STRATEGIES.documents;
    }
    
    // Default
    return CACHE_STRATEGIES.static;
}

function getCacheName(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const extension = pathname.split('.').pop();
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(extension)) {
        return IMAGE_CACHE;
    }
    
    // Dynamic content
    if (pathname.includes('/api/') || url.hostname.includes('script.google.com')) {
        return DYNAMIC_CACHE;
    }
    
    // Static assets
    if (['js', 'css', 'woff', 'woff2', 'ttf', 'eot'].includes(extension)) {
        return CACHE_NAME;
    }
    
    // Runtime
    return RUNTIME_CACHE;
}

function isCacheableResponse(response) {
    if (!response || response.status !== 200) return false;
    
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
        return false;
    }
    
    return true;
}

async function fetchWithTimeout(request, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(request, {
            signal: controller.signal,
            credentials: 'same-origin'
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function cleanOldCaches() {
    const cacheWhitelist = [CACHE_NAME, RUNTIME_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];
    const cacheNames = await caches.keys();
    
    return Promise.all(
        cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
                console.log('[SW] Deleting old cache:', cacheName);
                return caches.delete(cacheName);
            }
        })
    );
}

async function performMaintenance() {
    console.log('[SW] Performing maintenance');
    
    const cachesToClean = await caches.keys();
    
    for (const cacheName of cachesToClean) {
        const cache = await caches.open(cacheName);
        const limit = CACHE_LIMITS[cacheName] || 100;
        await enforceCacheLimit(cache, limit);
    }
}

async function syncPendingRequests() {
    console.log('[SW] Syncing pending requests');
    
    try {
        const db = await openIDB();
        const pendingRequests = await getPendingRequests(db);
        
        for (const request of pendingRequests) {
            try {
                const response = await fetch(request.url, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body
                });
                
                if (response.ok) {
                    await removePendingRequest(db, request.id);
                }
            } catch (error) {
                console.warn('[SW] Request sync failed:', error);
            }
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

async function checkNotifications() {
    console.log('[SW] Checking notifications');
    
    try {
        const response = await fetch('/api/notifications/check', {
            headers: {
                'Authorization': `Bearer ${await getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const notifications = await response.json();
            
            for (const notification of notifications) {
                await self.registration.showNotification(notification.title, {
                    body: notification.body,
                    icon: notification.icon || '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    data: notification.data,
                    tag: notification.id
                });
            }
        }
    } catch (error) {
        console.warn('[SW] Notification check failed:', error);
    }
}

async function updateContent() {
    console.log('[SW] Updating content');
    
    // Update cached content in background
    for (const url of PRECACHE_URLS) {
        try {
            const response = await fetch(url);
            if (isCacheableResponse(response)) {
                await putInCache(url, response);
            }
        } catch (error) {
            console.warn('[SW] Content update failed for:', url);
        }
    }
}

// IndexedDB helpers
async function openIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EArsipSW', 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('pendingRequests')) {
                db.createObjectStore('pendingRequests', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('cacheMeta')) {
                db.createObjectStore('cacheMeta', { keyPath: 'url' });
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getPendingRequests(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('pendingRequests', 'readonly');
        const store = transaction.objectStore('pendingRequests');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function removePendingRequest(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('pendingRequests', 'readwrite');
        const store = transaction.objectStore('pendingRequests');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getAuthToken() {
    // Get auth token from IndexedDB or cache
    try {
        const db = await openIDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('cacheMeta', 'readonly');
            const store = transaction.objectStore('cacheMeta');
            const request = store.get('/auth/token');
            
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
}

async function cacheUrl(url, strategy = 'cache-first') {
    try {
        const response = await fetch(url);
        if (isCacheableResponse(response)) {
            await putInCache(url, response);
        }
    } catch (error) {
        console.warn('[SW] URL caching failed:', error);
    }
}

async function clearCache(cacheName) {
    if (cacheName) {
        await caches.delete(cacheName);
    } else {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
}

async function updateCache(urls) {
    for (const url of urls) {
        await cacheUrl(url);
    }
}

async function getCacheSize() {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        totalSize += keys.length;
    }
    
    return totalSize;
}

async function checkForUpdates(port) {
    try {
        const response = await fetch('/api/version', {
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.version !== APP_VERSION) {
                port?.postMessage({ updateAvailable: true, version: data.version });
            } else {
                port?.postMessage({ updateAvailable: false });
            }
        }
    } catch (error) {
        console.warn('[SW] Update check failed:', error);
    }
}

function notifyClients(type, data) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type, data });
        });
    });
}

// Handle fetch errors globally
self.addEventListener('fetcherror', (event) => {
    console.error('[SW] Fetch error:', event);
});

// Handle unhandled rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled rejection:', event.reason);
});

console.log('[SW] Service Worker loaded:', APP_VERSION);