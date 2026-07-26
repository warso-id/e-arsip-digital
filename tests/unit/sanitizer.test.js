// tests/unit/sanitizer.test.js - Enterprise Sanitizer Unit Tests 2026
/**
 * E-Arsip Digital - Comprehensive Sanitizer Unit Test Suite
 * Version: 2026.1.0
 * Tests: String sanitization, HTML sanitization, filename sanitization,
 *        email/phone sanitization, form data validation, object sanitization,
 *        XSS prevention, SQL injection prevention, path traversal prevention
 * Framework: Jest with complete mock implementation
 */

import { describe, it, beforeEach, expect } from '@jest/globals';

// ============================================
// COMPLETE MOCK ADVANCED SANITIZER
// ============================================

class AdvancedSanitizer {
    constructor() {
        this.allowedHTMLTags = ['p', 'b', 'i', 'em', 'strong', 'br', 'hr', 'ul', 'ol', 'li',
                               'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div'];
        this.blockedPatterns = [
            /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
            /<iframe[\s\S]*?>/gi,
            /<embed[\s\S]*?>/gi,
            /<object[\s\S]*?>/gi,
            /<applet[\s\S]*?>/gi,
            /<meta[\s\S]*?>/gi,
            /<link[\s\S]*?>/gi
        ];
        this.eventHandlerPattern = /\bon\w+\s*=\s*["'][^"']*["']/gi;
        this.javascriptPattern = /javascript\s*:/gi;
        this.nullBytePattern = /\x00/g;
        this.controlCharPattern = /[\x00-\x1f\x7f-\x9f]/g;
    }

    sanitizeString(input) {
        if (!input || typeof input !== 'string') return '';

        let sanitized = input;

        // Remove script tags
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove event handlers
        sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
        sanitized = sanitized.replace(/\bon\w+\s*=\s*[^\s>]+/gi, '');
        
        // Remove javascript: URIs
        sanitized = sanitized.replace(/javascript\s*:/gi, '');
        
        // Remove dangerous protocols
        sanitized = sanitized.replace(/vbscript\s*:/gi, '');
        sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '');
        
        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        
        // Remove any remaining HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        
        // Remove zero-width characters
        sanitized = sanitized.replace(/[\u200b-\u200f\ufeff]/g, '');

        // Normalize unicode (NFC normalization)
        sanitized = sanitized.normalize('NFC');

