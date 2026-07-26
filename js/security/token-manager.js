// js/security/token-manager.js - Token Manager 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Token Manager
 * Version: 2026.1.0
 * 
 * Features:
 * - JWT decode (tanpa verify - verify di server)
 * - Token expiry check
 * - Auto-refresh scheduling
 * - Refresh queue
 * - No encryption dependency (httpOnly cookies recommended)
 */

var TokenManager = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        accessTokenKey: 'auth_token',
        refreshTokenKey: 'auth_refresh_token',
        refreshBuffer: 300000,       // 5 menit sebelum expiry
        autoRefresh: true,
        storage: 'localStorage'      // 'localStorage' atau 'sessionStorage'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _accessToken = null;
    var _refreshToken = null;
    var _decodedToken = null;
    var _tokenExpiry = null;         // Timestamp in ms
    var _refreshTimer = null;
    var _isRefreshing = false;
    var _refreshQueue = [];
    var _refreshCallback = null;     // Custom refresh function
    
    // ============================================
    // STORAGE HELPERS
    // ============================================
    
    function getStorage() {
        return config.storage === 'sessionStorage' ? sessionStorage : localStorage;
    }
    
    function saveToStorage(key, value) {
        try {
            if (value) {
                getStorage().setItem(key, value);
            } else {
                getStorage().removeItem(key);
            }
        } catch(e) {
            console.warn('[TokenManager] Storage error:', e.message);
        }
    }
    
    function getFromStorage(key) {
        try {
            return getStorage().getItem(key);
        } catch(e) {
            return null;
        }
    }
    
    // ============================================
    // BASE64 URL DECODE (FIXED)
    // ============================================
    
    /**
     * Decode base64url string
     * Fixed: handle unicode correctly
     */
    function base64UrlDecode(str) {
        if (!str) return '';
        
        try {
            // Convert base64url to base64
            var base64 = str.replace(/-/g, '+').replace(/_/g, '/');
            
            // Add padding
            var pad = base64.length % 4;
            if (pad === 2) base64 += '==';
            else if (pad === 3) base64 += '=';
            
            // Decode base64
            var raw = atob(base64);
            
            // Convert binary string ke UTF-8
            var bytes = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) {
                bytes[i] = raw.charCodeAt(i);
            }
            
            return new TextDecoder().decode(bytes);
        } catch(e) {
            console.warn('[TokenManager] Base64 decode error:', e.message);
            return '';
        }
    }
    
    // ============================================
    // JWT DECODE
    // ============================================
    
    /**
     * Decode JWT (hanya payload, tidak verify signature)
     */
    function decodeToken(token) {
        if (!token) return null;
        
        try {
            var parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }
            
            var payload = base64UrlDecode(parts[1]);
            return JSON.parse(payload);
        } catch(e) {
            console.warn('[TokenManager] Decode error:', e.message);
            return null;
        }
    }
    
    // ============================================
    // TOKEN MANAGEMENT
    // ============================================
    
    /**
     * Set access token + optional refresh token
     */
    function setTokens(accessToken, refreshToken) {
        _accessToken = accessToken || null;
        
        if (refreshToken !== undefined) {
            _refreshToken = refreshToken || null;
        }
        
        // Save ke storage
        saveToStorage(config.accessTokenKey, _accessToken);
        saveToStorage(config.refreshTokenKey, _refreshToken);
        
        // Decode token untuk dapatkan expiry
        if (_accessToken) {
            _decodedToken = decodeToken(_accessToken);
            
            if (_decodedToken && _decodedToken.exp) {
                _tokenExpiry = _decodedToken.exp * 1000; // Convert ke ms
            } else {
                _tokenExpiry = null;
            }
        } else {
            _decodedToken = null;
            _tokenExpiry = null;
        }
        
        // Schedule auto-refresh
        if (config.autoRefresh && _tokenExpiry && _refreshToken) {
            scheduleRefresh();
        }
    }
    
    /**
     * Load tokens from storage
     */
    function loadTokens() {
        var accessToken = getFromStorage(config.accessTokenKey);
        var refreshToken = getFromStorage(config.refreshTokenKey);
        
        if (accessToken) {
            setTokens(accessToken, refreshToken);
        }
        
        return {
            hasAccessToken: !!_accessToken,
            hasRefreshToken: !!_refreshToken
        };
    }
    
    /**
     * Clear all tokens
     */
    function clearTokens() {
        _accessToken = null;
        _refreshToken = null;
        _decodedToken = null;
        _tokenExpiry = null;
        
        saveToStorage(config.accessTokenKey, null);
        saveToStorage(config.refreshTokenKey, null);
        
        if (_refreshTimer) {
            clearTimeout(_refreshTimer);
            _refreshTimer = null;
        }
        
        _refreshQueue = [];
        _isRefreshing = false;
    }
    
    // ============================================
    // TOKEN VALIDATION
    // ============================================
    
    function isTokenExpired() {
        if (!_tokenExpiry) return !_accessToken;
        
        // Tambah buffer 30 detik
        return Date.now() >= (_tokenExpiry - 30000);
    }
    
    function isValid() {
        return !!_accessToken && !isTokenExpired() && !!_decodedToken;
    }
    
    function getRemainingTime() {
        if (!_tokenExpiry) return 0;
        return Math.max(0, _tokenExpiry - Date.now());
    }
    
    // ============================================
    // TOKEN REFRESH
    // ============================================
    
    /**
     * Set custom refresh function
     * @param {Function} fn - Async function that returns { accessToken, refreshToken }
     */
    function setRefreshFunction(fn) {
        _refreshCallback = fn;
    }
    
    /**
     * Schedule automatic token refresh
     */
    function scheduleRefresh() {
        if (_refreshTimer) {
            clearTimeout(_refreshTimer);
            _refreshTimer = null;
        }
        
        if (!_tokenExpiry || !_refreshToken) return;
        
        var delay = Math.max(0, _tokenExpiry - Date.now() - config.refreshBuffer);
        
        console.debug('[TokenManager] Refresh scheduled in ' + Math.round(delay / 1000) + 's');
        
        _refreshTimer = setTimeout(function() {
            refreshToken();
        }, delay);
    }
    
    /**
     * Refresh token sekarang juga
     */
    function refreshToken() {
        // Jika sedang refresh, tambahkan ke queue
        if (_isRefreshing) {
            return new Promise(function(resolve) {
                _refreshQueue.push(resolve);
            });
        }
        
        if (!_refreshCallback) {
            console.warn('[TokenManager] No refresh callback set');
            return Promise.resolve(null);
        }
        
        _isRefreshing = true;
        
        return Promise.resolve(_refreshCallback(_refreshToken))
            .then(function(result) {
                _isRefreshing = false;
                
                if (result && result.accessToken) {
                    setTokens(result.accessToken, result.refreshToken || _refreshToken);
                    
                    // Resolve queue
                    var queue = _refreshQueue;
                    _refreshQueue = [];
                    for (var i = 0; i < queue.length; i++) {
                        queue[i](result.accessToken);
                    }
                    
                    return result.accessToken;
                }
                
                // Refresh gagal
                var queue2 = _refreshQueue;
                _refreshQueue = [];
                for (var j = 0; j < queue2.length; j++) {
                    queue2[j](null);
                }
                
                return null;
            })
            .catch(function(error) {
                _isRefreshing = false;
                
                console.error('[TokenManager] Refresh failed:', error.message);
                
                // Reject queue
                var queue3 = _refreshQueue;
                _refreshQueue = [];
                for (var k = 0; k < queue3.length; k++) {
                    queue3[k](null);
                }
                
                return null;
            });
    }
    
    /**
     * Get valid access token (refresh if needed)
     */
    function getValidToken() {
        if (isValid()) {
            return Promise.resolve(_accessToken);
        }
        
        if (_refreshToken && _refreshCallback) {
            return refreshToken();
        }
        
        return Promise.resolve(null);
    }
    
    // ============================================
    // TOKEN CLAIMS
    // ============================================
    
    function getClaim(claim) {
        return (_decodedToken && _decodedToken[claim]) || null;
    }
    
    function getUserId() {
        return getClaim('sub') || getClaim('userId') || getClaim('id') || null;
    }
    
    function getUserRole() {
        return getClaim('role') || null;
    }
    
    function getPermissions() {
        return getClaim('permissions') || [];
    }
    
    function hasPermission(permission) {
        var perms = getPermissions();
        if (perms.indexOf('*') !== -1) return true;
        return perms.indexOf(permission) !== -1;
    }
    
    function getAuthHeader() {
        if (!_accessToken) return {};
        
        var header = {};
        header['Authorization'] = 'Bearer ' + _accessToken;
        return header;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    // Load tokens saat inisialisasi
    loadTokens();
    
    return {
        // Token management
        setTokens: setTokens,
        getAccessToken: function() { return _accessToken; },
        getRefreshToken: function() { return _refreshToken; },
        clearTokens: clearTokens,
        loadTokens: loadTokens,
        
        // Validation
        isValid: isValid,
        isExpired: isTokenExpired,
        getRemainingTime: getRemainingTime,
        getExpiry: function() { return _tokenExpiry; },
        
        // Decode
        getDecodedToken: function() { return _decodedToken; },
        getClaim: getClaim,
        getUserId: getUserId,
        getUserRole: getUserRole,
        getPermissions: getPermissions,
        hasPermission: hasPermission,
        getAuthHeader: getAuthHeader,
        
        // Refresh
        setRefreshFunction: setRefreshFunction,
        refreshToken: refreshToken,
        getValidToken: getValidToken,
        
        // Config
        configure: function(newConfig) {
            if (newConfig) {
                for (var key in newConfig) {
                    if (newConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = newConfig[key];
                    }
                }
            }
        },
        
        // Destroy
        destroy: function() {
            clearTokens();
            _refreshCallback = null;
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Set refresh callback
// TokenManager.setRefreshFunction(function(refreshToken) {
//     return fetch('/api/refresh', {
//         method: 'POST',
//         body: JSON.stringify({ refreshToken: refreshToken })
//     }).then(function(r) { return r.json(); });
// });
// 
// // Set tokens
// TokenManager.setTokens('access.jwt.token', 'refresh.token');
// 
// // Get valid token (auto-refresh if needed)
// TokenManager.getValidToken().then(function(token) {
//     console.log('Valid token:', token);
// });
// 
// // Check permission
// if (TokenManager.hasPermission('manage_surat')) { ... }
// ============================================