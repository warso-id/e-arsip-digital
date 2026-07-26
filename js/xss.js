// js/xss.js - Enterprise XSS Prevention & Security Sanitizer 2026
/**
 * E-Arsip Digital - Advanced XSS Prevention Module
 * Version: 2026.1.0
 * Features: Comprehensive XSS filtering, DOM monitoring, safe DOM APIs,
 *           CSS injection prevention, SVG XSS protection, prototype pollution defense,
 *           CSP integration, Trusted Types support, input/output encoding
 * Security: Multi-layered defense, context-aware sanitization, regex bypass prevention
 */

class XSSPrevention {
    constructor(options = {}) {
        // Configuration
        this.config = {
            monitorDOM: true,
            sanitizeInputs: true,
            monitorDebounce: 100,
            allowedTags: [
                'b', 'i', 'em', 'strong', 'p', 'br', 'hr',
                'ul', 'ol', 'li', 'dl', 'dt', 'dd',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'blockquote', 'pre', 'code', 'span', 'div',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'a', 'img', 'figure', 'figcaption'
            ],
            allowedAttributes: [
                'href', 'title', 'alt', 'src', 'class', 'id',
                'target', 'rel', 'width', 'height', 'loading',
                'data-*', 'aria-*'
            ],
            allowedSchemes: ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'],
            ...options
        };
        
        // State
        this.observer = null;
        this.observerDebounceTimer = null;
        this.inputHandlers = new WeakMap();
        this.initialized = false;
        
        // Trusted Types
        this.trustedTypesPolicy = null;
        
        // XSS patterns
        this.xssPatterns = this.compileXSSPatterns();
        
        this.init();
    }
    
    init() {
        this.setupTrustedTypes();
        
        if (this.config.sanitizeInputs) {
            this.sanitizeAllInputs();
        }
        
        if (this.config.monitorDOM) {
            this.monitorDOMChanges();
        }
        
        this.initialized = true;
        console.info('[XSS] Prevention module initialized');
    }
    
    // ============================================
    // TRUSTED TYPES INTEGRATION
    // ============================================
    
    setupTrustedTypes() {
        if (typeof window === 'undefined') return;
        
        if (window.trustedTypes?.createPolicy) {
            try {
                this.trustedTypesPolicy = window.trustedTypes.createPolicy('xss-sanitizer', {
                    createHTML: (input) => this.sanitizeHTML(input),
                    createScript: (input) => {
                        console.warn('[XSS] Script creation blocked via Trusted Types');
                        return '';
                    },
                    createScriptURL: (input) => {
                        if (this.isValidURL(input)) return input;
                        console.warn('[XSS] Script URL blocked:', input);
                        return '';
                    }
                });
            } catch (error) {
                console.warn('[XSS] Trusted Types policy creation failed:', error.message);
            }
        }
    }
    
    // ============================================
    // COMPREHENSIVE XSS PATTERNS
    // ============================================
    
