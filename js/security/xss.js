// js/security/xss.js - XSS Prevention 2026 (SAFE & LIGHTWEIGHT)
/**
 * E-Arsip Digital - XSS Prevention Module
 * Version: 2026.1.0
 * 
 * Features:
 * - Input sanitization (HTML entity encoding)
 * - Output encoding (context-aware)
 * - XSS pattern detection
 * - Safe HTML stripping (tanpa innerHTML!)
 * - No DOM mutation observers (lightweight)
 */

var XSSPrevention = (function() {
    'use strict';
    
    // ============================================
    // HTML ENTITY MAP
    // ============================================
    var ENTITIES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    // ============================================
    // DANGEROUS PATTERNS (Untuk deteksi saja)
    // ============================================
    var DANGEROUS_PATTERNS = [
        /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
        /javascript\s*:\s*/gi,
        /on\w+\s*=\s*["'][^"']*["']/gi,
        /<iframe\b[^>]*>/gi,
        /<object\b[^>]*>/gi,
        /<embed\b[^>]*>/gi,
        /expression\s*\(/gi,
        /eval\s*\(/gi,
        /document\.cookie/gi,
        /\.innerHTML\s*=/gi
    ];
    
    // ============================================
    // FORBIDDEN TAGS (Untuk validasi)
    // ============================================
    var FORBIDDEN_TAGS = [
        'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET',
        'META', 'LINK', 'STYLE', 'BASE'
    ];
    
    // ============================================
    // CONTEXT TYPES
    // ============================================
    var CONTEXT = {
        HTML: 'html',
        ATTRIBUTE: 'attribute',
        JAVASCRIPT: 'javascript',
        URL: 'url',
        CSS: 'css'
    };
    
    // ============================================
    // DETECTION (Non-invasive)
    // ============================================
    
    /**
     * Deteksi pola berbahaya dalam string
     * Hanya mendeteksi, TIDAK mengubah input!
     */
    function detectDangerous(input) {
        if (typeof input !== 'string' || !input) return null;
        
        for (var i = 0; i < DANGEROUS_PATTERNS.length; i++) {
            var match = input.match(DANGEROUS_PATTERNS[i]);
            if (match) {
                return {
                    pattern: DANGEROUS_PATTERNS[i].source,
                    match: match[0].substring(0, 100),
                    index: match.index
                };
            }
        }
        
        return null;
    }
    
    /**
     * Cek apakah input mengandung XSS attempt
     */
    function isXSSAttempt(input) {
        return detectDangerous(input) !== null;
    }
    
    // ============================================
    // SANITIZATION (Context-aware)
    // ============================================
    
    /**
     * Sanitize berdasarkan konteks
     */
    function sanitize(input, context) {
        if (!input) return input;
        if (typeof input !== 'string') return input;
        
        if (!context) context = CONTEXT.HTML;
        
        switch (context) {
            case CONTEXT.HTML:
                return encodeHTML(input);
            case CONTEXT.ATTRIBUTE:
                return encodeAttribute(input);
            case CONTEXT.JAVASCRIPT:
                return encodeJavaScript(input);
            case CONTEXT.URL:
                return sanitizeURL(input);
            case CONTEXT.CSS:
                return sanitizeCSS(input);
            default:
                return encodeHTML(input);
        }
    }
    
    /**
     * Encode HTML entities (AMAN)
     */
    function encodeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"'`\/=]/g, function(char) {
            return ENTITIES[char] || char;
        });
    }
    
    /**
     * Encode untuk HTML attribute
     */
    function encodeAttribute(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/`/g, '&#x60;');
    }
    
    /**
     * Encode untuk JavaScript context
     */
    function encodeJavaScript(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/<\//g, '<\\/');
    }
    
    /**
     * Sanitize URL
     */
    function sanitizeURL(url) {
        if (typeof url !== 'string' || !url) return '';
        
        // Block dangerous protocols
        if (/^(javascript|data|vbscript):/i.test(url)) {
            return '#blocked';
        }
        
        // Validasi URL
        try {
            var parsed = new URL(url, window.location.origin);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:' && parsed.protocol !== 'tel:') {
                return '#blocked';
            }
            return parsed.toString();
        } catch(e) {
            return '#invalid';
        }
    }
    
    /**
     * Sanitize CSS value
     */
    function sanitizeCSS(css) {
        if (typeof css !== 'string' || !css) return '';
        
        return css
            .replace(/expression\s*\(/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/@import/gi, '')
            .replace(/url\s*\(\s*["']?\s*javascript\s*:/gi, 'url(');
    }
    
    // ============================================
    // HTML STRIPPING (AMAN - Tanpa innerHTML!)
    // ============================================
    
    /**
     * Strip HTML tags dari string (AMAN)
     * Menggunakan regex, bukan innerHTML
     */
    function stripHTML(html) {
        if (typeof html !== 'string') return '';
        
        return html
            .replace(/<[^>]*>/g, '')           // Hapus semua tag
            .replace(/&[^;]+;/g, ' ')           // Hapus entities
            .replace(/\s+/g, ' ')               // Normalize whitespace
            .trim();
    }
    
    /**
     * Sanitize HTML (izinkan tag tertentu)
     * Untuk kebutuhan rich text yang aman
     */
    function sanitizeHTML(html, allowedTags) {
        if (typeof html !== 'string') return '';
        
        // Pertama, encode semua
        var encoded = encodeHTML(html);
        
        // Jika ada allowed tags, decode kembali
        if (allowedTags && allowedTags.length > 0) {
            for (var i = 0; i < allowedTags.length; i++) {
                var tag = allowedTags[i].toLowerCase();
                
                // Opening tag: &lt;b&gt; → <b>
                var openPattern = new RegExp('&lt;' + tag + '([^&]*)&gt;', 'gi');
                encoded = encoded.replace(openPattern, function(match, attrs) {
                    // Sanitize attributes
                    var safeAttrs = attrs.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
                    return '<' + tag + safeAttrs + '>';
                });
                
                // Closing tag: &lt;/b&gt; → </b>
                var closePattern = new RegExp('&lt;/' + tag + '&gt;', 'gi');
                encoded = encoded.replace(closePattern, '</' + tag + '>');
            }
        }
        
        return encoded;
    }
    
    // ============================================
    // VALIDASI TAG
    // ============================================
    
    /**
     * Cek apakah string mengandung tag berbahaya
     */
    function hasDangerousTags(html) {
        if (typeof html !== 'string') return false;
        
        for (var i = 0; i < FORBIDDEN_TAGS.length; i++) {
            var pattern = new RegExp('<' + FORBIDDEN_TAGS[i] + '\\b', 'i');
            if (pattern.test(html)) {
                return true;
            }
        }
        
        return false;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Context constants
        CONTEXT: CONTEXT,
        
        // Sanitization
        sanitize: sanitize,
        encodeHTML: encodeHTML,
        encodeAttribute: encodeAttribute,
        encodeJavaScript: encodeJavaScript,
        sanitizeURL: sanitizeURL,
        sanitizeCSS: sanitizeCSS,
        sanitizeHTML: sanitizeHTML,
        stripHTML: stripHTML,
        
        // Detection
        detect: detectDangerous,
        isXSS: isXSSAttempt,
        hasDangerousTags: hasDangerousTags,
        
        /**
         * Sanitize object recursively
         */
        sanitizeObject: function(obj, context) {
            if (!obj || typeof obj !== 'object') return sanitize(obj, context);
            
            if (Array.isArray(obj)) {
                var result = [];
                for (var i = 0; i < obj.length; i++) {
                    result.push(this.sanitizeObject(obj[i], context));
                }
                return result;
            }
            
            var sanitized = {};
            var keys = Object.keys(obj);
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                sanitized[key] = this.sanitizeObject(obj[key], context);
            }
            return sanitized;
        },
        
        /**
         * Cek apakah string aman
         */
        isSafe: function(input) {
            return !isXSSAttempt(input) && !hasDangerousTags(input);
        },
        
        /**
         * Sanitize filename
         */
        sanitizeFilename: function(filename) {
            if (typeof filename !== 'string') return 'file';
            return filename
                .replace(/[^a-zA-Z0-9._\- ]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 200) || 'file';
        },
        
        /**
         * Sanitize class/ID name
         */
        sanitizeIdentifier: function(str) {
            if (typeof str !== 'string') return '';
            return str.replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 64);
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // HTML context
// var safe = XSSPrevention.sanitize('<script>alert(1)</script>', XSSPrevention.CONTEXT.HTML);
// // → '&lt;script&gt;alert(1)&lt;/script&gt;'
// 
// // URL context
// var url = XSSPrevention.sanitizeURL('javascript:alert(1)');
// // → '#blocked'
// 
// // Detection only (no modification)
// if (XSSPrevention.isXSS(userInput)) {
//     console.warn('XSS attempt detected!');
// }
// 
// // Safe HTML stripping
// var text = XSSPrevention.stripHTML('<p>Hello <b>World</b></p>');
// // → 'Hello World'
// ============================================