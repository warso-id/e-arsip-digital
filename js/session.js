// js/session.js - Session Manager 2026 (Google Apps Script Compatible)
/**
 * E-Arsip Digital - Session Manager
 * Version: 2026.1.0
 */

import APP_CONFIG from '../config/config.js';
import { Logger } from './logger.js';
<<<<<<< HEAD
import { navigateToAppPath } from './path-utils.js';
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
import { EncryptionService } from './security/encryption.js';
import apiService from './api.js';

class SessionManager {
    constructor(config = APP_CONFIG.auth || {}) {
        this.config = config;
        this.logger = new Logger('SessionManager');
        this.encryption = new EncryptionService();
        
        this.currentSession = null;
        this.sessionCheckInterval = null;
        this.lastActivity = Date.now();
        
        this.sessionTimeout = config.sessionTimeout || 3600000;
        this.idleTimeout = config.idleTimeout || 1800000;
        this.absoluteTimeout = config.absoluteTimeout || 28800000;
        this.extendOnActivity = config.extendOnActivity !== false;
        this.maxConcurrentSessions = config.maxConcurrentSessions || 3;
        
        this.SESSION_KEY = 'auth_session';
        this.REFRESH_KEY = 'auth_refresh_token';
        this.LAST_ACTIVITY_KEY = 'last_activity';
        
        this.initialized = false;
        
        this.init();
    }
    
    async init() {
        try {
            await this.restoreSession();
            this.startSessionMonitoring();
            this.setupActivityTracking();
            this.initialized = true;
            
            this.logger.info('Session Manager initialized', {
                hasSession: !!this.currentSession
            });
        } catch (error) {
            this.logger.error('Session Manager initialization failed', error);
        }
    }
    
    async restoreSession() {
        try {
            const encryptedSession = localStorage.getItem(this.SESSION_KEY);
            if (!encryptedSession) return null;
            
            const sessionData = await this.encryption.decrypt(encryptedSession);
            if (!sessionData) {
                await this.clearSession();
                return null;
            }
            
            const session = JSON.parse(sessionData);
            
            const validation = this.validateSession(session);
            if (!validation.valid) {
                if (validation.canRefresh && session.refreshToken) {
                    return this.refreshSession(session);
                }
                
                await this.clearSession();
                return null;
            }
            
            session.lastActivity = Date.now();
            this.currentSession = session;
            this.lastActivity = Date.now();
            
            return session;
        } catch (error) {
            this.logger.error('Session restoration failed', error);
            await this.clearSession();
            return null;
        }
    }
    
    // ⬇️ REFRESH SESSION VIA GOOGLE APPS SCRIPT
    async refreshSession(existingSession = null) {
        const session = existingSession || this.currentSession;
        if (!session?.refreshToken) return null;
        
        try {
            // ⬇️ PANGGIL API REFRESH TOKEN
            const response = await apiService.post('refreshToken', {
                refreshToken: session.refreshToken
            });
            
            if (!response?.data?.token) {
                throw new Error('Invalid refresh response');
            }
            
            session.token = response.data.token;
            session.expiresAt = Date.now() + this.sessionTimeout;
            
            if (response.data.refreshToken) {
                session.refreshToken = response.data.refreshToken;
            }
            
            if (response.data.user) {
                session.user = { ...session.user, ...response.data.user };
            }
            
            session.lastActivity = Date.now();
            
            // Simpan
            const encrypted = this.encryption.encrypt(JSON.stringify(session));
            localStorage.setItem(this.SESSION_KEY, encrypted);
            
            this.currentSession = session;
            
            this.logger.info('Session refreshed');
            
            return session;
        } catch (error) {
            this.logger.error('Session refresh failed', error);
            await this.clearSession();
            return null;
        }
    }
    
    validateSession(session) {
        const now = Date.now();
        
        if (!session) {
            return { valid: false, reason: 'No session', canRefresh: false };
        }
        
        if (session.expiresAt && now > session.expiresAt) {
            return { valid: false, reason: 'Token expired', canRefresh: true };
        }
        
        if (session.absoluteExpiresAt && now > session.absoluteExpiresAt) {
            return { valid: false, reason: 'Session expired (absolute)', canRefresh: false };
        }
        
        const idleTime = now - (session.lastActivity || 0);
        if (idleTime > this.idleTimeout) {
            return { valid: false, reason: 'Session idle timeout', canRefresh: false };
        }
        
        return { valid: true, canRefresh: false };
    }
    
    async clearSession() {
        this.currentSession = null;
        this.lastActivity = Date.now();
        
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.REFRESH_KEY);
        localStorage.removeItem(this.LAST_ACTIVITY_KEY);
        
        this.logger.info('Session cleared');
    }
    
    async checkSession() {
        if (!this.currentSession) return false;
        
        const validation = this.validateSession(this.currentSession);
        
        if (!validation.valid) {
            if (validation.canRefresh) {
                const refreshed = await this.refreshSession();
                if (!refreshed) {
                    this.handleSessionExpired();
                }
                return !!refreshed;
            } else {
                this.handleSessionExpired();
                return false;
            }
        }
        
        return true;
    }
    
    startSessionMonitoring() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
        }
        
        this.sessionCheckInterval = setInterval(() => {
            this.checkSession();
        }, 30000);
    }
    
    setupActivityTracking() {
        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        
        this.activityHandler = this.debounce(() => {
            this.updateActivity();
        }, 1000);
        
        activityEvents.forEach(event => {
            document.addEventListener(event, this.activityHandler, { passive: true });
        });
        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateActivity();
            }
        });
    }
    
    async updateActivity() {
        if (!this.currentSession) return;
        
        const now = Date.now();
        this.lastActivity = now;
        
        if (this.currentSession) {
            this.currentSession.lastActivity = now;
        }
        
        if (this.extendOnActivity && this.currentSession) {
            this.currentSession.expiresAt = now + this.sessionTimeout;
        }
        
        localStorage.setItem(this.LAST_ACTIVITY_KEY, now.toString());
        
        // Simpan session setiap 5 menit
        if (now - (this.lastSave || 0) > 300000) {
            this.lastSave = now;
            const encrypted = this.encryption.encrypt(JSON.stringify(this.currentSession));
            localStorage.setItem(this.SESSION_KEY, encrypted);
        }
    }
    
    handleSessionExpired() {
        this.logger.warn('Session expired, logging out');
        
        window.dispatchEvent(new CustomEvent('session:expired', {
            detail: { reason: 'timeout', timestamp: Date.now() }
        }));
        
        this.clearSession();
        
        setTimeout(() => {
<<<<<<< HEAD
            navigateToAppPath('/login.html?message=session_expired');
=======
            window.location.href = '/login.html?message=session_expired';
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        }, 2000);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    isSessionActive() {
        if (!this.currentSession) return false;
        return this.validateSession(this.currentSession).valid;
    }
    
    destroy() {
        if (this.sessionCheckInterval) clearInterval(this.sessionCheckInterval);
        
        if (this.activityHandler) {
            ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(event => {
                document.removeEventListener(event, this.activityHandler);
            });
        }
        
        this.clearSession();
        this.initialized = false;
    }
}

const sessionManager = new SessionManager();

export default sessionManager;
export { SessionManager };