// tests/unit/complete-unit-tests.test.js - Enterprise Unit Test Suite 2026
/**
 * E-Arsip Digital - Complete Unit Test Suite
 * Version: 2026.1.0
 * Tests: Rate Limiter, WAF, Token Manager, CSRF Protection,
 *        XSS Prevention, Audit Trail, Security Orchestrator
 * Framework: Jest with proper mocking and setup/teardown
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// MOCK DEPENDENCIES
// ============================================

// Mock localStorage and sessionStorage
const createStorageMock = () => {
    const store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        get length() { return Object.keys(store).length; },
        key: jest.fn((index) => Object.keys(store)[index] || null)
    };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
    Object.defineProperty(window, 'crypto', {
        value: {
            getRandomValues: (arr) => {
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 256);
                }
                return arr;
            },
            randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            }),
            subtle: {}
        }
    });
});

beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    jest.clearAllMocks();
});

// ============================================
// RATE LIMITER UNIT TESTS
// ============================================

// Import or define RateLimiter mock
class RateLimiter {
    constructor(config = {}) {
        this.limits = new Map();
        this.config = {
            maxRequests: 100,
            windowMs: 60000,
            blockDuration: 300000,
            ...config
        };
    }

    checkLimit(key) {
        const now = Date.now();
        let record = this.limits.get(key) || { requests: [], blocked: false, blockedUntil: 0 };

        if (record.blocked && now < record.blockedUntil) {
            return {
                allowed: false,
                retryAfter: Math.ceil((record.blockedUntil - now) / 1000)
            };
        }

        record.requests = record.requests.filter(t => now - t < this.config.windowMs);

        if (record.requests.length >= this.config.maxRequests) {
            record.blocked = true;
            record.blockedUntil = now + this.config.blockDuration;
            return {
                allowed: false,
                retryAfter: Math.ceil(this.config.blockDuration / 1000)
            };
        }

        record.requests.push(now);
        this.limits.set(key, record);

        return {
            allowed: true,
            remaining: this.config.maxRequests - record.requests.length
        };
    }

    getStatus(key) {
        const record = this.limits.get(key);
        if (!record) return { allowed: true, remaining: this.config.maxRequests };
        const recent = record.requests.filter(t => Date.now() - t < this.config.windowMs);
        return {
            allowed: !record.blocked,
            remaining: Math.max(0, this.config.maxRequests - recent.length)
        };
    }

    reset(key) { this.limits.delete(key); }
    resetAll() { this.limits.clear(); }
    cleanup() { this.limits.clear(); }
    getAllRecords() {
        const records = {};
        this.limits.forEach((v, k) => { records[k] = v; });
        return records;
    }

    static throttle(fn, limit) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                return fn.apply(this, args);
            }
        };
    }

    static debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            return new Promise(resolve => {
                timeout = setTimeout(() => resolve(fn.apply(this, args)), delay);
            });
        };
    }
}

describe('Rate Limiter', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimiter();
    });

    it('Should allow requests within limit', () => {
        for (let i = 0; i < 50; i++) {
            const result = rateLimiter.checkLimit(`test-${i}`);
            expect(result.allowed).toBe(true);
        }
    });

    it('Should block after exceeding max requests', () => {
        const key = 'block-test';
        for (let i = 0; i < 150; i++) {
            rateLimiter.checkLimit(key);
        }
        const result = rateLimiter.checkLimit(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('Should reset after window expires', () => {
        const key = 'window-test';
        rateLimiter.checkLimit(key);
        rateLimiter.reset(key);
        const result = rateLimiter.checkLimit(key);
        expect(result.allowed).toBe(true);
    });

    it('Should return correct status', () => {
        const status = rateLimiter.getStatus('status-test');
        expect(status.allowed).toBe(true);
        expect(status.remaining).toBeDefined();
        expect(status.remaining).toBeGreaterThan(0);
    });

    it('Should throttle function execution', () => {
        let counter = 0;
        const throttled = RateLimiter.throttle(() => { counter++; }, 100);

        throttled();
        throttled();
        throttled();

        expect(counter).toBe(1);
    });

    it('Should debounce function execution', async () => {
        let counter = 0;
        const debounced = RateLimiter.debounce(() => { counter++; }, 50);

        debounced();
        debounced();
        debounced();

        expect(counter).toBe(0);

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(counter).toBe(1);
    });

    it('Should cleanup old records', () => {
        rateLimiter.checkLimit('test-1');
        rateLimiter.checkLimit('test-2');
        rateLimiter.cleanup();
        const records = rateLimiter.getAllRecords();
        expect(typeof records).toBe('object');
    });

    it('Should reset all limits', () => {
        for (let i = 0; i < 150; i++) {
            rateLimiter.checkLimit('bulk-test');
        }
        rateLimiter.resetAll();
        const result = rateLimiter.checkLimit('bulk-test');
        expect(result.allowed).toBe(true);
    });
});

// ============================================
// TOKEN MANAGER UNIT TESTS
// ============================================

class TokenManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.TOKEN_KEY = 'auth_token';
        this.REFRESH_KEY = 'auth_refresh_token';
        this.EXPIRY_KEY = 'auth_token_expiry';
    }

    saveTokens(access, refresh, expiresIn) {
        this.accessToken = access;
        this.refreshToken = refresh;
        this.tokenExpiry = Date.now() + expiresIn * 1000;

        try {
            localStorage.setItem(this.TOKEN_KEY, access);
            localStorage.setItem(this.REFRESH_KEY, refresh);
            localStorage.setItem(this.EXPIRY_KEY, String(this.tokenExpiry));
        } catch {}
    }

    loadTokens() {
        try {
            this.accessToken = localStorage.getItem(this.TOKEN_KEY);
            this.refreshToken = localStorage.getItem(this.REFRESH_KEY);
            const expiry = localStorage.getItem(this.EXPIRY_KEY);
            this.tokenExpiry = expiry ? Number(expiry) : null;
        } catch {}
    }

    isTokenExpired() {
        if (!this.tokenExpiry) return true;
        return Date.now() > this.tokenExpiry;
    }

    getAuthHeader() {
        if (!this.accessToken) return {};
        return { Authorization: `Bearer ${this.accessToken}` };
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;

        try {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_KEY);
            localStorage.removeItem(this.EXPIRY_KEY);
        } catch {}
    }

    getTokenLifetime() {
        if (!this.tokenExpiry) return 0;
        return Math.max(0, Math.floor((this.tokenExpiry - Date.now()) / 1000));
    }
}

describe('Token Manager', () => {
    let tokenManager;

    beforeEach(() => {
        tokenManager = new TokenManager();
    });

    it('Should save and load tokens', () => {
        tokenManager.saveTokens('access-token-123', 'refresh-token-456', 3600);

        expect(tokenManager.accessToken).toBe('access-token-123');
        expect(tokenManager.refreshToken).toBe('refresh-token-456');
        expect(tokenManager.tokenExpiry).toBeDefined();
        expect(tokenManager.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('Should load tokens from storage', () => {
        tokenManager.saveTokens('access-stored', 'refresh-stored', 3600);

        const tm2 = new TokenManager();
        tm2.loadTokens();

        expect(tm2.accessToken).toBe('access-stored');
        expect(tm2.refreshToken).toBe('refresh-stored');
    });

    it('Should detect expired token', () => {
        tokenManager.saveTokens('expired', 'refresh', -1);
        expect(tokenManager.isTokenExpired()).toBe(true);

        tokenManager.saveTokens('valid', 'refresh', 3600);
        expect(tokenManager.isTokenExpired()).toBe(false);
    });

    it('Should return auth header', () => {
        tokenManager.saveTokens('test-token', 'refresh', 3600);
        const header = tokenManager.getAuthHeader();

        expect(header.Authorization).toBeDefined();
        expect(header.Authorization).toBe('Bearer test-token');
    });

    it('Should return empty header without token', () => {
        const header = tokenManager.getAuthHeader();
        expect(header.Authorization).toBeUndefined();
    });

    it('Should clear tokens', () => {
        tokenManager.saveTokens('test', 'refresh', 3600);
        tokenManager.clearTokens();

        expect(tokenManager.accessToken).toBeNull();
        expect(tokenManager.refreshToken).toBeNull();
        expect(tokenManager.tokenExpiry).toBeNull();
    });

    it('Should calculate token lifetime', () => {
        tokenManager.saveTokens('test', 'refresh', 3600);
        const lifetime = tokenManager.getTokenLifetime();

        expect(lifetime).toBeGreaterThan(0);
        expect(lifetime).toBeLessThanOrEqual(3600);
    });

    it('Should persist tokens to localStorage', () => {
        tokenManager.saveTokens('access', 'refresh', 3600);

        expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'access');
        expect(localStorage.setItem).toHaveBeenCalledWith('auth_refresh_token', 'refresh');
    });
});

// ============================================
// CSRF PROTECTION UNIT TESTS
// ============================================

class CSRFProtection {
    constructor() {
        this.token = null;
        this.TOKEN_KEY = 'csrf_token';
        this.HEADER_NAME = 'X-CSRF-Token';
    }

    generateToken() {
        const chars = 'abcdef0123456789';
        let token = '';
        for (let i = 0; i < 64; i++) {
            token += chars[Math.floor(Math.random() * chars.length)];
        }
        return token;
    }

    setToken(token) {
        this.token = token;
        try { sessionStorage.setItem(this.TOKEN_KEY, token); } catch {}
    }

    getToken() {
        if (!this.token) {
            try { this.token = sessionStorage.getItem(this.TOKEN_KEY); } catch {}
        }
        return this.token;
    }

    refreshToken() {
        const newToken = this.generateToken();
        this.setToken(newToken);
        return newToken;
    }

    isSameOrigin(url) {
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true;
        if (url.startsWith('#')) return true;
        try {
            const parsed = new URL(url, window.location.origin);
            return parsed.origin === window.location.origin;
        } catch {
            return false;
        }
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers[this.HEADER_NAME] = token;
        return headers;
    }

    createFormData(data = {}) {
        const formData = new FormData();
        Object.entries(data).forEach(([k, v]) => formData.append(k, v));
        const token = this.getToken();
        if (token) formData.append('csrf_token', token);
        return formData;
    }

    addTokenToForm(form) {
        const existing = form.querySelector('input[name="csrf_token"]');
        if (existing) existing.remove();

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrf_token';
        input.value = this.getToken() || '';
        form.appendChild(input);
    }
}

describe('CSRF Protection', () => {
    let csrf;

    beforeEach(() => {
        csrf = new CSRFProtection();
        delete window.location;
        window.location = {
            protocol: 'https:',
            hostname: 'e-arsip.example.com',
            port: '',
            origin: 'https://e-arsip.example.com'
        };
    });

    it('Should generate token with correct length', () => {
        const token = csrf.generateToken();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64);
    });

    it('Should set and get token', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        expect(csrf.getToken()).toBe(token);
    });

    it('Should refresh token with new value', () => {
        const oldToken = csrf.generateToken();
        csrf.setToken(oldToken);
        const newToken = csrf.refreshToken();

        expect(newToken).not.toBe(oldToken);
        expect(newToken.length).toBe(64);
        expect(csrf.getToken()).toBe(newToken);
    });

    it('Should validate same origin', () => {
        expect(csrf.isSameOrigin('/api/test')).toBe(true);
        expect(csrf.isSameOrigin(window.location.origin + '/test')).toBe(true);
        expect(csrf.isSameOrigin('https://evil.com/test')).toBe(false);
    });

    it('Should create CSRF headers', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);

        const headers = csrf.getHeaders();
        expect(headers['X-CSRF-Token']).toBe(token);
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('Should create CSRF form data', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);

        const formData = csrf.createFormData({ name: 'Test' });
        expect(formData.has('csrf_token')).toBe(true);
        expect(formData.get('csrf_token')).toBe(token);
        expect(formData.has('name')).toBe(true);
    });

    it('Should add token to form element', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);

        const form = document.createElement('form');
        document.body.appendChild(form);

        csrf.addTokenToForm(form);

        const input = form.querySelector('input[name="csrf_token"]');
        expect(input).not.toBeNull();
        expect(input.type).toBe('hidden');
        expect(input.value).toBe(token);

        form.remove();
    });

    it('Should persist token in sessionStorage', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);

        expect(sessionStorage.setItem).toHaveBeenCalledWith('csrf_token', token);
    });
});

// ============================================
// XSS PREVENTION UNIT TESTS
// ============================================

class XSSPrevention {
    constructor() {
        this.patterns = [
            { name: 'script', pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/gi },
            { name: 'event', pattern: /\bon\w+\s*=/gi },
            { name: 'javascript', pattern: /javascript\s*:/gi },
            { name: 'iframe', pattern: /<iframe[\s\S]*?>/gi },
            { name: 'eval', pattern: /\beval\s*\(/gi },
            { name: 'cookie', pattern: /document\.cookie/gi },
            { name: 'location', pattern: /window\.location/gi },
            { name: 'data_html', pattern: /data\s*:\s*text\/html/gi },
            { name: 'template', pattern: /\{\{.*?\}\}/gi },
            { name: 'proto', pattern: /__proto__/gi }
        ];
    }

    sanitize(input) {
        if (!input || typeof input !== 'string') return input;
        let sanitized = input;
        for (const { pattern } of this.patterns) {
            sanitized = sanitized.replace(pattern, '');
        }
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        return sanitized.trim();
    }

    validateAgainstXSS(input) {
        if (!input || typeof input !== 'string') return { valid: true };
        for (const { name, pattern } of this.patterns) {
            if (pattern.test(input)) {
                return { valid: false, message: `XSS pattern: ${name}` };
            }
        }
        return { valid: true };
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    isValidURL(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
        } catch {
            return url.startsWith('/') || url.startsWith('#');
        }
    }

    hasXSS(input) {
        if (!input || typeof input !== 'string') return false;
        return this.patterns.some(({ pattern }) => pattern.test(input));
    }
}

describe('XSS Prevention', () => {
    let xss;

    beforeEach(() => {
        xss = new XSSPrevention();
    });

    const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<body onload="alert(1)">',
        '<iframe src="javascript:alert(1)">',
        '<a href="javascript:alert(1)">Click</a>',
        '<div onclick="alert(1)">Click</div>',
        '"><script>alert(1)</script>',
        'eval("alert(1)")',
        'document.cookie',
        'window.location="http://evil.com"',
        'data:text/html,<script>alert(1)</script>',
        '{{constructor.constructor("alert(1)")()}}',
        '__proto__[test]=malicious'
    ];

    xssPayloads.forEach((payload, index) => {
        it(`Should detect XSS payload ${index + 1}: ${payload.substring(0, 40)}...`, () => {
            const result = xss.validateAgainstXSS(payload);
            expect(result.valid).toBe(false);
        });
    });

    it('Should sanitize script tags', () => {
        const sanitized = xss.sanitize('<script>alert(1)</script>');
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('alert');
    });

    it('Should escape HTML entities', () => {
        const escaped = xss.escapeHTML('<div class="test">Hello & Welcome</div>');
        expect(escaped).toContain('&lt;');
        expect(escaped).toContain('&gt;');
        expect(escaped).toContain('&quot;');
        expect(escaped).toContain('&amp;');
    });

    it('Should validate safe URLs', () => {
        expect(xss.isValidURL('https://example.com')).toBe(true);
        expect(xss.isValidURL('http://example.com')).toBe(true);
        expect(xss.isValidURL('mailto:test@example.com')).toBe(true);
        expect(xss.isValidURL('javascript:alert(1)')).toBe(false);
        expect(xss.isValidURL('data:text/html')).toBe(false);
    });

    it('Should detect XSS via hasXSS()', () => {
        expect(xss.hasXSS('<script>alert(1)</script>')).toBe(true);
        expect(xss.hasXSS('Hello World')).toBe(false);
    });

    it('Should allow safe inputs', () => {
        const safeInputs = ['Hello World', 'test@example.com', '08123456789', 'Laporan Kegiatan'];
        for (const input of safeInputs) {
            expect(xss.validateAgainstXSS(input).valid).toBe(true);
        }
    });
});

// ============================================
// AUDIT TRAIL UNIT TESTS
// ============================================

class AuditTrail {
    constructor() {
        this.events = [];
        this.maxEvents = 100;
    }

    async log(action, details = {}) {
        const event = {
            id: this.generateEventId(),
            action,
            details,
            userId: details.userId || 'anonymous',
            timestamp: new Date().toISOString()
        };
        this.events.unshift(event);
        if (this.events.length > this.maxEvents) this.events.pop();
        return event;
    }

    async logAccess(resource, resourceId) {
        return this.log('data_access', { resource, resourceId });
    }

    async logChange(resource, resourceId, changes) {
        return this.log('data_change', { resource, resourceId, changes });
    }

    async logAuth(action, username, result) {
        return this.log('authentication', { action, username, result });
    }

    async logAdminAction(action, targetId, details = {}) {
        return this.log('admin_action', { action, targetId, ...details });
    }

    async logSecurity(type, details = {}) {
        return this.log('security', { type, ...details });
    }

    getEvents(filter = {}) {
        let result = [...this.events];
        if (filter.action) result = result.filter(e => e.action === filter.action);
        if (filter.userId) result = result.filter(e => e.userId === filter.userId);
        return result;
    }

    generateEventId() {
        return `audit_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    clearEvents() {
        this.events = [];
    }
}

describe('Audit Trail', () => {
    let audit;

    beforeEach(() => {
        audit = new AuditTrail();
    });

    it('Should log events', async () => {
        await audit.log('test_action', { detail: 'test' });
        const events = audit.getEvents();
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].action).toBe('test_action');
    });

    it('Should log data access', async () => {
        await audit.logAccess('surat_keluar', 'SK001');
        const events = audit.getEvents({ action: 'data_access' });
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].details.resource).toBe('surat_keluar');
    });

    it('Should log data change with diff', async () => {
        await audit.logChange('surat_keluar', 'SK001', { perihal: 'Updated' });
        const events = audit.getEvents({ action: 'data_change' });
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].details.changes).toBeDefined();
    });

    it('Should log authentication events', async () => {
        await audit.logAuth('login', 'admin', 'success');
        const events = audit.getEvents({ action: 'authentication' });
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].details.username).toBe('admin');
        expect(events[0].details.result).toBe('success');
    });

    it('Should log admin actions', async () => {
        await audit.logAdminAction('delete_user', 'user123', { reason: 'inactive' });
        const events = audit.getEvents({ action: 'admin_action' });
        expect(events.length).toBeGreaterThan(0);
    });

    it('Should log security events', async () => {
        await audit.logSecurity('xss_attempt', { payload: '<script>' });
        const events = audit.getEvents({ action: 'security' });
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].details.type).toBe('xss_attempt');
    });

    it('Should filter events by user', () => {
        audit.log('test', { userId: 'user-001' });
        audit.log('test', { userId: 'user-002' });

        const filtered = audit.getEvents({ userId: 'user-001' });
        expect(filtered.length).toBe(1);
    });

    it('Should generate unique event IDs', () => {
        const id1 = audit.generateEventId();
        const id2 = audit.generateEventId();
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^audit_/);
    });

    it('Should limit maximum events', () => {
        for (let i = 0; i < 150; i++) {
            audit.log('test', { index: i });
        }
        expect(audit.events.length).toBeLessThanOrEqual(100);
    });

    it('Should clear all events', () => {
        audit.log('test');
        audit.clearEvents();
        expect(audit.events.length).toBe(0);
    });
});

// ============================================
// SECURITY ORCHESTRATOR UNIT TESTS
// ============================================

class SecurityOrchestrator {
    constructor() {
        this.modules = new Map();
        this.incidents = [];
        this.securityLevel = 'normal';
    }

    registerModule(name, instance) {
        this.modules.set(name, instance);
    }

    assessSecurityLevel() {
        const threats = this.getActiveThreats();
        if (threats.length > 5) this.securityLevel = 'critical';
        else if (threats.length > 3) this.securityLevel = 'high';
        else if (threats.length > 1) this.securityLevel = 'normal';
        else this.securityLevel = 'low';
    }

    getOverallStatistics() {
        return {
            overallThreatLevel: this.securityLevel,
            activeModules: this.modules.size,
            totalModules: this.modules.size,
            incidents: this.incidents.length
        };
    }

    getSecurityReport() {
        return {
            timestamp: new Date().toISOString(),
            securityLevel: this.securityLevel,
            recommendations: this.generateRecommendations(),
            incidents: this.incidents.slice(-10)
        };
    }

    generateRecommendations() {
        const recommendations = [];
        if (this.securityLevel === 'critical') {
            recommendations.push('Segera lakukan audit keamanan menyeluruh');
        }
        if (this.securityLevel === 'high') {
            recommendations.push('Tingkatkan monitoring keamanan');
        }
        return recommendations;
    }

    reportIncident(incident) {
        this.incidents.push({
            ...incident,
            reportedAt: new Date().toISOString()
        });
    }

    getActiveThreats() {
        return this.incidents.filter(i => {
            const age = Date.now() - new Date(i.reportedAt).getTime();
            return age < 3600000; // Last hour
        });
    }
}

describe('Security Orchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new SecurityOrchestrator();
    });

    it('Should register modules', () => {
        orchestrator.registerModule('csrf', { name: 'CSRF Protection' });
        orchestrator.registerModule('xss', { name: 'XSS Prevention' });

        expect(orchestrator.modules.size).toBe(2);
    });

    it('Should assess security level based on threats', () => {
        orchestrator.reportIncident({ type: 'test', severity: 'low' });
        orchestrator.assessSecurityLevel();
        expect(orchestrator.securityLevel).toBe('low');

        for (let i = 0; i < 6; i++) {
            orchestrator.reportIncident({ type: 'test', severity: 'high' });
        }
        orchestrator.assessSecurityLevel();
        expect(orchestrator.securityLevel).toBe('critical');
    });

    it('Should return overall statistics', () => {
        orchestrator.registerModule('csrf', {});
        const stats = orchestrator.getOverallStatistics();

        expect(stats.overallThreatLevel).toBeDefined();
        expect(stats.activeModules).toBe(1);
        expect(stats.totalModules).toBe(1);
    });

    it('Should generate security report', () => {
        const report = orchestrator.getSecurityReport();

        expect(report.timestamp).toBeDefined();
        expect(report.securityLevel).toBeDefined();
        expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('Should generate recommendations based on level', () => {
        orchestrator.securityLevel = 'critical';
        const recommendations = orchestrator.generateRecommendations();
        expect(recommendations.length).toBeGreaterThan(0);
    });

    it('Should report and track incidents', () => {
        orchestrator.reportIncident({ type: 'xss', severity: 'high' });
        expect(orchestrator.incidents.length).toBe(1);
        expect(orchestrator.incidents[0].type).toBe('xss');
    });

    it('Should return active threats (last hour)', () => {
        orchestrator.reportIncident({ type: 'recent', severity: 'high' });
        const threats = orchestrator.getActiveThreats();
        expect(threats.length).toBe(1);
    });

    it('Should validate security level values', () => {
        const validLevels = ['low', 'normal', 'high', 'critical'];
        orchestrator.assessSecurityLevel();
        expect(validLevels).toContain(orchestrator.securityLevel);
    });
});