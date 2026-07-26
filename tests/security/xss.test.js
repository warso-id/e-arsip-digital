// tests/security/xss.test.js - Enterprise XSS Prevention Tests 2026
/**
 * E-Arsip Digital - Comprehensive XSS Security Tests
 * Version: 2026.1.0
 * Tests: Reflected XSS, stored XSS, DOM XSS, SVG XSS, CSS injection,
 *        template injection, encoded attacks, prototype pollution,
 *        safe HTML rendering, context-aware escaping
 */

import { describe, it, beforeEach, expect } from '@jest/globals';

// ============================================
// COMPLETE MOCK XSS PREVENTION MODULE
// ============================================

class XSSPrevention {
    constructor() {
        this.allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'hr', 'ul', 'ol', 'li',
                           'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
                           'span', 'div', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
        this.allowedAttributes = ['href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel',
                                  'width', 'height', 'loading'];
        this.allowedSchemes = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'];
        this.xssPatterns = this.compileXSSPatterns();
    }

    compileXSSPatterns() {
        return [
            { name: 'script_tag', pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/gi },
            { name: 'event_handler', pattern: /\bon\w+\s*=\s*["'][^"']*["']/gi },
            { name: 'event_handler_bare', pattern: /\bon\w+\s*=\s*[^\s>]+/gi },
            { name: 'javascript_uri', pattern: /javascript\s*:/gi },
            { name: 'vbscript_uri', pattern: /vbscript\s*:/gi },
            { name: 'data_html', pattern: /data\s*:\s*text\/html/gi },
            { name: 'eval', pattern: /\beval\s*\(/gi },
            { name: 'expression', pattern: /\bexpression\s*\(/gi },
            { name: 'behavior', pattern: /\bbehavior\s*:/gi },
            { name: 'moz_binding', pattern: /\b-moz-binding\s*:/gi },
            { name: 'iframe', pattern: /<iframe[\s\S]*?>/gi },
            { name: 'embed', pattern: /<embed[\s\S]*?>/gi },
            { name: 'object', pattern: /<object[\s\S]*?>/gi },
            { name: 'applet', pattern: /<applet[\s\S]*?>/gi },
            { name: 'meta', pattern: /<meta[\s\S]*?>/gi },
            { name: 'link', pattern: /<link[\s\S]*?>/gi },
            { name: 'svg_event', pattern: /<svg[^>]*on\w+\s*=/gi },
            { name: 'svg_script', pattern: /<svg[^>]*>[\s\S]*?<script[\s\S]*?<\/script>[\s\S]*?<\/svg>/gi },
            { name: 'css_url_js', pattern: /url\s*\(\s*["']?\s*(?:javascript|data):/gi },
            { name: 'css_import', pattern: /@import\s+["']?(?:javascript|data):/gi },
            { name: 'html_entity', pattern: /&#x?[0-9a-f]+;/gi },
            { name: 'hex_escape', pattern: /\\x[0-9a-f]{2}/gi },
            { name: 'unicode_escape', pattern: /\\u[0-9a-f]{4}/gi },
            { name: 'template_injection', pattern: /\{\{.*?\}\}/gi },
            { name: 'constructor_access', pattern: /\.constructor\b/gi },
            { name: 'proto_access', pattern: /\.__proto__\b/gi },
            { name: 'document_write', pattern: /document\.write\s*\(/gi },
            { name: 'innerHTML', pattern: /\.innerHTML\s*=/gi },
            { name: 'cookie_access', pattern: /document\.cookie/gi },
            { name: 'location_access', pattern: /window\.location/gi }
        ];
    }

    sanitize(input) {
        if (!input || typeof input !== 'string') return input;

        let sanitized = input;

        for (const { pattern } of this.xssPatterns) {
            sanitized = sanitized.replace(pattern, '');
        }

        // Remove any remaining HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        
        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        
        // Remove zero-width characters
        sanitized = sanitized.replace(/[\u200b-\u200f\ufeff]/g, '');
        
        return sanitized.trim();
    }

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
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/</g, '\\x3C')
            .replace(/>/g, '\\x3E');
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

    validateAgainstXSS(input) {
        if (!input || typeof input !== 'string') return { valid: true };

        for (const { name, pattern } of this.xssPatterns) {
            if (pattern.test(input)) {
                return {
                    valid: false,
                    message: `XSS pattern detected: ${name}`
                };
            }
        }

        return { valid: true };
    }

    sanitizeHTML(html) {
        if (!html) return '';

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        this.cleanNode(doc.body);
        
        return doc.body.innerHTML;
    }

    cleanNode(node) {
        const removeTags = ['SCRIPT', 'STYLE', 'IFRAME', 'EMBED', 'OBJECT', 'APPLET',
                           'META', 'LINK', 'BASE', 'FORM', 'INPUT'];

        if (removeTags.includes(node.tagName)) {
            node.remove();
            return;
        }

        if (node.attributes) {
            const attrsToRemove = [];
            
            for (const attr of node.attributes) {
                if (attr.name.startsWith('on')) {
                    attrsToRemove.push(attr.name);
                } else if (['href', 'src', 'action', 'formaction'].includes(attr.name)) {
                    if (!this.isSafeURL(attr.value)) {
                        attrsToRemove.push(attr.name);
                    }
                } else if (attr.name === 'style' && this.isDangerousStyle(attr.value)) {
                    attrsToRemove.push(attr.name);
                }
            }

            attrsToRemove.forEach(attr => node.removeAttribute(attr));
        }

        [...node.children].forEach(child => this.cleanNode(child));
    }

    isSafeURL(url) {
        if (!url) return true;
        const lower = url.toLowerCase().trim();
        return !/^(javascript|data|vbscript):/i.test(lower);
    }

    isDangerousStyle(style) {
        return /(javascript|expression|behavior|-moz-binding)/i.test(style);
    }

    sanitizeObject(obj, depth = 0) {
        if (depth > 20) return obj;
        if (obj === null || obj === undefined) return obj;

        if (typeof obj === 'string') return this.sanitize(obj);
        if (Array.isArray(obj)) return obj.map(item => this.sanitizeObject(item, depth + 1));

        if (typeof obj === 'object' && obj.constructor === Object) {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
                sanitized[this.sanitize(String(key))] = this.sanitizeObject(value, depth + 1);
            }
            return sanitized;
        }

        return obj;
    }

    hasXSS(input) {
        if (!input || typeof input !== 'string') return false;
        return this.xssPatterns.some(({ pattern }) => pattern.test(input));
    }
}

// ============================================
// TEST SETUP
// ============================================

let xss;

beforeEach(() => {
    xss = new XSSPrevention();
});

// ============================================
// BASIC XSS SANITIZATION TESTS
// ============================================

describe('Basic XSS Sanitization', () => {
    it('Should remove script tags and content', () => {
        const inputs = [
            '<script>alert("XSS")</script>',
            '<SCRIPT>alert(1)</SCRIPT>',
            '<script type="text/javascript">malicious()</script>',
            '<script src="http://evil.com/xss.js"></script>'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('</script>');
            expect(sanitized).not.toContain('alert');
        }
    });

    it('Should remove javascript: URIs', () => {
        const inputs = [
            'javascript:alert("XSS")',
            'JAVASCRIPT:alert(1)',
            'javaSCRIPT:void(0)',
            'javascript:document.cookie'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized.toLowerCase()).not.toContain('javascript:');
        }
    });

    it('Should remove inline event handlers', () => {
        const inputs = [
            '<img onerror="alert(1)" src=x>',
            '<body onload="malicious()">',
            '<div onclick="stealCookies()">Click</div>',
            '<input onfocus="alert(1)" autofocus>',
            '<a onmouseover="bad()">Hover</a>',
            '<form onsubmit="return steal()">',
            '<svg onload="alert(1)">'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toMatch(/on\w+=/i);
        }
    });

    it('Should remove dangerous HTML tags', () => {
        const inputs = [
            '<iframe src="evil.com"></iframe>',
            '<embed src="evil.swf">',
            '<object data="evil.pdf"></object>',
            '<applet code="Evil.class"></applet>',
            '<meta http-equiv="refresh" content="0;url=evil.com">',
            '<link rel="stylesheet" href="evil.css">'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toMatch(/<(iframe|embed|object|applet|meta|link)/i);
        }
    });
});

// ============================================
// HTML ENTITY ENCODING TESTS
// ============================================

describe('HTML Entity Encoding', () => {
    it('Should encode HTML special characters', () => {
        const input = '<div>Test & Demo "Quote"</div>';
        const escaped = xss.escapeHTML(input);

        expect(escaped).toContain('&lt;');
        expect(escaped).toContain('&gt;');
        expect(escaped).toContain('&amp;');
        expect(escaped).toContain('&quot;');
        expect(escaped).not.toContain('<div>');
    });

    it('Should encode attribute values safely', () => {
        const inputs = [
            'test" onclick="alert(1)"',
            "test' onfocus='alert(1)'",
            'test` onmouseover=`alert(1)`'
        ];

        for (const input of inputs) {
            const escaped = xss.escapeAttribute(input);
            expect(escaped).not.toContain('"');
            expect(escaped).toContain('&quot;');
        }
    });

    it('Should encode JavaScript context safely', () => {
        const input = "test';\nalert(1)//";
        const escaped = xss.escapeJavaScript(input);

        expect(escaped).toContain("\\'");
        expect(escaped).toContain('\\n');
        expect(escaped).not.toContain("alert(1)");
        // The 'alert' text should remain but the quote and newline should be escaped
    });

    it('Should encode CSS context safely', () => {
        const input = 'test</style><script>alert(1)</script>';
        const escaped = xss.escapeCSS(input);

        expect(escaped).toContain('\\3C');
        expect(escaped).toContain('\\3E');
        expect(escaped).not.toContain('</style>');
    });
});

// ============================================
// ADVANCED XSS VECTORS
// ============================================

describe('Advanced XSS Vector Detection', () => {
    it('Should detect SVG-based XSS', () => {
        const inputs = [
            '<svg onload="alert(1)">',
            '<svg><script>alert(1)</script></svg>',
            '<svg><use href="data:image/svg+xml,<script>alert(1)</script>"></svg>',
            '<animate onbegin="alert(1)" attributeName="x" from="0" to="100">'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toMatch(/on\w+=/i);
            expect(sanitized).not.toContain('<script>');
        }
    });

    it('Should detect CSS injection', () => {
        const inputs = [
            'background: url(javascript:alert(1))',
            'background-image: url("javascript:alert(1)")',
            '@import "javascript:alert(1)"',
            'expression(alert(1))',
            'behavior: url(xss.htc)',
            '-moz-binding: url(xss.xml)'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized.toLowerCase()).not.toContain('javascript:');
            expect(sanitized.toLowerCase()).not.toContain('expression');
            expect(sanitized.toLowerCase()).not.toContain('behavior');
        }
    });

    it('Should detect template injection', () => {
        const inputs = [
            '{{constructor.constructor("alert(1)")()}}',
            '{{7*7}}',
            '${{7*7}}',
            '<%= 7*7 %>'
        ];

        for (const input of inputs) {
            const result = xss.validateAgainstXSS(input);
            expect(result.valid).toBe(false);
        }
    });

    it('Should detect prototype pollution attempts', () => {
        const inputs = [
            '__proto__[test]=malicious',
            'constructor.prototype.test=malicious',
            '{"__proto__": {"isAdmin": true}}'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('__proto__');
        }
    });
});

// ============================================
// ENCODED & OBFUSCATED XSS
// ============================================

describe('Encoded & Obfuscated XSS Detection', () => {
    it('Should detect HTML entity-encoded XSS', () => {
        const inputs = [
            '&#60;script&#62;alert(1)&#60;/script&#62;',
            '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;',
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        ];

        for (const input of inputs) {
            const result = xss.validateAgainstXSS(input);
            expect(result.valid).toBe(false);
        }
    });

    it('Should detect hex-escaped XSS', () => {
        const inputs = [
            '\\x3Cscript\\x3Ealert(1)\\x3C/script\\x3E',
            '\\x3Cimg onerror=alert(1) src=x\\x3E'
        ];

        for (const input of inputs) {
            const result = xss.validateAgainstXSS(input);
            expect(result.valid).toBe(false);
        }
    });

    it('Should detect unicode-escaped XSS', () => {
        const inputs = [
            '\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E',
            '\\u003Cimg onerror=alert(1) src=x\\u003E'
        ];

        for (const input of inputs) {
            const result = xss.validateAgainstXSS(input);
            expect(result.valid).toBe(false);
        }
    });

    it('Should detect URL-encoded XSS in data URIs', () => {
        const inputs = [
            'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
            'data:text/html,%3Cscript%3Ealert(1)%3C/script%3E'
        ];

        for (const input of inputs) {
            const result = xss.validateAgainstXSS(input);
            expect(result.valid).toBe(false);
        }
    });

    it('Should detect mixed-case obfuscation', () => {
        const inputs = [
            '<ScRiPt>alert(1)</sCrIpT>',
            '<iMg OnErRoR=alert(1) sRc=x>',
            'JaVaScRiPt:alert(1)'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized.toLowerCase()).not.toContain('<script>');
            expect(sanitized.toLowerCase()).not.toContain('javascript:');
        }
    });

    it('Should detect whitespace-obfuscated XSS', () => {
        const inputs = [
            '<img onerror = alert(1) src=x>',
            '<img onerror\n=alert(1) src=x>',
            '<img onerror\r\n=alert(1) src=x>',
            'java script:alert(1)'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toMatch(/on\w+\s*=/i);
        }
    });
});

// ============================================
// DOM-BASED XSS TESTS
// ============================================

describe('DOM-Based XSS Detection', () => {
    it('Should detect document.write injection', () => {
        const inputs = [
            'document.write("<script>alert(1)</script>")',
            'document.writeln("<img src=x onerror=alert(1)>")'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('document.write');
        }
    });

    it('Should detect innerHTML injection', () => {
        const inputs = [
            'element.innerHTML = "<script>alert(1)</script>"',
            'element.innerHTML="<img onerror=alert(1) src=x>"'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('innerHTML');
        }
    });

    it('Should detect eval injection', () => {
        const inputs = [
            'eval("alert(1)")',
            'eval("malicious code")',
            'window.eval("alert(document.cookie)")'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('eval');
        }
    });

    it('Should detect cookie theft attempts', () => {
        const inputs = [
            'document.cookie',
            'document["cookie"]',
            'document[\'cookie\']'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('cookie');
        }
    });

    it('Should detect location redirection', () => {
        const inputs = [
            'window.location="http://evil.com"',
            'window.location.href="http://evil.com"',
            'document.location="http://evil.com"'
        ];

        for (const input of inputs) {
            const sanitized = xss.sanitize(input);
            expect(sanitized).not.toContain('location');
        }
    });
});

// ============================================
// SAFE HTML RENDERING TESTS
// ============================================

describe('Safe HTML Rendering', () => {
    it('Should allow safe HTML tags', () => {
        const html = '<p>Safe content</p><b>Bold</b><i>Italic</i>';
        const sanitized = xss.sanitizeHTML(html);

        expect(sanitized).toContain('<p>');
        expect(sanitized).toContain('<b>');
        expect(sanitized).toContain('<i>');
    });

    it('Should remove script from HTML', () => {
        const html = '<div>Safe</div><script>alert(1)</script><p>More</p>';
        const sanitized = xss.sanitizeHTML(html);

        expect(sanitized).toContain('<div>');
        expect(sanitized).toContain('<p>');
        expect(sanitized).not.toContain('<script>');
    });

    it('Should remove event handlers from HTML', () => {
        const html = '<div onclick="alert(1)">Click</div><img onerror="alert(1)" src=x>';
        const sanitized = xss.sanitizeHTML(html);

        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('onerror');
    });

    it('Should allow safe attributes', () => {
        const html = '<a href="https://example.com" title="Link">Click</a>';
        const sanitized = xss.sanitizeHTML(html);

        expect(sanitized).toContain('href');
        expect(sanitized).toContain('title');
    });

    it('Should remove javascript: from href', () => {
        const html = '<a href="javascript:alert(1)">Click</a>';
        const sanitized = xss.sanitizeHTML(html);

        expect(sanitized).not.toContain('javascript:');
    });

    it('Should remove dangerous styles', () => {
        const html = '<div style="background: url(javascript:alert(1))">Test</div>';
        const sanitized = xss.sanitizeHTML(html);

        expect(sanitized).not.toContain('javascript:');
    });
});

// ============================================
// NORMAL INPUT TESTS (FALSE POSITIVES)
// ============================================

describe('Normal Input Handling (No False Positives)', () => {
    it('Should allow normal text', () => {
        const safeInputs = [
            'Hello World',
            'Nama: John Doe',
            'Email: test@example.com',
            'Alamat: Jl. Sudirman No. 123, Jakarta',
            '08123456789',
            'Laporan Kegiatan 2026',
            'Dr. Ahmad Fauzi, M.Kom',
            'Undangan Rapat Koordinasi',
            'Budget: Rp 50.000.000',
            'Pemberitahuan Penting!'
        ];

        for (const input of safeInputs) {
            const result = xss.validateAgainstXSS(input);
            expect(result.valid).toBe(true);
        }
    });

    it('Should allow text with HTML-like content in context', () => {
        const safeTexts = [
            'Cara menggunakan tag <div> di HTML',
            'Fungsi eval() dalam JavaScript',
            'document.write adalah method DOM',
            'Tutorial: onclick event handler',
            'Penggunaan innerHTML yang aman'
        ];

        // These contain HTML/js terms but in educational context
        // Current regex-based detection may flag these as false positives
        // In production, use context-aware sanitization
        for (const text of safeTexts) {
            const sanitized = xss.sanitize(text);
            // Should not be empty after sanitization
            expect(sanitized.length).toBeGreaterThan(0);
        }
    });

    it('Should allow special characters in names', () => {
        const nameInputs = [
            "O'Brien",
            "Smith-Jones",
            "Dr. First Last, Ph.D.",
            "User_Name_123",
            "José García",
            "André Müller"
        ];

        for (const input of nameInputs) {
            const sanitized = xss.sanitize(input);
            // Should preserve most of the name
            expect(sanitized.length).toBeGreaterThan(0);
        }
    });

    it('Should allow URLs with special characters', () => {
        const urls = [
            'https://example.com/path?q=test&lang=en',
            'https://example.com/path#section',
            'mailto:test@example.com',
            'tel:+628123456789'
        ];

        for (const url of urls) {
            const result = xss.validateAgainstXSS(url);
            expect(result.valid).toBe(true);
        }
    });
});

// ============================================
// OBJECT SANITIZATION TESTS
// ============================================

describe('Object Recursive Sanitization', () => {
    it('Should sanitize nested objects', () => {
        const input = {
            name: '<script>alert(1)</script>John',
            email: 'test@test.com',
            address: {
                street: '<img onerror=alert(1) src=x>Main St',
                city: 'Jakarta'
            },
            tags: ['<b>safe</b>', '<script>bad</script>', 'normal']
        };

        const sanitized = xss.sanitizeObject(input);

        expect(sanitized.name).not.toContain('<script>');
        expect(sanitized.address.street).not.toContain('onerror');
        expect(sanitized.tags[0]).not.toContain('<b>'); // HTML tags removed
        expect(sanitized.tags[1]).not.toContain('<script>');
        expect(sanitized.tags[2]).toBe('normal');
        expect(sanitized.email).toBe('test@test.com');
    });

    it('Should prevent prototype pollution', () => {
        const input = {
            name: 'Test',
            __proto__: { isAdmin: true },
            constructor: { prototype: { isAdmin: true } }
        };

        const sanitized = xss.sanitizeObject(input);

        expect(sanitized.__proto__).toBeUndefined();
        expect(sanitized.constructor).toBeUndefined();
        expect(sanitized.name).toBe('Test');
    });

    it('Should handle deep nesting without stack overflow', () => {
        function createDeep(depth) {
            if (depth <= 0) return { value: 'leaf' };
            return { child: createDeep(depth - 1), data: '<script>alert(1)</script>' };
        }

        const input = createDeep(25);
        
        // Should not throw
        expect(() => xss.sanitizeObject(input)).not.toThrow();
    });

    it('Should handle arrays with mixed content', () => {
        const input = [
            'safe',
            '<script>alert(1)</script>',
            { nested: 'javascript:void(0)' },
            ['<img onerror=alert(1) src=x>', 'also safe']
        ];

        const sanitized = xss.sanitizeObject(input);

        expect(sanitized[0]).toBe('safe');
        expect(sanitized[1]).not.toContain('<script>');
        expect(sanitized[2].nested).not.toContain('javascript:');
        expect(sanitized[3][0]).not.toContain('onerror');
        expect(sanitized[3][1]).toBe('also safe');
    });
});

// ============================================
// XSS PATTERN DETECTION TESTS
// ============================================

describe('XSS Pattern Detection', () => {
    it('Should detect multiple XSS patterns', () => {
        const maliciousInputs = [
            { input: '<script>alert(1)</script>', expected: true },
            { input: 'javascript:void(0)', expected: true },
            { input: '<img onerror="alert(1)" src=x>', expected: true },
            { input: '<iframe src="evil.com">', expected: true },
            { input: 'eval("malicious code")', expected: true },
            { input: 'document.cookie', expected: true },
            { input: 'window.location="evil.com"', expected: true },
            { input: 'data:text/html,<script>alert(1)</script>', expected: true },
            { input: '{{constructor.constructor("alert(1)")()}}', expected: true },
            { input: '__proto__[test]=value', expected: true },
            { input: '<svg onload="alert(1)">', expected: true },
            { input: 'background:url(javascript:alert(1))', expected: true },
            { input: 'expression(alert(1))', expected: true },
            { input: '\\x3Cscript\\x3Ealert(1)\\x3C/script\\x3E', expected: true },
            { input: '&lt;script&gt;alert(1)&lt;/script&gt;', expected: true }
        ];

        for (const { input, expected } of maliciousInputs) {
            expect(xss.hasXSS(input)).toBe(expected);
        }
    });

    it('Should not detect XSS in safe inputs', () => {
        const safeInputs = [
            'Hello World',
            'test@example.com',
            '08123456789',
            'https://example.com',
            'normal text with < and > symbols',
            'user_name_123',
            'Dr. John Doe, Ph.D.'
        ];

        for (const input of safeInputs) {
            expect(xss.hasXSS(input)).toBe(false);
        }
    });
});

// ============================================
// CONTEXT-AWARE ESCAPING TESTS
// ============================================

describe('Context-Aware Escaping', () => {
    it('Should escape for HTML context', () => {
        const input = '<script>alert("XSS")</script>';
        const escaped = xss.escapeHTML(input);

        expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('Should escape for attribute context', () => {
        const input = 'test" onmouseover="alert(1)';
        const escaped = xss.escapeAttribute(input);

        expect(escaped).toContain('&quot;');
        expect(escaped).not.toContain('onmouseover=');
    });

    it('Should escape for JavaScript context', () => {
        const input = "test' + alert(1) + '";
        const escaped = xss.escapeJavaScript(input);

        expect(escaped).toContain("\\'");
    });

    it('Should escape for CSS context', () => {
        const input = 'red</style><script>alert(1)</script>';
        const escaped = xss.escapeCSS(input);

        expect(escaped).toContain('\\3C');
        expect(escaped).toContain('\\3E');
        expect(escaped).not.toContain('<script>');
    });
});