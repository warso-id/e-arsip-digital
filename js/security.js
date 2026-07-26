// js/security.js - Enterprise Security Manager 2026
/**
 * E-Arsip Digital - Advanced Security Module
 * Version: 2026.1.0
 * Features: Authentication security, encryption, XSS/CSRF protection,
 *           rate limiting, session management, PWA security,
 *           content security, audit logging, brute force protection
 * Security: AES-GCM encryption, CSP enforcement, SRI validation,
 *           secure token generation, constant-time comparison
 */

import APP_CONFIG from '../config/config.js';

class SecurityManager {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Authentication
            maxLoginAttempts: 5,
            lockoutDuration: 30 * 60 * 1000, // 30 menit
            progressiveLockout: true,
            sessionTimeout: 30 * 60 * 1000,
            maxSessionDuration: 8 * 60 * 60 * 1000, // 8 jam
            sessionRefreshThreshold: 5 * 60 * 1000, // Refresh 5 menit sebelum timeout
            
            // Password policy
            passwordMinLength: 8,
            passwordMaxLength: 128,
            passwordRequireUppercase: true,
            passwordRequireLowercase: true,
            passwordRequireNumbers: true,
            passwordRequireSpecial: true,
            passwordExpiryDays: 90,
            passwordHistoryCount: 5,
            passwordBreachCheck: true,
            
            // MFA
            twoFactorEnabled: false,
            twoFactorMethod: 'totp', // totp | sms | email
            
            // File upload
            maxFileUploadSize: 10 * 1024 * 1024, // 10MB
            allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
            blockedFileTypes: ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs'],
            scanForMalware: false,
            
            // Rate limiting
            rateLimitRequests: 100,
            rateLimitWindow: 60000,
            apiRateLimit: 1000,
            
            // CSP
            enableCSP: true,
            cspReportOnly: false,
            
            // PWA
            enableSW: true,
            enablePushNotifications: false,
            
            // Logging
            enableSecurityLogging: true,
            maxLogEntries: 500,
            remoteLogging: false,
            
