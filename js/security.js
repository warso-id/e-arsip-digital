// FILE: js/security.js
// ============================================
// SECURITY MODULE - E-ARSIP DIGITAL
// ============================================

<<<<<<< HEAD
import { resolveAppPath } from './path-utils.js';

=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
class SecurityManager {
    constructor() {
        this.securityConfig = {
            maxLoginAttempts: 5,
            lockoutDuration: 30 * 60 * 1000, // 30 menit
            sessionTimeout: 30 * 60 * 1000, // 30 menit
            passwordMinLength: 8,
            passwordRequireUppercase: true,
            passwordRequireLowercase: true,
            passwordRequireNumbers: true,
            passwordRequireSpecial: true,
            passwordExpiryDays: 90,
            passwordHistoryCount: 5,
            twoFactorEnabled: false,
            ipWhitelist: [],
            ipBlacklist: [],
            maxFileUploadSize: 10 * 1024 * 1024, // 10MB
            allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
            rateLimitRequests: 100,
            rateLimitWindow: 60 * 1000 // 1 menit
        };
        
        this.loginAttempts = new Map();
        this.rateLimitMap = new Map();
        this.sessionTokens = new Map();
        
        this.init();
    }
    
    /**
     * Initialize security
     */
    init() {
        this.loadSecurityConfig();
        this.setupSecurityHeaders();
        this.startSessionMonitor();
        this.preventContextMenu();
        this.preventDevTools();
    }
    
