// js/init.js - Application Initialization 2026 (SAFE)
/**
 * E-Arsip Digital - Global Initialization
 * Version: 2026.1.0
 * 
 * Fitur:
 * - Safe module initialization
 * - Service Worker registration
 * - Offline detection
 * - Keyboard shortcuts
 * - PWA install prompt
 * - Graceful error handling
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var APP_VERSION = '2026.1.0';
    var APP_ENV = 'production';
    
    // Override dari config jika tersedia
    if (window.EArsip && window.EArsip.Config && window.EArsip.Config.app) {
        APP_VERSION = window.EArsip.Config.app.version || APP_VERSION;
        APP_ENV = window.EArsip.Config.app.environment || APP_ENV;
    }
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _initialized = false;
    var _initStartTime = Date.now();
    var _loadedModules = [];
    
    // ============================================
    // SAFE MODULE CHECK
    // ============================================
    
    function isModuleAvailable(name) {
        switch (name) {
            case 'auth':
                return !!(window.EArsip && window.EArsip.Auth);
            case 'api':
                return !!(window.EArsip && window.EArsip.Api);
            case 'csrf':
                return typeof CSRFProtection !== 'undefined';
            case 'firewall':
                return typeof Firewall !== 'undefined';
            case 'rateLimiter':
                return typeof RateLimiter !== 'undefined';
            case 'sanitizer':
                return typeof Sanitizer !== 'undefined';
            case 'audit':
                return typeof AuditTrail !== 'undefined';
            case 'notifications':
                return typeof NotificationSystem !== 'undefined';
            case 'cache':
                return typeof CacheManager !== 'undefined';
            case 'i18n':
                return typeof I18n !== 'undefined';
            case 'errorHandler':
                return typeof ErrorHandler !== 'undefined';
            default:
                return false;
        }
    }
    
    function tryInitModule(name) {
        if (isModuleAvailable(name)) {
            _loadedModules.push(name);
            console.log('[Init] Module loaded: ' + name);
            return true;
        }
        return false;
    }
    
    // ============================================
    // CORE INITIALIZATION
    // ============================================
    
    function initCore() {
        console.log('[Init] Starting... v' + APP_VERSION + ' (' + APP_ENV + ')');
        
        // Check available modules (non-blocking)
        tryInitModule('auth');
        tryInitModule('api');
        tryInitModule('csrf');
        tryInitModule('firewall');
        tryInitModule('rateLimiter');
        tryInitModule('sanitizer');
        tryInitModule('audit');
        tryInitModule('notifications');
        tryInitModule('cache');
        tryInitModule('i18n');
        tryInitModule('errorHandler');
        
        console.log('[Init] Available modules: ' + _loadedModules.length);
    }
    
    // ============================================
    // SERVICE WORKER
    // ============================================
    
    function setupServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            // Path relatif ke root
            var swPath = '../sw.js';
            
            // Jika di subfolder GitHub Pages, sesuaikan
            var pathParts = window.location.pathname.split('/');
            if (pathParts.length > 2 && pathParts[1]) {
                swPath = '/' + pathParts[1] + '/sw.js';
            }
            
            navigator.serviceWorker.register(swPath)
                .then(function(registration) {
                    console.log('[Init] SW registered: ' + registration.scope);
                })
                .catch(function(error) {
                    console.warn('[Init] SW failed: ' + error.message);
                });
        } catch(e) {
            console.warn('[Init] SW error: ' + e.message);
        }
    }
    
    // ============================================
    // OFFLINE DETECTION
    // ============================================
    
    function setupOfflineDetection() {
        window.addEventListener('online', function() {
            document.body.classList.remove('offline');
            if (typeof NotificationSystem !== 'undefined') {
                NotificationSystem.success('Koneksi internet kembali');
            }
        });
        
        window.addEventListener('offline', function() {
            document.body.classList.add('offline');
            if (typeof NotificationSystem !== 'undefined') {
                NotificationSystem.warning('Koneksi internet terputus', { duration: 0 });
            }
        });
        
        // Initial check
        if (!navigator.onLine) {
            document.body.classList.add('offline');
        }
    }
    
    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+K: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                var searchInput = document.querySelector('[data-search-input], #search-input, .search-input, input[type="search"]');
                if (searchInput) searchInput.focus();
            }
            
            // Escape: Close modals
            if (e.key === 'Escape') {
                var modals = document.querySelectorAll('.modal-overlay.visible, .modal-overlay.active');
                for (var i = 0; i < modals.length; i++) {
                    modals[i].classList.remove('visible', 'active');
                }
            }
        });
    }
    
    // ============================================
    // PWA INSTALL PROMPT
    // ============================================
    
    function setupPWAInstall() {
        var deferredPrompt = null;
        
        window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            deferredPrompt = e;
            
            // Tampilkan tombol install setelah 30 detik
            setTimeout(function() {
                if (deferredPrompt && confirm('Install aplikasi ini untuk akses cepat?')) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then(function(result) {
                        console.log('[Init] PWA install: ' + result.outcome);
                    });
                }
                deferredPrompt = null;
            }, 30000);
        });
    }
    
    // ============================================
    // GLOBAL ERROR HANDLING
    // ============================================
    
    function setupGlobalErrorHandling() {
        // Uncaught errors
        window.addEventListener('error', function(event) {
            var msg = event.message || 'Unknown error';
            var file = event.filename || '';
            var line = event.lineno || 0;
            
            console.error('[Init] Uncaught error: ' + msg + ' at ' + file + ':' + line);
            
            // Prevent white screen di production
            if (APP_ENV === 'production') {
                // Jangan prevent default - biarkan error handler lain bekerja
            }
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
            var reason = event.reason;
            var msg = 'Unknown rejection';
            
            if (reason && reason.message) {
                msg = reason.message;
            } else if (typeof reason === 'string') {
                msg = reason;
            }
            
            console.error('[Init] Unhandled rejection: ' + msg);
        });
    }
    
    // ============================================
    // LOADING SCREEN
    // ============================================
    
    function hideLoadingScreen() {
        var loader = document.getElementById('loading-screen');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(function() {
                if (loader.parentNode) {
                    loader.style.display = 'none';
                }
            }, 400);
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        if (_initialized) return;
        
        try {
            // Core modules
            initCore();
            
            // Service Worker
            setupServiceWorker();
            
            // Offline detection
            setupOfflineDetection();
            
            // Keyboard shortcuts
            setupKeyboardShortcuts();
            
            // PWA install
            setupPWAInstall();
            
            // Global error handling
            setupGlobalErrorHandling();
            
            // Hide loading screen
            hideLoadingScreen();
            
            _initialized = true;
            
            var initTime = Date.now() - _initStartTime;
            console.log('[Init] Complete in ' + initTime + 'ms (' + _loadedModules.length + ' modules)');
            
            // Dispatch ready event
            try {
                window.dispatchEvent(new CustomEvent('app:ready', {
                    detail: { initTime: initTime, modules: _loadedModules }
                }));
            } catch(e) {}
            
        } catch(error) {
            console.error('[Init] Failed: ' + (error.message || 'Unknown error'));
            
            // Tampilkan error page minimal
            var body = document.body;
            if (body) {
                body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;text-align:center;padding:20px;">' +
                    '<div><h2 style="color:#dc2626;">Gagal Memuat Aplikasi</h2>' +
                    '<p style="color:#666;">Silakan muat ulang halaman</p>' +
                    '<button onclick="location.reload()" style="margin-top:12px;padding:10px 20px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Muat Ulang</button></div></div>';
            }
        }
    }
    
    // ============================================
    // START
    // ============================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready, delay sedikit untuk biarkan modul lain init
        setTimeout(init, 100);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    window.AppInit = {
        isInitialized: function() { return _initialized; },
        getLoadedModules: function() { return _loadedModules.slice(); },
        getInitTime: function() { return Date.now() - _initStartTime; },
        getVersion: function() { return APP_VERSION; },
        getEnvironment: function() { return APP_ENV; }
    };
    
})();

// ============================================
// USAGE:
// ============================================
// // Check if initialized
// AppInit.isInitialized();
// 
// // Get loaded modules
// AppInit.getLoadedModules();
// 
// // Get init time
// AppInit.getInitTime();
// ============================================