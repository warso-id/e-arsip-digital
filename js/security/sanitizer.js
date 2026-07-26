// js/security/sanitizer.js - Input Sanitizer 2026 (SECURE)
/**
 * E-Arsip Digital - Input Sanitizer
 * Version: 2026.1.0
 * 
 * Features:
 * - Multi-context sanitization (HTML, SQL, URL, email)
 * - Recursive object cleaning
 * - Type coercion
 * - XSS-safe (tidak menggunakan innerHTML!)
 * - No external dependencies
 */

var Sanitizer = (function() {
    'use strict';
    
    // ============================================
    // HTML ENTITY MAP
    // ============================================
    var HTML_ENTITIES = {
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
    // DANGEROUS PATTERNS
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
    // ALLOWED MIME TYPES (SVG dihapus - XSS risk!)
    // ============================================
    var ALLOWED_MIME_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'text/csv'
    ];
    
    // ============================================
    // STRING SANITIZATION
    // ============================================
    
    /**
     * Sanitize string value
     */
    function sanitizeString(value, options) {
        if (typeof value !== 'string') return '';
        if (!options) options = {};
        
        var result = value;
        
        // Trim
        if (options.trim !== false) {
            result = result.trim();
        }
        
        // Max length
        if (options.maxLength && result.length > options.maxLength) {
            result = result.substring(0, options.maxLength);
        }
        
        // Strip HTML (AMAN - tidak menggunakan innerHTML)
        if (options.stripHtml) {
            result = stripHtml(result);
        }
        
        // Escape HTML entities
        if (options.escapeHtml) {
            result = escapeHtml(result);
        }
        
        // Remove dangerous patterns
        if (options.removeDangerous !== false) {
            result = removeDangerousPatterns(result);
        }
        
        // Allowed characters only
        if (options.allowedChars) {
            var pattern = new RegExp('[^' + options.allowedChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + ']', 'g');
            result = result.replace(pattern, '');
        }
        
        // Custom pattern replace
        if (options.pattern && options.replacement !== undefined) {
            var regex = options.pattern instanceof RegExp ? options.pattern : new RegExp(options.pattern, 'g');
            result = result.replace(regex, options.replacement);
        }
        
        return result;
    }
    
    /**
     * Sanitize number value
     */
    function sanitizeNumber(value, options) {
        var num = Number(value);
        
        if (isNaN(num)) {
            return (options && options.defaultValue !== undefined) ? options.defaultValue : 0;
        }
        
        if (options) {
            if (options.min !== undefined && num < options.min) num = options.min;
            if (options.max !== undefined && num > options.max) num = options.max;
            if (options.integer) num = Math.floor(num);
            if (options.precision !== undefined) {
                num = parseFloat(num.toFixed(options.precision));
            }
        }
        
        return num;
    }
    
    /**
     * Sanitize boolean value
     */
    function sanitizeBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            var lower = value.toLowerCase().trim();
            return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
        }
        if (typeof value === 'number') return value !== 0;
        return !!value;
    }
    
    /**
     * Sanitize email
     */
    function sanitizeEmail(value) {
        if (typeof value !== 'string') return '';
        
        var email = value.trim().toLowerCase();
        email = email.replace(/[<>"'\s]/g, '');
        
        // Basic email validation
        var emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email) || email.length > 254) {
            return '';
        }
        
        return email;
    }
    
    /**
     * Sanitize URL
     */
    function sanitizeURL(value, options) {
        if (typeof value !== 'string') return '';
        
        var url = value.trim();
        
        // Block dangerous protocols
        if (/^(javascript|data|vbscript|file):/i.test(url)) {
            return '';
        }
        
        // Add protocol if missing
        if (options && options.addProtocol && !/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        
        // Validate
        try {
            var parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return '';
            }
            return parsed.toString();
        } catch(e) {
            return '';
        }
    }
    
    // ============================================
    // HTML SANITIZATION (XSS-SAFE)
    // ============================================
    
    /**
     * Escape HTML entities
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"'`\/=]/g, function(char) {
            return HTML_ENTITIES[char] || char;
        });
    }
    
    /**
     * Strip HTML tags (AMAN - tanpa innerHTML!)
     */
    function stripHtml(html) {
        if (typeof html !== 'string') return '';
        
        // Gunakan regex untuk menghapus tag HTML
        // Ini lebih aman daripada innerHTML karena tidak mengeksekusi script
        return html
            .replace(/<[^>]*>/g, '')           // Hapus semua tag HTML
            .replace(/&[^;]+;/g, '')            // Hapus HTML entities
            .replace(/\s+/g, ' ')               // Normalize whitespace
            .trim();
    }
    
    /**
     * Remove dangerous patterns
     */
    function removeDangerousPatterns(input) {
        if (typeof input !== 'string') return '';
        
        var result = input;
        for (var i = 0; i < DANGEROUS_PATTERNS.length; i++) {
            result = result.replace(DANGEROUS_PATTERNS[i], '');
        }
        return result;
    }
    
    // ============================================
    // OBJECT SANITIZATION
    // ============================================
    
    /**
     * Sanitize object recursively
     */
    function sanitizeObject(obj, schema) {
        if (obj === null || obj === undefined) return obj;
        
        // Array
        if (Array.isArray(obj)) {
            var result = [];
            for (var i = 0; i < obj.length; i++) {
                result.push(sanitizeObject(obj[i], schema));
            }
            return result;
        }
        
        // Plain object
        if (typeof obj === 'object' && obj.constructor === Object) {
            var sanitized = {};
            
            var keys = Object.keys(obj);
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                var value = obj[key];
                
                // Sanitize key
                var safeKey = sanitizeString(key, {
                    allowedChars: 'a-zA-Z0-9_',
                    maxLength: 64
                });
                
                if (!safeKey) continue;
                
                // Apply schema
                if (schema && schema[key]) {
                    sanitized[safeKey] = sanitizeBySchema(value, schema[key]);
                } else {
                    sanitized[safeKey] = sanitizeValue(value);
                }
            }
            
            return sanitized;
        }
        
        // Primitive
        return sanitizeValue(obj);
    }
    
    /**
     * Sanitize by schema type
     */
    function sanitizeBySchema(value, schema) {
        if (!schema) return sanitizeValue(value);
        
        switch (schema.type) {
            case 'string':
                return sanitizeString(value, schema);
            case 'number':
                return sanitizeNumber(value, schema);
            case 'boolean':
                return sanitizeBoolean(value);
            case 'email':
                return sanitizeEmail(value);
            case 'url':
                return sanitizeURL(value, schema);
            case 'array':
                if (!Array.isArray(value)) return [];
                var items = schema.items || {};
                var result = [];
                for (var i = 0; i < value.length; i++) {
                    result.push(sanitizeBySchema(value[i], items));
                }
                return result;
            case 'object':
                return sanitizeObject(value, schema.properties || {});
            default:
                return sanitizeValue(value);
        }
    }
    
    /**
     * Sanitize any value based on type
     */
    function sanitizeValue(value) {
        if (value === null || value === undefined) return value;
        
        var type = typeof value;
        
        switch (type) {
            case 'string':
                return sanitizeString(value, { escapeHtml: true, removeDangerous: true });
            case 'number':
                return sanitizeNumber(value);
            case 'boolean':
                return value;
            case 'object':
                return sanitizeObject(value);
            default:
                return String(value);
        }
    }
    
    // ============================================
    // FILE SANITIZATION
    // ============================================
    
    /**
     * Sanitize filename (cegah path traversal)
     */
    function sanitizeFilename(filename) {
        if (typeof filename !== 'string') return 'file';
        
        // Remove path
        var name = filename.replace(/^.*[\\/]/, '');
        
        // Remove null bytes
        name = name.replace(/\x00/g, '');
        
        // Remove special characters
        name = name.replace(/[^a-zA-Z0-9._\- ]/g, '');
        
        // Replace spaces
        name = name.replace(/\s+/g, '_');
        
        // Remove leading dots (hidden files)
        name = name.replace(/^\.+/, '');
        
        // Limit length
        if (name.length > 200) {
            var extIndex = name.lastIndexOf('.');
            if (extIndex > 0 && extIndex < name.length - 1) {
                var ext = name.substring(extIndex);
                name = name.substring(0, 195 - ext.length) + ext;
            } else {
                name = name.substring(0, 200);
            }
        }
        
        return name || 'untitled';
    }
    
    /**
     * Validate MIME type
     */
    function sanitizeMimeType(mimeType) {
        if (!mimeType) return 'application/octet-stream';
        
        var normalized = mimeType.toLowerCase().trim();
        
        // Check allowed types
        for (var i = 0; i < ALLOWED_MIME_TYPES.length; i++) {
            if (ALLOWED_MIME_TYPES[i] === normalized) {
                return normalized;
            }
        }
        
        return 'application/octet-stream';
    }
    
    /**
     * Validate file object
     */
    function validateFile(file, allowedTypes) {
        if (!file || !(file instanceof File)) return false;
        
        var types = allowedTypes || ALLOWED_MIME_TYPES;
        
        // Check empty file
        if (file.size === 0) return false;
        
        // Check type
        for (var i = 0; i < types.length; i++) {
            if (types[i] === file.type || types[i] === '*/*') {
                return true;
            }
        }
        
        // Check extension fallback
        var ext = '.' + file.name.split('.').pop().toLowerCase();
        var extMap = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.txt': 'text/plain',
            '.csv': 'text/csv'
        };
        
        var expectedType = extMap[ext];
        if (expectedType) {
            for (var j = 0; j < types.length; j++) {
                if (types[j] === expectedType) return true;
            }
        }
        
        return false;
    }
    
    // ============================================
    // UTILITY
    // ============================================
    
    /**
     * Sanitize class name / ID
     */
    function sanitizeIdentifier(value, maxLength) {
        if (!maxLength) maxLength = 64;
        return String(value || '')
            .replace(/[^a-zA-Z0-9_\-]/g, '')
            .substring(0, maxLength);
    }
    
    /**
     * Sanitize path (cegah traversal)
     */
    function sanitizePath(path) {
        if (typeof path !== 'string') return '';
        
        return path
            .replace(/\.\./g, '')           // Remove parent references
            .replace(/\/+/g, '/')            // Normalize slashes
            .replace(/\\+/g, '/')            // Normalize backslashes
            .replace(/[^a-zA-Z0-9_\-\.\/]/g, '') // Remove special chars
            .substring(0, 256);
    }
    
    /**
     * Sanitize JSON string
     */
    function sanitizeJSON(jsonString) {
        if (typeof jsonString !== 'string') return null;
        
        try {
            // Batasi ukuran input
            if (jsonString.length > 1000000) { // 1MB
                return null;
            }
            
            var parsed = JSON.parse(jsonString);
            var sanitized = sanitizeObject(parsed);
            return JSON.stringify(sanitized);
        } catch(e) {
            return null;
        }
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // String sanitization
        string: sanitizeString,
        number: sanitizeNumber,
        boolean: sanitizeBoolean,
        email: sanitizeEmail,
        url: sanitizeURL,
        
        // HTML
        escapeHtml: escapeHtml,
        stripHtml: stripHtml,
        removeDangerous: removeDangerousPatterns,
        
        // Object
        object: sanitizeObject,
        value: sanitizeValue,
        
        // File
        filename: sanitizeFilename,
        mimeType: sanitizeMimeType,
        validateFile: validateFile,
        
        // Utility
        identifier: sanitizeIdentifier,
        path: sanitizePath,
        json: sanitizeJSON,
        
        /**
         * Clean data (generic)
         */
        clean: function(data, schema) {
            if (schema) {
                return sanitizeObject(data, schema);
            }
            return sanitizeValue(data);
        },
        
        /**
         * Check if value is clean
         */
        isClean: function(value) {
            var sanitized = sanitizeValue(value);
            return JSON.stringify(value) === JSON.stringify(sanitized);
        },
        
        /**
         * Get allowed MIME types
         */
        getAllowedMimeTypes: function() {
            return ALLOWED_MIME_TYPES.slice();
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// var clean = Sanitizer.string('<script>alert(1)</script>', { stripHtml: true });
// var email = Sanitizer.email('User@Example.com');
// var safe = Sanitizer.object(userInput, { name: { type: 'string', maxLength: 50 } });
// var filename = Sanitizer.filename('../../../etc/passwd');
// ============================================