        return sanitized.trim();
    }

    sanitizeHTML(html) {
        if (!html) return '';

        // Remove dangerous elements
        for (const pattern of this.blockedPatterns) {
            html = html.replace(pattern, '');
        }

        // Remove event handlers from all tags
        html = html.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\bon\w+\s*=\s*[^\s>]+/gi, '');

        // Remove javascript: from href/src
        html = html.replace(/(href|src|action)\s*=\s*["']\s*javascript\s*:[^"']*["']/gi, '$1="#"');

        // Remove style attributes with dangerous content
        html = html.replace(/style\s*=\s*["'][^"']*(?:expression|javascript|behavior|url\s*\()/gi, '');

        return html;
    }

    sanitizeFilename(filename) {
        if (!filename) return '';

        let sanitized = filename;

        // Remove path separators
        sanitized = sanitized.replace(/[\/\\]/g, '_');
        
        // Remove path traversal
        sanitized = sanitized.replace(/\.\./g, '_');
        
        // Remove null bytes
        sanitized = sanitized.replace(/\x00/g, '');
        
        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        
        // Remove characters not allowed in filenames
        sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
        
        // Remove leading dots and spaces
        sanitized = sanitized.replace(/^[.\s]+/, '');
        
        // Limit length
        if (sanitized.length > 255) {
            const ext = sanitized.lastIndexOf('.');
            if (ext > 0) {
                const namePart = sanitized.substring(0, ext);
                const extPart = sanitized.substring(ext);
                sanitized = namePart.substring(0, 245) + extPart;
            } else {
                sanitized = sanitized.substring(0, 255);
            }
        }

        return sanitized || 'unnamed';
    }

    sanitizeEmail(email) {
        if (!email || typeof email !== 'string') return '';

        // Remove HTML/scripts
        let sanitized = email.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

        // Basic email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        if (!emailRegex.test(sanitized)) return '';

        // Lowercase
        return sanitized.toLowerCase().trim();
    }

    sanitizePhone(phone) {
        if (!phone) return '';

        // Remove scripts and HTML
        let sanitized = String(phone).replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        
        // Keep only valid phone characters: digits, +, -, space, ()
        sanitized = sanitized.replace(/[^\d+\-()\s]/g, '');

        return sanitized.trim();
    }

    sanitizeObject(obj, depth = 0) {
        if (depth > 20) return obj;
        if (obj === null || obj === undefined) return obj;

        if (typeof obj === 'string') return this.sanitizeString(obj);

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, depth + 1));
        }

        if (typeof obj === 'object' && obj.constructor === Object) {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                // Prevent prototype pollution
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
                const safeKey = this.sanitizeString(key);
                sanitized[safeKey] = this.sanitizeObject(value, depth + 1);
            }
            return sanitized;
        }

        return obj;
    }

    sanitizeFormData(formData, rules = {}) {
        const result = {
            valid: true,
            data: {},
            errors: null
        };

        const fieldErrors = {};

        for (const [field, rule] of Object.entries(rules)) {
            let value = formData[field];

            // Check required
            if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
                fieldErrors[field] = rule.message || `${field} wajib diisi`;
                result.valid = false;
                continue;
            }

            // Skip empty optional fields
            if (!value && !rule.required) {
                result.data[field] = value;
                continue;
            }

            // Type-based sanitization
            switch (rule.type) {
                case 'string':
                    value = this.sanitizeString(String(value));
                    if (rule.maxLength && value.length > rule.maxLength) {
                        value = value.substring(0, rule.maxLength);
                    }
                    break;

                case 'email':
                    value = this.sanitizeEmail(String(value));
                    if (!value && rule.required) {
                        fieldErrors[field] = rule.message || 'Format email tidak valid';
                        result.valid = false;
                    }
                    break;

                case 'phone':
                    value = this.sanitizePhone(String(value));
                    break;

                case 'number':
                    value = Number(value);
                    if (isNaN(value)) {
                        fieldErrors[field] = rule.message || 'Harus berupa angka';
                        result.valid = false;
                    }
                    break;

                case 'boolean':
                    value = Boolean(value);
                    break;

                default:
                    value = this.sanitizeString(String(value));
            }

            result.data[field] = value;
        }

        if (!result.valid) {
            result.errors = fieldErrors;
        }

        return result;
    }

    sanitizeSQL(input) {
        if (!input) return '';
        
        let sanitized = String(input);
        
        // Escape single quotes
        sanitized = sanitized.replace(/'/g, "''");
        
        // Remove SQL comments
        sanitized = sanitized.replace(/--[^\n\r]*/g, '');
        sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove common SQL keywords (for display only, use parameterized queries)
        const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'UNION'];
        for (const keyword of dangerousKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            sanitized = sanitized.replace(regex, '');
        }
        
        return sanitized.trim();
    }
}

// ============================================
// TEST SETUP
// ============================================

let sanitizer;

beforeEach(() => {
    sanitizer = new AdvancedSanitizer();
});

// ============================================
// STRING SANITIZATION TESTS
// ============================================

