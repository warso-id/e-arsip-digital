// js/error-handler.js - Global Error Handler 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Global Error Handler
 * Version: 2026.1.0
 * 
 * Features:
 * - Global error catching (window.onerror, unhandledrejection)
 * - Error classification
 * - Recovery strategies
 * - Error history
 * - No external dependencies
 */

var ErrorHandler = (function() {
    'use strict';
    
    // ============================================
    // CONSTANTS
    // ============================================
    var SEVERITY = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };
    
    var CATEGORY = {
        NETWORK: 'network',
        AUTH: 'auth',
        VALIDATION: 'validation',
        API: 'api',
        RUNTIME: 'runtime',
        SECURITY: 'security',
        UNKNOWN: 'unknown'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _errorHistory = [];
    var _maxHistory = 50;
    var _recoveryStrategies = {};
    var _errorRate = {
        window: 60000,
        errors: [],
        threshold: 5
    };
    var _initialized = false;
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    function generateErrorId() {
        return 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    }
    
    function sanitizeURL(url) {
        if (!url) return '';
        try {
            var parsed = new URL(url);
            return parsed.origin + parsed.pathname;
        } catch(e) {
            return '';
        }
    }
    
    // ============================================
    // ERROR CLASSIFICATION
    // ============================================
    
    function classifyError(error, context) {
        var info = {
            id: generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error ? (error.message || String(error)) : 'Unknown error',
            name: error ? (error.name || 'Error') : 'Error',
            category: (context && context.category) || CATEGORY.UNKNOWN,
            severity: (context && context.severity) || SEVERITY.MEDIUM,
            source: (context && context.source) || 'unknown',
            code: (error && (error.code || error.status)) || null,
            recoverable: (context && context.recoverable !== false),
            recovered: false,
            handled: false
        };
        
        // Auto-classify
        if (error) {
            if (error.name === 'TypeError' || error.name === 'ReferenceError') {
                info.category = CATEGORY.RUNTIME;
            } else if (error.message && (error.message.indexOf('network') !== -1 || error.message.indexOf('fetch') !== -1)) {
                info.category = CATEGORY.NETWORK;
            } else if (error.status === 401 || error.status === 403) {
                info.category = CATEGORY.AUTH;
                info.severity = SEVERITY.HIGH;
            } else if (error.name === 'SecurityError') {
                info.category = CATEGORY.SECURITY;
                info.severity = SEVERITY.CRITICAL;
            }
        }
        
        return info;
    }
    
    // ============================================
    // ERROR HANDLING
    // ============================================
    
    function handleError(error, context) {
        var info = classifyError(error, context);
        
        // Log ke console
        logError(info);
        
        // Track error rate
        trackErrorRate(info);
        
        // Add to history
        addToHistory(info);
        
        // Notify user
        notifyUser(info);
        
        // Attempt recovery
        attemptRecovery(info);
        
        // Mark as handled
        info.handled = true;
        
        return info;
    }
    
    function logError(info) {
        var method = 'error';
        if (info.severity === SEVERITY.LOW) method = 'warn';
        
        console[method]('[ErrorHandler] ' + info.message + ' (' + info.id + ')');
    }
    
    function notifyUser(info) {
        // Jangan tampilkan notifikasi untuk severity low
        if (info.severity === SEVERITY.LOW) return;
        
        var messages = {};
        messages[CATEGORY.NETWORK] = 'Gagal terhubung ke server. Periksa koneksi internet.';
        messages[CATEGORY.AUTH] = 'Sesi telah berakhir. Silakan login kembali.';
        messages[CATEGORY.API] = 'Terjadi kesalahan server. Silakan coba lagi.';
        messages[CATEGORY.RUNTIME] = 'Terjadi kesalahan aplikasi.';
        messages[CATEGORY.UNKNOWN] = 'Terjadi kesalahan.';
        
        var message = messages[info.category] || info.message;
        
        // Gunakan toast notification jika tersedia
        if (typeof NotificationSystem !== 'undefined' && NotificationSystem.error) {
            if (info.severity === SEVERITY.CRITICAL) {
                NotificationSystem.error(message, { duration: 0 });
            } else {
                NotificationSystem.error(message, { duration: 8000 });
            }
        } else {
            console.error(message);
        }
    }
    
    // ============================================
    // ERROR TRACKING
    // ============================================
    
    function trackErrorRate(info) {
        var now = Date.now();
        
        _errorRate.errors.push({ timestamp: now });
        
        // Remove old entries
        _errorRate.errors = _errorRate.errors.filter(function(e) {
            return now - e.timestamp < _errorRate.window;
        });
        
        // Check threshold
        if (_errorRate.errors.length >= _errorRate.threshold) {
            console.warn('[ErrorHandler] High error rate: ' + _errorRate.errors.length + ' in ' + (_errorRate.window / 1000) + 's');
        }
    }
    
    function addToHistory(info) {
        _errorHistory.unshift(info);
        
        if (_errorHistory.length > _maxHistory) {
            _errorHistory = _errorHistory.slice(0, _maxHistory);
        }
    }
    
    // ============================================
    // RECOVERY STRATEGIES
    // ============================================
    
    function registerRecoveryStrategy(category, strategy) {
        _recoveryStrategies[category] = strategy;
    }
    
    function attemptRecovery(info) {
        if (!info.recoverable) return false;
        
        var strategy = _recoveryStrategies[info.category];
        if (!strategy) return false;
        
        try {
            var canRecover = strategy.canRecover ? strategy.canRecover() : true;
            if (!canRecover) return false;
            
            strategy.recover(info);
            info.recovered = true;
            
            return true;
        } catch(e) {
            return false;
        }
    }
    
    function setupDefaultStrategies() {
        // Network recovery
        registerRecoveryStrategy(CATEGORY.NETWORK, {
            canRecover: function() { return navigator.onLine; },
            recover: function() {
                window.addEventListener('online', function handler() {
                    window.removeEventListener('online', handler);
                    window.dispatchEvent(new CustomEvent('app:reconnect'));
                }, { once: true });
            }
        });
        
        // Auth recovery
        registerRecoveryStrategy(CATEGORY.AUTH, {
            recover: function() {
                localStorage.removeItem('auth_session');
                localStorage.removeItem('auth_token');
                setTimeout(function() {
                    window.location.href = '../login.html?message=session_expired';
                }, 2000);
            }
        });
    }
    
    // ============================================
    // GLOBAL HANDLERS
    // ============================================
    
    function setupGlobalHandlers() {
        // Uncaught errors
        window.addEventListener('error', function(event) {
            var error = event.error || new Error(event.message);
            handleError(error, {
                category: CATEGORY.RUNTIME,
                severity: SEVERITY.HIGH,
                source: 'window.onerror'
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
            var error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
            handleError(error, {
                category: CATEGORY.RUNTIME,
                severity: SEVERITY.HIGH,
                source: 'unhandledrejection'
            });
        });
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function init() {
        if (_initialized) return;
        
        setupDefaultStrategies();
        setupGlobalHandlers();
        
        _initialized = true;
        console.info('[ErrorHandler] Initialized');
    }
    
    // Auto-init
    setTimeout(init, 50);
    
    return {
        init: init,
        handle: handleError,
        
        /**
         * Get error history
         */
        getHistory: function(limit) {
            if (limit) return _errorHistory.slice(0, limit);
            return _errorHistory.slice();
        },
        
        /**
         * Get error stats
         */
        getStats: function() {
            var stats = {
                total: _errorHistory.length,
                byCategory: {},
                bySeverity: {},
                recovered: 0,
                currentRate: _errorRate.errors.length
            };
            
            for (var i = 0; i < _errorHistory.length; i++) {
                var e = _errorHistory[i];
                stats.byCategory[e.category] = (stats.byCategory[e.category] || 0) + 1;
                stats.bySeverity[e.severity] = (stats.bySeverity[e.severity] || 0) + 1;
                if (e.recovered) stats.recovered++;
            }
            
            return stats;
        },
        
        /**
         * Register custom recovery strategy
         */
        registerRecovery: registerRecoveryStrategy,
        
        /**
         * Clear error history
         */
        clearHistory: function() {
            _errorHistory = [];
            _errorRate.errors = [];
        },
        
        /**
         * Check if handler is initialized
         */
        isInitialized: function() {
            return _initialized;
        },
        
        // Constants
        SEVERITY: SEVERITY,
        CATEGORY: CATEGORY
    };
})();

// ============================================
// USAGE:
// ============================================
// try {
//     riskyOperation();
// } catch(e) {
//     ErrorHandler.handle(e, { category: ErrorHandler.CATEGORY.API });
// }
// 
// var stats = ErrorHandler.getStats();
// var recent = ErrorHandler.getHistory(5);
// ============================================