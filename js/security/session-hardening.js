// js/security/session-hardening.js - Session Hardening 2026
/**
 * E-Arsip Digital - Session Hardening
 * Version: 2026.1.0
 * Features: Session fingerprinting, concurrent session control,
 *           activity monitoring, automatic session termination
 */

import { Logger } from '../logger.js';
import APP_CONFIG from '../../config/config.js';

class SessionHardening {
    constructor(config = APP_CONFIG.security?.session || {}) {
        this.logger = new Logger('SessionHardening');
        
        this.config = {
            httpOnly: config.httpOnly !== false,
            secure: config.secure !== false,
            sameSite: config.sameSite || 'Strict',
            maxConcurrentSessions: config.maxConcurrentSessions || 3,
            idleTimeout: config.idleTimeout || 1800000,
            absoluteTimeout: config.absoluteTimeout || 28800000,
            extendOnActivity: config.extendOnActivity !== false,
            requireReauth: config.requireReauth || false,
            ...config
        };
        
        // Active session tracking
        this.activeSessions = new Map();
        this.currentSessionId = null;
        
        // Activity monitoring
        this.lastActivity = Date.now();
        this.activityEvents = [
            'mousedown', 'mousemove', 'keydown', 'scroll',
            'touchstart', 'touchmove', 'click', 'focus'
        ];
        this.activityHandler = null;
        
        // Timers
        this.idleTimer = null;
        this.absoluteTimer = null;
        this.heartbeatTimer = null;
        
        this.initialized = false;
        
        this.init();
    }
    
    init() {
        this.currentSessionId = this.getOrCreateSessionId();
        this.registerSession();
        this.startActivityMonitoring();
        this.startIdleTimer();
        this.startAbsoluteTimer();
        this.startHeartbeat();
        this.setupTabSync();
        
        this.initialized = true;
        
        this.logger.info('Session hardening initialized', {
            sessionId: this.currentSessionId
        });
    }
    
    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('session_id');
        
        if (!sessionId) {
            sessionId = this.generateSessionId();
            sessionStorage.setItem('session_id', sessionId);
        }
        
