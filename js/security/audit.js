// js/security/audit.js - Advanced Audit Trail 2026
/**
 * E-Arsip Digital - Audit Trail System
 * Version: 2026.1.0
 * Tracks all security-relevant events with immutable logging
 */

import { Logger } from '../logger.js';
import { EncryptionService } from './encryption.js';

class AuditTrail {
    constructor() {
        this.logger = new Logger('Audit');
        this.encryption = new EncryptionService();
        
        // Event types
        this.EVENT_TYPES = {
            AUTH_LOGIN: 'auth.login',
            AUTH_LOGOUT: 'auth.logout',
            AUTH_FAILED: 'auth.failed',
            AUTH_PASSWORD_CHANGE: 'auth.password_change',
            AUTH_MFA: 'auth.mfa',
            DATA_CREATE: 'data.create',
            DATA_UPDATE: 'data.update',
            DATA_DELETE: 'data.delete',
            DATA_EXPORT: 'data.export',
            DATA_IMPORT: 'data.import',
            SECURITY_THREAT: 'security.threat',
            SECURITY_BLOCKED: 'security.blocked',
            SECURITY_XSS: 'security.xss',
            SECURITY_CSRF: 'security.csrf',
            SECURITY_SQLI: 'security.sqli',
            CONFIG_CHANGE: 'config.change',
            USER_MANAGEMENT: 'user.management',
            PERMISSION_CHANGE: 'permission.change',
            BACKUP_CREATE: 'backup.create',
            BACKUP_RESTORE: 'backup.restore',
            SYSTEM_ERROR: 'system.error',
            SYSTEM_STARTUP: 'system.startup',
            SYSTEM_SHUTDOWN: 'system.shutdown'
        };
        
        // Severity levels
        this.SEVERITY = {
            DEBUG: 0,
            INFO: 1,
            WARNING: 2,
            ERROR: 3,
            CRITICAL: 4
        };
        
        // Audit log storage
        this.logs = [];
        this.maxLogs = 1000;
        this.batchSize = 10;
        this.flushInterval = 30000;
        this.pendingLogs = [];
        
        // Integrity verification
        this.lastHash = null;
        
        // Session tracking
        this.sessionEvents = new Map();
        
        this.init();
    }
    
    init() {
        this.loadLogs();
        this.setupFlushTimer();
        this.logger.info('Audit trail initialized');
    }
    
    // ============================================
    // EVENT LOGGING
    // ============================================
    
    log(eventType, data = {}, severity = this.SEVERITY.INFO) {
        const entry = this.createLogEntry(eventType, data, severity);
        
        // Add to pending batch
        this.pendingLogs.push(entry);
        
        // Auto-flush if batch is full
        if (this.pendingLogs.length >= this.batchSize) {
            this.flush();
        }
        
        // Immediately log critical events
        if (severity >= this.SEVERITY.CRITICAL) {
            this.flush();
        }
        
        return entry;
    }
    
    createLogEntry(eventType, data, severity) {
        const entry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            eventType,
            severity,
            user: this.getCurrentUser(),
            sessionId: this.getSessionId(),
            ipAddress: 'client-side',
            userAgent: navigator.userAgent,
            url: window.location.href,
            data: this.sanitizeData(data),
            hash: null
        };
        
        // Generate hash for integrity
        entry.hash = this.generateHash(entry);
        
