// config/security-config.js - Security Configuration 2026 (SECURE)
/**
 * E-Arsip Digital - Security Configuration
 * Version: 2026.1.0
 * Safe for GitHub upload (no secrets, no keys)
 * 
 * Konfigurasi keamanan client-side.
 * Server-side security headers di-handle oleh Nginx/Apache.
 */

window.EArsip = window.EArsip || {};

window.EArsip.SecurityConfig = (function() {
    'use strict';
    
    // ============================================
    // ENVIRONMENT DETECTION
    // ============================================
    function isProduction() {
        var hostname = window.location.hostname;
        return hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('192.168.');
    }
    
    function isHTTPS() {
        return window.location.protocol === 'https:';
    }
    
    // ============================================
    // ALLOWED ORIGINS (Dynamic)
    // ============================================
    function getAllowedOrigins() {
        var origins = [
            window.location.origin,
            'https://script.google.com',
            'https://script.googleusercontent.com',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com',
            'https://unpkg.com'
        ];
        
        // Add GitHub Pages origin if applicable
        if (window.location.hostname.includes('github.io')) {
            origins.push('https://' + window.location.hostname);
        }
        
        return origins;
    }
    
    // ============================================
    // KONFIGURASI
    // ============================================
    var config = {
        // ==========================================
        // 1. ENCRYPTION SETTINGS
        // ==========================================
        encryption: {
            algorithm: 'AES-256-GCM',
            keyLength: 256,
            saltLength: 128,
            ivLength: 12,
            tagLength: 128,
            // ⚠️ Kunci enkripsi TIDAK disimpan di sini!
            // Kunci di-generate dari password user + salt via PBKDF2
            keyDerivation: {
                algorithm: 'PBKDF2',
                iterations: 200000,  // OWASP 2023 recommendation
                hashFunction: 'SHA-256'
            }
        },
        
        // ==========================================
        // 2. CSRF PROTECTION
        // ==========================================
        csrf: {
            enabled: true,
            cookieName: 'XSRF-TOKEN',
            headerName: 'X-CSRF-Token',
            formFieldName: '_csrf_token',
            tokenLength: 32,
            tokenExpiry: 3600000,     // 1 jam - auto refresh
            renewOnUse: true,          // Token baru setiap digunakan
            validateOrigin: true,
            allowedOrigins: [],        // Diisi saat runtime
            excludedPaths: [           // Path yang tidak perlu CSRF
                '/login',
                '/verify',
                '/health',
                '/offline'
            ]
        },
        
        // ==========================================
        // 3. XSS PREVENTION (Client-side)
        // ==========================================
        xss: {
            sanitizeInput: true,
            sanitizeOutput: true,
            
            // Allowed HTML tags (untuk rich text)
            allowedTags: [
                'b', 'i', 'em', 'strong', 'a', 'p', 'br',
                'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
                'table', 'thead', 'tbody', 'tr', 'td', 'th',
                'span', 'div', 'code', 'pre'
            ],
            
            // Allowed attributes
            allowedAttributes: [
                'href', 'title', 'target', 'class', 'id',
                'style', 'data-*', 'aria-*', 'role'
            ],
            
            // Allowed URL schemes
            allowedSchemes: ['http', 'https', 'mailto', 'tel'],
            
            // Sanitization options
            stripComments: true,
            removeEmptyTags: true,
            
            // Block dangerous patterns
            blockPatterns: [
                /<script\b[^>]*>/gi,
                /on\w+\s*=\s*["'][^"']*["']/gi,
                /javascript\s*:/gi,
                /<iframe\b[^>]*>/gi,
                /<object\b[^>]*>/gi,
                /<embed\b[^>]*>/gi
            ]
        },
        
        // ==========================================
        // 4. RATE LIMITING (Client-side hint)
        // ==========================================
        rateLimit: {
            enabled: true,
            windowMs: 60000,          // 1 menit
            maxRequests: 100,         // Maksimal request per window
            burstMultiplier: 1.5,     // Allow 50% burst
            
            // Rate limit per endpoint type
            endpoints: {
                login: { maxRequests: 5, windowMs: 60000 },     // 5 login attempt per menit
                api: { maxRequests: 60, windowMs: 60000 },      // 60 API calls per menit
                upload: { maxRequests: 10, windowMs: 60000 }    // 10 uploads per menit
            }
        },
        
        // ==========================================
        // 5. FIREWALL RULES (Client-side validation)
        // ==========================================
        firewall: {
            enabled: true,
            
            // Block SQL Injection patterns
            blockSQLInjection: true,
            sqlPatterns: [
                /(\bSELECT\b.*\bFROM\b)/i,
                /(\bINSERT\b.*\bINTO\b)/i,
                /(\bUPDATE\b.*\bSET\b)/i,
                /(\bDELETE\b.*\bFROM\b)/i,
                /(\bDROP\b.*\bTABLE\b)/i,
                /(\bUNION\b.*\bSELECT\b)/i,
                /(\bALTER\b.*\bTABLE\b)/i,
                /(\bTRUNCATE\b.*\bTABLE\b)/i,
                /(\bEXEC\b|\bEXECUTE\b)/i,
                /(\bDECLARE\b.*\bCURSOR\b)/i
            ],
            
            // Block XSS patterns
            blockXSS: true,
            xssPatterns: [
                /<script\b[^>]*>/gi,
                /javascript\s*:/gi,
                /on\w+\s*=\s*["'][^"']*["']/gi,
                /<iframe\b[^>]*>/gi,
                /<object\b[^>]*>/gi,
                /<embed\b[^>]*>/gi,
                /<link\b[^>]*>/gi,
                /<meta\b[^>]*>/gi,
                /expression\s*\(/gi,
                /eval\s*\(/gi
            ],
            
            // Block path traversal
            blockPathTraversal: true,
            pathTraversalPatterns: [
                /\.\.\//,
                /\.\.\\/,
                /%2e%2e\//i,
                /%2e%2e%5c/i,
                /etc\/passwd/i,
                /etc\/shadow/i,
                /cmd\.exe/i,
                /cmd\.com/i,
                /\/proc\/self/i
            ],
            
            // Block dangerous file extensions
            blockedExtensions: [
                '.exe', '.bat', '.cmd', '.sh', '.msi', '.dll',
                '.js', '.vbs', '.ps1', '.scr', '.com', '.pif',
                '.hta', '.cpl', '.msc', '.jar', '.php', '.asp'
            ],
            
            maxRequestBodySize: 10485760  // 10MB
        },
        
        // ==========================================
        // 6. FILE UPLOAD SECURITY
        // ==========================================
        fileUpload: {
            maxFileSize: 10485760,     // 10MB
            allowedMimeTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp'
            ],
            blockedMimeTypes: [
                'application/x-msdownload',
                'application/x-msdos-program',
                'application/x-ms-installer',
                'application/x-httpd-php',
                'text/html',
                'text/javascript'
            ],
            maxFiles: 5,
            scanForMalware: false,     // Requires server-side
            sanitizeFilename: true      // Hapus karakter berbahaya dari nama file
        },
        
        // ==========================================
        // 7. SESSION CONFIGURATION
        // ==========================================
        session: {
            // Cookie settings (untuk dokumentasi - actual di server)
            httpOnly: true,
            secure: isHTTPS(),         // Auto-detect HTTPS
            sameSite: 'Lax',           // 'Lax' untuk PWA + cross-origin compatibility
            
            // Session management
            maxConcurrentSessions: 3,
            idleTimeout: 1800000,      // 30 menit idle = auto logout
            absoluteTimeout: 28800000, // 8 jam maksimal
            
            // Activity tracking
            extendOnActivity: true,
            activityEvents: [
                'click', 'keydown', 'scroll', 'mousemove', 'touchstart'
            ]
        },
        
        // ==========================================
        // 8. PASSWORD POLICY
        // ==========================================
        password: {
            minLength: 8,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumber: true,
            requireSpecialChar: true,
            specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
            maxAge: 90,               // Hari - harus ganti password
            historySize: 5,           // Tidak boleh sama dengan 5 password terakhir
            preventCommonPassword: true,
            preventUsernameInPassword: true,
            preventSequentialChars: true,  // Contoh: abc, 123
            preventRepeatedChars: true     // Contoh: aaa, 111
        },
        
        // ==========================================
        // 9. AUDIT TRAIL
        // ==========================================
        audit: {
            enabled: true,
            logLevel: 'info',         // 'debug' | 'info' | 'warn' | 'error'
            maxLogs: 1000,
            flushInterval: 30000,     // 30 detik
            
            events: [
                'login', 'logout', 'login_failed',
                'create', 'update', 'delete',
                'approve', 'reject',
                'upload', 'download',
                'view', 'export',
                'permission_change', 'role_change'
            ],
            
            // Data yang TIDAK BOLEH di-log
            excludeFields: [
                'password', 'token', 'secret', 'key',
                'credit_card', 'ssn', 'ktp', 'passport'
            ]
        },
        
        // ==========================================
        // 10. CORS CONFIGURATION (untuk API)
        // ==========================================
        cors: {
            enabled: true,
            allowedOrigins: [],       // Diisi runtime
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-CSRF-Token',
                'X-Requested-With'
            ],
            exposedHeaders: ['X-Total-Count', 'X-RateLimit-Remaining'],
            maxAge: 3600,             // 1 jam preflight cache
            allowCredentials: true
        },
        
        // ==========================================
        // 11. INPUT VALIDATION PATTERNS
        // ==========================================
        validation: {
            username: {
                pattern: /^[a-zA-Z0-9._-]{3,50}$/,
                message: 'Username 3-50 karakter (huruf, angka, ._-)'
            },
            email: {
                pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: 'Format email tidak valid'
            },
            phone: {
                pattern: /^[\d\s\-\+\(\)]{7,20}$/,
                message: 'Format telepon tidak valid'
            },
            nomorSurat: {
                pattern: /^[\d]{3}\/[A-Z\.]+\/[A-Z]+\/[A-Z]+\/[IVXLCDM]+\/\d{4}$/,
                message: 'Format nomor surat: 001/K.UM/FIKOM/VII/2024'
            },
            nip: {
                pattern: /^\d{18}$/,
                message: 'NIP harus 18 digit angka'
            },
            nim: {
                pattern: /^\d{8,12}$/,
                message: 'NIM harus 8-12 digit angka'
            }
        }
    };
    
    // ============================================
    // RUNTIME ADJUSTMENTS
    // ============================================
    
    // Populate allowed origins
    config.csrf.allowedOrigins = getAllowedOrigins();
    config.cors.allowedOrigins = getAllowedOrigins();
    
    // Adjust for development
    if (!isProduction()) {
        config.session.secure = false;
        config.audit.logLevel = 'debug';
    }
    
    // Adjust for production
    if (isProduction()) {
        config.audit.flushInterval = 60000; // 1 menit di production
    }
    
    // ============================================
    // FREEZE
    // ============================================
    if (isProduction()) {
        Object.freeze(config);
        Object.freeze(config.encryption);
        Object.freeze(config.csrf);
        Object.freeze(config.xss);
        Object.freeze(config.firewall);
        Object.freeze(config.session);
        Object.freeze(config.password);
        Object.freeze(config.audit);
        Object.freeze(config.cors);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    return {
        getConfig: function() { return config; },
        
        /**
         * Validate input against patterns
         * @param {string} type - Validation type
         * @param {string} value - Value to validate
         * @returns {Object} { valid, message }
         */
        validate: function(type, value) {
            var rule = config.validation[type];
            if (!rule) return { valid: true, message: '' };
            
            if (!value || !rule.pattern.test(value)) {
                return { valid: false, message: rule.message };
            }
            
            return { valid: true, message: '' };
        },
        
        /**
         * Check if file is safe to upload
         * @param {File} file - File object
         * @returns {Object} { safe, reason }
         */
        validateFile: function(file) {
            if (!file) return { safe: false, reason: 'File tidak ada' };
            
            // Check size
            if (file.size > config.fileUpload.maxFileSize) {
                return { safe: false, reason: 'Ukuran file melebihi batas (maks 10MB)' };
            }
            
            // Check size = 0
            if (file.size === 0) {
                return { safe: false, reason: 'File kosong' };
            }
            
            // Check MIME type
            if (config.fileUpload.blockedMimeTypes.indexOf(file.type) !== -1) {
                return { safe: false, reason: 'Tipe file tidak diizinkan' };
            }
            
            // Check extension
            var ext = '.' + file.name.split('.').pop().toLowerCase();
            if (config.firewall.blockedExtensions.indexOf(ext) !== -1) {
                return { safe: false, reason: 'Ekstensi file diblokir: ' + ext };
            }
            
            return { safe: true, reason: '' };
        },
        
        /**
         * Sanitize filename
         * @param {string} filename - Original filename
         * @returns {string} Sanitized filename
         */
        sanitizeFilename: function(filename) {
            if (!filename) return 'file';
            
            return filename
                .replace(/[^a-zA-Z0-9._-]/g, '_')   // Hanya izinkan alphanumeric, dot, dash, underscore
                .replace(/\.{2,}/g, '.')              // Hapus multiple dots
                .replace(/^\.+/, '')                   // Hapus leading dots
                .substring(0, 200);                    // Max 200 karakter
        },
        
        /**
         * Check for SQL injection in string
         * @param {string} input - Input string
         * @returns {boolean} True if suspicious
         */
        detectSQLInjection: function(input) {
            if (!input || typeof input !== 'string') return false;
            
            return config.firewall.sqlPatterns.some(function(pattern) {
                return pattern.test(input);
            });
        },
        
        /**
         * Check for XSS in string
         * @param {string} input - Input string
         * @returns {boolean} True if suspicious
         */
        detectXSS: function(input) {
            if (!input || typeof input !== 'string') return false;
            
            return config.firewall.xssPatterns.some(function(pattern) {
                return pattern.test(input);
            });
        },
        
        isProduction: isProduction,
        isHTTPS: isHTTPS
    };
})();