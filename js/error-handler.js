<<<<<<< HEAD
// js/error-handler.js - Global Error Handler 2026
/**
 * E-Arsip Digital - Global Error Handler
 * Version: 2026.1.0
 * Features: Centralized error handling, error classification, 
 *           recovery strategies, error reporting
 */

import { Logger } from './logger.js';
import { navigateToAppPath } from './path-utils.js';
import notifications from './notifications.js';
=======
// js/error-handler.js - Global Error Handler 2026 (FIXED)
/**
 * E-Arsip Digital - Global Error Handler
 * Version: 2026.1.0
 * ⬇️ FIXED: Import notifications secara dinamis, bukan statis
 */

import { Logger } from './logger.js';
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
import APP_CONFIG from '../config/config.js';

class ErrorHandler {
    constructor() {
        this.logger = new Logger('ErrorHandler');
        
<<<<<<< HEAD
        // Error severity levels
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.SEVERITY = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };
        
<<<<<<< HEAD
        // Error categories
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.CATEGORIES = {
            NETWORK: 'network',
            AUTH: 'auth',
            VALIDATION: 'validation',
            API: 'api',
            RUNTIME: 'runtime',
            SECURITY: 'security',
            UNKNOWN: 'unknown'
        };
        
<<<<<<< HEAD
        // Error history
        this.errorHistory = [];
        this.maxHistory = 50;
        
        // Recovery strategies
        this.recoveryStrategies = new Map();
        
        // Error rate tracking
        this.errorRate = {
            window: 60000, // 1 minute
            errors: [],
            threshold: 5 // Max errors per window
        };
=======
        this.errorHistory = [];
        this.maxHistory = 50;
        this.recoveryStrategies = new Map();
        this.errorRate = { window: 60000, errors: [], threshold: 5 };
        
        // ⬇️ FIX: Lazy load notifications
        this._notifications = null;
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        
        this.init();
    }
    
<<<<<<< HEAD
=======
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
    
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    init() {
        this.registerDefaultRecoveryStrategies();
        this.setupGlobalHandlers();
        
        this.logger.info('Error handler initialized');
    }
    
<<<<<<< HEAD
    // ============================================
    // GLOBAL HANDLERS
    // ============================================
    
    setupGlobalHandlers() {
        // Uncaught errors
=======
    setupGlobalHandlers() {
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        window.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message), {
                category: this.CATEGORIES.RUNTIME,
                severity: this.SEVERITY.HIGH,
                source: 'window.onerror'
            });
        });
        
<<<<<<< HEAD
        // Unhandled promise rejections
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error ? 
                event.reason : new Error(String(event.reason));
            
            this.handleError(error, {
                category: this.CATEGORIES.RUNTIME,
                severity: this.SEVERITY.HIGH,
                source: 'unhandledrejection'
            });
        });
<<<<<<< HEAD
        
        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError(new Error(`Failed to load: ${event.target.src || event.target.href}`), {
                    category: this.CATEGORIES.NETWORK,
                    severity: this.SEVERITY.LOW,
                    source: 'resource'
                });
            }
        }, true);
    }
    
    // ============================================
    // ERROR HANDLING
    // ============================================
    
    handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        // Log error
        this.logError(errorInfo);
        
        // Track error rate
        this.trackErrorRate(errorInfo);
        
        // Store in history
        this.addToHistory(errorInfo);
        
        // Show user notification based on severity
        this.notifyUser(errorInfo);
        
        // Attempt recovery
        this.attemptRecovery(errorInfo);
        
        // Report to server
