// js/logger.js - Advanced Logging System 2026
/**
 * E-Arsip Digital - Advanced Logger
 * Version: 2026.1.0
 * Features: Structured logging, log levels, remote logging, performance tracking
 */

import APP_CONFIG from '../config/config.js';
import { EncryptionService } from './security/encryption.js';

class Logger {
    constructor(module = 'App') {
        this.module = module;
        this.config = APP_CONFIG.logging || {};
        this.encryption = new EncryptionService();
        
        // Log levels with numeric values
        this.LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4,
            NONE: 5
        };
        
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
        this.sensitivePatterns = (this.config.sensitive || [
            'password', 'token', 'secret', 'key', 'auth',
            'credential', 'private', 'ssn', 'credit'
        ]).map(pattern => new RegExp(pattern, 'gi'));
        
        // Console output control
        this.consoleEnabled = this.config.consoleEnabled !== false;
        
        // Initialize
        this.init();
    }
    
    init() {
        // Setup periodic flush
        if (this.remoteEnabled) {
            this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
        }
        
        // Setup error handlers
        this.setupGlobalHandlers();
        
        // Log initialization
        this.debug('Logger initialized', {
            module: this.module,
            level: this.getLevelName(this.currentLevel),
            remoteEnabled: this.remoteEnabled
        });
    }
    
    setupGlobalHandlers() {
        // Capture uncaught errors
        window.addEventListener('error', (event) => {
            this.error('Uncaught error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack
            });
        });
        
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
        if (this.consoleEnabled) {
            this.outputToConsole(logEntry);
        }
        
        // Add to buffer for remote logging
        if (this.remoteEnabled && levelValue >= this.LEVELS.WARN) {
            this.bufferLog(logEntry);
        }
        
        // Store in localStorage for diagnostics
        if (levelValue >= this.LEVELS.ERROR) {
            this.storeErrorLog(logEntry);
        }
        
        // Trigger fatal error handling
        if (level === 'FATAL') {
            this.handleFatalError(logEntry);
        }
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
            stackTrace: level === 'ERROR' || level === 'FATAL' ? 
                this.getStackTrace() : null,
            performance: this.getPerformanceMetrics()
        };
    }
    
    outputToConsole(logEntry) {
        const prefix = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.module}]`;
        const message = `${prefix} ${logEntry.message}`;
        
        switch (logEntry.level) {
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
        }
    }
    
    bufferLog(logEntry) {
        this.buffer.push(logEntry);
        
        // Auto-flush if buffer is full
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }
    
    async flush() {
        if (this.buffer.length === 0 || !this.remoteEndpoint) return;
        
        const logs = [...this.buffer];
        this.buffer = [];
        
        try {
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
                keepalive: true
            });
            
            this.debug('Logs flushed successfully', { count: logs.length });
        } catch (error) {
            // Silently fail - don't create infinite loop
            if (this.consoleEnabled) {
                console.warn('Failed to flush logs:', error.message);
            }
            
            // Put logs back in buffer for retry
            this.buffer.unshift(...logs);
            
            // Limit buffer size
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
            
            // Keep only last 100 errors
            if (errors.length > 100) {
                errors.splice(0, errors.length - 100);
            }
            
            localStorage.setItem('error_logs', JSON.stringify(errors));
        } catch (error) {
            // Silently fail
        }
    }
    
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
        if (typeof data === 'string') {
            let sanitized = data;
            this.sensitivePatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '***REDACTED***');
            });
            return sanitized;
        }
        
        // Handle objects
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
        return localStorage.getItem('session_id') || 'unknown';
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
    
    getLevelName(value) {
        return Object.keys(this.LEVELS).find(key => this.LEVELS[key] === value) || 'UNKNOWN';
    }
    
    generateErrorId() {
        return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    setLevel(level) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue !== undefined) {
            this.currentLevel = levelValue;
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