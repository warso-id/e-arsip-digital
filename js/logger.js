// js/logger.js - Advanced Secure Logging System 2026
/**
 * E-Arsip Digital - Professional Logger
 * Version: 2026.1.0
 * Features: Structured logging, lazy-loaded encryption, security, performance tracking, PWA-ready
 * Security: XSS prevention, sensitive data masking, secure remote logging
 */

import APP_CONFIG from '../config/config.js';

class Logger {
    constructor(module = 'App') {
        this.module = module;
        this.config = APP_CONFIG.logging || {};
        
        // ✅ FIX: Lazy load encryption untuk hindari circular dependency
        this.encryption = null;
        this.encryptionLoading = false;
        this.encryptionPromise = null;
        
        // Log levels
        this.LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4,
            NONE: 5
        };
        
        this.currentLevel = this.LEVELS[this.config.level?.toUpperCase()] || this.LEVELS.INFO;
        
        // Buffer untuk batch remote logging
        this.buffer = [];
        this.bufferSize = this.config.bufferSize || 50;
        this.flushInterval = this.config.flushInterval || 30000;
        
        // Performance tracking (untuk monitoring)
        this.perfMarkers = new Map();
        
        // Remote logging config
        this.remoteEndpoint = this.config.remoteUrl || '';
        this.remoteEnabled = this.config.remoteEnabled || false;
        this.remoteRetryCount = 3;
        this.remoteRetryDelay = 5000;
        
        // Sensitive data patterns (diperluas untuk keamanan)
        this.sensitivePatterns = (this.config.sensitive || [
            'password', 'token', 'secret', 'key', 'auth',
            'credential', 'private', 'ssn', 'credit',
            'api[_]?key', 'bearer', 'authorization',
            'session', 'csrf', 'xsrf'
        ]).map(pattern => new RegExp(pattern, 'gi'));
        
        // Console output control
        this.consoleEnabled = this.config.consoleEnabled !== false;
        
        // PWA support
        this.isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone || 
                    document.referrer.includes('android-app://');
        
        // Security: CSRF token untuk remote logging
        this.csrfToken = this.getCsrfToken();
        
        // Rate limiting
        this.logCount = 0;
        this.logCountReset = Date.now();
        this.maxLogsPerMinute = this.config.maxLogsPerMinute || 1000;
        
