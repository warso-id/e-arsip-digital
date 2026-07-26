// js/cache.js - Cache Management 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Cache Manager
 * Version: 2026.1.0
 * 
 * Features:
 * - Memory cache (fast)
 * - localStorage fallback (persistent)
 * - TTL support
 * - LRU eviction
 * - Size limits
 * - No external dependencies
 */

var CacheManager = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        defaultTTL: 300000,          // 5 menit
        maxMemoryItems: 100,         // Max items di memory
        maxStorageItems: 200,        // Max items di localStorage
        cleanupInterval: 120000,     // Cleanup setiap 2 menit
        storagePrefix: 'earsip_cache_'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _memoryCache = {};           // { key: { value, timestamp, expiresAt, hits } }
    var _stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0
    };
    var _cleanupTimer = null;
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    function now() {
        return Date.now();
    }
    
    function isExpired(entry) {
        return entry && entry.expiresAt && now() > entry.expiresAt;
    }
    
    function getStorageKey(key) {
        return config.storagePrefix + key;
    }
    
    function getMemoryKeys() {
        var keys = [];
        for (var k in _memoryCache) {
            if (_memoryCache.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    }
    
    function getMemoryCount() {
        return getMemoryKeys().length;
    }
    
    // ============================================
    // LOCAL STORAGE HELPERS
    // ============================================
    
    function getFromStorage(key) {
        try {
            var raw = localStorage.getItem(getStorageKey(key));
            if (!raw) return null;
            
            var entry = JSON.parse(raw);
            return entry;
        } catch(e) {
            return null;
        }
    }
    
    function setToStorage(key, entry) {
        try {
            // Cek jumlah items di storage
            if (getStorageCount() >= config.maxStorageItems) {
                evictOldestFromStorage();
            }
            
            localStorage.setItem(getStorageKey(key), JSON.stringify(entry));
        } catch(e) {
            // Storage full - hapus yang lama
            if (e.name === 'QuotaExceededError') {
                clearStorage();
                try {
                    localStorage.setItem(getStorageKey(key), JSON.stringify(entry));
                } catch(e2) {}
            }
        }
    }
    
    function removeFromStorage(key) {
        try {
            localStorage.removeItem(getStorageKey(key));
        } catch(e) {}
    }
    
    function getStorageCount() {
        var count = 0;
        var prefix = config.storagePrefix;
        
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf(prefix) === 0) {
                count++;
            }
        }
        
        return count;
    }
    
    function evictOldestFromStorage() {
        var prefix = config.storagePrefix;
        var oldestKey = null;
        var oldestTime = Infinity;
        
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf(prefix) === 0) {
                try {
                    var entry = JSON.parse(localStorage.getItem(key));
                    if (entry && entry.timestamp < oldestTime) {
                        oldestTime = entry.timestamp;
                        oldestKey = key;
                    }
                } catch(e) {
                    // Corrupted - hapus
                    localStorage.removeItem(key);
                }
            }
        }
        
        if (oldestKey) {
            localStorage.removeItem(oldestKey);
            _stats.evictions++;
        }
    }
    
    function clearStorage() {
        var prefix = config.storagePrefix;
        var keysToRemove = [];
        
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf(prefix) === 0) {
                keysToRemove.push(key);
            }
        }
        
        for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
        }
    }
    
    // ============================================
    // CORE CACHE METHODS
    // ============================================
    
    /**
     * Get value from cache
     */
    function get(key) {
        // 1. Check memory cache
        if (_memoryCache[key]) {
            var memEntry = _memoryCache[key];
            
            if (!isExpired(memEntry)) {
                _stats.hits++;
                memEntry.hits = (memEntry.hits || 0) + 1;
                return memEntry.value;
            }
            
            // Expired - hapus
            delete _memoryCache[key];
        }
        
        // 2. Check localStorage
        var storageEntry = getFromStorage(key);
        if (storageEntry && !isExpired(storageEntry)) {
            _stats.hits++;
            
            // Promote ke memory
            _memoryCache[key] = storageEntry;
            
            return storageEntry.value;
        }
        
        // 3. Miss
        _stats.misses++;
        return null;
    }
    
    /**
     * Set value to cache
     */
    function set(key, value, ttl) {
        if (!key) return false;
        
        var entry = {
            value: value,
            timestamp: now(),
            expiresAt: now() + (ttl || config.defaultTTL),
            hits: 0
        };
        
        // Evict jika memory penuh
        if (getMemoryCount() >= config.maxMemoryItems) {
            evictLRU();
        }
        
        // Set di memory
        _memoryCache[key] = entry;
        _stats.sets++;
        
        // Set di localStorage (async via setTimeout)
        setTimeout(function() {
            setToStorage(key, entry);
        }, 0);
        
        return true;
    }
    
    /**
     * Remove key from cache
     */
    function remove(key) {
        delete _memoryCache[key];
        removeFromStorage(key);
        return true;
    }
    
    /**
     * Check if key exists and is valid
     */
    function has(key) {
        if (_memoryCache[key] && !isExpired(_memoryCache[key])) {
            return true;
        }
        
        var entry = getFromStorage(key);
        return entry && !isExpired(entry);
    }
    
    /**
     * Get or set (fetch if not cached)
     */
    function getOrSet(key, fetcher, ttl) {
        var cached = get(key);
        if (cached !== null) {
            return Promise.resolve(cached);
        }
        
        return Promise.resolve(fetcher()).then(function(value) {
            set(key, value, ttl);
            return value;
        });
    }
    
    // ============================================
    // EVICTION
    // ============================================
    
    function evictLRU() {
        var oldestKey = null;
        var oldestTime = Infinity;
        
        for (var key in _memoryCache) {
            if (_memoryCache.hasOwnProperty(key)) {
                var entry = _memoryCache[key];
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }
        }
        
        if (oldestKey) {
            delete _memoryCache[oldestKey];
            _stats.evictions++;
        }
    }
    
    // ============================================
    // BULK OPERATIONS
    // ============================================
    
    function getMany(keys) {
        var results = {};
        for (var i = 0; i < keys.length; i++) {
            results[keys[i]] = get(keys[i]);
        }
        return results;
    }
    
    function setMany(entries, ttl) {
        var count = 0;
        for (var key in entries) {
            if (entries.hasOwnProperty(key)) {
                if (set(key, entries[key], ttl)) count++;
            }
        }
        return count;
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    function cleanup() {
        var cleaned = 0;
        var nowTime = now();
        
        // Clean memory
        for (var key in _memoryCache) {
            if (_memoryCache.hasOwnProperty(key)) {
                if (_memoryCache[key].expiresAt && nowTime > _memoryCache[key].expiresAt) {
                    delete _memoryCache[key];
                    cleaned++;
                }
            }
        }
        
        // Clean localStorage
        var prefix = config.storagePrefix;
        var keysToRemove = [];
        
        for (var i = 0; i < localStorage.length; i++) {
            var lsKey = localStorage.key(i);
            if (lsKey && lsKey.indexOf(prefix) === 0) {
                try {
                    var entry = JSON.parse(localStorage.getItem(lsKey));
                    if (entry && entry.expiresAt && nowTime > entry.expiresAt) {
                        keysToRemove.push(lsKey);
                    }
                } catch(e) {
                    keysToRemove.push(lsKey);
                }
            }
        }
        
        for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
            cleaned++;
        }
        
        if (cleaned > 0) {
            console.debug('[Cache] Cleaned ' + cleaned + ' expired items');
        }
    }
    
    function startCleanup() {
        if (_cleanupTimer) clearInterval(_cleanupTimer);
        _cleanupTimer = setInterval(cleanup, config.cleanupInterval);
    }
    
    function clear() {
        _memoryCache = {};
        clearStorage();
        _stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    // Start cleanup
    startCleanup();
    
    return {
        get: get,
        set: set,
        remove: remove,
        has: has,
        getOrSet: getOrSet,
        
        getMany: getMany,
        setMany: setMany,
        
        clear: clear,
        cleanup: cleanup,
        
        /**
         * Get cache statistics
         */
        getStats: function() {
            var total = _stats.hits + _stats.misses;
            return {
                hits: _stats.hits,
                misses: _stats.misses,
                sets: _stats.sets,
                evictions: _stats.evictions,
                memoryItems: getMemoryCount(),
                storageItems: getStorageCount(),
                hitRate: total > 0 ? Math.round((_stats.hits / total) * 100) : 0
            };
        },
        
        /**
         * Get all cache keys
         */
        getKeys: function() {
            var keys = getMemoryKeys();
            var prefix = config.storagePrefix;
            
            for (var i = 0; i < localStorage.length; i++) {
                var lsKey = localStorage.key(i);
                if (lsKey && lsKey.indexOf(prefix) === 0) {
                    var key = lsKey.substring(prefix.length);
                    if (keys.indexOf(key) === -1) {
                        keys.push(key);
                    }
                }
            }
            
            return keys;
        },
        
        /**
         * Update configuration
         */
        configure: function(newConfig) {
            if (newConfig) {
                for (var key in newConfig) {
                    if (newConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = newConfig[key];
                    }
                }
            }
        },
        
        /**
         * Destroy cache manager
         */
        destroy: function() {
            if (_cleanupTimer) {
                clearInterval(_cleanupTimer);
                _cleanupTimer = null;
            }
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// CacheManager.set('user_list', users, 300000); // 5 min TTL
// var users = CacheManager.get('user_list');
// 
// CacheManager.getOrSet('stats', function() {
//     return fetchStatsFromAPI();
// }, 60000).then(function(stats) {
//     console.log(stats);
// });
// 
// var stats = CacheManager.getStats();
// console.log('Hit rate:', stats.hitRate + '%');
// ============================================