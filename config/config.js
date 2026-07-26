// config/config.js - Konfigurasi Utama E-Arsip Digital 2026
/**
 * E-Arsip Digital - Main Configuration
 * Version: 2026.1.0
 * 
 * ⚠️  FILE INI BERISI KREDENSIAL SENSITIF
 * ⚠️  JANGAN COMMIT KE GIT REPOSITORY!
 * ⚠️  SUDAH TERDAFTAR DI .gitignore
 * 
 * Setup:
 *   1. Copy config.example.js ke config.js
 *   2. Isi kredensial asli
 *   3. Jangan commit config.js
 */

// ============================================
// NAMESPACE GLOBAL
// ============================================
window.EArsip = window.EArsip || {};

// ============================================
// KONFIGURASI UTAMA
// ============================================
window.EArsip.Config = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE: DEEP FREEZE UTILITY
    // ============================================
    function deepFreeze(obj) {
        if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
        
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(function(prop) {
            if (obj[prop] !== null && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') && !Object.isFrozen(obj[prop])) {
                deepFreeze(obj[prop]);
            }
        });
        
        return obj;
    }
    
    // ============================================
    // PRIVATE: SANITIZE (hapus trailing slash)
    // ============================================
    function rtrim(str, char) {
        while (str.charAt(str.length - 1) === char) {
            str = str.substring(0, str.length - 1);
        }
        return str;
    }
    
    // ============================================
    // KONFIGURASI
    // ============================================
    var config = {
        // ==========================================
        // 1. APPLICATION INFO
        // ==========================================
        app: {
            name: 'E-Arsip Digital',
            version: '2026.1.0',
            environment: 'production',    // 'development' | 'staging' | 'production'
            debug: false,
            baseUrl: 'https://warso-id.github.io/e-arsip-digital',
            apiUrl: 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec',
            timezone: 'Asia/Jakarta',
            language: 'id',
            tahunAjaranStart: 2025,
            tahunAjaranEnd: 2026
        },
        
        // ==========================================
        // 2. GOOGLE APPS SCRIPT / SHEETS
        // ==========================================
        googleAppsScript: {
            // URL Deployment
            scriptUrl: 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec',
            
            // Google Sheets Database ID
            spreadsheetId: '16eMCGrgTUWEr52_e9qXbFNA_63k45M15EjJsnX7iM30',
            
            // Google Drive Folder ID - Master ARSIP SURAT
            driveFolderId: '1Apt9x1XdDckQkrhg5-LhfAEdZaFPkuXt',
            
            // Nama Sheet
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
            
            // Drive Folder Mapping untuk Surat
            folderMapping: {
                surat_keluar: {
                    root: 'Surat Keluar',
                    subFolders: {
                        umum: 'Surat Keluar Umum',
                        keuangan: 'Surat Keluar Keuangan',
                        akademik: 'Surat Keluar Akademik',
                        kemahasiswaan: 'Surat Keluar Kemahasiswaan',
                        kepegawaian: 'Surat Keluar Kepegawaian',
                        kerjasama: 'Surat Keluar Kerjasama',
                        keputusan_dekan: 'Surat Keluar Keputusan Dekan'
                    }
                },
                surat_masuk: {
                    root: 'Surat Masuk',
                    subFolders: {
                        umum: 'Surat Masuk Umum',
                        keuangan: 'Surat Masuk Keuangan',
                        akademik: 'Surat Masuk Akademik',
                        kemahasiswaan: 'Surat Masuk Kemahasiswaan',
                        kepegawaian: 'Surat Masuk Kepegawaian',
                        kerjasama: 'Surat Masuk Kerjasama',
                        keputusan_dekan: 'Surat Masuk Keputusan Dekan'
                    }
                }
            },
            
            // Tahun Ajaran
            tahunAjaran: {
                startMonth: 9,       // September
                endMonth: 8,         // Agustus
                labelFormat: 'TA.{start}/{end}',
                folderFormat: 'T.A. {end}'
            },
            
            // Performance
            cacheTimeout: 300000,    // 5 menit
            retryAttempts: 3,
            retryDelay: 1000         // 1 detik
        },
        
        // ==========================================
        // 3. AUTHENTICATION
        // ==========================================
        auth: {
            sessionTimeout: 3600000,         // 1 jam
            refreshTokenTimeout: 86400000,   // 24 jam
            maxLoginAttempts: 5,
            lockoutDuration: 900000,         // 15 menit
            passwordMinLength: 8,
            passwordRequireSpecialChar: true,
            passwordRequireNumber: true,
            passwordRequireUppercase: true,
            mfaEnabled: false,
            idleTimeout: 1800000,            // 30 menit
            absoluteTimeout: 28800000,       // 8 jam
            extendOnActivity: true,
            maxConcurrentSessions: 3,
            
            // JWT Configuration
            // ⚠️  SECRET di-generate saat runtime atau dari environment
            // ⚠️  JANGAN hardcode secret di sini!
            jwt: {
                expiresIn: '1h',
                algorithm: 'HS256'
            }
        },
        
        // ==========================================
        // 4. SECURITY
        // ==========================================
        security: {
            // Encryption untuk data sensitif
            encryption: {
                algorithm: 'AES-256-GCM',
                keyLength: 256,
                saltLength: 128,
                ivLength: 12
            },
            
            // CSRF Protection
            csrf: {
                enabled: true,
                cookieName: 'XSRF-TOKEN',
                headerName: 'X-CSRF-Token',
                tokenLength: 32,
                tokenExpiry: 3600000,    // 1 jam
                renewOnUse: true
            },
            
            // XSS Protection
            xss: {
                sanitizeInput: true,
                sanitizeOutput: true
            },
            
            // Rate Limiting (client-side hint)
            rateLimit: {
                enabled: true,
                windowMs: 60000,         // 1 menit
                maxRequests: 100
            },
            
            // Firewall Rules
            firewall: {
                enabled: true,
                blockSQLInjection: true,
                blockXSS: true,
                blockPathTraversal: true,
                maxRequestBodySize: 10485760  // 10MB
            },
            
            // Session Cookie Settings
            session: {
                httpOnly: true,
                secure: true,            // FALSE untuk development (HTTP)
                sameSite: 'Lax',         // 'Lax' untuk PWA + cross-origin
                path: '/'
            },
            
            // Password Policy
            password: {
                minLength: 8,
                requireUppercase: true,
                requireNumber: true,
                requireSpecialChar: true,
                maxAge: 90,              // hari
                historySize: 5
            },
            
            // Audit Trail
            audit: {
                enabled: true,
                maxLogs: 1000,
                flushInterval: 30000     // 30 detik
            }
        },
        
        // ==========================================
        // 5. FILE UPLOAD
        // ==========================================
        upload: {
            maxFileSize: 10485760,       // 10MB
            allowedTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'image/jpeg',
                'image/png',
                'image/gif'
            ],
            blockedExtensions: [
                '.exe', '.bat', '.cmd', '.sh', '.msi', '.dll',
                '.js', '.vbs', '.ps1', '.scr', '.com'
            ],
            maxFiles: 5,
            chunkSize: 1048576,          // 1MB chunks untuk file besar
            compress: true,
            preview: true
        },
        
        // ==========================================
        // 6. PWA CONFIGURATION
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
                'js/config.js',
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
        // 7. PERFORMANCE
        // ==========================================
        performance: {
            lazyLoading: true,
            imageOptimization: true,
            compression: 'gzip',
            caching: {
                enabled: true,
                strategy: 'stale-while-revalidate',
                maxAge: 86400,           // 24 jam
                maxEntries: 200
            }
        },
        
        // ==========================================
        // 8. NOTIFICATIONS
        // ==========================================
        notifications: {
            enabled: true,
            soundEnabled: true,
            desktopEnabled: true,
            channels: ['in-app', 'toast'],
            position: 'top-right',
            duration: 5000,              // 5 detik
            maxVisible: 5,
            pauseOnHover: true
        },
        
        // ==========================================
        // 9. LOGGING
        // ==========================================
        logging: {
            level: 'info',              // 'debug' | 'info' | 'warn' | 'error'
            consoleEnabled: true,
            remoteEnabled: false,
            maxEntries: 1000,
            retention: 30,              // hari
            // JANGAN log nilai dari field ini
            sensitive: ['password', 'token', 'secret', 'key', 'auth', 'credential', 'authorization']
        },
        
        // ==========================================
        // 10. FEATURE FLAGS
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
            realtimeNotifications: false,
            offlineMode: true,
            pwa: true,
            backupRestore: true,
            auditTrail: true
        },
        
        // ==========================================
        // 11. THEME
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
            },
            transitionDuration: 300,
            enableSystemDetection: true
        },
        
        // ==========================================
        // 12. ROLE-BASED ROUTING (16 ROLES)
        // ==========================================
        routes: {
            login: '../login.html',
            home: '../index.html',
            dashboard: {
                'super_admin': 'super-admin/index.html',
                'admin': 'admin/index.html',
                'kasubag': 'kasubag/index.html',
                'kaprodi': 'kaprodi/index.html',
                'admin_kaprodi': 'admin-kaprodi/index.html',
                'wadek': 'wadek/index.html',
                'admin_wadek': 'admin-wadek/index.html',
                'dekan': 'dekan/index.html',
                'admin_dekan': 'admin-dekan/index.html',
                'ketua_upm': 'ketua-upm/index.html',
                'litdianmas': 'litdianmas/index.html',
                'staf': 'staf/index.html',
                'dosen': 'dosen/index.html',
                'lembaga_kemahasiswaan': 'lembaga-kemahasiswaan/index.html',
                'mahasiswa': 'mahasiswa/index.html',
                'user': 'user/index.html',
                'default': './'
            },
            error: {
                '403': '../error/403.html',
                '404': '../error/404.html',
                '500': '../error/500.html'
            }
        },
        
        // ==========================================
        // 13. API ENDPOINTS
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
    // RUNTIME ADJUSTMENTS
    // ============================================
    
    // Auto-detect environment
    var hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        config.app.environment = 'development';
        config.app.debug = true;
        config.security.session.secure = false;
        config.logging.level = 'debug';
    }
    
    // Auto-detect GitHub Pages base path
    if (hostname.includes('github.io')) {
        var pathParts = window.location.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1]) {
            config.app.baseUrl = window.location.origin + '/' + pathParts[1];
        }
    }
    
    // Clean trailing slashes
    config.app.apiUrl = rtrim(config.app.apiUrl, '/');
    config.googleAppsScript.scriptUrl = rtrim(config.googleAppsScript.scriptUrl, '/');
    
    // ============================================
    // FREEZE IN PRODUCTION
    // ============================================
    if (config.app.environment === 'production') {
        deepFreeze(config);
        console.log('E-Arsip Config: PRODUCTION mode (frozen)');
    } else {
        console.log('E-Arsip Config: ' + config.app.environment.toUpperCase() + ' mode');
    }
    
    console.log('E-Arsip Digital v' + config.app.version + ' | ' + config.app.environment);
    
    return config;
})();
