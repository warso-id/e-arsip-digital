// js/security/secure-headers.js - Secure Headers Manager 2026
/**
 * E-Arsip Digital - Secure Headers Manager
 * Version: 2026.1.0
 * Features: CSP management, security headers generation,
 *           header validation, reporting
 */

import { Logger } from '../logger.js';
import APP_CONFIG from '../../config/config.js';

class SecureHeadersManager {
    constructor(config = APP_CONFIG.security?.headers || {}) {
        this.logger = new Logger('SecureHeaders');
        
        this.config = {
            ...config
        };
        
        // Default security headers
        this.defaultHeaders = {
            'Content-Security-Policy': this.buildCSP(),
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
        };
        
        // Current headers (may be overridden)
        this.currentHeaders = { ...this.defaultHeaders };
        
        this.init();
    }
    
    init() {
        this.applyHeaders();
        
        this.logger.info('Secure headers manager initialized', {
            headersCount: Object.keys(this.currentHeaders).length
        });
    }
    
    // ============================================
    // CSP BUILDER
    // ============================================
    
    buildCSP(options = {}) {
        const directives = {
            'default-src': options.defaultSrc || ["'self'"],
            'script-src': options.scriptSrc || [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'https://apis.google.com',
                'https://cdn.jsdelivr.net'
            ],
            'style-src': options.styleSrc || [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net'
            ],
            'img-src': options.imgSrc || [
                "'self'",
                'data:',
                'https:'
            ],
            'font-src': options.fontSrc || [
                "'self'",
                'https://cdn.jsdelivr.net'
            ],
            'connect-src': options.connectSrc || [
                "'self'",
                'https://script.google.com',
                'wss://echo.websocket.org'
            ],
            'frame-ancestors': options.frameAncestors || ["'none'"],
            'form-action': options.formAction || ["'self'"],
            'base-uri': options.baseUri || ["'self'"],
            'object-src': options.objectSrc || ["'none'"],
            'frame-src': options.frameSrc || ["'none'"],
            'child-src': options.childSrc || ["'none'"],
            'worker-src': options.workerSrc || ["'self'"],
            'manifest-src': options.manifestSrc || ["'self'"],
            'media-src': options.mediaSrc || ["'self'"],
            'upgrade-insecure-requests': []
        };
        
        // Build CSP string
        return Object.entries(directives)
            .map(([key, values]) => {
                if (values.length === 0) return key;
                return `${key} ${values.join(' ')}`;
            })
            .join('; ');
    }
    
    updateCSP(directive, values) {
        const csp = this.currentHeaders['Content-Security-Policy'] || '';
        
        // Parse existing CSP
        const directives = {};
        csp.split(';').forEach(part => {
            const trimmed = part.trim();
            if (!trimmed) return;
            
            const spaceIndex = trimmed.indexOf(' ');
            if (spaceIndex === -1) {
                directives[trimmed] = [];
            } else {
                directives[trimmed.substring(0, spaceIndex)] = 
                    trimmed.substring(spaceIndex + 1).split(' ');
            }
        });
        
        // Update directive
        directives[directive] = Array.isArray(values) ? values : [values];
        
        // Rebuild CSP
        this.currentHeaders['Content-Security-Policy'] = Object.entries(directives)
            .map(([key, vals]) => {
                if (vals.length === 0) return key;
                return `${key} ${vals.join(' ')}`;
            })
            .join('; ');
        
        this.logger.info('CSP updated', { directive, values });
    }
    
    // ============================================
    // HEADER APPLICATION
    // ============================================
    
    applyHeaders() {
        // Apply through meta tags where possible
        this.applyMetaHeaders();
        
        // Log current headers (server-side headers must be set by server config)
        this.logger.debug('Current security headers', this.currentHeaders);
    }
    
    applyMetaHeaders() {
        // Update CSP meta tag
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (cspMeta && this.currentHeaders['Content-Security-Policy']) {
            cspMeta.content = this.currentHeaders['Content-Security-Policy'];
        }
        
        // Update referrer meta
        const referrerMeta = document.querySelector('meta[name="referrer"]');
        if (referrerMeta && this.currentHeaders['Referrer-Policy']) {
            referrerMeta.content = this.currentHeaders['Referrer-Policy'];
        }
    }
    
    getHeader(name) {
        return this.currentHeaders[name] || null;
    }
    
    setHeader(name, value) {
        this.currentHeaders[name] = value;
        this.logger.info('Header updated', { name, value });
    }
    
    removeHeader(name) {
        delete this.currentHeaders[name];
        this.logger.info('Header removed', { name });
    }
    
    // ============================================
    // HEADER VALIDATION
    // ============================================
    
    validateHeaders() {
        const issues = [];
        
        // Check CSP
        const csp = this.currentHeaders['Content-Security-Policy'];
        if (!csp) {
            issues.push({ severity: 'critical', header: 'Content-Security-Policy', message: 'CSP is not set' });
        } else {
            if (csp.includes("'unsafe-inline'")) {
                issues.push({ severity: 'warning', header: 'CSP', message: 'unsafe-inline is allowed in script-src' });
            }
            if (csp.includes("'unsafe-eval'")) {
                issues.push({ severity: 'warning', header: 'CSP', message: 'unsafe-eval is allowed' });
            }
            if (!csp.includes("frame-ancestors 'none'")) {
                issues.push({ severity: 'warning', header: 'CSP', message: 'frame-ancestors is not set to none' });
            }
            if (!csp.includes("object-src 'none'")) {
                issues.push({ severity: 'warning', header: 'CSP', message: 'object-src is not set to none' });
            }
        }
        
        // Check other headers
        if (!this.currentHeaders['X-Frame-Options']) {
            issues.push({ severity: 'medium', header: 'X-Frame-Options', message: 'Not set' });
        }
        
        if (!this.currentHeaders['X-Content-Type-Options']) {
            issues.push({ severity: 'medium', header: 'X-Content-Type-Options', message: 'Not set' });
        }
        
        if (!this.currentHeaders['Referrer-Policy']) {
            issues.push({ severity: 'low', header: 'Referrer-Policy', message: 'Not set' });
        }
        
        return issues;
    }
    
    getSecurityScore() {
        const issues = this.validateHeaders();
        const criticalIssues = issues.filter(i => i.severity === 'critical').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;
        
        let score = 100;
        score -= criticalIssues * 20;
        score -= warnings * 5;
        
        return Math.max(0, score);
    }
    
    // ============================================
    // REPORTING
    // ============================================
    
    generateReport() {
        const issues = this.validateHeaders();
        const score = this.getSecurityScore();
        
        return {
            timestamp: new Date().toISOString(),
            score,
            grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
            headers: { ...this.currentHeaders },
            issues,
            recommendations: issues.map(i => ({
                header: i.header,
                action: i.message
            }))
        };
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getAllHeaders() {
        return { ...this.currentHeaders };
    }
    
    resetToDefaults() {
        this.currentHeaders = { ...this.defaultHeaders };
        this.applyHeaders();
        this.logger.info('Headers reset to defaults');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getStats() {
        return {
            headersCount: Object.keys(this.currentHeaders).length,
            securityScore: this.getSecurityScore(),
            issues: this.validateHeaders().length
        };
    }
    
    destroy() {
        this.logger.info('Secure headers manager destroyed');
    }
}

// Create singleton
const secureHeaders = new SecureHeadersManager();

export default secureHeaders;
export { SecureHeadersManager };