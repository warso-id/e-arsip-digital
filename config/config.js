// config/config.js - Konfigurasi Utama (JANGAN UPLOAD KE GITHUB)
/**
 * E-Arsip Digital - Main Configuration
 * Version: 2026.1.0
 * ⚠️ FILE INI BERISI KREDENSIAL SENSITIF - JANGAN COMMIT KE GIT
 */

const APP_CONFIG = {
    // ============================================
    // APPLICATION INFO
    // ============================================
    app: {
        name: 'E-Arsip Digital',
        version: '2026.1.0',
        environment: 'production',
        debug: false,
        baseUrl: 'https://warso-id.github.io/arsip-surat-digital-enterprise',
        apiUrl: 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec',
        timezone: 'Asia/Jakarta',
        language: 'id',
        fallbackLanguage: 'en',
        tahunAjaranStart: 2025,
        tahunAjaranEnd: 2026
    },

    // ============================================
    // GOOGLE APPS SCRIPT - CODE.GS CONFIG
    // ============================================
    googleAppsScript: {
        // URL Deployment Code.gs
        scriptUrl: 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec',
        
        // Google Sheets ID untuk database
        spreadsheetId: '16eMCGrgTUWEr52_e9qXbFNA_63k45M15EjJsnX7iM30',
        
        // Google Drive Folder ID - Master ARSIP SURAT
        driveFolderId: '1Apt9x1XdDckQkrhg5-LhfAEdZaFPkuXt',
        
        // Nama Sheet di Google Sheets
        sheets: {
            users: 'Users',
            suratKeluar: 'SuratKeluar',
            suratMasuk: 'SuratMasuk',
            disposisi: 'Disposisi',
            approvals: 'Approvals',
            logs: 'ActivityLogs',
            settings: 'Settings',
            penomoran: 'Penomoran',
            signatures: 'Signatures',
            notifications: 'Notifications',
            backups: 'Backups'
        },
        
        // Klasifikasi Surat -> Folder Mapping
        folderMapping: {
            surat_keluar: {
                root: 'Surat Keluar',
                subFolders: {
                    keuangan: 'Surat Keluar Keuangan',
                    umum: 'Surat Keluar Umum',
                    keputusan_dekan: 'Surat Keluar Keputusan Dekan',
                    akademik: 'Surat Keluar Akademik',
                    kemahasiswaan: 'Surat Keluar Kemahasiswaan',
                    kepegawaian: 'Surat Keluar Kepegawaian',
                    kerjasama: 'Surat Keluar Kerjasama'
                }
            },
            surat_masuk: {
                root: 'Surat Masuk',
                subFolders: {
                    keuangan: 'Surat Masuk Keuangan',
                    umum: 'Surat Masuk Umum',
                    keputusan_dekan: 'Surat Masuk Keputusan Dekan',
                    akademik: 'Surat Masuk Akademik',
                    kemahasiswaan: 'Surat Masuk Kemahasiswaan',
                    kepegawaian: 'Surat Masuk Kepegawaian',
                    kerjasama: 'Surat Masuk Kerjasama'
                }
            }
        },
        
        // Tahun Ajaran Config
        tahunAjaran: {
            startMonth: 9,
            endMonth: 8,
            labelFormat: 'TA.{start}/{end}',
            folderFormat: 'T.A. {end}'
        },
        
        cacheTimeout: 300000,
        retryAttempts: 3,
        retryDelay: 1000
    },

    // ============================================
    // AUTHENTICATION CONFIGURATION
    // ============================================
    auth: {
        sessionTimeout: 3600000, // 1 jam
        refreshTokenTimeout: 86400000, // 24 jam
        maxLoginAttempts: 5,
        lockoutDuration: 900000, // 15 menit
        passwordMinLength: 8,
        passwordRequireSpecialChar: true,
        passwordRequireNumber: true,
        passwordRequireUppercase: true,
        mfaEnabled: false,
        mfaMethod: 'totp',
        jwt: {
            secret: 'eArsipDigital2026SecureJWTSecretKey!@#$%^&*()',
            expiresIn: '1h',
            algorithm: 'HS256'
        },
        idleTimeout: 1800000, // 30 menit
        absoluteTimeout: 28800000, // 8 jam
        extendOnActivity: true,
        maxConcurrentSessions: 3
    },

    // ============================================
    // SECURITY CONFIGURATION
    // ============================================
    security: {
        encryption: {
            algorithm: 'AES-256-GCM',
            keyDerivation: 'PBKDF2',
            iterations: 200000,
            keyLength: 256,
            saltLength: 128,
            ivLength: 12,
            tagLength: 128
        },
        csrf: {
            enabled: true,
            cookieName: 'XSRF-TOKEN',
            headerName: 'X-XSRF-TOKEN',
            formFieldName: '_csrf_token',
            tokenLength: 32,
            tokenExpiry: 3600000,
            renewOnUse: true,
            validateOrigin: true,
            allowedOrigins: [
                'https://warso-id.github.io',
                'https://script.google.com'
            ]
        },
        xss: {
            sanitizeInput: true,
            sanitizeOutput: true,
            allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'table', 'tr', 'td', 'th'],
            allowedAttributes: ['href', 'title', 'target', 'class', 'id', 'style'],
            allowedSchemes: ['http', 'https', 'mailto', 'tel'],
            stripComments: true,
            removeEmptyTags: true
        },
        rateLimit: {
            enabled: true,
            windowMs: 60000, // 1 menit
            maxRequests: 100,
            burstMultiplier: 1.5
        },
        firewall: {
            enabled: true,
            blockSuspiciousIPs: true,
            blockSQLInjection: true,
            blockXSS: true,
            blockPathTraversal: true,
            blockUserAgents: false,
            maxRequestBodySize: 10485760 // 10MB
        },
        headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://cdn.jsdelivr.net https://script.google.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://script.google.com https://script.googleusercontent.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Cross-Origin-Embedder-Policy': 'unsafe-none'
        },
        session: {
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            path: '/',
            domain: ''
        },
        password: {
            minLength: 8,
            requireUppercase: true,
            requireNumber: true,
            requireSpecialChar: true,
            maxAge: 90,
            historySize: 5
        },
        audit: {
            enabled: true,
            logLevel: 'info',
            maxLogs: 1000,
            flushInterval: 30000,
            batchSize: 10
        }
    },

    // ============================================
    // FILE UPLOAD CONFIGURATION
    // ============================================
    upload: {
        maxFileSize: 10485760, // 10MB
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
        chunkSize: 1048576, // 1MB chunks
        endpoint: '/api/upload',
        compress: true,
        maxCompressSize: 5242880, // 5MB
        preview: true
    },

    // ============================================
    // PWA CONFIGURATION
    // ============================================
    pwa: {
        enabled: true,
        cacheName: 'e-arsip-v2026.1',
        cacheVersion: '2026.1.0',
        offlineFallback: '/404.html',
        precacheUrls: [
            '/',
            '/index.html',
            '/login.html',
            '/404.html',
            '/css/style.css',
            '/js/init.js',
            '/js/auth.js',
            '/js/api.js',
            '/js/utils.js'
        ],
        strategies: {
            images: 'cache-first',
            api: 'network-first',
            static: 'cache-first',
            html: 'network-first'
        }
    },

    // ============================================
    // PERFORMANCE CONFIGURATION
    // ============================================
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
            maxAge: 86400,
            maxEntries: 200
        }
    },

    // ============================================
    // NOTIFICATION CONFIGURATION
    // ============================================
    notifications: {
        enabled: true,
        pushEnabled: false,
        emailEnabled: false,
        soundEnabled: true,
        desktopEnabled: true,
        channels: ['in-app', 'toast'],
        frequency: 'realtime',
        position: 'top-right',
        duration: 5000,
        maxVisible: 5,
        pauseOnHover: true,
        showProgress: true
    },

    // ============================================
    // LOGGING CONFIGURATION
    // ============================================
    logging: {
        level: 'info',
        consoleEnabled: true,
        remoteEnabled: false,
        remoteUrl: '',
        maxEntries: 1000,
        retention: 30,
        sensitive: ['password', 'token', 'secret', 'key', 'auth', 'credential']
    },

    // ============================================
    // FEATURE FLAGS
    // ============================================
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
        realtimeNotifications: false,
        offlineMode: true,
        pwa: true,
        backupRestore: true,
        auditTrail: true
    },

    // ============================================
    // THEME CONFIGURATION
    // ============================================
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
        },
        transitionDuration: 300,
        enableSystemDetection: true
    },

    // ============================================
    // DEBUG CONFIGURATION (DEVELOPMENT ONLY)
    // ============================================
    debug: {
        enabled: false,
        showPanel: false,
        logLevel: 'debug',
        maxLogEntries: 500
    },

    // ============================================
    // HOT RELOAD (DEVELOPMENT ONLY)
    // ============================================
    hotReload: {
        enabled: false,
        wsUrl: 'ws://localhost:35729',
        reloadCSS: true,
        reloadJS: true,
        reloadHTML: false,
        preserveState: true
    }
};

// Freeze config in production
if (APP_CONFIG.app.environment === 'production') {
    Object.freeze(APP_CONFIG);
}

export default APP_CONFIG;
