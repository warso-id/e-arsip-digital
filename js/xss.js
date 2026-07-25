// FILE: js/xss.js
// ============================================
// XSS PREVENTION - E-ARSIP DIGITAL
// ============================================

class XSSPrevention {
    constructor() {
        this.init();
    }
    
    /**
     * Initialize XSS prevention
     */
    init() {
        this.sanitizeAllInputs();
        this.monitorDOMChanges();
    }
    
    /**
     * Sanitize all input fields
     */
    sanitizeAllInputs() {
        document.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(input => {
            input.addEventListener('input', (e) => {
                const sanitized = this.sanitize(e.target.value);
                if (sanitized !== e.target.value) {
                    e.target.value = sanitized;
                }
            });
        });
    }
    
    /**
     * Sanitize string
     */
    sanitize(input) {
        if (typeof input !== 'string') return input;
        
        // Remove HTML tags
        input = input.replace(/<[^>]*>/g, '');
        
        // Remove potentially dangerous content
        input = input.replace(/javascript:/gi, '');
        input = input.replace(/on\w+\s*=/gi, '');
        input = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        return input;
    }
    
    /**
     * Escape HTML entities
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
    
    /**
     * Unescape HTML entities
     */
    unescapeHTML(str) {
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    }
    
    /**
     * Encode URL
     */
    encodeURL(url) {
        return encodeURIComponent(url).replace(/[!'()*]/g, function(c) {
            return '%' + c.charCodeAt(0).toString(16);
        });
    }
    
    /**
     * Validate URL
     */
    isValidURL(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Sanitize HTML content (for rich text)
     */
    sanitizeHTML(html) {
        // Allow only safe tags
        const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'];
        const allowedAttributes = ['href', 'title', 'target'];
        
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove all script tags
        temp.querySelectorAll('script').forEach(el => el.remove());
        
        // Remove event handlers
        temp.querySelectorAll('*').forEach(el => {
            // Remove on* attributes
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
            
            // Remove style attributes with expressions
            if (el.hasAttribute('style')) {
                const style = el.getAttribute('style');
                if (/expression|javascript|behavior/i.test(style)) {
                    el.removeAttribute('style');
                }
            }
        });
        
        return temp.innerHTML;
    }
    
    /**
     * Monitor DOM changes for XSS
     */
    monitorDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        this.checkElement(node);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Check element for XSS
     */
    checkElement(element) {
        // Check for script elements
        if (element.tagName === 'SCRIPT') {
            console.warn('XSS Prevention: Script element detected and removed');
            element.remove();
            return;
        }
        
        // Check inline event handlers
        const attributes = element.attributes;
        for (let i = 0; i < attributes.length; i++) {
            const attr = attributes[i];
            if (attr.name.startsWith('on') || 
                attr.value.includes('javascript:') ||
                attr.value.includes('data:text/html')) {
                console.warn(`XSS Prevention: Dangerous attribute "${attr.name}" removed`);
                element.removeAttribute(attr.name);
            }
        }
        
        // Check child elements recursively
        element.children && Array.from(element.children).forEach(child => {
            this.checkElement(child);
        });
    }
    
    /**
     * Create safe HTML element
     */
    createSafeElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);
        
        // Set safe attributes
        for (const [key, value] of Object.entries(attributes)) {
            if (key.startsWith('on')) continue;
            if (key === 'style' && /expression|javascript|behavior/i.test(value)) continue;
            
            element.setAttribute(key, this.sanitize(value));
        }
        
        // Set safe text content
        if (textContent) {
            element.textContent = this.sanitize(textContent);
        }
        
        return element;
    }
    
    /**
     * Get safe element by ID
     */
    static getSafeElement(id) {
        const element = document.getElementById(id);
        if (!element) return null;
        
        // Remove potentially dangerous attributes
        Array.from(element.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
                element.removeAttribute(attr.name);
            }
        });
        
        return element;
    }
    
    /**
     * Validate JSON
     */
    static isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Sanitize object recursively
     */
    sanitizeObject(obj) {
        if (typeof obj === 'string') {
            return this.prototype.sanitize(obj);
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeObject(value);
            }
            return sanitized;
        }
        
        return obj;
    }
}

// Create global instance
const xssPrevention = new XSSPrevention();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XSSPrevention;
}