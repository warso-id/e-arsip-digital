// js/security/rate-limit.js - Rate Limiter 2026 (SECURE)
/**
 * E-Arsip Digital - Rate Limiter
 * Version: 2026.1.0
 * 
 * Features:
 * - Sliding window algorithm
 * - Per-endpoint limits
 * - Burst allowance
 * - Auto-cleanup
 * - Privacy-aware (no fingerprinting)
 */

var RateLimiter = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: true,
        windowMs: 60000,           // 1 menit
        maxRequests: 100,          // Max request per window
        burstMultiplier: 1.5,      // Allow 50% burst
        cleanupIntervalMs: 120000, // Cleanup setiap 2 menit
        
        // Endpoint-specific limits
        endpoints: {
            'login': { maxRequests: 5, windowMs: 60000 },      // 5 login/min
            'register': { maxRequests: 3, windowMs: 3600000 },  // 3 register/jam
            'upload': { maxRequests: 10, windowMs: 60000 },     // 10 upload/min
            'export': { maxRequests: 5, windowMs: 300000 },     // 5 export/5min
            'search': { maxRequests: 30, windowMs: 60000 },     // 30 search/min
            'default': { maxRequests: 100, windowMs: 60000 }    // Default
        }
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _windows = {};           // { key: [timestamp, ...] }
    var _blockedKeys = {};       // { key: { blockedAt, expiresAt, reason } }
    var _whitelist = {};         // { key: true }
    var _cleanupTimer = null;
    
    var _stats = {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0
    };
    
    // ============================================
    // KEY GENERATION (Privacy-aware)
    // ============================================
    
    /**
     * Generate rate limit key dari session
     * TIDAK menggunakan fingerprint browser!
     */
    function generateKey() {
        // Gunakan session ID dari auth
        try {
            var session = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (session) {
                var data = JSON.parse(session);
                if (data.user && data.user.id) {
                    return 'user_' + data.user.id;
                }
            }
        } catch(e) {}
        
        // Fallback: gunakan session ID dari sessionStorage
        var sessionId = sessionStorage.getItem('rate_limit_session');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
            sessionStorage.setItem('rate_limit_session', sessionId);
        }
        
        return sessionId;
    }
    
    // ============================================
    // RATE LIMIT CHECK
    // ============================================
    
    /**
     * Check rate limit untuk key tertentu
     * @param {string} key - Rate limit key (opsional, auto-generate)
     * @param {Object} options - Override options
     * @returns {Object} { allowed, remaining, reset, retryAfter, reason }
     */
    function check(key, options) {
        if (!config.enabled) {
            return { allowed: true, remaining: -1, reset: 0, reason: 'disabled' };
        }
        
        var identifier = key || generateKey();
        var maxRequests = (options && options.maxRequests) || config.maxRequests;
        var windowMs = (options && options.windowMs) || config.windowMs;
        var burstLimit = Math.floor(maxRequests * config.burstMultiplier);
        
        // Check whitelist
        if (_whitelist[identifier]) {
            return { allowed: true, remaining: -1, reset: 0, reason: 'whitelisted' };
        }
        
        // Check if blocked
        if (_blockedKeys[identifier]) {
            var blockInfo = _blockedKeys[identifier];
            if (Date.now() < blockInfo.expiresAt) {
                _stats.blockedRequests++;
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: Math.max(0, blockInfo.expiresAt - Date.now()),
                    reason: 'Blocked: ' + (blockInfo.reason || 'rate_limit')
                };
            } else {
                // Block expired
                delete _blockedKeys[identifier];
            }
        }
        
        _stats.totalRequests++;
        
        var now = Date.now();
        
        // Get or create window
        if (!_windows[identifier]) {
            _windows[identifier] = [];
        }
        
        var window = _windows[identifier];
        
        // Remove expired entries (sliding window)
        _windows[identifier] = window.filter(function(time) {
            return now - time < windowMs;
        });
        
        var currentCount = _windows[identifier].length;
        
        // Check burst limit
        if (currentCount >= burstLimit) {
            // Auto-block
            blockKey(identifier, windowMs * 2, 'Burst limit: ' + currentCount + '/' + burstLimit);
            _stats.blockedRequests++;
            
            return {
                allowed: false,
                remaining: 0,
                retryAfter: windowMs * 2,
                current: currentCount,
                limit: burstLimit,
                reason: 'Burst limit exceeded'
            };
        }
        
        // Check normal limit
        if (currentCount >= maxRequests) {
            _stats.blockedRequests++;
            
            var oldestRequest = _windows[identifier][0];
            var retryAfter = Math.max(0, oldestRequest + windowMs - now);
            
            return {
                allowed: false,
                remaining: 0,
                retryAfter: retryAfter,
                current: currentCount,
                limit: maxRequests,
                reason: 'Rate limit exceeded'
            };
        }
        
        // Allow request
        _windows[identifier].push(now);
        _stats.allowedRequests++;
        
        return {
            allowed: true,
            remaining: maxRequests - currentCount - 1,
            reset: now + windowMs,
            current: currentCount + 1,
            limit: maxRequests
        };
    }
    
    /**
     * Check rate limit untuk endpoint tertentu
     * @param {string} endpoint - Nama endpoint ('login', 'upload', dll)
     * @param {string} key - Rate limit key
     * @returns {Object}
     */
    function checkEndpoint(endpoint, key) {
        var epConfig = (config.endpoints && config.endpoints[endpoint]) || config.endpoints['default'];
        
        return check(key, {
            maxRequests: epConfig.maxRequests,
            windowMs: epConfig.windowMs
        });
    }
    
    // ============================================
    // BLOCK MANAGEMENT
    // ============================================
    
    function blockKey(key, durationMs, reason) {
        _blockedKeys[key] = {
            blockedAt: Date.now(),
            expiresAt: Date.now() + durationMs,
            reason: reason || 'rate_limit'
        };
        
        // Clear requests untuk key ini
        delete _windows[key];
    }
    
    function unblockKey(key) {
        delete _blockedKeys[key];
    }
    
    function isBlocked(key) {
        var info = _blockedKeys[key || generateKey()];
        if (!info) return false;
        
        if (Date.now() > info.expiresAt) {
            delete _blockedKeys[key];
            return false;
        }
        
        return true;
    }
    
    // ============================================
    // WHITELIST MANAGEMENT
    // ============================================
    
    function addToWhitelist(key) {
        _whitelist[key] = true;
    }
    
    function removeFromWhitelist(key) {
        delete _whitelist[key];
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    function cleanup() {
        var now = Date.now();
        var cleanedWindows = 0;
        var cleanedBlocks = 0;
        
        // Clean request windows
        for (var key in _windows) {
            if (_windows.hasOwnProperty(key)) {
                _windows[key] = _windows[key].filter(function(time) {
                    return now - time < config.windowMs * 2;
                });
                
                if (_windows[key].length === 0) {
                    delete _windows[key];
                    cleanedWindows++;
                }
            }
        }
        
        // Clean expired blocks
        for (var key in _blockedKeys) {
            if (_blockedKeys.hasOwnProperty(key)) {
                if (now > _blockedKeys[key].expiresAt) {
                    delete _blockedKeys[key];
                    cleanedBlocks++;
                }
            }
        }
        
        if (cleanedWindows > 0 || cleanedBlocks > 0) {
            console.debug('[RateLimiter] Cleanup: ' + cleanedWindows + ' windows, ' + cleanedBlocks + ' blocks');
        }
    }
    
    function startCleanup() {
        if (_cleanupTimer) clearInterval(_cleanupTimer);
        _cleanupTimer = setInterval(cleanup, config.cleanupIntervalMs);
    }
    
    function stopCleanup() {
        if (_cleanupTimer) {
            clearInterval(_cleanupTimer);
            _cleanupTimer = null;
        }
    }
    
    // ============================================
    // STATISTICS
    // ============================================
    
    function getStats() {
        var activeWindows = 0;
        var activeBlocks = 0;
        
        for (var key in _windows) {
            if (_windows.hasOwnProperty(key)) activeWindows++;
        }
        for (var key in _blockedKeys) {
            if (_blockedKeys.hasOwnProperty(key)) activeBlocks++;
        }
        
        return {
            totalRequests: _stats.totalRequests,
            allowedRequests: _stats.allowedRequests,
            blockedRequests: _stats.blockedRequests,
            activeWindows: activeWindows,
            activeBlocks: activeBlocks,
            whitelisted: Object.keys(_whitelist).length,
            enabled: config.enabled
        };
    }
    
    function getRemainingRequests(key) {
        var identifier = key || generateKey();
        var window = _windows[identifier] || [];
        var now = Date.now();
        
        window = window.filter(function(time) {
            return now - time < config.windowMs;
        });
        
        return Math.max(0, config.maxRequests - window.length);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    // Start cleanup
    startCleanup();
    
    return {
        /**
         * Check rate limit
         */
        check: check,
        
        /**
         * Check endpoint-specific limit
         */
        checkEndpoint: checkEndpoint,
        
        /**
         * Block a key
         */
        block: blockKey,
        
        /**
         * Unblock a key
         */
        unblock: unblockKey,
        
        /**
         * Check if key is blocked
         */
        isBlocked: isBlocked,
        
        /**
         * Add to whitelist
         */
        whitelist: addToWhitelist,
        
        /**
         * Remove from whitelist
         */
        unwhitelist: removeFromWhitelist,
        
        /**
         * Get remaining requests
         */
        getRemaining: getRemainingRequests,
        
        /**
         * Get statistics
         */
        getStats: getStats,
        
        /**
         * Reset all data
         */
        reset: function() {
            _windows = {};
            _blockedKeys = {};
            _stats = {
                totalRequests: 0,
                allowedRequests: 0,
                blockedRequests: 0
            };
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
         * Enable rate limiter
         */
        enable: function() {
            config.enabled = true;
            startCleanup();
        },
        
        /**
         * Disable rate limiter
         */
        disable: function() {
            config.enabled = false;
            stopCleanup();
        },
        
        /**
         * Cleanup manually
         */
        cleanup: cleanup,
        
        /**
         * Destroy (stop cleanup)
         */
        destroy: function() {
            stopCleanup();
            _windows = {};
            _blockedKeys = {};
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // General rate limit
// var result = RateLimiter.check();
// if (!result.allowed) {
//     console.log('Rate limited. Retry in:', result.retryAfter, 'ms');
// }
// 
// // Endpoint-specific
// var loginCheck = RateLimiter.checkEndpoint('login');
// 
// // Check remaining
// var remaining = RateLimiter.getRemaining();
// ============================================