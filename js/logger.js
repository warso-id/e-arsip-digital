<<<<<<< HEAD
// js/logger.js - Advanced Logging System 2026
/**
 * E-Arsip Digital - Advanced Logger
 * Version: 2026.1.0
 * Features: Structured logging, log levels, remote logging, performance tracking
 */

import APP_CONFIG from '../config/config.js';
import { EncryptionService } from './security/encryption.js';
=======
// js/logger.js - Fixed Logging Utility 2026
/**
 * E-Arsip Digital - Logger
 * Version: 2026.1.0
 * ⚠️ FIXED: No circular dependency with EncryptionService
 */

import APP_CONFIG from '../config/config.js';
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216

class Logger {
    constructor(module = 'App') {
        this.module = module;
        this.config = APP_CONFIG.logging || {};
<<<<<<< HEAD
        this.encryption = new EncryptionService();
        
        // Log levels with numeric values
=======
        
        // ⬇️ FIX: Jangan import EncryptionService di constructor - lazy load
        this.encryption = null;
        
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4,
            NONE: 5
        };
        
<<<<<<< HEAD
        // Current log level
        this.currentLevel = this.LEVELS[this.config.level?.toUpperCase()] || this.LEVELS.INFO;
        
        // Log buffer for batch processing
        this.buffer = [];
        this.bufferSize = 50;
        this.flushInterval = 30000; // 30 seconds
        
        // Performance tracking
        this.perfMarkers = new Map();
        
        // Remote logging
        this.remoteEndpoint = this.config.remoteUrl || '';
        this.remoteEnabled = this.config.remoteEnabled || false;
        
        // Sensitive data patterns to mask
=======
        this.currentLevel = this.LEVELS[this.config.level?.toUpperCase()] || this.LEVELS.INFO;
        this.buffer = [];
        this.bufferSize = 50;
        this.flushInterval = 30000;
        this.remoteEndpoint = this.config.remoteUrl || '';
        this.remoteEnabled = this.config.remoteEnabled || false;
        
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.sensitivePatterns = (this.config.sensitive || [
            'password', 'token', 'secret', 'key', 'auth',
            'credential', 'private', 'ssn', 'credit'
        ]).map(pattern => new RegExp(pattern, 'gi'));
        
<<<<<<< HEAD
        // Console output control
        this.consoleEnabled = this.config.consoleEnabled !== false;
        
        // Initialize
=======
        this.consoleEnabled = this.config.consoleEnabled !== false;
        
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.init();
    }
    
    init() {
<<<<<<< HEAD
        // Setup periodic flush
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (this.remoteEnabled) {
            this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
        }
        
<<<<<<< HEAD
        // Setup error handlers
        this.setupGlobalHandlers();
        
        // Log initialization
=======
        this.setupGlobalHandlers();
        
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.debug('Logger initialized', {
            module: this.module,
            level: this.getLevelName(this.currentLevel),
            remoteEnabled: this.remoteEnabled
        });
    }
    