describe('String Sanitization', () => {
    it('Should remove script tags and content', () => {
        const input = '<script>alert("XSS")</script>Hello';
        const result = sanitizer.sanitizeString(input);

        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
        expect(result).toContain('Hello');
    });

    it('Should remove event handlers (onerror, onclick, onload)', () => {
        const inputs = [
            '<img onerror="alert(1)" src=x>',
            '<div onclick="stealCookies()">Click</div>',
            '<body onload="malicious()">'
        ];

        for (const input of inputs) {
            const result = sanitizer.sanitizeString(input);
            expect(result).not.toMatch(/on\w+=/i);
        }
    });

    it('Should remove javascript: URIs', () => {
        const inputs = [
            '<a href="javascript:alert(1)">Click</a>',
            'javascript:void(0)',
            'JAVASCRIPT:alert(1)'
        ];

        for (const input of inputs) {
            const result = sanitizer.sanitizeString(input);
            expect(result.toLowerCase()).not.toContain('javascript:');
        }
    });

    it('Should remove null bytes', () => {
        const input = 'test\x00data\x00end';
        const result = sanitizer.sanitizeString(input);

        expect(result).not.toContain('\x00');
        expect(result).toBe('testdataend');
    });

    it('Should remove control characters', () => {
        const input = 'test\x01\x02\x1fend';
        const result = sanitizer.sanitizeString(input);

        expect(result).not.toMatch(/[\x00-\x1f]/);
        expect(result).toBe('testend');
    });

    it('Should normalize unicode (NFC)', () => {
        const input = 'e\u0301'; // e + combining acute accent
        const result = sanitizer.sanitizeString(input);

        expect(result).toBe('\u00e9'); // Normalized to é
        expect(result.length).toBe(1);
    });

    it('Should handle empty input', () => {
        expect(sanitizer.sanitizeString('')).toBe('');
        expect(sanitizer.sanitizeString(null)).toBe('');
        expect(sanitizer.sanitizeString(undefined)).toBe('');
    });

    it('Should handle non-string input', () => {
        expect(sanitizer.sanitizeString(12345)).toBe('');
        expect(sanitizer.sanitizeString({})).toBe('');
    });

    it('Should remove zero-width characters', () => {
        const input = 'test\u200b\u200cdata';
        const result = sanitizer.sanitizeString(input);

        expect(result).toBe('testdata');
    });

    it('Should remove data: URIs', () => {
        const input = 'data:text/html,<script>alert(1)</script>';
        const result = sanitizer.sanitizeString(input);

        expect(result).not.toContain('data:text/html');
    });

    it('Should remove vbscript: URIs', () => {
        const input = 'vbscript:msgbox("XSS")';
        const result = sanitizer.sanitizeString(input);

        expect(result).not.toContain('vbscript:');
    });
});

// ============================================
// HTML SANITIZATION TESTS
// ============================================

describe('HTML Sanitization', () => {
    it('Should keep allowed HTML tags', () => {
        const html = '<p>Safe paragraph</p><b>Bold text</b><i>Italic</i><br><hr>';
        const result = sanitizer.sanitizeHTML(html);

        expect(result).toContain('<p>');
        expect(result).toContain('<b>');
        expect(result).toContain('<i>');
    });

    it('Should remove script tags from HTML', () => {
        const html = '<p>Safe</p><script>alert(1)</script><div>More</div>';
        const result = sanitizer.sanitizeHTML(html);

        expect(result).toContain('<p>');
        expect(result).toContain('<div>');
        expect(result).not.toContain('<script>');
    });

    it('Should remove event handlers from HTML', () => {
        const html = '<img onerror="alert(1)" src=x><a onclick="bad()">Click</a>';
        const result = sanitizer.sanitizeHTML(html);

        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onclick');
    });

    it('Should remove javascript: from href attributes', () => {
        const html = '<a href="javascript:alert(1)">Click</a>';
        const result = sanitizer.sanitizeHTML(html);

        expect(result).not.toContain('javascript:');
    });

    it('Should remove dangerous style attributes', () => {
        const html = '<div style="background: url(javascript:alert(1))">Test</div>';
        const result = sanitizer.sanitizeHTML(html);

        expect(result).not.toContain('javascript:');
    });

    it('Should remove iframe/embed/object tags', () => {
        const inputs = [
            '<iframe src="evil.com"></iframe>',
            '<embed src="evil.swf">',
            '<object data="evil.pdf"></object>'
        ];

        for (const input of inputs) {
            const result = sanitizer.sanitizeHTML(input);
            expect(result).not.toMatch(/<(iframe|embed|object)/i);
        }
    });

    it('Should remove meta and link tags', () => {
        const html = '<meta http-equiv="refresh" content="0;url=evil.com"><link rel="import" href="evil.html">';
        const result = sanitizer.sanitizeHTML(html);

        expect(result).not.toContain('<meta');
        expect(result).not.toContain('<link');
    });

    it('Should handle empty HTML', () => {
        expect(sanitizer.sanitizeHTML('')).toBe('');
        expect(sanitizer.sanitizeHTML(null)).toBe('');
    });
});

