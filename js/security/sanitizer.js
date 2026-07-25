// js/security/sanitizer.js - Advanced Input Sanitizer 2026
/**
 * E-Arsip Digital - Advanced Input Sanitizer
 * Version: 2026.1.0
 * Features: Multi-context sanitization, recursive object cleaning,
 *           type coercion, pattern-based filtering
 */

import { Logger } from '../logger.js';

class SecuritySanitizer {
    constructor() {
        this.logger = new Logger('Sanitizer');
        
        // HTML entity mapping
        this.htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        // Dangerous patterns
        this.dangerousPatterns = [
            /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
            /javascript\s*:/gi,
            /on\w+\s*=\s*["'][^"']*["']/gi,
            /<iframe\b[^>]*>/gi,
            /<object\b[^>]*>/gi,
            /<embed\b[^>]*>/gi,
            /expression\s*\(/gi,
            /eval\s*\(/gi,
            /document\.cookie/gi,
            /document\.write/gi,
            /\.innerHTML/gi
        ];
        
        // SQL injection patterns
        this.sqlPatterns = [
            /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\s/i,
            /(\s|^)(--|#|\/\*)/,
            /UNION\s+(ALL\s+)?SELECT/i,
            /information_schema/i,
            /('|")\s*(\s|OR|AND)\s*('|")\s*=\s*('|")/i
        ];
        
        // Allowed MIME types
        this.allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/svg+xml',
            'text/plain',
            'text/csv'
        ];
        
        this.initialized = true;
        this.logger.info('Sanitizer initialized');
    }
    
    // ============================================
    // STRING SANITIZATION
    // ============================================
    
    sanitizeString(value, options = {}) {
        if (typeof value !== 'string') return '';
        
        let result = value;
        
        // Trim
        if (options.trim !== false) {
            result = result.trim();
        }
        
        // Max length
        if (options.maxLength && result.length > options.maxLength) {
            result = result.substring(0, options.maxLength);
        }
        
        // Strip HTML
        if (options.stripHtml) {
            result = this.stripHtml(result);
        }
        
        // Escape HTML
        if (options.escapeHtml) {
            result = this.escapeHtml(result);
        }
        
        // Remove dangerous patterns
        if (options.removeDangerous !== false) {
            result = this.removeDangerousPatterns(result);
        }
        
        // SQL sanitization
        if (options.sanitizeSQL) {
            result = this.sanitizeSQLInput(result);
        }
        
        // Pattern filter
        if (options.pattern) {
            const pattern = options.pattern instanceof RegExp ? 
                options.pattern : new RegExp(options.pattern);
            result = result.replace(pattern, options.replacement || '');
        }
        
        // Allowed characters only
        if (options.allowedChars) {
            const allowedPattern = new RegExp(`[^${options.allowedChars}]`, 'g');
            result = result.replace(allowedPattern, '');
        }
        
        return result;
    }
    
    sanitizeNumber(value, options = {}) {
        const num = Number(value);
        
        if (isNaN(num)) return options.defaultValue || 0;
        
        let result = num;
        
        // Min/max
        if (options.min !== undefined && result < options.min) result = options.min;
        if (options.max !== undefined && result > options.max) result = options.max;
        
        // Integer only
        if (options.integer) result = Math.floor(result);
        
        // Precision
        if (options.precision !== undefined) {
            result = parseFloat(result.toFixed(options.precision));
        }
        
        return result;
    }
    
    sanitizeBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
        }
        if (typeof value === 'number') return value !== 0;
        return !!value;
    }
    
    sanitizeEmail(value) {
        if (typeof value !== 'string') return '';
        
        // Basic email sanitization
        let email = value.trim().toLowerCase();
        
        // Remove dangerous characters
        email = email.replace(/[<>"']/g, '');
        
        // Validate format
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) return '';
        
        return email;
    }
    
    sanitizeURL(value, options = {}) {
        if (typeof value !== 'string') return '';
        
        let url = value.trim();
        
        // Check for javascript: or data: URLs
        const dangerousProtocols = /^(javascript|data|vbscript):/i;
        if (dangerousProtocols.test(url)) return '';
        
        // Add protocol if missing
        if (!/^https?:\/\//i.test(url) && options.addProtocol) {
            url = 'https://' + url;
        }
        
        // Validate URL format
        try {
            const parsed = new URL(url);
            
            // Only allow http and https
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return '';
            }
            
            return parsed.toString();
        } catch {
            return '';
        }
    }
    
    sanitizeDate(value) {
        if (!value) return null;
        
        const date = new Date(value);
        
        if (isNaN(date.getTime())) return null;
        
        return date;
    }
    
    // ============================================
    // OBJECT SANITIZATION
    // ============================================
    
