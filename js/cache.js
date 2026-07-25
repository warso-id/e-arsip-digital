// js/cache.js - Advanced Cache Management 2026
/**
 * E-Arsip Digital - Cache Manager
 * Version: 2026.1.0
 * Features: Multi-layer caching (Memory, IndexedDB, localStorage),
 *           TTL support, LRU eviction, cache warming, prefetching
 */

import { Logger } from './logger.js';

class CacheManager {
    constructor(namespace = 'app', options = {}) {
        this.logger = new Logger('Cache');
        this.namespace = namespace;
        
        this.config = {
            defaultTTL: 300000, // 5 minutes
            maxMemoryItems: 200,
            maxStorageItems: 500,
            cleanupInterval: 60000, // 1 minute
            enableIndexedDB: true,
            enableWarming: false,
            ...options
        };
        
        // Memory cache (fastest)
        this.memoryCache = new Map();
        
        // IndexedDB reference
        this.db = null;
        this.dbReady = false;
        
        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0,
            memoryItems: 0,
            storageItems: 0
        };
        
        // Pending operations queue
        this.pendingOps = [];
        
        this.init();
    }
    
    async init() {
        if (this.config.enableIndexedDB) {
            await this.initIndexedDB();
        }
        
        // Start cleanup interval
        this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
        
        // Process pending operations
        this.processPendingOps();
        
        this.logger.info('Cache manager initialized', {
            namespace: this.namespace,
            indexedDB: this.dbReady
        });
    }
    
    // ============================================
    // INDEXEDDB INITIALIZATION
    // ============================================
    
    async initIndexedDB() {
        if (!window.indexedDB) {
            this.logger.warn('IndexedDB not supported');
            return;
        }
        
        return new Promise((resolve) => {
            const request = indexedDB.open(`EArsipCache_${this.namespace}`, 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('ttl', 'expiresAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.dbReady = true;
                resolve();
            };
            
            request.onerror = () => {
                this.logger.warn('Failed to open IndexedDB');
                resolve();
            };
        });
    }
    
    // ============================================
    // CORE CACHE METHODS
    // ============================================
    
    async get(key, options = {}) {
        const startTime = performance.now();
        
        // 1. Check memory cache first (fastest)
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key);
            
            if (!this.isExpired(entry)) {
                this.stats.hits++;
                this.updateAccessTime(key, entry);
                this.logger.debug('Cache hit (memory)', { key, time: performance.now() - startTime });
                return entry.value;
            } else {
                this.memoryCache.delete(key);
                this.stats.memoryItems--;
            }
        }
        
        // 2. Check IndexedDB
        if (this.dbReady) {
            const entry = await this.getFromIndexedDB(key);
            
            if (entry && !this.isExpired(entry)) {
                this.stats.hits++;
                
                // Promote to memory cache
                this.setMemoryCache(key, entry);
                
                this.logger.debug('Cache hit (indexedDB)', { key, time: performance.now() - startTime });
                return entry.value;
            }
        }
        
        // 3. Check localStorage fallback
        const localEntry = this.getFromLocalStorage(key);
        if (localEntry && !this.isExpired(localEntry)) {
            this.stats.hits++;
            this.setMemoryCache(key, localEntry);
            
            this.logger.debug('Cache hit (localStorage)', { key, time: performance.now() - startTime });
            return localEntry.value;
        }
        
        this.stats.misses++;
        this.logger.debug('Cache miss', { key, time: performance.now() - startTime });
        
        return null;
    }
    
    async set(key, value, options = {}) {
        const ttl = options.ttl || this.config.defaultTTL;
        const entry = {
            key,
            value,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl,
            accessCount: 0,
            lastAccessed: Date.now(),
            size: this.estimateSize(value),
            tags: options.tags || []
        };
        
        this.stats.sets++;
        
        // Set in memory cache
        this.setMemoryCache(key, entry);
        
        // Set in IndexedDB (async, non-blocking)
        if (this.dbReady) {
            this.queueOperation(() => this.setInIndexedDB(key, entry));
        }
        
        // Set in localStorage fallback
        this.setInLocalStorage(key, entry);
        
        return true;
    }
    
    async remove(key) {
        this.memoryCache.delete(key);
        this.stats.memoryItems = this.memoryCache.size;
        
        if (this.dbReady) {
            await this.removeFromIndexedDB(key);
        }
        
        this.removeFromLocalStorage(key);
        
        return true;
    }
    
    async clear() {
        this.memoryCache.clear();
        this.stats.memoryItems = 0;
        
        if (this.dbReady) {
            await this.clearIndexedDB();
        }
        
        this.clearLocalStorage();
        
        this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0, memoryItems: 0, storageItems: 0 };
        
        this.logger.info('Cache cleared');
    }
    
    async has(key) {
        if (this.memoryCache.has(key)) return true;
        
        const localEntry = this.getFromLocalStorage(key);
        if (localEntry && !this.isExpired(localEntry)) return true;
        
        if (this.dbReady) {
            const entry = await this.getFromIndexedDB(key);
            return entry && !this.isExpired(entry);
        }
        
        return false;
    }
    
    // ============================================
    // BULK OPERATIONS
    // ============================================
    
    async getMany(keys) {
        const results = {};
        const promises = keys.map(key => this.get(key).then(value => { results[key] = value; }));
        await Promise.all(promises);
        return results;
    }
    
    async setMany(entries, options = {}) {
        const promises = Object.entries(entries).map(([key, value]) => this.set(key, value, options));
        await Promise.all(promises);
    }
    
    async getByTag(tag) {
        const results = {};
        
        // Search memory cache
        this.memoryCache.forEach((entry, key) => {
            if (entry.tags?.includes(tag)) {
                results[key] = entry.value;
            }
        });
        
        return results;
    }
    
    async removeByTag(tag) {
        const keysToRemove = [];
        
        this.memoryCache.forEach((entry, key) => {
            if (entry.tags?.includes(tag)) keysToRemove.push(key);
        });
        
        await Promise.all(keysToRemove.map(key => this.remove(key)));
        
        return keysToRemove.length;
    }
    
    async warm(keys, dataFetcher) {
        if (!this.config.enableWarming) return;
        
        this.logger.info('Warming cache', { keyCount: keys.length });
        
        for (const key of keys) {
            const cached = await this.get(key);
            if (!cached && dataFetcher) {
                try {
                    const data = await dataFetcher(key);
                    await this.set(key, data);
                } catch (error) {
                    this.logger.warn('Cache warming failed for key', { key, error: error.message });
                }
            }
        }
    }
    
    // ============================================
    // MEMORY CACHE
    // ============================================
    
    setMemoryCache(key, entry) {
        // Evict if full
        if (this.memoryCache.size >= this.config.maxMemoryItems) {
            this.evictLRU();
        }
        
        this.memoryCache.set(key, entry);
        this.stats.memoryItems = this.memoryCache.size;
    }
    
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        this.memoryCache.forEach((entry, key) => {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        });
        
        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
            this.stats.evictions++;
            this.stats.memoryItems = this.memoryCache.size;
        }
    }
    
    updateAccessTime(key, entry) {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.memoryCache.set(key, entry);
    }
    
    // ============================================
    // INDEXEDDB OPERATIONS
    // ============================================
    
    async getFromIndexedDB(key) {
        if (!this.db) return null;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction('cache', 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    }
    
    async setInIndexedDB(key, entry) {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction('cache', 'readwrite');
            const store = transaction.objectStore('cache');
            store.put(entry);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    }
    
    async removeFromIndexedDB(key) {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction('cache', 'readwrite');
            const store = transaction.objectStore('cache');
            store.delete(key);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    }
    
    async clearIndexedDB() {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction('cache', 'readwrite');
            const store = transaction.objectStore('cache');
            store.clear();
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    }
    
    // ============================================
    // LOCALSTORAGE FALLBACK
    // ============================================
    
    getFromLocalStorage(key) {
        try {
            const raw = localStorage.getItem(`cache_${this.namespace}_${key}`);
            if (!raw) return null;
            
            const entry = JSON.parse(raw);
            return entry;
        } catch {
            return null;
        }
    }
    
    setInLocalStorage(key, entry) {
        try {
            // Check storage quota
            if (this.getLocalStorageItemCount() >= this.config.maxStorageItems) {
                this.evictOldestLocalStorage();
            }
            
            localStorage.setItem(
                `cache_${this.namespace}_${key}`,
                JSON.stringify(entry)
            );
            
            this.stats.storageItems = this.getLocalStorageItemCount();
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.clearLocalStorage();
            }
        }
    }
    
    removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(`cache_${this.namespace}_${key}`);
        } catch {
            // Ignore
        }
    }
    
    clearLocalStorage() {
        const prefix = `cache_${this.namespace}_`;
        
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        }
    }
    
    getLocalStorageItemCount() {
        let count = 0;
        const prefix = `cache_${this.namespace}_`;
        
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i)?.startsWith(prefix)) count++;
        }
        
        return count;
    }
    
    evictOldestLocalStorage() {
        const prefix = `cache_${this.namespace}_`;
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                try {
                    const entry = JSON.parse(localStorage.getItem(key));
                    if (entry.timestamp < oldestTime) {
                        oldestTime = entry.timestamp;
                        oldestKey = key;
                    }
                } catch {
                    localStorage.removeItem(key);
                }
            }
        }
        
        if (oldestKey) {
            localStorage.removeItem(oldestKey);
            this.stats.evictions++;
        }
    }
    
    // ============================================
    // QUEUE & CLEANUP
    // ============================================
    
    queueOperation(operation) {
        if (this.dbReady) {
            operation();
        } else {
            this.pendingOps.push(operation);
        }
    }
    
    processPendingOps() {
        if (!this.dbReady) return;
        
        while (this.pendingOps.length > 0) {
            const op = this.pendingOps.shift();
            op();
        }
    }
    
    async cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        // Clean memory cache
        this.memoryCache.forEach((entry, key) => {
            if (this.isExpired(entry)) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        });
        
        this.stats.memoryItems = this.memoryCache.size;
        
        // Clean IndexedDB
        if (this.dbReady) {
            const transaction = this.db.transaction('cache', 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('ttl');
            const range = IDBKeyRange.upperBound(now);
            
            const request = index.openCursor(range);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cleaned++;
                    cursor.continue();
                }
            };
        }
        
        // Clean localStorage
        const prefix = `cache_${this.namespace}_`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                try {
                    const entry = JSON.parse(localStorage.getItem(key));
                    if (this.isExpired(entry)) {
                        localStorage.removeItem(key);
                        cleaned++;
                    }
                } catch {
                    localStorage.removeItem(key);
                }
            }
        }
        
        this.stats.storageItems = this.getLocalStorageItemCount();
        
        if (cleaned > 0) {
            this.logger.debug('Cache cleanup', { cleaned });
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    isExpired(entry) {
        return entry.expiresAt && Date.now() > entry.expiresAt;
    }
    
    estimateSize(value) {
        try {
            return JSON.stringify(value).length * 2;
        } catch {
            return 0;
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            memorySize: this.memoryCache.size,
            storageSize: this.getLocalStorageItemCount(),
            indexedDBAvailable: this.dbReady
        };
    }
    
    getKeys() {
        const keys = new Set();
        
        this.memoryCache.forEach((_, key) => keys.add(key));
        
        const prefix = `cache_${this.namespace}_`;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                keys.add(key.replace(prefix, ''));
            }
        }
        
        return Array.from(keys);
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        this.memoryCache.clear();
        if (this.db) this.db.close();
        this.dbReady = false;
        this.logger.info('Cache manager destroyed');
    }
}

// Create singleton
const cacheManager = new CacheManager();

export default cacheManager;
export { CacheManager };