=======
    }
    
    handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        this.logError(errorInfo);
        this.trackErrorRate(errorInfo);
        this.addToHistory(errorInfo);
        this.notifyUser(errorInfo);
        this.attemptRecovery(errorInfo);
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
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
<<<<<<< HEAD
            context: context,
            handled: false
        };
        
        // Auto-classify based on error properties
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            errorInfo.category = this.CATEGORIES.RUNTIME;
        } else if (error.name === 'NetworkError' || error.message?.includes('network')) {
            errorInfo.category = this.CATEGORIES.NETWORK;
        } else if (error.status === 401 || error.status === 403) {
            errorInfo.category = this.CATEGORIES.AUTH;
        } else if (error.status === 422 || error.name === 'ValidationError') {
            errorInfo.category = this.CATEGORIES.VALIDATION;
        } else if (error.name === 'SecurityError') {
            errorInfo.category = this.CATEGORIES.SECURITY;
            errorInfo.severity = this.SEVERITY.CRITICAL;
=======
            handled: false
        };
        
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            errorInfo.category = this.CATEGORIES.RUNTIME;
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorInfo.category = this.CATEGORIES.NETWORK;
        } else if (error.status === 401 || error.status === 403) {
            errorInfo.category = this.CATEGORIES.AUTH;
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        }
        
        return errorInfo;
    }
    
    logError(errorInfo) {
<<<<<<< HEAD
        const logMethod = {
            [this.SEVERITY.LOW]: 'warn',
            [this.SEVERITY.MEDIUM]: 'error',
            [this.SEVERITY.HIGH]: 'error',
            [this.SEVERITY.CRITICAL]: 'fatal'
        };
        
        const method = logMethod[errorInfo.severity] || 'error';
        
        this.logger[method](errorInfo.message, {
            errorId: errorInfo.id,
            category: errorInfo.category,
            severity: errorInfo.severity,
            stack: errorInfo.stack?.split('\n').slice(0, 3).join('\n')
        });
    }
    
    notifyUser(errorInfo) {
        // Don't show notification for low severity in production
        if (errorInfo.severity === this.SEVERITY.LOW && 
            APP_CONFIG.app.environment === 'production') {
            return;
        }
        
        const messages = {
            [this.CATEGORIES.NETWORK]: 'Gagal terhubung ke server. Periksa koneksi internet Anda.',
            [this.CATEGORIES.AUTH]: 'Sesi Anda telah berakhir. Silakan login kembali.',
            [this.CATEGORIES.VALIDATION]: 'Data yang dimasukkan tidak valid.',
            [this.CATEGORIES.API]: 'Terjadi kesalahan pada server. Silakan coba lagi.',
            [this.CATEGORIES.RUNTIME]: 'Terjadi kesalahan aplikasi.',
            [this.CATEGORIES.SECURITY]: 'Terjadi pelanggaran keamanan.',
            [this.CATEGORIES.UNKNOWN]: 'Terjadi kesalahan yang tidak diketahui.'
=======
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
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        };
        
        const message = messages[errorInfo.category] || errorInfo.message;
        
<<<<<<< HEAD
        if (errorInfo.severity === this.SEVERITY.CRITICAL) {
            notifications.error(message, {
                duration: 0,
                title: 'Kesalahan Kritis'
            });
        } else if (errorInfo.severity === this.SEVERITY.HIGH) {
            notifications.error(message, { duration: 10000 });
        } else {
            notifications.warning(message, { duration: 5000 });
        }
    }
    
    // ============================================
    // RECOVERY STRATEGIES
    // ============================================
    
    registerRecoveryStrategy(category, strategy) {
        this.recoveryStrategies.set(category, strategy);
    }
    
    registerDefaultRecoveryStrategies() {
        // Network errors - retry with exponential backoff
        this.registerRecoveryStrategy(this.CATEGORIES.NETWORK, {
            canRecover: () => navigator.onLine,
            recover: async () => {
                // Wait for connectivity
=======
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
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
                await new Promise(resolve => {
                    if (navigator.onLine) return resolve();
                    window.addEventListener('online', resolve, { once: true });
                });
<<<<<<< HEAD
                
                // Reload current page data
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
                window.dispatchEvent(new CustomEvent('app:reconnect'));
                return true;
            }
        });
        
<<<<<<< HEAD
        // Auth errors - redirect to login
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        this.registerRecoveryStrategy(this.CATEGORIES.AUTH, {
            canRecover: () => true,
            recover: async () => {
                localStorage.removeItem('auth_session');
                localStorage.removeItem('auth_token');
<<<<<<< HEAD
                
                setTimeout(() => {
                    navigateToAppPath('/login.html?message=session_expired');
                }, 2000);
                
                return true;
            }
        });
        
        // API errors - retry
        this.registerRecoveryStrategy(this.CATEGORIES.API, {
            canRecover: () => true,
            recover: async (errorInfo) => {
                // Dispatch retry event
                window.dispatchEvent(new CustomEvent('app:retry', {
                    detail: { errorId: errorInfo.id }
                }));
=======
                setTimeout(() => {
                    window.location.href = 'login.html?message=session_expired';
                }, 2000);
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
                return true;
            }
        });
    }
    
<<<<<<< HEAD
=======
    registerRecoveryStrategy(category, strategy) {
        this.recoveryStrategies.set(category, strategy);
    }
    
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    async attemptRecovery(errorInfo) {
        if (!errorInfo.recoverable) return false;
        
        const strategy = this.recoveryStrategies.get(errorInfo.category);
        if (!strategy) return false;
        
        try {
            const canRecover = strategy.canRecover();
            if (!canRecover) return false;
            
            const recovered = await strategy.recover(errorInfo);
<<<<<<< HEAD
            
            if (recovered) {
                errorInfo.recovered = true;
                this.logger.info('Error recovered', { errorId: errorInfo.id });
                
                window.dispatchEvent(new CustomEvent('error:recovered', {
                    detail: errorInfo
                }));
            }
            
            return recovered;
        } catch (recoveryError) {
            this.logger.error('Recovery failed', recoveryError);
=======
            if (recovered) errorInfo.recovered = true;
            
            return recovered;
        } catch {
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
            return false;
        }
    }
    
