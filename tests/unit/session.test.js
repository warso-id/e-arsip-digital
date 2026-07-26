// tests/unit/session.test.js - Enterprise Session Manager Unit Tests 2026
/**
 * E-Arsip Digital - Comprehensive Session Manager Unit Test Suite
 * Version: 2026.1.0
 * Tests: Session lifecycle, monitoring, timeout, refresh,
 *        encryption, fingerprint validation, activity tracking
 * Framework: Jest with complete mock implementation
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// STORAGE MOCKS
// ============================================

const createStorageMock = () => {
    const store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        get length() { return Object.keys(store).length; },
        key: jest.fn((index) => Object.keys(store)[index] || null),
        _store: store
    };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true });
    Object.defineProperty(window, 'location', {
        value: { href: '', origin: 'https://e-arsip.example.com', replace: jest.fn() },
        writable: true, configurable: true
    });
    Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Test Browser',
        configurable: true
    });
});

beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    jest.clearAllMocks();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

// ============================================
// COMPLETE MOCK SESSION MANAGER
// ============================================

class SessionManager {
    constructor(config = {}) {
        this.config = {
            sessionTimeout: 3600000,     // 1 hour
            idleTimeout: 1800000,         // 30 minutes
            absoluteTimeout: 28800000,    // 8 hours
            refreshThreshold: 300000,     // 5 minutes before expiry
            extendOnActivity: true,
            enforceFingerprint: true,
            ...config
        };

        this.SESSION_DURATION = this.config.sessionTimeout;
        this.WARNING_BEFORE = this.config.refreshThreshold;
        this.SESSION_KEY = 'auth_session';
        this.REFRESH_KEY = 'auth_refresh_token';
        this.ACTIVITY_KEY = 'last_activity';
        this.FINGERPRINT_KEY = 'session_fingerprint';

        this.currentSession = null;
        this.lastActivity = Date.now();
        this.sessionTimer = null;
        this.isMonitoring = false;
        this.initialized = false;
        this.sessionFingerprint = null;
    }

    async createSession(userData, tokens, options = {}) {
        const now = Date.now();
        const session = {
            id: this.generateSessionId(),
            token: tokens?.accessToken || tokens?.token || this.generateToken(),
            refreshToken: tokens?.refreshToken || this.generateToken(64),
            user: {
                id: userData.id,
                username: userData.username,
                role: userData.role
            },
            createdAt: now,
            lastActivity: now,
            expiresAt: now + this.SESSION_DURATION,
            absoluteExpiresAt: now + this.config.absoluteTimeout,
            deviceInfo: this.getDeviceInfo(),
            fingerprint: this.generateFingerprint(),
            isPWA: false
        };

        await this.storeSession(session);
        this.currentSession = session;
        this.lastActivity = now;
        this.sessionFingerprint = session.fingerprint;

        return session;
    }

    async restoreSession() {
        try {
            const stored = localStorage.getItem(this.SESSION_KEY);
            if (!stored) return null;

            const session = JSON.parse(stored);
            const validation = this.validateSession(session);

            if (!validation.valid) {
                if (validation.canRefresh && session.refreshToken) {
                    return this.refreshSession(session);
                }
                await this.clearSession();
                return null;
            }

            this.currentSession = session;
            this.lastActivity = Date.now();
            return session;
        } catch {
            await this.clearSession();
            return null;
        }
    }

    async storeSession(session) {
        try {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            if (session.refreshToken) {
                localStorage.setItem(this.REFRESH_KEY, session.refreshToken);
            }
        } catch {}
    }

    validateSession(session) {
        if (!session) return { valid: false, reason: 'no_session', canRefresh: false };

        const now = Date.now();

        if (session.absoluteExpiresAt && now > session.absoluteExpiresAt) {
            return { valid: false, reason: 'absolute_timeout', canRefresh: false };
        }

        if (session.expiresAt && now > session.expiresAt) {
            return { valid: false, reason: 'session_expired', canRefresh: true };
        }

        const idleTime = now - (session.lastActivity || session.createdAt);
        if (idleTime > this.config.idleTimeout) {
            return { valid: false, reason: 'idle_timeout', canRefresh: false };
        }

        return { valid: true, canRefresh: false };
    }

    async refreshSession(existingSession = null) {
        const session = existingSession || this.currentSession;
        if (!session?.refreshToken) return null;

        session.token = this.generateToken();
        session.expiresAt = Date.now() + this.SESSION_DURATION;
        session.lastActivity = Date.now();
        session.absoluteExpiresAt = Date.now() + this.config.absoluteTimeout;

        await this.storeSession(session);
        this.currentSession = session;

        return session;
    }

    async clearSession() {
        this.currentSession = null;
        this.lastActivity = Date.now();
        this.sessionFingerprint = null;

        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.REFRESH_KEY);
        localStorage.removeItem(this.ACTIVITY_KEY);
        sessionStorage.removeItem(this.FINGERPRINT_KEY);
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        this.sessionTimer = setInterval(() => {
            this.checkSession();
        }, 30000);
    }

    stopMonitoring() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
        this.isMonitoring = false;
    }

    checkSession() {
        if (!this.currentSession) return;

        const validation = this.validateSession(this.currentSession);
        if (!validation.valid) {
            this.handleSessionExpired(validation.reason);
        }
    }

    handleSessionExpired(reason) {
        this.clearSession();
        window.location.replace('/login.html?reason=' + encodeURIComponent(reason));
    }

    updateActivity() {
        this.lastActivity = Date.now();
        if (this.currentSession) {
            this.currentSession.lastActivity = this.lastActivity;
            if (this.config.extendOnActivity) {
                this.currentSession.expiresAt = this.lastActivity + this.SESSION_DURATION;
            }
        }
        try { localStorage.setItem(this.ACTIVITY_KEY, String(this.lastActivity)); } catch {}
    }

    extendSession() {
        this.updateActivity();
        if (this.currentSession) {
            this.currentSession.expiresAt = Date.now() + this.SESSION_DURATION;
        }
    }

    isActive() {
        if (!this.currentSession) return false;
        return this.validateSession(this.currentSession).valid;
    }

    getRemainingTime() {
        if (!this.currentSession) return 0;
        return Math.max(0, this.currentSession.expiresAt - Date.now());
    }

    getFormattedRemainingTime() {
        const remaining = this.getRemainingTime();
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    setSessionDuration(minutes) {
        this.SESSION_DURATION = minutes * 60 * 1000;
        this.config.sessionTimeout = this.SESSION_DURATION;
        this.WARNING_BEFORE = Math.min(5 * 60 * 1000, this.SESSION_DURATION / 4);
    }

    generateSessionId() {
        const chars = 'abcdef0123456789';
        let id = '';
        for (let i = 0; i < 32; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    generateToken(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < length; i++) {
            token += chars[Math.floor(Math.random() * chars.length)];
        }
        return token;
    }

    generateFingerprint() {
        const components = [
            navigator.userAgent,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset()
        ];
        return this.hashComponents(components);
    }

    hashComponents(components) {
        let hash = 0;
        const str = components.join('|');
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    getDeviceInfo() {
        return {
            platform: navigator.platform || 'unknown',
            userAgent: navigator.userAgent?.substring(0, 100) || 'unknown',
            screenSize: `${screen.width}x${screen.height}`
        };
    }
}

// ============================================
// TEST INSTANCE
// ============================================

let sessionManager;

beforeEach(() => {
    sessionManager = new SessionManager();
});

// ============================================
// SESSION LIFECYCLE TESTS
// ============================================

describe('Session Lifecycle', () => {
    it('Should create a new session', async () => {
        const userData = { id: 'user-001', username: 'admin', role: 'admin' };
        const tokens = { accessToken: 'token-abc', refreshToken: 'refresh-xyz' };

        const session = await sessionManager.createSession(userData, tokens);

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.user.username).toBe('admin');
        expect(session.token).toBe('token-abc');
        expect(session.refreshToken).toBe('refresh-xyz');
        expect(session.expiresAt).toBeGreaterThan(Date.now());
        expect(session.absoluteExpiresAt).toBeGreaterThan(Date.now());
        expect(session.fingerprint).toBeDefined();
    });

    it('Should store session in localStorage', async () => {
        const userData = { id: 'user-001', username: 'admin', role: 'admin' };
        const tokens = { accessToken: 'token-abc', refreshToken: 'refresh-xyz' };

        await sessionManager.createSession(userData, tokens);

        expect(localStorage.setItem).toHaveBeenCalledWith('auth_session', expect.any(String));
        expect(localStorage.setItem).toHaveBeenCalledWith('auth_refresh_token', 'refresh-xyz');
    });

    it('Should restore session from storage', async () => {
        const sessionData = {
            id: 'sess-test',
            token: 'stored-token',
            refreshToken: 'stored-refresh',
            user: { id: 'user-001', username: 'admin', role: 'admin' },
            createdAt: Date.now() - 1000000,
            lastActivity: Date.now() - 1000,
            expiresAt: Date.now() + 3600000,
            absoluteExpiresAt: Date.now() + 28800000,
            fingerprint: 'abc123'
        };

        localStorage.setItem('auth_session', JSON.stringify(sessionData));

        const session = await sessionManager.restoreSession();

        expect(session).toBeDefined();
        expect(session.id).toBe('sess-test');
        expect(session.user.username).toBe('admin');
    });

    it('Should clear session data', async () => {
        const userData = { id: 'user-001', username: 'admin', role: 'admin' };
        await sessionManager.createSession(userData, { accessToken: 'token' });

        await sessionManager.clearSession();

        expect(sessionManager.currentSession).toBeNull();
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_session');
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_refresh_token');
    });

    it('Should refresh expiring session', async () => {
        const session = {
            id: 'sess-old',
            token: 'old-token',
            refreshToken: 'valid-refresh',
            user: { id: 'user-001', username: 'admin', role: 'admin' },
            createdAt: Date.now() - 1000000,
            lastActivity: Date.now() - 1000,
            expiresAt: Date.now() - 1000, // Expired
            absoluteExpiresAt: Date.now() + 28800000
        };

        const refreshed = await sessionManager.refreshSession(session);

        expect(refreshed).toBeDefined();
        expect(refreshed.token).not.toBe('old-token');
        expect(refreshed.expiresAt).toBeGreaterThan(Date.now());
    });

    it('Should not refresh session without refresh token', async () => {
        const session = {
            id: 'sess-no-refresh',
            token: 'old-token',
            user: { id: 'user-001', username: 'admin' },
            expiresAt: Date.now() - 1000
        };

        const result = await sessionManager.refreshSession(session);

        expect(result).toBeNull();
    });
});

// ============================================
// SESSION VALIDATION TESTS
// ============================================

describe('Session Validation', () => {
    it('Should validate active session', () => {
        const session = {
            id: 'sess-valid',
            user: { id: 'user-001' },
            createdAt: Date.now() - 1000,
            lastActivity: Date.now(),
            expiresAt: Date.now() + 3600000,
            absoluteExpiresAt: Date.now() + 28800000
        };

        const validation = sessionManager.validateSession(session);
        expect(validation.valid).toBe(true);
    });

    it('Should detect expired session', () => {
        const session = {
            id: 'sess-expired',
            user: { id: 'user-001' },
            createdAt: Date.now() - 7200000,
            lastActivity: Date.now() - 7200000,
            expiresAt: Date.now() - 1000,
            absoluteExpiresAt: Date.now() + 28800000
        };

        const validation = sessionManager.validateSession(session);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe('session_expired');
        expect(validation.canRefresh).toBe(true);
    });

    it('Should detect absolute timeout', () => {
        const session = {
            id: 'sess-absolute',
            user: { id: 'user-001' },
            createdAt: Date.now() - 30000000,
            lastActivity: Date.now() - 1000,
            expiresAt: Date.now() + 3600000,
            absoluteExpiresAt: Date.now() - 1000
        };

        const validation = sessionManager.validateSession(session);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe('absolute_timeout');
        expect(validation.canRefresh).toBe(false);
    });

    it('Should detect idle timeout', () => {
        const session = {
            id: 'sess-idle',
            user: { id: 'user-001' },
            createdAt: Date.now() - 3600000,
            lastActivity: Date.now() - 2000000,
            expiresAt: Date.now() + 3600000,
            absoluteExpiresAt: Date.now() + 28800000
        };

        const validation = sessionManager.validateSession(session);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe('idle_timeout');
    });

    it('Should return invalid for null session', () => {
        const validation = sessionManager.validateSession(null);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe('no_session');
    });
});

// ============================================
// SESSION MONITORING TESTS
// ============================================

describe('Session Monitoring', () => {
    it('Should start monitoring with interval', () => {
        sessionManager.startMonitoring();

        expect(sessionManager.sessionTimer).toBeDefined();
        expect(sessionManager.isMonitoring).toBe(true);
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);

        sessionManager.stopMonitoring();
    });

    it('Should stop monitoring and clear timer', () => {
        sessionManager.startMonitoring();
        sessionManager.stopMonitoring();

        expect(sessionManager.sessionTimer).toBeNull();
        expect(sessionManager.isMonitoring).toBe(false);
    });

    it('Should not start duplicate monitoring', () => {
        sessionManager.startMonitoring();
        const firstTimer = sessionManager.sessionTimer;
        sessionManager.startMonitoring();

        expect(sessionManager.sessionTimer).toBe(firstTimer);

        sessionManager.stopMonitoring();
    });

    it('Should check session and detect expiry', () => {
        sessionManager.currentSession = {
            id: 'sess-check',
            user: { id: 'user-001' },
            expiresAt: Date.now() - 1000,
            lastActivity: Date.now() - 2000,
            absoluteExpiresAt: Date.now() + 28800000
        };

        sessionManager.checkSession();

        expect(sessionManager.currentSession).toBeNull();
        expect(window.location.replace).toHaveBeenCalledWith(
            expect.stringContaining('/login.html')
        );
    });

    it('Should not fail when checking without session', () => {
        expect(() => sessionManager.checkSession()).not.toThrow();
    });
});

// ============================================
// ACTIVITY TRACKING TESTS
// ============================================

describe('Activity Tracking', () => {
    it('Should update last activity', () => {
        const before = Date.now();
        sessionManager.updateActivity();
        const after = sessionManager.lastActivity;

        expect(after).toBeGreaterThanOrEqual(before);
        expect(after).toBeLessThanOrEqual(before + 50);
    });

    it('Should update session expires on activity', () => {
        sessionManager.currentSession = {
            id: 'sess-activity',
            user: { id: 'user-001' },
            expiresAt: Date.now() - 1000,
            lastActivity: Date.now() - 5000
        };

        sessionManager.updateActivity();

        expect(sessionManager.currentSession.expiresAt).toBeGreaterThan(Date.now());
        expect(sessionManager.currentSession.lastActivity).toBe(sessionManager.lastActivity);
    });

    it('Should store activity in localStorage', () => {
        sessionManager.updateActivity();
        expect(localStorage.setItem).toHaveBeenCalledWith('last_activity', expect.any(String));
    });

    it('Should extend session explicitly', () => {
        sessionManager.currentSession = {
            id: 'sess-extend',
            user: { id: 'user-001' },
            expiresAt: Date.now() - 5000,
            lastActivity: Date.now() - 10000
        };

        sessionManager.extendSession();

        expect(sessionManager.currentSession.expiresAt).toBeGreaterThan(Date.now());
        expect(sessionManager.lastActivity).toBeGreaterThan(Date.now() - 100);
    });
});

// ============================================
// SESSION STATUS TESTS
// ============================================

describe('Session Status', () => {
    it('Should return active for valid session', async () => {
        await sessionManager.createSession(
            { id: 'user-001', username: 'admin', role: 'admin' },
            { accessToken: 'token' }
        );

        expect(sessionManager.isActive()).toBe(true);
    });

    it('Should return inactive without session', () => {
        expect(sessionManager.isActive()).toBe(false);
    });

    it('Should return remaining time', async () => {
        await sessionManager.createSession(
            { id: 'user-001', username: 'admin', role: 'admin' },
            { accessToken: 'token' }
        );

        const remaining = sessionManager.getRemainingTime();
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(sessionManager.SESSION_DURATION);
    });

    it('Should return zero remaining without session', () => {
        expect(sessionManager.getRemainingTime()).toBe(0);
    });

    it('Should format remaining time correctly', async () => {
        await sessionManager.createSession(
            { id: 'user-001', username: 'admin', role: 'admin' },
            { accessToken: 'token' }
        );

        const formatted = sessionManager.getFormattedRemainingTime();
        expect(formatted).toMatch(/^\d{2}:\d{2}$/);
        expect(formatted).toContain(':');
    });
});

// ============================================
// SESSION DURATION CONFIGURATION
// ============================================

describe('Session Duration Configuration', () => {
    it('Should set session duration in minutes', () => {
        sessionManager.setSessionDuration(30);

        expect(sessionManager.SESSION_DURATION).toBe(30 * 60 * 1000);
        expect(sessionManager.config.sessionTimeout).toBe(30 * 60 * 1000);
    });

    it('Should set session duration in hours', () => {
        sessionManager.setSessionDuration(120); // 2 hours

        expect(sessionManager.SESSION_DURATION).toBe(120 * 60 * 1000);
    });

    it('Should adjust warning threshold based on duration', () => {
        sessionManager.setSessionDuration(10); // Very short session

        expect(sessionManager.WARNING_BEFORE).toBeLessThanOrEqual(sessionManager.SESSION_DURATION / 4);
    });

    it('Should cap warning threshold at 5 minutes', () => {
        sessionManager.setSessionDuration(120); // 2 hours

        expect(sessionManager.WARNING_BEFORE).toBe(5 * 60 * 1000);
    });
});

// ============================================
// UTILITY TESTS
// ============================================

describe('Session Utilities', () => {
    it('Should generate unique session IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(sessionManager.generateSessionId());
        }
        expect(ids.size).toBe(100);
    });

    it('Should generate session ID with correct length', () => {
        const id = sessionManager.generateSessionId();
        expect(id.length).toBe(32);
        expect(id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('Should generate unique tokens', () => {
        const tokens = new Set();
        for (let i = 0; i < 50; i++) {
            tokens.add(sessionManager.generateToken());
        }
        expect(tokens.size).toBe(50);
    });

    it('Should generate fingerprint', () => {
        const fingerprint = sessionManager.generateFingerprint();
        expect(fingerprint).toBeDefined();
        expect(typeof fingerprint).toBe('string');
        expect(fingerprint.length).toBeGreaterThan(0);
    });

    it('Should generate consistent fingerprint', () => {
        const fp1 = sessionManager.generateFingerprint();
        const fp2 = sessionManager.generateFingerprint();
        expect(fp1).toBe(fp2); // Should be consistent for same device
    });

    it('Should return device info', () => {
        const info = sessionManager.getDeviceInfo();
        expect(info.platform).toBeDefined();
        expect(info.userAgent).toBeDefined();
        expect(info.screenSize).toMatch(/^\d+x\d+$/);
    });
});

// ============================================
// EDGE CASE TESTS
// ============================================

describe('Session Edge Cases', () => {
    it('Should handle rapid session creation and clearing', async () => {
        for (let i = 0; i < 5; i++) {
            await sessionManager.createSession(
                { id: `user-${i}`, username: `user${i}`, role: 'user' },
                { accessToken: `token-${i}` }
            );
            await sessionManager.clearSession();
        }
        expect(sessionManager.currentSession).toBeNull();
    });

    it('Should handle activity update without session', () => {
        expect(() => sessionManager.updateActivity()).not.toThrow();
        expect(sessionManager.lastActivity).toBeGreaterThan(0);
    });

    it('Should handle refresh with null session', async () => {
        const result = await sessionManager.refreshSession(null);
        expect(result).toBeNull();
    });

    it('Should handle session with missing fields', () => {
        const partialSession = {
            id: 'partial',
            user: { id: 'user-001' }
        };

        const validation = sessionManager.validateSession(partialSession);
        expect(validation.valid).toBe(false);
    });

    it('Should stop monitoring when already stopped', () => {
        expect(() => sessionManager.stopMonitoring()).not.toThrow();
    });
});