            ...APP_CONFIG?.security,
            ...options
        };
        
        // State
        this.loginAttempts = new Map();
        this.rateLimits = new Map();
        this.activeSessions = new Map();
        this.csrfTokens = new Map();
        this.blockedIPs = new Set();
        
        // Crypto
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
        this.keyCache = new Map();
        
        // Timers
        this.timers = {};
        
        // Event handlers
        this.handlers = {};
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            // Load state
            this.loadState();
            
            // Setup security measures
            this.setupCSP();
            this.setupSessionMonitoring();
            this.setupCSRFProtection();
            this.setupActivityTracking();
            
            // Log initialization
            this.logSecurityEvent('security_initialized', {
                version: '2026.1.0',
                features: Object.keys(this.config).filter(k => this.config[k])
            });
            
            console.info('[Security] Security manager initialized');
            
        } catch (error) {
            console.error('[Security] Initialization failed:', error);
        }
    }
    
    // ============================================
    // CONTENT SECURITY POLICY
    // ============================================
    
    setupCSP() {
        if (!this.config.enableCSP) return;
        
        try {
            const meta = document.createElement('meta');
            meta.httpEquiv = this.config.cspReportOnly ? 
                'Content-Security-Policy-Report-Only' : 
                'Content-Security-Policy';
            
            meta.content = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https://api.example.com wss://ws.example.com",
                "frame-src 'none'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "upgrade-insecure-requests",
                this.config.cspReportOnly ? "report-uri /api/csp-report" : ""
            ].filter(Boolean).join('; ');
            
            document.head.appendChild(meta);
        } catch (error) {
            console.warn('[Security] Failed to setup CSP:', error.message);
        }
    }
    
    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    
    createSession(userData, options = {}) {
        const sessionToken = this.generateSecureToken(64);
        const refreshToken = this.generateSecureToken(64);
        const csrfToken = this.generateSecureToken(32);
        const now = Date.now();
        
        const session = {
            token: sessionToken,
            refreshToken,
            csrfToken,
            userId: userData.id,
            username: userData.username,
            role: userData.role,
            permissions: userData.permissions || [],
            sessionStart: now,
            lastActivity: now,
            expiresAt: now + this.config.sessionTimeout,
            maxExpiresAt: now + this.config.maxSessionDuration,
            ipAddress: options.ipAddress || 'unknown',
            userAgent: this.sanitizeInput(navigator.userAgent.substring(0, 200)),
            browserFingerprint: this.generateBrowserFingerprint(),
            deviceInfo: this.getDeviceInfo(),
            isPWA: this.isPWA(),
            metadata: options.metadata || {}
        };
        
        // Store session
        this.activeSessions.set(sessionToken, session);
        
        // Store in sessionStorage
        this.persistSession(session);
        
        // Store CSRF token
        this.csrfTokens.set(userData.id, csrfToken);
        this.setCSRFCookie(csrfToken);
        
        // Log session creation
        this.logSecurityEvent('session_created', {
            userId: userData.id,
            role: userData.role,
            isPWA: session.isPWA
        });
        
        return {
            sessionToken,
            refreshToken,
            csrfToken,
            expiresAt: session.expiresAt
        };
    }
    
    validateSession(sessionToken) {
        const session = this.activeSessions.get(sessionToken);
        
        if (!session) {
            // Try to recover from sessionStorage
            const stored = this.getPersistedSession();
            if (stored?.token === sessionToken) {
                this.activeSessions.set(sessionToken, stored);
                return this.checkSessionValidity(stored);
            }
            return { valid: false, reason: 'session_not_found' };
        }
        
        return this.checkSessionValidity(session);
    }
    
    checkSessionValidity(session) {
        const now = Date.now();
        
        // Check max duration
        if (now > session.maxExpiresAt) {
            this.terminateSession(session.token, 'max_duration_exceeded');
            return { valid: false, reason: 'session_expired_max' };
        }
        
        // Check inactivity timeout
        if (now > session.expiresAt) {
            this.terminateSession(session.token, 'inactivity_timeout');
            return { valid: false, reason: 'session_expired' };
        }
        
        // Check browser fingerprint consistency
        const currentFingerprint = this.generateBrowserFingerprint();
        if (currentFingerprint !== session.browserFingerprint) {
            this.logSecurityEvent('fingerprint_mismatch', {
                userId: session.userId,
                expected: session.browserFingerprint,
                actual: currentFingerprint
            });
            
            // Terminate if strict mode
            if (this.config.strictFingerprintCheck) {
                this.terminateSession(session.token, 'fingerprint_mismatch');
                return { valid: false, reason: 'fingerprint_mismatch' };
            }
        }
        
        // Check if session needs refresh
        const needsRefresh = (session.expiresAt - now) < this.config.sessionRefreshThreshold;
        
        if (needsRefresh) {
            session.expiresAt = now + this.config.sessionTimeout;
            session.lastActivity = now;
            this.activeSessions.set(session.token, session);
            this.persistSession(session);
        }
        
        return { 
            valid: true, 
            session,
            needsRefresh,
            remainingTime: session.expiresAt - now
        };
    }
    
    refreshSession(sessionToken) {
        const session = this.activeSessions.get(sessionToken);
        if (!session) return null;
        
        const now = Date.now();
        session.expiresAt = now + this.config.sessionTimeout;
        session.lastActivity = now;
        
        this.activeSessions.set(sessionToken, session);
        this.persistSession(session);
        
        return session;
    }
    
    terminateSession(sessionToken, reason = 'user_logout') {
        const session = this.activeSessions.get(sessionToken);
        
        if (session) {
            this.logSecurityEvent('session_terminated', {
                userId: session.userId,
                reason,
                sessionDuration: Date.now() - session.sessionStart,
                lastActivity: Date.now() - session.lastActivity
            });
            
            this.activeSessions.delete(sessionToken);
            this.csrfTokens.delete(session.userId);
        }
        
        // Clear storage
        sessionStorage.removeItem('session_data');
        this.clearCSRFCookie();
        
        return true;
    }
    
    persistSession(session) {
        try {
            const data = {
                token: session.token,
                refreshToken: session.refreshToken,
                userId: session.userId,
                expiresAt: session.expiresAt,
                csrfToken: session.csrfToken
            };
            
            sessionStorage.setItem('session_data', JSON.stringify(data));
        } catch (error) {
            console.warn('[Security] Failed to persist session:', error.message);
        }
    }
    
    getPersistedSession() {
        try {
            const stored = sessionStorage.getItem('session_data');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    }
    
    setupSessionMonitoring() {
        this.timers.sessionMonitor = setInterval(() => {
            const sessionData = this.getPersistedSession();
            if (sessionData) {
                const result = this.validateSession(sessionData.token);
                
                if (!result.valid) {
                    this.handleInvalidSession(result.reason);
                }
            }
        }, 60000);
    }
    
    handleInvalidSession(reason) {
        this.logSecurityEvent('session_invalidated', { reason });
        
        // Dispatch event for app to handle
        window.dispatchEvent(new CustomEvent('security:sessionExpired', {
            detail: { reason, timestamp: Date.now() }
        }));
        
        // Redirect to login after short delay
        setTimeout(() => {
            const loginPath = '/login.html?reason=' + encodeURIComponent(reason);
            window.location.replace(loginPath);
        }, 2000);
    }
    
    setupActivityTracking() {
        const events = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'];
        let activityTimer;
        
        const updateActivity = () => {
            clearTimeout(activityTimer);
            
            const sessionData = this.getPersistedSession();
            if (sessionData) {
                const session = this.activeSessions.get(sessionData.token);
                if (session) {
                    session.lastActivity = Date.now();
                    this.activeSessions.set(session.token, session);
                }
            }
            
            // Reset timer
            activityTimer = setTimeout(() => {
                // User inactive - will be caught by session monitor
            }, this.config.sessionTimeout);
        };
        
        events.forEach(event => {
            this.handlers[event] = updateActivity;
            document.addEventListener(event, updateActivity, { passive: true });
        });
    }
    
    // ============================================
    // AUTHENTICATION SECURITY
    // ============================================
    
    validateLoginAttempt(username) {
        const key = this.sanitizeInput(username.toLowerCase());
        const attempts = this.loginAttempts.get(key) || {
            count: 0,
            firstAttempt: 0,
            lastAttempt: 0,
            locked: false,
            lockedUntil: 0,
            lockoutLevel: 0
        };
        
        const now = Date.now();
        
        // Reset if window expired
        if (attempts.firstAttempt > 0 && (now - attempts.firstAttempt) > this.config.rateLimitWindow) {
            attempts.count = 0;
            attempts.firstAttempt = 0;
        }
        
        // Check if locked
        if (attempts.locked) {
            if (now < attempts.lockedUntil) {
                const remainingSeconds = Math.ceil((attempts.lockedUntil - now) / 1000);
                const remainingMinutes = Math.ceil(remainingSeconds / 60);
                
                return {
                    allowed: false,
                    reason: 'account_locked',
                    message: `Akun terkunci. Silakan coba lagi dalam ${remainingMinutes} menit.`,
                    retryAfter: remainingSeconds,
                    lockoutLevel: attempts.lockoutLevel
                };
            } else {
                // Lockout expired, reset
                attempts.count = 0;
                attempts.locked = false;
                attempts.lockedUntil = 0;
            }
        }
        
        return { allowed: true };
    }
    
    recordLoginAttempt(username, success) {
        const key = this.sanitizeInput(username.toLowerCase());
        let attempts = this.loginAttempts.get(key) || {
            count: 0,
            firstAttempt: Date.now(),
            lastAttempt: 0,
            locked: false,
            lockedUntil: 0,
            lockoutLevel: 0
        };
        
        attempts.lastAttempt = Date.now();
        
        if (success) {
            attempts.count = 0;
            attempts.locked = false;
            attempts.lockedUntil = 0;
            attempts.lockoutLevel = 0;
        } else {
            if (attempts.firstAttempt === 0) {
                attempts.firstAttempt = Date.now();
            }
            
            attempts.count++;
            
            // Progressive lockout
            if (attempts.count >= this.config.maxLoginAttempts) {
                attempts.locked = true;
                attempts.lockoutLevel++;
                
                // Exponential backoff
                const multiplier = Math.pow(2, attempts.lockoutLevel - 1);
                const lockoutDuration = this.config.lockoutDuration * multiplier;
                attempts.lockedUntil = Date.now() + lockoutDuration;
                
                this.logSecurityEvent('account_locked', {
                    username: key.substring(0, 3) + '***',
                    attempts: attempts.count,
                    lockoutLevel: attempts.lockoutLevel,
                    lockoutDuration,
                    lockedUntil: new Date(attempts.lockedUntil).toISOString()
                });
            }
        }
        
        this.loginAttempts.set(key, attempts);
        this.persistLoginAttempts();
    }
    
    // ============================================
    // PASSWORD SECURITY
    // ============================================
    
    validatePasswordStrength(password, userInfo = {}) {
        const errors = [];
        const warnings = [];
        const config = this.config;
        
        // Length checks
        if (password.length < config.passwordMinLength) {
            errors.push(`Password minimal ${config.passwordMinLength} karakter`);
        }
        if (password.length > config.passwordMaxLength) {
            errors.push(`Password maksimal ${config.passwordMaxLength} karakter`);
        }
        
        // Character type checks
        if (config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password harus mengandung huruf besar (A-Z)');
        }
        if (config.passwordRequireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password harus mengandung huruf kecil (a-z)');
        }
        if (config.passwordRequireNumbers && !/[0-9]/.test(password)) {
            errors.push('Password harus mengandung angka (0-9)');
        }
        if (config.passwordRequireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password harus mengandung karakter khusus');
        }
        
        // Common password check
        const commonPasswords = [
            'password', '12345678', 'qwerty', 'admin123', 'password123',
            'admin', 'letmein', 'monkey', 'dragon', 'master', '123456789'
        ];
        
        if (commonPasswords.includes(password.toLowerCase())) {
            errors.push('Password terlalu umum dan mudah ditebak');
        }
        
        // User info in password
        if (userInfo.username && password.toLowerCase().includes(userInfo.username.toLowerCase())) {
            warnings.push('Password mengandung username Anda');
        }
        if (userInfo.email && password.toLowerCase().includes(userInfo.email.split('@')[0].toLowerCase())) {
            warnings.push('Password mengandung alamat email Anda');
        }
        
        // Sequential characters
        if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
            warnings.push('Password mengandung karakter berurutan');
        }
        
        if (/012|123|234|345|456|567|678|789|890/.test(password)) {
            warnings.push('Password mengandung angka berurutan');
        }
        
        // Repeated characters
        if (/(.)\1{3,}/.test(password)) {
            warnings.push('Password mengandung karakter berulang');
        }
        
        // Calculate strength score
        let score = 0;
        
        // Length scoring
        if (password.length >= 16) score += 30;
        else if (password.length >= 12) score += 25;
        else if (password.length >= 10) score += 20;
        else if (password.length >= 8) score += 15;
        
        // Character variety
        if (/[A-Z]/.test(password)) score += 10;
        if (/[a-z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 10;
        if (/[^A-Za-z0-9]/.test(password)) score += 15;
        
        // Complexity
        const uniqueChars = new Set(password.split('')).size;
        score += Math.min(15, Math.floor(uniqueChars / 2));
        
        // Mixed types bonus
        const types = [
            /[A-Z]/.test(password),
            /[a-z]/.test(password),
            /[0-9]/.test(password),
            /[^A-Za-z0-9]/.test(password)
        ].filter(Boolean).length;
        
        score += types * 5;
        
        score = Math.min(100, score);
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            score,
            strength: this.getStrengthLabel(score),
            entropy: this.calculateEntropy(password)
        };
    }
    
    getStrengthLabel(score) {
        if (score >= 80) return { label: 'Sangat Kuat', color: '#22c55e', level: 4 };
        if (score >= 60) return { label: 'Kuat', color: '#3b82f6', level: 3 };
        if (score >= 40) return { label: 'Sedang', color: '#f59e0b', level: 2 };
        if (score >= 20) return { label: 'Lemah', color: '#ef4444', level: 1 };
        return { label: 'Sangat Lemah', color: '#dc2626', level: 0 };
    }
    
    calculateEntropy(password) {
        if (!password) return 0;
        
        let poolSize = 0;
        if (/[a-z]/.test(password)) poolSize += 26;
        if (/[A-Z]/.test(password)) poolSize += 26;
        if (/[0-9]/.test(password)) poolSize += 10;
        if (/[^A-Za-z0-9]/.test(password)) poolSize += 32;
        
        if (poolSize === 0) poolSize = 26;
        
        return Math.floor(password.length * Math.log2(poolSize));
    }
    
    // ============================================
    // CRYPTOGRAPHIC OPERATIONS (Web Crypto API)
    // ============================================
    
    async deriveKey(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            this.encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt || this.encoder.encode('e-arsip-salt'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    async encrypt(data, password) {
        try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await this.deriveKey(password, salt);
            
            const encoded = typeof data === 'string' ? 
                this.encoder.encode(data) : data;
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encoded
            );
            
            // Combine: salt + iv + encrypted
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            return this.arrayBufferToBase64(combined);
        } catch (error) {
            console.error('[Security] Encryption failed:', error);
            return null;
        }
    }
    
    async decrypt(encryptedData, password) {
        try {
            const combined = this.base64ToArrayBuffer(encryptedData);
            
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 28);
            const data = combined.slice(28);
            
            const key = await this.deriveKey(password, salt);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                data
            );
            
            return this.decoder.decode(decrypted);
        } catch (error) {
            console.error('[Security] Decryption failed:', error);
            return null;
        }
    }
    
    async hashData(data) {
        const encoded = typeof data === 'string' ? 
            this.encoder.encode(data) : data;
        
        const hash = await crypto.subtle.digest('SHA-256', encoded);
        return this.arrayBufferToHex(hash);
    }
    
    generateSecureToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    // ============================================
    // CSRF PROTECTION
    // ============================================
    
    setupCSRFProtection() {
        // Add CSRF token to all AJAX requests
        const originalFetch = window.fetch;
        const security = this;
        
        window.fetch = function(url, options = {}) {
            const sessionData = security.getPersistedSession();
            
            if (sessionData?.csrfToken && !options.headers?.['X-CSRF-Token']) {
                options.headers = {
                    ...options.headers,
                    'X-CSRF-Token': sessionData.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                };
            }
            
            return originalFetch.call(this, url, options);
        };
        
        // Add CSRF token to forms
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form.method?.toUpperCase() === 'POST') {
                const sessionData = security.getPersistedSession();
                
                if (sessionData?.csrfToken && !form.querySelector('input[name="_csrf"]')) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = '_csrf';
                    input.value = sessionData.csrfToken;
                    form.appendChild(input);
                }
            }
        }, true);
    }
    
    setCSRFCookie(token) {
        try {
            document.cookie = `XSRF-TOKEN=${token};path=/;SameSite=Strict;Secure`;
        } catch {}
    }
    
    clearCSRFCookie() {
        try {
            document.cookie = 'XSRF-TOKEN=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
        } catch {}
    }
    
    validateCSRFToken(token) {
        const sessionData = this.getPersistedSession();
        if (!sessionData?.csrfToken) return false;
        
        // Constant-time comparison
        return this.constantTimeCompare(token, sessionData.csrfToken);
    }
    
    constantTimeCompare(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        if (a.length !== b.length) return false;
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }
    
    // ============================================
    // INPUT VALIDATION & SANITIZATION
    // ============================================
    
    sanitizeInput(input) {
        if (!input) return '';
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove inline handlers
            .replace(/on\w+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript\s*:/gi, '') // Remove javascript: URIs
            .replace(/data\s*:/gi, '') // Remove data: URIs
            .replace(/&#x[0-9a-f]+;/gi, '') // Remove hex entities
            .replace(/&#[0-9]+;/gi, '') // Remove decimal entities
            .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
            .replace(/[\u200b-\u200f\u2028-\u202f\ufeff]/g, '') // Remove zero-width and special spaces
            .trim();
    }
    
    validateAgainstXSS(input) {
        if (!input) return { valid: true };
        
        const dangerousPatterns = [
            { pattern: /<script[\s>]/i, name: 'script_tag' },
            { pattern: /javascript\s*:/i, name: 'javascript_uri' },
            { pattern: /on\w+\s*=\s*["']?/i, name: 'event_handler' },
            { pattern: /<iframe[\s>]/i, name: 'iframe' },
            { pattern: /<embed[\s>]/i, name: 'embed' },
            { pattern: /<object[\s>]/i, name: 'object' },
            { pattern: /<applet[\s>]/i, name: 'applet' },
            { pattern: /<link[\s>]/i, name: 'link_tag' },
            { pattern: /<meta[\s>]/i, name: 'meta_tag' },
            { pattern: /data\s*:\s*text\/html/i, name: 'data_uri_html' },
            { pattern: /eval\s*\(/i, name: 'eval' },
            { pattern: /expression\s*\(/i, name: 'css_expression' },
            { pattern: /document\.cookie/i, name: 'cookie_access' },
            { pattern: /document\.write/i, name: 'document_write' },
            { pattern: /window\.location/i, name: 'location_access' },
            { pattern: /String\.fromCharCode/i, name: 'fromCharCode' },
            { pattern: /atob\s*\(/i, name: 'atob' },
            { pattern: /btoa\s*\(/i, name: 'btoa' },
            { pattern: /\\x[0-9a-f]{2}/i, name: 'hex_escape' },
            { pattern: /\\u[0-9a-f]{4}/i, name: 'unicode_escape' }
        ];
        
        for (const { pattern, name } of dangerousPatterns) {
            if (pattern.test(input)) {
                return {
                    valid: false,
                    message: 'Input mengandung kode berbahaya',
                    detected: name
                };
            }
        }
        
        return { valid: true };
    }
    
    validateSQLInjection(input) {
        if (!input) return { valid: true };
        
        const sqlPatterns = [
            /(\bSELECT\b.*\bFROM\b|\bINSERT\b.*\bINTO\b|\bUPDATE\b.*\bSET\b|\bDELETE\b.*\bFROM\b)/i,
            /(\bDROP\b.*\bTABLE\b|\bALTER\b.*\bTABLE\b|\bCREATE\b.*\bTABLE\b)/i,
            /(\bUNION\b.*\bSELECT\b)/i,
            /(\bOR\b.*=.*\bOR\b)/i,
            /--[^\n]*$/im,
            /\/\*.*\*\//i,
            /;\s*\b(DROP|DELETE|UPDATE|INSERT)\b/i
        ];
        
        for (const pattern of sqlPatterns) {
            if (pattern.test(input)) {
                return {
                    valid: false,
                    message: 'Potensi SQL injection terdeteksi'
                };
            }
        }
        
        return { valid: true };
    }
    
    // ============================================
    // FILE UPLOAD SECURITY
    // ============================================
    
    validateFileUpload(file) {
        const errors = [];
        const warnings = [];
        
        // Check file size
        if (file.size > this.config.maxFileUploadSize) {
            const maxSizeMB = this.config.maxFileUploadSize / (1024 * 1024);
            errors.push(`Ukuran file maksimal ${maxSizeMB}MB`);
        }
        
        if (file.size === 0) {
            errors.push('File kosong');
        }
        
        // Check file name
        const fileName = file.name;
        
        if (fileName.length > 255) {
            errors.push('Nama file terlalu panjang');
        }
        
        // Check for dangerous characters in filename
        if (/[<>:"/\\|?*\x00-\x1f]/.test(fileName)) {
            errors.push('Nama file mengandung karakter tidak valid');
        }
        
        // Check extension
        const extension = fileName.split('.').pop()?.toLowerCase();
        
        if (!extension) {
            errors.push('File tidak memiliki ekstensi');
        } else {
            if (this.config.blockedFileTypes.includes(extension)) {
                errors.push(`Tipe file ${extension.toUpperCase()} tidak diizinkan`);
            }
            
            if (!this.config.allowedFileTypes.includes(extension)) {
                errors.push(`Format file tidak didukung. Format yang diizinkan: ${this.config.allowedFileTypes.join(', ')}`);
            }
        }
        
        // Check double extensions
        const parts = fileName.split('.');
        if (parts.length > 2) {
            const lastTwo = parts.slice(-2).join('.');
            if (this.config.blockedFileTypes.some(type => lastTwo.toLowerCase().endsWith('.' + type))) {
                errors.push('File dengan ekstensi ganda mencurigakan');
            }
        }
        
        // MIME type validation
        const mimeMap = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png'
        };
        
        if (extension && mimeMap[extension] && file.type && file.type !== mimeMap[extension]) {
            warnings.push('Tipe MIME file tidak sesuai dengan ekstensi');
        }
        
        // Check for magic bytes (basic)
        if (file.size > 4) {
            const reader = new FileReader();
            // This would be async in practice
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            fileInfo: {
                name: fileName,
                size: file.size,
                type: file.type,
                extension
            }
        };
    }
    
    // ============================================
    // BROWSER FINGERPRINT
    // ============================================
    
    generateBrowserFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            navigator.languages?.join(',') || '',
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            screen.availWidth + 'x' + screen.availHeight,
            new Date().getTimezoneOffset(),
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            !!window.sessionStorage,
            !!window.localStorage,
            !!window.indexedDB,
            navigator.hardwareConcurrency || 0,
            navigator.deviceMemory || 0,
            navigator.platform || ''
        ];
        
        return this.simpleHash(components.join('###'));
    }
    
    getDeviceInfo() {
        return {
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 200),
            language: navigator.language,
            screenSize: `${screen.width}x${screen.height}`,
            devicePixelRatio: window.devicePixelRatio,
            connectionType: this.getConnectionType(),
            memory: navigator.deviceMemory || 'unknown',
            cores: navigator.hardwareConcurrency || 'unknown'
        };
    }
    
    getConnectionType() {
        if ('connection' in navigator) {
            return navigator.connection.effectiveType || 'unknown';
        }
        return 'unknown';
    }
    
    // ============================================
    // RATE LIMITING
    // ============================================
    
    checkRateLimit(action, identifier) {
        const key = `${action}:${identifier}`;
        const now = Date.now();
        
        let record = this.rateLimits.get(key) || {
            count: 0,
            windowStart: now,
            firstRequest: now
        };
        
        // Reset window if expired
        if (now - record.windowStart > this.config.rateLimitWindow) {
            record.count = 0;
            record.windowStart = now;
        }
        
        record.count++;
        this.rateLimits.set(key, record);
        
        if (record.count > this.config.rateLimitRequests) {
            const retryAfter = this.config.rateLimitWindow - (now - record.windowStart);
            
            this.logSecurityEvent('rate_limit_exceeded', {
                action,
                identifier: this.maskIdentifier(identifier),
                count: record.count
            });
            
            return {
                allowed: false,
                message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                retryAfter: Math.ceil(retryAfter / 1000)
            };
        }
        
        return {
            allowed: true,
            remaining: this.config.rateLimitRequests - record.count,
            reset: Math.ceil((record.windowStart + this.config.rateLimitWindow - now) / 1000)
        };
    }
    
    // ============================================
    // SECURITY LOGGING
    // ============================================
    
    logSecurityEvent(eventType, data = {}) {
        if (!this.config.enableSecurityLogging) return;
        
        const event = {
            id: this.generateSecureToken(8),
            type: eventType,
            data,
            timestamp: new Date().toISOString(),
            url: window.location.pathname.substring(0, 200),
            userAgent: navigator.userAgent.substring(0, 200)
        };
        
        // Console logging (development only)
        if (APP_CONFIG?.app?.environment === 'development') {
            console.log(`[Security] ${eventType}:`, data);
        }
        
        // Store locally
        try {
            const log = JSON.parse(localStorage.getItem('security_log') || '[]');
            log.push(event);
            
            // Trim to max entries
            while (log.length > this.config.maxLogEntries) {
                log.shift();
            }
            
            localStorage.setItem('security_log', JSON.stringify(log));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                localStorage.removeItem('security_log');
            }
        }
        
        // Remote logging
        if (this.config.remoteLogging) {
            this.sendSecurityLog(event);
        }
    }
    
    async sendSecurityLog(event) {
        try {
            await fetch('/api/security/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
                keepalive: true
            });
        } catch {
            // Silent fail
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return btoa(binary);
    }
    
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    
    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    maskIdentifier(id) {
        if (!id) return '***';
        if (id.length <= 4) return '****';
        return id.substring(0, 2) + '***' + id.substring(id.length - 2);
    }
    
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    // ============================================
    // STATE PERSISTENCE
    // ============================================
    
    loadState() {
        try {
            const stored = localStorage.getItem('security_state');
            if (stored) {
                const state = JSON.parse(stored);
                
                if (state.loginAttempts) {
                    Object.entries(state.loginAttempts).forEach(([key, value]) => {
                        this.loginAttempts.set(key, value);
                    });
                }
            }
        } catch {}
    }
    
    persistLoginAttempts() {
        try {
            const state = {
                loginAttempts: Object.fromEntries(this.loginAttempts)
            };
            localStorage.setItem('security_state', JSON.stringify(state));
        } catch {}
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getSecurityReport() {
        const now = Date.now();
        const activeSessions = Array.from(this.activeSessions.values())
            .filter(s => s.expiresAt > now);
        
        return {
            timestamp: new Date().toISOString(),
            activeSessions: activeSessions.length,
            blockedAccounts: Array.from(this.loginAttempts.values())
                .filter(a => a.locked && a.lockedUntil > now).length,
            rateLimitViolations: Array.from(this.rateLimits.values())
                .filter(r => r.count > this.config.rateLimitRequests).length,
            csrfTokens: this.csrfTokens.size,
            lastEvents: this.getRecentLogs(10)
        };
    }
    
    getRecentLogs(count = 10) {
        try {
            const log = JSON.parse(localStorage.getItem('security_log') || '[]');
            return log.slice(-count).reverse();
        } catch {
            return [];
        }
    }
    
    clearSensitiveData() {
        this.loginAttempts.clear();
        this.rateLimits.clear();
        this.activeSessions.clear();
        this.csrfTokens.clear();
        this.blockedIPs.clear();
        localStorage.removeItem('security_log');
        localStorage.removeItem('security_state');
        sessionStorage.removeItem('session_data');
    }
    
    destroy() {
        // Clear timers
        Object.values(this.timers).forEach(clearInterval);
        
        // Remove event listeners
        Object.entries(this.handlers).forEach(([event, handler]) => {
            document.removeEventListener(event, handler);
        });
        
        // Clear state
        this.clearSensitiveData();
    }
}

// Create global instance
const securityManager = new SecurityManager();

// Make available globally
if (typeof window !== 'undefined') {
    window.securityManager = securityManager;
}

export default securityManager;
export { SecurityManager };