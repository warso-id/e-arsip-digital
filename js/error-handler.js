// js/error-handler.js - Global Error Handler 2026 (FIXED)
/**
 * E-Arsip Digital - Global Error Handler
 * Version: 2026.1.0
 * ⬇️ FIXED: Import notifications secara dinamis, bukan statis
 */

import { Logger } from './logger.js';
import APP_CONFIG from '../config/config.js';

class ErrorHandler {
    constructor() {
        this.logger = new Logger('ErrorHandler');
        
        this.SEVERITY = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };
        
        this.CATEGORIES = {
            NETWORK: 'network',
            AUTH: 'auth',
            VALIDATION: 'validation',
            API: 'api',
            RUNTIME: 'runtime',
            SECURITY: 'security',
            UNKNOWN: 'unknown'
        };
        
        this.errorHistory = [];
        this.maxHistory = 50;
        this.recoveryStrategies = new Map();
        this.errorRate = { window: 60000, errors: [], threshold: 5 };
        
        // ⬇️ FIX: Lazy load notifications
        this._notifications = null;
        
        this.init();
    }
    
    // ⬇️ FIX: Lazy getter untuk notifications
    async getNotifications() {
        if (!this._notifications) {
            try {
                const module = await import('./notifications.js');
                this._notifications = module.default || module;
            } catch (error) {
                console.warn('Notifications module not available');
                this._notifications = {
                    error: function(msg) { console.error(msg); },
                    warning: function(msg) { console.warn(msg); },
                    info: function(msg) { console.info(msg); },
                    success: function(msg) { console.log(msg); }
                };
            }
        }
        return this._notifications;
    }
    
    init() {
        this.registerDefaultRecoveryStrategies();
        this.setupGlobalHandlers();
        
        this.logger.info('Error handler initialized');
    }
    
    setupGlobalHandlers() {
        window.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message), {
                category: this.CATEGORIES.RUNTIME,
                severity: this.SEVERITY.HIGH,
                source: 'window.onerror'
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error ? 
                event.reason : new Error(String(event.reason));
            
            this.handleError(error, {
                category: this.CATEGORIES.RUNTIME,
                severity: this.SEVERITY.HIGH,
                source: 'unhandledrejection'
            });
        });
    }
    
    handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        this.logError(errorInfo);
        this.trackErrorRate(errorInfo);
        this.addToHistory(errorInfo);
        this.notifyUser(errorInfo);
        this.attemptRecovery(errorInfo);
        this.reportError(errorInfo);
        
        return errorInfo;
    }
    
    classifyError(error, context) {
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            stack: error.stack || '',
            name: error.name || 'Error',
            category: context.category || this.CATEGORIES.UNKNOWN,
            severity: context.severity || this.SEVERITY.MEDIUM,
            source: context.source || 'unknown',
            code: error.code || error.status || null,
            recoverable: context.recoverable !== false,
            handled: false
        };
        
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            errorInfo.category = this.CATEGORIES.RUNTIME;
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorInfo.category = this.CATEGORIES.NETWORK;
        } else if (error.status === 401 || error.status === 403) {
            errorInfo.category = this.CATEGORIES.AUTH;
        }
        
        return errorInfo;
    }
    
    logError(errorInfo) {
        const method = errorInfo.severity === this.SEVERITY.CRITICAL ? 'fatal' :
                       errorInfo.severity === this.SEVERITY.LOW ? 'warn' : 'error';
        
        this.logger[method](errorInfo.message, {
            errorId: errorInfo.id,
            category: errorInfo.category
        });
    }
    
    async notifyUser(errorInfo) {
        if (errorInfo.severity === this.SEVERITY.LOW) return;
        
        const messages = {
            network: 'Gagal terhubung ke server. Periksa koneksi internet.',
            auth: 'Sesi berakhir. Silakan login kembali.',
            api: 'Terjadi kesalahan server. Silakan coba lagi.',
            runtime: 'Terjadi kesalahan aplikasi.',
            unknown: 'Terjadi kesalahan.'
        };
        
        const message = messages[errorInfo.category] || errorInfo.message;
        
        try {
            const notif = await this.getNotifications();
            
            if (errorInfo.severity === this.SEVERITY.CRITICAL || errorInfo.severity === this.SEVERITY.HIGH) {
                notif.error(message, { duration: 10000 });
            } else {
                notif.warning(message, { duration: 5000 });
            }
        } catch {
            console.error(message);
        }
    }
    
    registerDefaultRecoveryStrategies() {
        this.registerRecoveryStrategy(this.CATEGORIES.NETWORK, {
            canRecover: () => navigator.onLine,
            recover: async () => {
                await new Promise(resolve => {
                    if (navigator.onLine) return resolve();
                    window.addEventListener('online', resolve, { once: true });
                });
                window.dispatchEvent(new CustomEvent('app:reconnect'));
                return true;
            }
        });
        
        this.registerRecoveryStrategy(this.CATEGORIES.AUTH, {
            canRecover: () => true,
            recover: async () => {
                localStorage.removeItem('auth_session');
                localStorage.removeItem('auth_token');
                setTimeout(() => {
                    window.location.href = 'login.html?message=session_expired';
                }, 2000);
                return true;
            }
        });
    }
    
    registerRecoveryStrategy(category, strategy) {
        this.recoveryStrategies.set(category, strategy);
    }
    
    async attemptRecovery(errorInfo) {
        if (!errorInfo.recoverable) return false;
        
        const strategy = this.recoveryStrategies.get(errorInfo.category);
        if (!strategy) return false;
        
        try {
            const canRecover = strategy.canRecover();
            if (!canRecover) return false;
            
            const recovered = await strategy.recover(errorInfo);
            if (recovered) errorInfo.recovered = true;
            
            return recovered;
        } catch {
            return false;
        }
    }
    
    trackErrorRate(errorInfo) {
        const now = Date.now();
        this.errorRate.errors.push({ timestamp: now, ...errorInfo });
        this.errorRate.errors = this.errorRate.errors.filter(
            e => now - e.timestamp < this.errorRate.window
        );
    }
    
    addToHistory(errorInfo) {
        this.errorHistory.unshift(errorInfo);
        if (this.errorHistory.length > this.maxHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistory);
        }
    }
    
    async reportError(errorInfo) {
        // Best-effort reporting
        try {
            await fetch('https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec?action=createLog', {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: '',
                    username: 'system',
                    action: 'error',
                    description: errorInfo.message,
                    details: JSON.stringify({
                        errorId: errorInfo.id,
                        category: errorInfo.category,
                        url: window.location.href
                    })
                })
            }).catch(() => {});
        } catch {}
    }
    
    generateErrorId() {
        return 'ERR-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
    }
    
    getStats() {
        return {
            total: this.errorHistory.length,
            byCategory: {},
            bySeverity: {},
            currentRate: this.errorRate.errors.length
        };
    }
    
    clearHistory() {
        this.errorHistory = [];
        this.errorRate.errors = [];
    }
    
    destroy() {
        this.errorHistory = [];
        this.recoveryStrategies.clear();
    }
}

const errorHandler = new ErrorHandler();
window.handleError = (error, context) => errorHandler.handleError(error, context);

export default errorHandler;
export { ErrorHandler };
