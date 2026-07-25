// js/security/firewall.js - Web Application Firewall 2026
/**
 * E-Arsip Digital - Web Application Firewall
 * Version: 2026.1.0
 * Features: Request filtering, SQL injection prevention, XSS blocking, 
 *           path traversal prevention, rate limiting, IP reputation
 */

import { Logger } from '../logger.js';
import APP_CONFIG from '../../config/config.js';

class Firewall {
    constructor(config = APP_CONFIG.security?.firewall || {}) {
        this.logger = new Logger('Firewall');
        
        // Configuration
        this.config = {
            enabled: config.enabled !== false,
            blockSuspiciousIPs: config.blockSuspiciousIPs !== false,
            blockSQLInjection: config.blockSQLInjection !== false,
            blockXSS: config.blockXSS !== false,
            blockPathTraversal: config.blockPathTraversal !== false,
            blockUserAgents: config.blockUserAgents !== false,
            maxRequestBodySize: config.maxRequestBodySize || 10485760, // 10MB
            logLevel: config.logLevel || 'warn',
            ...config
        };
        
        // Attack signatures
        this.signatures = {
            sqlInjection: this.getSQLInjectionPatterns(),
            xss: this.getXSSPatterns(),
            pathTraversal: this.getPathTraversalPatterns(),
            commandInjection: this.getCommandInjectionPatterns(),
            fileInclusion: this.getFileInclusionPatterns(),
            ssrf: this.getSSRFPatterns()
        };
        
        // Block lists
        this.ipBlacklist = new Set();
        this.ipWhitelist = new Set();
        this.uaBlacklist = new Set();
        
        // Request tracking
        this.requestHistory = new Map();
        this.blockedRequests = [];
        this.suspiciousActivities = [];
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            sqlInjectionAttempts: 0,
            xssAttempts: 0,
            pathTraversalAttempts: 0,
            otherAttacks: 0
        };
        
        this.initialized = false;
        