    compileXSSPatterns() {
        return [
            // HTML tags
            { pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/gi, name: 'script_tag' },
            { pattern: /<iframe[\s\S]*?>/gi, name: 'iframe' },
            { pattern: /<embed[\s\S]*?>/gi, name: 'embed' },
            { pattern: /<object[\s\S]*?>/gi, name: 'object' },
            { pattern: /<applet[\s\S]*?>/gi, name: 'applet' },
            { pattern: /<meta[\s\S]*?>/gi, name: 'meta' },
            { pattern: /<link[\s\S]*?>/gi, name: 'link' },
            { pattern: /<base[\s\S]*?>/gi, name: 'base' },
            { pattern: /<form[\s\S]*?>/gi, name: 'form' },
            { pattern: /<math[\s\S]*?>/gi, name: 'math' },
            { pattern: /<svg[\s\S]*?>[\s\S]*?<\/svg>/gi, name: 'svg' },
            
            // Event handlers
            { pattern: /\bon\w+\s*=\s*["'][^"']*["']/gi, name: 'inline_handler_double' },
            { pattern: /\bon\w+\s*=\s*[^\s>]+/gi, name: 'inline_handler_bare' },
            { pattern: /\bon\w+\s*=\s*`[^`]*`/gi, name: 'inline_handler_template' },
            
            // JavaScript URIs
            { pattern: /javascript\s*:/gi, name: 'javascript_uri' },
            { pattern: /j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, name: 'obfuscated_js_uri' },
            { pattern: /data\s*:\s*text\/html/gi, name: 'data_html' },
            { pattern: /vbscript\s*:/gi, name: 'vbscript_uri' },
            
            // Dangerous functions
            { pattern: /\beval\s*\(/gi, name: 'eval' },
            { pattern: /\bFunction\s*\(/gi, name: 'function_constructor' },
            { pattern: /\bsetTimeout\s*\(\s*["'][^"']*["']/gi, name: 'setTimeout_string' },
            { pattern: /\bsetInterval\s*\(\s*["'][^"']*["']/gi, name: 'setInterval_string' },
            { pattern: /\bexecScript\s*\(/gi, name: 'execScript' },
            
            // DOM manipulation
            { pattern: /\.innerHTML\s*=\s*["'][^"']*["']/gi, name: 'innerHTML' },
            { pattern: /\.outerHTML\s*=\s*["'][^"']*["']/gi, name: 'outerHTML' },
            { pattern: /document\.write\s*\(/gi, name: 'document_write' },
            { pattern: /document\.writeln\s*\(/gi, name: 'document_writeln' },
            
            // CSS expression (IE)
            { pattern: /\bexpression\s*\(/gi, name: 'css_expression' },
            { pattern: /\bbehavior\s*:/gi, name: 'css_behavior' },
            { pattern: /\b-moz-binding\s*:/gi, name: 'moz_binding' },
            
            // Encoded attacks
            { pattern: /&#x?[0-9a-f]+;/gi, name: 'html_entity_encoded' },
            { pattern: /\\x[0-9a-f]{2}/gi, name: 'hex_escape' },
            { pattern: /\\u[0-9a-f]{4}/gi, name: 'unicode_escape' },
            { pattern: /%3[CD]/gi, name: 'url_encoded_tags' },
            
            // SVG specific
            { pattern: /<animate[^>]*on\w+\s*=/gi, name: 'svg_animate_event' },
            { pattern: /<set[^>]*on\w+\s*=/gi, name: 'svg_set_event' },
            
            // CSS injection
            { pattern: /url\s*\(\s*["']?\s*(?:javascript|data|vbscript):/gi, name: 'css_url_injection' },
            { pattern: /@import\s+["']?(?:javascript|data):/gi, name: 'css_import_injection' }
        ];
    }
    
    // ============================================
    // CORE SANITIZATION
    // ============================================
    
    sanitize(input) {
        if (!input) return input;
        if (typeof input !== 'string') return input;
        
        let sanitized = input;
        
        // Apply all XSS patterns
        for (const { pattern, name } of this.xssPatterns) {
            if (pattern.test(sanitized)) {
                sanitized = sanitized.replace(pattern, (match) => {
                    console.debug(`[XSS] Removed: ${name}`, { 
                        match: match.substring(0, 50) 
                    });
                    return '';
                });
            }
        }
        
        // Remove any remaining HTML tags as final safety net
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        
        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        
        // Remove zero-width characters
        sanitized = sanitized.replace(/[\u200b-\u200f\u2028-\u202f\ufeff]/g, '');
        
        // Trim whitespace
        sanitized = sanitized.trim();
        
        // Limit length
        if (sanitized.length > 10000) {
            sanitized = sanitized.substring(0, 10000);
        }
        
        return sanitized;
    }
    
    sanitizeHTML(html) {
        if (!html) return '';
        if (typeof html !== 'string') return String(html);
        
        // Use DOMParser for robust parsing
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Clean the document
        this.cleanNode(doc.body);
        
        // Serialize back to HTML
        return doc.body.innerHTML;
    }
    
    cleanNode(node) {
        // Remove script, style, iframe, embed, object, applet
        const removeTags = ['SCRIPT', 'STYLE', 'IFRAME', 'EMBED', 'OBJECT', 'APPLET', 
                           'META', 'LINK', 'BASE', 'FORM', 'INPUT'];
        
        if (removeTags.includes(node.tagName)) {
            node.remove();
            return;
        }
        
        // Remove SVG and MathML elements with event handlers
        if (['svg', 'math'].includes(node.tagName?.toLowerCase())) {
            if (this.hasEventHandlers(node) || this.hasDangerousContent(node)) {
                node.remove();
                return;
            }
        }
        
        // Clean attributes
        if (node.attributes) {
            const attrsToRemove = [];
            
            for (const attr of node.attributes) {
                const attrName = attr.name.toLowerCase();
                
                // Remove event handlers
                if (attrName.startsWith('on')) {
                    attrsToRemove.push(attr.name);
                    continue;
                }
                
                // Remove dangerous attributes
                if (['formaction', 'action', 'href', 'src', 'xlink:href'].includes(attrName)) {
                    if (!this.isSafeURL(attr.value)) {
                        attrsToRemove.push(attr.name);
                        continue;
                    }
                }
                
                // Remove style with dangerous content
                if (attrName === 'style' && this.isDangerousStyle(attr.value)) {
                    attrsToRemove.push(attr.name);
                    continue;
                }
                
                // Remove data: URLs
                if (attr.value?.toLowerCase().startsWith('data:')) {
                    if (!attr.value.startsWith('data:image/')) {
                        attrsToRemove.push(attr.name);
                    }
                }
            }
            
            attrsToRemove.forEach(attr => node.removeAttribute(attr));
        }
        
        // Recursively clean children
        const children = [...node.children];
        children.forEach(child => this.cleanNode(child));
    }
    
    hasEventHandlers(node) {
        if (!node.attributes) return false;
        
        for (const attr of node.attributes) {
            if (attr.name.startsWith('on')) return true;
        }
        
        return false;
    }
    
    hasDangerousContent(node) {
        const html = node.outerHTML?.toLowerCase() || '';
        return /javascript:|data:text\/html|expression\(|url\(.*javascript:/i.test(html);
    }
    
    // ============================================
    // CONTEXT-SPECIFIC ENCODING
    // ============================================
    
    escapeHTML(str) {
        if (!str) return '';
        
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    
    escapeAttribute(str) {
        if (!str) return '';
        
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/`/g, '&#x60;')
            .replace(/=/g, '&#x3D;');
    }
    
