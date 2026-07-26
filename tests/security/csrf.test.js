// tests/security/csrf.test.js - Enterprise CSRF Protection Tests 2026
/**
 * E-Arsip Digital - Comprehensive CSRF Security Tests
 * Version: 2026.1.0
 * Tests: Token generation, validation, rotation, same-origin detection,
 *        header injection, form protection, token expiry,
 *        double-submit pattern, SPA token management, CORS headers
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// MOCK CSRF PROTECTION MODULE
// ============================================

class CSRFProtection {
    constructor() {
        this.tokenKey = 'csrf_token';
        this.headerName = 'X-CSRF-Token';
        this.cookieName = 'XSRF-TOKEN';
        this.tokenLength = 32;
        this.tokenExpiry = 3600000; // 1 hour
        this.currentToken = null;
        this.tokenHistory = new Set();
        this.usedTokens = new Set();
    }

    generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        let token = '';
        const array = new Uint32Array(this.tokenLength);
        
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(array);
            for (let i = 0; i < this.tokenLength; i++) {
                token += chars[array[i] % chars.length];
            }
        } else {
            for (let i = 0; i < this.tokenLength; i++) {
                token += chars[Math.floor(Math.random() * chars.length)];
            }
        }
        
        return token;
    }

    setToken(token, options = {}) {
        this.currentToken = {
            value: token,
            createdAt: Date.now(),
            expiresAt: Date.now() + (options.expiry || this.tokenExpiry),
            metadata: options.metadata || {}
        };
        
        this.tokenHistory.add(token);
        
        // Store in sessionStorage
        try {
            sessionStorage.setItem(this.tokenKey, JSON.stringify(this.currentToken));
        } catch {}
        
        // Set cookie for double-submit pattern
        this.setCookie(this.cookieName, token);
        
        // Set meta tag
        this.setMetaTag(token);
    }

    getToken() {
        if (!this.currentToken) {
            // Try to recover from sessionStorage
            try {
                const stored = sessionStorage.getItem(this.tokenKey);
                if (stored) {
                    this.currentToken = JSON.parse(stored);
                }
            } catch {}
        }
        
        return this.currentToken?.value || null;
    }

    refreshToken() {
        const newToken = this.generateToken();
        this.setToken(newToken);
        return newToken;
    }

    validateToken(token, options = {}) {
        if (!token || typeof token !== 'string') {
            return { valid: false, reason: 'Token missing or invalid type' };
        }

        if (token.length !== this.tokenLength) {
            return { valid: false, reason: 'Token length mismatch' };
        }

        if (!this.currentToken) {
            return { valid: false, reason: 'No token set' };
        }

        // Constant-time comparison to prevent timing attacks
        const storedToken = this.currentToken.value;
        if (!this.constantTimeCompare(token, storedToken)) {
            return { valid: false, reason: 'Token mismatch' };
        }

        // Check expiry
        if (Date.now() > this.currentToken.expiresAt) {
            return { valid: false, reason: 'Token expired' };
        }

        // Check if already used (one-time use for sensitive operations)
        if (options.singleUse && this.usedTokens.has(token)) {
            return { valid: false, reason: 'Token already used' };
        }

        if (options.singleUse) {
            this.usedTokens.add(token);
        }

        return { valid: true };
    }

    constantTimeCompare(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }

    isSameOrigin(url) {
        try {
            // Relative URLs are same origin
            if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                return true;
            }

            // Hash only URLs
            if (url.startsWith('#')) return true;

            const parsed = new URL(url, window.location.origin);
            
            // Check protocol, hostname, and port
            return parsed.protocol === window.location.protocol &&
                   parsed.hostname === window.location.hostname &&
                   parsed.port === window.location.port;
        } catch {
            // Invalid URL - treat as different origin for safety
            return false;
        }
    }

    getHeaders(additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...additionalHeaders
        };

        const token = this.getToken();
        if (token) {
            headers[this.headerName] = token;
        }

        return headers;
    }

    getHeaderName() {
        return this.headerName;
    }

    createFormData(data = {}) {
        const formData = new FormData();
        
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value);
        });

        const token = this.getToken();
        if (token) {
            formData.append(this.tokenKey, token);
        }

        return formData;
    }

    addTokenToForm(form) {
        if (!form) return;

        // Remove existing token input
        const existing = form.querySelector(`input[name="${this.tokenKey}"]`);
        if (existing) existing.remove();

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = this.tokenKey;
        input.value = this.getToken() || '';
        form.appendChild(input);
    }

    addTokenToURL(url) {
        // Security: Never add CSRF token to URL
        // This is a deliberate NO-OP for security
        console.warn('CSRF tokens should never be added to URLs');
        return url;
    }

    validateRequest(method, url, headers = {}, body = null) {
        // GET requests don't need CSRF
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            return { valid: true, reason: 'Safe method' };
        }

        // Check origin
        if (!this.isSameOrigin(url)) {
            return { valid: false, reason: 'Cross-origin request blocked' };
        }

        // Check header token
        const headerToken = headers[this.headerName] || headers[this.headerName.toLowerCase()];
        if (headerToken) {
            return this.validateToken(headerToken);
        }

        // Check form data token
        if (body instanceof FormData && body.has(this.tokenKey)) {
            return this.validateToken(body.get(this.tokenKey));
        }

        // Check JSON body token
        if (typeof body === 'object' && body?.[this.tokenKey]) {
            return this.validateToken(body[this.tokenKey]);
        }

        return { valid: false, reason: 'No CSRF token found' };
    }

    setCookie(name, value) {
        try {
            document.cookie = `${name}=${value}; path=/; SameSite=Strict; Secure`;
        } catch {}
    }

    getCookie(name) {
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        return match ? match[2] : null;
    }

    setMetaTag(token) {
        let meta = document.querySelector('meta[name="csrf-token"]');
        
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'csrf-token';
            document.head.appendChild(meta);
        }
        
        meta.content = token;
    }

    getMetaToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta?.content || null;
    }

    clearToken() {
        this.currentToken = null;
        this.usedTokens.clear();
        
        try {
            sessionStorage.removeItem(this.tokenKey);
        } catch {}
        
        // Clear cookie
        document.cookie = `${this.cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        
        // Clear meta
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) meta.content = '';
    }
}

// ============================================
// TEST SETUP
// ============================================

let csrf;

beforeAll(() => {
    // Mock window.location
    delete window.location;
    window.location = {
        protocol: 'https:',
        hostname: 'e-arsip.example.com',
        port: '',
        origin: 'https://e-arsip.example.com',
        href: 'https://e-arsip.example.com/dashboard/'
    };
    
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
        writable: true,
        value: ''
    });
    
    // Mock sessionStorage
    global.sessionStorage = {
        store: {},
        getItem: jest.fn((key) => global.sessionStorage.store[key] || null),
        setItem: jest.fn((key, value) => { global.sessionStorage.store[key] = value; }),
        removeItem: jest.fn((key) => { delete global.sessionStorage.store[key]; }),
        clear: jest.fn(() => { global.sessionStorage.store = {}; })
    };
    
    // Mock document.head
    if (!document.head) {
        Object.defineProperty(document, 'head', {
            writable: true,
            value: document.createElement('head')
        });
    }
});

beforeEach(() => {
    csrf = new CSRFProtection();
    sessionStorage.clear();
    document.cookie = '';
});

afterEach(() => {
    csrf.clearToken();
});

// ============================================
// TOKEN GENERATION TESTS
// ============================================

describe('CSRF Token Generation', () => {
    it('Should generate token with correct length', () => {
        const token = csrf.generateToken();
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(32);
    });

    it('Should generate unique tokens', () => {
        const tokens = new Set();
        
        for (let i = 0; i < 100; i++) {
            tokens.add(csrf.generateToken());
        }
        
        expect(tokens.size).toBe(100);
    });

    it('Should generate tokens with sufficient entropy', () => {
        const token = csrf.generateToken();
        
        // Check for character variety
        const hasUpper = /[A-Z]/.test(token);
        const hasLower = /[a-z]/.test(token);
        const hasDigit = /[0-9]/.test(token);
        const hasSpecial = /[!@#$%^&*()]/.test(token);
        
        expect(hasUpper).toBe(true);
        expect(hasLower).toBe(true);
        expect(hasDigit).toBe(true);
        expect(hasSpecial).toBe(true);
    });

    it('Should generate tokens with uniform distribution', () => {
        const tokens = Array.from({ length: 1000 }, () => csrf.generateToken());
        
        // Check no obvious patterns
        const firstChars = tokens.map(t => t[0]);
        const uniqueFirstChars = new Set(firstChars);
        
        expect(uniqueFirstChars.size).toBeGreaterThan(20); // Good distribution
    });
});

// ============================================
// TOKEN MANAGEMENT TESTS
// ============================================

describe('CSRF Token Management', () => {
    it('Should store and retrieve token correctly', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const retrieved = csrf.getToken();
        
        expect(retrieved).toBe(token);
    });

    it('Should persist token in sessionStorage', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        // Create new instance to test recovery
        const csrf2 = new CSRFProtection();
        const recovered = csrf2.getToken();
        
        expect(recovered).toBe(token);
    });

    it('Should refresh token with new value', () => {
        const oldToken = csrf.generateToken();
        csrf.setToken(oldToken);
        
        const newToken = csrf.refreshToken();
        
        expect(newToken).not.toBe(oldToken);
        expect(newToken.length).toBe(32);
        expect(csrf.getToken()).toBe(newToken);
    });

    it('Should set CSRF cookie for double-submit pattern', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const cookieToken = csrf.getCookie('XSRF-TOKEN');
        expect(cookieToken).toBe(token);
        expect(document.cookie).toContain('SameSite=Strict');
        expect(document.cookie).toContain('Secure');
    });

    it('Should set CSRF meta tag', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const metaToken = csrf.getMetaToken();
        expect(metaToken).toBe(token);
    });
});

// ============================================
// TOKEN VALIDATION TESTS
// ============================================

describe('CSRF Token Validation', () => {
    it('Should validate correct token', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateToken(token);
        
        expect(result.valid).toBe(true);
    });

    it('Should reject invalid token', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateToken('invalid-token');
        
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
    });

    it('Should reject empty token', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateToken('');
        
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('missing');
    });

    it('Should reject null/undefined token', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        expect(csrf.validateToken(null).valid).toBe(false);
        expect(csrf.validateToken(undefined).valid).toBe(false);
    });

    it('Should reject token with wrong length', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const shortToken = 'a'.repeat(16);
        const longToken = 'a'.repeat(64);
        
        expect(csrf.validateToken(shortToken).valid).toBe(false);
        expect(csrf.validateToken(longToken).valid).toBe(false);
    });

    it('Should use constant-time comparison', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        // Spy on constantTimeCompare
        const spy = jest.spyOn(csrf, 'constantTimeCompare');
        
        csrf.validateToken(token);
        
        expect(spy).toHaveBeenCalled();
    });

    it('Should support single-use tokens', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        // First use should succeed
        const firstResult = csrf.validateToken(token, { singleUse: true });
        expect(firstResult.valid).toBe(true);
        
        // Second use should fail
        const secondResult = csrf.validateToken(token, { singleUse: true });
        expect(secondResult.valid).toBe(false);
        expect(secondResult.reason).toContain('already used');
    });

    it('Should handle token expiry', () => {
        const token = csrf.generateToken();
        csrf.setToken(token, { expiry: -1000 }); // Already expired
        
        const result = csrf.validateToken(token);
        
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('expired');
    });
});

// ============================================
// ORIGIN VALIDATION TESTS
// ============================================

describe('CSRF Origin Validation', () => {
    it('Should detect same origin for relative URLs', () => {
        expect(csrf.isSameOrigin('/api/data')).toBe(true);
        expect(csrf.isSameOrigin('./relative/path')).toBe(true);
        expect(csrf.isSameOrigin('../parent/path')).toBe(true);
    });

    it('Should detect same origin for absolute URLs', () => {
        expect(csrf.isSameOrigin('https://e-arsip.example.com/api/data')).toBe(true);
        expect(csrf.isSameOrigin('https://e-arsip.example.com/dashboard/')).toBe(true);
    });

    it('Should detect different origin', () => {
        expect(csrf.isSameOrigin('https://evil.com/api/data')).toBe(false);
        expect(csrf.isSameOrigin('http://e-arsip.example.com/api/data')).toBe(false);
        expect(csrf.isSameOrigin('https://e-arsip.example.com:8080/api/data')).toBe(false);
    });

    it('Should handle hash-only URLs', () => {
        expect(csrf.isSameOrigin('#section')).toBe(true);
    });

    it('Should handle invalid URLs safely', () => {
        expect(csrf.isSameOrigin('not-a-valid-url')).toBe(false);
        expect(csrf.isSameOrigin('javascript:alert(1)')).toBe(false);
        expect(csrf.isSameOrigin('')).toBe(false);
    });

    it('Should detect subdomain as different origin', () => {
        expect(csrf.isSameOrigin('https://sub.e-arsip.example.com/api')).toBe(false);
    });
});

// ============================================
// HEADER INJECTION TESTS
// ============================================

describe('CSRF Header Injection', () => {
    it('Should add CSRF token to headers', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const headers = csrf.getHeaders();
        
        expect(headers['X-CSRF-Token']).toBe(token);
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
    });

    it('Should merge additional headers', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const headers = csrf.getHeaders({ 'Authorization': 'Bearer test' });
        
        expect(headers['X-CSRF-Token']).toBe(token);
        expect(headers['Authorization']).toBe('Bearer test');
    });

    it('Should handle missing token gracefully', () => {
        const headers = csrf.getHeaders();
        
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['X-CSRF-Token']).toBeUndefined();
    });
});

// ============================================
// FORM PROTECTION TESTS
// ============================================

describe('CSRF Form Protection', () => {
    it('Should create CSRF-protected form data', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const formData = csrf.createFormData({ name: 'Test', value: '123' });
        
        expect(formData.has('csrf_token')).toBe(true);
        expect(formData.get('csrf_token')).toBe(token);
        expect(formData.has('name')).toBe(true);
        expect(formData.get('name')).toBe('Test');
    });

    it('Should handle empty data', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const formData = csrf.createFormData();
        
        expect(formData.has('csrf_token')).toBe(true);
    });

    it('Should add hidden input to form', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const form = document.createElement('form');
        form.id = 'testForm';
        document.body.appendChild(form);
        
        csrf.addTokenToForm(form);
        
        const csrfInput = form.querySelector('input[name="csrf_token"]');
        expect(csrfInput).not.toBeNull();
        expect(csrfInput.type).toBe('hidden');
        expect(csrfInput.value).toBe(token);
        
        form.remove();
    });

    it('Should replace existing token input on form', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const form = document.createElement('form');
        const oldInput = document.createElement('input');
        oldInput.type = 'hidden';
        oldInput.name = 'csrf_token';
        oldInput.value = 'old-token';
        form.appendChild(oldInput);
        document.body.appendChild(form);
        
        csrf.addTokenToForm(form);
        
        const inputs = form.querySelectorAll('input[name="csrf_token"]');
        expect(inputs.length).toBe(1);
        expect(inputs[0].value).toBe(token);
        
        form.remove();
    });

    it('Should NEVER add token to URL', () => {
        const url = '/api/data';
        const result = csrf.addTokenToURL(url);
        
        expect(result).toBe(url);
        expect(result).not.toContain('csrf_token');
        expect(result).not.toContain('token');
    });
});

// ============================================
// REQUEST VALIDATION TESTS
// ============================================

describe('CSRF Request Validation', () => {
    it('Should allow safe methods without token', () => {
        const result = csrf.validateRequest('GET', '/api/data');
        expect(result.valid).toBe(true);
        expect(result.reason).toContain('Safe method');
    });

    it('Should allow HEAD and OPTIONS without token', () => {
        expect(csrf.validateRequest('HEAD', '/api/data').valid).toBe(true);
        expect(csrf.validateRequest('OPTIONS', '/api/data').valid).toBe(true);
    });

    it('Should require token for POST requests', () => {
        const result = csrf.validateRequest('POST', '/api/data');
        expect(result.valid).toBe(false);
    });

    it('Should validate token from header', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateRequest('POST', '/api/data', {
            'X-CSRF-Token': token
        });
        
        expect(result.valid).toBe(true);
    });

    it('Should validate token from FormData', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const formData = new FormData();
        formData.append('csrf_token', token);
        
        const result = csrf.validateRequest('POST', '/api/data', {}, formData);
        
        expect(result.valid).toBe(true);
    });

    it('Should validate token from JSON body', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateRequest('POST', '/api/data', {}, {
            csrf_token: token,
            data: 'test'
        });
        
        expect(result.valid).toBe(true);
    });

    it('Should block cross-origin requests', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateRequest('POST', 'https://evil.com/api', {
            'X-CSRF-Token': token
        });
        
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Cross-origin');
    });

    it('Should reject requests with invalid token', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateRequest('POST', '/api/data', {
            'X-CSRF-Token': 'invalid-token-value'
        });
        
        expect(result.valid).toBe(false);
    });
});

// ============================================
// SECURITY EDGE CASE TESTS
// ============================================

describe('CSRF Security Edge Cases', () => {
    it('Should prevent token reuse in rapid succession', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        // Rapid validations with single-use
        const results = [];
        for (let i = 0; i < 5; i++) {
            results.push(csrf.validateToken(token, { singleUse: true }));
        }
        
        // Only first should succeed
        expect(results[0].valid).toBe(true);
        expect(results.slice(1).every(r => !r.valid)).toBe(true);
    });

    it('Should handle concurrent token refresh', () => {
        const token1 = csrf.generateToken();
        csrf.setToken(token1);
        
        // Simulate concurrent refresh
        const token2 = csrf.refreshToken();
        const token3 = csrf.refreshToken();
        
        // Old token should be invalid
        expect(csrf.validateToken(token1).valid).toBe(false);
        // Latest token should be valid
        expect(csrf.validateToken(token3).valid).toBe(true);
    });

    it('Should clear token and related data', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        csrf.clearToken();
        
        expect(csrf.getToken()).toBeNull();
        expect(csrf.getCookie('XSRF-TOKEN')).toBeNull();
        expect(sessionStorage.getItem('csrf_token')).toBeNull();
    });

    it('Should not leak token in error messages', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const result = csrf.validateToken('wrong-token');
        
        expect(result.valid).toBe(false);
        expect(result.reason).not.toContain(token);
        expect(result.reason).not.toContain('wrong-token');
    });

    it('Should handle very long token input safely', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const longToken = 'A'.repeat(10000);
        
        const result = csrf.validateToken(longToken);
        
        expect(result.valid).toBe(false);
        // Should not crash or hang
    });

    it('Should validate token case-sensitively', () => {
        const token = csrf.generateToken();
        csrf.setToken(token);
        
        const lowerToken = token.toLowerCase();
        const upperToken = token.toUpperCase();
        
        if (lowerToken !== token) {
            expect(csrf.validateToken(lowerToken).valid).toBe(false);
        }
        if (upperToken !== token) {
            expect(csrf.validateToken(upperToken).valid).toBe(false);
        }
    });
});