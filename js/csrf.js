// js/csrf.js - CSRF Protection 2026 (NON-INVASIVE)
/**
 * E-Arsip Digital - CSRF Protection
 * Version: 2026.1.0
 * 
 * Features:
 * - Token generation (crypto API)
 * - Token storage (sessionStorage + fallback)
 * - Form auto-injection
 * - Non-invasive (TIDAK override fetch/XHR!)
 * - PWA mobile compatible
 */

var CSRFProtection = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-CSRF-Token',
        formFieldName: '_csrf_token',
        tokenLength: 32,
        tokenExpiry: 3600000,    // 1 jam - auto refresh
        storageKey: 'csrf_token',
        renewOnUse: true
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _currentToken = null;
    var _tokenExpiry = null;
    
    // ============================================
    // TOKEN GENERATION
    // ============================================
    
    /**
     * Generate random token (IE compatible)
     */
    function generateToken() {
        var length = config.tokenLength;
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var result = '';
        
        // Gunakan crypto API jika tersedia
        if (window.crypto && window.crypto.getRandomValues) {
            var array = new Uint8Array(length);
            window.crypto.getRandomValues(array);
            
            for (var i = 0; i < array.length; i++) {
                result += chars.charAt(array[i] % chars.length);
            }
        } else {
            // Fallback: Math.random
            for (var j = 0; j < length; j++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        
        return result;
    }
    
    // ============================================
    // TOKEN STORAGE
    // ============================================
    
    function getStoredToken() {
        try {
            var token = sessionStorage.getItem(config.storageKey);
            if (token) return token;
            
            // Fallback ke localStorage
            token = localStorage.getItem(config.storageKey);
            if (token) {
                // Pindahkan ke sessionStorage
                sessionStorage.setItem(config.storageKey, token);
                return token;
            }
        } catch(e) {}
        
        return null;
    }
    
    function storeToken(token) {
        _currentToken = token;
        _tokenExpiry = Date.now() + config.tokenExpiry;
        
        try {
            sessionStorage.setItem(config.storageKey, token);
            // Backup ke localStorage
            localStorage.setItem(config.storageKey, token);
        } catch(e) {
            console.warn('[CSRF] Failed to store token');
        }
    }
    
    function clearToken() {
        _currentToken = null;
        _tokenExpiry = null;
        
        try {
            sessionStorage.removeItem(config.storageKey);
            localStorage.removeItem(config.storageKey);
        } catch(e) {}
    }
    
    // ============================================
    // TOKEN MANAGEMENT
    // ============================================
    
    function getToken() {
        // Cek expiry
        if (_tokenExpiry && Date.now() > _tokenExpiry) {
            refreshToken();
        }
        
        return _currentToken;
    }
    
    function refreshToken() {
        var newToken = generateToken();
        storeToken(newToken);
        updateAllFormTokens();
        return newToken;
    }
    
    function isValidToken(token) {
        if (!token || !_currentToken) return false;
        
        // Constant-time comparison (cegah timing attack)
        var a = token;
        var b = _currentToken;
        
        if (a.length !== b.length) return false;
        
        var result = 0;
        for (var i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }
    
    // ============================================
    // FORM INJECTION (Non-invasive)
    // ============================================
    
    /**
     * Inject CSRF token ke satu form
     */
    function injectFormToken(form) {
        if (!form || !form.tagName) return;
        
        // Cek apakah form sudah punya token
        var existingInput = form.querySelector('input[name="' + config.formFieldName + '"]');
        if (existingInput) {
            existingInput.value = getToken() || '';
            return;
        }
        
        // Buat input baru
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = config.formFieldName;
        input.value = getToken() || '';
        form.appendChild(input);
    }
    
    /**
     * Update token di semua form
     */
    function updateAllFormTokens() {
        var forms = document.getElementsByTagName('form');
        for (var i = 0; i < forms.length; i++) {
            var input = forms[i].querySelector('input[name="' + config.formFieldName + '"]');
            if (input) {
                input.value = _currentToken || '';
            }
        }
    }
    
    /**
     * Inject token ke semua form yang ada
     */
    function injectAllForms() {
        var forms = document.getElementsByTagName('form');
        for (var i = 0; i < forms.length; i++) {
            injectFormToken(forms[i]);
        }
    }
    
    /**
     * Setup MutationObserver untuk form dinamis
     */
    function setupFormObserver() {
        if (!window.MutationObserver) return;
        
        var observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                
                // Cek node yang ditambahkan
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    
                    // Jika form ditambahkan
                    if (node.tagName === 'FORM') {
                        injectFormToken(node);
                    }
                    
                    // Jika node mengandung form
                    if (node.querySelectorAll) {
                        var forms = node.querySelectorAll('form');
                        for (var k = 0; k < forms.length; k++) {
                            injectFormToken(forms[k]);
                        }
                    }
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // ============================================
    // REQUEST HEADERS (Helper)
    // ============================================
    
    /**
     * Get CSRF header object untuk fetch/XHR
     */
    function getRequestHeaders() {
        var headers = {};
        headers[config.headerName] = getToken() || '';
        return headers;
    }
    
    /**
     * Attach token ke FormData
     */
    function attachToFormData(formData) {
        if (formData && typeof formData.append === 'function') {
            formData.append(config.formFieldName, getToken() || '');
        }
        return formData;
    }
    
    /**
     * Attach token ke request body object
     */
    function attachToBody(body) {
        if (body && typeof body === 'object' && !Array.isArray(body)) {
            body[config.formFieldName] = getToken() || '';
        }
        return body;
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init(options) {
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = options[key];
                }
            }
        }
        
        // Load or generate token
        var storedToken = getStoredToken();
        if (storedToken) {
            _currentToken = storedToken;
        } else {
            _currentToken = generateToken();
            storeToken(_currentToken);
        }
        
        // Inject ke semua form
        injectAllForms();
        
        // Setup observer untuk form dinamis
        setupFormObserver();
        
        // Schedule token refresh
        if (config.tokenExpiry > 0) {
            setInterval(function() {
                if (_tokenExpiry && Date.now() > _tokenExpiry - 60000) {
                    refreshToken();
                }
            }, 60000);
        }
        
        console.info('[CSRF] Initialized (token: ' + _currentToken.substring(0, 8) + '...)');
        
        return _currentToken;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    // Auto-init saat DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { init(); });
    } else {
        setTimeout(init, 50);
    }
    
    return {
        init: init,
        
        /**
         * Get current CSRF token
         */
        getToken: getToken,
        
        /**
         * Refresh token
         */
        refreshToken: refreshToken,
        
        /**
         * Check if token is valid
         */
        isValid: isValidToken,
        
        /**
         * Get headers for fetch/XHR
         */
        getHeaders: getRequestHeaders,
        
        /**
         * Attach token ke FormData
         */
        attachToFormData: attachToFormData,
        
        /**
         * Attach token ke body object
         */
        attachToBody: attachToBody,
        
        /**
         * Inject token ke form tertentu
         */
        injectForm: injectFormToken,
        
        /**
         * Inject token ke semua form
         */
        injectAllForms: injectAllForms,
        
        /**
         * Get header name
         */
        getHeaderName: function() {
            return config.headerName;
        },
        
        /**
         * Get form field name
         */
        getFieldName: function() {
            return config.formFieldName;
        },
        
        /**
         * Clear token
         */
        destroy: function() {
            clearToken();
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Get token
// var token = CSRFProtection.getToken();
// 
// // Get headers for fetch
// fetch('/api/data', {
//     headers: CSRFProtection.getHeaders()
// });
// 
// // Attach to FormData
// var fd = new FormData(form);
// CSRFProtection.attachToFormData(fd);
// 
// // Attach to body
// var data = { name: 'test' };
// CSRFProtection.attachToBody(data);
// ============================================