// ============================================
// FILENAME SANITIZATION TESTS
// ============================================

describe('Filename Sanitization', () => {
    it('Should keep simple filenames', () => {
        expect(sanitizer.sanitizeFilename('test.txt')).toBe('test.txt');
        expect(sanitizer.sanitizeFilename('document.pdf')).toBe('document.pdf');
        expect(sanitizer.sanitizeFilename('image_001.jpg')).toBe('image_001.jpg');
    });

    it('Should remove path separators', () => {
        expect(sanitizer.sanitizeFilename('/etc/passwd')).toBe('_etc_passwd');
        expect(sanitizer.sanitizeFilename('folder/file.txt')).toBe('folder_file.txt');
        expect(sanitizer.sanitizeFilename('C:\\Windows\\file.exe')).toBe('C__Windows_file.exe');
    });

    it('Should remove path traversal attempts', () => {
        expect(sanitizer.sanitizeFilename('../evil.txt')).toBe('__evil.txt');
        expect(sanitizer.sanitizeFilename('....//....//etc/passwd')).toBe('______//______//etc/passwd');
        expect(sanitizer.sanitizeFilename('..\\..\\windows')).toBe('__\\__\\windows');
    });

    it('Should remove script tags', () => {
        expect(sanitizer.sanitizeFilename('file<script>.txt')).toBe('file_script_.txt');
        expect(sanitizer.sanitizeFilename('<img src=x>.jpg')).toBe('_img src=x_.jpg');
    });

    it('Should remove control characters', () => {
        expect(sanitizer.sanitizeFilename('test\x00file.txt')).toBe('testfile.txt');
        expect(sanitizer.sanitizeFilename('test\x01\x02.txt')).toBe('test.txt');
    });

    it('Should remove illegal filename characters', () => {
        expect(sanitizer.sanitizeFilename('file:name.txt')).toBe('file_name.txt');
        expect(sanitizer.sanitizeFilename('file"name.txt')).toBe('file_name.txt');
        expect(sanitizer.sanitizeFilename('file|name.txt')).toBe('file_name.txt');
        expect(sanitizer.sanitizeFilename('file?name.txt')).toBe('file_name.txt');
        expect(sanitizer.sanitizeFilename('file*name.txt')).toBe('file_name.txt');
    });

    it('Should remove leading dots and spaces', () => {
        expect(sanitizer.sanitizeFilename('.hidden')).toBe('hidden');
        expect(sanitizer.sanitizeFilename('...test.txt')).toBe('test.txt');
        expect(sanitizer.sanitizeFilename('   spaces.txt')).toBe('spaces.txt');
    });

    it('Should handle long filenames', () => {
        const longName = 'A'.repeat(300) + '.pdf';
        const result = sanitizer.sanitizeFilename(longName);
        expect(result.length).toBeLessThanOrEqual(255);
        expect(result.endsWith('.pdf')).toBe(true);
    });

    it('Should return "unnamed" for empty input', () => {
        expect(sanitizer.sanitizeFilename('')).toBe('unnamed');
        expect(sanitizer.sanitizeFilename(null)).toBe('unnamed');
    });
});

// ============================================
// EMAIL SANITIZATION TESTS
// ============================================

