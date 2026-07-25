// config/config.js - Konfigurasi Utama (JANGAN UPLOAD KE GITHUB)
/**
 * E-Arsip Digital - Main Configuration
 * Version: 2026.1.0
 * ⚠️ FILE INI BERISI KREDENSIAL SENSITIF - JANGAN COMMIT KE GIT
 * ⬇️ DIUBAH: Dari ES Module ke regular script (window.EArsip.Config)
 */

// Inisialisasi namespace global
window.EArsip = window.EArsip || {};

window.EArsip.Config = {
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
    // GOOGLE APPS SCRIPT CONFIG
    // ============================================
    googleAppsScript: {
        scriptUrl: 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec',
        spreadsheetId: '16eMCGrgTUWEr52_e9qXbFNA_63k45M15EjJsnX7iM30',
        driveFolderId: '1Apt9x1XdDckQkrhg5-LhfAEdZaFPkuXt',
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
    // AUTH CONFIG
    // ============================================
    auth: {
        sessionTimeout: 3600000,
        refreshTokenTimeout: 86400000,
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
        passwordMinLength: 8,
        passwordRequireSpecialChar: true,
        passwordRequireNumber: true,
        passwordRequireUppercase: true,
        mfaEnabled: false,
        jwt: {
            secret: 'eArsipDigital2026SecureJWTSecretKey!@#$%^&*()',
            expiresIn: '1h',
            algorithm: 'HS256'
        }
    },

    // ============================================
    // SECURITY CONFIG
    // ============================================
    security: {
        encryption: { algorithm: 'AES-256-GCM', keyLength: 256 },
        csrf: { enabled: true, cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN', tokenLength: 32 },
        xss: { sanitizeInput: true, sanitizeOutput: true },
        rateLimit: { enabled: true, windowMs: 60000, maxRequests: 100 },
        firewall: { enabled: true, blockSQLInjection: true, blockXSS: true }
    },

    // ============================================
    // UPLOAD CONFIG
    // ============================================
    upload: {
        maxFileSize: 10485760,
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword'],
        maxFiles: 5
    },

    // ============================================
    // FEATURES
    // ============================================
    features: {
        darkMode: true,
        qrCode: true,
        digitalSignature: true,
        approvalWorkflow: true,
        autoNumbering: true,
        exportPdf: true,
        exportExcel: true
    },

    // ============================================
    // THEME
    // ============================================
    theme: {
        default: 'light',
        available: ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red']
    },

    // ============================================
    // LOGGING
    // ============================================
    logging: {
        level: 'info',
        consoleEnabled: true,
        remoteEnabled: false
    }
};

// Freeze di production
if (window.EArsip.Config.app.environment === 'production') {
    Object.freeze(window.EArsip.Config);
}

console.log('E-Arsip Config loaded: v' + window.EArsip.Config.app.version);
