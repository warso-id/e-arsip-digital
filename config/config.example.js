// config/config.example.js - Template konfigurasi yang aman untuk GitHub
/**
 * E-Arsip Digital - Configuration Template
 * Version: 2026.1.0
 * Safe for GitHub upload
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to config.js
 * 2. Fill in your actual values
 * 3. NEVER commit config.js to GitHub
 */

const APP_CONFIG = {
    // Application Info
    app: {
        name: 'E-Arsip Digital',
        version: '2026.1.0',
        environment: 'development', // development | staging | production
        debug: false,
        baseUrl: 'http://localhost:8080',
        apiUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
        timezone: 'Asia/Jakarta',
        language: 'id',
        fallbackLanguage: 'en'
    },

    // Google Sheets Configuration
    googleSheets: {
        scriptUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
        apiKey: 'YOUR_API_KEY',
        spreadsheetId: 'YOUR_SPREADSHEET_ID',
        sheets: {
            users: 'Users',
            suratMasuk: 'SuratMasuk',
            suratKeluar: 'SuratKeluar',
            disposisi: 'Disposisi',
            approvals: 'Approvals',
            logs: 'ActivityLogs',
            settings: 'Settings',
            penomoran: 'Penomoran',
            tandaTangan: 'TandaTangan',
            backup: 'Backups'
        },
        cacheTimeout: 300000, // 5 minutes in ms
        retryAttempts: 3,
        retryDelay: 1000
    },

    // Authentication Configuration
    auth: {
        sessionTimeout: 3600000, // 1 hour in ms
        refreshTokenTimeout: 86400000, // 24 hours
        maxLoginAttempts: 5,
        lockoutDuration: 900000, // 15 minutes
        passwordMinLength: 8,
        passwordRequireSpecialChar: true,
        passwordRequireNumber: true,
        passwordRequireUppercase: true,
        mfaEnabled: false,
        mfaMethod: 'totp', // totp | sms | email
        jwt: {
            secret: 'YOUR_JWT_SECRET_CHANGE_THIS',
            expiresIn: '1h',
            algorithm: 'HS512'
        }
    },

    // Security Configuration
    security: {
        encryption: {
            algorithm: 'AES-256-GCM',
            keyDerivation: 'PBKDF2',
            iterations: 200000,
            keyLength: 256,
            saltLength: 128
        },
        csrf: {
            enabled: true,
            cookieName: 'XSRF-TOKEN',
            headerName: 'X-XSRF-TOKEN',
            tokenLength: 32
        },
        xss: {
            sanitizeInput: true,
            sanitizeOutput: true,
            allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
            allowedAttributes: ['href', 'title', 'target']
        },
        rateLimit: {
            enabled: true,
            windowMs: 60000, // 1 minute
            maxRequests: 100,
            skipSuccessfulRequests: false
        },
        firewall: {
            enabled: true,
            blockSuspiciousIPs: true,
            blockSQLInjection: true,
            blockXSS: true,
            blockPathTraversal: true,
            maxRequestBodySize: 10485760 // 10MB
        },
        headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://script.google.com",
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        },
        session: {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            path: '/',
            domain: ''
        }
    },

    // File Upload Configuration
    upload: {
        maxFileSize: 10485760, // 10MB in bytes
        allowedTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/gif',
            'text/plain'
        ],
        maxFiles: 5,
        chunkSize: 1048576, // 1MB chunks for large files
        storagePath: '/uploads/',
        tempPath: '/temp/'
    },

    // PWA Configuration
    pwa: {
        enabled: true,
        cacheName: 'e-arsip-v2026.1',
        cacheVersion: '2026.1.0',
        offlineFallback: '/offline.html',
        precacheUrls: [
            '/',
            '/login.html',
            '/404.html',
            '/css/style.css',
            '/js/app.js'
        ],
        strategies: {
            images: 'cache-first',
            api: 'network-first',
            static: 'cache-first',
            html: 'network-first'
        }
    },

    // Performance Configuration
    performance: {
        lazyLoading: true,
        imageOptimization: true,
        minifyHTML: true,
        minifyCSS: true,
        minifyJS: true,
        compression: 'gzip',
        caching: {
            enabled: true,
            strategy: 'stale-while-revalidate',
            maxAge: 86400, // 24 hours
            maxEntries: 200
        }
    },

    // Notification Configuration
    notifications: {
        enabled: true,
        pushEnabled: false,
        emailEnabled: false,
        soundEnabled: true,
        desktopEnabled: true,
        channels: ['in-app', 'toast'],
        frequency: 'realtime' // realtime | daily | weekly
    },

    // Logging Configuration
    logging: {
        level: 'info', // debug | info | warn | error
        consoleEnabled: true,
        remoteEnabled: true,
        remoteUrl: '',
        maxEntries: 1000,
        retention: 30, // days
        sensitive: ['password', 'token', 'secret', 'key']
    },

    // Feature Flags
    features: {
        darkMode: true,
        qrCode: true,
        digitalSignature: true,
        eSignature: true,
        approvalWorkflow: true,
        autoNumbering: true,
        exportPdf: true,
        exportExcel: true,
        bulkOperations: true,
        advancedSearch: true,
        realtimeNotifications: true,
        offlineMode: true,
        pwa: true,
        backupRestore: true,
        auditTrail: true
    },

    // Theme Configuration
    theme: {
        default: 'light',
        available: ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red', 'custom'],
        customColors: {
            primary: '#2563eb',
            secondary: '#64748b',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        }
    }
};

// Environment-specific overrides
const ENV_CONFIG = {
    development: {
        debug: true,
        logging: { level: 'debug', consoleEnabled: true, remoteEnabled: false },
        performance: { minifyHTML: false, minifyCSS: false, minifyJS: false }
    },
    staging: {
        debug: true,
        logging: { level: 'debug', consoleEnabled: true, remoteEnabled: true },
        performance: { minifyHTML: true, minifyCSS: true, minifyJS: true }
    },
    production: {
        debug: false,
        logging: { level: 'error', consoleEnabled: false, remoteEnabled: true },
        performance: { minifyHTML: true, minifyCSS: true, minifyJS: true },
        pwa: { enabled: true }
    }
};

// Merge environment config
if (APP_CONFIG.app.environment && ENV_CONFIG[APP_CONFIG.app.environment]) {
    Object.assign(APP_CONFIG, deepMerge(APP_CONFIG, ENV_CONFIG[APP_CONFIG.app.environment]));
}

// Deep merge utility
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// Freeze config in production
if (APP_CONFIG.app.environment === 'production') {
    Object.freeze(APP_CONFIG);
}

export default APP_CONFIG;