        return sessionId;
    }
    
    generateSessionId() {
        const array = new Uint32Array(4);
        crypto.getRandomValues(array);
        
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-4)).join('');
    }
    
    registerSession() {
        const sessionData = {
            sessionId: this.currentSessionId,
            tabId: this.getTabId(),
            createdAt: Date.now(),
            lastActivity: Date.now(),
            fingerprint: this.generateFingerprint()
        };
        
        // Store in session storage (tab-specific)
        sessionStorage.setItem('session_data', JSON.stringify(sessionData));
        
        // Register in active sessions
        this.activeSessions.set(this.currentSessionId, sessionData);
        
        // Enforce concurrent session limit
        this.enforceConcurrentLimit();
        
        // Store active sessions in localStorage for cross-tab access
        this.saveActiveSessions();
        
        this.logger.debug('Session registered', {
            sessionId: this.currentSessionId,
            activeCount: this.activeSessions.size
        });
    }
    
    enforceConcurrentLimit() {
        if (this.activeSessions.size <= this.config.maxConcurrentSessions) return;
        
        // Find oldest sessions to terminate
        const sessions = Array.from(this.activeSessions.entries());
        sessions.sort((a, b) => a[1].createdAt - b[1].createdAt);
        
        const sessionsToRemove = sessions.slice(0, sessions.length - this.config.maxConcurrentSessions);
        
        sessionsToRemove.forEach(([id, data]) => {
            this.activeSessions.delete(id);
            
            this.logger.warn('Concurrent session limit enforced', {
                terminatedSession: id,
                reason: 'max_concurrent_exceeded'
            });
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('session:terminated', {
                detail: { sessionId: id, reason: 'concurrent_limit' }
            }));
        });
        
        this.saveActiveSessions();
    }
    
    saveActiveSessions() {
        try {
            const sessions = Array.from(this.activeSessions.entries()).map(([id, data]) => ({
                id,
                createdAt: data.createdAt,
                lastActivity: data.lastActivity
            }));
            
            localStorage.setItem('active_sessions', JSON.stringify(sessions));
        } catch (error) {
            this.logger.warn('Failed to save active sessions', error);
        }
    }
    
    loadActiveSessions() {
        try {
            const stored = localStorage.getItem('active_sessions');
            if (stored) {
                const sessions = JSON.parse(stored);
                sessions.forEach(s => {
                    if (!this.activeSessions.has(s.id)) {
                        this.activeSessions.set(s.id, s);
                    }
                });
            }
        } catch {
            // Ignore
        }
    }
    
    // ============================================
    // ACTIVITY MONITORING
    // ============================================
    
    startActivityMonitoring() {
        this.activityHandler = this.debounce(() => {
            this.updateActivity();
        }, 1000);
        
        this.activityEvents.forEach(event => {
            document.addEventListener(event, this.activityHandler, { passive: true });
        });
        
        // Also track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateActivity();
            }
        });
    }
    
    updateActivity() {
        this.lastActivity = Date.now();
        
        // Update session data
        if (this.activeSessions.has(this.currentSessionId)) {
            const session = this.activeSessions.get(this.currentSessionId);
            session.lastActivity = Date.now();
            
            // Extend session if configured
            if (this.config.extendOnActivity) {
                this.resetIdleTimer();
            }
        }
        
        // Update session storage
        try {
            const sessionData = JSON.parse(sessionStorage.getItem('session_data') || '{}');
            sessionData.lastActivity = Date.now();
            sessionStorage.setItem('session_data', JSON.stringify(sessionData));
        } catch {
            // Ignore
        }
    }
    
    // ============================================
    // TIMERS
    // ============================================
    
    startIdleTimer() {
        this.resetIdleTimer();
    }
    
    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        
        this.idleTimer = setTimeout(() => {
            this.logger.warn('Session idle timeout');
            
            window.dispatchEvent(new CustomEvent('session:idle_timeout', {
                detail: { lastActivity: this.lastActivity, timeout: this.config.idleTimeout }
            }));
            
            // Terminate session after idle timeout
            this.terminateSession('idle_timeout');
        }, this.config.idleTimeout);
    }
    
    startAbsoluteTimer() {
        if (this.absoluteTimer) clearTimeout(this.absoluteTimer);
        
        this.absoluteTimer = setTimeout(() => {
            this.logger.warn('Session absolute timeout');
            
            window.dispatchEvent(new CustomEvent('session:absolute_timeout', {
                detail: { timeout: this.config.absoluteTimeout }
            }));
            
            this.terminateSession('absolute_timeout');
        }, this.config.absoluteTimeout);
    }
    
    startHeartbeat() {
        // Periodic check for session validity
        this.heartbeatTimer = setInterval(() => {
            this.checkSessionHealth();
        }, 30000); // Every 30 seconds
    }
    
    checkSessionHealth() {
        // Check if session is still valid
        const sessionData = this.activeSessions.get(this.currentSessionId);
        if (!sessionData) {
            this.terminateSession('session_not_found');
            return;
        }
        
        // Check idle time
        const idleTime = Date.now() - this.lastActivity;
        if (idleTime > this.config.idleTimeout) {
            this.terminateSession('idle_timeout');
            return;
        }
        
        // Check absolute timeout
        const sessionAge = Date.now() - sessionData.createdAt;
        if (sessionAge > this.config.absoluteTimeout) {
            this.terminateSession('absolute_timeout');
            return;
        }
    }
    
    // ============================================
    // SESSION TERMINATION
    // ============================================
    
    terminateSession(reason) {
        this.logger.warn('Terminating session', {
            sessionId: this.currentSessionId,
            reason
        });
        
        // Remove from active sessions
        this.activeSessions.delete(this.currentSessionId);
        this.saveActiveSessions();
        
        // Clear timers
        this.clearTimers();
        
        // Clear session storage
        sessionStorage.removeItem('session_id');
        sessionStorage.removeItem('session_data');
        
        // Clear auth data
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_refresh_token');
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('session:terminated', {
            detail: { sessionId: this.currentSessionId, reason }
        }));
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = '/login.html?message=session_expired';
        }, 1000);
    }
    
    clearTimers() {
        if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
        if (this.absoluteTimer) { clearTimeout(this.absoluteTimer); this.absoluteTimer = null; }
        if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    }
    
    // ============================================
    // FINGERPRINTING
    // ============================================
    
    generateFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.deviceMemory || 'unknown'
        ];
        
        const fingerprint = components.join('|');
        
        // Simple hash
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const chr = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        
        return Math.abs(hash).toString(36);
    }
    
    validateFingerprint() {
        try {
            const sessionData = JSON.parse(sessionStorage.getItem('session_data') || '{}');
            const currentFingerprint = this.generateFingerprint();
            
            if (sessionData.fingerprint && sessionData.fingerprint !== currentFingerprint) {
                this.logger.warn('Session fingerprint mismatch - possible session hijacking');
                return false;
            }
            
            return true;
        } catch {
            return false;
        }
    }
    
    // ============================================
    // TAB SYNCHRONIZATION
    // ============================================
    
    setupTabSync() {
        // Listen for storage events from other tabs
        window.addEventListener('storage', (event) => {
            if (event.key === 'active_sessions') {
                this.loadActiveSessions();
            }
            
            if (event.key === 'session_terminate' && event.newValue) {
                const data = JSON.parse(event.newValue);
                if (data.sessionId !== this.currentSessionId) {
                    this.activeSessions.delete(data.sessionId);
                }
            }
        });
        
        // BroadcastChannel for real-time sync
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('session-sync');
            
            this.channel.onmessage = (event) => {
                const { type, data } = event.data;
                
                if (type === 'session_created') {
                    this.activeSessions.set(data.sessionId, data);
                    this.saveActiveSessions();
                } else if (type === 'session_terminated') {
                    this.activeSessions.delete(data.sessionId);
                    this.saveActiveSessions();
                }
            };
        }
    }
    
    getTabId() {
        let tabId = sessionStorage.getItem('tab_id');
        
        if (!tabId) {
            tabId = `tab_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
            sessionStorage.setItem('tab_id', tabId);
        }
        
        return tabId;
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    getActiveSessionCount() {
        return this.activeSessions.size;
    }
    
    getSessionAge() {
        const sessionData = this.activeSessions.get(this.currentSessionId);
        if (!sessionData) return 0;
        return Date.now() - sessionData.createdAt;
    }
    
    getIdleTime() {
        return Date.now() - this.lastActivity;
    }
    
    isSessionValid() {
        return this.activeSessions.has(this.currentSessionId) && 
               this.getIdleTime() < this.config.idleTimeout &&
               this.getSessionAge() < this.config.absoluteTimeout &&
               this.validateFingerprint();
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        this.clearTimers();
        
        if (this.activityHandler) {
            this.activityEvents.forEach(event => {
                document.removeEventListener(event, this.activityHandler);
            });
        }
        
        if (this.channel) {
            this.channel.close();
        }
        
        this.activeSessions.clear();
        this.initialized = false;
        
        this.logger.info('Session hardening destroyed');
    }
}

// Create singleton
const sessionHardening = new SessionHardening();

export default sessionHardening;
export { SessionHardening };