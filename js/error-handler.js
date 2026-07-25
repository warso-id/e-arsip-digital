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
import APP_CONFIG from '../config/config.js';

class ErrorHandler {
    constructor() {
        this.logger = new Logger('ErrorHandler');
        
        // Error severity levels
        this.SEVERITY = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };
        
        // Error categories
        this.CATEGORIES = {
            NETWORK: 'network',
            AUTH: 'auth',
            VALIDATION: 'validation',
            API: 'api',
            RUNTIME: 'runtime',
            SECURITY: 'security',
            UNKNOWN: 'unknown'
        };
        
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
        
        this.init();
    }
    
    init() {
        this.registerDefaultRecoveryStrategies();
        this.setupGlobalHandlers();
        
        this.logger.info('Error handler initialized');
    }
    
    // ============================================
    // GLOBAL HANDLERS
    // ============================================
    
    setupGlobalHandlers() {
        // Uncaught errors
        window.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message), {
                category: this.CATEGORIES.RUNTIME,
                severity: this.SEVERITY.HIGH,
                source: 'window.onerror'
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error ? 
                event.reason : new Error(String(event.reason));
            
            this.handleError(error, {
                category: this.CATEGORIES.RUNTIME,
                severity: this.SEVERITY.HIGH,
                source: 'unhandledrejection'
            });
        });
        
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
        }
        
        return errorInfo;
    }
    
    logError(errorInfo) {
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
        };
        
        const message = messages[errorInfo.category] || errorInfo.message;
        
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
                await new Promise(resolve => {
                    if (navigator.onLine) return resolve();
                    window.addEventListener('online', resolve, { once: true });
                });
                
                // Reload current page data
                window.dispatchEvent(new CustomEvent('app:reconnect'));
                return true;
            }
        });
        
        // Auth errors - redirect to login
        this.registerRecoveryStrategy(this.CATEGORIES.AUTH, {
            canRecover: () => true,
            recover: async () => {
                localStorage.removeItem('auth_session');
                localStorage.removeItem('auth_token');
                
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
                return true;
            }
        });
    }
    
    async attemptRecovery(errorInfo) {
        if (!errorInfo.recoverable) return false;
        
        const strategy = this.recoveryStrategies.get(errorInfo.category);
        if (!strategy) return false;
        
        try {
            const canRecover = strategy.canRecover();
            if (!canRecover) return false;
            
            const recovered = await strategy.recover(errorInfo);
            
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
            return false;
        }
    }
    
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
    }
    
    addToHistory(errorInfo) {
        this.errorHistory.unshift(errorInfo);
        
        if (this.errorHistory.length > this.maxHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistory);
        }
    }
    
    async reportError(errorInfo) {
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
    
    clearHistory() {
        this.errorHistory = [];
        this.errorRate.errors = [];
    }
    
    destroy() {
        this.errorHistory = [];
        this.recoveryStrategies.clear();
        this.logger.info('Error handler destroyed');
    }
}

// Create singleton
const errorHandler = new ErrorHandler();

// Make available globally for try-catch blocks
window.handleError = (error, context) => errorHandler.handleError(error, context);

export default errorHandler;
export { ErrorHandler };