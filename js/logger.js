// js/logger.js - Fixed Logging Utility 2026
/**
 * E-Arsip Digital - Logger
 * Version: 2026.1.0
 * ⚠️ FIXED: No circular dependency with EncryptionService
 */

import APP_CONFIG from '../config/config.js';

class Logger {
    constructor(module = 'App') {
        this.module = module;
        this.config = APP_CONFIG.logging || {};
        
        // ⬇️ FIX: Jangan import EncryptionService di constructor - lazy load
        this.encryption = null;
        
        this.LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4,
            NONE: 5
        };
        
        this.currentLevel = this.LEVELS[this.config.level?.toUpperCase()] || this.LEVELS.INFO;
        this.buffer = [];
        this.bufferSize = 50;
        this.flushInterval = 30000;
        this.remoteEndpoint = this.config.remoteUrl || '';
        this.remoteEnabled = this.config.remoteEnabled || false;
        
        this.sensitivePatterns = (this.config.sensitive || [
            'password', 'token', 'secret', 'key', 'auth',
            'credential', 'private', 'ssn', 'credit'
        ]).map(pattern => new RegExp(pattern, 'gi'));
        
        this.consoleEnabled = this.config.consoleEnabled !== false;
        
        this.init();
    }
    
    init() {
        if (this.remoteEnabled) {
            this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
        }
        
        this.setupGlobalHandlers();
        
        this.debug('Logger initialized', {
            module: this.module,
            level: this.getLevelName(this.currentLevel),
            remoteEnabled: this.remoteEnabled
        });
    }
    
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
        window.addEventListener('error', (event) => {
            this.error('Uncaught error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack
            });
        });
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
        
        if (this.consoleEnabled) {
            this.outputToConsole(logEntry);
        }
        
        if (this.remoteEnabled && levelValue >= this.LEVELS.WARN) {
            this.bufferLog(logEntry);
        }
        
        if (levelValue >= this.LEVELS.ERROR) {
            this.storeErrorLog(logEntry);
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
            stackTrace: (level === 'ERROR' || level === 'FATAL') ? this.getStackTrace() : null
        };
    }
    
    outputToConsole(logEntry) {
        const prefix = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.module}]`;
        const message = `${prefix} ${logEntry.message}`;
        
        switch (logEntry.level) {
            case 'DEBUG': console.debug(message, logEntry.data || ''); break;
            case 'INFO': console.info(message, logEntry.data || ''); break;
            case 'WARN': console.warn(message, logEntry.data || ''); break;
            case 'ERROR': console.error(message, logEntry.data || ''); break;
            case 'FATAL': console.error(`🔴 FATAL: ${message}`, logEntry.data || ''); break;
        }
    }
    
    bufferLog(logEntry) {
        this.buffer.push(logEntry);
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }
    
    async flush() {
        if (this.buffer.length === 0 || !this.remoteEndpoint) return;
        
        const logs = [...this.buffer];
        this.buffer = [];
        
        try {
            const encryption = await this.getEncryption();
            let payload = JSON.stringify(logs);
            
            if (encryption) {
                payload = await encryption.encrypt(payload);
            }
            
            await fetch(this.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: payload, timestamp: Date.now(), version: APP_CONFIG.app?.version || '2026.1.0' }),
                keepalive: true
            });
            
            this.debug('Logs flushed successfully', { count: logs.length });
        } catch (error) {
            if (this.consoleEnabled) {
                console.warn('Failed to flush logs:', error.message);
            }
            this.buffer.unshift(...logs);
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
            
            if (errors.length > 100) {
                errors.splice(0, errors.length - 100);
            }
            
            localStorage.setItem('error_logs', JSON.stringify(errors));
        } catch (error) {
            // Silently fail
        }
    }
    
    sanitize(data) {
        if (!data) return data;
        
        if (typeof data === 'string') {
            let sanitized = data;
            this.sensitivePatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '***REDACTED***');
            });
            return sanitized;
        }
        
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
        try {
            return sessionStorage.getItem('session_id') || localStorage.getItem('session_id') || 'unknown';
        } catch {
            return 'unknown';
        }
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
            return error.stack?.split('\n').slice(2, 6).join('\n') || 'Stack unavailable';
        }
    }
    
    getLevelName(value) {
        return Object.keys(this.LEVELS).find(key => this.LEVELS[key] === value) || 'UNKNOWN';
    }
    
    setLevel(level) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue !== undefined) {
            this.currentLevel = levelValue;
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
