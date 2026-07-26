// js/security/security.js - Security Manager (Main) 2026
/**
 * E-Arsip Digital - Security Manager
 * Version: 2026.1.0
 * 
 * Central security coordinator.
 * Hanya menggunakan modul yang SUDAH ADA dan TERBUKTI.
 * Tidak membuat asumsi tentang method yang tidak ada.
 */

var SecurityManager = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _modules = {};           // { name: moduleObject }
    var _posture = {
        level: 'normal',        // normal, elevated, high, critical
        lastAssessment: null,
        threatsDetected: 0,
        activeIncidents: 0
    };
    var _initialized = false;
    
    // ============================================
    // MODULE REGISTRATION
    // ============================================
    
    /**
     * Register modul keamanan
     */
    function registerModule(name, module) {
        if (!module) {
            console.warn('[SecurityManager] Module "' + name + '" not available');
            return false;
        }
        _modules[name] = module;
        return true;
    }
    
    /**
     * Get module by name
     */
    function getModule(name) {
        return _modules[name] || null;
    }
    
    /**
     * Check if module is registered
     */
    function hasModule(name) {
        return !!_modules[name];
    }
    
    /**
     * Auto-detect available modules
     */
    function autoDetectModules() {
        // Hanya modul yang SUDAH ADA di project
        if (typeof CSRFProtection !== 'undefined') registerModule('csrf', CSRFProtection);
        if (typeof Firewall !== 'undefined') registerModule('firewall', Firewall);
        if (typeof RateLimiter !== 'undefined') registerModule('rateLimiter', RateLimiter);
        if (typeof IntrusionDetection !== 'undefined') registerModule('ids', IntrusionDetection);
        if (typeof AuditTrail !== 'undefined') registerModule('audit', AuditTrail);
        if (typeof Sanitizer !== 'undefined') registerModule('sanitizer', Sanitizer);
        if (typeof EncryptionService !== 'undefined') registerModule('encryption', EncryptionService);
        if (typeof SecureStorage !== 'undefined') registerModule('storage', SecureStorage);
        if (typeof SecureHeaders !== 'undefined') registerModule('headers', SecureHeaders);
        if (typeof SecurityOrchestrator !== 'undefined') registerModule('orchestrator', SecurityOrchestrator);
    }
    
    /**
     * Get list of active module names
     */
    function getActiveModules() {
        return Object.keys(_modules);
    }
    
    // ============================================
    // SECURITY POSTURE
    // ============================================
    
    function getPosture() {
        return {
            level: _posture.level,
            lastAssessment: _posture.lastAssessment,
            threatsDetected: _posture.threatsDetected,
            activeIncidents: _posture.activeIncidents
        };
    }
    
    function escalatePosture(level) {
        var levels = ['normal', 'elevated', 'high', 'critical'];
        var currentIdx = levels.indexOf(_posture.level);
        var targetIdx = levels.indexOf(level);
        
        if (targetIdx > currentIdx) {
            var oldLevel = _posture.level;
            _posture.level = level;
            console.warn('[SecurityManager] Posture escalated: ' + oldLevel + ' -> ' + level);
        }
    }
    
    function deescalatePosture() {
        var levels = ['normal', 'elevated', 'high', 'critical'];
        var currentIdx = levels.indexOf(_posture.level);
        
        if (currentIdx > 0) {
            _posture.level = levels[currentIdx - 1];
            _posture.activeIncidents = Math.max(0, _posture.activeIncidents - 1);
        }
    }
    
    // ============================================
    // SECURITY ASSESSMENT
    // ============================================
    
    function assessSecurity() {
        var findings = [];
        var score = 100;
        
        // Check HTTPS
        if (window.location.protocol !== 'https:') {
            findings.push({
                type: 'https',
                severity: 'high',
                message: 'HTTPS tidak aktif'
            });
            score -= 20;
        }
        
        // Check CSP
        var cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!cspMeta) {
            findings.push({
                type: 'csp',
                severity: 'medium',
                message: 'CSP meta tag tidak ditemukan'
            });
            score -= 10;
        }
        
        // Check active modules
        var activeCount = Object.keys(_modules).length;
        if (activeCount < 3) {
            findings.push({
                type: 'modules',
                severity: 'low',
                message: 'Hanya ' + activeCount + ' modul keamanan aktif'
            });
            score -= 5;
        }
        
        // Update posture based on score
        if (score >= 80) _posture.level = 'normal';
        else if (score >= 60) _posture.level = 'elevated';
        else if (score >= 40) _posture.level = 'high';
        else _posture.level = 'critical';
        
        _posture.lastAssessment = new Date().toISOString();
        
        return {
            score: score,
            level: _posture.level,
            findings: findings,
            activeModules: Object.keys(_modules)
        };
    }
    
    // ============================================
    // THREAT HANDLING
    // ============================================
    
    function handleThreat(threat) {
        _posture.threatsDetected++;
        
        var threatInfo = threat || {};
        
        // Log to audit trail if available
        if (_modules.audit && typeof _modules.audit.logSecurity === 'function') {
            _modules.audit.logSecurity('THREAT_DETECTED', {
                type: threatInfo.type || 'unknown',
                details: threatInfo
            });
        }
        
        // Escalate if critical
        if (threatInfo.severity === 'critical') {
            escalatePosture('critical');
        }
        
        // Dispatch event
        try {
            window.dispatchEvent(new CustomEvent('security:threat', {
                detail: threatInfo
            }));
        } catch(e) {}
        
        console.warn('[SecurityManager] Threat:', threatInfo.type || 'unknown');
        
        return {
            handled: true,
            posture: _posture.level
        };
    }
    
    // ============================================
    // SANITIZATION (Delegation)
    // ============================================
    
    function sanitize(value, options) {
        // Gunakan Sanitizer jika tersedia
        if (_modules.sanitizer && typeof _modules.sanitizer.clean === 'function') {
            return _modules.sanitizer.clean(value, options);
        }
        
        // Fallback: sanitize sederhana
        if (typeof value === 'string') {
            return value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        }
        
        return value;
    }
    
    // ============================================
    // TOKEN GENERATION (Delegation)
    // ============================================
    
    function generateCSRFToken() {
        if (_modules.csrf && typeof _modules.csrf.getToken === 'function') {
            return _modules.csrf.getToken();
        }
        
        // Fallback
        var arr = new Uint8Array(16);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(arr);
        }
        var token = '';
        for (var i = 0; i < arr.length; i++) {
            token += ('0' + arr[i].toString(16)).slice(-2);
        }
        return token;
    }
    
    // ============================================
    // ENCRYPTION (Delegation)
    // ============================================
    
    function encrypt(data, password) {
        if (_modules.encryption && typeof _modules.encryption.encrypt === 'function') {
            return _modules.encryption.encrypt(data, password);
        }
        console.warn('[SecurityManager] Encryption module not available');
        return Promise.resolve(null);
    }
    
    function decrypt(data, password) {
        if (_modules.encryption && typeof _modules.encryption.decrypt === 'function') {
            return _modules.encryption.decrypt(data, password);
        }
        console.warn('[SecurityManager] Encryption module not available');
        return Promise.resolve(null);
    }
    
    // ============================================
    // REPORTING
    // ============================================
    
    function getReport() {
        var moduleStatus = {};
        var moduleNames = Object.keys(_modules);
        
        for (var i = 0; i < moduleNames.length; i++) {
            moduleStatus[moduleNames[i]] = {
                registered: true
            };
        }
        
        return {
            timestamp: new Date().toISOString(),
            posture: getPosture(),
            modules: moduleStatus,
            activeModuleCount: moduleNames.length,
            assessment: assessSecurity()
        };
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        if (_initialized) return getReport();
        
        // Auto-detect modules
        autoDetectModules();
        
        // Initial assessment
        assessSecurity();
        
        _initialized = true;
        
        var count = Object.keys(_modules).length;
        console.info('[SecurityManager] Initialized with ' + count + ' modules');
        
        return {
            modules: Object.keys(_modules),
            posture: _posture.level,
            initialized: true
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Initialization
        init: init,
        
        // Module management
        register: registerModule,
        getModule: getModule,
        hasModule: hasModule,
        getActiveModules: getActiveModules,
        
        // Posture
        getPosture: getPosture,
        escalatePosture: escalatePosture,
        deescalatePosture: deescalatePosture,
        
        // Security operations
        assessSecurity: assessSecurity,
        handleThreat: handleThreat,
        sanitize: sanitize,
        
        // Utilities
        generateCSRFToken: generateCSRFToken,
        encrypt: encrypt,
        decrypt: decrypt,
        
        // Reporting
        getReport: getReport,
        
        // Reset
        reset: function() {
            _posture = {
                level: 'normal',
                lastAssessment: null,
                threatsDetected: 0,
                activeIncidents: 0
            };
        },
        
        // Check if initialized
        isInitialized: function() {
            return _initialized;
        }
    };
})();

// ============================================
// AUTO-INIT (non-blocking)
// ============================================
setTimeout(function() {
    SecurityManager.init();
}, 200);

// ============================================
// USAGE:
// ============================================
// // Initialize
// SecurityManager.init();
// 
// // Register custom module
// SecurityManager.register('myModule', myModuleObject);
// 
// // Sanitize input
// var clean = SecurityManager.sanitize('<script>alert(1)</script>');
// 
// // Handle threat
// SecurityManager.handleThreat({ type: 'xss', severity: 'high' });
// 
// // Generate CSRF token
// var token = SecurityManager.generateCSRFToken();
// 
// // Get report
// var report = SecurityManager.getReport();
// ============================================