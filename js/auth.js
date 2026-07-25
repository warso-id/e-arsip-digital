// js/auth.js - Authentication Service 2026 (Google Apps Script Compatible)
/**
 * E-Arsip Digital - Authentication Service
 * Version: 2026.1.0
 * Google Apps Script Backend Compatible
 */

import APP_CONFIG from '../config/config.js';
import apiService from './api.js';
import { Logger } from './logger.js';
import { SessionManager } from './session.js';
import { EncryptionService } from './security/encryption.js';
import { TokenManager } from './security/token-manager.js';
import { navigateToAppPath, resolveAppPath } from './path-utils.js';

class AuthService {
    constructor(config = APP_CONFIG) {
        this.config = config;
        this.logger = new Logger('AuthService');
        this.session = new SessionManager();
        this.encryption = new EncryptionService();
        this.tokenManager = new TokenManager();
        
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authListeners = new Set();
        this.initialized = false;
        
        this.loginAttempts = new Map();
        this.maxLoginAttempts = config.auth?.maxLoginAttempts || 5;
        this.lockoutDuration = config.auth?.lockoutDuration || 900000;
        
        this.init();
    }
    
    async init() {
        try {
            await this.restoreSession();
            this.setupAutoRefresh();
            this.setupActivityTracking();
            this.initialized = true;
            
            this.logger.info('Auth Service initialized', {
                authenticated: this.isAuthenticated,
                user: this.currentUser?.username
            });
        } catch (error) {
            this.logger.error('Auth Service initialization failed', error);
        }
    }
    
    async restoreSession() {
        try {
            const encryptedSession = localStorage.getItem('auth_session');
            if (!encryptedSession) return;
            
            const sessionData = await this.encryption.decrypt(encryptedSession);
            if (!sessionData) {
                this.clearSession();
                return;
            }
            
            const { token, refreshToken, user, expiresAt } = JSON.parse(sessionData);
            
            if (Date.now() > expiresAt) {
                const refreshed = await this.refreshToken(refreshToken);
                if (!refreshed) {
                    this.clearSession();
                    return;
                }
            } else {
                this.setAuthState(token, user);
            }
        } catch (error) {
            this.logger.error('Session restoration failed', error);
            this.clearSession();
        }
    }
    
    // ============================================
    // ⬇️ LOGIN - DISESUAIKAN UNTUK GOOGLE APPS SCRIPT
    // ============================================
    async login(credentials) {
        this.validateCredentials(credentials);
        
        // Check lockout
        const attemptCount = this.loginAttempts.get(credentials.username) || 0;
        if (attemptCount >= this.maxLoginAttempts) {
            const lockoutTime = this.getLockoutTime(credentials.username);
            if (lockoutTime > 0) {
                throw new Error(`Akun terkunci. Silakan coba lagi dalam ${Math.ceil(lockoutTime / 60000)} menit`);
            }
        }
        
        try {
            // ⬇️ PANGGIL API GOOGLE APPS SCRIPT DENGAN ACTION 'login'
            const response = await apiService.post('login', {
                username: credentials.username,
                password: credentials.password,
                timestamp: Date.now(),
                deviceInfo: this.getDeviceInfo()
            });
            
            // ⬇️ GOOGLE APPS SCRIPT RETURN response.data
            if (!response || !response.data || !response.data.token) {
                throw new Error('Login gagal: Respon tidak valid');
            }
            
            const { token, refreshToken, user } = response.data;
            
            if (!this.validateUserRoles(user)) {
                throw new Error('Role pengguna tidak valid');
            }
            
            this.setAuthState(token, user, refreshToken);
            this.loginAttempts.delete(credentials.username);
            
            this.logger.info('Login successful', { 
                username: user.username, 
                role: user.role 
            });
            
            this.auditLogin(user, true);
            this.redirectBasedOnRole(user);
            
            return { success: true, user };
            
        } catch (error) {
            const attempts = (this.loginAttempts.get(credentials.username) || 0) + 1;
            this.loginAttempts.set(credentials.username, attempts);
            
            this.auditLogin({ username: credentials.username }, false, error.message);
            
            this.logger.warn('Login failed', { 
                username: credentials.username, 
                attempts,
                error: error.message 
            });
            
            throw new Error(this.getLoginErrorMessage(attempts));
        }
    }
    