<<<<<<< HEAD
    setupGlobalHandlers() {
        // Capture uncaught errors
=======
    // ⬇️ FIX: Lazy load encryption only when needed
    async getEncryption() {
        if (!this.encryption) {
            try {
                const { EncryptionService } = await import('./security/encryption.js');
                this.encryption = new EncryptionService();
            } catch (error) {
                console.warn('Encryption not available for logging');
                this.encryption = null;
            }
        }
        return this.encryption;
    }
    
    setupGlobalHandlers() {
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        window.addEventListener('error', (event) => {
            this.error('Uncaught error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
<<<<<<< HEAD
        // Capture unhandled promise rejections
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack
            });
        });
<<<<<<< HEAD
        
        // Capture console.error calls
        const originalError = console.error;
        console.error = (...args) => {
            this.error('Console error', { args: this.sanitize(args) });
            originalError.apply(console, args);
        };
    }
    
    // Core logging methods
    debug(message, data = null) {
        this.log('DEBUG', message, data);
    }
    
    info(message, data = null) {
        this.log('INFO', message, data);
    }
    
    warn(message, data = null) {
        this.log('WARN', message, data);
    }
    
    error(message, data = null) {
        this.log('ERROR', message, data);
    }
    
    fatal(message, data = null) {
        this.log('FATAL', message, data);
    }
    
    log(level, message, data = null) {
        const levelValue = this.LEVELS[level];
        
        // Check if we should log this level
        if (levelValue < this.currentLevel) {
            return;
        }
        
        const logEntry = this.createLogEntry(level, message, data);
        
        // Output to console
=======
    }
    
    debug(message, data = null) { this.log('DEBUG', message, data); }
    info(message, data = null) { this.log('INFO', message, data); }
    warn(message, data = null) { this.log('WARN', message, data); }
    error(message, data = null) { this.log('ERROR', message, data); }
    fatal(message, data = null) { this.log('FATAL', message, data); }
    
    log(level, message, data = null) {
        const levelValue = this.LEVELS[level];
        if (levelValue < this.currentLevel) return;
        
        const logEntry = this.createLogEntry(level, message, data);
        
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (this.consoleEnabled) {
            this.outputToConsole(logEntry);
        }
        
<<<<<<< HEAD
        // Add to buffer for remote logging
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (this.remoteEnabled && levelValue >= this.LEVELS.WARN) {
            this.bufferLog(logEntry);
        }
        
<<<<<<< HEAD
        // Store in localStorage for diagnostics
        if (levelValue >= this.LEVELS.ERROR) {
            this.storeErrorLog(logEntry);
        }
        
        // Trigger fatal error handling
        if (level === 'FATAL') {
            this.handleFatalError(logEntry);
        }
=======
        if (levelValue >= this.LEVELS.ERROR) {
            this.storeErrorLog(logEntry);
        }
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    }
    
    createLogEntry(level, message, data) {
        return {
            timestamp: new Date().toISOString(),
            level,
            module: this.module,
            message: this.sanitize(message),
            data: this.sanitize(data),
            sessionId: this.getSessionId(),
            userId: this.getUserId(),
            url: window.location?.href,
            userAgent: navigator?.userAgent,
<<<<<<< HEAD
            stackTrace: level === 'ERROR' || level === 'FATAL' ? 
                this.getStackTrace() : null,
            performance: this.getPerformanceMetrics()
=======
            stackTrace: (level === 'ERROR' || level === 'FATAL') ? this.getStackTrace() : null
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        };
    }
    
    outputToConsole(logEntry) {
        const prefix = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.module}]`;
        const message = `${prefix} ${logEntry.message}`;
        
        switch (logEntry.level) {
<<<<<<< HEAD
            case 'DEBUG':
                console.debug(message, logEntry.data || '');
                break;
            case 'INFO':
                console.info(message, logEntry.data || '');
                break;
            case 'WARN':
                console.warn(message, logEntry.data || '');
                break;
            case 'ERROR':
                console.error(message, logEntry.data || '');
                break;
            case 'FATAL':
                console.error(`🔴 FATAL: ${message}`, logEntry.data || '');
                break;
=======
            case 'DEBUG': console.debug(message, logEntry.data || ''); break;
            case 'INFO': console.info(message, logEntry.data || ''); break;
            case 'WARN': console.warn(message, logEntry.data || ''); break;
            case 'ERROR': console.error(message, logEntry.data || ''); break;
            case 'FATAL': console.error(`🔴 FATAL: ${message}`, logEntry.data || ''); break;
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        }
    }
    
    bufferLog(logEntry) {
        this.buffer.push(logEntry);
<<<<<<< HEAD
        
        // Auto-flush if buffer is full
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }
    
    async flush() {
        if (this.buffer.length === 0 || !this.remoteEndpoint) return;
        
        const logs = [...this.buffer];
        this.buffer = [];
        
        try {
<<<<<<< HEAD
            const encrypted = this.encryption.encrypt(JSON.stringify(logs));
            
            await fetch(this.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Log-Encrypted': 'true'
                },
                body: JSON.stringify({
                    logs: encrypted,
                    timestamp: Date.now(),
                    version: APP_CONFIG.app.version
                }),
                // Use keepalive for reliability
=======
            const encryption = await this.getEncryption();
            let payload = JSON.stringify(logs);
            
            if (encryption) {
                payload = await encryption.encrypt(payload);
            }
            
            await fetch(this.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: payload, timestamp: Date.now(), version: APP_CONFIG.app?.version || '2026.1.0' }),
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
                keepalive: true
            });
            
            this.debug('Logs flushed successfully', { count: logs.length });
        } catch (error) {
<<<<<<< HEAD
            // Silently fail - don't create infinite loop
            if (this.consoleEnabled) {
                console.warn('Failed to flush logs:', error.message);
            }
            
            // Put logs back in buffer for retry
            this.buffer.unshift(...logs);
            
            // Limit buffer size
=======
            if (this.consoleEnabled) {
                console.warn('Failed to flush logs:', error.message);
            }
            this.buffer.unshift(...logs);
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
            if (this.buffer.length > 200) {
                this.buffer = this.buffer.slice(0, 200);
            }
        }
    }
    
    storeErrorLog(logEntry) {
        try {
            const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
            errors.push({
                ...logEntry,
                data: logEntry.data ? JSON.stringify(logEntry.data) : null
            });
            
<<<<<<< HEAD
            // Keep only last 100 errors
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
            if (errors.length > 100) {
                errors.splice(0, errors.length - 100);
            }
            
            localStorage.setItem('error_logs', JSON.stringify(errors));
        } catch (error) {
            // Silently fail
        }
    }
    
<<<<<<< HEAD
    handleFatalError(logEntry) {
        // Notify error tracking service
        if (window.Sentry) {
            window.Sentry.captureException(new Error(logEntry.message), {
                extra: logEntry.data
            });
        }
        
        // Show user-friendly error message
        this.showFatalErrorMessage(logEntry);
    }
    
    showFatalErrorMessage(logEntry) {
        const errorHtml = `
            <div class="fatal-error-overlay">
                <div class="fatal-error-dialog">
                    <h2>⚠️ Terjadi Kesalahan Serius</h2>
                    <p>Maaf, terjadi kesalahan yang tidak terduga.</p>
                    <p class="error-details">${logEntry.message}</p>
                    <p>Silakan muat ulang halaman atau hubungi administrator.</p>
                    <div class="fatal-error-actions">
                        <button onclick="location.reload()">Muat Ulang</button>
                        <button onclick="location.href='/'">Kembali ke Beranda</button>
                    </div>
                    <p class="error-id">Error ID: ${this.generateErrorId()}</p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', errorHtml);
    }
    
    // Performance tracking
    startTimer(marker) {
        this.perfMarkers.set(marker, performance.now());
        return marker;
    }
    
    endTimer(marker) {
        const startTime = this.perfMarkers.get(marker);
        if (!startTime) return null;
        
        const duration = performance.now() - startTime;
        this.perfMarkers.delete(marker);
        
        this.debug(`Timer: ${marker}`, { duration: `${duration.toFixed(2)}ms` });
        
        return duration;
    }
    
    measure(label, callback) {
        const marker = this.startTimer(label);
        const result = callback();
        this.endTimer(marker);
        return result;
    }
    
    async measureAsync(label, callback) {
        const marker = this.startTimer(label);
        const result = await callback();
        this.endTimer(marker);
        return result;
    }
    
    // Utility methods
    sanitize(data) {
        if (!data) return data;
        
        // Handle strings
=======
    sanitize(data) {
        if (!data) return data;
        
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (typeof data === 'string') {
            let sanitized = data;
            this.sensitivePatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '***REDACTED***');
            });
            return sanitized;
        }
        
