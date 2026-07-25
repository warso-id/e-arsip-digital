// config/security-config.js - Security Configuration 2026
/**
 * E-Arsip Digital - Security Configuration
 * Version: 2026.1.0
 * Safe for GitHub upload (no secrets)
 */

const SECURITY_CONFIG = {
    // ============================================
    // ENCRYPTION
    // ============================================
    encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'PBKDF2',
        iterations: 200000,
        keyLength: 256,
        saltLength: 128,
        ivLength: 12,
        tagLength: 128
    },
    
    // ============================================
    // CSRF PROTECTION
    // ============================================
    csrf: {
        enabled: true,
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
        formFieldName: '_csrf_token',
        tokenLength: 32,
        tokenExpiry: 3600000,
        renewOnUse: true,
        validateOrigin: true,
        allowedOrigins: []
    },
    
    // ============================================
    // XSS PREVENTION
    // ============================================
    xss: {
        sanitizeInput: true,
        sanitizeOutput: true,
        allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        allowedAttributes: ['href', 'title', 'target', 'class', 'id'],
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        stripComments: true,
        removeEmptyTags: true
    },
    
    // ============================================
    // RATE LIMITING
    // ============================================
    rateLimit: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 100,
        burstMultiplier: 1.5
    },
    
    // ============================================
    // FIREWALL
    // ============================================
    firewall: {
        enabled: true,
        blockSuspiciousIPs: true,
        blockSQLInjection: true,
        blockXSS: true,
        blockPathTraversal: true,
        maxRequestBodySize: 10485760
    },
    
    // ============================================
    // SESSION
    // ============================================
    session: {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxConcurrentSessions: 3,
        idleTimeout: 1800000,
        absoluteTimeout: 28800000
    },
    
    // ============================================
    // HEADERS
    // ============================================
    headers: {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://script.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    },
    
    // ============================================
    // PASSWORD POLICY
    // ============================================
    password: {
        minLength: 8,
        requireUppercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        maxAge: 90,
        historySize: 5
    },
    
    // ============================================
    // AUDIT
    // ============================================
    audit: {
        enabled: true,
        logLevel: 'info',
        maxLogs: 1000,
        flushInterval: 30000,
        batchSize: 10
    }
};

export default SECURITY_CONFIG;