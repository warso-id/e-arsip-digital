// js/security/secure-storage.js - Secure Storage 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Secure Browser Storage
 * Version: 2026.1.0
 * 
 * Features:
 * - TTL support (auto-expiry)
 * - Prefix isolation
 * - Quota monitoring
 * - Optional encryption (lightweight)
 * - Cross-tab sync (storage event)
 * - No external dependencies
 */

var SecureStorage = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        prefix: 'earsip_',          // Prefix untuk semua key
        defaultTTL: 3600000,        // 1 jam
        quotaLimit: 5242880,        // 5MB
        encryptByDefault: false     // FALSE - encryption optional
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _listeners = {};           // { key: [callback, ...] }
    var _channel = null;           // BroadcastChannel (jika didukung)
    
    // ============================================
    // SIMPLE OBFUSCATION (bukan encryption penuh)
    // ============================================
    
    /**
     * Simple obfuscate (bukan encryption aman!)
     * Untuk menyembunyikan data dari casual inspection.
     * Untuk keamanan penuh, gunakan EncryptionService terpisah.
     */
    function obfuscate(str) {
        if (!str) return '';
        var result = '';
        for (var i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ 42);
        }
        return btoa(result);
    }
    
    function deobfuscate(str) {
        if (!str) return '';
        try {
            var decoded = atob(str);
            var result = '';
            for (var i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ 42);
            }
            return result;
        } catch(e) {
            return '';
        }
    }
    
    // ============================================
    // KEY MANAGEMENT
    // ============================================
    
    function prefixKey(key) {
        return config.prefix + key;
    }
    
    function unprefixKey(key) {
        if (key.indexOf(config.prefix) === 0) {
            return key.substring(config.prefix.length);
        }
        return key;
    }
    
    function isOurKey(key) {
        return key && key.indexOf(config.prefix) === 0;
    }
    
    // ============================================
    // CORE STORAGE METHODS
    // ============================================
    
    /**
     * Set value ke storage
     */
    function setItem(key, value, options) {
        if (!key) return false;
        
        var opts = options || {};
        var ttl = opts.ttl || config.defaultTTL;
        var encrypt = opts.encrypt !== undefined ? opts.encrypt : config.encryptByDefault;
        var storageType = opts.storage || 'localStorage';
        
        try {
            var storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
            var prefixedKey = prefixKey(key);
            
            // Build storage object
            var data = {
                v: value,
                t: Date.now(),
                e: ttl
            };
            
            // Convert to string
            var dataStr = JSON.stringify(data);
            
            // Optional obfuscation
            if (encrypt) {
                dataStr = obfuscate(dataStr);
            }
            
            // Cek quota
            var dataSize = (prefixedKey.length + dataStr.length) * 2; // UTF-16 bytes
            if (dataSize > config.quotaLimit * 0.9) {
                console.warn('[SecureStorage] Data too large: ' + dataSize + ' bytes');
                return false;
            }
            
            // Store
            storage.setItem(prefixedKey, dataStr);
            
            // Cleanup old items periodically (1% chance)
            if (Math.random() < 0.01) {
                cleanup();
            }
            
            return true;
        } catch(e) {
            // Storage full atau error lain
            if (e.name === 'QuotaExceededError') {
                console.warn('[SecureStorage] Quota exceeded, cleaning up...');
                cleanup();
                // Retry once
                try {
                    var storage2 = (options && options.storage === 'sessionStorage') ? sessionStorage : localStorage;
                    storage2.setItem(prefixKey(key), JSON.stringify({ v: value, t: Date.now(), e: (options && options.ttl) || config.defaultTTL }));
                    return true;
                } catch(e2) {
                    console.error('[SecureStorage] Storage full');
                    return false;
                }
            }
            console.error('[SecureStorage] Error:', e.message);
            return false;
        }
    }
    
    /**
     * Get value dari storage
     */
    function getItem(key, options) {
        if (!key) return null;
        
        var opts = options || {};
        var storageType = opts.storage || 'localStorage';
        
        try {
            var storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
            var prefixedKey = prefixKey(key);
            var rawData = storage.getItem(prefixedKey);
            
            if (!rawData) return null;
            
            // Parse data
            var data;
            try {
                data = JSON.parse(rawData);
            } catch(e) {
                // Mungkin ter-obfuscate
                var deobfuscated = deobfuscate(rawData);
                if (deobfuscated) {
                    try {
                        data = JSON.parse(deobfuscated);
                    } catch(e2) {
                        // Data corrupted, remove
                        storage.removeItem(prefixedKey);
                        return null;
                    }
                } else {
                    storage.removeItem(prefixedKey);
                    return null;
                }
            }
            
            // Validasi struktur
            if (!data || data.v === undefined) {
                storage.removeItem(prefixedKey);
                return null;
            }
            
            // Check TTL
            if (data.t && data.e) {
                var age = Date.now() - data.t;
                if (age > data.e) {
                    storage.removeItem(prefixedKey);
                    return null;
                }
            }
            
            return data.v;
        } catch(e) {
            console.error('[SecureStorage] Get error:', e.message);
            return null;
        }
    }
    
    /**
     * Remove value dari storage
     */
    function removeItem(key, options) {
        if (!key) return;
        
        var opts = options || {};
        var storageType = opts.storage || 'localStorage';
        var storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        
        storage.removeItem(prefixKey(key));
    }
    
    /**
     * Check if key exists
     */
    function hasItem(key, options) {
        return getItem(key, options) !== null;
    }
    
    // ============================================
    // BULK OPERATIONS
    // ============================================
    
    /**
     * Get all keys with our prefix
     */
    function getKeys(options) {
        var opts = options || {};
        var storageType = opts.storage || 'localStorage';
        var storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        
        var keys = [];
        for (var i = 0; i < storage.length; i++) {
            var key = storage.key(i);
            if (isOurKey(key)) {
                keys.push(unprefixKey(key));
            }
        }
        
        return keys;
    }
    
    /**
     * Get all values (gunakan dengan hati-hati)
     */
    function getAll(options) {
        var keys = getKeys(options);
        var result = {};
        
        for (var i = 0; i < keys.length; i++) {
            result[keys[i]] = getItem(keys[i], options);
        }
        
        return result;
    }
    
    /**
     * Clear all items with our prefix
     */
    function clearAll(options) {
        var opts = options || {};
        var storageType = opts.storage || 'localStorage';
        var storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        
        var keysToRemove = [];
        for (var i = 0; i < storage.length; i++) {
            var key = storage.key(i);
            if (isOurKey(key)) {
                keysToRemove.push(key);
            }
        }
        
        for (var j = 0; j < keysToRemove.length; j++) {
            storage.removeItem(keysToRemove[j]);
        }
        
        return keysToRemove.length;
    }
    
    // ============================================
    // QUOTA MANAGEMENT
    // ============================================
    
    function getUsage() {
        var total = 0;
        
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (isOurKey(key)) {
                var value = localStorage.getItem(key);
                total += (key.length + (value ? value.length : 0)) * 2;
            }
        }
        
        return total;
    }
    
    function getStorageInfo() {
        var usage = getUsage();
        var keys = getKeys();
        
        return {
            usage: usage,
            quota: config.quotaLimit,
            available: config.quotaLimit - usage,
            percentUsed: Math.round((usage / config.quotaLimit) * 100),
            itemCount: keys.length
        };
    }
    
    /**
     * Cleanup expired items
     */
    function cleanup() {
        var now = Date.now();
        var removed = 0;
        
        var keysToCheck = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (isOurKey(key)) {
                keysToCheck.push(key);
            }
        }
        
        for (var j = 0; j < keysToCheck.length; j++) {
            var key = keysToCheck[j];
            try {
                var raw = localStorage.getItem(key);
                if (!raw) continue;
                
                var data = JSON.parse(raw);
                if (data && data.t && data.e && (now - data.t > data.e)) {
                    localStorage.removeItem(key);
                    removed++;
                }
            } catch(e) {
                // Corrupted data
                localStorage.removeItem(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            console.debug('[SecureStorage] Cleaned ' + removed + ' expired items');
        }
    }
    
    // ============================================
    // CROSS-TAB SYNC
    // ============================================
    
    function setupCrossTabSync() {
        // Storage event (semua browser)
        window.addEventListener('storage', function(event) {
            if (isOurKey(event.key)) {
                var unprefixed = unprefixKey(event.key);
                notifyListeners('change', unprefixed, event.newValue);
            }
        });
        
        // BroadcastChannel (jika didukung)
        try {
            if (window.BroadcastChannel) {
                _channel = new BroadcastChannel('earsip_storage_sync');
                _channel.onmessage = function(event) {
                    notifyListeners('external', event.data.key, null);
                };
            }
        } catch(e) {
            // BroadcastChannel tidak didukung
        }
    }
    
    /**
     * Listen untuk perubahan pada key tertentu
     */
    function onChange(key, callback) {
        if (!_listeners[key]) {
            _listeners[key] = [];
        }
        
        _listeners[key].push(callback);
        
        // Return unsubscribe function
        return function() {
            if (_listeners[key]) {
                _listeners[key] = _listeners[key].filter(function(cb) {
                    return cb !== callback;
                });
                if (_listeners[key].length === 0) {
                    delete _listeners[key];
                }
            }
        };
    }
    
    function notifyListeners(event, key, data) {
        // Notify specific key
        if (key && _listeners[key]) {
            for (var i = 0; i < _listeners[key].length; i++) {
                try {
                    _listeners[key][i](event, data);
                } catch(e) {}
            }
        }
        
        // Notify wildcard
        if (_listeners['*']) {
            for (var j = 0; j < _listeners['*'].length; j++) {
                try {
                    _listeners['*'][j](event, key, data);
                } catch(e) {}
            }
        }
    }
    
    // ============================================
    // INIT
    // ============================================
    setupCrossTabSync();
    
    // Cleanup saat startup
    setTimeout(cleanup, 1000);
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Set value
         */
        set: setItem,
        
        /**
         * Get value
         */
        get: getItem,
        
        /**
         * Remove value
         */
        remove: removeItem,
        
        /**
         * Check if key exists
         */
        has: hasItem,
        
        /**
         * Get all keys
         */
        keys: getKeys,
        
        /**
         * Get all values
         */
        getAll: getAll,
        
        /**
         * Clear all items
         */
        clear: clearAll,
        
        /**
         * Get storage info
         */
        getInfo: getStorageInfo,
        
        /**
         * Get storage usage
         */
        getUsage: getUsage,
        
        /**
         * Manual cleanup
         */
        cleanup: cleanup,
        
        /**
         * Listen for changes
         */
        onChange: onChange,
        
        /**
         * Update config
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
         * Destroy
         */
        destroy: function() {
            if (_channel) {
                _channel.close();
                _channel = null;
            }
            _listeners = {};
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Basic
// SecureStorage.set('user_prefs', { theme: 'dark' }, { ttl: 86400000 });
// var prefs = SecureStorage.get('user_prefs');
// 
// // With obfuscation
// SecureStorage.set('token', 'abc123', { encrypt: true });
// 
// // Listen for changes
// var unsubscribe = SecureStorage.onChange('user_prefs', function(event, data) {
//     console.log('Changed:', event, data);
// });
// 
// // Storage info
// var info = SecureStorage.getInfo();
// console.log(info.percentUsed + '% used');
// ============================================