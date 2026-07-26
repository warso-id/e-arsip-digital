// js/security/session-hardening.js - Session Hardening 2026 (PRIVACY-AWARE)
/**
 * E-Arsip Digital - Session Hardening
 * Version: 2026.1.0
 * 
 * Features:
 * - Idle timeout detection
 * - Activity monitoring
 * - Session validation
 * - Auto-logout on inactivity
 * - NO fingerprinting (privacy-aware)
 */

var SessionHardening = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: true,
        idleTimeout: 1800000,        // 30 menit idle
        absoluteTimeout: 28800000,   // 8 jam maksimal
        extendOnActivity: true,      // Perpanjang session saat ada aktivitas
        activityEvents: [            // Event yang dianggap aktivitas
            'mousedown', 'keydown', 'scroll',
            'touchstart', 'click', 'focus'
        ],
        heartbeatInterval: 30000,    // Cek session setiap 30 detik
        warnBeforeTimeout: 60000,    // Peringatan 1 menit sebelum timeout
        redirectUrl: '../login.html?message=session_expired'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _lastActivity = Date.now();
    var _sessionStart = Date.now();
    var _idleTimer = null;
    var _heartbeatTimer = null;
    var _warningTimer = null;
    var _activityHandler = null;
    var _callbacks = {};            // { onTimeout, onWarning, onActivity }
    var _initialized = false;
    var _isWarningShown = false;
    
    // ============================================
    // ACTIVITY TRACKING
    // ============================================
    
    function updateActivity() {
        _lastActivity = Date.now();
        _isWarningShown = false;
        
        // Reset timers
        if (config.extendOnActivity) {
            resetTimers();
        }
        
        // Callback
        if (_callbacks.onActivity) {
            _callbacks.onActivity();
        }
    }
    
    function startActivityMonitoring() {
        // Buat handler (debounced)
        var debounceTimer = null;
        _activityHandler = function() {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updateActivity, 1000);
        };
        
        // Attach listeners
        for (var i = 0; i < config.activityEvents.length; i++) {
            document.addEventListener(config.activityEvents[i], _activityHandler, { passive: true });
        }
        
        // Visibility change
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                updateActivity();
            }
        });
    }
    
    function stopActivityMonitoring() {
        if (_activityHandler) {
            for (var i = 0; i < config.activityEvents.length; i++) {
                document.removeEventListener(config.activityEvents[i], _activityHandler);
            }
            _activityHandler = null;
        }
    }
    
    // ============================================
    // TIMERS
    // ============================================
    
    function resetTimers() {
        clearTimers();
        startIdleTimer();
        startWarningTimer();
    }
    
    function startIdleTimer() {
        if (_idleTimer) clearTimeout(_idleTimer);
        
        _idleTimer = setTimeout(function() {
            console.warn('[SessionHardening] Session expired (idle timeout)');
            
            if (_callbacks.onTimeout) {
                _callbacks.onTimeout('idle_timeout');
            } else {
                // Default: redirect ke login
                window.location.href = config.redirectUrl;
            }
        }, config.idleTimeout);
    }
    
    function startWarningTimer() {
        if (_warningTimer) clearTimeout(_warningTimer);
        
        var warningTime = config.idleTimeout - config.warnBeforeTimeout;
        if (warningTime <= 0) return;
        
        _warningTimer = setTimeout(function() {
            if (!_isWarningShown) {
                _isWarningShown = true;
                console.warn('[SessionHardening] Session will expire soon');
                
                if (_callbacks.onWarning) {
                    _callbacks.onWarning();
                }
            }
        }, warningTime);
    }
    
    function startHeartbeat() {
        if (_heartbeatTimer) clearInterval(_heartbeatTimer);
        
        _heartbeatTimer = setInterval(function() {
            var idleTime = Date.now() - _lastActivity;
            var sessionAge = Date.now() - _sessionStart;
            
            // Check absolute timeout
            if (sessionAge > config.absoluteTimeout) {
                console.warn('[SessionHardening] Session expired (absolute timeout)');
                clearTimers();
                
                if (_callbacks.onTimeout) {
                    _callbacks.onTimeout('absolute_timeout');
                } else {
                    window.location.href = config.redirectUrl;
                }
                return;
            }
            
            // Check idle timeout
            if (idleTime > config.idleTimeout) {
                console.warn('[SessionHardening] Session expired (idle)');
                clearTimers();
                
                if (_callbacks.onTimeout) {
                    _callbacks.onTimeout('idle_timeout');
                } else {
                    window.location.href = config.redirectUrl;
                }
            }
        }, config.heartbeatInterval);
    }
    
    function clearTimers() {
        if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
        if (_warningTimer) { clearTimeout(_warningTimer); _warningTimer = null; }
        if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
    }
    
    // ============================================
    // SESSION INFO
    // ============================================
    
    function getIdleTime() {
        return Date.now() - _lastActivity;
    }
    
    function getSessionAge() {
        return Date.now() - _sessionStart;
    }
    
    function getRemainingTime() {
        return Math.max(0, config.idleTimeout - getIdleTime());
    }
    
    function getStatus() {
        var idleTime = getIdleTime();
        var sessionAge = getSessionAge();
        
        return {
            idleTime: idleTime,
            sessionAge: sessionAge,
            remainingTime: Math.max(0, config.idleTimeout - idleTime),
            isExpiring: idleTime > (config.idleTimeout - config.warnBeforeTimeout),
            isExpired: idleTime > config.idleTimeout || sessionAge > config.absoluteTimeout,
            lastActivity: new Date(_lastActivity).toISOString(),
            sessionStart: new Date(_sessionStart).toISOString()
        };
    }
    
    // ============================================
    // CALLBACKS
    // ============================================
    
    function onTimeout(callback) {
        _callbacks.onTimeout = callback;
    }
    
    function onWarning(callback) {
        _callbacks.onWarning = callback;
    }
    
    function onActivity(callback) {
        _callbacks.onActivity = callback;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Initialize session hardening
         */
        init: function(options) {
            if (_initialized) return;
            
            if (options) {
                for (var key in options) {
                    if (options.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = options[key];
                    }
                }
            }
            
            if (!config.enabled) return;
            
            _lastActivity = Date.now();
            _sessionStart = Date.now();
            
            startActivityMonitoring();
            startIdleTimer();
            startWarningTimer();
            startHeartbeat();
            
            _initialized = true;
            
            console.info('[SessionHardening] Initialized (idle: ' + 
                Math.round(config.idleTimeout / 60000) + 'min, absolute: ' + 
                Math.round(config.absoluteTimeout / 3600000) + 'hrs)');
        },
        
        /**
         * Update last activity (panggil manual jika perlu)
         */
        touch: function() {
            updateActivity();
        },
        
        /**
         * Get session status
         */
        getStatus: getStatus,
        
        /**
         * Get idle time in ms
         */
        getIdleTime: getIdleTime,
        
        /**
         * Get session age in ms
         */
        getSessionAge: getSessionAge,
        
        /**
         * Get remaining time before timeout
         */
        getRemainingTime: getRemainingTime,
        
        /**
         * Check if session is valid
         */
        isValid: function() {
            return getIdleTime() < config.idleTimeout && 
                   getSessionAge() < config.absoluteTimeout;
        },
        
        /**
         * Register timeout callback
         */
        onTimeout: onTimeout,
        
        /**
         * Register warning callback
         */
        onWarning: onWarning,
        
        /**
         * Register activity callback
         */
        onActivity: onActivity,
        
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
                // Reset timers dengan config baru
                if (_initialized) {
                    resetTimers();
                }
            }
        },
        
        /**
         * Destroy (cleanup)
         */
        destroy: function() {
            clearTimers();
            stopActivityMonitoring();
            _callbacks = {};
            _initialized = false;
        }
    };
})();

// ============================================
// AUTO-INIT jika config tersedia
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    var sessionConfig = null;
    
    if (window.EArsip && window.EArsip.Config && window.EArsip.Config.auth) {
        sessionConfig = {
            idleTimeout: window.EArsip.Config.auth.idleTimeout || 1800000,
            absoluteTimeout: window.EArsip.Config.auth.absoluteTimeout || 28800000,
            enabled: true
        };
    }
    
    SessionHardening.init(sessionConfig);
});

// ============================================
// USAGE:
// ============================================
// SessionHardening.init({ idleTimeout: 1800000 });
// 
// SessionHardening.onTimeout(function(reason) {
//     alert('Session expired: ' + reason);
//     window.location.href = '../login.html';
// });
// 
// var status = SessionHardening.getStatus();
// console.log('Remaining:', status.remainingTime, 'ms');
// ============================================