// js/session.js - Enterprise Session Manager 2026
/**
 * E-Arsip Digital - Advanced Session Manager
 * Version: 2026.1.0
 * Features: Secure session management, token refresh, idle detection,
 *           concurrent session control, PWA-aware, GAS compatible
 * Security: AES-GCM encryption, fingerprint validation, secure token storage
 */

import APP_CONFIG from '../config/config.js';

class SessionManager {
    constructor(config = {}) {
        // ✅ FIX: Lazy load dependencies
        this.logger = null;
        this.encryption = null;
        this.apiService = null;
        
        // Configuration
        this.config = {
            sessionTimeout: 3600000,      // 1 jam
            idleTimeout: 1800000,          // 30 menit
            absoluteTimeout: 28800000,     // 8 jam
            refreshThreshold: 300000,      // Refresh 5 menit sebelum expired
            extendOnActivity: true,
            maxConcurrentSessions: 3,
            enforceFingerprint: true,
            encryptSession: true,
            persistSession: true,
            ...APP_CONFIG?.auth,
            ...APP_CONFIG?.session,
            ...config
        };
        
        // State
        this.currentSession = null;
        this.lastActivity = Date.now();
        this.lastSave = 0;
        this.initialized = false;
        this.refreshing = false;
        
        // Storage keys
        this.KEYS = {
            SESSION: 'auth_session',
            REFRESH: 'auth_refresh_token',
            ACTIVITY: 'last_activity',
            FINGERPRINT: 'session_fingerprint',
            METADATA: 'session_metadata'
        };
        
        // Timers
        this.timers = {
            monitor: null,
            refresh: null,
            idle: null
        };
        
        // Event handlers
        this.handlers = {};
        
        // Session event listeners
        this.listeners = new Map();
        
        this.init();
    }
    
