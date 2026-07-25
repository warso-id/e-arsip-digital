// js/security/security-orchestrator.js - Security Orchestrator 2026
/**
 * E-Arsip Digital - Security Orchestrator
 * Version: 2026.1.0
 * Central security management system
 * Coordinates all security modules and provides unified security interface
 */

import APP_CONFIG from '../../config/config.js';
import { Logger } from '../logger.js';
import { EncryptionService } from './encryption.js';
import { CSRFProtection } from './csrf.js';
import { XSSPrevention } from './xss.js';
import { RateLimiter } from './rate-limit.js';
import { Firewall } from './firewall.js';
import { IntrusionDetectionSystem } from './intrusion-detection.js';
import { SessionHardening } from './session-hardening.js';
import { SecureHeadersManager } from './secure-headers.js';
import { SecureStorage } from './secure-storage.js';
import { TokenManager } from './token-manager.js';
import { AuditTrail } from './audit.js';
import { SecuritySanitizer } from './sanitizer.js';

class SecurityOrchestrator {
    constructor(config = APP_CONFIG.security) {
        this.config = config;
        this.logger = new Logger('SecurityOrchestrator');
        
        // Initialize all security modules
        this.modules = {
            encryption: new EncryptionService(config.encryption),
            csrf: new CSRFProtection(config.csrf),
            xss: new XSSPrevention(config.xss),
            rateLimiter: new RateLimiter(config.rateLimit),
            firewall: new Firewall(config.firewall),
            ids: new IntrusionDetectionSystem(),
            sessionHardening: new SessionHardening(config.session),
            secureHeaders: new SecureHeadersManager(config.headers),
            secureStorage: new SecureStorage(),
            tokenManager: new TokenManager(),
            audit: new AuditTrail(),
            sanitizer: new SecuritySanitizer()
        };
        
        // Security metrics
        this.metrics = {
            threatsDetected: 0,
            attacksBlocked: 0,
            suspiciousActivities: 0,
            securityScore: 100,
            lastThreatTime: null,
            vulnerabilities: []
        };
        
        // Security policies
        this.policies = new Map();
        
        // Event listeners
        this.eventListeners = new Map();
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize all modules
            await this.initializeModules();
            
            // Load security policies
            this.loadPolicies();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Perform initial security scan
            await this.performSecurityScan();
            
            // Start continuous monitoring
            this.startContinuousMonitoring();
            
            this.logger.info('Security Orchestrator initialized', {
                modules: Object.keys(this.modules),
                score: this.metrics.securityScore
            });
            
        } catch (error) {
            this.logger.error('Security Orchestrator initialization failed', error);
            this.degradeGracefully(error);
        }
    }
    
    async initializeModules() {
        const initOrder = [
            'encryption',
            'csrf',
            'xss',
            'sanitizer',
            'rateLimiter',
            'firewall',
            'ids',
            'sessionHardening',
            'secureHeaders',
            'secureStorage',
            'tokenManager',
            'audit'
        ];
        
        for (const moduleName of initOrder) {
            if (this.modules[moduleName]) {
                try {
                    await this.modules[moduleName].init?.();
                    this.logger.debug(`Module initialized: ${moduleName}`);
                } catch (error) {
                    this.logger.warn(`Failed to initialize module: ${moduleName}`, error);
                }
            }
        }
    }
    
    loadPolicies() {
        // Default security policies
        this.setPolicy('input_validation', {
            sanitize: true,
            maxLength: 10000,
            allowedTags: this.config.xss?.allowedTags || [],
            stripHtml: false
        });
        
        this.setPolicy('password', {
            minLength: 8,
            requireUppercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxAge: 90, // days
            historySize: 5,
            preventCommonPassword: true
        });
        
        this.setPolicy('session', {
            maxConcurrentSessions: 3,
            idleTimeout: 30, // minutes
            absoluteTimeout: 480, // minutes (8 hours)
            extendOnActivity: true,
            requireReauth: false
        });
        
        this.setPolicy('api', {
            rateLimit: {
                window: 60000,
                max: 100
            },
            requireAuth: true,
            validateInput: true,
            logRequests: true
        });
        
        this.setPolicy('file_upload', {
            maxSize: 10485760, // 10MB
            allowedTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png'
            ],
            scanForMalware: true,
            validateMagicBytes: true
        });
    }
    
    setupEventListeners() {
        // Monitor XSS attempts
        document.addEventListener('security:xss_attempt', (e) => {
            this.handleSecurityEvent('xss_attempt', e.detail);
        });
        
        // Monitor CSRF attempts
        document.addEventListener('security:csrf_violation', (e) => {
            this.handleSecurityEvent('csrf_violation', e.detail);
        });
        
        // Monitor rate limit violations
        document.addEventListener('security:rate_limit_exceeded', (e) => {
            this.handleSecurityEvent('rate_limit_exceeded', e.detail);
        });
        
        // Monitor firewall blocks
        document.addEventListener('security:firewall_block', (e) => {
            this.handleSecurityEvent('firewall_block', e.detail);
        });
        
        // Monitor intrusion detections
        document.addEventListener('security:intrusion_detected', (e) => {
            this.handleSecurityEvent('intrusion_detected', e.detail);
        });
    }
    
    async handleSecurityEvent(type, details) {
        this.metrics.threatsDetected++;
        this.metrics.lastThreatTime = Date.now();
        this.metrics.securityScore = Math.max(0, this.metrics.securityScore - 1);
        
        this.logger.warn(`Security event: ${type}`, details);
        
        // Log to audit trail
        await this.modules.audit.log('security_event', {
            type,
            details,
            timestamp: Date.now()
        });
        
        // Notify listeners
        this.emit('threat_detected', { type, details });
        
        // Take automatic action based on threat level
        const threatLevel = this.calculateThreatLevel(type, details);
        if (threatLevel === 'critical') {
            await this.handleCriticalThreat(type, details);
        }
    }
    
    calculateThreatLevel(type, details) {
        const threatLevels = {
            'xss_attempt': 'high',
            'csrf_violation': 'high',
            'rate_limit_exceeded': 'medium',
            'firewall_block': 'medium',
            'intrusion_detected': 'critical',
            'suspicious_activity': 'low'
        };
        
        return threatLevels[type] || 'low';
    }
    
    async handleCriticalThreat(type, details) {
        this.logger.error(`Critical threat detected: ${type}`, details);
        
        // Lock down sensitive operations
        await this.lockdownSensitiveOperations();
        
        // Notify administrator
        await this.notifyAdministrator('critical_threat', { type, details });
        
        // Collect forensic data
        await this.collectForensicData();
        
        // Emit alert
        this.emit('critical_alert', {
            type,
            details,
            timestamp: Date.now()
        });
    }
    
    async lockdownSensitiveOperations() {
        // Increase security measures
        this.modules.rateLimiter.setStrictMode(true);
        this.modules.firewall.enableStrictMode();
        this.modules.ids.increaseSensitivity();
        
        // Force re-authentication for all sessions
        this.modules.sessionHardening.forceReauthentication();
        
        this.logger.info('Sensitive operations locked down');
    }
    
    async performSecurityScan() {
        try {
            const scanResults = {
                timestamp: Date.now(),
                vulnerabilities: [],
                warnings: [],
                score: 100
            };
            
            // Check for common vulnerabilities
            await this.checkXVulnerabilities(scanResults);
            await this.checkInsecureStorage(scanResults);
            await this.checkWeakConfigurations(scanResults);
            
            this.metrics.vulnerabilities = scanResults.vulnerabilities;
            
            this.logger.info('Security scan completed', {
                score: scanResults.score,
                vulnerabilities: scanResults.vulnerabilities.length
            });
            
            return scanResults;
        } catch (error) {
            this.logger.error('Security scan failed', error);
            return null;
        }
    }
    
    async checkXVulnerabilities(results) {
        // Check for XSS vulnerabilities
        const testInputs = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src=x onerror=alert("xss")>',
            '"><script>alert("xss")</script>',
            '<svg onload=alert("xss")>'
        ];
        
        for (const input of testInputs) {
            const sanitized = this.modules.xss.sanitize(input);
            if (sanitized.includes('<script>') || sanitized.includes('onerror=')) {
                results.vulnerabilities.push({
                    type: 'xss',
                    severity: 'high',
                    description: 'XSS filter mungkin tidak berfungsi dengan baik'
                });
                results.score -= 10;
                break;
            }
        }
    }
    
    async checkInsecureStorage(results) {
        // Check for sensitive data in localStorage
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                if (!this.modules.encryption.isEncrypted(value)) {
                    results.vulnerabilities.push({
                        type: 'insecure_storage',
                        severity: 'high',
                        description: `Data sensitif tidak terenkripsi: ${key}`
                    });
                    results.score -= 15;
                }
            }
        }
    }
    
    async checkWeakConfigurations(results) {
        // Check CSP configuration
        const csp = this.config.headers?.['Content-Security-Policy'];
        if (!csp || csp.includes('unsafe-inline') || csp.includes('unsafe-eval')) {
            results.warnings.push('CSP mengandung directive yang tidak aman');
            results.score -= 5;
        }
        
        // Check if debug mode is on in production
        if (APP_CONFIG.app.environment === 'production' && APP_CONFIG.app.debug) {
            results.vulnerabilities.push({
                type: 'debug_mode',
                severity: 'medium',
                description: 'Debug mode aktif di environment production'
            });
            results.score -= 10;
        }
    }
    
    startContinuousMonitoring() {
        // Monitor DOM mutations for XSS
        this.setupMutationObserver();
        
        // Monitor network requests
        this.setupNetworkMonitor();
        
        // Monitor storage access
        this.setupStorageMonitor();
        
        this.logger.info('Continuous monitoring started');
    }
    
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            this.scanElementForThreats(node);
                        }
                    });
                } else if (mutation.type === 'attributes') {
                    this.scanAttributeForThreats(
                        mutation.target, 
                        mutation.attributeName
                    );
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['src', 'href', 'onclick', 'onerror', 'onload']
        });
    }
    
    setupNetworkMonitor() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(...args) {
            const [url, options] = args;
            
            // Check for suspicious URLs
            if (self.modules.firewall.isUrlBlocked(url)) {
                self.handleSecurityEvent('firewall_block', { url });
                throw new Error('URL diblokir oleh firewall');
            }
            
            // Sanitize request data
            if (options?.body) {
                try {
                    const parsed = JSON.parse(options.body);
                    const sanitized = self.modules.sanitizer.sanitizeObject(parsed);
                    options.body = JSON.stringify(sanitized);
                } catch (e) {
                    // If not JSON, leave as is
                }
            }
            
            return originalFetch.apply(this, [url, options]);
        };
    }
    
    setupStorageMonitor() {
        const originalSetItem = Storage.prototype.setItem;
        const self = this;
        
        Storage.prototype.setItem = function(key, value) {
            // Block setting sensitive data without encryption
            if (self.isSensitiveKey(key) && !self.modules.encryption.isEncrypted(value)) {
                self.logger.warn(`Attempted to store sensitive data without encryption: ${key}`);
                value = self.modules.encryption.encrypt(value);
            }
            
            return originalSetItem.call(this, key, value);
        };
    }
    
    scanElementForThreats(element) {
        // Check for inline scripts
        if (element.tagName === 'SCRIPT' && element.src) {
            this.handleSecurityEvent('suspicious_activity', {
                type: 'dynamic_script',
                src: element.src
            });
        }
        
        // Check for event handlers
        const eventAttrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus'];
        eventAttrs.forEach(attr => {
            if (element.hasAttribute(attr)) {
                this.handleSecurityEvent('suspicious_activity', {
                    type: 'inline_event_handler',
                    attribute: attr
                });
            }
        });
    }
    
    scanAttributeForThreats(element, attributeName) {
        const value = element.getAttribute(attributeName);
        
        if (value && (value.startsWith('javascript:') || value.startsWith('data:'))) {
            this.handleSecurityEvent('suspicious_activity', {
                type: 'dangerous_url_scheme',
                attribute: attributeName,
                value: value
            });
        }
    }
    
    isSensitiveKey(key) {
        const sensitivePatterns = [
            'password', 'token', 'secret', 'key', 'credential',
            'auth', 'session', 'private', 'encrypted'
        ];
        
        return sensitivePatterns.some(pattern => 
            key.toLowerCase().includes(pattern)
        );
    }
    
    // Policy management
    setPolicy(name, policy) {
        this.policies.set(name, policy);
    }
    
    getPolicy(name) {
        return this.policies.get(name);
    }
    
    // Event system
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(listener);
    }
    
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    this.logger.error(`Event listener error for ${event}`, error);
                }
            });
        }
    }
    
    // Reporting
    getSecurityReport() {
        return {
            timestamp: Date.now(),
            metrics: { ...this.metrics },
            moduleStatus: Object.entries(this.modules).reduce((acc, [name, module]) => {
                acc[name] = {
                    active: !!module,
                    initialized: module.isInitialized || false
                };
                return acc;
            }, {}),
            policies: Array.from(this.policies.entries()),
            recommendations: this.generateRecommendations()
        };
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.securityScore < 80) {
            recommendations.push('Tingkatkan keamanan secara keseluruhan');
        }
        
        if (this.metrics.vulnerabilities.length > 0) {
            recommendations.push('Perbaiki kerentanan yang terdeteksi');
        }
        
        return recommendations;
    }
    
    // Utility
    async collectForensicData() {
        return {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            cookies: document.cookie,
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage },
            domSnapshot: document.documentElement.outerHTML.substring(0, 1000)
        };
    }
    
    async notifyAdministrator(type, data) {
        // In production, send to admin notification system
        this.logger.info(`Admin notification: ${type}`, data);
        
        // Store in audit log
        await this.modules.audit.log('admin_notification', {
            type,
            data,
            timestamp: Date.now()
        });
    }
    
    degradeGracefully(error) {
        this.logger.error('Degrading security gracefully', error);
        
        // Keep critical modules running
        const criticalModules = ['encryption', 'csrf', 'xss', 'rateLimiter'];
        
        criticalModules.forEach(moduleName => {
            if (this.modules[moduleName]) {
                try {
                    this.modules[moduleName].init?.();
                } catch (e) {
                    // Module failed, continue without it
                }
            }
        });
    }
    
    destroy() {
        // Clean up all modules
        Object.values(this.modules).forEach(module => {
            try {
                module.destroy?.();
            } catch (error) {
                this.logger.error('Module cleanup failed', error);
            }
        });
        
        this.eventListeners.clear();
        this.policies.clear();
    }
}

// Create singleton instance
const securityOrchestrator = new SecurityOrchestrator();

export default securityOrchestrator;
export { SecurityOrchestrator };