    /**
     * Load security configuration
     */
    loadSecurityConfig() {
        const savedConfig = localStorage.getItem('securityConfig');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                this.securityConfig = { ...this.securityConfig, ...parsed };
            } catch (e) {
                console.error('Error loading security config:', e);
            }
        }
    }
    
    /**
     * Setup security headers
     */
    setupSecurityHeaders() {
        // Note: Headers harus disetup di server side
        // Ini hanya untuk client-side checks
        if (document.location.protocol !== 'https:' && 
            window.location.hostname !== 'localhost') {
            console.warn('Aplikasi tidak berjalan di HTTPS. Disarankan menggunakan HTTPS untuk production.');
        }
    }
    
    /**
     * Start session monitor
     */
    startSessionMonitor() {
        setInterval(() => {
            this.checkSessionValidity();
        }, 60000); // Check every minute
        
        // Track user activity
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastActivity();
            });
        });
    }
    
    /**
     * Check session validity
     */
    checkSessionValidity() {
        const sessionData = this.getSessionData();
        if (!sessionData) return;
        
        const now = Date.now();
        const lastActivity = sessionData.lastActivity || 0;
        const sessionStart = sessionData.sessionStart || 0;
        
        // Check session timeout
        if (now - lastActivity > this.securityConfig.sessionTimeout) {
            this.terminateSession('Sesi telah berakhir karena tidak aktif');
            return;
        }
        
        // Check absolute session limit (8 jam)
        if (now - sessionStart > 8 * 60 * 60 * 1000) {
            this.terminateSession('Sesi telah berakhir (batas maksimum)');
            return;
        }
    }
    
    /**
     * Update last activity
     */
    updateLastActivity() {
        const sessionData = this.getSessionData();
        if (sessionData) {
            sessionData.lastActivity = Date.now();
            this.setSessionData(sessionData);
        }
    }
    
    /**
     * Get session data
     */
    getSessionData() {
        const data = sessionStorage.getItem('sessionData');
        return data ? JSON.parse(data) : null;
    }
    
    /**
     * Set session data
     */
    setSessionData(data) {
        sessionStorage.setItem('sessionData', JSON.stringify(data));
    }
    
    /**
     * Create new session
     */
    createSession(userData) {
        const sessionToken = this.generateToken(64);
        const sessionData = {
            token: sessionToken,
            userId: userData.id,
            username: userData.username,
            role: userData.role,
            sessionStart: Date.now(),
            lastActivity: Date.now(),
            ipAddress: 'client-ip', // Akan diisi oleh server
            userAgent: navigator.userAgent,
            browserFingerprint: this.generateBrowserFingerprint()
        };
        
        this.setSessionData(sessionData);
        this.sessionTokens.set(sessionToken, sessionData);
        
        return sessionToken;
    }
    
    /**
     * Terminate session
     */
    terminateSession(reason = 'User logout') {
        const sessionData = this.getSessionData();
        if (sessionData) {
            // Log session termination
            this.logSecurityEvent('session_terminated', {
                userId: sessionData.userId,
                reason: reason,
                sessionDuration: Date.now() - sessionData.sessionStart
            });
            
            // Remove session token
            this.sessionTokens.delete(sessionData.token);
        }
        
        // Clear session storage
        sessionStorage.clear();
        localStorage.removeItem('currentUser');
        
        // Redirect to login
<<<<<<< HEAD
        window.location.href = resolveAppPath('/login.html?reason=' + encodeURIComponent(reason));
=======
        window.location.href = '/login.html?reason=' + encodeURIComponent(reason);
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
    }
    
    /**
     * Validate login attempt
     */
    validateLoginAttempt(username) {
        const attempts = this.loginAttempts.get(username) || {
            count: 0,
            lastAttempt: 0,
            locked: false,
            lockedUntil: 0
        };
        
        const now = Date.now();
        
        // Check if locked
        if (attempts.locked && now < attempts.lockedUntil) {
            const remainingMinutes = Math.ceil((attempts.lockedUntil - now) / 60000);
            return {
                allowed: false,
                message: `Akun terkunci. Silakan coba lagi dalam ${remainingMinutes} menit.`,
                remainingTime: attempts.lockedUntil - now
            };
        }
        
        // Reset if lockout period has passed
        if (attempts.locked && now >= attempts.lockedUntil) {
            attempts.count = 0;
            attempts.locked = false;
            attempts.lockedUntil = 0;
        }
        
        return { allowed: true };
    }
    
    /**
     * Record login attempt
     */
    recordLoginAttempt(username, success) {
        let attempts = this.loginAttempts.get(username) || {
            count: 0,
            lastAttempt: 0,
            locked: false,
            lockedUntil: 0
        };
        
        attempts.lastAttempt = Date.now();
        
        if (success) {
            // Reset on successful login
            attempts.count = 0;
            attempts.locked = false;
            attempts.lockedUntil = 0;
        } else {
            attempts.count++;
            
            // Lock account after max attempts
            if (attempts.count >= this.securityConfig.maxLoginAttempts) {
                attempts.locked = true;
                attempts.lockedUntil = Date.now() + this.securityConfig.lockoutDuration;
                
                this.logSecurityEvent('account_locked', {
                    username: username,
                    attempts: attempts.count,
                    lockedUntil: new Date(attempts.lockedUntil).toISOString()
                });
            }
        }
        
        this.loginAttempts.set(username, attempts);
    }
    
    /**
     * Validate password strength
     */
    validatePasswordStrength(password) {
        const errors = [];
        const config = this.securityConfig;
        
        if (password.length < config.passwordMinLength) {
            errors.push(`Password minimal ${config.passwordMinLength} karakter`);
        }
        
        if (config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password harus mengandung huruf besar');
        }
        
        if (config.passwordRequireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password harus mengandung huruf kecil');
        }
        
        if (config.passwordRequireNumbers && !/[0-9]/.test(password)) {
            errors.push('Password harus mengandung angka');
        }
        
        if (config.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password harus mengandung karakter khusus (!@#$%^&*)');
        }
        
        // Check common passwords
        const commonPasswords = ['password', '12345678', 'qwerty', 'admin123', 'password123'];
        if (commonPasswords.includes(password.toLowerCase())) {
            errors.push('Password terlalu umum, silakan pilih password yang lebih kuat');
        }
        
        // Check for repeated characters
        if (/(.)\1{2,}/.test(password)) {
            errors.push('Password tidak boleh mengandung karakter berulang (3x atau lebih)');
        }
        
        // Calculate password strength
        let strength = 0;
        if (password.length >= 12) strength += 25;
        else if (password.length >= 8) strength += 15;
        
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        if (password.length >= 16) strength += 10;
        
        return {
            valid: errors.length === 0,
            errors: errors,
            strength: Math.min(strength, 100),
            strengthLabel: this.getStrengthLabel(strength)
        };
    }
    
    /**
     * Get password strength label
     */
    getStrengthLabel(strength) {
        if (strength >= 80) return { label: 'Sangat Kuat', color: 'success' };
        if (strength >= 60) return { label: 'Kuat', color: 'primary' };
        if (strength >= 40) return { label: 'Sedang', color: 'warning' };
        return { label: 'Lemah', color: 'danger' };
    }
    
    /**
     * Rate limiting
     */
    checkRateLimit(action, userId) {
        const key = `${action}_${userId}`;
        const now = Date.now();
        let record = this.rateLimitMap.get(key) || {
            count: 0,
            windowStart: now
        };
        
        // Reset window if expired
        if (now - record.windowStart > this.securityConfig.rateLimitWindow) {
            record.count = 0;
            record.windowStart = now;
        }
        
        record.count++;
        this.rateLimitMap.set(key, record);
        
        if (record.count > this.securityConfig.rateLimitRequests) {
            return {
                allowed: false,
                message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                retryAfter: this.securityConfig.rateLimitWindow - (now - record.windowStart)
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Generate secure token
     */
    generateToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Generate browser fingerprint
     */
    generateBrowserFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            !!window.sessionStorage,
            !!window.localStorage
        ];
        
        return this.hashString(components.join('###'));
    }
    
    /**
     * Simple hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * Validate file upload
     */
    validateFileUpload(file) {
        const errors = [];
        
        // Check file size
        if (file.size > this.securityConfig.maxFileUploadSize) {
            const maxSizeMB = this.securityConfig.maxFileUploadSize / (1024 * 1024);
            errors.push(`Ukuran file maksimal ${maxSizeMB}MB`);
        }
        
        // Check file type
        const extension = file.name.split('.').pop().toLowerCase();
        if (!this.securityConfig.allowedFileTypes.includes(extension)) {
            errors.push(`Tipe file tidak diizinkan. Format yang didukung: ${this.securityConfig.allowedFileTypes.join(', ')}`);
        }
        
        // Check for double extensions
        const doubleExt = file.name.match(/\.[a-z0-9]+\.[a-z0-9]+$/i);
        if (doubleExt) {
            errors.push('File dengan ekstensi ganda tidak diizinkan');
        }
        
        // Check MIME type
        const allowedMimes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png'
        };
        
        if (allowedMimes[extension] && file.type !== allowedMimes[extension]) {
            errors.push('Tipe file tidak valid');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Sanitize input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        // Remove HTML tags
        input = input.replace(/<[^>]*>/g, '');
        
        // Remove script tags and content
        input = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove event handlers
        input = input.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
        input = input.replace(/on\w+\s*=\s*'[^']*'/gi, '');
        
        // Remove javascript: URLs
        input = input.replace(/javascript\s*:/gi, '');
        
        // Trim
        input = input.trim();
        
        return input;
    }
    
    /**
     * Validate input against XSS
     */
    validateAgainstXSS(input) {
        const patterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<embed/i,
            /<object/i,
            /<applet/i,
            /<link/i,
            /<meta/i,
            /data:text\/html/i,
            /base64/i,
            /eval\s*\(/i,
            /expression\s*\(/i,
            /document\.cookie/i,
            /document\.write/i,
            /window\.location/i
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(input)) {
                return {
                    valid: false,
                    message: 'Input mengandung kode berbahaya'
                };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Prevent right-click context menu
     */
    preventContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            // Allow context menu in input fields
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Uncomment to disable:
            // e.preventDefault();
        });
    }
    
    /**
     * Prevent DevTools (basic)
     */
    preventDevTools() {
        // Detect DevTools
        const threshold = 160;
        
        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                console.clear();
                console.log('%cPeringatan!', 'color: red; font-size: 30px; font-weight: bold;');
                console.log('%cJangan menempelkan kode apapun di sini.', 'font-size: 16px;');
                console.log('%cIni bisa membahayakan akun Anda.', 'font-size: 16px; color: orange;');
            }
        }, 1000);
    }
    
    /**
     * Encrypt sensitive data
     */
    encryptData(data, key) {
        try {
            const jsonStr = JSON.stringify(data);
            // Simple XOR encryption (for demo - use proper encryption in production)
            let encrypted = '';
            for (let i = 0; i < jsonStr.length; i++) {
                encrypted += String.fromCharCode(
                    jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return btoa(encrypted);
        } catch (e) {
            console.error('Encryption error:', e);
            return null;
        }
    }
    
    /**
     * Decrypt data
     */
    decryptData(encryptedData, key) {
        try {
            const decoded = atob(encryptedData);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(
                    decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return JSON.parse(decrypted);
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    }
    
    /**
     * Log security event
     */
    async logSecurityEvent(eventType, data) {
        const event = {
            type: eventType,
            data: data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Log to console
        console.log(`[SECURITY] ${eventType}:`, data);
        
        // Send to server
        try {
            if (typeof api !== 'undefined') {
                await api.sendRequest({
                    action: 'logSecurityEvent',
                    event: event
                });
            }
        } catch (e) {
            console.error('Failed to log security event:', e);
        }
        
        // Store locally
        const securityLog = JSON.parse(localStorage.getItem('securityLog') || '[]');
        securityLog.push(event);
        if (securityLog.length > 100) securityLog.shift(); // Keep last 100
        localStorage.setItem('securityLog', JSON.stringify(securityLog));
    }
    
    /**
     * Check if IP is whitelisted
     */
    isIPWhitelisted(ip) {
        if (this.securityConfig.ipWhitelist.length === 0) return true;
        return this.securityConfig.ipWhitelist.includes(ip);
    }
    
    /**
     * Check if IP is blacklisted
     */
    isIPBlacklisted(ip) {
        return this.securityConfig.ipBlacklist.includes(ip);
    }
    
    /**
     * Get security report
     */
    getSecurityReport() {
        return {
            loginAttempts: Object.fromEntries(this.loginAttempts),
            activeSessions: this.sessionTokens.size,
            rateLimitViolations: Array.from(this.rateLimitMap.entries())
                .filter(([, record]) => record.count > this.securityConfig.rateLimitRequests)
                .length,
            lastEvents: JSON.parse(localStorage.getItem('securityLog') || '[]').slice(-10)
        };
    }
    
    /**
     * Clear sensitive data
     */
    clearSensitiveData() {
        this.loginAttempts.clear();
        this.rateLimitMap.clear();
        localStorage.removeItem('securityLog');
    }
}

// Create global instance
const securityManager = new SecurityManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
}