<<<<<<< HEAD
    // ============================================
    // ERROR TRACKING
    // ============================================
    
    trackErrorRate(errorInfo) {
        const now = Date.now();
        
        this.errorRate.errors.push({ timestamp: now, ...errorInfo });
        
        // Remove old entries
        this.errorRate.errors = this.errorRate.errors.filter(
            e => now - e.timestamp < this.errorRate.window
        );
        
        // Check threshold
        if (this.errorRate.errors.length >= this.errorRate.threshold) {
            this.logger.warn('High error rate detected', {
                count: this.errorRate.errors.length,
                window: this.errorRate.window
            });
            
            window.dispatchEvent(new CustomEvent('error:high_rate', {
                detail: {
                    count: this.errorRate.errors.length,
                    threshold: this.errorRate.threshold
                }
            }));
        }
=======
    trackErrorRate(errorInfo) {
        const now = Date.now();
        this.errorRate.errors.push({ timestamp: now, ...errorInfo });
        this.errorRate.errors = this.errorRate.errors.filter(
            e => now - e.timestamp < this.errorRate.window
        );
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    }
    
    addToHistory(errorInfo) {
        this.errorHistory.unshift(errorInfo);
<<<<<<< HEAD
        
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        if (this.errorHistory.length > this.maxHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistory);
        }
    }
    
    async reportError(errorInfo) {
<<<<<<< HEAD
        // Don't report low severity in development
        if (errorInfo.severity === this.SEVERITY.LOW && 
            APP_CONFIG.app.environment === 'development') {
            return;
        }
        
        try {
            const { apiService } = await import('./api.js');
            
            await apiService.post('/api/errors', {
                errorId: errorInfo.id,
                message: errorInfo.message,
                stack: errorInfo.stack?.substring(0, 1000),
                category: errorInfo.category,
                severity: errorInfo.severity,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: errorInfo.timestamp
            }, {
                priority: 'low',
                retries: 1
            }).catch(() => {
                // Silently fail - don't create error loops
            });
        } catch {
            // Ignore
        }
    }
    
    // ============================================
    // ERROR HISTORY & ANALYTICS
    // ============================================
    
    getErrorHistory(options = {}) {
        let history = [...this.errorHistory];
        
        if (options.category) {
            history = history.filter(e => e.category === options.category);
        }
        
        if (options.severity) {
            history = history.filter(e => e.severity === options.severity);
        }
        
        if (options.limit) {
            history = history.slice(0, options.limit);
        }
        
        return history;
    }
    
    getErrorStats() {
        const stats = {
            total: this.errorHistory.length,
            byCategory: {},
            bySeverity: {},
            recovered: 0,
            unrecovered: 0,
            currentRate: this.errorRate.errors.length
        };
        
        this.errorHistory.forEach(error => {
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
            
            if (error.recovered) stats.recovered++;
            else stats.unrecovered++;
        });
        
        return stats;
    }
    
    getRecentErrors(limit = 10) {
        return this.errorHistory.slice(0, limit);
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateErrorId() {
        return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
    }
    
    isNetworkError(error) {
        return error.name === 'NetworkError' ||
               error.message?.includes('network') ||
               error.message?.includes('fetch') ||
               error.message?.includes('Failed to fetch');
    }
    
    isAuthError(error) {
        return error.status === 401 || 
               error.status === 403 ||
               error.message?.includes('unauthorized') ||
               error.message?.includes('token');
    }
    
    createError(message, options = {}) {
        const error = new Error(message);
        error.name = options.name || 'AppError';
        error.status = options.status;
        error.code = options.code;
        
        return error;
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
=======
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
    
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    clearHistory() {
        this.errorHistory = [];
        this.errorRate.errors = [];
    }
    
    destroy() {
        this.errorHistory = [];
        this.recoveryStrategies.clear();
<<<<<<< HEAD
        this.logger.info('Error handler destroyed');
    }
}

// Create singleton
const errorHandler = new ErrorHandler();

// Make available globally for try-catch blocks
window.handleError = (error, context) => errorHandler.handleError(error, context);

export default errorHandler;
export { ErrorHandler };
=======
    }
}

const errorHandler = new ErrorHandler();
window.handleError = (error, context) => errorHandler.handleError(error, context);

export default errorHandler;
export { ErrorHandler };
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
