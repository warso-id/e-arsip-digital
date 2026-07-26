// js/security/firewall.js - Web Application Firewall 2026 (SECURE)
/**
 * E-Arsip Digital - Web Application Firewall
 * Version: 2026.1.0
 * 
 * Features:
 * - Input validation (SQLi, XSS, path traversal)
 * - Rate limiting
 * - Non-invasive (tidak override global APIs)
 * - PWA mobile compatible
 * - No external dependencies
 */

var Firewall = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: true,
        blockSQLInjection: true,
        blockXSS: true,
        blockPathTraversal: true,
        blockCommandInjection: true,
        maxInputLength: 500000,    // 500KB per input
        rateLimitWindow: 60000,    // 1 menit
        rateLimitMax: 100          // Maks 100 request per window
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _stats = {
        totalValidations: 0,
        blocked: 0,
        sqlInjection: 0,
        xss: 0,
        pathTraversal: 0,
        commandInjection: 0
    };
    
    var _blockedRequests = [];
    var _requestHistory = {};
    var _customPatterns = {};
    
    // ============================================
    // ATTACK SIGNATURES (TUNED - Less False Positive)
    // ============================================
    
    /**
     * SQL Injection patterns
     * Hanya mendeteksi pola yang SANGAT mencurigakan
     */
    var SQLI_PATTERNS = [
        // Union-based injection
        /\bUNION\s+(ALL\s+)?SELECT\b/i,
        
        // Stacked queries
        /;\s*(DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\s/i,
        
        // Comment-based injection
        /\bOR\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?\s*(--|#|\/\*)/i,
        
        // Information schema access
        /\binformation_schema\b/i,
        
        // Dangerous functions
        /\b(LOAD_FILE|INTO\s+(OUTFILE|DUMPFILE)|BENCHMARK\s*\(|SLEEP\s*\()/i,
        
        // Hex-encoded payloads (long hex strings)
        /0x[0-9a-fA-F]{20,}/,
        
        // Multiple special chars (indikasi encoding)
        /(%27|%22|%23|%3B|%2D%2D|%2F\*|\*%2F){3,}/i
    ];
    
    /**
     * XSS patterns
     * Fokus pada script injection yang jelas
     */
    var XSS_PATTERNS = [
        // Script tags
        /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
        
        // Event handlers dengan javascript
        /\bon\w+\s*=\s*(javascript\s*:|['"]\s*javascript\s*:)/gi,
        
        // JavaScript protocol
        /^\s*javascript\s*:/gi,
        
        // Dangerous DOM manipulation
        /document\.(write|writeln)\s*\(/gi,
        /\.innerHTML\s*=\s*['"][^'"]*<[^>]+>/gi,
        
        // Eval/injection
        /eval\s*\(\s*(atob|String\.fromCharCode|unescape)\s*\(/gi,
        
        // SVG/IMG onload dengan payload
        /<(svg|img|body|iframe|object|embed)\b[^>]*\bon(load|error|focus)\s*=\s*[^>]+>/gi,
        
        // Base64 encoded script
        /data\s*:\s*text\/html\s*;base64/gi
    ];
    
    /**
     * Path traversal patterns
     */
    var PATH_TRAVERSAL_PATTERNS = [
        // Directory traversal
        /\.\.\/\.\.\//,                    // Minimal 2 level
        /\.\.\\\.\.\\/,
        
        // Encoded traversal
        /%2e%2e[%\/\\]%2e%2e/i,
        /%252e%252e/i,                     // Double encoded
        
        // System files
        /\/etc\/(passwd|shadow|hosts)\b/i,
        /C:\\Windows\\/i,
        /\/proc\/self\//i,
        
        // Null byte
        /\x00/
    ];
    
    /**
     * Command injection patterns
     */
    var COMMAND_INJECTION_PATTERNS = [
        // Pipe/redirect dengan command
        /\|\s*(cat|ls|id|whoami|uname|wget|curl|nc|bash|sh|python|perl|ruby)\b/i,
        
        // Subshell
        /\$\([^)]*(cat|ls|id|wget|curl)[^)]*\)/i,
        
        // Backtick command
        /`[^`]*(cat|ls|id|wget|curl)[^`]*`/i,
        
        // Reverse shell indicators
        /\/dev\/tcp\//i,
        /python\s+-c\s+['"]import\s+(socket|os|subprocess)/i
    ];
    
    // ============================================
    // VALIDATION FUNCTIONS
    // ============================================
    
    /**
     * Validasi input terhadap semua patterns
     * @param {string} input - Input yang akan divalidasi
     * @returns {Object} { allowed, reason, type }
     */
    function validateInput(input) {
        if (!input || typeof input !== 'string') {
            return { allowed: true };
        }
        
        _stats.totalValidations++;
        
        // Cek panjang maksimum
        if (input.length > config.maxInputLength) {
            _stats.blocked++;
            return { allowed: false, reason: 'Input terlalu panjang', type: 'length' };
        }
        
        // SQL Injection
        if (config.blockSQLInjection) {
            for (var i = 0; i < SQLI_PATTERNS.length; i++) {
                if (SQLI_PATTERNS[i].test(input)) {
                    _stats.blocked++;
                    _stats.sqlInjection++;
                    logBlock('SQL Injection', input.substring(0, 100));
                    return { allowed: false, reason: 'SQL Injection terdeteksi', type: 'sqli' };
                }
            }
            // Custom SQLi patterns
            if (_customPatterns.sqli) {
                for (var j = 0; j < _customPatterns.sqli.length; j++) {
                    if (_customPatterns.sqli[j].test(input)) {
                        _stats.blocked++;
                        _stats.sqlInjection++;
                        return { allowed: false, reason: 'SQL Injection (custom)', type: 'sqli' };
                    }
                }
            }
        }
        
        // XSS
        if (config.blockXSS) {
            for (var k = 0; k < XSS_PATTERNS.length; k++) {
                if (XSS_PATTERNS[k].test(input)) {
                    _stats.blocked++;
                    _stats.xss++;
                    logBlock('XSS', input.substring(0, 100));
                    return { allowed: false, reason: 'XSS terdeteksi', type: 'xss' };
                }
            }
            // Custom XSS patterns
            if (_customPatterns.xss) {
                for (var l = 0; l < _customPatterns.xss.length; l++) {
                    if (_customPatterns.xss[l].test(input)) {
                        _stats.blocked++;
                        _stats.xss++;
                        return { allowed: false, reason: 'XSS (custom)', type: 'xss' };
                    }
                }
            }
        }
        
        // Path Traversal
        if (config.blockPathTraversal) {
            for (var m = 0; m < PATH_TRAVERSAL_PATTERNS.length; m++) {
                if (PATH_TRAVERSAL_PATTERNS[m].test(input)) {
                    _stats.blocked++;
                    _stats.pathTraversal++;
                    return { allowed: false, reason: 'Path traversal terdeteksi', type: 'path_traversal' };
                }
            }
        }
        
        // Command Injection
        if (config.blockCommandInjection) {
            for (var n = 0; n < COMMAND_INJECTION_PATTERNS.length; n++) {
                if (COMMAND_INJECTION_PATTERNS[n].test(input)) {
                    _stats.blocked++;
                    _stats.commandInjection++;
                    return { allowed: false, reason: 'Command injection terdeteksi', type: 'cmd_injection' };
                }
            }
        }
        
        return { allowed: true };
    }
    
    /**
     * Validasi URL
     */
    function validateURL(url) {
        if (!url) return { allowed: true };
        
        var urlStr = typeof url === 'string' ? url : String(url);
        
        // Block dangerous URL schemes
        if (/^(javascript|data|vbscript|file):/i.test(urlStr)) {
            _stats.blocked++;
            return { allowed: false, reason: 'Skema URL berbahaya' };
        }
        
        // Validate path traversal di URL
        return validateInput(urlStr);
    }
    
    /**
     * Validasi FormData
     */
    function validateFormData(formData) {
        if (!formData || typeof formData.entries !== 'function') {
            return { allowed: true };
        }
        
        var result = { allowed: true };
        
        try {
            var entries = formData.entries();
            var entry = entries.next();
            
            while (!entry.done) {
                var key = entry.value[0];
                var value = entry.value[1];
                
                // Validasi key
                var keyCheck = validateInput(key);
                if (!keyCheck.allowed) {
                    return { allowed: false, reason: 'Field name: ' + keyCheck.reason, type: keyCheck.type };
                }
                
                // Validasi value (hanya string)
                if (typeof value === 'string') {
                    var valueCheck = validateInput(value);
                    if (!valueCheck.allowed) {
                        return { allowed: false, reason: 'Field "' + key + '": ' + valueCheck.reason, type: valueCheck.type };
                    }
                }
                
                entry = entries.next();
            }
        } catch(e) {
            // Browser tidak support entries(), iterasi manual
            // Fallback: skip validation untuk browser lama
        }
        
        return result;
    }
    
    /**
     * Validasi object (request body JSON)
     */
    function validateObject(obj, depth) {
        if (!obj || typeof obj !== 'object') return { allowed: true };
        if (!depth) depth = 0;
        if (depth > 5) return { allowed: true }; // Max recursion
        
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = obj[key];
            
            // Validasi key
            var keyCheck = validateInput(key);
            if (!keyCheck.allowed) {
                return keyCheck;
            }
            
            // Validasi value
            if (typeof value === 'string') {
                var valueCheck = validateInput(value);
                if (!valueCheck.allowed) {
                    return valueCheck;
                }
            } else if (typeof value === 'object' && value !== null) {
                var nestedCheck = validateObject(value, depth + 1);
                if (!nestedCheck.allowed) {
                    return nestedCheck;
                }
            }
        }
        
        return { allowed: true };
    }
    
    // ============================================
    // RATE LIMITING
    // ============================================
    
    /**
     * Check rate limit untuk endpoint
     */
    function checkRateLimit(endpoint) {
        if (!endpoint) endpoint = 'global';
        
        var now = Date.now();
        
        if (!_requestHistory[endpoint]) {
            _requestHistory[endpoint] = [];
        }
        
        var requests = _requestHistory[endpoint];
        
        // Hapus request lama
        _requestHistory[endpoint] = requests.filter(function(time) {
            return now - time < config.rateLimitWindow;
        });
        
        // Cek limit
        if (_requestHistory[endpoint].length >= config.rateLimitMax) {
            return { allowed: false, reason: 'Rate limit exceeded' };
        }
        
        // Tambahkan request
        _requestHistory[endpoint].push(now);
        
        return { allowed: true };
    }
    
    // ============================================
    // LOGGING
    // ============================================
    
    function logBlock(type, input) {
        var entry = {
            type: type,
            input: input ? input.substring(0, 200) : '', // Truncate
            timestamp: new Date().toISOString()
        };
        
        _blockedRequests.push(entry);
        
        // Max 50 blocked requests
        if (_blockedRequests.length > 50) {
            _blockedRequests = _blockedRequests.slice(-50);
        }
        
        // Console warning
        console.warn('[Firewall] Blocked ' + type + ': ' + (input ? input.substring(0, 50) + '...' : ''));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Validate input string
         */
        validateInput: validateInput,
        
        /**
         * Validate URL
         */
        validateURL: validateURL,
        
        /**
         * Validate FormData
         */
        validateFormData: validateFormData,
        
        /**
         * Validate object (JSON body)
         */
        validateObject: validateObject,
        
        /**
         * Check rate limit
         */
        checkRateLimit: checkRateLimit,
        
        /**
         * Add custom pattern
         * @param {string} type - 'sqli', 'xss'
         * @param {RegExp|string} pattern
         */
        addPattern: function(type, pattern) {
            if (!_customPatterns[type]) {
                _customPatterns[type] = [];
            }
            
            if (typeof pattern === 'string') {
                pattern = new RegExp(pattern, 'i');
            }
            
            _customPatterns[type].push(pattern);
        },
        
        /**
         * Get statistics
         */
        getStats: function() {
            return {
                totalValidations: _stats.totalValidations,
                blocked: _stats.blocked,
                sqlInjection: _stats.sqlInjection,
                xss: _stats.xss,
                pathTraversal: _stats.pathTraversal,
                commandInjection: _stats.commandInjection
            };
        },
        
        /**
         * Get blocked requests log
         */
        getBlockedRequests: function() {
            return _blockedRequests.slice();
        },
        
        /**
         * Reset statistics
         */
        reset: function() {
            _stats = {
                totalValidations: 0, blocked: 0,
                sqlInjection: 0, xss: 0,
                pathTraversal: 0, commandInjection: 0
            };
            _blockedRequests = [];
            _requestHistory = {};
        },
        
        /**
         * Update configuration
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
         * Check if firewall is enabled
         */
        isEnabled: function() {
            return config.enabled;
        },
        
        /**
         * Enable firewall
         */
        enable: function() {
            config.enabled = true;
        },
        
        /**
         * Disable firewall
         */
        disable: function() {
            config.enabled = false;
        },
        
        // Export patterns untuk testing
        _patterns: {
            SQLI_PATTERNS: SQLI_PATTERNS,
            XSS_PATTERNS: XSS_PATTERNS,
            PATH_TRAVERSAL_PATTERNS: PATH_TRAVERSAL_PATTERNS,
            COMMAND_INJECTION_PATTERNS: COMMAND_INJECTION_PATTERNS
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Validasi input
// var result = Firewall.validateInput(userInput);
// if (!result.allowed) {
//     console.error('Input blocked:', result.reason);
// }
// 
// // Validasi FormData
// var formCheck = Firewall.validateFormData(new FormData(form));
// 
// // Rate limit
// var rateCheck = Firewall.checkRateLimit('/api/login');
// ============================================