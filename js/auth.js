// js/auth.js - Authentication Service 2026 (REGULAR SCRIPT)
/**
 * E-Arsip Digital - Authentication Service
 * Version: 2026.1.0
 * ⬇️ DIUBAH: Dari ES Module ke regular script (window.EArsip.Auth)
 */
(function() {
    'use strict';
    
    var api = null; // Akan di-set setelah API siap
    
    function AuthService() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.init();
    }
    
    AuthService.prototype.init = function() {
        // Tunggu API siap
        var self = this;
        
        function checkAPI() {
            if (window.EArsip && window.EArsip.Api) {
                api = window.EArsip.Api;
                self.restoreSession();
                console.log('Auth Service initialized');
            } else {
                setTimeout(checkAPI, 100);
            }
        }
        
        checkAPI();
    };
    
    AuthService.prototype.restoreSession = function() {
        try {
            var session = localStorage.getItem('auth_session');
            if (session) {
                var data = JSON.parse(session);
                if (data.user && data.expiresAt && Date.now() < data.expiresAt) {
                    this.currentUser = data.user;
                    this.isAuthenticated = true;
                    console.log('Session restored: ' + data.user.username);
                }
            }
        } catch(e) {
            console.warn('Session restore failed:', e);
        }
    };
    
    AuthService.prototype.login = function(username, password) {
        var self = this;
        
        return api.post('login', {
            username: username,
            password: password
        }).then(function(response) {
            var userData = response.data || response;
            
            if (userData.user) {
                self.currentUser = userData.user;
                self.isAuthenticated = true;
                
                // Simpan session
                var session = {
                    token: userData.token || 'token-' + Date.now(),
                    refreshToken: userData.refreshToken || '',
                    user: userData.user,
                    expiresAt: Date.now() + 3600000,
                    lastActivity: Date.now()
                };
                
                localStorage.setItem('auth_session', JSON.stringify(session));
                localStorage.setItem('auth_token', session.token);
                
                console.log('Login success: ' + userData.user.username);
            }
            
            return userData;
        });
    };
    
    AuthService.prototype.logout = function() {
        this.currentUser = null;
        this.isAuthenticated = false;
        
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_refresh_token');
        
        console.log('Logged out');
    };
    
    AuthService.prototype.hasRole = function(roles) {
        if (!this.currentUser) return false;
        var roleList = Array.isArray(roles) ? roles : [roles];
        return roleList.indexOf(this.currentUser.role) !== -1;
    };
    
    AuthService.prototype.hasPermission = function(permission) {
        if (!this.currentUser) return false;
        var perms = this.currentUser.permissions || [];
        return perms.indexOf(permission) !== -1 || perms.indexOf('all') !== -1;
    };
    
    // Expose ke global
    window.EArsip.Auth = new AuthService();
    
    console.log('Auth Service ready');
})();
