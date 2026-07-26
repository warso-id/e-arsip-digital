// js/security/audit.js - Audit Trail System 2026 (SECURE)
/**
 * E-Arsip Digital - Audit Trail System
 * Version: 2026.1.0
 * 
 * Mencatat semua event keamanan dengan:
 * - Privacy-aware logging (no PII)
 * - Local storage dengan batasan
 * - Integrity verification
 * - No external dependencies
 */

var AuditTrail = (function() {
    'use strict';
    
    // ============================================
    // CONSTANTS
    // ============================================
    var EVENT_TYPES = {
        AUTH_LOGIN: 'auth.login',
        AUTH_LOGOUT: 'auth.logout',
        AUTH_FAILED: 'auth.failed',
        AUTH_PASSWORD_CHANGE: 'auth.password_change',
        DATA_CREATE: 'data.create',
        DATA_UPDATE: 'data.update',
        DATA_DELETE: 'data.delete',
        DATA_EXPORT: 'data.export',
        DATA_VIEW: 'data.view',
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
        SESSION_START: 'session.start',
        SESSION_END: 'session.end'
    };
    
    var SEVERITY = {
        DEBUG: 0,
        INFO: 1,
        WARNING: 2,
        ERROR: 3,
        CRITICAL: 4
    };
    
    var SEVERITY_LABELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    
    // Sensitive keys yang HARUS di-redact
    var SENSITIVE_KEYS = [
        'password', 'passwd', 'pwd', 'secret', 'token', 'key', 'api_key',
        'authorization', 'auth', 'credential', 'credit_card', 'ssn', 'ktp',
        'passport', 'nik', 'nip', 'nim', 'email', 'phone', 'telepon', 'alamat'
    ];
    
    // Maksimum log entries
    var MAX_LOGS = 500;
    var BATCH_SIZE = 10;
    var FLUSH_INTERVAL = 30000; // 30 detik
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _logs = [];
    var _pendingLogs = [];
    var _lastHash = null;
    var _flushTimer = null;
    var _sessionId = null;
    
    // ============================================
    // SANITIZATION (PRIVACY-AWARE)
    // ============================================
    function sanitizeData(data, depth) {
        if (!data || typeof data !== 'object') return data;
        if (depth === undefined) depth = 0;
        if (depth > 5) return '[MAX_DEPTH]'; // Cegah infinite recursion
        
        if (Array.isArray(data)) {
            return data.map(function(item) {
                return sanitizeData(item, depth + 1);
            });
        }
        
        var sanitized = {};
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var lowerKey = key.toLowerCase();
                
                // Cek apakah key sensitif
                var isSensitive = SENSITIVE_KEYS.some(function(sk) {
                    return lowerKey.indexOf(sk) !== -1;
                });
                
                if (isSensitive) {
                    sanitized[key] = '***REDACTED***';
                } else if (typeof data[key] === 'object' && data[key] !== null) {
                    sanitized[key] = sanitizeData(data[key], depth + 1);
                } else if (typeof data[key] === 'string' && data[key].length > 500) {
                    sanitized[key] = data[key].substring(0, 500) + '...[TRUNCATED]';
                } else {
                    sanitized[key] = data[key];
                }
            }
        }
        
        return sanitized;
    }
    
    function sanitizeURL(url) {
        if (!url) return '';
        try {
            var parsed = new URL(url);
            // Hanya simpan pathname (bukan query string/hash)
            return parsed.origin + parsed.pathname;
        } catch(e) {
            return '[INVALID_URL]';
        }
    }
    
    // ============================================
    // USER INFO (Privacy-aware)
    // ============================================
    function getCurrentUser() {
        try {
            var session = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (session) {
                var data = JSON.parse(session);
                if (data.user) {
                    return {
                        username: data.user.username || 'unknown',
                        role: data.user.role || 'unknown'
                    };
                }
            }
        } catch(e) {}
        
        return { username: 'anonymous', role: 'anonymous' };
    }
    
    function getSessionId() {
        if (!_sessionId) {
            _sessionId = localStorage.getItem('audit_session_id');
            if (!_sessionId) {
                _sessionId = 'sess_' + Date.now().toString(36) + '_' + 
                    Math.random().toString(36).substring(2, 8);
                localStorage.setItem('audit_session_id', _sessionId);
            }
        }
        return _sessionId;
    }
    
    // ============================================
    // HASH GENERATION (Cryptographic)
    // ============================================
    function generateHash(entry, previousHash) {
        var data = [
            entry.timestamp || '',
            entry.eventType || '',
            (entry.user && entry.user.username) || '',
            entry.url || '',
            JSON.stringify(entry.data || {}),
            previousHash || ''
        ].join('|');
        
        // Simple but effective hash menggunakan DJB2
        var hash = 5381;
        for (var i = 0; i < data.length; i++) {
            hash = ((hash << 5) + hash) + data.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Convert ke hex dan pad
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    
    // ============================================
    // LOG ENTRY CREATION
    // ============================================
    function createLogEntry(eventType, data, severity) {
        if (!severity) severity = SEVERITY.INFO;
        if (!data) data = {};
        
        var entry = {
            id: 'audit_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
            timestamp: new Date().toISOString(),
            eventType: eventType,
            severity: severity,
            user: getCurrentUser(),
            sessionId: getSessionId(),
            url: sanitizeURL(window.location.href),
            data: sanitizeData(data),
            hash: null
        };
        
        // Generate integrity hash
        entry.hash = generateHash(entry, _lastHash);
        _lastHash = entry.hash;
        
        return entry;
    }
    
    // ============================================
    // LOGGING METHODS
    // ============================================
    function log(eventType, data, severity) {
        var entry = createLogEntry(eventType, data, severity);
        
        _pendingLogs.push(entry);
        
        // Auto-flush if batch full
        if (_pendingLogs.length >= BATCH_SIZE) {
            flush();
        }
        
        // Immediately flush critical events
        if (severity >= SEVERITY.CRITICAL) {
            flush();
        }
        
        // Console log untuk development
        if (severity >= SEVERITY.WARNING) {
            console.warn('[Audit] ' + SEVERITY_LABELS[severity] + ': ' + eventType, 
                entry.user.username, entry.data);
        }
        
        return entry;
    }
    
    function logAuth(event, data) {
        return log(
            EVENT_TYPES['AUTH_' + event.toUpperCase()] || event,
            data,
            event === 'FAILED' ? SEVERITY.WARNING : SEVERITY.INFO
        );
    }
    
    function logData(action, data) {
        var sev = action === 'DELETE' ? SEVERITY.WARNING : SEVERITY.INFO;
        return log(EVENT_TYPES['DATA_' + action.toUpperCase()] || action, data, sev);
    }
    
    function logSecurity(event, data) {
        return log(
            EVENT_TYPES['SECURITY_' + event.toUpperCase()] || event,
            data,
            SEVERITY.WARNING
        );
    }
    
    function logError(error, data) {
        var errorData = {
            message: error ? (error.message || String(error)) : 'Unknown error',
            type: error ? (error.name || 'Error') : 'Error'
        };
        
        // JANGAN log full stack trace (privacy)
        if (data) {
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    errorData[key] = data[key];
                }
            }
        }
        
        return log(EVENT_TYPES.SYSTEM_ERROR, errorData, SEVERITY.ERROR);
    }
    
    function logCritical(event, data) {
        return log(event, data, SEVERITY.CRITICAL);
    }
    
    // ============================================
    // FLUSH & STORAGE
    // ============================================
    function setupFlushTimer() {
        if (_flushTimer) clearInterval(_flushTimer);
        _flushTimer = setInterval(flush, FLUSH_INTERVAL);
        
        // Flush on page unload/hide (mobile-friendly)
        window.addEventListener('beforeunload', flush);
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) flush();
        });
    }
    
    function flush() {
        if (_pendingLogs.length === 0) return;
        
        // Add to main logs
        _logs = _logs.concat(_pendingLogs);
        
        // Trim if exceeds max
        if (_logs.length > MAX_LOGS) {
            _logs = _logs.slice(-MAX_LOGS);
        }
        
        // Save to localStorage
        saveLogs();
        
        // Clear pending
        _pendingLogs = [];
    }
    
    function saveLogs() {
        try {
            // Hanya simpan 100 log terakhir untuk hemat storage
            var recentLogs = _logs.slice(-100);
            var jsonStr = JSON.stringify(recentLogs);
            
            // Cek ukuran sebelum simpan
            if (jsonStr.length > 500000) { // 500KB limit
                recentLogs = _logs.slice(-50);
                jsonStr = JSON.stringify(recentLogs);
            }
            
            localStorage.setItem('audit_logs', jsonStr);
            localStorage.setItem('audit_last_saved', Date.now().toString());
        } catch(e) {
            // Storage full - hapus log lama
            console.warn('Audit: Storage full, clearing old logs');
            try {
                _logs = _logs.slice(-20);
                localStorage.setItem('audit_logs', JSON.stringify(_logs));
            } catch(e2) {
                localStorage.removeItem('audit_logs');
            }
        }
    }
    
    function loadLogs() {
        try {
            var saved = localStorage.getItem('audit_logs');
            if (saved) {
                var parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    _logs = parsed;
                    // Restore last hash
                    if (_logs.length > 0) {
                        _lastHash = _logs[_logs.length - 1].hash || null;
                    }
                }
            }
        } catch(e) {
            console.warn('Audit: Failed to load logs');
            _logs = [];
        }
    }
    
    // ============================================
    // INTEGRITY VERIFICATION
    // ============================================
    function verifyIntegrity() {
        var results = [];
        var previousHash = null;
        
        for (var i = 0; i < _logs.length; i++) {
            var entry = _logs[i];
            var tempPrev = _lastHash;
            _lastHash = previousHash;
            var expectedHash = generateHash(entry, previousHash);
            _lastHash = tempPrev;
            
            if (entry.hash !== expectedHash) {
                results.push({
                    index: i,
                    id: entry.id,
                    timestamp: entry.timestamp,
                    tampered: true
                });
            }
            
            previousHash = entry.hash;
        }
        
        return {
            total: _logs.length,
            tampered: results.length,
            isValid: results.length === 0,
            details: results
        };
    }
    
    // ============================================
    // QUERY
    // ============================================
    function query(options) {
        if (!options) options = {};
        
        var results = _logs.slice();
        
        if (options.eventType) {
            results = results.filter(function(log) {
                return log.eventType === options.eventType;
            });
        }
        
        if (options.minSeverity !== undefined) {
            results = results.filter(function(log) {
                return log.severity >= options.minSeverity;
            });
        }
        
        if (options.user) {
            results = results.filter(function(log) {
                return log.user && log.user.username === options.user;
            });
        }
        
        if (options.startDate) {
            var start = new Date(options.startDate).getTime();
            results = results.filter(function(log) {
                return new Date(log.timestamp).getTime() >= start;
            });
        }
        
        if (options.endDate) {
            var end = new Date(options.endDate).getTime();
            results = results.filter(function(log) {
                return new Date(log.timestamp).getTime() <= end;
            });
        }
        
        if (options.search) {
            var search = options.search.toLowerCase();
            results = results.filter(function(log) {
                return log.eventType.toLowerCase().indexOf(search) !== -1 ||
                    JSON.stringify(log.data).toLowerCase().indexOf(search) !== -1;
            });
        }
        
        // Sort newest first
        results.sort(function(a, b) {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        if (options.limit) {
            var offset = options.offset || 0;
            results = results.slice(offset, offset + options.limit);
        }
        
        return results;
    }
    
    function getStats() {
        var stats = {
            totalEvents: _logs.length,
            byType: {},
            bySeverity: {},
            byUser: {},
            timeline: []
        };
        
        _logs.forEach(function(log) {
            stats.byType[log.eventType] = (stats.byType[log.eventType] || 0) + 1;
            stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
            var username = log.user ? log.user.username : 'unknown';
            stats.byUser[username] = (stats.byUser[username] || 0) + 1;
        });
        
        // Timeline per jam (24 jam terakhir)
        for (var i = 0; i < 24; i++) {
            stats.timeline.push({ hour: i, count: 0 });
        }
        
        var now = Date.now();
        _logs.forEach(function(log) {
            var diff = now - new Date(log.timestamp).getTime();
            if (diff < 86400000) { // Dalam 24 jam
                var hour = new Date(log.timestamp).getHours();
                stats.timeline[hour].count++;
            }
        });
        
        return stats;
    }
    
    function getSuspiciousActivity() {
        var suspicious = [];
        
        // Deteksi failed login beruntun
        var failedLogins = query({
            eventType: EVENT_TYPES.AUTH_FAILED,
            minSeverity: SEVERITY.WARNING
        });
        
        if (failedLogins.length >= 3) {
            suspicious.push({
                type: 'brute_force',
                severity: 'high',
                count: failedLogins.length,
                message: failedLogins.length + ' percobaan login gagal'
            });
        }
        
        // Deteksi security threats
        var threats = query({ eventType: EVENT_TYPES.SECURITY_THREAT });
        if (threats.length > 0) {
            suspicious.push({
                type: 'security_threat',
                severity: 'critical',
                count: threats.length,
                message: threats.length + ' ancaman keamanan'
            });
        }
        
        return suspicious;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    function init() {
        loadLogs();
        setupFlushTimer();
    }
    
    function clear() {
        _logs = [];
        _pendingLogs = [];
        _lastHash = null;
        localStorage.removeItem('audit_logs');
        localStorage.removeItem('audit_last_saved');
    }
    
    function destroy() {
        if (_flushTimer) clearInterval(_flushTimer);
        flush();
        window.removeEventListener('beforeunload', flush);
        window.removeEventListener('pagehide', flush);
    }
    
    // Auto-init
    init();
    
    return {
        // Constants
        EVENT_TYPES: EVENT_TYPES,
        SEVERITY: SEVERITY,
        
        // Logging
        log: log,
        logAuth: logAuth,
        logData: logData,
        logSecurity: logSecurity,
        logError: logError,
        logCritical: logCritical,
        
        // Management
        flush: flush,
        clear: clear,
        destroy: destroy,
        
        // Query
        query: query,
        getStats: getStats,
        getSuspiciousActivity: getSuspiciousActivity,
        
        // Integrity
        verifyIntegrity: verifyIntegrity,
        
        // Session
        getSessionId: getSessionId,
        getCurrentUser: getCurrentUser
    };
})();

// ============================================
// USAGE:
// ============================================
// AuditTrail.log(AuditTrail.EVENT_TYPES.AUTH_LOGIN, { method: 'password' });
// AuditTrail.logAuth('LOGIN', { method: 'password' });
// AuditTrail.logData('CREATE', { table: 'surat_keluar', id: 'SK001' });
// AuditTrail.logSecurity('XSS', { payload: '<script>' });
// var stats = AuditTrail.getStats();
// var suspicious = AuditTrail.getSuspiciousActivity();
// ============================================