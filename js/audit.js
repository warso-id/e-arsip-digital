// FILE: js/audit.js
// ============================================
// AUDIT TRAIL - E-ARSIP DIGITAL
// ============================================

class AuditTrail {
    constructor() {
        this.events = [];
        this.enabled = true;
        this.batchSize = 10;
        this.sendInterval = 30000; // 30 detik
        
        this.init();
    }
    
    /**
     * Initialize audit trail
     */
    init() {
        this.loadStoredEvents();
        this.startBatchSender();
    }
    
    /**
     * Log an event
     */
    async log(action, details = {}) {
        if (!this.enabled) return;
        
        const event = {
            id: this.generateEventId(),
            action: action,
            details: details,
            userId: this.getCurrentUserId(),
            username: this.getCurrentUsername(),
            userRole: this.getCurrentUserRole(),
            timestamp: new Date().toISOString(),
            ip: 'client-ip', // Will be filled by server
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getSessionId()
        };
        
        // Add to local events
        this.events.push(event);
        
        // Store locally
        this.storeEvent(event);
        
        // Log to console
        console.log(`[AUDIT] ${action}:`, details);
        
        // Send immediately if important
        if (this.isImportantAction(action)) {
            await this.sendToServer([event]);
        }
    }
    
    /**
     * Log data access
     */
    logAccess(resource, resourceId) {
        return this.log('data_access', {
            resource: resource,
            resourceId: resourceId
        });
    }
    
    /**
     * Log data change
     */
    logChange(resource, resourceId, changes) {
        return this.log('data_change', {
            resource: resource,
            resourceId: resourceId,
            changes: changes
        });
    }
    
    /**
     * Log data delete
     */
    logDelete(resource, resourceId) {
        return this.log('data_delete', {
            resource: resource,
            resourceId: resourceId
        });
    }
    
    /**
     * Log authentication event
     */
    logAuth(action, username, result) {
        return this.log('authentication', {
            action: action,
            username: username,
            result: result
        });
    }
    
    /**
     * Log admin action
     */
    logAdminAction(action, target, details) {
        return this.log('admin_action', {
            action: action,
            target: target,
            details: details
        });
    }
    
    /**
     * Log security event
     */
    logSecurity(eventType, details) {
        return this.log('security', {
            eventType: eventType,
            details: details
        });
    }
    
    /**
     * Check if action is important
     */
    isImportantAction(action) {
        const importantActions = [
            'authentication',
            'admin_action',
            'security',
            'data_delete',
            'data_change'
        ];
        return importantActions.includes(action);
    }
    
    /**
     * Send events to server
     */
    async sendToServer(events) {
        try {
            if (typeof api !== 'undefined') {
                await api.sendRequest({
                    action: 'logAuditEvents',
                    events: events
                });
            }
        } catch (error) {
            console.error('Failed to send audit events:', error);
            // Store failed events
            this.storeFailedEvents(events);
        }
    }
    
    /**
     * Start batch sender
     */
    startBatchSender() {
        setInterval(async () => {
            if (this.events.length > 0) {
                const batch = this.events.splice(0, this.batchSize);
                await this.sendToServer(batch);
            }
            
            // Also send failed events
            const failedEvents = this.getFailedEvents();
            if (failedEvents.length > 0) {
                await this.sendToServer(failedEvents);
                this.clearFailedEvents();
            }
        }, this.sendInterval);
    }
    
    /**
     * Store event locally
     */
    storeEvent(event) {
        const stored = this.getStoredEvents();
        stored.push(event);
        
        // Keep only last 1000 events locally
        if (stored.length > 1000) {
            stored.splice(0, stored.length - 1000);
        }
        
        localStorage.setItem('auditEvents', JSON.stringify(stored));
    }
    
    /**
     * Get stored events
     */
    getStoredEvents() {
        try {
            return JSON.parse(localStorage.getItem('auditEvents') || '[]');
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Load stored events
     */
    loadStoredEvents() {
        this.events = this.getStoredEvents();
    }
    
    /**
     * Store failed events
     */
    storeFailedEvents(events) {
        const failed = this.getFailedEvents();
        failed.push(...events);
        localStorage.setItem('failedAuditEvents', JSON.stringify(failed));
    }
    
    /**
     * Get failed events
     */
    getFailedEvents() {
        try {
            return JSON.parse(localStorage.getItem('failedAuditEvents') || '[]');
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Clear failed events
     */
    clearFailedEvents() {
        localStorage.removeItem('failedAuditEvents');
    }
    
    /**
     * Generate event ID
     */
    generateEventId() {
        return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Get current user ID
     */
    getCurrentUserId() {
        const userData = localStorage.getItem('currentUser') || 
                        sessionStorage.getItem('currentUser');
        if (userData) {
            return JSON.parse(userData).id || 'unknown';
        }
        return 'anonymous';
    }
    
    /**
     * Get current username
     */
    getCurrentUsername() {
        const userData = localStorage.getItem('currentUser') || 
                        sessionStorage.getItem('currentUser');
        if (userData) {
            return JSON.parse(userData).username || 'unknown';
        }
        return 'anonymous';
    }
    
    /**
     * Get current user role
     */
    getCurrentUserRole() {
        const userData = localStorage.getItem('currentUser') || 
                        sessionStorage.getItem('currentUser');
        if (userData) {
            return JSON.parse(userData).role || 'unknown';
        }
        return 'anonymous';
    }
    
    /**
     * Get session ID
     */
    getSessionId() {
        const sessionData = sessionStorage.getItem('sessionData');
        if (sessionData) {
            return JSON.parse(sessionData).token || 'unknown';
        }
        return 'unknown';
    }
    
    /**
     * Get all events
     */
    getEvents(filters = {}) {
        let events = [...this.events, ...this.getStoredEvents()];
        
        if (filters.userId) {
            events = events.filter(e => e.userId === filters.userId);
        }
        
        if (filters.action) {
            events = events.filter(e => e.action === filters.action);
        }
        
        if (filters.startDate) {
            events = events.filter(e => new Date(e.timestamp) >= new Date(filters.startDate));
        }
        
        if (filters.endDate) {
            events = events.filter(e => new Date(e.timestamp) <= new Date(filters.endDate));
        }
        
        // Sort by timestamp descending
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (filters.limit) {
            events = events.slice(0, filters.limit);
        }
        
        return events;
    }
    
    /**
     * Export events
     */
    exportEvents(format = 'json') {
        const events = this.getEvents();
        
        if (format === 'csv') {
            return ExportHandler.toCSV(events, `audit-trail-${new Date().toISOString().split('T')[0]}.csv`);
        } else {
            return ExportHandler.toJSON(events, `audit-trail-${new Date().toISOString().split('T')[0]}.json`);
        }
    }
    
    /**
     * Clear all events
     */
    clearEvents() {
        this.events = [];
        localStorage.removeItem('auditEvents');
        localStorage.removeItem('failedAuditEvents');
    }
}

// Create global instance
const auditTrail = new AuditTrail();

// Auto-log page views
document.addEventListener('DOMContentLoaded', () => {
    auditTrail.logAccess('page', window.location.pathname);
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuditTrail;
}