    // ============================================
    // ⬇️ LOGOUT - DISESUAIKAN
    // ============================================
    async logout(silent = false) {
        try {
            if (!silent && this.currentUser) {
                // ⬇️ PANGGIL API LOGOUT
                await apiService.post('logout', {
                    userId: this.currentUser.id,
                    username: this.currentUser.username,
                    sessionId: this.tokenManager.getAccessToken()
                }).catch(() => {});
            }
        } finally {
            this.clearSession();
            this.clearUI();
            
            if (!silent) {
                this.redirectToLogin();
            }
            
            this.notifyAuthListeners('logout');
        }
    }
    
    // ============================================
    // ⬇️ REFRESH TOKEN - DISESUAIKAN
    // ============================================
    async refreshToken(refreshToken = null) {
        const token = refreshToken || this.tokenManager.getRefreshToken();
        if (!token) return false;
        
        try {
            // ⬇️ PANGGIL API REFRESH TOKEN
            const response = await apiService.post('refreshToken', {
                refreshToken: token
            });
            
            if (response?.data?.token) {
                this.setAuthState(
                    response.data.token,
                    response.data.user || this.currentUser,
                    response.data.refreshToken
                );
                return true;
            }
        } catch (error) {
            this.logger.warn('Token refresh failed', error);
        }
        
        return false;
    }
    
    // ============================================
    // ⬇️ CHANGE PASSWORD - DISESUAIKAN
    // ============================================
    async changePassword(currentPassword, newPassword) {
        this.validatePasswordStrength(newPassword);
        
        try {
            // ⬇️ PANGGIL API CHANGE PASSWORD
            const response = await apiService.post('changePassword', {
                userId: this.currentUser?.id,
                username: this.currentUser?.username,
                currentPassword: currentPassword,
                newPassword: newPassword
            });
            
            this.logger.info('Password changed successfully');
            return response;
        } catch (error) {
            this.logger.error('Password change failed', error);
            throw error;
        }
    }
    
    // ⬇️ REQUEST PASSWORD RESET - DISESUAIKAN
    async requestPasswordReset(username) {
        try {
            const response = await apiService.post('resetPassword', {
                username: username
            });
            
            this.logger.info('Password reset requested', { username });
            return response;
        } catch (error) {
            this.logger.error('Password reset request failed', error);
            throw error;
        }
    }
    
    setAuthState(token, user, refreshToken = null) {
        this.tokenManager.setAccessToken(token);
        if (refreshToken) this.tokenManager.setRefreshToken(refreshToken);
        
        this.currentUser = user;
        this.isAuthenticated = true;
        
        const sessionData = {
            token,
            refreshToken,
            user,
            expiresAt: Date.now() + (this.config.auth?.sessionTimeout || 3600000),
            lastActivity: Date.now()
        };
        
        this.saveSession(sessionData);
        this.updateUI();
        this.notifyAuthListeners('login', user);
    }
    
    // ============================================
    // ⬇️ SESSION & UI METHODS (TETAP SAMA)
    // ============================================
    saveSession(sessionData) {
        try {
            const encrypted = this.encryption.encrypt(JSON.stringify(sessionData));
            localStorage.setItem('auth_session', encrypted);
        } catch (error) {
            this.logger.error('Failed to save session', error);
        }
    }
    