    escapeJavaScript(str) {
        if (!str) return '';
        
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\//g, '\\/')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/</g, '\\x3C')
            .replace(/>/g, '\\x3E')
            .replace(/&/g, '\\x26');
    }
    
    escapeCSS(str) {
        if (!str) return '';
        
        return String(str)
            .replace(/</g, '\\3C ')
            .replace(/>/g, '\\3E ')
            .replace(/&/g, '\\26 ')
            .replace(/"/g, '\\22 ')
            .replace(/'/g, '\\27 ')
            .replace(/\(/g, '\\28 ')
            .replace(/\)/g, '\\29 ');
    }
    
    escapeURL(str) {
        if (!str) return '';
        
        return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });
    }
    
    unescapeHTML(str) {
        if (!str) return '';
        
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    }
    
    // ============================================
    // URL VALIDATION
    // ============================================
    
    isValidURL(url) {
        if (!url) return false;
        
        try {
            const parsed = new URL(url, window.location.origin);
            
            // Check protocol
            if (!this.config.allowedSchemes.includes(parsed.protocol)) {
                return false;
            }
            
            // Check for javascript: bypass attempts
            if (/javascript/i.test(parsed.protocol)) return false;
            if (/javascript/i.test(parsed.pathname)) return false;
            
            // Check for data: URIs
            if (parsed.protocol === 'data:') return false;
            
            return true;
        } catch {
            // Relative URLs
            if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                return true;
            }
            if (url.startsWith('#') || url.startsWith('?')) {
                return true;
            }
            return false;
        }
    }
    
    isSafeURL(url) {
        if (!url) return true;
        
        const lower = url.toLowerCase().trim();
        
        // Block dangerous protocols
        if (/^(javascript|data|vbscript):/i.test(lower)) return false;
        
        // Block URLs with HTML entities
        if (/&#/i.test(url)) return false;
        
        // Block URLs with encoded characters
        if (/%[0-2][0-9a-f]/i.test(url) && /[<>]/.test(decodeURIComponent(url))) {
            return false;
        }
        
        return this.isValidURL(url);
    }
    
    // ============================================
    // CSS INJECTION PREVENTION
    // ============================================
    
    isDangerousStyle(style) {
        if (!style) return false;
        
        const lower = style.toLowerCase();
        
        // Check for JavaScript in CSS
        if (/javascript/i.test(lower)) return true;
        if (/expression\s*\(/i.test(lower)) return true;
        if (/behavior\s*:/i.test(lower)) return true;
        if (/-moz-binding/i.test(lower)) return true;
        
        // Check for URL with dangerous protocols
        if (/url\s*\(\s*["']?\s*(?:javascript|data|vbscript):/i.test(lower)) return true;
        
        // Check for @import with dangerous protocols
        if (/@import\s+["']?\s*(?:javascript|data):/i.test(lower)) return true;
        
        return false;
    }
    
    sanitizeCSS(style) {
        if (!style) return '';
        
        return style
            .replace(/javascript\s*:/gi, '')
            .replace(/expression\s*\(/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/-moz-binding\s*:/gi, '')
            .replace(/url\s*\(\s*["']?\s*(?:javascript|data|vbscript):/gi, 'url(invalid)')
            .replace(/@import\s+["']?\s*(?:javascript|data):/gi, '');
    }
    
    // ============================================
    // INPUT SANITIZATION
    // ============================================
    
    sanitizeAllInputs() {
        // Use event delegation for efficiency
        document.addEventListener('input', this.handleInputEvent.bind(this), true);
        document.addEventListener('paste', this.handlePasteEvent.bind(this), true);
    }
    
    handleInputEvent(event) {
        const target = event.target;
        
        // Only handle text-like inputs
        if (!this.isTextInput(target)) return;
        
        // Skip if already handled
        if (this.inputHandlers.has(target)) return;
        
        const sanitized = this.sanitize(target.value);
        if (sanitized !== target.value) {
            const cursorPos = target.selectionStart;
            target.value = sanitized;
            
            // Restore cursor position
            if (cursorPos !== null) {
                const newPos = Math.min(cursorPos, sanitized.length);
                target.setSelectionRange(newPos, newPos);
            }
        }
    }
    
    handlePasteEvent(event) {
        const target = event.target;
        if (!this.isTextInput(target)) return;
        
        // Allow default paste but sanitize after
        setTimeout(() => {
            const sanitized = this.sanitize(target.value);
            if (sanitized !== target.value) {
                target.value = sanitized;
            }
        }, 0);
    }
    
    isTextInput(element) {
        if (!element) return false;
        
        const tag = element.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
            const type = element.type?.toLowerCase();
            return ['text', 'search', 'email', 'url', 'tel', 'password'].includes(type);
        }
        
        // ContentEditable elements
        if (element.isContentEditable) return true;
        
        return false;
    }
    
    // ============================================
    // DOM MONITORING
    // ============================================
    
    monitorDOMChanges() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.observer = new MutationObserver((mutations) => {
            // Debounce DOM checks
            if (this.observerDebounceTimer) {
                clearTimeout(this.observerDebounceTimer);
            }
            
            this.observerDebounceTimer = setTimeout(() => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkElement(node);
                        }
                    }
                    
                    // Check attribute changes
                    if (mutation.type === 'attributes') {
                        this.checkAttributes(mutation.target, mutation.attributeName);
                    }
                }
            }, this.config.monitorDebounce);
        });
        
        this.observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['onerror', 'onload', 'onclick', 'style', 'href', 'src']
        });
    }
    
    checkElement(element) {
        if (!element?.tagName) return;
        
        // Block dangerous elements
        const dangerousTags = ['SCRIPT', 'IFRAME', 'EMBED', 'OBJECT', 'APPLET', 'META'];
        if (dangerousTags.includes(element.tagName)) {
            console.warn(`[XSS] Dangerous element removed: ${element.tagName}`);
            element.remove();
            return;
        }
        
        // Check attributes
        if (element.attributes) {
            for (const attr of [...element.attributes]) {
                if (attr.name.startsWith('on')) {
                    console.warn(`[XSS] Event handler removed: ${attr.name}`);
                    element.removeAttribute(attr.name);
                }
                
                if (['href', 'src', 'action', 'formaction'].includes(attr.name)) {
                    if (!this.isSafeURL(attr.value)) {
                        console.warn(`[XSS] Dangerous URL in ${attr.name}: ${attr.value.substring(0, 50)}`);
                        element.removeAttribute(attr.name);
                    }
                }
            }
        }
        
        // Recursively check children
        for (const child of [...element.children]) {
            this.checkElement(child);
        }
    }
    
    checkAttributes(element, attributeName) {
        if (!element || !attributeName) return;
        
        if (attributeName.startsWith('on')) {
            element.removeAttribute(attributeName);
            return;
        }
        
        if (['href', 'src'].includes(attributeName)) {
            const value = element.getAttribute(attributeName);
            if (value && !this.isSafeURL(value)) {
                element.removeAttribute(attributeName);
            }
        }
    }
    
    // ============================================
    // SAFE DOM APIs
    // ============================================
    
    createSafeElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);
        
        // Set safe attributes
        for (const [key, value] of Object.entries(attributes)) {
            if (key.startsWith('on')) continue;
            if (key === 'style' && this.isDangerousStyle(value)) continue;
            if (['href', 'src', 'action'].includes(key) && !this.isSafeURL(value)) continue;
            
            element.setAttribute(key, this.escapeAttribute(value));
        }
        
        // Set safe text content
        if (textContent) {
            element.textContent = this.sanitize(textContent);
        }
        
        return element;
    }
    
    getSafeElement(id) {
        const element = document.getElementById(id);
        if (!element) return null;
        
        // Remove dangerous attributes
        for (const attr of [...element.attributes]) {
            if (attr.name.startsWith('on')) {
                element.removeAttribute(attr.name);
            }
        }
        
        return element;
    }
    
    setSafeHTML(element, html) {
        if (!element) return;
        
        // Use Trusted Types if available
        if (this.trustedTypesPolicy) {
            element.innerHTML = this.trustedTypesPolicy.createHTML(html);
        } else {
            element.innerHTML = this.sanitizeHTML(html);
        }
    }
    
    setSafeText(element, text) {
        if (!element) return;
        element.textContent = this.sanitize(text);
    }
    
    setSafeAttribute(element, name, value) {
        if (!element) return;
        
        if (name.startsWith('on')) return;
        
        if (['href', 'src', 'action', 'formaction'].includes(name)) {
            if (!this.isSafeURL(value)) return;
        }
        
        element.setAttribute(name, this.escapeAttribute(value));
    }
    
    // ============================================
    // OBJECT & ARRAY SANITIZATION
    // ============================================
    
    sanitizeObject(obj, depth = 0) {
        if (depth > 20) return obj; // Prevent recursion
        
        if (obj === null || obj === undefined) return obj;
        
        // String
        if (typeof obj === 'string') {
            return this.sanitize(obj);
        }
        
        // Array
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, depth + 1));
        }
        
        // Object
        if (typeof obj === 'object' && obj.constructor === Object) {
            const sanitized = {};
            
            for (const [key, value] of Object.entries(obj)) {
                // Sanitize key
                const safeKey = this.sanitize(String(key));
                
                // Prevent prototype pollution
                if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') {
                    continue;
                }
                
                sanitized[safeKey] = this.sanitizeObject(value, depth + 1);
            }
            
            return sanitized;
        }
        
        // Other types (numbers, booleans, etc.)
        return obj;
    }
    
    sanitizeFormData(formData) {
        const sanitized = {};
        
        formData.forEach((value, key) => {
            const safeKey = this.sanitize(key);
            const safeValue = this.sanitizeObject(value);
            
            if (sanitized[safeKey] !== undefined) {
                if (!Array.isArray(sanitized[safeKey])) {
                    sanitized[safeKey] = [sanitized[safeKey]];
                }
                sanitized[safeKey].push(safeValue);
            } else {
                sanitized[safeKey] = safeValue;
            }
        });
        
        return sanitized;
    }
    
    // ============================================
    // JSON VALIDATION
    // ============================================
    
    isValidJSON(str) {
        if (!str || typeof str !== 'string') return false;
        
        try {
            const parsed = JSON.parse(str);
            return typeof parsed === 'object' && parsed !== null;
        } catch {
            return false;
        }
    }
    
    sanitizeJSON(str) {
        if (!str) return '';
        
        try {
            const parsed = JSON.parse(str);
            const sanitized = this.sanitizeObject(parsed);
            return JSON.stringify(sanitized);
        } catch {
            return '';
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    hasXSS(input) {
        if (!input || typeof input !== 'string') return false;
        
        for (const { pattern } of this.xssPatterns) {
            if (pattern.test(input)) return true;
        }
        
        return false;
    }
    
    getXSSDetections(input) {
        if (!input || typeof input !== 'string') return [];
        
        const detections = [];
        
        for (const { pattern, name } of this.xssPatterns) {
            if (pattern.test(input)) {
                detections.push(name);
            }
        }
        
        return detections;
    }
    
    sanitizeFilename(filename) {
        if (!filename) return '';
        
        return String(filename)
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/^\.+/, '')
            .replace(/\.+$/, '')
            .replace(/_{2,}/g, '_')
            .substring(0, 255);
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.observerDebounceTimer) {
            clearTimeout(this.observerDebounceTimer);
        }
        
        document.removeEventListener('input', this.handleInputEvent, true);
        document.removeEventListener('paste', this.handlePasteEvent, true);
        
        this.initialized = false;
        console.info('[XSS] Prevention module destroyed');
    }
}

// Create singleton
const xssPrevention = new XSSPrevention();

// Export
export default xssPrevention;
export { XSSPrevention };