<<<<<<< HEAD
        // Handle objects
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (typeof data === 'object') {
            try {
                const json = JSON.stringify(data);
                let sanitized = json;
                this.sensitivePatterns.forEach(pattern => {
                    sanitized = sanitized.replace(pattern, '***REDACTED***');
                });
                return JSON.parse(sanitized);
            } catch {
                return String(data);
            }
        }
        
        return data;
    }
    
    getSessionId() {
<<<<<<< HEAD
        return localStorage.getItem('session_id') || 'unknown';
=======
        try {
            return sessionStorage.getItem('session_id') || localStorage.getItem('session_id') || 'unknown';
        } catch {
            return 'unknown';
        }
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    }
    
    getUserId() {
        try {
            const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
            return session.user?.id || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }
    
    getStackTrace() {
        try {
            throw new Error();
        } catch (error) {
<<<<<<< HEAD
            return error.stack?.split('\n').slice(2, 8).join('\n') || 'Stack unavailable';
        }
    }
    
    getPerformanceMetrics() {
        if (!window.performance) return null;
        
        const timing = performance.timing;
        const navigation = performance.getEntriesByType('navigation')[0];
        
        return {
            pageLoadTime: timing.loadEventEnd - timing.navigationStart,
            domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: performance.getEntriesByType('paint')
                .find(e => e.name === 'first-contentful-paint')?.startTime,
            memory: performance.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            } : null,
            type: navigation?.type
        };
    }
    
=======
            return error.stack?.split('\n').slice(2, 6).join('\n') || 'Stack unavailable';
        }
    }
    
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    getLevelName(value) {
        return Object.keys(this.LEVELS).find(key => this.LEVELS[key] === value) || 'UNKNOWN';
    }
    
<<<<<<< HEAD
    generateErrorId() {
        return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    setLevel(level) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue !== undefined) {
            this.currentLevel = levelValue;
<<<<<<< HEAD
            this.info('Log level changed', { level });
        }
    }
    
    enableRemoteLogging(endpoint) {
        this.remoteEnabled = true;
        this.remoteEndpoint = endpoint;
        this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    }
    
    disableRemoteLogging() {
        this.remoteEnabled = false;
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
    }
    
    // Get error history
    getErrorHistory() {
        try {
            const errors = localStorage.getItem('error_logs');
            return errors ? JSON.parse(errors) : [];
        } catch {
            return [];
        }
    }
    
    clearErrorHistory() {
        localStorage.removeItem('error_logs');
    }
    
    // Destroy logger
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flush();
        this.buffer = [];
        this.perfMarkers.clear();
    }
}

// Export as singleton
const logger = new Logger('Core');

export default logger;
export { Logger };
=======
        }
    }
    
    destroy() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flush();
        this.buffer = [];
    }
}

// Create singleton
const logger = new Logger('Core');

export default logger;
export { Logger };
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