    clearSession() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.tokenManager.clearTokens();
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_refresh_token');
    }
    
    validateCredentials(credentials) {
        if (!credentials.username || credentials.username.length < 3) {
            throw new Error('Username minimal 3 karakter');
        }
        if (!credentials.password || credentials.password.length < (this.config.auth?.passwordMinLength || 8)) {
            throw new Error(`Password minimal ${this.config.auth?.passwordMinLength || 8} karakter`);
        }
    }
    
    validatePasswordStrength(password) {
        const requirements = [];
        const cfg = this.config.auth || {};
        
        if (password.length < (cfg.passwordMinLength || 8)) {
            requirements.push(`minimal ${cfg.passwordMinLength || 8} karakter`);
        }
        if (cfg.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            requirements.push('harus mengandung huruf besar');
        }
        if (cfg.passwordRequireNumber && !/[0-9]/.test(password)) {
            requirements.push('harus mengandung angka');
        }
        if (cfg.passwordRequireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            requirements.push('harus mengandung karakter khusus');
        }
        
        if (requirements.length > 0) {
            throw new Error('Password tidak memenuhi syarat: ' + requirements.join(', '));
        }
    }
    
    validateUserRoles(user) {
        const validRoles = ['super_admin', 'admin', 'kaprodi', 'admin_kaprodi', 'wadek', 'admin_wadek', 
                           'dekan', 'admin_dekan', 'kasubag', 'ketua_upm', 'litdianmas', 'staf', 
                           'dosen', 'mahasiswa', 'lembaga_kemahasiswaan', 'user'];
        return validRoles.includes(user.role);
    }
    
    hasPermission(permission) {
        if (!this.currentUser) return false;
        const permissions = this.currentUser.permissions || [];
        return permissions.includes(permission) || permissions.includes('all');
    }
    
    hasRole(roles) {
        if (!this.currentUser) return false;
        const roleList = Array.isArray(roles) ? roles : [roles];
        return roleList.includes(this.currentUser.role);
    }
    
    setupAutoRefresh() {
        const refreshInterval = (this.config.auth?.sessionTimeout || 3600000) - 300000;
        
        this.refreshInterval = setInterval(() => {
            if (this.isAuthenticated) {
                this.refreshToken();
            }
        }, refreshInterval);
    }
    
    setupActivityTracking() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        
        this.activityHandler = () => {
            if (this.isAuthenticated) {
                this.updateLastActivity();
            }
        };
        
        events.forEach(event => {
            document.addEventListener(event, this.activityHandler, { passive: true });
        });
        
        this.inactivityInterval = setInterval(() => {
            if (this.isAuthenticated && this.isSessionExpired()) {
                this.logout(true);
                this.showSessionExpiredMessage();
            }
        }, 60000);
    }
    
    updateLastActivity() {
        const sessionData = this.getSessionData();
        if (sessionData) {
            sessionData.lastActivity = Date.now();
            this.saveSession(sessionData);
        }
    }
    
    isSessionExpired() {
        const sessionData = this.getSessionData();
        if (!sessionData) return true;
        
        const inactiveTime = Date.now() - sessionData.lastActivity;
        return inactiveTime > (this.config.auth?.sessionTimeout || 3600000);
    }
    
    getSessionData() {
        try {
            const encrypted = localStorage.getItem('auth_session');
            if (!encrypted) return null;
            
            const decrypted = this.encryption.decrypt(encrypted);
            return decrypted ? JSON.parse(decrypted) : null;
        } catch {
            return null;
        }
    }
    
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: Date.now()
        };
    }
    
    getLockoutTime(username) {
        const attempts = this.loginAttempts.get(username) || 0;
        if (attempts < this.maxLoginAttempts) return 0;
        
        // Return remaining lockout time
        const lockoutStart = this.loginLockoutTimes?.get(username) || Date.now();
        const remaining = this.lockoutDuration - (Date.now() - lockoutStart);
        return Math.max(0, remaining);
    }
    
    getLoginErrorMessage(attempts) {
        const remainingAttempts = this.maxLoginAttempts - attempts;
        
        if (remainingAttempts <= 0) {
            return 'Akun terkunci karena terlalu banyak percobaan. Silakan coba lagi dalam 15 menit';
        } else if (remainingAttempts <= 2) {
            return `Login gagal. Percobaan tersisa: ${remainingAttempts}`;
        } else {
            return 'Username atau password salah';
        }
    }
    
    // ============================================
    // UI METHODS
    // ============================================
    updateUI() {
        document.querySelectorAll('.auth-hidden').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.auth-visible').forEach(el => el.style.display = '');
        
        const userElements = document.querySelectorAll('[data-user-info]');
        userElements.forEach(el => {
            const field = el.dataset.userInfo;
            if (this.currentUser && this.currentUser[field]) {
                el.textContent = this.currentUser[field];
            }
        });
    }
    
    clearUI() {
        document.querySelectorAll('.auth-hidden').forEach(el => el.style.display = '');
        document.querySelectorAll('.auth-visible').forEach(el => el.style.display = 'none');
    }
    
    showSessionExpiredMessage() {
        const message = document.createElement('div');
        message.className = 'session-expired-message';
        message.innerHTML = `
            <div class="session-expired-content">
                <i class="fas fa-clock"></i>
                <h3>Sesi Berakhir</h3>
                <p>Sesi Anda telah berakhir karena tidak ada aktivitas.</p>
                <button onclick="window.location.href='${resolveAppPath('/login.html')}'">Login</button>
            </div>
        `;
        document.body.appendChild(message);
    }
    
    // ============================================
    // NAVIGATION
    // ============================================
    redirectBasedOnRole(user) {
        const roleRoutes = {
            'super_admin': '/dashboard/super-admin/index.html',
            'admin': '/dashboard/admin/index.html',
            'kaprodi': '/dashboard/kaprodi/index.html',
            'admin_kaprodi': '/dashboard/admin-kaprodi/index.html',
            'wadek': '/dashboard/wadek/index.html',
            'admin_wadek': '/dashboard/admin-wadek/index.html',
            'dekan': '/dashboard/dekan/index.html',
            'admin_dekan': '/dashboard/admin-dekan/index.html',
            'kasubag': '/dashboard/kasubag/index.html',
            'ketua_upm': '/dashboard/ketua_upm/index.html',
            'litdianmas': '/dashboard/litdianmas/index.html',
            'staf': '/dashboard/staf/index.html',
            'dosen': '/dashboard/dosen/index.html',
            'mahasiswa': '/dashboard/mahasiswa/index.html',
            'lembaga_kemahasiswaan': '/dashboard/lembaga_kemahasiswaan/index.html',
            'user': '/dashboard/user/index.html'
        };
        
        const route = roleRoutes[user.role] || '/dashboard/user/index.html';
        navigateToAppPath(route, false);
    }
    
    redirectToLogin() {
        navigateToAppPath('/login.html', false);
    }
    
    // ============================================
    // AUDIT
    // ============================================
    async auditLogin(user, success, error = null) {
        try {
            await apiService.post('createLog', {
                userId: user.id || '',
                username: user.username || 'unknown',
                action: success ? 'login' : 'login_failed',
                description: success ? 'Login berhasil' : `Login gagal: ${error}`,
                details: JSON.stringify({
                    deviceInfo: this.getDeviceInfo(),
                    success
                })
            }).catch(() => {});
        } catch {
            // Ignore audit errors
        }
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    onAuthChange(listener) {
        this.authListeners.add(listener);
        return () => this.authListeners.delete(listener);
    }
    
    notifyAuthListeners(action, user = null) {
        this.authListeners.forEach(listener => {
            try {
                listener(action, user);
            } catch (error) {
                this.logger.error('Auth listener error', error);
            }
        });
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    destroy() {
        clearInterval(this.refreshInterval);
        clearInterval(this.inactivityInterval);
        
        if (this.activityHandler) {
            ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
                document.removeEventListener(event, this.activityHandler);
            });
        }
        
        this.authListeners.clear();
    }
}

const authService = new AuthService();

export default authService;
export { AuthService };