describe('Email Sanitization', () => {
    it('Should lowercase emails', () => {
        expect(sanitizer.sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
        expect(sanitizer.sanitizeEmail('USER@DOMAIN.COM')).toBe('user@domain.com');
    });

    it('Should reject XSS in emails', () => {
        expect(sanitizer.sanitizeEmail('<script>@test.com')).toBe('');
        expect(sanitizer.sanitizeEmail('test@test.com<script>')).toBe('');
        expect(sanitizer.sanitizeEmail('"onclick=alert(1)"@test.com')).toBe('');
    });

    it('Should reject invalid emails', () => {
        expect(sanitizer.sanitizeEmail('invalid')).toBe('');
        expect(sanitizer.sanitizeEmail('@domain.com')).toBe('');
        expect(sanitizer.sanitizeEmail('user@')).toBe('');
        expect(sanitizer.sanitizeEmail('')).toBe('');
        expect(sanitizer.sanitizeEmail(null)).toBe('');
    });

    it('Should accept valid emails', () => {
        expect(sanitizer.sanitizeEmail('user@example.com')).toBe('user@example.com');
        expect(sanitizer.sanitizeEmail('test.user@domain.co.id')).toBe('test.user@domain.co.id');
        expect(sanitizer.sanitizeEmail('name+tag@test.org')).toBe('name+tag@test.org');
    });

    it('Should remove control characters from email', () => {
        expect(sanitizer.sanitizeEmail('test\x01@test.com')).toBe('');
        expect(sanitizer.sanitizeEmail('test@test\x02.com')).toBe('');
    });
});

// ============================================
// PHONE SANITIZATION TESTS
// ============================================

describe('Phone Sanitization', () => {
    it('Should keep valid phone formats', () => {
        expect(sanitizer.sanitizePhone('0812-3456-7890')).toBe('0812-3456-7890');
        expect(sanitizer.sanitizePhone('+6281234567890')).toBe('+6281234567890');
        expect(sanitizer.sanitizePhone('(021) 12345678')).toBe('(021) 12345678');
    });

    it('Should remove XSS from phone numbers', () => {
        expect(sanitizer.sanitizePhone('0812<script>3456')).toBe('0812script3456');
        expect(sanitizer.sanitizePhone('<img src=x>0812')).toBe('img src=x0812');
    });

    it('Should remove non-phone characters', () => {
        expect(sanitizer.sanitizePhone('0812abc3456')).toBe('08123456');
        expect(sanitizer.sanitizePhone('0812!@#3456')).toBe('08123456');
    });

    it('Should handle empty phone', () => {
        expect(sanitizer.sanitizePhone('')).toBe('');
        expect(sanitizer.sanitizePhone(null)).toBe('');
    });

    it('Should remove control characters', () => {
        expect(sanitizer.sanitizePhone('0812\x003456')).toBe('08123456');
    });
});

// ============================================
// OBJECT SANITIZATION TESTS
// ============================================

describe('Object Sanitization', () => {
    it('Should sanitize nested objects recursively', () => {
        const input = {
            name: '<script>alert(1)</script>John',
            email: 'TEST@EXAMPLE.COM',
            nested: {
                value: 'javascript:void(0)',
                array: ['<img onerror=alert(1)>', 'safe']
            }
        };

        const result = sanitizer.sanitizeObject(input);

        expect(result.name).not.toContain('<script>');
        expect(result.email).not.toBe('TEST@EXAMPLE.COM'); // HTML tags removed
        expect(result.nested.value).not.toContain('javascript:');
        expect(result.nested.array[0]).not.toContain('onerror');
        expect(result.nested.array[1]).toBe('safe');
    });

    it('Should prevent prototype pollution', () => {
        const input = {
            name: 'Test',
            __proto__: { isAdmin: true },
            constructor: { prototype: { isAdmin: true } }
        };

        const result = sanitizer.sanitizeObject(input);

        expect(result.__proto__).toBeUndefined();
        expect(result.constructor).toBeUndefined();
        expect(result.name).toBe('Test');
    });

    it('Should handle deep nesting', () => {
        const createDeep = (depth) => {
            if (depth <= 0) return { value: '<script>leaf</script>' };
            return { child: createDeep(depth - 1) };
        };

        const input = createDeep(25);

        expect(() => sanitizer.sanitizeObject(input)).not.toThrow();
    });

    it('Should handle null/undefined values', () => {
        expect(sanitizer.sanitizeObject(null)).toBeNull();
        expect(sanitizer.sanitizeObject(undefined)).toBeUndefined();
    });

    it('Should handle primitives', () => {
        expect(sanitizer.sanitizeObject(123)).toBe(123);
        expect(sanitizer.sanitizeObject(true)).toBe(true);
    });
});

// ============================================
// FORM DATA VALIDATION TESTS
// ============================================

describe('Form Data Validation', () => {
    const validFormData = {
        name: '<b>John</b>',
        email: 'TEST@EXAMPLE.COM',
        phone: '0812<script>3456',
        age: '25'
    };

    const rules = {
        name: { type: 'string', required: true, maxLength: 50 },
        email: { type: 'email', required: true },
        phone: { type: 'phone', required: false },
        age: { type: 'number', required: true, message: 'Umur wajib diisi' }
    };

    it('Should sanitize valid form data', () => {
        const result = sanitizer.sanitizeFormData(validFormData, rules);

        expect(result.valid).toBe(true);
        expect(result.data.name).not.toContain('<b>');
        expect(result.data.phone).not.toContain('<script>');
        expect(result.data.age).toBe(25);
        expect(result.errors).toBeNull();
    });

    it('Should detect missing required fields', () => {
        const formData = { name: '' };
        const result = sanitizer.sanitizeFormData(formData, rules);

        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors.name).toBeDefined();
    });

    it('Should use custom error messages', () => {
        const formData = { name: 'Test', age: '' };
        const result = sanitizer.sanitizeFormData(formData, rules);

        expect(result.valid).toBe(false);
        expect(result.errors.age).toBe('Umur wajib diisi');
    });

    it('Should handle invalid email format', () => {
        const formData = { name: 'Test', email: 'invalid-email', age: '25' };
        const result = sanitizer.sanitizeFormData(formData, rules);

        expect(result.valid).toBe(false);
        expect(result.errors.email).toBeDefined();
    });

    it('Should handle invalid number format', () => {
        const formData = { name: 'Test', email: 'test@test.com', age: 'abc' };
        const result = sanitizer.sanitizeFormData(formData, rules);

        expect(result.valid).toBe(false);
        expect(result.errors.age).toBeDefined();
    });

    it('Should truncate long strings', () => {
        const formData = { name: 'A'.repeat(100), email: 'test@test.com', age: '25' };
        const result = sanitizer.sanitizeFormData(formData, rules);

        expect(result.valid).toBe(true);
        expect(result.data.name.length).toBeLessThanOrEqual(50);
    });

    it('Should handle boolean type', () => {
        const boolRules = {
            agree: { type: 'boolean', required: true }
        };

        expect(sanitizer.sanitizeFormData({ agree: true }, boolRules).data.agree).toBe(true);
        expect(sanitizer.sanitizeFormData({ agree: false }, boolRules).data.agree).toBe(false);
        expect(sanitizer.sanitizeFormData({ agree: 'truthy' }, boolRules).data.agree).toBe(true);
    });
});

// ============================================
// SQL SANITIZATION TESTS
// ============================================

describe('SQL Sanitization', () => {
    it('Should escape single quotes', () => {
        expect(sanitizer.sanitizeSQL("O'Brien")).toBe("O''Brien");
        expect(sanitizer.sanitizeSQL("test'value")).toBe("test''value");
    });

    it('Should remove SQL comments', () => {
        expect(sanitizer.sanitizeSQL('test--comment')).toBe('test');
        expect(sanitizer.sanitizeSQL('data/*block*/more')).toBe('datamore');
    });

    it('Should remove dangerous SQL keywords', () => {
        expect(sanitizer.sanitizeSQL('DROP TABLE users')).not.toContain('DROP');
        expect(sanitizer.sanitizeSQL('DELETE FROM users')).not.toContain('DELETE');
        expect(sanitizer.sanitizeSQL('INSERT INTO users')).not.toContain('INSERT');
        expect(sanitizer.sanitizeSQL('UPDATE users SET')).not.toContain('UPDATE');
    });

    it('Should handle empty input', () => {
        expect(sanitizer.sanitizeSQL('')).toBe('');
        expect(sanitizer.sanitizeSQL(null)).toBe('');
    });
});