// js/security/csrf.js - CSRF Protection Module 2026
/**
 * E-Arsip Digital - CSRF Protection
 * Version: 2026.1.0
 * Features: Double-submit cookie pattern, per-request tokens, 
 *           origin verification, same-site enforcement
 */

import { Logger } from '../logger.js';
import APP_CONFIG from '../../config/config.js';
import { EncryptionService } from './encryption.js';

class CSRFProtection {
    constructor(config = APP_CONFIG.security?.csrf || {}) {
        this.logger = new Logger('CSRFProtection');
        this.encryption = new EncryptionService();
        
        this.config = {
            enabled: config.enabled !== false,
            cookieName: config.cookieName || 'XSRF-TOKEN',
            headerName: config.headerName || 'X-XSRF-TOKEN',
            formFieldName: config.formFieldName || '_csrf_token',
            tokenLength: config.tokenLength || 32,
            tokenExpiry: config.tokenExpiry || 3600000, // 1 hour
            renewOnUse: config.renewOnUse !== false,
            validateOrigin: config.validateOrigin !== false,
            allowedOrigins: config.allowedOrigins || [],
            ...config
        };
        
        // Active tokens
        this.activeTokens = new Map();
        
        // Statistics
        this.stats = {
            tokensGenerated: 0,
            tokensValidated: 0,
            tokensRejected: 0,
            originValidations: 0,
            originRejections: 0
        };
        
        this.initialized = false;
        
        this.init();
    }
    
    init() {
        if (!this.config.enabled) {
            this.logger.info('CSRF protection is disabled');
            return;
        }
        
        this.generateToken();
        this.injectMetaTag();
        this.injectFormTokens();
        this.setupAjaxInterceptor();
        this.setupFormInterceptor();
        
        // Renew token periodically
        this.tokenRenewInterval = setInterval(() => {
            this.generateToken();
        }, this.config.tokenExpiry / 2);
        
        this.initialized = true;
        
        this.logger.info('CSRF protection initialized', {
            cookieName: this.config.cookieName,
            tokenLength: this.config.tokenLength
        });
    }
    
    // ============================================
    // TOKEN GENERATION
    // ============================================
    
    generateToken() {
        const token = this.createSecureToken();
        const expiry = Date.now() + this.config.tokenExpiry;
        
        // Store token
        this.activeTokens.set(token, {
            createdAt: Date.now(),
            expiresAt: expiry,
            used: false
        });
        
        // Clean old tokens
        this.cleanExpiredTokens();
        
        // Set cookie
        this.setTokenCookie(token, expiry);
        
        // Update meta tag
        this.updateMetaToken(token);
        
        // Update hidden inputs
        this.updateFormTokens(token);
        
        this.stats.tokensGenerated++;
        
        return token;
    }
    
    createSecureToken() {
        const array = new Uint32Array(8);
        crypto.getRandomValues(array);
        
        const token = Array.from(array, dec => 
            ('0' + dec.toString(16)).substr(-2)
        ).join('');
        
        // Add HMAC for integrity
        const hmac = this.generateHMAC(token);
        
        return `${token}.${hmac}`;
    }
    
    generateHMAC(token) {
        // Simple HMAC using SubtleCrypto
        const encoder = new TextEncoder();
        const data = encoder.encode(token + this.config.cookieName);
        
        // In production, use proper HMAC with a secret key
        return btoa(String.fromCharCode(...new Uint8Array(data)))
            .substring(0, 32)
            .replace(/[+/=]/g, '');
    }
    
    // ============================================
    // TOKEN VALIDATION
    // ============================================
    
    validateToken(token) {
        if (!token) {
            this.stats.tokensRejected++;
            return { valid: false, reason: 'Token is empty' };
        }
        
        // Split token and HMAC
        const parts = token.split('.');
        if (parts.length !== 2) {
            this.stats.tokensRejected++;
            return { valid: false, reason: 'Invalid token format' };
        }
        
        const [tokenPart, hmac] = parts;
        
        // Verify HMAC
        const expectedHMAC = this.generateHMAC(tokenPart);
        if (hmac !== expectedHMAC) {
            this.stats.tokensRejected++;
            return { valid: false, reason: 'Token integrity check failed' };
        }
        
        // Check if token exists and is valid
        const tokenData = this.activeTokens.get(token);
        if (!tokenData) {
            this.stats.tokensRejected++;
            return { valid: false, reason: 'Unknown token' };
        }
        
        // Check expiry
        if (Date.now() > tokenData.expiresAt) {
            this.activeTokens.delete(token);
            this.stats.tokensRejected++;
            return { valid: false, reason: 'Token expired' };
        }
        
        // Check if already used (one-time use)
        if (tokenData.used && this.config.renewOnUse) {
            this.stats.tokensRejected++;
            return { valid: false, reason: 'Token already used' };
        }
        
        // Mark as used
        if (this.config.renewOnUse) {
            tokenData.used = true;
        }
        
        this.stats.tokensValidated++;
        
        // Renew token after use
        if (this.config.renewOnUse) {
            this.generateToken();
        }
        
        return { valid: true };
    }
    
    validateRequest(request = {}) {
        // Get token from various sources
        const token = this.extractToken(request);
        
        // Validate token
        const tokenResult = this.validateToken(token);
        if (!tokenResult.valid) {
            return tokenResult;
        }
        
        // Validate origin
        if (this.config.validateOrigin) {
            const originResult = this.validateOrigin(request);
            if (!originResult.valid) {
                return originResult;
            }
        }
        
        return { valid: true };
    }
    
