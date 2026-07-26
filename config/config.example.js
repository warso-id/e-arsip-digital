// config/config.example.js - Template Konfigurasi Aman 2026
/**
 * E-Arsip Digital - Configuration Template
 * Version: 2026.1.0
 * Safe for GitHub upload - NO SECRETS
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to config.js:  cp config.example.js config.js
 * 2. Fill in your actual values in config.js
 * 3. NEVER commit config.js to GitHub (already in .gitignore)
 * 4. For deployment, use environment variables or secrets manager
 */

// ============================================
// CONFIG LOADER (IIFE - No ES Module needed)
// ============================================
var EArsipConfig = (function() {
    'use strict';
    
    // ============================================
    // DEEP MERGE UTILITY (Handles arrays properly)
    // ============================================
    function deepMerge(target, source) {
        if (!source || typeof source !== 'object') return target;
        
        var result = {};
        
        // Copy all target keys
        for (var key in target) {
            if (target.hasOwnProperty(key)) {
                result[key] = target[key];
            }
        }
        
        // Merge source keys
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
                    // Recursive merge for objects
                    result[key] = deepMerge(target[key] || {}, source[key]);
                } else if (Array.isArray(source[key])) {
                    // Replace arrays (don't merge)
                    result[key] = source[key].slice();
                } else {
                    // Primitive values - source wins
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }
    
    // ============================================
    // ENVIRONMENT DETECTION
    // ============================================
    function detectEnvironment() {
        var hostname = window.location.hostname;
        var pathname = window.location.pathname;
        
        // Production domains
        if (hostname === 'yourdomain.com' || hostname === 'www.yourdomain.com') {
            return 'production';
        }
        
        // Staging domains
        if (hostname.includes('staging') || hostname.includes('netlify.app') || hostname.includes('vercel.app')) {
            return 'staging';
        }
        
        // GitHub Pages
        if (hostname.includes('github.io')) {
            return 'production';
        }
        
        // Local development
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.')) {
            return 'development';
        }
        
        return 'development';
    }
    
    // ============================================
    // BASE CONFIGURATION
    // ============================================
    var BASE_CONFIG = {
        // ==========================================
        // APPLICATION INFO
        // ==========================================
        app: {
            name: 'E-Arsip Digital',
            version: '2026.1.0',
            environment: 'development', // Auto-detected, override if needed
            debug: false,
            basePath: '/arsip-surat-digital-enterprise', // GitHub Pages subfolder ('' for root)
            apiUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
            timezone: 'Asia/Jakarta',
            language: 'id'
        },
        
        // ==========================================
        // GOOGLE APPS SCRIPT / SHEETS
        // ==========================================
        googleSheets: {
            scriptUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
            spreadsheetId: 'YOUR_SPREADSHEET_ID',
            sheetNames: {
                users: 'Users',
                suratMasuk: 'SuratMasuk',
                suratKeluar: 'SuratKeluar',
                disposisi: 'Disposisi',
                approvals: 'Approvals',
                logs: 'ActivityLogs',
                settings: 'Settings',
                penomoran: 'Penomoran'
            },
            cacheTimeout: 300000,       // 5 minutes
            retryAttempts: 3,
            retryDelay: 1000            // 1 second
        },
        
        // ==========================================
        // AUTHENTICATION
        // ==========================================
        auth: {
            sessionTimeout: 3600000,        // 1 hour
            refreshTokenTimeout: 86400000,  // 24 hours
            maxLoginAttempts: 5,
            lockoutDuration: 900000,        // 15 minutes
            passwordMinLength: 8,
            passwordRequireSpecialChar: true,
            passwordRequireNumber: true,
            passwordRequireUppercase: true,
            jwt: {
                expiresIn: '1h',
                algorithm: 'HS512'
            }
        },
        
        // ==========================================
        // SECURITY
        // ==========================================
        security: {
            csrf: {
                enabled: true,
                cookieName: 'XSRF-TOKEN',
                headerName: 'X-CSRF-Token',
                tokenLength: 32,
                tokenTTL: 3600000  // 1 hour - auto refresh
            },
            xss: {
                sanitizeInput: true,
                sanitizeOutput: true
            },
            rateLimit: {
                enabled: true,
                windowMs: 60000,     // 1 minute
                maxRequests: 100
            },
            session: {
                httpOnly: true,
                secure: false,       // TRUE in production (HTTPS only)
                sameSite: 'Lax',     // 'Lax' for PWA + cross-origin compatibility
                path: '/'
            }
        },
        
        // ==========================================
        // FILE UPLOAD
        // ==========================================
        upload: {
            maxFileSize: 10485760,  // 10MB
            allowedTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png'
            ],
            maxFiles: 5,
            blockedExtensions: ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.js', '.vbs', '.ps1']
        },
        
        // ==========================================
        // PWA CONFIGURATION
        // ==========================================
        pwa: {
            enabled: true,
            cacheName: 'earsip-v2026',
            cacheVersion: '2026.1.0',
            offlineFallback: 'offline.html',
            precacheUrls: [
                'index.html',
                'login.html',
                'offline.html',
                'css/style.css',
                'js/api.js',
                'js/auth.js',
                'js/utils.js',
                'manifest.json'
            ],
            strategies: {
                images: 'cache-first',
                api: 'network-first',
                static: 'cache-first',
                html: 'network-first',
                fonts: 'cache-first'
            },
            maxCacheSize: 50 * 1024 * 1024  // 50MB
        },
        
        // ==========================================
        // PERFORMANCE
        // ==========================================
        performance: {
            lazyLoading: true,
            imageOptimization: true,
            compression: 'gzip',
            caching: {
                enabled: true,
                maxAge: 86400,      // 24 hours
                maxEntries: 200
            }
        },
        
        // ==========================================
        // NOTIFICATIONS
        // ==========================================
        notifications: {
            enabled: true,
            soundEnabled: true,
            desktopEnabled: false,
            channels: ['in-app', 'toast']
        },
        
        // ==========================================
        // LOGGING
        // ==========================================
        logging: {
            level: 'info',          // debug | info | warn | error
            consoleEnabled: true,
            maxEntries: 1000,
            sensitive: ['password', 'token', 'secret', 'key', 'authorization']
        },
        
        // ==========================================
        // FEATURE FLAGS
        // ==========================================
        features: {
            darkMode: true,
            qrCode: true,
            digitalSignature: true,
            approvalWorkflow: true,
            autoNumbering: true,
            exportPdf: true,
            exportExcel: true,
            bulkOperations: true,
            advancedSearch: true,
            offlineMode: true,
            pwa: true,
            auditTrail: true
        },
        
        // ==========================================
        // THEME
        // ==========================================
        theme: {
            default: 'light',
            available: ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red'],
            customColors: {
                primary: '#2563eb',
                secondary: '#64748b',
                success: '#10b981',
                danger: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            }
        },
        
        // ==========================================
        // ROLE-BASED ROUTING (16 Roles)
        // ==========================================
        routes: {
            login: 'login.html',
            home: 'index.html',
            dashboard: {
                'super_admin': 'dashboard/super-admin/index.html',
                'admin': 'dashboard/admin/index.html',
                'kasubag': 'dashboard/kasubag/index.html',
                'kaprodi': 'dashboard/kaprodi/index.html',
                'admin_kaprodi': 'dashboard/admin-kaprodi/index.html',
                'wadek': 'dashboard/wadek/index.html',
                'admin_wadek': 'dashboard/admin-wadek/index.html',
                'dekan': 'dashboard/dekan/index.html',
                'admin_dekan': 'dashboard/admin-dekan/index.html',
                'ketua_upm': 'dashboard/ketua-upm/index.html',
                'litdianmas': 'dashboard/litdianmas/index.html',
                'staf': 'dashboard/staf/index.html',
                'dosen': 'dashboard/dosen/index.html',
                'lembaga_kemahasiswaan': 'dashboard/lembaga-kemahasiswaan/index.html',
                'mahasiswa': 'dashboard/mahasiswa/index.html',
                'user': 'dashboard/user/index.html',
                'default': 'dashboard/'
            },
            error: {
                '403': 'error/403.html',
                '404': 'error/404.html',
                '500': 'error/500.html'
            }
        },
        
        // ==========================================
        // API ENDPOINTS
        // ==========================================
        endpoints: {
            login: 'login',
            logout: 'logout',
            health: 'health',
            stats: 'statistics',
            suratKeluar: 'surat-keluar',
            suratMasuk: 'surat-masuk',
            disposisi: 'disposisi',
            approval: 'approval',
            users: 'users',
            logs: 'logs',
            settings: 'settings',
            verify: 'verify',
            generate: 'generate'
        }
    };
    
    // ============================================
    // ENVIRONMENT-SPECIFIC OVERRIDES
    // ============================================
    var ENV_OVERRIDES = {
        development: {
            app: { debug: true, environment: 'development' },
            logging: { level: 'debug', consoleEnabled: true },
            security: { session: { secure: false } },
            features: { offlineMode: false }
        },
        staging: {
            app: { debug: true, environment: 'staging' },
            logging: { level: 'debug', consoleEnabled: true },
            security: { session: { secure: true } },
            features: { offlineMode: true }
        },
        production: {
            app: { debug: false, environment: 'production' },
            logging: { level: 'error', consoleEnabled: false },
            security: { session: { secure: true } },
            features: { offlineMode: true }
        }
    };
    
    // ============================================
    // BUILD FINAL CONFIG
    // ============================================
    function buildConfig(customConfig) {
        // Detect environment
        var env = detectEnvironment();
        
        // Start with base config
        var config = deepMerge({}, BASE_CONFIG);
        
        // Apply environment overrides
        if (ENV_OVERRIDES[env]) {
            config = deepMerge(config, ENV_OVERRIDES[env]);
        }
        
        // Apply custom config (from config.js)
        if (customConfig && typeof customConfig === 'object') {
            config = deepMerge(config, customConfig);
        }
        
        // Update basePath if on GitHub Pages
        if (window.location.hostname.includes('github.io')) {
            var pathParts = window.location.pathname.split('/');
            if (pathParts.length > 1 && pathParts[1]) {
                config.app.basePath = '/' + pathParts[1];
            }
        }
        
        // Freeze in production (shallow)
        if (config.app.environment === 'production') {
            Object.freeze(config);
            Object.freeze(config.app);
            Object.freeze(config.security);
            Object.freeze(config.auth);
            Object.freeze(config.routes);
        }
        
        return config;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    return {
        build: buildConfig,
        detectEnvironment: detectEnvironment,
        BASE_CONFIG: BASE_CONFIG,
        ENV_OVERRIDES: ENV_OVERRIDES
    };
})();

// ============================================
// USAGE IN config.js:
// ============================================
// var customConfig = {
//     app: { apiUrl: 'https://script.google.com/macros/s/REAL_ID/exec' },
//     googleSheets: { spreadsheetId: 'REAL_SPREADSHEET_ID' }
// };
// var CONFIG = EArsipConfig.build(customConfig);
// ============================================