    async init() {
        try {
            // Init dependencies
            await this.initDependencies();
            
            // Restore previous session
            await this.restoreSession();
            
            // Start monitoring
            this.startSessionMonitoring();
            this.setupActivityTracking();
            this.setupIdleDetection();
            
            // Setup refresh scheduler
            if (this.currentSession) {
                this.scheduleTokenRefresh();
            }
            
            this.initialized = true;
            
            this.log('info', 'Session Manager initialized', {
                hasSession: !!this.currentSession,
                userId: this.currentSession?.user?.id
            });
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('session:ready', {
                detail: { active: !!this.currentSession }
            }));
            
        } catch (error) {
            console.error('[Session] Initialization failed:', error);
        }
    }
    
    async initDependencies() {
        // Lazy load Logger
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Session');
        } catch {
            this.logger = {
                debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
            };
        }
        
        // Lazy load EncryptionService
        try {
            const encModule = await import('./security/encryption.js');
            this.encryption = new encModule.EncryptionService();
        } catch {
            this.encryption = null;
        }
        
        // Lazy load API Service
        try {
            const apiModule = await import('./api.js');
            this.apiService = apiModule.default || apiModule;
        } catch {
            this.apiService = null;
        }
    }
    
    log(level, message, data = null) {
        if (this.logger?.[level]) {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // SESSION CREATION
    // ============================================
    
    async createSession(userData, tokens, options = {}) {
        const now = Date.now();
        
        // Check concurrent sessions
        if (this.config.maxConcurrentSessions > 0) {
            const currentCount = await this.getActiveSessionCount();
            if (currentCount >= this.config.maxConcurrentSessions) {
                // Terminate oldest session
                await this.terminateOldestSession();
            }
        }
        
        // Build session object
        const session = {
            id: this.generateSessionId(),
            token: tokens.accessToken || tokens.token,
            refreshToken: tokens.refreshToken,
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                role: userData.role,
                permissions: userData.permissions || [],
                fullName: userData.fullName || userData.username
            },
            createdAt: now,
            lastActivity: now,
            expiresAt: now + this.config.sessionTimeout,
            absoluteExpiresAt: now + this.config.absoluteTimeout,
            deviceInfo: this.getDeviceInfo(),
            fingerprint: this.generateFingerprint(),
            ipAddress: options.ipAddress || 'unknown',
            userAgent: navigator.userAgent.substring(0, 200),
            isPWA: this.isPWA(),
            metadata: {
                version: APP_CONFIG?.app?.version || '2026.1.0',
                loginMethod: options.loginMethod || 'credentials',
                rememberMe: options.rememberMe || false,
                ...options.metadata
            }
        };
        
        // Validate before storing
        const validation = this.validateSessionStructure(session);
        if (!validation.valid) {
            throw new Error(`Invalid session: ${validation.errors.join(', ')}`);
        }
        
        // Store session
        await this.storeSession(session);
        
        // Set as current
        this.currentSession = session;
        this.lastActivity = now;
        
        // Store fingerprint
        this.storeFingerprint(session.fingerprint);
        
        // Schedule refresh
        this.scheduleTokenRefresh();
        
        // Log event
        this.log('info', 'Session created', {
            userId: session.user.id,
            role: session.user.role,
            expiresAt: new Date(session.expiresAt).toISOString()
        });
        
        this.emit('created', { session: this.sanitizeSession(session) });
        
        return session;
    }
    
    // ============================================
    // SESSION RESTORATION
    // ============================================
    
    async restoreSession() {
        try {
            // Try primary storage
            let sessionData = await this.getStoredSession();
            
            if (!sessionData) {
                // Try fallback (IndexedDB)
                sessionData = await this.getSessionFromIndexedDB();
            }
            
            if (!sessionData) {
                return null;
            }
            
            // Parse session
            let session;
            try {
                session = typeof sessionData === 'string' ? 
                    JSON.parse(sessionData) : sessionData;
            } catch {
                await this.clearSession();
                return null;
            }
            
            // Validate session
            const validation = this.validateSession(session);
            
            if (!validation.valid) {
                if (validation.canRefresh && session.refreshToken) {
                    this.log('info', 'Session expired, attempting refresh');
                    const refreshed = await this.refreshSession(session);
                    
                    if (refreshed) {
                        return refreshed;
                    }
                }
                
                this.log('warn', 'Session invalid, clearing', {
                    reason: validation.reason
                });
                
                await this.clearSession();
                return null;
            }
            
            // Validate fingerprint
            if (this.config.enforceFingerprint) {
                const currentFingerprint = this.generateFingerprint();
                const storedFingerprint = this.getStoredFingerprint();
                
                if (storedFingerprint && currentFingerprint !== storedFingerprint) {
                    this.log('warn', 'Fingerprint mismatch', {
                        sessionId: session.id
                    });
                    
                    // Allow minor changes, terminate on major
                    if (this.isFingerprintSignificantlyDifferent(
                        currentFingerprint, storedFingerprint)) {
                        await this.clearSession();
                        this.emit('security:fingerprintMismatch', {
                            sessionId: session.id
                        });
                        return null;
                    }
                }
            }
            
            // Update activity
            session.lastActivity = Date.now();
            this.currentSession = session;
            this.lastActivity = Date.now();
            
            // Schedule refresh
            this.scheduleTokenRefresh();
            
            this.log('info', 'Session restored', {
                userId: session.user.id,
                remainingTime: session.expiresAt - Date.now()
            });
            
            this.emit('restored', { session: this.sanitizeSession(session) });
            
            return session;
            
        } catch (error) {
            this.log('error', 'Session restoration failed', {
                error: error.message
            });
            
            await this.clearSession();
            return null;
        }
    }
    
    async getStoredSession() {
        try {
            const encrypted = localStorage.getItem(this.KEYS.SESSION);
            if (!encrypted) return null;
            
            // Decrypt if needed
            if (this.config.encryptSession && this.encryption && encrypted.startsWith('ENC:')) {
                return await this.encryption.decrypt(encrypted.substring(4));
            }
            
            return encrypted;
        } catch (error) {
            this.log('warn', 'Failed to get stored session', {
                error: error.message
            });
            return null;
        }
    }
    
    async getSessionFromIndexedDB() {
        if (!('indexedDB' in window)) return null;
        
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('EArsipSessions', 1);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('sessions')) {
                        db.createObjectStore('sessions', { keyPath: 'key' });
                    }
                };
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction('sessions', 'readonly');
                    const store = transaction.objectStore('sessions');
                    const getRequest = store.get('current_session');
                    
                    getRequest.onsuccess = () => {
                        resolve(getRequest.result?.value || null);
                    };
                    getRequest.onerror = () => resolve(null);
                };
                
                request.onerror = () => resolve(null);
                
            } catch {
                resolve(null);
            }
        });
    }
    
    // ============================================
    // SESSION STORAGE
    // ============================================
    
    async storeSession(session) {
        try {
            const data = JSON.stringify(session);
            
            if (this.config.encryptSession && this.encryption) {
                const encrypted = await this.encryption.encrypt(data);
                localStorage.setItem(this.KEYS.SESSION, `ENC:${encrypted}`);
            } else {
                localStorage.setItem(this.KEYS.SESSION, data);
            }
            
            if (session.refreshToken) {
                const encryptedRefresh = this.config.encryptSession && this.encryption ?
                    `ENC:${await this.encryption.encrypt(session.refreshToken)}` :
                    session.refreshToken;
                    
                localStorage.setItem(this.KEYS.REFRESH, encryptedRefresh);
            }
            
            // Also store in IndexedDB for PWA
            await this.storeSessionInIndexedDB(session);
            
            this.lastSave = Date.now();
            
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.log('warn', 'Storage quota exceeded');
                await this.cleanupOldSessions();
            }
            
            this.log('error', 'Failed to store session', {
                error: error.message
            });
        }
    }
    
    async storeSessionInIndexedDB(session) {
        if (!('indexedDB' in window)) return;
        
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('EArsipSessions', 1);
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction('sessions', 'readwrite');
                    const store = transaction.objectStore('sessions');
                    
                    store.put({
                        key: 'current_session',
                        value: JSON.stringify(session),
                        timestamp: Date.now()
                    });
                    
                    resolve();
                };
                
                request.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }
    
    async clearSession() {
        this.currentSession = null;
        this.lastActivity = Date.now();
        
        // Clear localStorage
        Object.values(this.KEYS).forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch {}
        });
        
        // Clear IndexedDB
        await this.clearSessionFromIndexedDB();
        
        // Clear timers
        this.clearTimers();
        
        this.log('info', 'Session cleared');
        this.emit('cleared', { timestamp: Date.now() });
    }
    
    async clearSessionFromIndexedDB() {
        if (!('indexedDB' in window)) return;
        
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('EArsipSessions', 1);
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction('sessions', 'readwrite');
                    const store = transaction.objectStore('sessions');
                    store.delete('current_session');
                    resolve();
                };
                
                request.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }
    
    async cleanupOldSessions() {
        try {
            localStorage.removeItem('error_logs');
            localStorage.removeItem('security_log');
            localStorage.removeItem('fix_history');
            
            this.log('info', 'Old data cleaned up');
        } catch {}
    }
    
    // ============================================
    // SESSION VALIDATION
    // ============================================
    
    validateSession(session) {
        if (!session) {
            return { valid: false, reason: 'no_session', canRefresh: false };
        }
        
        const now = Date.now();
        
        // Check structure
        const structureCheck = this.validateSessionStructure(session);
        if (!structureCheck.valid) {
            return { valid: false, reason: 'invalid_structure', canRefresh: false };
        }
        
        // Check absolute timeout
        if (session.absoluteExpiresAt && now > session.absoluteExpiresAt) {
            return { valid: false, reason: 'absolute_timeout', canRefresh: false };
        }
        
        // Check session timeout
        if (session.expiresAt && now > session.expiresAt) {
            return { valid: false, reason: 'session_expired', canRefresh: true };
        }
        
        // Check idle timeout
        const idleTime = now - (session.lastActivity || session.createdAt);
        if (idleTime > this.config.idleTimeout) {
            return { valid: false, reason: 'idle_timeout', canRefresh: false };
        }
        
        // Session is about to expire
        const timeToExpire = session.expiresAt - now;
        const needsRefresh = timeToExpire < this.config.refreshThreshold;
        
        return { 
            valid: true, 
            canRefresh: false,
            needsRefresh,
            timeToExpire,
            idleTime
        };
    }
    
    validateSessionStructure(session) {
        const errors = [];
        
        if (!session.id) errors.push('Missing session ID');
        if (!session.token) errors.push('Missing access token');
        if (!session.user) errors.push('Missing user data');
        if (!session.user?.id) errors.push('Missing user ID');
        if (!session.createdAt) errors.push('Missing creation time');
        if (!session.expiresAt) errors.push('Missing expiration time');
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    isSessionActive() {
        if (!this.currentSession) return false;
        return this.validateSession(this.currentSession).valid;
    }
    
    getRemainingTime() {
        if (!this.currentSession) return 0;
        return Math.max(0, this.currentSession.expiresAt - Date.now());
    }
    
    // ============================================
    // TOKEN REFRESH (Google Apps Script Compatible)
    // ============================================
    
    async refreshSession(existingSession = null) {
        const session = existingSession || this.currentSession;
        
        if (!session?.refreshToken) {
            this.log('warn', 'No refresh token available');
            return null;
        }
        
        if (this.refreshing) {
            this.log('debug', 'Refresh already in progress');
            return this.currentSession;
        }
        
        this.refreshing = true;
        
        try {
            let response;
            
            // Try GAS API endpoint
            if (this.apiService) {
                response = await this.apiService.post('refreshToken', {
                    refreshToken: session.refreshToken,
                    sessionId: session.id
                });
            } else {
                // Fallback: Direct fetch to GAS
                response = await this.refreshViaGAS(session.refreshToken);
            }
            
            if (!response?.data?.token && !response?.token) {
                throw new Error('Invalid refresh response');
            }
            
            // Update token
            const newToken = response.data?.token || response.token;
            session.token = newToken;
            session.expiresAt = Date.now() + this.config.sessionTimeout;
            session.lastActivity = Date.now();
            
            // Update refresh token if provided
            if (response.data?.refreshToken || response.refreshToken) {
                session.refreshToken = response.data?.refreshToken || response.refreshToken;
            }
            
            // Update user data if provided
            if (response.data?.user || response.user) {
                const updatedUser = response.data?.user || response.user;
                session.user = { ...session.user, ...updatedUser };
            }
            
            // Update absolute timeout
            session.absoluteExpiresAt = Date.now() + this.config.absoluteTimeout;
            
            // Save updated session
            await this.storeSession(session);
            
            // Update current
            this.currentSession = session;
            
            // Re-schedule refresh
            this.scheduleTokenRefresh();
            
            this.log('info', 'Session refreshed successfully', {
                userId: session.user.id,
                newExpiry: new Date(session.expiresAt).toISOString()
            });
            
            this.emit('refreshed', { 
                session: this.sanitizeSession(session)
            });
            
            return session;
            
        } catch (error) {
            this.log('error', 'Session refresh failed', {
                error: error.message,
                sessionId: session.id
            });
            
            // If refresh fails multiple times, clear session
            session.refreshFailures = (session.refreshFailures || 0) + 1;
            
            if (session.refreshFailures >= 3) {
                this.log('warn', 'Multiple refresh failures, clearing session');
                await this.clearSession();
                this.handleSessionExpired('refresh_failed');
                return null;
            }
            
            return session;
        } finally {
            this.refreshing = false;
        }
    }
    
    async refreshViaGAS(refreshToken) {
        const gasUrl = APP_CONFIG?.api?.gasUrl || 
                       'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
        
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'refreshToken',
                refreshToken: refreshToken,
                timestamp: Date.now()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Refresh failed: HTTP ${response.status}`);
        }
        
        return response.json();
    }
    
    scheduleTokenRefresh() {
        if (this.timers.refresh) {
            clearTimeout(this.timers.refresh);
        }
        
        if (!this.currentSession) return;
        
        const now = Date.now();
        const expiresAt = this.currentSession.expiresAt;
        const refreshThreshold = this.config.refreshThreshold;
        
        // Schedule refresh sebelum expired
        const refreshAt = Math.max(0, expiresAt - now - refreshThreshold);
        
        if (refreshAt > 0) {
            this.timers.refresh = setTimeout(async () => {
                this.log('debug', 'Scheduled token refresh');
                await this.refreshSession();
            }, refreshAt);
        }
    }
    
    // ============================================
    // SESSION MONITORING
    // ============================================
    
    startSessionMonitoring() {
        if (this.timers.monitor) {
            clearInterval(this.timers.monitor);
        }
        
        this.timers.monitor = setInterval(async () => {
            if (!this.currentSession) return;
            
            const validation = this.validateSession(this.currentSession);
            
            if (!validation.valid) {
                if (validation.canRefresh) {
                    this.log('info', 'Session near expiry, refreshing');
                    const refreshed = await this.refreshSession();
                    
                    if (!refreshed) {
                        this.handleSessionExpired(validation.reason);
                    }
                } else {
                    this.handleSessionExpired(validation.reason);
                }
            }
            
            // Save session periodically
            if (Date.now() - this.lastSave > 300000) { // 5 minutes
                await this.storeSession(this.currentSession);
            }
            
        }, 30000); // Check every 30 seconds
    }
    
    setupActivityTracking() {
        const activityEvents = [
            'mousedown', 'mousemove', 'keydown', 
            'scroll', 'touchstart', 'click', 'focus'
        ];
        
        this.handlers.activity = this.debounce(async () => {
            await this.updateActivity();
        }, 1000);
        
        activityEvents.forEach(event => {
            document.addEventListener(event, this.handlers.activity, { 
                passive: true 
            });
        });
        
        // Visibility change
        this.handlers.visibility = async () => {
            if (!document.hidden) {
                await this.updateActivity();
                
                // Re-validate session when returning
                if (this.currentSession) {
                    const validation = this.validateSession(this.currentSession);
                    if (!validation.valid) {
                        await this.checkSession();
                    }
                }
            }
        };
        document.addEventListener('visibilitychange', this.handlers.visibility);
        
        // Online/Offline
        this.handlers.online = async () => {
            this.log('info', 'App is online, refreshing session');
            await this.checkSession();
        };
        window.addEventListener('online', this.handlers.online);
    }
    
    setupIdleDetection() {
        if (this.timers.idle) {
            clearInterval(this.timers.idle);
        }
        
        this.timers.idle = setInterval(() => {
            if (!this.currentSession) return;
            
            const idleTime = Date.now() - this.lastActivity;
            
            // Warning 5 minutes before idle timeout
            if (idleTime > this.config.idleTimeout - 300000) {
                this.emit('idle:warning', {
                    remainingTime: this.config.idleTimeout - idleTime
                });
            }
            
            // Logout on idle timeout
            if (idleTime > this.config.idleTimeout) {
                this.log('info', 'Idle timeout reached');
                this.handleSessionExpired('idle_timeout');
            }
        }, 60000);
    }
    
    async updateActivity() {
        if (!this.currentSession) return;
        
        const now = Date.now();
        this.lastActivity = now;
        
        if (this.currentSession) {
            this.currentSession.lastActivity = now;
            
            // Extend session on activity
            if (this.config.extendOnActivity) {
                this.currentSession.expiresAt = now + this.config.sessionTimeout;
            }
        }
        
        // Persist activity timestamp
        try {
            localStorage.setItem(this.KEYS.ACTIVITY, now.toString());
        } catch {}
        
        // Save session less frequently
        if (now - this.lastSave > 300000) { // 5 minutes
            await this.storeSession(this.currentSession);
        }
    }
    
    async checkSession() {
        if (!this.currentSession) return false;
        
        const validation = this.validateSession(this.currentSession);
        
        if (!validation.valid) {
            if (validation.canRefresh) {
                const refreshed = await this.refreshSession();
                if (!refreshed) {
                    this.handleSessionExpired(validation.reason);
                }
                return !!refreshed;
            } else {
                this.handleSessionExpired(validation.reason);
                return false;
            }
        }
        
        return true;
    }
    
    handleSessionExpired(reason = 'timeout') {
        this.log('warn', 'Session expired', { reason });
        
        // Emit event before clearing
        this.emit('expired', {
            reason,
            timestamp: Date.now(),
            sessionId: this.currentSession?.id
        });
        
        // Dispatch DOM event for other components
        window.dispatchEvent(new CustomEvent('session:expired', {
            detail: { reason, timestamp: Date.now() }
        }));
        
        // Clear session
        this.clearSession();
        
        // Redirect to login after delay
        setTimeout(() => {
            const loginPath = '/login.html';
            const params = new URLSearchParams();
            params.set('reason', reason);
            params.set('ts', Date.now().toString());
            
            window.location.replace(`${loginPath}?${params.toString()}`);
        }, 1500);
    }
    
    // ============================================
    // CONCURRENT SESSION MANAGEMENT
    // ============================================
    
    async getActiveSessionCount() {
        // Count sessions stored in IndexedDB
        if (!('indexedDB' in window)) return 1;
        
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('EArsipSessions', 1);
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction('sessions', 'readonly');
                    const store = transaction.objectStore('sessions');
                    const countRequest = store.count();
                    
                    countRequest.onsuccess = () => resolve(countRequest.result);
                    countRequest.onerror = () => resolve(1);
                };
                
                request.onerror = () => resolve(1);
            } catch {
                resolve(1);
            }
        });
    }
    
    async terminateOldestSession() {
        this.log('info', 'Terminating oldest session');
        
        if (!('indexedDB' in window)) return;
        
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('EArsipSessions', 1);
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction('sessions', 'readwrite');
                    const store = transaction.objectStore('sessions');
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = () => {
                        const sessions = getAllRequest.result;
                        
                        // Sort by timestamp and remove oldest non-current
                        sessions.sort((a, b) => a.timestamp - b.timestamp);
                        
                        if (sessions.length > 0) {
                            const oldest = sessions[0];
                            if (oldest.key !== 'current_session') {
                                store.delete(oldest.key);
                            }
                        }
                        
                        resolve();
                    };
                };
                
                request.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }
    
    // ============================================
    // SECURITY
    // ============================================
    
    generateFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 0,
            navigator.deviceMemory || 0
        ];
        
        return this.simpleHash(components.join('###'));
    }
    
    storeFingerprint(fingerprint) {
        try {
            localStorage.setItem(this.KEYS.FINGERPRINT, fingerprint);
        } catch {}
    }
    
    getStoredFingerprint() {
        try {
            return localStorage.getItem(this.KEYS.FINGERPRINT);
        } catch {
            return null;
        }
    }
    
    isFingerprintSignificantlyDifferent(fp1, fp2) {
        if (!fp1 || !fp2) return true;
        return fp1 !== fp2;
    }
    
    getDeviceInfo() {
        return {
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${screen.width}x${screen.height}`,
            devicePixelRatio: window.devicePixelRatio,
            cores: navigator.hardwareConcurrency || 0,
            memory: navigator.deviceMemory || 0,
            connectionType: this.getConnectionType()
        };
    }
    
    getConnectionType() {
        if ('connection' in navigator) {
            return navigator.connection.effectiveType || 'unknown';
        }
        return 'unknown';
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateSessionId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    
    sanitizeSession(session) {
        if (!session) return null;
        
        return {
            id: session.id,
            user: {
                id: session.user?.id,
                username: session.user?.username,
                role: session.user?.role
            },
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isPWA: session.isPWA
        };
    }
    
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    clearTimers() {
        Object.values(this.timers).forEach(timer => {
            if (timer) {
                clearInterval(timer);
                clearTimeout(timer);
            }
        });
        
        this.timers = { monitor: null, refresh: null, idle: null };
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        
        return () => this.listeners.get(event)?.delete(callback);
    }
    
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log('error', `Event listener error: ${event}`, {
                        error: error.message
                    });
                }
            });
        }
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getCurrentSession() {
        return this.currentSession ? this.sanitizeSession(this.currentSession) : null;
    }
    
    getCurrentUser() {
        return this.currentSession?.user || null;
    }
    
    isAuthenticated() {
        return this.isSessionActive();
    }
    
    hasRole(roles) {
        if (!this.currentSession?.user) return false;
        const userRole = this.currentSession.user.role;
        return Array.isArray(roles) ? roles.includes(userRole) : roles === userRole;
    }
    
    hasPermission(permissions) {
        if (!this.currentSession?.user?.permissions) return false;
        const userPermissions = this.currentSession.user.permissions;
        return Array.isArray(permissions) 
            ? permissions.every(p => userPermissions.includes(p))
            : userPermissions.includes(permissions);
    }
    
    async logout() {
        const sessionId = this.currentSession?.id;
        
        // Notify server
        if (this.apiService && sessionId) {
            try {
                await this.apiService.post('logout', { sessionId });
            } catch {}
        }
        
        this.emit('logout', { sessionId });
        await this.clearSession();
    }
    
    destroy() {
        // Clear timers
        this.clearTimers();
        
        // Remove event listeners
        if (this.handlers.activity) {
            ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus']
                .forEach(event => {
                    document.removeEventListener(event, this.handlers.activity);
                });
        }
        
        if (this.handlers.visibility) {
            document.removeEventListener('visibilitychange', this.handlers.visibility);
        }
        
        if (this.handlers.online) {
            window.removeEventListener('online', this.handlers.online);
        }
        
        // Clear listeners
        this.listeners.clear();
        
        // Clear session
        this.clearSession();
        this.initialized = false;
        
        this.log('info', 'Session Manager destroyed');
    }
}

// Create singleton
const sessionManager = new SessionManager();

// Make available globally
if (typeof window !== 'undefined') {
    window.sessionManager = sessionManager;
}

export default sessionManager;
export { SessionManager };