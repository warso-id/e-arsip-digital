// js/security/intrusion-detection.js - Intrusion Detection System 2026
/**
 * E-Arsip Digital - Intrusion Detection System
 * Version: 2026.1.0
 * Features: Anomaly detection, behavior analysis, threat scoring,
 *           automated response, pattern matching
 */

import { Logger } from '../logger.js';
import auditTrail from './audit.js';

class IntrusionDetectionSystem {
    constructor() {
        this.logger = new Logger('IDS');
        
        // Detection rules
        this.rules = [];
        
        // Behavior profiles
        this.profiles = new Map();
        
        // Threat scores per IP/session
        this.threatScores = new Map();
        
        // Detection history
        this.detections = [];
        this.maxDetections = 200;
        
        // Thresholds
        this.thresholds = {
            high: 70,
            medium: 40,
            low: 20
        };
        
        // Response actions
        this.autoBlockThreshold = 80;
        this.alertThreshold = 50;
        
        this.init();
    }
    
    init() {
        this.loadDefaultRules();
        this.startMonitoring();
        
        this.logger.info('Intrusion Detection System initialized', {
            rules: this.rules.length
        });
    }
    
    // ============================================
    // DETECTION RULES
    // ============================================
    
    loadDefaultRules() {
        // Brute force detection
        this.addRule({
            id: 'BRUTE_FORCE',
            name: 'Brute Force Attack',
            severity: 'high',
            score: 30,
            patterns: [
                { field: 'eventType', value: 'auth.failed', count: 5, window: 300000 }
            ],
            response: 'block_temp'
        });
        
        // Rapid requests
        this.addRule({
            id: 'RAPID_REQUESTS',
            name: 'Rapid Fire Requests',
            severity: 'medium',
            score: 20,
            patterns: [
                { field: 'requestRate', threshold: 50, window: 10000 }
            ],
            response: 'rate_limit'
        });
        
        // XSS injection attempts
        this.addRule({
            id: 'XSS_INJECTION',
            name: 'XSS Injection Attempt',
            severity: 'high',
            score: 40,
            patterns: [
                { field: 'eventType', value: 'security.xss', count: 3, window: 60000 }
            ],
            response: 'block_temp'
        });
        
        // SQL injection attempts
        this.addRule({
            id: 'SQL_INJECTION',
            name: 'SQL Injection Attempt',
            severity: 'critical',
            score: 50,
            patterns: [
                { field: 'eventType', value: 'security.sqli', count: 1, window: 60000 }
            ],
            response: 'block_permanent'
        });
        
        // Session hijacking detection
        this.addRule({
            id: 'SESSION_HIJACK',
            name: 'Session Hijacking',
            severity: 'critical',
            score: 60,
            patterns: [
                { field: 'fingerprint', change: true },
                { field: 'userAgent', change: true },
                { field: 'ipAddress', change: true }
            ],
            response: 'terminate_session'
        });
        
        // Unusual access pattern
        this.addRule({
            id: 'UNUSUAL_ACCESS',
            name: 'Unusual Access Pattern',
            severity: 'medium',
            score: 25,
            patterns: [
                { field: 'accessHour', range: [0, 5] },
                { field: 'requestRate', threshold: 20, window: 60000 }
            ],
            response: 'log_and_monitor'
        });
        
        // Data exfiltration
        this.addRule({
            id: 'DATA_EXFILTRATION',
            name: 'Potential Data Exfiltration',
            severity: 'high',
            score: 35,
            patterns: [
                { field: 'eventType', value: 'data.export', count: 5, window: 300000 }
            ],
            response: 'block_temp'
        });
        
        // CSRF attacks
        this.addRule({
            id: 'CSRF_ATTACK',
            name: 'CSRF Attack Pattern',
            severity: 'high',
            score: 30,
            patterns: [
                { field: 'eventType', value: 'security.csrf', count: 3, window: 60000 }
            ],
            response: 'block_temp'
        });
        
        // Path traversal
        this.addRule({
            id: 'PATH_TRAVERSAL',
            name: 'Path Traversal Attempt',
            severity: 'high',
            score: 35,
            patterns: [
                { field: 'url', contains: '../', count: 3, window: 60000 },
                { field: 'url', contains: '..\\', count: 3, window: 60000 }
            ],
            response: 'block_temp'
        });
    }
    
