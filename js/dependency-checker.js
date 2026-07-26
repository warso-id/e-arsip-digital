// js/dependency-checker.js - Dependency Checker 2026 (PRIVACY-AWARE)
/**
 * E-Arsip Digital - Dependency Checker
 * Version: 2026.1.0
 * 
 * Features:
 * - Browser API detection
 * - Feature detection
 * - Storage availability test
 * - NO fingerprinting
 * - NO dynamic imports
 */

var DependencyChecker = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _results = {
        apis: [],
        features: {},
        storage: {}
    };
    
    // ============================================
    // API CHECKS (Non-fingerprinting)
    // ============================================
    
    var API_CHECKS = [
        { name: 'Fetch API', test: function() { return typeof fetch !== 'undefined'; } },
        { name: 'Promise', test: function() { return typeof Promise !== 'undefined'; } },
        { name: 'localStorage', test: function() { return testStorage('localStorage'); } },
        { name: 'sessionStorage', test: function() { return testStorage('sessionStorage'); } },
        { name: 'Service Worker', test: function() { return 'serviceWorker' in navigator; } },
        { name: 'Web Crypto API', test: function() { return !!(window.crypto && window.crypto.subtle); } },
        { name: 'Performance API', test: function() { return !!(window.performance && window.performance.now); } },
        { name: 'MutationObserver', test: function() { return typeof MutationObserver !== 'undefined'; } },
        { name: 'IntersectionObserver', test: function() { return typeof IntersectionObserver !== 'undefined'; } },
        { name: 'requestAnimationFrame', test: function() { return typeof requestAnimationFrame !== 'undefined'; } },
        { name: 'URL API', test: function() { return typeof URL !== 'undefined'; } },
        { name: 'Blob', test: function() { return typeof Blob !== 'undefined'; } },
        { name: 'FileReader', test: function() { return typeof FileReader !== 'undefined'; } },
        { name: 'FormData', test: function() { return typeof FormData !== 'undefined'; } },
        { name: 'BroadcastChannel', test: function() { return typeof BroadcastChannel !== 'undefined'; } },
        { name: 'Geolocation', test: function() { return 'geolocation' in navigator; } },
        { name: 'Notification', test: function() { return 'Notification' in window; } },
        { name: 'Clipboard API', test: function() { return 'clipboard' in navigator; } },
        { name: 'Web Share API', test: function() { return 'share' in navigator; } },
        { name: 'Fullscreen API', test: function() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); } },
        { name: 'Touch Support', test: function() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; } },
        { name: 'WebP Support', test: function() { return checkWebP(); } },
        { name: 'WebGL Support', test: function() { return checkWebGL(); } },
        { name: 'IndexedDB', test: function() { return !!window.indexedDB; } },
        { name: 'AudioContext', test: function() { return !!(window.AudioContext || window.webkitAudioContext); } }
    ];
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    function testStorage(type) {
        try {
            var storage = window[type];
            if (!storage) return false;
            
            var testKey = '__earsip_test__';
            storage.setItem(testKey, '1');
            var value = storage.getItem(testKey);
            storage.removeItem(testKey);
            return value === '1';
        } catch(e) {
            return false;
        }
    }
    
    function checkWebP() {
        try {
            var canvas = document.createElement('canvas');
            if (!canvas.toDataURL) return false;
            
            canvas.width = 1;
            canvas.height = 1;
            var dataUrl = canvas.toDataURL('image/webp');
            return dataUrl.indexOf('data:image/webp') === 0;
        } catch(e) {
            return false;
        }
    }
    
    function checkWebGL() {
        try {
            var canvas = document.createElement('canvas');
            if (!canvas.getContext) return false;
            
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch(e) {
            return false;
        }
    }
    
    // ============================================
    // EXTERNAL DEPENDENCY CHECKS
    // ============================================
    
    var EXTERNAL_CHECKS = [
        { name: 'Chart.js', test: function() { return typeof Chart !== 'undefined'; } },
        { name: 'Font Awesome', test: function() { return typeof FontAwesome !== 'undefined' || document.querySelector('link[href*="fontawesome"]') !== null; } },
        { name: 'Bootstrap', test: function() { return typeof bootstrap !== 'undefined'; } },
        { name: 'jQuery', test: function() { return typeof jQuery !== 'undefined'; } },
        { name: 'DOMPurify', test: function() { return typeof DOMPurify !== 'undefined'; } },
        { name: 'jsQR', test: function() { return typeof jsQR !== 'undefined'; } },
        { name: 'XLSX', test: function() { return typeof XLSX !== 'undefined'; } },
        { name: 'jsPDF', test: function() { return typeof jspdf !== 'undefined' || (window.jspdf && typeof window.jspdf.jsPDF !== 'undefined'); } },
        { name: 'AOS (Animate)', test: function() { return typeof AOS !== 'undefined'; } }
    ];
    
    // ============================================
    // MODULE CHECKS (Internal)
    // ============================================
    
    var INTERNAL_CHECKS = [
        { name: 'API Service', test: function() { return !!(window.EArsip && window.EArsip.Api); } },
        { name: 'Auth Service', test: function() { return !!(window.EArsip && window.EArsip.Auth); } },
        { name: 'Config', test: function() { return !!(window.EArsip && window.EArsip.Config); } },
        { name: 'CSRF Protection', test: function() { return typeof CSRFProtection !== 'undefined'; } },
        { name: 'Firewall', test: function() { return typeof Firewall !== 'undefined'; } },
        { name: 'Sanitizer', test: function() { return typeof Sanitizer !== 'undefined'; } },
        { name: 'Audit Trail', test: function() { return typeof AuditTrail !== 'undefined'; } },
        { name: 'Rate Limiter', test: function() { return typeof RateLimiter !== 'undefined'; } },
        { name: 'Cache Manager', test: function() { return typeof CacheManager !== 'undefined'; } },
        { name: 'Chart Manager', test: function() { return typeof ChartManager !== 'undefined'; } }
    ];
    
    // ============================================
    // CHECKS
    // ============================================
    
    function checkAPIs() {
        _results.apis = [];
        
        for (var i = 0; i < API_CHECKS.length; i++) {
            var check = API_CHECKS[i];
            var passed = false;
            
            try {
                passed = check.test();
            } catch(e) {
                passed = false;
            }
            
            _results.apis.push({
                name: check.name,
                passed: passed,
                required: true
            });
        }
    }
    
    function checkExternal() {
        _results.external = [];
        
        for (var i = 0; i < EXTERNAL_CHECKS.length; i++) {
            var check = EXTERNAL_CHECKS[i];
            var available = false;
            
            try {
                available = check.test();
            } catch(e) {
                available = false;
            }
            
            _results.external.push({
                name: check.name,
                available: available
            });
        }
    }
    
    function checkInternal() {
        _results.internal = [];
        
        for (var i = 0; i < INTERNAL_CHECKS.length; i++) {
            var check = INTERNAL_CHECKS[i];
            var available = false;
            
            try {
                available = check.test();
            } catch(e) {
                available = false;
            }
            
            _results.internal.push({
                name: check.name,
                available: available
            });
        }
    }
    
    function checkFeatures() {
        _results.features = {
            touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            geolocation: 'geolocation' in navigator,
            notifications: 'Notification' in window,
            clipboard: 'clipboard' in navigator,
            share: 'share' in navigator,
            fullscreen: !!(document.fullscreenEnabled || document.webkitFullscreenEnabled),
            webp: checkWebP(),
            webgl: checkWebGL(),
            audioContext: !!(window.AudioContext || window.webkitAudioContext),
            speechSynthesis: 'speechSynthesis' in window,
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: !!window.indexedDB,
            online: navigator.onLine
        };
    }
    
    function checkStorage() {
        _results.storage = {
            localStorage: testStorage('localStorage'),
            sessionStorage: testStorage('sessionStorage'),
            indexedDB: !!window.indexedDB,
            cookies: navigator.cookieEnabled
        };
    }
    
    function runAllChecks() {
        checkAPIs();
        checkExternal();
        checkInternal();
        checkFeatures();
        checkStorage();
        
        return _results;
    }
    
    // ============================================
    // REPORT
    // ============================================
    
    function generateReport() {
        runAllChecks();
        
        var passedAPIs = 0;
        var failedAPIs = [];
        
        for (var i = 0; i < _results.apis.length; i++) {
            if (_results.apis[i].passed) {
                passedAPIs++;
            } else {
                failedAPIs.push(_results.apis[i].name);
            }
        }
        
        var availableExternal = 0;
        for (var j = 0; j < (_results.external || []).length; j++) {
            if (_results.external[j].available) availableExternal++;
        }
        
        var availableInternal = 0;
        for (var k = 0; k < (_results.internal || []).length; k++) {
            if (_results.internal[k].available) availableInternal++;
        }
        
        return {
            timestamp: new Date().toISOString(),
            compatibility: {
                score: Math.round((passedAPIs / _results.apis.length) * 100),
                passed: passedAPIs,
                total: _results.apis.length,
                failedAPIs: failedAPIs
            },
            externalModules: {
                available: availableExternal,
                total: (_results.external || []).length
            },
            internalModules: {
                available: availableInternal,
                total: (_results.internal || []).length
            },
            features: _results.features,
            storage: _results.storage,
            recommendations: generateRecommendations(failedAPIs)
        };
    }
    
    function generateRecommendations(failedAPIs) {
        var recommendations = [];
        
        if (failedAPIs.length > 0) {
            recommendations.push({
                priority: 'high',
                message: 'Beberapa API browser tidak tersedia: ' + failedAPIs.join(', '),
                action: 'Perbarui browser atau gunakan polyfill'
            });
        }
        
        if (!_results.features.webp) {
            recommendations.push({
                priority: 'medium',
                message: 'WebP tidak didukung. Gunakan PNG/JPEG sebagai fallback.'
            });
        }
        
        if (!_results.storage.localStorage) {
            recommendations.push({
                priority: 'high',
                message: 'localStorage tidak tersedia. Aplikasi mungkin tidak berfungsi dengan baik.'
            });
        }
        
        return recommendations;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Run all checks
         */
        checkAll: runAllChecks,
        
        /**
         * Generate full report
         */
        generateReport: generateReport,
        
        /**
         * Quick compatibility check
         */
        isCompatible: function() {
            checkAPIs();
            for (var i = 0; i < _results.apis.length; i++) {
                if (!_results.apis[i].passed) {
                    return false;
                }
            }
            return true;
        },
        
        /**
         * Get missing APIs
         */
        getMissingAPIs: function() {
            checkAPIs();
            var missing = [];
            for (var i = 0; i < _results.apis.length; i++) {
                if (!_results.apis[i].passed) {
                    missing.push(_results.apis[i].name);
                }
            }
            return missing;
        },
        
        /**
         * Check specific API
         */
        checkAPI: function(name) {
            for (var i = 0; i < API_CHECKS.length; i++) {
                if (API_CHECKS[i].name.toLowerCase() === name.toLowerCase()) {
                    try {
                        return API_CHECKS[i].test();
                    } catch(e) {
                        return false;
                    }
                }
            }
            return null;
        },
        
        /**
         * Check if storage is available
         */
        isStorageAvailable: function(type) {
            return testStorage(type || 'localStorage');
        },
        
        /**
         * Get results from last check
         */
        getResults: function() {
            return _results;
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Quick check
// if (!DependencyChecker.isCompatible()) {
//     console.warn('Missing APIs:', DependencyChecker.getMissingAPIs());
// }
// 
// // Full report
// var report = DependencyChecker.generateReport();
// console.log('Compatibility score:', report.compatibility.score + '%');
// 
// // Check specific
// if (DependencyChecker.checkAPI('Service Worker')) {
//     // Register service worker
// }
// ============================================