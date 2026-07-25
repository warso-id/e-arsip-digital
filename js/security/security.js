// js/security/security.js - Security Manager (Main) 2026
/**
 * E-Arsip Digital - Security Manager
 * Version: 2026.1.0
 * Central security module that coordinates all security features
 */

import { Logger } from '../logger.js';
import encryptionService from './encryption.js';
import csrfProtection from './csrf.js';
import xssPrevention from './xss.js';
import rateLimiter from './rate-limit.js';
import firewall from './firewall.js';
import auditTrail from './audit.js';
import securityOrchestrator from './security-orchestrator.js';

class SecurityManager {
    constructor() {
        this.logger = new Logger('SecurityManager');
        
        // Module registry
        this.modules = new Map();
        
        // Security posture
        this.posture = {
            level: 'normal', // normal, elevated, high, critical
            lastAssessment: null,
            threatsDetected: 0,
            activeIncidents: 0
        };
        
        this.initialized = false;
    }
    
    async init() {
        try {
            // Register all security modules
            this.registerModule('encryption', encryptionService);
            this.registerModule('csrf', csrfProtection);
            this.registerModule('xss', xssPrevention);
            this.registerModule('rateLimiter', rateLimiter);
            this.registerModule('firewall', firewall);
            this.registerModule('audit', auditTrail);
            this.registerModule('orchestrator', securityOrchestrator);
            
            // Perform security assessment
            await this.assessSecurity();
            
            // Log initialization
            auditTrail.log('system.startup', {
                modules: this.getActiveModules(),
                posture: this.posture
            });
            
            this.initialized = true;
            
            this.logger.info('Security manager initialized', {
                activeModules: this.getActiveModules().length,
                posture: this.posture.level
            });
            
        } catch (error) {
            this.logger.error('Security manager initialization failed', error);
        }
    }
    
    // ============================================
    // MODULE MANAGEMENT
    // ============================================
    
    registerModule(name, module) {
        this.modules.set(name, module);
    }
    
    getModule(name) {
        return this.modules.get(name);
    }
    
    getActiveModules() {
        const active = [];
        
        this.modules.forEach((module, name) => {
            if (module.isEnabled?.() || module.initialized) {
                active.push(name);
            }
        });
        
        return active;
    }
    
    getInactiveModules() {
        const all = ['encryption', 'csrf', 'xss', 'rateLimiter', 'firewall', 'audit', 'orchestrator'];
        const active = this.getActiveModules();
        
        return all.filter(m => !active.includes(m));
    }
    
    // ============================================
    // SECURITY ASSESSMENT
    // ============================================
    
    async assessSecurity() {
        const findings = [];
        let score = 100;
        
        // Check each module
        this.modules.forEach((module, name) => {
            if (!module.isEnabled?.() && !module.initialized) {
                findings.push({
                    module: name,
                    severity: 'warning',
                    message: `${name} is not active`
                });
                score -= 10;
            }
        });
        
        // Check for threats
        if (firewall.getStats) {
            const fwStats = firewall.getStats();
            if (fwStats.blockedRequests > 50) {
                findings.push({
                    module: 'firewall',
                    severity: 'warning',
                    message: `High number of blocked requests: ${fwStats.blockedRequests}`
                });
                score -= 5;
            }
        }
        
        // Check XSS detections
        if (xssPrevention.getStats) {
            const xssStats = xssPrevention.getStats();
            if (xssStats.totalDetections > 10) {
                findings.push({
                    module: 'xss',
                    severity: 'critical',
                    message: `XSS attempts detected: ${xssStats.totalDetections}`
                });
                score -= 15;
            }
        }
        
        // Update posture
        if (score >= 80) {
            this.posture.level = 'normal';
        } else if (score >= 60) {
            this.posture.level = 'elevated';
        } else if (score >= 40) {
            this.posture.level = 'high';
        } else {
            this.posture.level = 'critical';
        }
        
        this.posture.lastAssessment = new Date().toISOString();
        
        return {
            score,
            level: this.posture.level,
            findings,
            activeModules: this.getActiveModules(),
            inactiveModules: this.getInactiveModules()
        };
    }
    
    // ============================================
    // THREAT RESPONSE
    // ============================================
    