    addRule(rule) {
        this.rules.push(rule);
    }
    
    // ============================================
    // MONITORING & DETECTION
    // ============================================
    
    startMonitoring() {
        // Listen for security events
        window.addEventListener('security:xss_detected', (e) => {
            this.analyzeEvent('XSS_INJECTION', e.detail);
        });
        
        window.addEventListener('security:csrf_violation', (e) => {
            this.analyzeEvent('CSRF_ATTACK', e.detail);
        });
        
        window.addEventListener('firewall:blocked', (e) => {
            this.analyzeEvent('FIREWALL_BLOCK', e.detail);
        });
        
        // Monitor network requests
        this.monitorNetworkRequests();
        
        // Periodic behavior analysis
        this.analysisInterval = setInterval(() => {
            this.analyzeAllProfiles();
        }, 60000);
    }
    
    monitorNetworkRequests() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(...args) {
            const startTime = performance.now();
            const [url] = args;
            
            // Track request for rate analysis
            self.trackRequest(url);
            
            return originalFetch.apply(this, args);
        };
    }
    
    trackRequest(url) {
        const sessionId = this.getSessionId();
        const profile = this.getOrCreateProfile(sessionId);
        
        profile.requestCount++;
        profile.lastRequest = Date.now();
        
        // Check rapid requests
        if (profile.requestCount > 30) {
            const elapsed = Date.now() - (profile.firstRequest || Date.now());
            if (elapsed < 10000) {
                this.analyzeEvent('RAPID_REQUESTS', {
                    sessionId,
                    requestCount: profile.requestCount,
                    elapsed
                });
            }
        }
        
        // Reset counter periodically
        if (Date.now() - (profile.resetTime || 0) > 60000) {
            profile.requestCount = 0;
            profile.firstRequest = Date.now();
            profile.resetTime = Date.now();
        }
        
        // Check for path traversal
        if (url.includes('../') || url.includes('..\\')) {
            this.analyzeEvent('PATH_TRAVERSAL', { url, sessionId });
        }
    }
    
    analyzeEvent(ruleId, eventData) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule) return;
        
        const sessionId = eventData.sessionId || this.getSessionId();
        
        // Update threat score
        this.increaseThreatScore(sessionId, rule.score);
        
        // Record detection
        const detection = {
            id: this.generateDetectionId(),
            ruleId,
            ruleName: rule.name,
            severity: rule.severity,
            score: rule.score,
            sessionId,
            timestamp: Date.now(),
            eventData
        };
        
        this.detections.push(detection);
        
        if (this.detections.length > this.maxDetections) {
            this.detections = this.detections.slice(-this.maxDetections);
        }
        
        // Log to audit trail
        auditTrail.logSecurity('INTRUSION_DETECTED', {
            ruleId,
            severity: rule.severity,
            sessionId
        });
        
        this.logger.warn('Intrusion detected', {
            rule: ruleId,
            severity: rule.severity,
            sessionId
        });
        
        // Execute response
        this.executeResponse(rule.response, sessionId);
        
        // Check auto-block threshold
        const threatScore = this.getThreatScore(sessionId);
        if (threatScore >= this.autoBlockThreshold) {
            this.executeResponse('block_permanent', sessionId);
        } else if (threatScore >= this.alertThreshold) {
            this.dispatchAlert(detection);
        }
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('security:intrusion_detected', {
            detail: detection
        }));
    }
    
    // ============================================
    // THREAT SCORING
    // ============================================
    
    increaseThreatScore(sessionId, score) {
        const current = this.threatScores.get(sessionId) || 0;
        const newScore = current + score;
        
        this.threatScores.set(sessionId, newScore);
        
        // Decay score over time
        setTimeout(() => {
            const decayed = (this.threatScores.get(sessionId) || 0) - score;
            if (decayed <= 0) {
                this.threatScores.delete(sessionId);
            } else {
                this.threatScores.set(sessionId, decayed);
            }
        }, 3600000); // Decay after 1 hour
    }
    
    getThreatScore(sessionId) {
        return this.threatScores.get(sessionId) || 0;
    }
    
    getThreatLevel(score) {
        if (score >= this.thresholds.high) return 'high';
        if (score >= this.thresholds.medium) return 'medium';
        if (score >= this.thresholds.low) return 'low';
        return 'none';
    }
    
    // ============================================
    // BEHAVIOR PROFILES
    // ============================================
    
    getOrCreateProfile(sessionId) {
        if (!this.profiles.has(sessionId)) {
            this.profiles.set(sessionId, {
                sessionId,
                createdAt: Date.now(),
                requestCount: 0,
                firstRequest: Date.now(),
                lastRequest: Date.now(),
                resetTime: Date.now(),
                userAgent: navigator.userAgent,
                events: []
            });
        }
        
        return this.profiles.get(sessionId);
    }
    
    analyzeAllProfiles() {
        const now = Date.now();
        
        this.profiles.forEach((profile, sessionId) => {
            // Check for anomalies
            const idleTime = now - profile.lastRequest;
            
            if (idleTime > 3600000) {
                // Profile idle for too long, remove
                this.profiles.delete(sessionId);
            }
        });
    }
    
    // ============================================
    // RESPONSE ACTIONS
    // ============================================
    
    executeResponse(response, sessionId) {
        switch (response) {
            case 'block_temp':
                this.logger.info('Temporary block', { sessionId });
                window.dispatchEvent(new CustomEvent('ids:block_temp', {
                    detail: { sessionId, duration: 300000 }
                }));
                break;
                
            case 'block_permanent':
                this.logger.info('Permanent block', { sessionId });
                window.dispatchEvent(new CustomEvent('ids:block_permanent', {
                    detail: { sessionId }
                }));
                break;
                
            case 'rate_limit':
                this.logger.info('Rate limiting', { sessionId });
                window.dispatchEvent(new CustomEvent('ids:rate_limit', {
                    detail: { sessionId }
                }));
                break;
                
            case 'terminate_session':
                this.logger.info('Terminating session', { sessionId });
                window.dispatchEvent(new CustomEvent('ids:terminate_session', {
                    detail: { sessionId }
                }));
                break;
                
            case 'log_and_monitor':
                this.logger.info('Logging and monitoring', { sessionId });
                break;
                
            default:
                this.logger.warn('Unknown response action', { response });
        }
    }
    
    dispatchAlert(detection) {
        window.dispatchEvent(new CustomEvent('ids:alert', {
            detail: {
                ...detection,
                threatLevel: this.getThreatLevel(detection.score),
                message: `[${detection.severity.toUpperCase()}] ${detection.ruleName} detected`
            }
        }));
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateDetectionId() {
        return `IDS-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
    }
    
    getSessionId() {
        return sessionStorage.getItem('session_id') || 'unknown';
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getDetections(options = {}) {
        let results = [...this.detections].reverse();
        
        if (options.severity) {
            results = results.filter(d => d.severity === options.severity);
        }
        
        if (options.limit) {
            results = results.slice(0, options.limit);
        }
        
        return results;
    }
    
    getThreatScores() {
        const scores = [];
        
        this.threatScores.forEach((score, sessionId) => {
            scores.push({
                sessionId,
                score,
                level: this.getThreatLevel(score)
            });
        });
        
        return scores.sort((a, b) => b.score - a.score);
    }
    
    getStats() {
        return {
            totalDetections: this.detections.length,
            activeThreats: this.threatScores.size,
            highThreats: Array.from(this.threatScores.values())
                .filter(s => s >= this.thresholds.high).length,
            rules: this.rules.length,
            profiles: this.profiles.size
        };
    }
    
    reset() {
        this.detections = [];
        this.threatScores.clear();
        this.profiles.clear();
        this.logger.info('IDS reset');
    }
    
    destroy() {
        if (this.analysisInterval) clearInterval(this.analysisInterval);
        this.profiles.clear();
        this.logger.info('IDS destroyed');
    }
}

// Create singleton
const intrusionDetection = new IntrusionDetectionSystem();

export default intrusionDetection;
export { IntrusionDetectionSystem };