    sanitizeObject(obj, schema = null) {
        if (obj === null || obj === undefined) return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, schema));
        }
        
        if (typeof obj === 'object' && obj.constructor === Object) {
            const sanitized = {};
            
            for (const [key, value] of Object.entries(obj)) {
                // Sanitize key
                const safeKey = this.sanitizeString(key, { 
                    allowedChars: 'a-zA-Z0-9_', 
                    maxLength: 64 
                });
                
                if (!safeKey) continue;
                
                // Apply schema if provided
                if (schema && schema[key]) {
                    sanitized[safeKey] = this.sanitizeBySchema(value, schema[key]);
                } else {
                    sanitized[safeKey] = this.sanitizeValue(value);
                }
            }
            
            return sanitized;
        }
        
        return this.sanitizeValue(obj);
    }
    
    sanitizeBySchema(value, schema) {
        switch (schema.type) {
            case 'string':
                return this.sanitizeString(value, schema);
            case 'number':
                return this.sanitizeNumber(value, schema);
            case 'boolean':
                return this.sanitizeBoolean(value);
            case 'email':
                return this.sanitizeEmail(value);
            case 'url':
                return this.sanitizeURL(value, schema);
            case 'date':
                return this.sanitizeDate(value);
            case 'array':
                if (!Array.isArray(value)) return [];
                return value.map(item => this.sanitizeBySchema(item, schema.items || {}));
            case 'object':
                return this.sanitizeObject(value, schema.properties || {});
            default:
                return this.sanitizeValue(value);
        }
    }
    
    sanitizeValue(value) {
        if (value === null || value === undefined) return value;
        
        switch (typeof value) {
            case 'string':
                return this.sanitizeString(value, { 
                    escapeHtml: true, 
                    removeDangerous: true 
                });
            case 'number':
                return this.sanitizeNumber(value);
            case 'boolean':
                return value;
            case 'object':
                return this.sanitizeObject(value);
            default:
                return String(value);
        }
    }
    
    // ============================================
    // HTML SANITIZATION
    // ============================================
    
    escapeHtml(str) {
        return String(str).replace(/[&<>"'`\/=]/g, char => 
            this.htmlEntities[char] || char
        );
    }
    
    stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
    
    removeDangerousPatterns(input) {
        let result = input;
        
        for (const pattern of this.dangerousPatterns) {
            result = result.replace(pattern, '');
        }
        
        return result;
    }
    
    // ============================================
    // SQL SANITIZATION
    // ============================================
    
    sanitizeSQLInput(value) {
        if (typeof value !== 'string') return value;
        
        let result = value;
        
        // Escape SQL special characters
        result = result
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/"/g, '\\"')
            .replace(/\x00/g, '\\0')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\x1a/g, '\\Z');
        
        // Remove SQL injection patterns
        for (const pattern of this.sqlPatterns) {
            result = result.replace(pattern, '');
        }
        
        return result;
    }
    
    // ============================================
    // FILE SANITIZATION
    // ============================================
    
    sanitizeFilename(filename) {
        if (typeof filename !== 'string') return 'file';
        
        // Remove path information
        let name = filename.replace(/^.*[\\/]/, '');
        
        // Remove special characters
        name = name.replace(/[^\w\s.-]/g, '');
        
        // Replace spaces
        name = name.replace(/\s+/g, '_');
        
        // Limit length
        if (name.length > 255) {
            const ext = name.lastIndexOf('.');
            if (ext > 0) {
                name = name.substring(0, 250 - (name.length - ext)) + name.substring(ext);
            } else {
                name = name.substring(0, 255);
            }
        }
        
        return name || 'file';
    }
    
    sanitizeMimeType(mimeType) {
        if (!mimeType) return 'application/octet-stream';
        
        const normalized = mimeType.toLowerCase().trim();
        
        if (this.allowedMimeTypes.includes(normalized)) {
            return normalized;
        }
        
        return 'application/octet-stream';
    }
    
    validateFileType(file, allowedTypes = null) {
        const types = allowedTypes || this.allowedMimeTypes;
        
        if (file instanceof File) {
            return types.includes(file.type) || 
                   types.includes('*/*');
        }
        
        return false;
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    sanitizeClassName(className) {
        return String(className).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
    }
    
    sanitizeID(id) {
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
    }
    
    sanitizePath(path) {
        // Remove path traversal attempts
        let sanitized = String(path)
            .replace(/\.\./g, '')
            .replace(/\/\//g, '/')
            .replace(/\\\\/g, '\\')
            .substring(0, 256);
        
        return sanitized;
    }
    
    sanitizeJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            const sanitized = this.sanitizeObject(parsed);
            return JSON.stringify(sanitized);
        } catch {
            return null;
        }
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    clean(data, schema = null) {
        if (schema) {
            return this.sanitizeObject(data, schema);
        }
        
        return this.sanitizeValue(data);
    }
    
    isClean(value) {
        const sanitized = this.sanitizeValue(value);
        return JSON.stringify(value) === JSON.stringify(sanitized);
    }
    
    destroy() {
        this.logger.info('Sanitizer destroyed');
    }
}

// Create singleton
const sanitizer = new SecuritySanitizer();

export default sanitizer;
export { SecuritySanitizer };