        // Initialize
        this.init();
    }
    
    async init() {
        // Setup periodic flush untuk remote logging
        if (this.remoteEnabled) {
            this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
            // Flush saat page unload (PWA/service worker support)
            if (typeof window !== 'undefined') {
                window.addEventListener('beforeunload', () => this.flush());
                window.addEventListener('pagehide', () => this.flush());
            }
        }
        
        // Setup global error handlers
        this.setupGlobalHandlers();
        
        // Setup PWA-specific handlers
        this.setupPWAHandlers();
        
        // Log initialization
        this.debug('Logger initialized', {
            module: this.module,
            level: this.getLevelName(this.currentLevel),
            remoteEnabled: this.remoteEnabled,
            isPWA: this.isPWA,
            environment: APP_CONFIG.app?.environment || 'production'
        });
    }
    
    // ✅ FIX: Lazy load encryption service dengan retry dan caching
    async getEncryption() {
        if (this.encryption) {
            return this.encryption;
        }
        
        if (this.encryptionLoading) {
            return this.encryptionPromise;
        }
        
        this.encryptionLoading = true;
        this.encryptionPromise = this.loadEncryptionService();
        
        try {
            this.encryption = await this.encryptionPromise;
            return this.encryption;
        } finally {
            this.encryptionLoading = false;
        }
    }
    
    async loadEncryptionService(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const module = await import('./security/encryption.js');
                const service = new module.EncryptionService();
                this.debug('Encryption service loaded successfully', { attempt });
                return service;
            } catch (error) {
                this.warn(`Failed to load encryption (attempt ${attempt}/${maxRetries})`, {
                    error: error.message
                });
                
                if (attempt === maxRetries) {
                    this.error('Encryption service unavailable - logging without encryption');
                    return null;
                }
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        return null;
    }
    
    // ✅ IMPROVED: Global error handlers dengan sanitasi
    setupGlobalHandlers() {
        // Capture uncaught errors
        window.addEventListener('error', (event) => {
            // Hindari logging error dari ekstensi browser
            if (event.filename?.includes('extension://') || 
                event.filename?.includes('chrome-extension://')) {
                return;
            }
            
            this.error('Uncaught error', {
                message: this.sanitize(event.message),
                filename: this.sanitize(event.filename),
                lineno: event.lineno,
                colno: event.colno,
                stack: this.sanitize(event.error?.stack)
            });
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled rejection', {
                reason: this.sanitize(event.reason?.message || String(event.reason)),
                stack: this.sanitize(event.reason?.stack)
            });
        });
        
        // Security: Monitor console.error untuk deteksi serangan
        const originalError = console.error;
        console.error = (...args) => {
            const errorMessage = args.map(arg => {
                if (arg instanceof Error) {
                    return arg.message;
                }
                return String(arg);
            }).join(' ');
            
            // Deteksi pola serangan umum
            if (this.detectAttackPattern(errorMessage)) {
                this.warn('Potential attack detected', { 
                    pattern: 'console_error',
                    message: this.sanitize(errorMessage)
                });
            }
            
            this.error('Console error', { 
                args: this.sanitize(args.map(a => String(a)))
            });
            
            originalError.apply(console, args);
        };
    }
    
    // ✅ NEW: PWA-specific handlers
    setupPWAHandlers() {
        if (!this.isPWA && !('serviceWorker' in navigator)) return;
        
        // Monitor service worker status
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                this.debug('Service Worker ready', {
                    scope: registration.scope,
                    active: !!registration.active
                });
                
                registration.addEventListener('updatefound', () => {
                    this.info('Service Worker update found');
                });
            }).catch(error => {
                this.warn('Service Worker registration failed', {
                    error: error.message
                });
            });
        }
        
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.info('App is online - syncing logs');
            this.flush();
        });
        
        window.addEventListener('offline', () => {
            this.warn('App is offline - logs will be queued');
        });
    }
    
    // ✅ NEW: Deteksi pola serangan
    detectAttackPattern(message) {
        const attackPatterns = [
            /<script[^>]*>/i,           // XSS
            /eval\s*\(/i,                // Code injection
            /document\.cookie/i,          // Cookie theft
            /\.innerHTML\s*=/i,          // DOM XSS
            /javascript\s*:/i,           // JavaScript URI
            /onerror\s*=/i,              // Event handler injection
            /FROM\s+information_schema/i, // SQL injection probe
            /UNION\s+SELECT/i,           // SQL injection
            /<iframe/i,                  // Clickjacking
            /data\s*:/i                  // Data URI attack
        ];
        
        return attackPatterns.some(pattern => pattern.test(message));
    }
    
    // ✅ IMPROVED: Rate limiting untuk mencegah DoS
    checkRateLimit() {
        const now = Date.now();
        if (now - this.logCountReset > 60000) {
            this.logCount = 0;
            this.logCountReset = now;
        }
        
        this.logCount++;
        if (this.logCount > this.maxLogsPerMinute) {
            this.warn('Rate limit exceeded', {
                current: this.logCount,
                max: this.maxLogsPerMinute
            });
            return false;
        }
        return true;
    }
    
    // Core logging methods dengan rate limiting
    debug(message, data = null) {
        if (!this.checkRateLimit()) return;
        this.log('DEBUG', message, data);
    }
    
    info(message, data = null) {
        if (!this.checkRateLimit()) return;
        this.log('INFO', message, data);
    }
    
    warn(message, data = null) {
        if (!this.checkRateLimit()) return;
        this.log('WARN', message, data);
    }
    
    error(message, data = null) {
        if (!this.checkRateLimit()) return;
        this.log('ERROR', message, data);
    }
    
    fatal(message, data = null) {
        this.log('FATAL', message, data);
    }
    
    log(level, message, data = null) {
        const levelValue = this.LEVELS[level];
        
        // Check log level
        if (levelValue < this.currentLevel) {
            return;
        }
        
        try {
            const logEntry = this.createLogEntry(level, message, data);
            
            // Output to console (dengan styling untuk PWA)
            if (this.consoleEnabled) {
                this.outputToConsole(logEntry);
            }
            
            // Buffer untuk remote logging (hanya WARN ke atas)
            if (this.remoteEnabled && levelValue >= this.LEVELS.WARN) {
                this.bufferLog(logEntry);
            }
            
            // Store error logs di localStorage
            if (levelValue >= this.LEVELS.ERROR) {
                this.storeErrorLog(logEntry);
            }
            
            // Handle fatal errors
            if (level === 'FATAL') {
                this.handleFatalError(logEntry);
            }
            
            // Security audit trail untuk aksi penting
            if (levelValue >= this.LEVELS.ERROR) {
                this.addToAuditTrail(logEntry);
            }
        } catch (error) {
            // Fallback logging jika terjadi error di logger sendiri
            console.error('Logger error:', error);
        }
    }
    
    createLogEntry(level, message, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            module: this.module,
            message: this.sanitize(message),
            data: this.sanitize(data),
            sessionId: this.getSessionId(),
            userId: this.getUserId(),
            url: this.sanitize(window.location?.href || ''),
            userAgent: navigator?.userAgent || 'Unknown',
            platform: navigator?.platform || 'Unknown',
            isPWA: this.isPWA,
            connectionType: this.getConnectionType(),
            stackTrace: (level === 'ERROR' || level === 'FATAL') ? 
                this.getStackTrace() : null,
            performance: (level === 'DEBUG') ? 
                this.getPerformanceMetrics() : null
        };
        
        // Generate unique log ID
        entry.logId = this.generateLogId(entry);
        
        return entry;
    }
    
    // ✅ IMPROVED: Console output dengan styling
    outputToConsole(logEntry) {
        const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
        const prefix = `[${timestamp}] [${logEntry.level}] [${logEntry.module}]`;
        const message = `${prefix} ${logEntry.message}`;
        
        // Styling untuk membedakan level
        const styles = {
            DEBUG: 'color: #7f8c8d',
            INFO: 'color: #2ecc71',
            WARN: 'color: #f39c12; font-weight: bold',
            ERROR: 'color: #e74c3c; font-weight: bold',
            FATAL: 'color: #fff; background: #c0392b; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
        };
        
        const style = styles[logEntry.level] || '';
        
        switch (logEntry.level) {
            case 'DEBUG':
                console.debug(`%c${message}`, style, logEntry.data || '');
                break;
            case 'INFO':
                console.info(`%c${message}`, style, logEntry.data || '');
                break;
            case 'WARN':
                console.warn(`%c${message}`, style, logEntry.data || '');
                break;
            case 'ERROR':
                console.error(`%c${message}`, style, logEntry.data || '');
                break;
            case 'FATAL':
                console.error(`%c${message}`, style, logEntry.data || '');
                break;
        }
    }
    
    bufferLog(logEntry) {
        this.buffer.push(logEntry);
        
        // Auto-flush jika buffer penuh
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }
    
    // ✅ IMPROVED: Remote logging dengan retry, enkripsi, dan CSRF protection
    async flush(retryCount = 0) {
        if (this.buffer.length === 0 || !this.remoteEndpoint) return;
        
        const logs = [...this.buffer];
        this.buffer = [];
        
        try {
            let payload = logs;
            
            // Encrypt jika encryption service tersedia
            const encryption = await this.getEncryption();
            if (encryption) {
                const jsonData = JSON.stringify(logs);
                payload = await encryption.encrypt(jsonData);
            }
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(this.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken,
                    'X-Log-Version': '2026.1.0',
                    'X-App-Version': APP_CONFIG.app?.version || '2026.1.0',
                    'X-Client-Type': this.isPWA ? 'PWA' : 'Web'
                },
                body: JSON.stringify({
                    logs: payload,
                    timestamp: Date.now(),
                    encrypted: !!encryption,
                    version: APP_CONFIG.app?.version || '2026.1.0'
                }),
                signal: controller.signal,
                keepalive: true
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.debug('Logs flushed successfully', { 
                count: logs.length,
                encrypted: !!encryption
            });
            
        } catch (error) {
            if (error.name === 'AbortError') {
                this.warn('Log flush timeout');
            } else {
                this.warn('Failed to flush logs', { 
                    error: error.message,
                    retryCount 
                });
            }
            
            // Retry logic
            if (retryCount < this.remoteRetryCount) {
                this.buffer.unshift(...logs);
                setTimeout(() => {
                    this.flush(retryCount + 1);
                }, this.remoteRetryDelay * (retryCount + 1));
            } else {
                // Store failed logs locally untuk retry nanti
                this.storeFailedLogs(logs);
                
                if (this.consoleEnabled) {
                    console.warn('Max retries reached - logs stored locally');
                }
            }
        }
    }
    
    // ✅ NEW: Simpan log yang gagal dikirim
    storeFailedLogs(logs) {
        try {
            const failedLogs = JSON.parse(localStorage.getItem('failed_logs') || '[]');
            failedLogs.push(...logs);
            
            // Batasi ukuran
            if (failedLogs.length > 500) {
                failedLogs.splice(0, failedLogs.length - 500);
            }
            
            localStorage.setItem('failed_logs', JSON.stringify(failedLogs));
        } catch (error) {
            // Silently fail
        }
    }
    
    // ✅ IMPROVED: Error log storage dengan kompresi
    storeErrorLog(logEntry) {
        try {
            const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
            
            // Simpan versi ringkas
            errors.push({
                timestamp: logEntry.timestamp,
                level: logEntry.level,
                module: logEntry.module,
                message: logEntry.message,
                logId: logEntry.logId,
                url: logEntry.url
            });
            
            // Batasi jumlah
            if (errors.length > 100) {
                errors.splice(0, errors.length - 100);
            }
            
            localStorage.setItem('error_logs', JSON.stringify(errors));
        } catch (error) {
            // Storage full atau error lain
            if (error.name === 'QuotaExceededError') {
                this.clearOldLogs();
            }
        }
    }
    
    // ✅ IMPROVED: Fatal error handling
    handleFatalError(logEntry) {
        // Notify error tracking service
        if (window.Sentry) {
            window.Sentry.captureException(new Error(logEntry.message), {
                extra: {
                    logEntry: logEntry,
                    timestamp: logEntry.timestamp
                }
            });
        }
        
        // Tampilkan error UI
        this.showFatalErrorMessage(logEntry);
    }
    
    showFatalErrorMessage(logEntry) {
        // Hindari multiple fatal error dialogs
        if (document.querySelector('.fatal-error-overlay')) {
            return;
        }
        
        const errorId = this.generateErrorId();
        
        const errorHtml = `
            <div class="fatal-error-overlay" role="alertdialog" aria-modal="true">
                <div class="fatal-error-dialog">
                    <div class="error-icon">⚠️</div>
                    <h2>Terjadi Kesalahan Serius</h2>
                    <p>Maaf, terjadi kesalahan yang tidak terduga pada sistem.</p>
                    <div class="error-details">
                        <p><strong>Deskripsi:</strong> ${this.escapeHtml(logEntry.message)}</p>
                        <p><strong>Error ID:</strong> ${errorId}</p>
                    </div>
                    <p>Silakan coba langkah berikut:</p>
                    <ol>
                        <li>Muat ulang halaman</li>
                        <li>Bersihkan cache browser</li>
                        <li>Hubungi administrator jika masalah berlanjut</li>
                    </ol>
                    <div class="fatal-error-actions">
                        <button onclick="location.reload()" class="btn-primary">
                            🔄 Muat Ulang
                        </button>
                        <button onclick="location.href='/'" class="btn-secondary">
                            🏠 Kembali ke Beranda
                        </button>
                    </div>
                    <p class="error-timestamp">
                        ${new Date().toLocaleString('id-ID')}
                    </p>
                </div>
            </div>
        `;
        
        // Inject styles
        if (!document.getElementById('fatal-error-styles')) {
            const styles = `
                <style id="fatal-error-styles">
                    .fatal-error-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 999999;
                        backdrop-filter: blur(5px);
                    }
                    .fatal-error-dialog {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    }
                    .error-icon {
                        font-size: 48px;
                        margin-bottom: 15px;
                    }
                    .error-details {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 5px;
                        margin: 15px 0;
                        text-align: left;
                        word-break: break-all;
                    }
                    .fatal-error-actions {
                        display: flex;
                        gap: 10px;
                        justify-content: center;
                        margin-top: 20px;
                    }
                    .fatal-error-actions button {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.3s;
                    }
                    .btn-primary {
                        background: #3498db;
                        color: white;
                    }
                    .btn-secondary {
                        background: #95a5a6;
                        color: white;
                    }
                    .fatal-error-actions button:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    }
                </style>
            `;
            document.head.insertAdjacentHTML('beforeend', styles);
        }
        
        document.body.insertAdjacentHTML('beforeend', errorHtml);
        
        // Log fatal error ID
        console.error(`Fatal Error ID: ${errorId}`, logEntry);
    }
    
    // ✅ NEW: Performance tracking methods
    startTimer(marker) {
        this.perfMarkers.set(marker, performance.now());
        return marker;
    }
    
    endTimer(marker) {
        const startTime = this.perfMarkers.get(marker);
        if (!startTime) {
            this.warn(`Timer '${marker}' not found`);
            return null;
        }
        
        const duration = performance.now() - startTime;
        this.perfMarkers.delete(marker);
        
        this.debug(`Timer: ${marker}`, { 
            duration: `${duration.toFixed(2)}ms`,
            marker 
        });
        
        return duration;
    }
    
    measure(label, callback) {
        const marker = this.startTimer(label);
        try {
            const result = callback();
            return result;
        } finally {
            this.endTimer(marker);
        }
    }
    
    async measureAsync(label, callback) {
        const marker = this.startTimer(label);
        try {
            const result = await callback();
            return result;
        } finally {
            this.endTimer(marker);
        }
    }
    
    // ✅ IMPROVED: Sanitasi data untuk mencegah XSS
    sanitize(data) {
        if (!data) return data;
        
        // Handle strings
        if (typeof data === 'string') {
            let sanitized = this.escapeHtml(data);
            this.sensitivePatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '***REDACTED***');
            });
            return sanitized;
        }
        
        // Handle objects (rekursif)
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                return data.map(item => this.sanitize(item));
            }
            
            try {
                const sanitized = {};
                for (const [key, value] of Object.entries(data)) {
                    const sanitizedKey = this.sensitivePatterns.some(p => p.test(key)) 
                        ? '***REDACTED***' 
                        : key;
                    sanitized[sanitizedKey] = this.sanitize(value);
                }
                return sanitized;
            } catch {
                return String(data);
            }
        }
        
        return data;
    }
    
    // Security: Escape HTML entities
    escapeHtml(str) {
        if (typeof str !== 'string') return str;
        
        const htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        return str.replace(/[&<>"'`=\/]/g, char => htmlEntities[char]);
    }
    
    // ✅ IMPROVED: Get CSRF token untuk keamanan
    getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        
        // Fallback: generate token dari session
        try {
            const session = JSON.parse(sessionStorage.getItem('auth_session') || '{}');
            return session.csrfToken || '';
        } catch {
            return '';
        }
    }
    
    // ✅ IMPROVED: Session ID dengan multiple fallback
    getSessionId() {
        try {
            return sessionStorage.getItem('session_id') || 
                   localStorage.getItem('session_id') || 
                   this.generateSessionId();
        } catch {
            return 'unknown';
        }
    }
    
    generateSessionId() {
        const id = `SESS-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
        try {
            sessionStorage.setItem('session_id', id);
        } catch {
            // Storage not available
        }
        return id;
    }
    
    getUserId() {
        try {
            const session = JSON.parse(
                sessionStorage.getItem('auth_session') || 
                localStorage.getItem('auth_session') || 
                '{}'
            );
            return session.user?.id || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }
    
    getConnectionType() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            return {
                type: conn.type || 'unknown',
                effectiveType: conn.effectiveType || 'unknown',
                downlink: conn.downlink,
                rtt: conn.rtt,
                saveData: conn.saveData || false
            };
        }
        return null;
    }
    
    getStackTrace() {
        try {
            throw new Error();
        } catch (error) {
            return error.stack?.split('\n').slice(2, 8).join('\n') || 'Stack unavailable';
        }
    }
    
    getPerformanceMetrics() {
        if (!window.performance) return null;
        
        try {
            const navigation = performance.getEntriesByType('navigation')[0];
            const paintEntries = performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(e => e.name === 'first-paint');
            const firstContentfulPaint = paintEntries.find(e => e.name === 'first-contentful-paint');
            
            return {
                pageLoadTime: navigation ? (navigation.loadEventEnd - navigation.startTime) : null,
                domReady: navigation ? (navigation.domContentLoadedEventEnd - navigation.startTime) : null,
                firstPaint: firstPaint?.startTime,
                firstContentfulPaint: firstContentfulPaint?.startTime,
                memory: performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : null,
                navigationType: navigation?.type
            };
        } catch {
            return null;
        }
    }
    
    getLevelName(value) {
        return Object.keys(this.LEVELS).find(key => this.LEVELS[key] === value) || 'UNKNOWN';
    }
    
    generateErrorId() {
        return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
    
    generateLogId(entry) {
        const data = `${entry.timestamp}-${entry.module}-${entry.message}`;
        return btoa(data).substr(0, 16);
    }
    
    // ✅ NEW: Audit trail untuk security monitoring
    addToAuditTrail(logEntry) {
        try {
            const auditTrail = JSON.parse(sessionStorage.getItem('audit_trail') || '[]');
            auditTrail.push({
                timestamp: logEntry.timestamp,
                level: logEntry.level,
                module: logEntry.module,
                logId: logEntry.logId
            });
            
            // Batasi ukuran
            if (auditTrail.length > 200) {
                auditTrail.splice(0, auditTrail.length - 200);
            }
            
            sessionStorage.setItem('audit_trail', JSON.stringify(auditTrail));
        } catch {
            // Silently fail
        }
    }
    
    // ✅ NEW: Clear old logs jika storage penuh
    clearOldLogs() {
        try {
            const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
            if (errors.length > 50) {
                // Simpan hanya 25 error terbaru
                localStorage.setItem('error_logs', JSON.stringify(errors.slice(-25)));
            }
            
            const failedLogs = JSON.parse(localStorage.getItem('failed_logs') || '[]');
            if (failedLogs.length > 100) {
                localStorage.setItem('failed_logs', JSON.stringify([]));
            }
        } catch {
            // Last resort: clear all
            try {
                localStorage.removeItem('error_logs');
                localStorage.removeItem('failed_logs');
            } catch {}
        }
    }
    
    // Public API methods
    setLevel(level) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue !== undefined) {
            this.currentLevel = levelValue;
            this.info('Log level changed', { 
                from: this.getLevelName(this.currentLevel),
                to: level.toUpperCase()
            });
        }
    }
    
    enableRemoteLogging(endpoint) {
        this.remoteEnabled = true;
        this.remoteEndpoint = endpoint;
        this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
        this.info('Remote logging enabled', { endpoint });
    }
    
    disableRemoteLogging() {
        this.remoteEnabled = false;
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.info('Remote logging disabled');
    }
    
    getErrorHistory() {
        try {
            const errors = localStorage.getItem('error_logs');
            return errors ? JSON.parse(errors) : [];
        } catch {
            return [];
        }
    }
    
    getAuditTrail() {
        try {
            const trail = sessionStorage.getItem('audit_trail');
            return trail ? JSON.parse(trail) : [];
        } catch {
            return [];
        }
    }
    
    clearErrorHistory() {
        localStorage.removeItem('error_logs');
        localStorage.removeItem('failed_logs');
        sessionStorage.removeItem('audit_trail');
        this.info('Error history cleared');
    }
    
    retryFailedLogs() {
        try {
            const failedLogs = JSON.parse(localStorage.getItem('failed_logs') || '[]');
            if (failedLogs.length > 0) {
                this.buffer.unshift(...failedLogs);
                localStorage.removeItem('failed_logs');
                this.flush();
                this.info('Retrying failed logs', { count: failedLogs.length });
            }
        } catch {
            localStorage.removeItem('failed_logs');
        }
    }
    
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flush();
        this.buffer = [];
        this.perfMarkers.clear();
        this.info('Logger destroyed');
    }
}

// Export sebagai singleton
const logger = new Logger('Core');

export default logger;
export { Logger };