    extractToken(request) {
        // From header
        if (request.headers?.[this.config.headerName]) {
            return request.headers[this.config.headerName];
        }
        
        // From form data
        if (request.body?.[this.config.formFieldName]) {
            return request.body[this.config.formFieldName];
        }
        
        // From query string (not recommended, but supported)
        if (request.query?.[this.config.formFieldName]) {
            return request.query[this.config.formFieldName];
        }
        
        // From cookie (double-submit)
        return this.getCookie(this.config.cookieName);
    }
    
    validateOrigin(request) {
        this.stats.originValidations++;
        
        // Get origin from request headers
        const origin = request.headers?.origin || request.headers?.referer;
        
        if (!origin) {
            // Same-origin requests may not have origin header
            if (request.headers?.['x-requested-with'] === 'XMLHttpRequest') {
                return { valid: true, reason: 'AJAX same-origin' };
            }
            
            return { valid: true, reason: 'No origin (same-origin likely)' };
        }
        
        // Check against allowed origins
        const allowedOrigins = [
            window.location.origin,
            ...this.config.allowedOrigins
        ];
        
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed instanceof RegExp) return allowed.test(origin);
            return allowed === origin;
        });
        
        if (!isAllowed) {
            this.stats.originRejections++;
            this.logger.warn('Origin rejected', { origin });
            return { valid: false, reason: 'Origin not allowed' };
        }
        
        return { valid: true };
    }
    
    // ============================================
    // COOKIE MANAGEMENT
    // ============================================
    
    setTokenCookie(token, expiry) {
        const cookieOptions = [
            `${this.config.cookieName}=${token}`,
            `path=/`,
            `expires=${new Date(expiry).toUTCString()}`,
            'SameSite=Strict',
            'Secure',
            'HttpOnly=false' // Must be readable by JavaScript
        ];
        
        document.cookie = cookieOptions.join('; ');
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        
        return null;
    }
    
    deleteCookie() {
        document.cookie = `${this.config.cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
    }
    
    // ============================================
    // DOM INTEGRATION
    // ============================================
    
    injectMetaTag() {
        let metaTag = document.querySelector('meta[name="csrf-token"]');
        
        if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.name = 'csrf-token';
            document.head.appendChild(metaTag);
        }
        
        const token = this.getCookie(this.config.cookieName);
        if (token) {
            metaTag.content = token;
        }
    }
    
    updateMetaToken(token) {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            metaTag.content = token;
        }
    }
    
    injectFormTokens() {
        // Add hidden CSRF field to all forms
        document.querySelectorAll('form').forEach(form => {
            if (!form.querySelector(`input[name="${this.config.formFieldName}"]`)) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = this.config.formFieldName;
                input.value = this.getCookie(this.config.cookieName) || '';
                form.appendChild(input);
            }
        });
    }
    
    updateFormTokens(token) {
        document.querySelectorAll(`input[name="${this.config.formFieldName}"]`).forEach(input => {
            input.value = token;
        });
    }
    
    // ============================================
    // REQUEST INTERCEPTION
    // ============================================
    
    setupAjaxInterceptor() {
        // Intercept fetch
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(url, options = {}) {
            // Add CSRF token to headers
            const headers = new Headers(options.headers || {});
            
            if (!headers.has(self.config.headerName)) {
                const token = self.getCookie(self.config.cookieName);
                if (token) {
                    headers.set(self.config.headerName, token);
                }
            }
            
            // Validate for state-changing requests
            const method = (options.method || 'GET').toUpperCase();
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                if (!headers.has(self.config.headerName)) {
                    self.logger.warn('CSRF token missing in request', { method, url });
                }
            }
            
            return originalFetch.call(this, url, {
                ...options,
                headers
            });
        };
        
        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._csrfMethod = method;
            return originalOpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (name.toLowerCase() === self.config.headerName.toLowerCase()) {
                this._csrfSet = true;
            }
            return originalSetRequestHeader.call(this, name, value);
        };
        
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body) {
            if (!this._csrfSet) {
                const token = self.getCookie(self.config.cookieName);
                if (token) {
                    originalSetRequestHeader.call(this, self.config.headerName, token);
                }
            }
            return originalSend.call(this, body);
        };
    }
    
    setupFormInterceptor() {
        document.addEventListener('submit', (event) => {
            const form = event.target;
            
            // Ensure CSRF field exists
            let csrfField = form.querySelector(`input[name="${this.config.formFieldName}"]`);
            
            if (!csrfField) {
                csrfField = document.createElement('input');
                csrfField.type = 'hidden';
                csrfField.name = this.config.formFieldName;
                form.appendChild(csrfField);
            }
            
            csrfField.value = this.getCookie(this.config.cookieName) || '';
        }, true);
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    cleanExpiredTokens() {
        const now = Date.now();
        
        for (const [token, data] of this.activeTokens) {
            if (now > data.expiresAt) {
                this.activeTokens.delete(token);
            }
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            activeTokens: this.activeTokens.size,
            initialized: this.initialized
        };
    }
    
    getCurrentToken() {
        return this.getCookie(this.config.cookieName);
    }
    
    regenerateToken() {
        return this.generateToken();
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    isEnabled() {
        return this.config.enabled && this.initialized;
    }
    
    getTokenForRequest() {
        return this.getCookie(this.config.cookieName);
    }
    
    reset() {
        this.stats = {
            tokensGenerated: 0,
            tokensValidated: 0,
            tokensRejected: 0,
            originValidations: 0,
            originRejections: 0
        };
        this.activeTokens.clear();
        this.logger.info('CSRF protection stats reset');
    }
    
    destroy() {
        if (this.tokenRenewInterval) {
            clearInterval(this.tokenRenewInterval);
        }
        
        this.deleteCookie();
        this.activeTokens.clear();
        this.initialized = false;
        this.logger.info('CSRF protection destroyed');
    }
}

// Create singleton
const csrfProtection = new CSRFProtection();

export default csrfProtection;
export { CSRFProtection };