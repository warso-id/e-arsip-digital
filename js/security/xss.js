// js/security/xss.js - Advanced XSS Prevention 2026
/**
 * E-Arsip Digital - XSS Prevention Module
 * Version: 2026.1.0
 * Features: Input sanitization, output encoding, DOM-based XSS detection,
 *           CSP enforcement, HTML purification, context-aware escaping
 */

import { Logger } from '../logger.js';
import APP_CONFIG from '../../config/config.js';

class XSSPrevention {
    constructor(config = APP_CONFIG.security?.xss || {}) {
        this.logger = new Logger('XSSPrevention');
        
        this.config = {
            sanitizeInput: config.sanitizeInput !== false,
            sanitizeOutput: config.sanitizeOutput !== false,
            allowedTags: config.allowedTags || ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
            allowedAttributes: config.allowedAttributes || ['href', 'title', 'target', 'class', 'id'],
            allowedSchemes: ['http', 'https', 'mailto', 'tel'],
            stripComments: true,
            removeEmptyTags: true,
            ...config
        };
        
        // HTML entity mapping
        this.entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        // Dangerous patterns to detect
        this.dangerousPatterns = [
            /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
            /javascript\s*:/gi,
            /vbscript\s*:/gi,
            /data\s*:\s*text\/html/gi,
            /on\w+\s*=\s*["'][^"']*["']/gi,
            /<iframe\b[^>]*>/gi,
            /<object\b[^>]*>/gi,
            /<embed\b[^>]*>/gi,
            /<link\b[^>]*>/gi,
            /<meta\b[^>]*>/gi,
            /expression\s*\(/gi,
            /eval\s*\(/gi,
            /document\.cookie/gi,
            /document\.write/gi,
            /\.innerHTML/gi,
            /\.outerHTML/gi,
            /fromCharCode/gi,
            /String\.fromCharCode/gi,
            /atob\s*\(/gi,
            /btoa\s*\(/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi,
            /Function\s*\(/gi,
            /constructor\s*\(/gi,
            /__proto__/gi,
            /__defineGetter__/gi,
            /__defineSetter__/gi
        ];
        
        // Context types for escaping
        this.CONTEXTS = {
            HTML: 'html',
            HTML_ATTRIBUTE: 'html_attribute',
            JAVASCRIPT: 'javascript',
            CSS: 'css',
            URL: 'url',
            SQL: 'sql'
        };
        
        this.initialized = false;
        this.detections = [];
        
        this.init();
    }
    
    init() {
        if (!this.config.sanitizeInput && !this.config.sanitizeOutput) {
            this.logger.info('XSS prevention is disabled');
            return;
        }
        
        this.setupDOMPurify();
        this.setupInputMonitoring();
        this.setupOutputMonitoring();
        this.initialized = true;
        
        this.logger.info('XSS prevention initialized', {
            allowedTags: this.config.allowedTags.length,
            patterns: this.dangerousPatterns.length
        });
    }
    
    // ============================================
    // INPUT SANITIZATION
    // ============================================
    
    sanitize(input, context = this.CONTEXTS.HTML) {
        if (!input) return input;
        
        // Handle different types
        if (typeof input === 'object') {
            return this.sanitizeObject(input);
        }
        
        if (typeof input !== 'string') return input;
        
        // Check for dangerous patterns first
        const detection = this.detectDangerousPatterns(input);
        if (detection) {
            this.reportDetection('dangerous_pattern', detection);
        }
        
        // Context-specific sanitization
        switch (context) {
            case this.CONTEXTS.HTML:
                return this.sanitizeHTML(input);
            case this.CONTEXTS.HTML_ATTRIBUTE:
                return this.sanitizeHTMLAttribute(input);
            case this.CONTEXTS.JAVASCRIPT:
                return this.sanitizeJavaScript(input);
            case this.CONTEXTS.CSS:
                return this.sanitizeCSS(input);
            case this.CONTEXTS.URL:
                return this.sanitizeURL(input);
            case this.CONTEXTS.SQL:
                return this.sanitizeSQL(input);
            default:
                return this.encodeHTML(input);
        }
    }
    
    sanitizeObject(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitize(item));
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const safeKey = this.sanitize(key);
            sanitized[safeKey] = this.sanitize(value);
        }
        return sanitized;
    }
    
    sanitizeHTML(html) {
        if (!html) return '';
        
        // Use DOMPurify if available
        if (window.DOMPurify) {
            try {
                return DOMPurify.sanitize(html, {
                    ALLOWED_TAGS: this.config.allowedTags,
                    ALLOWED_ATTR: this.config.allowedAttributes,
                    ALLOWED_URI_REGEXP: new RegExp(
                        `^(?:${this.config.allowedSchemes.join('|')}):`, 'i'
                    ),
                    ALLOW_DATA_ATTR: false,
                    ADD_TAGS: [],
                    ADD_ATTR: ['target'],
                    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
                    ALLOW_ARIA_ATTR: true,
                    ALLOW_UNKNOWN_PROTOCOLS: false,
                    WHOLE_DOCUMENT: false,
                    RETURN_DOM: false,
                    RETURN_DOM_FRAGMENT: false,
                    SANITIZE_DOM: true
                });
            } catch (error) {
                this.logger.warn('DOMPurify sanitization failed, using fallback', error);
            }
        }
        
        // Fallback sanitization
        return this.encodeHTML(html)
            .replace(/&lt;(\/?(?:b|i|em|strong|a|p|br|ul|ol|li)\b[^>]*)&gt;/gi, '<$1>')
            .replace(/&lt;a\s+(.*?)&gt;(.*?)&lt;\/a&gt;/gi, (match, attrs, text) => {
                const safeAttrs = attrs.replace(/href="javascript:[^"]*"/gi, 'href="#"');
                return `<a ${safeAttrs}>${text}</a>`;
            });
    }
    
    sanitizeHTMLAttribute(value) {
        if (!value) return '';
        
        // Remove dangerous characters
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/`/g, '&#x60;')
            .replace(/=/g, '&#x3D;');
    }
    
    sanitizeJavaScript(value) {
        if (!value) return '';
        
        // Encode for JavaScript context
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\//g, '\\/')
            .replace(/<\//g, '<\\/');
    }
    
    sanitizeCSS(value) {
        if (!value) return '';
        
        // Remove dangerous CSS
        return value
            .replace(/expression\s*\(/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/binding\s*:/gi, '')
            .replace(/@import/gi, '')
            .replace(/url\s*\(\s*["']?\s*javascript\s*:/gi, 'url(');
    }
    
    sanitizeURL(url) {
        if (!url) return '';
        
        // Check protocol
        const protocol = url.match(/^([a-z][a-z0-9+\-.]*):/i);
        
        if (protocol) {
            const scheme = protocol[1].toLowerCase();
            if (!this.config.allowedSchemes.includes(scheme)) {
                return '#blocked';
            }
        }
        
        // Encode URL
        try {
            const parsed = new URL(url, window.location.origin);
            
            // Remove dangerous parameters
            const params = new URLSearchParams(parsed.search);
            for (const [key, value] of params) {
                if (this.detectDangerousPatterns(decodeURIComponent(value))) {
                    params.delete(key);
                }
            }
            
            parsed.search = params.toString();
            return parsed.toString();
        } catch {
            return '#invalid';
        }
    }
    
    sanitizeSQL(value) {
        if (!value) return '';
        
        // Escape SQL special characters
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/"/g, '\\"')
            .replace(/\x00/g, '\\0')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\x1a/g, '\\Z');
    }
    
    // ============================================
    // ENCODING METHODS
    // ============================================
    
    encodeHTML(str) {
        return String(str).replace(/[&<>"'`\/=]/g, char => this.entities[char] || char);
    }
    
    decodeHTML(str) {
        const entities = Object.entries(this.entities).reduce((acc, [char, entity]) => {
            acc[entity] = char;
            return acc;
        }, {});
        
        return str.replace(/&[#\w]+;/g, entity => entities[entity] || entity);
    }
    
    encodeURL(str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, c =>
            '%' + c.charCodeAt(0).toString(16).toUpperCase()
        );
    }
    
    encodeBase64(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch {
            return '';
        }
    }
    
    // ============================================
    // DETECTION
    // ============================================
    
    detectDangerousPatterns(input) {
        if (typeof input !== 'string') return null;
        
        for (const pattern of this.dangerousPatterns) {
            const match = input.match(pattern);
            if (match) {
                return {
                    pattern: pattern.source,
                    match: match[0].substring(0, 100),
                    index: match.index,
                    input: input.substring(0, 100)
                };
            }
        }
        
        return null;
    }
    
    isXSSAttempt(input) {
        if (typeof input !== 'string') return false;
        return this.detectDangerousPatterns(input) !== null;
    }
    
    scanForXSS(html) {
        const findings = [];
        
        // Check for script tags
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            findings.push({
                type: 'script_tag',
                content: match[0].substring(0, 100),
                position: match.index
            });
        }
        
        // Check for event handlers
        const handlerRegex = /\bon\w+\s*=\s*["'][^"']*["']/gi;
        while ((match = handlerRegex.exec(html)) !== null) {
            findings.push({
                type: 'event_handler',
                content: match[0],
                position: match.index
            });
        }
        
        // Check for javascript: URLs
        const jsUrlRegex = /javascript\s*:/gi;
        while ((match = jsUrlRegex.exec(html)) !== null) {
            findings.push({
                type: 'javascript_url',
                content: match[0],
                position: match.index
            });
        }
        
        return findings;
    }
    
    // ============================================
    // CONTENT SECURITY POLICY HELPERS
    // ============================================
    
    generateCSPHeader() {
        const directives = {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 
                'https://apis.google.com', 'https://cdn.jsdelivr.net'],
            'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
            'img-src': ["'self'", 'data:', 'https:'],
            'font-src': ["'self'", 'https://cdn.jsdelivr.net'],
            'connect-src': ["'self'", 'https://script.google.com'],
            'frame-ancestors': ["'none'"],
            'form-action': ["'self'"],
            'base-uri': ["'self'"],
            'object-src': ["'none'"],
            'frame-src': ["'none'"],
            'child-src': ["'none'"],
            'worker-src': ["'self'"],
            'manifest-src': ["'self'"],
            'upgrade-insecure-requests': []
        };
        
        return Object.entries(directives)
            .map(([key, values]) => {
                if (values.length === 0) return key;
                return `${key} ${values.join(' ')}`;
            })
            .join('; ');
    }
    
    validateCSP(cspString) {
        const issues = [];
        
        if (!cspString) {
            issues.push('CSP header is missing');
            return issues;
        }
        
        if (cspString.includes("'unsafe-inline'")) {
            issues.push('CSP allows unsafe-inline scripts');
        }
        
        if (cspString.includes("'unsafe-eval'")) {
            issues.push('CSP allows unsafe-eval');
        }
        
        if (!cspString.includes("frame-ancestors 'none'")) {
            issues.push('CSP missing frame-ancestors directive');
        }
        
        if (!cspString.includes("object-src 'none'")) {
            issues.push('CSP missing object-src directive');
        }
        
        return issues;
    }
    
    // ============================================
    // MONITORING
    // ============================================
    
    setupInputMonitoring() {
        if (!this.config.sanitizeInput) return;
        
        // Monitor form inputs
        document.addEventListener('input', (event) => {
            const target = event.target;
            
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                const value = target.value;
                const detection = this.detectDangerousPatterns(value);
                
                if (detection) {
                    this.reportDetection('input_monitoring', {
                        ...detection,
                        field: target.name || target.id,
                        tag: target.tagName
                    });
                    
                    // Sanitize the input
                    target.value = this.sanitizeHTMLAttribute(value);
                    
                    // Dispatch warning
                    target.dispatchEvent(new CustomEvent('xss:detected', {
                        detail: { field: target.name || target.id, pattern: detection.pattern },
                        bubbles: true
                    }));
                }
            }
        }, true);
    }
    
