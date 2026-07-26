// js/auth.js - Authentication Service 2026 (REGULAR SCRIPT)
/**
 * E-Arsip Digital - Authentication Service
 * Version: 2026.1.0
 * 
 * Features:
 * - Login/logout dengan Google Apps Script
 * - Session management (localStorage)
 * - Role-based redirect (16 roles)
 * - Password validation
 * - Login attempt lockout
 * - Activity tracking
 * - No external dependencies
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        sessionTimeout: 3600000,       // 1 jam
        maxLoginAttempts: 5,
        lockoutDuration: 900000,       // 15 menit
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecialChar: true,
        idleTimeout: 1800000,          // 30 menit
        activityEvents: ['mousedown', 'keydown', 'touchstart', 'scroll']
    };
    
    // Override dari EArsip.Config jika tersedia
    if (window.EArsip && window.EArsip.Config && window.EArsip.Config.auth) {
        var authConfig = window.EArsip.Config.auth;
        for (var key in authConfig) {
            if (authConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                config[key] = authConfig[key];
            }
        }
    }
    
    // ============================================
    // ROLE ROUTES (16 roles)
    // ============================================
    var ROLE_ROUTES = {
        'super_admin': '../dashboard/super-admin/index.html',
        'admin': '../dashboard/admin/index.html',
        'kasubag': '../dashboard/kasubag/index.html',
        'kaprodi': '../dashboard/kaprodi/index.html',
        'admin_kaprodi': '../dashboard/admin-kaprodi/index.html',
        'wadek': '../dashboard/wadek/index.html',
        'admin_wadek': '../dashboard/admin-wadek/index.html',
        'dekan': '../dashboard/dekan/index.html',
        'admin_dekan': '../dashboard/admin-dekan/index.html',
        'ketua_upm': '../dashboard/ketua-upm/index.html',
        'litdianmas': '../dashboard/litdianmas/index.html',
        'staf': '../dashboard/staf/index.html',
        'dosen': '../dashboard/dosen/index.html',
        'lembaga_kemahasiswaan': '../dashboard/lembaga-kemahasiswaan/index.html',
        'mahasiswa': '../dashboard/mahasiswa/index.html',
        'user': '../dashboard/user/index.html'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _currentUser = null;
    var _isAuthenticated = false;
    var _loginAttempts = {};        // { username: { count, firstAttempt, locked } }
    var _listeners = [];            // Auth change listeners
    var _activityTimer = null;
    var _idleTimer = null;
    var _lastActivity = Date.now();
    
    // ============================================
    // API HELPER
    // ============================================
    
    function getAPI() {
        if (window.EArsip && window.EArsip.Api) {
            return window.EArsip.Api;
        }
        return null;
    }
    
    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    
    function saveSession(user, token, refreshToken) {
        var session = {
            token: token || ('token-' + Date.now().toString(36)),
            refreshToken: refreshToken || '',
            user: user,
            expiresAt: Date.now() + config.sessionTimeout,
            lastActivity: Date.now()
        };
        
        try {
            localStorage.setItem('auth_session', JSON.stringify(session));
            localStorage.setItem('auth_token', session.token);
            if (refreshToken) {
                localStorage.setItem('auth_refresh_token', refreshToken);
            }
        } catch(e) {
            console.warn('[Auth] Failed to save session');
        }
    }
    
    function restoreSession() {
        try {
            var sessionStr = localStorage.getItem('auth_session');
            if (!sessionStr) {
                // Coba sessionStorage
                sessionStr = sessionStorage.getItem('auth_session');
            }
            
            if (!sessionStr) return false;
            
            var session = JSON.parse(sessionStr);
            
            if (!session.user || !session.expiresAt) {
                clearSession();
                return false;
            }
            
            if (Date.now() >= session.expiresAt) {
                clearSession();
                return false;
            }
            
            _currentUser = session.user;
            _isAuthenticated = true;
            _lastActivity = session.lastActivity || Date.now();
            
            console.log('[Auth] Session restored: ' + session.user.username);
            return true;
        } catch(e) {
            console.warn('[Auth] Session restore failed');
            clearSession();
            return false;
        }
    }
    
    function clearSession() {
        _currentUser = null;
        _isAuthenticated = false;
        
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_refresh_token');
        sessionStorage.removeItem('auth_session');
    }
    
    function updateLastActivity() {
        _lastActivity = Date.now();
        
        try {
            var sessionStr = localStorage.getItem('auth_session');
            if (sessionStr) {
                var session = JSON.parse(sessionStr);
                session.lastActivity = Date.now();
                localStorage.setItem('auth_session', JSON.stringify(session));
            }
        } catch(e) {}
    }
    
    function isSessionExpired() {
        // Check absolute timeout
        try {
            var sessionStr = localStorage.getItem('auth_session');
            if (sessionStr) {
                var session = JSON.parse(sessionStr);
                if (Date.now() >= session.expiresAt) return true;
            }
        } catch(e) {}
        
        // Check idle timeout
        if (config.idleTimeout && (Date.now() - _lastActivity > config.idleTimeout)) {
            return true;
        }
        
        return false;
    }
    
    // ============================================
    // ACTIVITY TRACKING
    // ============================================
    
    function startActivityTracking() {
        var handler = function() {
            updateLastActivity();
        };
        
        for (var i = 0; i < config.activityEvents.length; i++) {
            document.addEventListener(config.activityEvents[i], handler, { passive: true });
        }
        
        // Cek idle setiap 60 detik
        _idleTimer = setInterval(function() {
            if (_isAuthenticated && isSessionExpired()) {
                console.warn('[Auth] Session expired');
                logout(true);
            }
        }, 60000);
    }
    
    // ============================================
    // LOGIN
    // ============================================
    
    function login(username, password, rememberMe) {
        // Validasi input
        if (!username || username.trim().length < 3) {
            return Promise.reject(new Error('Username minimal 3 karakter'));
        }
        
        if (!password || password.length < config.passwordMinLength) {
            return Promise.reject(new Error('Password minimal ' + config.passwordMinLength + ' karakter'));
        }
        
        // Check lockout
        var attempt = _loginAttempts[username];
        if (attempt && attempt.locked) {
            var remaining = config.lockoutDuration - (Date.now() - attempt.lockedAt);
            if (remaining > 0) {
                return Promise.reject(new Error('Akun terkunci. Coba lagi dalam ' + 
                    Math.ceil(remaining / 60000) + ' menit'));
            }
            // Unlock
            delete _loginAttempts[username];
        }
        
        var api = getAPI();
        if (!api) {
            return Promise.reject(new Error('API service tidak tersedia'));
        }
        
        return api.post('login', {
            username: username.trim(),
            password: password,
            timestamp: Date.now()
        }).then(function(response) {
            // Reset attempts
            delete _loginAttempts[username];
            
            // Extract user data
            var userData = response.data || response;
            var user = userData.user || userData;
            
            if (!user || !user.role) {
                throw new Error('Response tidak valid');
            }
            
            // Validate role
            if (!ROLE_ROUTES[user.role]) {
                throw new Error('Role tidak valid: ' + user.role);
            }
            
            // Set auth state
            _currentUser = user;
            _isAuthenticated = true;
            
            // Save session
            var storage = rememberMe ? localStorage : sessionStorage;
            if (!rememberMe) {
                // Pindahkan dari localStorage ke sessionStorage
                localStorage.removeItem('auth_session');
                localStorage.removeItem('auth_token');
            }
            
            saveSession(user, userData.token, userData.refreshToken);
            
            // Start activity tracking
            startActivityTracking();
            
            // Notify listeners
            notifyListeners('login', user);
            
            console.log('[Auth] Login success: ' + user.username + ' (' + user.role + ')');
            
            return {
                success: true,
                user: user,
                redirect: ROLE_ROUTES[user.role] || ROLE_ROUTES['user']
            };
        }).catch(function(error) {
            // Record failed attempt
            if (!_loginAttempts[username]) {
                _loginAttempts[username] = { count: 0, firstAttempt: Date.now() };
            }
            
            _loginAttempts[username].count++;
            
            if (_loginAttempts[username].count >= config.maxLoginAttempts) {
                _loginAttempts[username].locked = true;
                _loginAttempts[username].lockedAt = Date.now();
                
                console.warn('[Auth] Account locked: ' + username);
                throw new Error('Akun terkunci karena terlalu banyak percobaan');
            }
            
            var remaining = config.maxLoginAttempts - _loginAttempts[username].count;
            var msg = 'Login gagal. ';
            if (remaining <= 2) {
                msg += 'Percobaan tersisa: ' + remaining;
            } else {
                msg += 'Username atau password salah';
            }
            
            throw new Error(msg);
        });
    }
    
    // ============================================
    // LOGOUT
    // ============================================
    
    function logout(silent) {
        var user = _currentUser;
        
        // Clear state
        clearSession();
        
        // Stop timers
        if (_idleTimer) {
            clearInterval(_idleTimer);
            _idleTimer = null;
        }
        
        // Notify listeners
        notifyListeners('logout', user);
        
        console.log('[Auth] Logged out');
        
        // Redirect jika bukan silent
        if (!silent) {
            window.location.href = '../login.html?message=logged_out';
        }
    }
    
    // ============================================
    // ROLE & PERMISSION
    // ============================================
    
    function hasRole(roles) {
        if (!_currentUser) return false;
        var roleList = Array.isArray(roles) ? roles : [roles];
        return roleList.indexOf(_currentUser.role) !== -1;
    }
    
    function hasPermission(permission) {
        if (!_currentUser) return false;
        var perms = _currentUser.permissions || [];
        return perms.indexOf(permission) !== -1 || perms.indexOf('all') !== -1;
    }
    
    function getRedirectURL(role) {
        return ROLE_ROUTES[role] || ROLE_ROUTES['user'];
    }
    
    // ============================================
    // VALIDATION
    // ============================================
    
    function validatePassword(password) {
        var errors = [];
        
        if (password.length < config.passwordMinLength) {
            errors.push('minimal ' + config.passwordMinLength + ' karakter');
        }
        if (config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            errors.push('harus mengandung huruf besar');
        }
        if (config.passwordRequireNumber && !/[0-9]/.test(password)) {
            errors.push('harus mengandung angka');
        }
        if (config.passwordRequireSpecialChar && !/[^a-zA-Z0-9]/.test(password)) {
            errors.push('harus mengandung karakter khusus');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    function onAuthChange(callback) {
        _listeners.push(callback);
        
        // Return unsubscribe function
        return function() {
            _listeners = _listeners.filter(function(cb) {
                return cb !== callback;
            });
        };
    }
    
    function notifyListeners(action, user) {
        for (var i = 0; i < _listeners.length; i++) {
            try {
                _listeners[i](action, user);
            } catch(e) {}
        }
    }
    
    // ============================================
    // CHANGE PASSWORD
    // ============================================
    
    function changePassword(currentPassword, newPassword) {
        // Validate new password
        var validation = validatePassword(newPassword);
        if (!validation.valid) {
            return Promise.reject(new Error('Password baru tidak valid: ' + validation.errors.join(', ')));
        }
        
        if (currentPassword === newPassword) {
            return Promise.reject(new Error('Password baru tidak boleh sama dengan password lama'));
        }
        
        var api = getAPI();
        if (!api) {
            return Promise.reject(new Error('API service tidak tersedia'));
        }
        
        return api.post('changePassword', {
            username: _currentUser ? _currentUser.username : '',
            currentPassword: currentPassword,
            newPassword: newPassword
        });
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        // Restore session
        if (restoreSession()) {
            startActivityTracking();
        }
        
        // Listen for storage changes (other tabs)
        window.addEventListener('storage', function(e) {
            if (e.key === 'auth_session') {
                if (!e.newValue) {
                    // Session dihapus di tab lain
                    clearSession();
                    notifyListeners('logout', null);
                }
            }
        });
        
        console.log('[Auth] Service initialized (authenticated: ' + _isAuthenticated + ')');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    var AuthService = {
        // Properties
        get currentUser() { return _currentUser; },
        get isAuthenticated() { return _isAuthenticated; },
        
        // Methods
        login: login,
        logout: logout,
        hasRole: hasRole,
        hasPermission: hasPermission,
        getRedirectURL: getRedirectURL,
        validatePassword: validatePassword,
        changePassword: changePassword,
        onAuthChange: onAuthChange,
        
        /**
         * Check if session is valid
         */
        checkSession: function() {
            if (!_isAuthenticated) return false;
            if (isSessionExpired()) {
                logout(true);
                return false;
            }
            return true;
        },
        
        /**
         * Get current user (safe copy)
         */
        getCurrentUser: function() {
            return _currentUser ? JSON.parse(JSON.stringify(_currentUser)) : null;
        },
        
        /**
         * Update user data in session
         */
        updateUser: function(userData) {
            if (!_currentUser) return;
            
            for (var key in userData) {
                if (userData.hasOwnProperty(key)) {
                    _currentUser[key] = userData[key];
                }
            }
            
            // Update session storage
            try {
                var sessionStr = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
                if (sessionStr) {
                    var session = JSON.parse(sessionStr);
                    session.user = _currentUser;
                    if (localStorage.getItem('auth_session')) {
                        localStorage.setItem('auth_session', JSON.stringify(session));
                    } else {
                        sessionStorage.setItem('auth_session', JSON.stringify(session));
                    }
                }
            } catch(e) {}
        },
        
        /**
         * Get login attempts info
         */
        getLoginAttempts: function(username) {
            if (username && _loginAttempts[username]) {
                return {
                    count: _loginAttempts[username].count,
                    locked: !!_loginAttempts[username].locked,
                    remaining: Math.max(0, config.maxLoginAttempts - (_loginAttempts[username].count || 0))
                };
            }
            return { count: 0, locked: false, remaining: config.maxLoginAttempts };
        },
        
        /**
         * Reset login attempts
         */
        resetLoginAttempts: function(username) {
            if (username) {
                delete _loginAttempts[username];
            } else {
                _loginAttempts = {};
            }
        }
    };
    
    // ============================================
    // EXPOSE
    // ============================================
    
    window.EArsip = window.EArsip || {};
    window.EArsip.Auth = AuthService;
    
    // Initialize
    init();
    
    console.log('Auth Service ready');
})();