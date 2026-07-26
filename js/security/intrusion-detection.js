// js/security/intrusion-detection.js - IDS 2026 (SECURE)
/**
 * E-Arsip Digital - Intrusion Detection System
 * Version: 2026.1.0
 * 
 * Features:
 * - Threat scoring per session
 * - Brute force detection
 * - Anomaly detection
 * - Non-invasive (event-based, no fetch override)
 * - PWA mobile compatible
 */

var IntrusionDetection = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: true,
        maxFailedLogins: 5,          // Max failed login sebelum alert
        failedLoginWindow: 300000,   // 5 menit
        rapidRequestThreshold: 50,   // Request per 10 detik
        rapidRequestWindow: 10000,   // 10 detik
        threatScoreDecayMs: 3600000, // 1 jam
        autoAlertThreshold: 50,      // Score untuk alert
        autoBlockThreshold: 80,      // Score untuk block
        maxDetections: 200
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _threatScores = {};          // { sessionId: score }
    var _failedLogins = {};          // { sessionId: [{time, username}] }
    var _requestCounts = {};         // { sessionId: { count, firstRequest, resetTime } }
    var _detections = [];            // Array of detection objects
    var _decayTimers = {};           // { sessionId: timerId }
    
    // ============================================
    // SESSION HELPERS
    // ============================================
    function getSessionId() {
        // Coba dapatkan dari localStorage/sessionStorage
        var id = sessionStorage.getItem('ids_session_id');
        if (!id) {
            id = localStorage.getItem('ids_session_id');
        }
        if (!id) {
            id = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
            sessionStorage.setItem('ids_session_id', id);
        }
        return id;
    }
    
    function getCurrentUser() {
        try {
            var session = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (session) {
                var data = JSON.parse(session);
                return data.user ? data.user.username : 'anonymous';
            }
        } catch(e) {}
        return 'anonymous';
    }
    
    // ============================================
    // THREAT SCORING
    // ============================================
    
    /**
     * Tambah threat score untuk session
     */
    function increaseThreatScore(sessionId, score, reason) {
        if (!sessionId) sessionId = getSessionId();
        
        var current = _threatScores[sessionId] || 0;
        _threatScores[sessionId] = current + score;
        
        // Schedule decay
        scheduleDecay(sessionId, score);
        
        // Log detection
        var detection = {
            id: 'IDS-' + Date.now().toString(36).toUpperCase(),
            sessionId: sessionId,
            score: score,
            totalScore: _threatScores[sessionId],
            reason: reason,
            timestamp: new Date().toISOString(),
            user: getCurrentUser()
        };
        
        _detections.push(detection);
        
        // Trim jika terlalu banyak
        if (_detections.length > config.maxDetections) {
            _detections = _detections.slice(-config.maxDetections);
        }
        
        // Check thresholds
        var totalScore = _threatScores[sessionId];
        
        if (totalScore >= config.autoAlertThreshold) {
            console.warn('[IDS] Alert: ' + reason + ' (score: ' + totalScore + ')');
            triggerAlert(detection);
        }
        
        if (totalScore >= config.autoBlockThreshold) {
            console.error('[IDS] BLOCK: ' + reason + ' (score: ' + totalScore + ')');
            triggerBlock(sessionId, detection);
        }
        
        return detection;
    }
    
    /**
     * Schedule threat score decay
     */
    function scheduleDecay(sessionId, score) {
        // Clear existing timer
        if (_decayTimers[sessionId]) {
            clearTimeout(_decayTimers[sessionId]);
        }
        
        // Set new decay timer
        _decayTimers[sessionId] = setTimeout(function() {
            if (_threatScores[sessionId]) {
                _threatScores[sessionId] = Math.max(0, (_threatScores[sessionId] || 0) - score);
                
                if (_threatScores[sessionId] <= 0) {
                    delete _threatScores[sessionId];
                }
            }
            delete _decayTimers[sessionId];
        }, config.threatScoreDecayMs);
    }
    
    function getThreatScore(sessionId) {
        return _threatScores[sessionId || getSessionId()] || 0;
    }
    
    function getThreatLevel(score) {
        if (score >= config.autoBlockThreshold) return 'critical';
        if (score >= config.autoAlertThreshold) return 'high';
        if (score >= 25) return 'medium';
        if (score >= 10) return 'low';
        return 'none';
    }
    
    // ============================================
    // DETECTION RULES
    // ============================================
    
    /**
     * Deteksi brute force login
     */
    function detectBruteForce(username) {
        var sessionId = getSessionId();
        
        if (!_failedLogins[sessionId]) {
            _failedLogins[sessionId] = [];
        }
        
        var now = Date.now();
        
        // Tambahkan failed attempt
        _failedLogins[sessionId].push({
            time: now,
            username: username
        });
        
        // Hapus yang expired
        _failedLogins[sessionId] = _failedLogins[sessionId].filter(function(attempt) {
            return now - attempt.time < config.failedLoginWindow;
        });
        
        // Cek threshold
        if (_failedLogins[sessionId].length >= config.maxFailedLogins) {
            increaseThreatScore(sessionId, 30, 
                'Brute force: ' + _failedLogins[sessionId].length + ' failed logins');
            return true;
        }
        
        return false;
    }
    
    /**
     * Reset failed login counter (setelah sukses)
     */
    function resetFailedLogins() {
        var sessionId = getSessionId();
        delete _failedLogins[sessionId];
    }
    
    /**
     * Deteksi rapid requests
     */
    function detectRapidRequests() {
        var sessionId = getSessionId();
        var now = Date.now();
        
        if (!_requestCounts[sessionId]) {
            _requestCounts[sessionId] = {
                count: 1,
                firstRequest: now,
                resetTime: now + config.rapidRequestWindow
            };
            return false;
        }
        
        var counter = _requestCounts[sessionId];
        
        // Reset jika window expired
        if (now > counter.resetTime) {
            counter.count = 1;
            counter.firstRequest = now;
            counter.resetTime = now + config.rapidRequestWindow;
            return false;
        }
        
        counter.count++;
        
        // Cek threshold
        if (counter.count >= config.rapidRequestThreshold) {
            increaseThreatScore(sessionId, 20,
                'Rapid requests: ' + counter.count + ' in ' + 
                Math.round((now - counter.firstRequest) / 1000) + 's');
            return true;
        }
        
        return false;
    }
    
    /**
     * Deteksi XSS attempt
     */
    function detectXSS(payload) {
        var sessionId = getSessionId();
        increaseThreatScore(sessionId, 40,
            'XSS attempt: ' + (payload ? payload.substring(0, 50) : ''));
    }
    
    /**
     * Deteksi SQL injection attempt
     */
    function detectSQLi(payload) {
        var sessionId = getSessionId();
        increaseThreatScore(sessionId, 50,
            'SQLi attempt: ' + (payload ? payload.substring(0, 50) : ''));
    }
    
    /**
     * Deteksi path traversal
     */
    function detectPathTraversal(url) {
        var sessionId = getSessionId();
        increaseThreatScore(sessionId, 35,
            'Path traversal: ' + (url ? url.substring(0, 100) : ''));
    }
    
    /**
     * Deteksi CSRF violation
     */
    function detectCSRFViolation() {
        var sessionId = getSessionId();
        increaseThreatScore(sessionId, 25, 'CSRF violation');
    }
    
    // ============================================
    // ALERT & BLOCK
    // ============================================
    
    function triggerAlert(detection) {
        // Dispatch custom event
        try {
            var event = new CustomEvent('ids:alert', {
                detail: {
                    detection: detection,
                    threatLevel: getThreatLevel(detection.totalScore),
                    message: '[IDS] ' + detection.reason
                }
            });
            window.dispatchEvent(event);
        } catch(e) {}
        
        // Log ke audit trail jika tersedia
        if (window.AuditTrail && typeof window.AuditTrail.logSecurity === 'function') {
            window.AuditTrail.logSecurity('INTRUSION_DETECTED', {
                reason: detection.reason,
                score: detection.totalScore
            });
        }
    }
    
    function triggerBlock(sessionId, detection) {
        // Dispatch block event
        try {
            var event = new CustomEvent('ids:block', {
                detail: {
                    sessionId: sessionId,
                    detection: detection,
                    permanent: detection.totalScore >= 100
                }
            });
            window.dispatchEvent(event);
        } catch(e) {}
        
        console.error('[IDS] Session blocked: ' + sessionId);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Record failed login attempt
         */
        recordFailedLogin: function(username) {
            return detectBruteForce(username || 'unknown');
        },
        
        /**
         * Record successful login (reset counter)
         */
        recordSuccessfulLogin: function() {
            resetFailedLogins();
        },
        
        /**
         * Record API request (for rate limiting)
         */
        recordRequest: function() {
            return detectRapidRequests();
        },
        
        /**
         * Record XSS detection
         */
        recordXSS: function(payload) {
            detectXSS(payload);
        },
        
        /**
         * Record SQLi detection
         */
        recordSQLi: function(payload) {
            detectSQLi(payload);
        },
        
        /**
         * Record path traversal detection
         */
        recordPathTraversal: function(url) {
            detectPathTraversal(url);
        },
        
        /**
         * Record CSRF violation
         */
        recordCSRFViolation: function() {
            detectCSRFViolation();
        },
        
        /**
         * Get threat score for session
         */
        getThreatScore: function(sessionId) {
            return getThreatScore(sessionId);
        },
        
        /**
         * Get threat level
         */
        getThreatLevel: function(sessionId) {
            return getThreatLevel(getThreatScore(sessionId));
        },
        
        /**
         * Get all threat scores
         */
        getAllThreatScores: function() {
            var scores = [];
            for (var id in _threatScores) {
                if (_threatScores.hasOwnProperty(id)) {
                    scores.push({
                        sessionId: id,
                        score: _threatScores[id],
                        level: getThreatLevel(_threatScores[id])
                    });
                }
            }
            scores.sort(function(a, b) { return b.score - a.score; });
            return scores;
        },
        
        /**
         * Get recent detections
         */
        getDetections: function(limit) {
            var result = _detections.slice().reverse();
            if (limit) result = result.slice(0, limit);
            return result;
        },
        
        /**
         * Get statistics
         */
        getStats: function() {
            var activeThreats = 0;
            var highThreats = 0;
            
            for (var id in _threatScores) {
                if (_threatScores.hasOwnProperty(id) && _threatScores[id] > 0) {
                    activeThreats++;
                    if (_threatScores[id] >= config.autoAlertThreshold) {
                        highThreats++;
                    }
                }
            }
            
            return {
                totalDetections: _detections.length,
                activeThreats: activeThreats,
                highThreats: highThreats,
                totalSessions: Object.keys(_threatScores).length
            };
        },
        
        /**
         * Reset all data
         */
        reset: function() {
            _threatScores = {};
            _failedLogins = {};
            _requestCounts = {};
            _detections = [];
            
            // Clear decay timers
            for (var id in _decayTimers) {
                if (_decayTimers.hasOwnProperty(id)) {
                    clearTimeout(_decayTimers[id]);
                }
            }
            _decayTimers = {};
        },
        
        /**
         * Update config
         */
        configure: function(newConfig) {
            if (newConfig) {
                for (var key in newConfig) {
                    if (newConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = newConfig[key];
                    }
                }
            }
        },
        
        /**
         * Get session ID
         */
        getSessionId: getSessionId
    };
})();

// ============================================
// AUTO-INTEGRATE dengan modul lain jika tersedia
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Listen untuk event dari firewall
    window.addEventListener('firewall:blocked', function(e) {
        if (e.detail && e.detail.type === 'sqli') {
            IntrusionDetection.recordSQLi(e.detail.input);
        } else if (e.detail && e.detail.type === 'xss') {
            IntrusionDetection.recordXSS(e.detail.input);
        }
    });
    
    // Listen untuk event dari CSRF
    window.addEventListener('security:csrf_violation', function() {
        IntrusionDetection.recordCSRFViolation();
    });
});

// ============================================
// USAGE:
// ============================================
// // Login failed
// IntrusionDetection.recordFailedLogin('admin');
// 
// // Login success
// IntrusionDetection.recordSuccessfulLogin();
// 
// // API request
// IntrusionDetection.recordRequest();
// 
// // Check threat
// var score = IntrusionDetection.getThreatScore();
// var level = IntrusionDetection.getThreatLevel();
// var stats = IntrusionDetection.getStats();
// ============================================