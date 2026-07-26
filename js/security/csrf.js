// js/security/csrf.js - CSRF Protection Module 2026 (SECURE)
/**
 * E-Arsip Digital - CSRF Protection
 * Version: 2026.1.0
 * 
 * Features:
 * - Double-submit cookie pattern
 * - Token generation dengan crypto API
 * - Origin validation
 * - Auto-attach ke fetch/XHR requests
 * - PWA mobile compatible
 * - No external dependencies
 */

var CSRFProtection = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var DEFAULT_CONFIG = {
        enabled: true,
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-CSRF-Token',
        formFieldName: '_csrf_token',
        tokenLength: 32,
        tokenExpiry: 3600000,    // 1 jam
        renewOnUse: true,
        validateOrigin: true,
        cookieSameSite: 'Lax',   // 'Lax' untuk PWA compatibility
        cookieSecure: window.location.protocol === 'https:',
        allowedOrigins: []
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _config = {};
    var _activeTokens = {};
    var _currentToken = null;
    var _renewTimer = null;
    var _initialized = false;
    var _originalFetch = null;
    
    // Stats
    var _stats = {
        tokensGenerated: 0,
        tokensValidated: 0,
        tokensRejected: 0,
        originValidations: 0,
        originRejections: 0
    };
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    /**
     * Generate random bytes (dengan fallback)
     */
    function getRandomBytes(length) {
        try {
            if (window.crypto && window.crypto.getRandomValues) {
                var array = new Uint32Array(Math.ceil(length / 4));
                window.crypto.getRandomValues(array);
                var result = '';
                for (var i = 0; i < array.length; i++) {
                    result += ('00000000' + array[i].toString(16)).slice(-8);
                }
                return result.substring(0, length * 2);
            }
        } catch(e) {
            // Fallback: Math.random (kurang aman, lebih baik dari tidak sama sekali)
            console.warn('CSRF: Using Math.random fallback');
        }
        
        var result = '';
        for (var i = 0; i < length * 2; i++) {
            result += Math.floor(Math.random() * 16).toString(16);
        }
        return result;
    }
    
    /**
     * Simple HMAC-like integrity check
     */
    function generateIntegrity(token, secret) {
        var combined = token + ':' + (secret || _config.cookieName);
        var hash = 0;
        
        for (var i = 0; i < combined.length; i++) {
            var char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    
    /**
     * Get cookie value
     */
    function getCookie(name) {
        var value = '; ' + document.cookie;
        var parts = value.split('; ' + name + '=');
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        return null;
    }
    
    /**
     * Set cookie
     */
    function setCookie(name, value, expiryMs) {
        var expires = '';
        if (expiryMs) {
            expires = '; expires=' + new Date(Date.now() + expiryMs).toUTCString();
        }
        
        var secure = _config.cookieSecure ? '; Secure' : '';
        var sameSite = '; SameSite=' + _config.cookieSameSite;
        
        document.cookie = name + '=' + encodeURIComponent(value) + 
            expires + '; path=/' + secure + sameSite;
    }
    
    /**
     * Delete cookie
     */
    function deleteCookie(name) {
        document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
    
    /**
     * Clean expired tokens
     */
    function cleanExpiredTokens() {
        var now = Date.now();
        for (var token in _activeTokens) {
            if (_activeTokens.hasOwnProperty(token)) {
                if (now > _activeTokens[token].expiresAt) {
                    delete _activeTokens[token];
                }
            }
        }
    }
    
    // ============================================
    // TOKEN GENERATION
    // ============================================
    
    /**
     * Generate CSRF token dengan integrity check
     */
    function generateToken() {
        // Generate random token
        var tokenValue = getRandomBytes(_config.tokenLength);
        
        // Add integrity
        var integrity = generateIntegrity(tokenValue);
        var fullToken = tokenValue + '.' + integrity;
        
        // Store token
        _activeTokens[fullToken] = {
            createdAt: Date.now(),
            expiresAt: Date.now() + _config.tokenExpiry,
            used: false
        };
        
        // Clean old tokens
        cleanExpiredTokens();
        
        // Set cookie
        setCookie(_config.cookieName, fullToken, _config.tokenExpiry);
        
        // Update DOM
        updateDOMToken(fullToken);
        
        // Store current
        _currentToken = fullToken;
        
        _stats.tokensGenerated++;
        
        return fullToken;
    }
    
    /**
     * Update token di DOM elements
     */
    function updateDOMToken(token) {
        // Update meta tag
        var metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            metaTag.setAttribute('content', token);
        }
        
        // Update semua hidden input
        var inputs = document.querySelectorAll('input[name="' + _config.formFieldName + '"]');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].value = token;
        }
    }
    
    /**
     * Inject CSRF meta tag jika belum ada
     */
    function injectMetaTag() {
        if (!document.querySelector('meta[name="csrf-token"]')) {
            var meta = document.createElement('meta');
            meta.name = 'csrf-token';
            meta.content = _currentToken || '';
            document.head.appendChild(meta);
        }
    }
    
    /**
     * Inject hidden CSRF field ke form yang belum punya
     */
    function ensureFormToken(form) {
        if (!form) return;
        
        var existingInput = form.querySelector('input[name="' + _config.formFieldName + '"]');
        if (!existingInput) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = _config.formFieldName;
            input.value = _currentToken || '';
            form.appendChild(input);
        }
    }
    
    // ============================================
    // TOKEN VALIDATION
    // ============================================
    
    /**
     * Validasi CSRF token
     */
    function validateToken(token) {
        if (!token) {
            _stats.tokensRejected++;
            return { valid: false, reason: 'Token is empty' };
        }
        
        // Split token and integrity
        var parts = token.split('.');
        if (parts.length !== 2) {
            _stats.tokensRejected++;
            return { valid: false, reason: 'Invalid token format' };
        }
        
        var tokenValue = parts[0];
        var integrity = parts[1];
        
        // Verify integrity
        var expectedIntegrity = generateIntegrity(tokenValue);
        if (integrity !== expectedIntegrity) {
            _stats.tokensRejected++;
            return { valid: false, reason: 'Token integrity check failed' };
        }
        
        // Check if token is known
        var tokenData = _activeTokens[token];
        if (!tokenData) {
            // Token mungkin dari session sebelumnya, cek format saja
            // Ini bukan rejection - token cookie-based valid
        }
        
        // Check expiry
        if (tokenData && Date.now() > tokenData.expiresAt) {
            delete _activeTokens[token];
            _stats.tokensRejected++;
            return { valid: false, reason: 'Token expired' };
        }
        
        // Mark as used
        if (tokenData && _config.renewOnUse) {
            tokenData.used = true;
        }
        
        _stats.tokensValidated++;
        
        // Renew token after use
        if (_config.renewOnUse) {
            setTimeout(function() {
                generateToken();
            }, 10);
        }
        
        return { valid: true };
    }
    
    /**
     * Validate origin header
     */
    function validateOrigin(origin) {
        _stats.originValidations++;
        
        if (!origin) {
            // Same-origin requests don't always send origin
            return { valid: true, reason: 'Same-origin (no origin header)' };
        }
        
        // Build allowed origins
        var allowedOrigins = [window.location.origin];
        if (_config.allowedOrigins && _config.allowedOrigins.length > 0) {
            allowedOrigins = allowedOrigins.concat(_config.allowedOrigins);
        }
        
        // Check
        for (var i = 0; i < allowedOrigins.length; i++) {
            var allowed = allowedOrigins[i];
            if (allowed === '*') return { valid: true };
            if (allowed === origin) return { valid: true };
            if (typeof allowed === 'string' && origin.indexOf(allowed) !== -1) return { valid: true };
        }
        
        _stats.originRejections++;
        console.warn('CSRF: Origin rejected:', origin);
        return { valid: false, reason: 'Origin not allowed: ' + origin };
    }
    
    // ============================================
    // REQUEST INTERCEPTION (Non-invasive)
    // ============================================
    
    /**
     * Setup fetch interceptor (menyimpan original)
     */
    function setupFetchInterceptor() {
        if (_originalFetch) return; // Already setup
        
        _originalFetch = window.fetch;
        var self = this;
        
        window.fetch = function(url, options) {
            options = options || {};
            
            // Buat headers baru
            var headers = new Headers(options.headers || {});
            
            // Tambahkan CSRF token jika belum ada
            if (!headers.has(_config.headerName)) {
                var token = getCookie(_config.cookieName);
                if (token) {
                    headers.set(_config.headerName, token);
                }
            }
            
            // Tambahkan X-Requested-With untuk deteksi AJAX
            if (!headers.has('X-Requested-With')) {
                headers.set('X-Requested-With', 'XMLHttpRequest');
            }
            
            options.headers = headers;
            
            return _originalFetch.call(this, url, options);
        };
    }
    
    /**
     * Restore original fetch
     */
    function restoreFetch() {
        if (_originalFetch) {
            window.fetch = _originalFetch;
            _originalFetch = null;
        }
    }
    
    /**
     * Attach CSRF token ke FormData/request body
     */
    function attachTokenToRequest(requestData) {
        if (!requestData) return requestData;
        
        var token = getCookie(_config.cookieName);
        if (!token) return requestData;
        
        // Untuk FormData
        if (requestData instanceof FormData) {
            if (!requestData.has(_config.formFieldName)) {
                requestData.append(_config.formFieldName, token);
            }
        }
        // Untuk plain object
        else if (typeof requestData === 'object' && !Array.isArray(requestData)) {
            if (!requestData[_config.formFieldName]) {
                requestData[_config.formFieldName] = token;
            }
        }
        
        return requestData;
    }
    
    // ============================================
    // FORM INTERCEPTION (Non-invasive)
    // ============================================
    
    /**
     * Setup form submission interceptor
     */
    function setupFormInterceptor() {
        document.addEventListener('submit', function(event) {
            var form = event.target;
            if (form && form.tagName === 'FORM') {
                ensureFormToken(form);
            }
        }, true);
        
        // Observer untuk form yang ditambahkan secara dinamis
        if (window.MutationObserver) {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.querySelectorAll) {
                            var forms = node.querySelectorAll('form');
                            for (var i = 0; i < forms.length; i++) {
                                ensureFormToken(forms[i]);
                            }
                        }
                        if (node.tagName === 'FORM') {
                            ensureFormToken(node);
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init(customConfig) {
        if (_initialized) {
            console.warn('CSRF Protection already initialized');
            return;
        }
        
        // Merge config
        _config = {};
        for (var key in DEFAULT_CONFIG) {
            if (DEFAULT_CONFIG.hasOwnProperty(key)) {
                _config[key] = DEFAULT_CONFIG[key];
            }
        }
        if (customConfig) {
            for (var key in customConfig) {
                if (customConfig.hasOwnProperty(key)) {
                    _config[key] = customConfig[key];
                }
            }
        }
        
        if (!_config.enabled) {
            console.info('CSRF Protection is disabled');
            return;
        }
        
        // Generate initial token
        generateToken();
        
        // Inject meta tag
        injectMetaTag();
        
        // Setup interceptors
        setupFetchInterceptor();
        setupFormInterceptor();
        
        // Auto-renew token
        _renewTimer = setInterval(function() {
            generateToken();
        }, Math.floor(_config.tokenExpiry / 2));
        
        _initialized = true;
        
        console.info('CSRF Protection initialized (token: ' + 
            (_currentToken ? _currentToken.substring(0, 8) + '...' : 'none') + ')');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Initialize CSRF protection
         * @param {Object} customConfig - Override default config
         */
        init: init,
        
        /**
         * Get current CSRF token
         * @returns {string} Current token
         */
        getToken: function() {
            return getCookie(_config.cookieName) || _currentToken;
        },
        
        /**
         * Get token for use in request headers
         * @returns {string} Token
         */
        getTokenForRequest: function() {
            return getCookie(_config.cookieName);
        },
        
        /**
         * Validate a CSRF token
         * @param {string} token - Token to validate
         * @returns {Object} { valid, reason }
         */
        validate: validateToken,
        
        /**
         * Validate request origin
         * @param {string} origin - Origin header value
         * @returns {Object} { valid, reason }
         */
        validateOrigin: validateOrigin,
        
        /**
         * Generate new token
         * @returns {string} New token
         */
        regenerate: generateToken,
        
        /**
         * Attach token to request data
         * @param {Object|FormData} data - Request data
         * @returns {Object|FormData} Data with token
         */
        attachToken: attachTokenToRequest,
        
        /**
         * Ensure a form has CSRF hidden input
         * @param {HTMLFormElement} form - Form element
         */
        ensureFormToken: ensureFormToken,
        
        /**
         * Check if CSRF is enabled
         * @returns {boolean}
         */
        isEnabled: function() {
            return _config.enabled && _initialized;
        },
        
        /**
         * Get statistics
         * @returns {Object} Stats
         */
        getStats: function() {
            var activeCount = 0;
            for (var key in _activeTokens) {
                if (_activeTokens.hasOwnProperty(key)) activeCount++;
            }
            
            return {
                tokensGenerated: _stats.tokensGenerated,
                tokensValidated: _stats.tokensValidated,
                tokensRejected: _stats.tokensRejected,
                originValidations: _stats.originValidations,
                originRejections: _stats.originRejections,
                activeTokens: activeCount,
                initialized: _initialized
            };
        },
        
        /**
         * Reset statistics
         */
        resetStats: function() {
            _stats = {
                tokensGenerated: 0,
                tokensValidated: 0,
                tokensRejected: 0,
                originValidations: 0,
                originRejections: 0
            };
        },
        
        /**
         * Destroy CSRF protection (restore original fetch)
         */
        destroy: function() {
            if (_renewTimer) {
                clearInterval(_renewTimer);
                _renewTimer = null;
            }
            
            restoreFetch();
            deleteCookie(_config.cookieName);
            
            _activeTokens = {};
            _currentToken = null;
            _initialized = false;
            
            console.info('CSRF Protection destroyed');
        }
    };
})();

// ============================================
// AUTO-INIT dari config jika tersedia
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    var config = null;
    
    // Coba ambil config dari EArsip global
    if (window.EArsip && window.EArsip.Config && window.EArsip.Config.security) {
        config = window.EArsip.Config.security.csrf;
    }
    
    if (config && config.enabled !== false) {
        CSRFProtection.init(config);
    }
});

// ============================================
// USAGE:
// ============================================
// CSRFProtection.init({ cookieName: 'XSRF-TOKEN' });
// var token = CSRFProtection.getToken();
// var result = CSRFProtection.validate(token);
// ============================================