    handleThreat(threat) {
        this.posture.threatsDetected++;
        this.posture.activeIncidents++;
        
        this.logger.warn('Security threat detected', threat);
        
        // Log to audit trail
        auditTrail.logSecurity('THREAT', threat);
        
        // Escalate posture if needed
        if (threat.severity === 'critical') {
            this.escalatePosture('critical');
        } else if (threat.severity === 'high' && this.posture.level === 'normal') {
            this.escalatePosture('elevated');
        }
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('security:threat', {
            detail: threat
        }));
        
        return {
            handled: true,
            posture: this.posture.level,
            incidentId: `INC-${Date.now().toString(36)}`
        };
    }
    
    escalatePosture(level) {
        const levels = ['normal', 'elevated', 'high', 'critical'];
        const currentIndex = levels.indexOf(this.posture.level);
        const targetIndex = levels.indexOf(level);
        
        if (targetIndex > currentIndex) {
            this.posture.level = level;
            
            this.logger.warn('Security posture escalated', {
                from: levels[currentIndex],
                to: level
            });
            
            // Enable additional security measures
            if (level === 'high' || level === 'critical') {
                rateLimiter.enableStrictMode?.();
            }
            
            if (level === 'critical') {
                securityOrchestrator.lockdownSensitiveOperations?.();
            }
        }
    }
    
    deescalatePosture() {
        const levels = ['normal', 'elevated', 'high', 'critical'];
        const currentIndex = levels.indexOf(this.posture.level);
        
        if (currentIndex > 0) {
            this.posture.level = levels[currentIndex - 1];
            this.posture.activeIncidents = Math.max(0, this.posture.activeIncidents - 1);
            
            this.logger.info('Security posture deescalated', {
                to: this.posture.level
            });
        }
    }
    
    // ============================================
    // SECURITY UTILITIES
    // ============================================
    
    sanitizeInput(input, context) {
        return xssPrevention.sanitize(input, context);
    }
    
    validateRequest(request) {
        // Run through all security checks
        const csrfCheck = csrfProtection.validateRequest(request);
        if (!csrfCheck.valid) return csrfCheck;
        
        const rateCheck = rateLimiter.check();
        if (!rateCheck.allowed) return { valid: false, reason: rateCheck.reason };
        
        const firewallCheck = firewall.validateInput?.(JSON.stringify(request)) || { allowed: true };
        if (!firewallCheck.allowed) return { valid: false, reason: firewallCheck.reason };
        
        return { valid: true };
    }
    
    generateCSRFToken() {
        return csrfProtection.getCurrentToken();
    }
    
    encrypt(data) {
        return encryptionService.encrypt(data);
    }
    
    decrypt(data) {
        return encryptionService.decrypt(data);
    }
    
    // ============================================
    // REPORTING
    // ============================================
    
    getSecurityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            posture: this.posture,
            modules: {},
            threats: {},
            recommendations: []
        };
        
        // Module statuses
        this.modules.forEach((module, name) => {
            report.modules[name] = {
                active: module.isEnabled?.() || module.initialized || false,
                stats: module.getStats?.() || {}
            };
        });
        
        // Generate recommendations
        const inactiveModules = this.getInactiveModules();
        if (inactiveModules.length > 0) {
            report.recommendations.push({
                priority: 'high',
                message: `Aktifkan modul: ${inactiveModules.join(', ')}`
            });
        }
        
        if (this.posture.level !== 'normal') {
            report.recommendations.push({
                priority: 'critical',
                message: `Security posture dalam level ${this.posture.level}. Periksa incident yang aktif.`
            });
        }
        
        return report;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getPosture() {
        return { ...this.posture };
    }
    
    getActiveIncidents() {
        return this.posture.activeIncidents;
    }
    
    isModuleActive(name) {
        const module = this.modules.get(name);
        return module?.isEnabled?.() || module?.initialized || false;
    }
    
    reset() {
        this.posture = {
            level: 'normal',
            lastAssessment: new Date().toISOString(),
            threatsDetected: 0,
            activeIncidents: 0
        };
        
        this.modules.forEach(module => {
            module.reset?.();
        });
        
        this.logger.info('Security manager reset');
    }
    
    destroy() {
        this.modules.clear();
        this.initialized = false;
        this.logger.info('Security manager destroyed');
    }
}

// Create singleton and initialize
const securityManager = new SecurityManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => securityManager.init());
} else {
    securityManager.init();
}

export default securityManager;
export { SecurityManager };