    setupOutputMonitoring() {
        if (!this.config.sanitizeOutput) return;
        
        // Monitor DOM mutations for XSS in injected content
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element
                            this.sanitizeDOMNode(node);
                        }
                    });
                } else if (mutation.type === 'attributes') {
                    this.sanitizeDOMAttribute(
                        mutation.target,
                        mutation.attributeName
                    );
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['src', 'href', 'onclick', 'onerror', 'onload', 'style']
        });
    }
    
    sanitizeDOMNode(node) {
        // Check tag name
        const forbiddenTags = ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET', 'FORM'];
        if (forbiddenTags.includes(node.tagName)) {
            this.reportDetection('dom_injection', {
                tag: node.tagName,
                content: node.outerHTML?.substring(0, 100)
            });
            node.remove();
            return;
        }
        
        // Check attributes
        if (node.hasAttributes) {
            Array.from(node.attributes).forEach(attr => {
                const value = attr.value;
                if (value) {
                    const detection = this.detectDangerousPatterns(value);
                    if (detection) {
                        node.removeAttribute(attr.name);
                        this.reportDetection('attribute_injection', {
                            attribute: attr.name,
                            value: value.substring(0, 100)
                        });
                    }
                }
            });
        }
        
        // Check inline styles
        if (node.style?.cssText) {
            node.style.cssText = this.sanitizeCSS(node.style.cssText);
        }
    }
    
    sanitizeDOMAttribute(element, attributeName) {
        const value = element.getAttribute(attributeName);
        if (!value) return;
        
        const detection = this.detectDangerousPatterns(value);
        if (detection) {
            element.removeAttribute(attributeName);
            this.reportDetection('attribute_cleaned', {
                attribute: attributeName,
                value: value.substring(0, 100)
            });
        }
    }
    
    // ============================================
    // REPORTING
    // ============================================
    
    reportDetection(type, details) {
        const entry = {
            type,
            details,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        this.detections.push(entry);
        
        // Keep only last 100 detections
        if (this.detections.length > 100) {
            this.detections = this.detections.slice(-100);
        }
        
        this.logger.warn(`XSS detection: ${type}`, details);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('security:xss_detected', {
            detail: entry
        }));
    }
    
    getDetections() {
        return [...this.detections];
    }
    
    clearDetections() {
        this.detections = [];
    }
    
    // ============================================
    // DOMPurify SETUP
    // ============================================
    
    setupDOMPurify() {
        if (!window.DOMPurify) {
            this.logger.info('DOMPurify not loaded, using built-in sanitizer');
            return;
        }
        
        // Add hooks for custom sanitization
        DOMPurify.addHook('uponSanitizeElement', (node, data) => {
            // Remove elements with dangerous attributes
            if (node.hasAttributes()) {
                Array.from(node.attributes).forEach(attr => {
                    if (this.detectDangerousPatterns(attr.value)) {
                        node.removeAttribute(attr.name);
                    }
                });
            }
        });
        
        DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
            // Allow target="_blank" only with rel="noopener"
            if (data.attrName === 'target' && data.attrValue === '_blank') {
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });
        
        this.logger.info('DOMPurify configured');
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    sanitizeFilename(filename) {
        return filename
            .replace(/[^\w\s.-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 255);
    }
    
    sanitizeClassName(className) {
        return className.replace(/[^a-zA-Z0-9_-]/g, '');
    }
    
    sanitizeID(id) {
        return id.replace(/[^a-zA-Z0-9_-]/g, '');
    }
    
    isSafe(input, context = this.CONTEXTS.HTML) {
        const sanitized = this.sanitize(input, context);
        return sanitized === input;
    }
    
    stripTags(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getStats() {
        return {
            totalDetections: this.detections.length,
            initialized: this.initialized,
            allowedTags: this.config.allowedTags,
            patternsMonitored: this.dangerousPatterns.length
        };
    }
    
    reset() {
        this.detections = [];
        this.logger.info('XSS prevention stats reset');
    }
    
    destroy() {
        this.initialized = false;
        this.detections = [];
        this.logger.info('XSS prevention destroyed');
    }
}

// Create singleton
const xssPrevention = new XSSPrevention();

export default xssPrevention;
export { XSSPrevention };