        this.init();
    }
    
    init() {
        if (!this.config.enabled) {
            this.logger.info('Firewall is disabled');
            return;
        }
        
        this.loadBlacklists();
        this.setupInterceptors();
        this.initialized = true;
        
        this.logger.info('Firewall initialized', {
            rules: Object.keys(this.signatures).length,
            blockedIPs: this.ipBlacklist.size
        });
    }
    
    // ============================================
    // ATTACK SIGNATURES
    // ============================================
    
    getSQLInjectionPatterns() {
        return [
            // Classic SQL injection
            /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\s/i,
            
            // SQL comments
            /(\s|^)(--|#|\/\*)/,
            
            // SQL functions
            /(\s|^)(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT|CONCAT|SUBSTRING)\s*\(/i,
            
            // SQL operators
            /(\s|^)(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
            
            // Union-based injection
            /UNION\s+(ALL\s+)?SELECT/i,
            
            // Information schema
            /information_schema/i,
            
            // Benchmark/sleep
            /(BENCHMARK|SLEEP)\s*\(/i,
            
            // Load file
            /LOAD_FILE\s*\(/i,
            
            // Into outfile
            /INTO\s+(OUTFILE|DUMPFILE)/i,
            
            // Special characters
            /('|")\s*(\s|OR|AND)\s*('|")\s*=\s*('|")/i,
            
            // Hex encoding
            /0x[0-9a-fA-F]+/,
            
            // Stacked queries
            /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/i
        ];
    }
    
    getXSSPatterns() {
        return [
            // Script tags
            /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
            
            // Event handlers
            /\bon\w+\s*=\s*['"][^'"]*['"]/gi,
            
            // JavaScript URLs
            /javascript\s*:\s*/gi,
            
            // Data URLs with HTML
            /data\s*:\s*text\/html/gi,
            
            // VB script
            /vbscript\s*:\s*/gi,
            
            // Expression
            /expression\s*\(/gi,
            
            // Eval
            /eval\s*\(/gi,
            
            // Document write
            /document\.write\s*\(/gi,
            
            // Inner HTML
            /\.innerHTML\s*=/gi,
            
            // Style with expression
            /<style[^>]*>.*?expression\s*\(/gi,
            
            // SVG onload
            /<svg[^>]*onload\s*=/gi,
            
            // IMG onerror
            /<img[^>]*onerror\s*=/gi,
            
            // Base64 encoded payloads
            /atob\s*\(/gi,
            
            // FromCharCode
            /fromCharCode\s*\(/gi,
            
            // Template literals with injection
            /\$\{.*?\}/g
        ];
    }
    
    getPathTraversalPatterns() {
        return [
            // Directory traversal
            /\.\.\//,
            /\.\.\\/,
            
            // Null byte injection
            /%00/,
            /\x00/,
            
            // Absolute paths
            /^\/etc\//,
            /^C:\\/i,
            
            // Windows paths
            /\\windows\\/i,
            /\\system32\\/i,
            
            // Sensitive files
            /\/etc\/passwd/,
            /\/etc\/shadow/,
            /\/proc\/self/,
            /\.env$/,
            /\.git\//,
            
            // Encoded traversal
            /%2e%2e%2f/i,
            /%252e%252e%252f/i,
            /\.%2e\//i
        ];
    }
    
    getCommandInjectionPatterns() {
        return [
            // Command separators
            /[;&|`$]/,
            
            // Common commands
            /\b(cat|ls|dir|wget|curl|nc|netcat|telnet|ssh)\b/i,
            
            // Shell operators
            /\$\(/,
            /`.*`/,
            /\|\|/,
            /&&/,
            
            // Reverse shell patterns
            /\/dev\/tcp\//,
            /python.*socket/i,
            /bash\s+-i/i,
            
            // PowerShell
            /powershell/i,
            /Invoke-Expression/i,
            /IEX\s*\(/i
        ];
    }
    
    getFileInclusionPatterns() {
        return [
            // Local file inclusion
            /\.\.\/.*\.(php|asp|jsp|py|rb|pl)/i,
            
            // Remote file inclusion
            /https?:\/\/.*\.(php|asp|jsp|txt)/i,
            
            // PHP wrappers
            /php:\/\/input/i,
            /php:\/\/filter/i,
            /expect:\/\//i,
            /phar:\/\//i,
            
            // Data wrapper
            /data:\/\/text\/plain/i
        ];
    }
    
    getSSRFPatterns() {
        return [
            // Internal IPs
            /127\.0\.0\.1/,
            /localhost/i,
            /10\.\d+\.\d+\.\d+/,
            /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
            /192\.168\.\d+\.\d+/,
            
            // Cloud metadata endpoints
            /169\.254\.169\.254/,
            /metadata\.google\.internal/i,
            
            // File protocol
            /file:\/\//i,
            
            // Gopher protocol
            /gopher:\/\//i
        ];
    }
    
    // ============================================
    // REQUEST INTERCEPTION
    // ============================================
    
    setupInterceptors() {
        // Intercept fetch API
        this.interceptFetch();
        
        // Intercept XMLHttpRequest
        this.interceptXHR();
        
        // Intercept form submissions
        this.interceptForms();
        
        // Monitor DOM for script injection
        this.monitorDOM();
    }
    
    interceptFetch() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = async function(url, options = {}) {
            self.stats.totalRequests++;
            
            // Validate URL
            const urlCheck = self.validateURL(url);
            if (!urlCheck.allowed) {
                self.blockRequest('url_blocked', urlCheck.reason, { url });
                throw new Error('Request blocked by firewall');
            }
            
            // Validate headers
            if (options.headers) {
                const headerCheck = self.validateHeaders(options.headers);
                if (!headerCheck.allowed) {
                    self.blockRequest('header_blocked', headerCheck.reason, { headers: options.headers });
                    throw new Error('Request blocked by firewall');
                }
            }
            
            // Validate body
            if (options.body) {
                const bodyCheck = self.validateBody(options.body);
                if (!bodyCheck.allowed) {
                    self.blockRequest('body_blocked', bodyCheck.reason, { body: options.body });
                    throw new Error('Request blocked by firewall');
                }
            }
            
            // Check rate limit
            const rateCheck = self.checkRateLimit(url);
            if (!rateCheck.allowed) {
                self.blockRequest('rate_limit', 'Rate limit exceeded', { url });
                throw new Error('Rate limit exceeded');
            }
            
            self.stats.allowedRequests++;
            return originalFetch.call(this, url, options);
        };
    }
    
    interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const self = this;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._firewallData = { method, url };
            return originalOpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            self.stats.totalRequests++;
            
            const { url } = this._firewallData || {};
            
            // Validate URL
            const urlCheck = self.validateURL(url);
            if (!urlCheck.allowed) {
                self.blockRequest('url_blocked', urlCheck.reason, { url });
                this.abort();
                return;
            }
            
            // Validate body
            if (body) {
                const bodyCheck = self.validateBody(body);
                if (!bodyCheck.allowed) {
                    self.blockRequest('body_blocked', bodyCheck.reason, { body });
                    this.abort();
                    return;
                }
            }
            
            self.stats.allowedRequests++;
            return originalSend.call(this, body);
        };
    }
    
    interceptForms() {
        document.addEventListener('submit', (event) => {
            const form = event.target;
            const formData = new FormData(form);
            
            for (const [key, value] of formData.entries()) {
                const check = this.validateInput(value);
                
                if (!check.allowed) {
                    event.preventDefault();
                    this.blockRequest('form_input_blocked', check.reason, { field: key, value });
                    
                    window.dispatchEvent(new CustomEvent('firewall:blocked', {
                        detail: { reason: check.reason, field: key }
                    }));
                    
                    return;
                }
            }
        }, true);
    }
    
    monitorDOM() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element
                            this.scanDOMNode(node);
                        }
                    });
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    scanDOMNode(node) {
        // Check for script injection
        if (node.tagName === 'SCRIPT' && !node.hasAttribute('data-safe')) {
            this.blockRequest('dom_injection', 'Suspicious script injection', {
                tag: 'SCRIPT',
                content: node.textContent?.substring(0, 100)
            });
            node.remove();
        }
        
        // Check for event handlers
        const eventAttrs = ['onclick', 'onerror', 'onload', 'onmouseover'];
        eventAttrs.forEach(attr => {
            if (node.hasAttribute?.(attr)) {
                const value = node.getAttribute(attr);
                const check = this.validateInput(value);
                
                if (!check.allowed) {
                    node.removeAttribute(attr);
                    this.blockRequest('event_handler_blocked', check.reason, { attr, value });
                }
            }
        });
    }
    
    // ============================================
    // VALIDATION METHODS
    // ============================================
    
    validateURL(url) {
        if (!url) return { allowed: false, reason: 'Empty URL' };
        
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Check path traversal
        if (this.config.blockPathTraversal) {
            for (const pattern of this.signatures.pathTraversal) {
                if (pattern.test(urlStr)) {
                    this.stats.pathTraversalAttempts++;
                    return { allowed: false, reason: 'Path traversal detected' };
                }
            }
        }
        
        // Check SSRF
        for (const pattern of this.signatures.ssrf) {
            if (pattern.test(urlStr)) {
                this.stats.otherAttacks++;
                return { allowed: false, reason: 'SSRF attempt detected' };
            }
        }
        
        // Check for data/javascript URLs
        if (/^(data|javascript|vbscript):/i.test(urlStr)) {
            return { allowed: false, reason: 'Dangerous URL scheme' };
        }
        
        return { allowed: true };
    }
    
    validateHeaders(headers) {
        if (!headers) return { allowed: true };
        
        const headerStr = typeof headers === 'string' ? headers : JSON.stringify(headers);
        
        // Check for injection in headers
        const patterns = [
            ...this.signatures.sqlInjection,
            ...this.signatures.xss,
            ...this.signatures.pathTraversal
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(headerStr)) {
                return { allowed: false, reason: 'Malicious header detected' };
            }
        }
        
        return { allowed: true };
    }
    
    validateBody(body) {
        if (!body) return { allowed: true };
        
        let bodyStr;
        
        if (typeof body === 'string') {
            bodyStr = body;
        } else if (body instanceof FormData) {
            const entries = [];
            body.forEach((value, key) => entries.push(`${key}=${value}`));
            bodyStr = entries.join('&');
        } else if (body instanceof URLSearchParams) {
            bodyStr = body.toString();
        } else {
            bodyStr = JSON.stringify(body);
        }
        
        return this.validateInput(bodyStr);
    }
    
    validateInput(input) {
        if (!input || typeof input !== 'string') return { allowed: true };
        
        // Check body size
        if (input.length > this.config.maxRequestBodySize) {
            return { allowed: false, reason: 'Request body too large' };
        }
        
        // SQL Injection check
        if (this.config.blockSQLInjection) {
            for (const pattern of this.signatures.sqlInjection) {
                if (pattern.test(input)) {
                    this.stats.sqlInjectionAttempts++;
                    this.logger.warn('SQL injection attempt blocked', {
                        input: input.substring(0, 100)
                    });
                    return { allowed: false, reason: 'SQL injection detected' };
                }
            }
        }
        
        // XSS check
        if (this.config.blockXSS) {
            for (const pattern of this.signatures.xss) {
                if (pattern.test(input)) {
                    this.stats.xssAttempts++;
                    this.logger.warn('XSS attempt blocked', {
                        input: input.substring(0, 100)
                    });
                    return { allowed: false, reason: 'XSS attack detected' };
                }
            }
        }
        
        // Command injection check
        for (const pattern of this.signatures.commandInjection) {
            if (pattern.test(input)) {
                this.stats.otherAttacks++;
                this.logger.warn('Command injection attempt blocked');
                return { allowed: false, reason: 'Command injection detected' };
            }
        }
        
        // File inclusion check
        for (const pattern of this.signatures.fileInclusion) {
            if (pattern.test(input)) {
                this.stats.otherAttacks++;
                this.logger.warn('File inclusion attempt blocked');
                return { allowed: false, reason: 'File inclusion detected' };
            }
        }
        
        return { allowed: true };
    }
    
    // ============================================
    // RATE LIMITING
    // ============================================
    
    checkRateLimit(url) {
        const key = this.getRequestKey(url);
        const now = Date.now();
        const windowMs = 60000; // 1 minute
        const maxRequests = 100;
        
        if (!this.requestHistory.has(key)) {
            this.requestHistory.set(key, []);
        }
        
        const requests = this.requestHistory.get(key);
        
        // Remove old entries
        const recent = requests.filter(time => now - time < windowMs);
        this.requestHistory.set(key, recent);
        
        if (recent.length >= maxRequests) {
            return { allowed: false, reason: 'Rate limit exceeded' };
        }
        
        recent.push(now);
        return { allowed: true };
    }
    
    getRequestKey(url) {
        // Simple key based on URL path
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.pathname;
        } catch {
            return url;
        }
    }
    
    // ============================================
    // IP BLACKLISTING
    // ============================================
    
    loadBlacklists() {
        // Load from storage
        try {
            const ipList = localStorage.getItem('firewall_ip_blacklist');
            if (ipList) {
                JSON.parse(ipList).forEach(ip => this.ipBlacklist.add(ip));
            }
            
            const uaList = localStorage.getItem('firewall_ua_blacklist');
            if (uaList) {
                JSON.parse(uaList).forEach(ua => this.uaBlacklist.add(ua));
            }
        } catch (error) {
            this.logger.warn('Failed to load blacklists', error);
        }
        
        // Add known malicious user agents
        const maliciousUAs = [
            'sqlmap',
            'nmap',
            'nikto',
            'acunetix',
            'burpsuite',
            'nessus',
            'openvas'
        ];
        
        maliciousUAs.forEach(ua => this.uaBlacklist.add(ua));
    }
    
    blockIP(ip, reason = 'Manual block') {
        this.ipBlacklist.add(ip);
        this.saveBlacklists();
        
        this.logger.warn('IP blocked', { ip, reason });
    }
    
    unblockIP(ip) {
        this.ipBlacklist.delete(ip);
        this.saveBlacklists();
        
        this.logger.info('IP unblocked', { ip });
    }
    
    isIPBlocked(ip) {
        return this.ipBlacklist.has(ip);
    }
    
    saveBlacklists() {
        try {
            localStorage.setItem('firewall_ip_blacklist', 
                JSON.stringify([...this.ipBlacklist]));
            localStorage.setItem('firewall_ua_blacklist', 
                JSON.stringify([...this.uaBlacklist]));
        } catch (error) {
            this.logger.warn('Failed to save blacklists', error);
        }
    }
    
    // ============================================
    // REQUEST BLOCKING
    // ============================================
    
    blockRequest(type, reason, details = {}) {
        this.stats.blockedRequests++;
        
        const blockEntry = {
            type,
            reason,
            details,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        this.blockedRequests.push(blockEntry);
        
        // Keep only last 100 blocked requests
        if (this.blockedRequests.length > 100) {
            this.blockedRequests = this.blockedRequests.slice(-100);
        }
        
        // Log the block
        this.logger.warn(`Request blocked: ${type}`, { reason, ...details });
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('firewall:blocked', {
            detail: blockEntry
        }));
        
        // Track suspicious activity
        this.suspiciousActivities.push({
            ...blockEntry,
            userAgent: navigator.userAgent,
            timestamp: Date.now()
        });
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    isEnabled() {
        return this.config.enabled && this.initialized;
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    getBlockedRequests() {
        return [...this.blockedRequests];
    }
    
    getSuspiciousActivities() {
        return [...this.suspiciousActivities];
    }
    
    getBlacklistedIPs() {
        return [...this.ipBlacklist];
    }
    
    isURLAllowed(url) {
        return this.validateURL(url).allowed;
    }
    
    isInputValid(input) {
        return this.validateInput(input).allowed;
    }
    
    addCustomSignature(type, pattern) {
        if (this.signatures[type]) {
            this.signatures[type].push(pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i'));
            this.logger.info('Custom signature added', { type });
        }
    }
    
    reset() {
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            sqlInjectionAttempts: 0,
            xssAttempts: 0,
            pathTraversalAttempts: 0,
            otherAttacks: 0
        };
        this.blockedRequests = [];
        this.suspiciousActivities = [];
        this.requestHistory.clear();
        this.logger.info('Firewall stats reset');
    }
    
    destroy() {
        // Restore original functions would require more complex setup
        this.config.enabled = false;
        this.initialized = false;
        this.logger.info('Firewall destroyed');
    }
}

// Create singleton
const firewall = new Firewall();

export default firewall;
export { Firewall };