        return entry;
    }
    
    // Convenience methods
    logAuth(event, data = {}) {
        return this.log(this.EVENT_TYPES[`AUTH_${event.toUpperCase()}`] || event, data, 
            event === 'FAILED' ? this.SEVERITY.WARNING : this.SEVERITY.INFO);
    }
    
    logData(action, data = {}) {
        const severity = action === 'DELETE' ? this.SEVERITY.WARNING : this.SEVERITY.INFO;
        return this.log(this.EVENT_TYPES[`DATA_${action.toUpperCase()}`] || action, data, severity);
    }
    
    logSecurity(event, data = {}) {
        return this.log(this.EVENT_TYPES[`SECURITY_${event.toUpperCase()}`] || event, data, 
            this.SEVERITY.WARNING);
    }
    
    logConfig(change, data = {}) {
        return this.log(this.EVENT_TYPES.CONFIG_CHANGE, { change, ...data }, this.SEVERITY.WARNING);
    }
    
    logError(error, data = {}) {
        return this.log(this.EVENT_TYPES.SYSTEM_ERROR, {
            message: error.message,
            stack: error.stack?.substring(0, 500),
            ...data
        }, this.SEVERITY.ERROR);
    }
    
    logCritical(event, data = {}) {
        return this.log(event, data, this.SEVERITY.CRITICAL);
    }
    
    // ============================================
    // SESSION TRACKING
    // ============================================
    
    trackSession(sessionId, userId) {
        this.sessionEvents.set(sessionId, {
            userId,
            startTime: Date.now(),
            events: [],
            lastActivity: Date.now()
        });
    }
    
    addSessionEvent(sessionId, eventType, data) {
        const session = this.sessionEvents.get(sessionId);
        if (session) {
            session.events.push({
                eventType,
                data,
                timestamp: Date.now()
            });
            session.lastActivity = Date.now();
        }
    }
    
    endSession(sessionId) {
        const session = this.sessionEvents.get(sessionId);
        if (session) {
            session.endTime = Date.now();
            session.duration = session.endTime - session.startTime;
            
            this.log('session.end', {
                sessionId,
                duration: session.duration,
                eventCount: session.events.length
            });
            
            this.sessionEvents.delete(sessionId);
        }
    }
    
    getSessionSummary(sessionId) {
        const session = this.sessionEvents.get(sessionId);
        if (!session) return null;
        
        return {
            ...session,
            duration: Date.now() - session.startTime,
            isActive: true
        };
    }
    
    // ============================================
    // FLUSH & STORAGE
    // ============================================
    
    setupFlushTimer() {
        this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
        
        // Flush on page unload
        window.addEventListener('beforeunload', () => this.flush());
    }
    
    flush() {
        if (this.pendingLogs.length === 0) return;
        
        // Add to in-memory logs
        this.logs.push(...this.pendingLogs);
        
        // Trim if exceeds max
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // Save to storage
        this.saveLogs();
        
        // Send to server
        this.sendToServer(this.pendingLogs);
        
        // Clear pending
        this.pendingLogs = [];
    }
    
    saveLogs() {
        try {
            // Only save recent logs to localStorage (limit size)
            const recentLogs = this.logs.slice(-100);
            const encrypted = this.encryption.encrypt(JSON.stringify(recentLogs));
            localStorage.setItem('audit_logs', encrypted);
        } catch (error) {
            this.logger.warn('Failed to save audit logs', error);
        }
    }
    
    loadLogs() {
        try {
            const encrypted = localStorage.getItem('audit_logs');
            if (encrypted) {
                const decrypted = this.encryption.decrypt(encrypted);
                this.logs = JSON.parse(decrypted) || [];
            }
        } catch (error) {
            this.logger.warn('Failed to load audit logs', error);
            this.logs = [];
        }
    }
    
    async sendToServer(logs) {
        try {
            const { apiService } = await import('../api.js');
            await apiService.post('/api/audit/logs', { logs }, { 
                priority: 'low',
                retries: 1 
            }).catch(() => {
                // Silently fail - audit logs should never block the app
            });
        } catch (error) {
            // Ignore - audit logging is best-effort
        }
    }
    
    // ============================================
    // INTEGRITY VERIFICATION
    // ============================================
    
    generateHash(entry) {
        const data = `${entry.timestamp}|${entry.eventType}|${entry.user}|${entry.url}|${JSON.stringify(entry.data)}|${this.lastHash || ''}`;
        
        // Simple hash using SubtleCrypto
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        
        // Use a simple checksum as fallback
        let hash = 0;
        for (let i = 0; i < dataBuffer.length; i++) {
            const chr = dataBuffer[i];
            hash = ((hash << 5) - hash) + chr;
        }
        
        this.lastHash = hash.toString(36);
        return this.lastHash;
    }
    
    verifyIntegrity() {
        const results = [];
        let previousHash = null;
        
        for (let i = 0; i < this.logs.length; i++) {
            const entry = this.logs[i];
            const expectedHash = this.recalculateHash(entry, previousHash);
            
            if (entry.hash !== expectedHash) {
                results.push({
                    index: i,
                    id: entry.id,
                    timestamp: entry.timestamp,
                    expected: expectedHash,
                    actual: entry.hash,
                    tampered: true
                });
            }
            
            previousHash = entry.hash;
        }
        
        return {
            total: this.logs.length,
            tampered: results.length,
            details: results,
            isValid: results.length === 0
        };
    }
    
    recalculateHash(entry, previousHash) {
        const tempLastHash = this.lastHash;
        this.lastHash = previousHash;
        const hash = this.generateHash(entry);
        this.lastHash = tempLastHash;
        return hash;
    }
    
    // ============================================
    // QUERY & ANALYSIS
    // ============================================
    
    query(options = {}) {
        let results = [...this.logs];
        
        // Filter by event type
        if (options.eventType) {
            results = results.filter(log => log.eventType === options.eventType);
        }
        
        // Filter by severity
        if (options.minSeverity !== undefined) {
            results = results.filter(log => log.severity >= options.minSeverity);
        }
        
        // Filter by user
        if (options.user) {
            results = results.filter(log => log.user === options.user);
        }
        
        // Filter by date range
        if (options.startDate) {
            const start = new Date(options.startDate);
            results = results.filter(log => new Date(log.timestamp) >= start);
        }
        
        if (options.endDate) {
            const end = new Date(options.endDate);
            results = results.filter(log => new Date(log.timestamp) <= end);
        }
        
        // Filter by URL
        if (options.url) {
            results = results.filter(log => log.url?.includes(options.url));
        }
        
        // Search in data
        if (options.search) {
            const search = options.search.toLowerCase();
            results = results.filter(log => 
                JSON.stringify(log.data).toLowerCase().includes(search) ||
                log.eventType.toLowerCase().includes(search)
            );
        }
        
        // Sort
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Paginate
        if (options.limit) {
            const offset = options.offset || 0;
            results = results.slice(offset, offset + options.limit);
        }
        
        return results;
    }
    
    getStats() {
        const stats = {
            totalEvents: this.logs.length,
            byType: {},
            bySeverity: {},
            byUser: {},
            timeline: []
        };
        
        // Aggregate by type
        this.logs.forEach(log => {
            stats.byType[log.eventType] = (stats.byType[log.eventType] || 0) + 1;
            stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
            stats.byUser[log.user] = (stats.byUser[log.user] || 0) + 1;
        });
        
        // Timeline (last 24 hours by hour)
        const now = Date.now();
        const hours = {};
        
        this.logs.forEach(log => {
            const hour = new Date(log.timestamp).getHours();
            hours[hour] = (hours[hour] || 0) + 1;
        });
        
        for (let i = 0; i < 24; i++) {
            stats.timeline.push({
                hour: i,
                count: hours[i] || 0
            });
        }
        
        return stats;
    }
    
    getSuspiciousActivity() {
        const suspicious = [];
        
        // Find multiple failed logins
        const failedLogins = this.query({
            eventType: this.EVENT_TYPES.AUTH_FAILED,
            minSeverity: this.SEVERITY.WARNING
        });
        
        if (failedLogins.length >= 3) {
            suspicious.push({
                type: 'brute_force',
                severity: 'high',
                count: failedLogins.length,
                message: `${failedLogins.length} percobaan login gagal terdeteksi`
            });
        }
        
        // Find security threats
        const threats = this.query({
            eventType: this.EVENT_TYPES.SECURITY_THREAT
        });
        
        if (threats.length > 0) {
            suspicious.push({
                type: 'security_threat',
                severity: 'critical',
                count: threats.length,
                message: `${threats.length} ancaman keamanan terdeteksi`
            });
        }
        
        // Find data deletions
        const deletions = this.query({
            eventType: this.EVENT_TYPES.DATA_DELETE
        });
        
        if (deletions.length >= 5) {
            suspicious.push({
                type: 'mass_deletion',
                severity: 'medium',
                count: deletions.length,
                message: `${deletions.length} penghapusan data dalam periode singkat`
            });
        }
        
        return suspicious;
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateLogId() {
        return `audit_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getCurrentUser() {
        try {
            const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
            return session.user?.username || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }
    
    getSessionId() {
        return localStorage.getItem('session_id') || 'unknown';
    }
    
    sanitizeData(data) {
        if (!data) return {};
        
        // Remove sensitive fields
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credit_card', 'ssn'];
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '***REDACTED***';
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    // ============================================
    // EXPORT
    // ============================================
    
    async exportLogs(options = {}) {
        const logs = this.query(options);
        
        return {
            metadata: {
                exportedAt: new Date().toISOString(),
                totalLogs: logs.length,
                version: '2026.1.0'
            },
            logs: logs,
            integrity: this.verifyIntegrity(),
            stats: this.getStats()
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    clear() {
        this.logs = [];
        this.pendingLogs = [];
        this.lastHash = null;
        localStorage.removeItem('audit_logs');
        this.logger.info('Audit logs cleared');
    }
    
    destroy() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flush();
        this.sessionEvents.clear();
        this.logger.info('Audit trail destroyed');
    }
}

const auditTrail = new AuditTrail();
export default auditTrail;
export { AuditTrail };