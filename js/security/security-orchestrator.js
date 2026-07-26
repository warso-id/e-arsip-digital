// js/security/security-orchestrator.js - Security Orchestrator 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Security Orchestrator
 * Version: 2026.1.0
 * 
 * Central security coordinator.
 * Hanya mengorkestrasi modul yang SUDAH ADA.
 * Tidak membuat dependency baru.
 */

var SecurityOrchestrator = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: true,
        autoScan: false,          // Jangan auto-scan (berat)
        logLevel: 'warn'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _modules = {};            // Modul yang terdaftar
    var _policies = {};           // Security policies
    var _listeners = {};          // Event listeners
    var _stats = {
        threatsDetected: 0,
        attacksBlocked: 0,
        lastThreatTime: null
    };
    var _initialized = false;
    
    // ============================================
    // MODULE REGISTRATION
    // ============================================
    
    /**
     * Register modul keamanan (hanya yang ADA)
     */
    function registerModule(name, module) {
        if (!module) {
            console.warn('[Orchestrator] Module not available: ' + name);
            return false;
        }
        
        _modules[name] = module;
        console.info('[Orchestrator] Registered: ' + name);
        return true;
    }
    
    /**
     * Auto-detect dan register modul yang tersedia
     */
    function autoRegisterModules() {
        // CSRF Protection
        if (typeof CSRFProtection !== 'undefined') {
            registerModule('csrf', CSRFProtection);
        }
        
        // Firewall
        if (typeof Firewall !== 'undefined') {
            registerModule('firewall', Firewall);
        }
        
        // Rate Limiter
        if (typeof RateLimiter !== 'undefined') {
            registerModule('rateLimiter', RateLimiter);
        }
        
        // Intrusion Detection
        if (typeof IntrusionDetection !== 'undefined') {
            registerModule('ids', IntrusionDetection);
        }
        
        // Audit Trail
        if (typeof AuditTrail !== 'undefined') {
            registerModule('audit', AuditTrail);
        }
        
        // Sanitizer
        if (typeof Sanitizer !== 'undefined') {
            registerModule('sanitizer', Sanitizer);
        }
        
        // Encryption Service
        if (typeof EncryptionService !== 'undefined') {
            registerModule('encryption', EncryptionService);
        }
        
        // Secure Storage
        if (typeof SecureStorage !== 'undefined') {
            registerModule('storage', SecureStorage);
        }
        
        // Secure Headers
        if (typeof SecureHeaders !== 'undefined') {
            registerModule('headers', SecureHeaders);
        }
    }
    
    // ============================================
    // POLICY MANAGEMENT
    // ============================================
    
    function setPolicy(name, policy) {
        _policies[name] = policy;
    }
    
    function getPolicy(name) {
        return _policies[name] || null;
    }
    
    function loadDefaultPolicies() {
        setPolicy('password', {
            minLength: 8,
            requireUppercase: true,
            requireNumber: true,
            requireSpecialChar: true
        });
        
        setPolicy('session', {
            idleTimeout: 1800000,      // 30 menit
            absoluteTimeout: 28800000  // 8 jam
        });
        
        setPolicy('upload', {
            maxSize: 10485760,         // 10MB
            allowedTypes: ['application/pdf', 'image/jpeg', 'image/png']
        });
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    function on(event, callback) {
        if (!_listeners[event]) {
            _listeners[event] = [];
        }
        _listeners[event].push(callback);
        
        // Return unsubscribe
        return function() {
            if (_listeners[event]) {
                _listeners[event] = _listeners[event].filter(function(cb) {
                    return cb !== callback;
                });
            }
        };
    }
    
    function emit(event, data) {
        if (_listeners[event]) {
            for (var i = 0; i < _listeners[event].length; i++) {
                try {
                    _listeners[event][i](data);
                } catch(e) {}
            }
        }
    }
    
    // ============================================
    // SECURITY EVENT HANDLING
    // ============================================
    
    function handleSecurityEvent(type, details) {
        _stats.threatsDetected++;
        _stats.lastThreatTime = Date.now();
        
        console.warn('[Orchestrator] Security event: ' + type, details || '');
        
        // Log ke audit trail
        if (_modules.audit && typeof _modules.audit.logSecurity === 'function') {
            _modules.audit.logSecurity('ORCHESTRATOR_EVENT', {
                type: type,
                details: details
            });
        }
        
        // Emit event
        emit('threat', { type: type, details: details, time: Date.now() });
        
        // Critical threats
        if (type === 'intrusion_detected' || type === 'critical') {
            handleCriticalThreat(type, details);
        }
    }
    
    function handleCriticalThreat(type, details) {
        console.error('[Orchestrator] CRITICAL: ' + type);
        
        // Enable strict mode di rate limiter jika ada
        if (_modules.rateLimiter && typeof _modules.rateLimiter.configure === 'function') {
            _modules.rateLimiter.configure({ maxRequests: 10, windowMs: 60000 });
        }
        
        emit('critical', { type: type, details: details });
    }
    
    // ============================================
    // SECURITY SCAN (Lightweight)
    // ============================================
    
    function performScan() {
        var results = {
            timestamp: new Date().toISOString(),
            issues: [],
            score: 100
        };
        
        // Check HTTPS
        if (window.location.protocol !== 'https:') {
            results.issues.push({
                severity: 'high',
                message: 'Halaman tidak menggunakan HTTPS'
            });
            results.score -= 20;
        }
        
        // Check CSP
        var cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!cspMeta) {
            results.issues.push({
                severity: 'medium',
                message: 'CSP meta tag tidak ditemukan'
            });
            results.score -= 10;
        }
        
        // Check modul yang aktif
        var activeModules = Object.keys(_modules);
        if (activeModules.length < 3) {
            results.issues.push({
                severity: 'low',
                message: 'Hanya ' + activeModules.length + ' modul keamanan aktif'
            });
            results.score -= 5;
        }
        
        return results;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function init() {
        if (_initialized) return;
        
        // Register modul yang tersedia
        autoRegisterModules();
        
        // Load policies
        loadDefaultPolicies();
        
        // Listen untuk event dari modul lain
        window.addEventListener('firewall:blocked', function(e) {
            handleSecurityEvent('firewall_block', e.detail);
        });
        
        window.addEventListener('ids:alert', function(e) {
            handleSecurityEvent('intrusion_alert', e.detail);
        });
        
        window.addEventListener('ids:block', function(e) {
            handleSecurityEvent('intrusion_block', e.detail);
        });
        
        _initialized = true;
        
        var moduleCount = Object.keys(_modules).length;
        console.info('[Orchestrator] Initialized with ' + moduleCount + ' modules');
        
        return {
            modules: Object.keys(_modules),
            policies: Object.keys(_policies)
        };
    }
    
    // Auto-init (tapi tidak blocking)
    setTimeout(init, 100);
    
    return {
        init: init,
        
        /**
         * Register modul keamanan
         */
        register: registerModule,
        
        /**
         * Get registered module
         */
        getModule: function(name) {
            return _modules[name] || null;
        },
        
        /**
         * Get all registered modules
         */
        getModules: function() {
            return Object.keys(_modules);
        },
        
        /**
         * Handle security event
         */
        handleEvent: handleSecurityEvent,
        
        /**
         * Set security policy
         */
        setPolicy: setPolicy,
        
        /**
         * Get security policy
         */
        getPolicy: getPolicy,
        
        /**
         * Listen for events
         */
        on: on,
        
        /**
         * Perform security scan
         */
        scan: performScan,
        
        /**
         * Get statistics
         */
        getStats: function() {
            return {
                threatsDetected: _stats.threatsDetected,
                attacksBlocked: _stats.attacksBlocked,
                lastThreatTime: _stats.lastThreatTime,
                activeModules: Object.keys(_modules).length,
                initialized: _initialized
            };
        },
        
        /**
         * Generate security report
         */
        getReport: function() {
            return {
                timestamp: new Date().toISOString(),
                stats: {
                    threatsDetected: _stats.threatsDetected,
                    attacksBlocked: _stats.attacksBlocked,
                    lastThreatTime: _stats.lastThreatTime
                },
                modules: Object.keys(_modules),
                policies: Object.keys(_policies),
                scan: performScan()
            };
        },
        
        /**
         * Check if module is available
         */
        hasModule: function(name) {
            return !!_modules[name];
        },
        
        /**
         * Reset stats
         */
        reset: function() {
            _stats = {
                threatsDetected: 0,
                attacksBlocked: 0,
                lastThreatTime: null
            };
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Register module
// SecurityOrchestrator.register('csrf', CSRFProtection);
// 
// // Handle event
// SecurityOrchestrator.handleEvent('xss_attempt', { payload: '...' });
// 
// // Listen for threats
// SecurityOrchestrator.on('threat', function(data) {
//     console.warn('Threat:', data.type);
// });
// 
// // Get report
// var report = SecurityOrchestrator.getReport();
// ============================================