// js/audit.js - Audit Trail 2026 (PRIVACY-AWARE)
/**
 * E-Arsip Digital - Audit Trail
 * Version: 2026.1.0
 * 
 * Features:
 * - Lightweight event logging
 * - Privacy-aware (no PII, no fingerprinting)
 * - Batch sending
 * - Local storage with size limits
 * - No external dependencies
 */

var AuditTrail = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: true,
        batchSize: 10,
        sendInterval: 30000,           // 30 detik
        maxLocalEvents: 200,           // Maks event di localStorage
        maxFailedEvents: 50,           // Maks failed events
        storageKey: 'earsip_audit_events',
        failedStorageKey: 'earsip_audit_failed',
        importantActions: [
            'auth_login', 'auth_logout', 'auth_failed',
            'data_delete', 'data_change',
            'admin_action', 'security_threat',
            'config_change', 'backup_restore'
        ]
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _events = [];
    var _failedEvents = [];
    var _sendTimer = null;
    
    // ============================================
    // USER INFO (Privacy-aware)
    // ============================================
    
    function getCurrentUser() {
        try {
            // Coba dari auth session
            var session = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (session) {
                var data = JSON.parse(session);
                if (data.user) {
                    return {
                        id: data.user.id || 'unknown',
                        username: data.user.username || 'unknown',
                        role: data.user.role || 'unknown'
                    };
                }
            }
        } catch(e) {}
        
        return { id: 'anonymous', username: 'anonymous', role: 'anonymous' };
    }
    
    function getSessionId() {
        // Gunakan ID dari auth token, bukan dari storage terpisah
        try {
            var token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (token) {
                // Hash sederhana untuk session ID
                var hash = 0;
                for (var i = 0; i < token.length; i++) {
                    hash = ((hash << 5) - hash) + token.charCodeAt(i);
                    hash = hash & hash;
                }
                return 'sess_' + Math.abs(hash).toString(36);
            }
        } catch(e) {}
        
        return 'sess_unknown';
    }
    
    function sanitizeURL(url) {
        if (!url) return '';
        try {
            var parsed = new URL(url);
            // Hanya pathname, tanpa query string (bisa mengandung token)
            return parsed.origin + parsed.pathname;
        } catch(e) {
            return '';
        }
    }
    
    // ============================================
    // STORAGE MANAGEMENT
    // ============================================
    
    function loadEvents() {
        try {
            var stored = localStorage.getItem(config.storageKey);
            if (stored) {
                _events = JSON.parse(stored);
                if (!Array.isArray(_events)) _events = [];
            }
        } catch(e) {
            _events = [];
        }
        
        try {
            var failed = localStorage.getItem(config.failedStorageKey);
            if (failed) {
                _failedEvents = JSON.parse(failed);
                if (!Array.isArray(_failedEvents)) _failedEvents = [];
            }
        } catch(e) {
            _failedEvents = [];
        }
    }
    
    function saveEvents() {
        try {
            // Batasi jumlah event yang disimpan
            if (_events.length > config.maxLocalEvents) {
                _events = _events.slice(-config.maxLocalEvents);
            }
            
            var json = JSON.stringify(_events);
            
            // Cek ukuran (max ~100KB)
            if (json.length > 100000) {
                _events = _events.slice(-50);
                json = JSON.stringify(_events);
            }
            
            localStorage.setItem(config.storageKey, json);
        } catch(e) {
            // Storage full
            console.warn('[Audit] Storage full, clearing old events');
            _events = _events.slice(-20);
            try {
                localStorage.setItem(config.storageKey, JSON.stringify(_events));
            } catch(e2) {
                localStorage.removeItem(config.storageKey);
            }
        }
    }
    
    function saveFailedEvents() {
        try {
            if (_failedEvents.length > config.maxFailedEvents) {
                _failedEvents = _failedEvents.slice(-config.maxFailedEvents);
            }
            localStorage.setItem(config.failedStorageKey, JSON.stringify(_failedEvents));
        } catch(e) {
            localStorage.removeItem(config.failedStorageKey);
        }
    }
    
    // ============================================
    // EVENT LOGGING
    // ============================================
    
    function log(action, details) {
        if (!config.enabled) return null;
        if (!details) details = {};
        
        var user = getCurrentUser();
        
        var event = {
            id: 'audit_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
            action: action,
            details: details,
            userId: user.id,
            username: user.username,
            userRole: user.role,
            timestamp: new Date().toISOString(),
            url: sanitizeURL(window.location.href),
            sessionId: getSessionId()
        };
        
        // Add to events
        _events.push(event);
        
        // Save
        saveEvents();
        
        // Console log (hanya untuk development)
        if (config.importantActions.indexOf(action) !== -1) {
            console.log('[Audit] ' + action + ':', details);
        }
        
        // Send immediately if important
        if (config.importantActions.indexOf(action) !== -1) {
            sendToServer([event]);
        }
        
        return event;
    }
    
    /**
     * Convenience methods
     */
    function logAccess(resource, resourceId) {
        return log('data_access', { resource: resource, resourceId: resourceId });
    }
    
    function logChange(resource, resourceId, changes) {
        return log('data_change', { resource: resource, resourceId: resourceId, changes: changes });
    }
    
    function logDelete(resource, resourceId) {
        return log('data_delete', { resource: resource, resourceId: resourceId });
    }
    
    function logAuth(action, username, result) {
        return log('auth_' + action, { username: username, result: result });
    }
    
    function logAdminAction(action, target, details) {
        return log('admin_action', { action: action, target: target, details: details });
    }
    
    function logSecurity(eventType, details) {
        return log('security_' + eventType, { details: details });
    }
    
    // ============================================
    // SENDING
    // ============================================
    
    function sendToServer(events) {
        if (!events || events.length === 0) return;
        
        // Coba kirim via API service
        if (window.EArsip && window.EArsip.Api && typeof window.EArsip.Api.post === 'function') {
            window.EArsip.Api.post('logAudit', { events: events })
                .catch(function() {
                    // Gagal kirim - simpan ke failed
                    for (var i = 0; i < events.length; i++) {
                        _failedEvents.push(events[i]);
                    }
                    saveFailedEvents();
                });
        }
    }
    
    function flushFailedEvents() {
        if (_failedEvents.length === 0) return;
        
        var toSend = _failedEvents.splice(0, config.batchSize);
        sendToServer(toSend);
        saveFailedEvents();
    }
    
    function startBatchSender() {
        if (_sendTimer) clearInterval(_sendTimer);
        
        _sendTimer = setInterval(function() {
            // Kirim events yang belum dikirim
            if (_events.length > 0) {
                var batch = _events.splice(0, config.batchSize);
                sendToServer(batch);
                saveEvents();
            }
            
            // Kirim failed events
            flushFailedEvents();
        }, config.sendInterval);
    }
    
    // ============================================
    // QUERY
    // ============================================
    
    function getEvents(filters) {
        var events = _events.slice();
        
        if (!filters) return events;
        
        if (filters.userId) {
            events = events.filter(function(e) { return e.userId === filters.userId; });
        }
        
        if (filters.action) {
            events = events.filter(function(e) { return e.action === filters.action; });
        }
        
        if (filters.startDate) {
            var start = new Date(filters.startDate).getTime();
            events = events.filter(function(e) { return new Date(e.timestamp).getTime() >= start; });
        }
        
        if (filters.endDate) {
            var end = new Date(filters.endDate).getTime();
            events = events.filter(function(e) { return new Date(e.timestamp).getTime() <= end; });
        }
        
        // Sort newest first
        events.sort(function(a, b) {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        if (filters.limit) {
            events = events.slice(0, filters.limit);
        }
        
        return events;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function init() {
        loadEvents();
        startBatchSender();
        console.info('[Audit] Initialized (' + _events.length + ' local events)');
    }
    
    function clear() {
        _events = [];
        _failedEvents = [];
        localStorage.removeItem(config.storageKey);
        localStorage.removeItem(config.failedStorageKey);
    }
    
    function destroy() {
        if (_sendTimer) {
            clearInterval(_sendTimer);
            _sendTimer = null;
        }
        // Kirim sisa events
        if (_events.length > 0) {
            sendToServer(_events.slice());
        }
    }
    
    // Auto-init
    init();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        destroy();
    });
    
    return {
        // Logging
        log: log,
        logAccess: logAccess,
        logChange: logChange,
        logDelete: logDelete,
        logAuth: logAuth,
        logAdminAction: logAdminAction,
        logSecurity: logSecurity,
        
        // Query
        getEvents: getEvents,
        
        // Management
        clear: clear,
        flushFailed: flushFailedEvents,
        
        // Config
        enable: function() { config.enabled = true; },
        disable: function() { config.enabled = false; },
        
        /**
         * Export events as JSON string
         */
        exportJSON: function() {
            return JSON.stringify(getEvents(), null, 2);
        },
        
        /**
         * Export events as CSV string
         */
        exportCSV: function() {
            var events = getEvents();
            if (events.length === 0) return '';
            
            var headers = ['id', 'timestamp', 'action', 'userId', 'username', 'userRole', 'url'];
            var rows = [headers.join(',')];
            
            for (var i = 0; i < events.length; i++) {
                var e = events[i];
                rows.push([
                    e.id,
                    e.timestamp,
                    e.action,
                    e.userId,
                    e.username,
                    e.userRole,
                    e.url || ''
                ].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
            }
            
            return rows.join('\n');
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// AuditTrail.log('user_login', { method: 'password' });
// AuditTrail.logAccess('surat_keluar', 'SK001');
// AuditTrail.logChange('surat_keluar', 'SK001', { perihal: 'old -> new' });
// var events = AuditTrail.getEvents({ action: 'auth_failed', limit: 10 });
// var csv = AuditTrail.exportCSV();
// ============================================