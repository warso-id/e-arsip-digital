// js/migration.js - Secure Data Migration System 2026
/**
 * E-Arsip Digital - Enterprise Migration Manager
 * Version: 2026.1.0
 * Features: Schema versioning, encrypted backups, rollback, integrity checks,
 *           PWA-aware storage, security audit trail, atomic operations
 * Security: Encrypted backups, integrity verification, access control
 */

import APP_CONFIG from '../config/config.js';

class MigrationHelper {
    constructor() {
        this.config = APP_CONFIG.migration || {};
        
        // ✅ FIX: Lazy load dependencies untuk hindari circular dependency
        this.logger = null;
        this.encryption = null;
        
        // Migration state
        this.migrations = [];
        this.appliedMigrations = new Set();
        this.migrationLock = false;
        
        // Version info
        this.currentVersion = APP_CONFIG.app?.version || '2026.1.0';
        this.schemaVersion = null;
        
        // Backup configuration
        this.maxBackups = this.config.maxBackups || 5;
        this.backupPrefix = 'migration_backup_';
        this.backupEncrypted = this.config.backupEncrypted !== false;
        
        // Storage keys (whitelist untuk keamanan)
        this.protectedKeys = [
            'app_settings',
            'applied_migrations',
            'auth_session',
            'user_preferences',
            'theme_settings',
            'language_settings',
            'notification_settings',
            'cache_app_',
            'recent_documents',
            'favorite_documents',
            'search_history',
            'form_drafts'
        ];
        
        // Keys yang TIDAK BOLEH dimigrasi/backup
        this.excludedKeys = [
            'encryption_key',
            'private_key',
            'master_password',
            'csrf_token',
            'temp_'
        ];
        
        // Migration timeout
        this.migrationTimeout = this.config.timeout || 30000; // 30 detik
        
        // PWA support
        this.isPWA = typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone
        );
        
        this.init();
    }
    
    async init() {
        try {
            // ✅ FIX: Inisialisasi dependencies secara async
            await this.initDependencies();
            
            // Load state
            this.loadAppliedMigrations();
            this.registerMigrations();
            
            // Check schema version
            await this.checkSchemaVersion();
            
            this.log('info', 'Migration system initialized', {
                currentVersion: this.currentVersion,
                schemaVersion: this.schemaVersion,
                appliedCount: this.appliedMigrations.size,
                pendingCount: this.getPendingMigrations().length,
                isPWA: this.isPWA
            });
            
            // ✅ FIX: Auto-migrate dengan proper error handling dan delay
            if (this.config.autoMigrate !== false) {
                this.scheduleAutoMigration();
            }
        } catch (error) {
            console.error('Failed to initialize migration system:', error);
        }
    }
    
    async initDependencies() {
        try {
            // Lazy load Logger
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Migration');
        } catch (error) {
            // Fallback logger
            this.logger = {
                debug: console.debug.bind(console, '[Migration]'),
                info: console.info.bind(console, '[Migration]'),
                warn: console.warn.bind(console, '[Migration]'),
                error: console.error.bind(console, '[Migration]'),
                fatal: console.error.bind(console, '[Migration FATAL]')
            };
        }
        
        try {
            // Lazy load EncryptionService
            const encryptionModule = await import('./security/encryption.js');
            this.encryption = new encryptionModule.EncryptionService();
        } catch (error) {
            this.log('warn', 'Encryption service not available - backups will be unencrypted');
            this.backupEncrypted = false;
            this.encryption = null;
        }
    }
    
    // ✅ NEW: Logging wrapper dengan fallback
    log(level, message, data = null) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](message, data);
        } else {
            const prefix = `[Migration ${level.toUpperCase()}]`;
            const logFn = level === 'error' || level === 'fatal' ? console.error :
                         level === 'warn' ? console.warn :
                         level === 'debug' ? console.debug : console.info;
            logFn(`${prefix} ${message}`, data || '');
        }
    }
    
    // ✅ NEW: Scheduler auto-migration dengan PWA awareness
    scheduleAutoMigration() {
        // Tunggu DOM ready dan service worker aktif
        const startMigration = async () => {
            try {
                // Tunggu service worker jika PWA
                if (this.isPWA && 'serviceWorker' in navigator) {
                    await navigator.serviceWorker.ready;
                    this.log('debug', 'Service Worker ready, starting migration check');
                }
                
                // Delay untuk memastikan semua komponen siap
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const result = await this.migrate();
                
                if (!result.success) {
                    this.log('error', 'Auto-migration failed', result);
                    
                    // Notifikasi user jika error fatal
                    if (result.failedAt && result.critical) {
                        this.notifyMigrationFailure(result);
                    }
                }
            } catch (error) {
                this.log('error', 'Auto-migration error', {
                    message: error.message,
                    stack: error.stack
                });
            }
        };
        
        // Start migration saat idle jika didukung
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => startMigration(), { timeout: 5000 });
        } else {
            setTimeout(startMigration, 2000);
        }
    }
    
    // ✅ NEW: Notifikasi kegagalan migrasi ke user
    notifyMigrationFailure(result) {
        if (typeof window === 'undefined') return;
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('migration-failed', {
            detail: {
                version: result.failedAt,
                error: result.error,
                timestamp: new Date().toISOString()
            }
        }));
        
        // Tampilkan notifikasi jika ada NotificationAPI
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⚠️ Migration Failed', {
                body: `Failed at version ${result.failedAt}. Some features may not work correctly.`,
                icon: '/icons/icon-192x192.png',
                tag: 'migration-error'
            });
        }
    }
    
    // ============================================
    // MIGRATION REGISTRY (dengan validasi)
    // ============================================
    
    registerMigrations() {
        // Migration: v1.0.0 -> v2024.1.0
        this.registerMigration({
            version: '2024.1.0',
            name: 'Initial Schema Setup',
            description: 'Create initial data structures and default settings',
            critical: true,
            validate: async () => {
                // Cek apakah aplikasi bisa menulis ke storage
                try {
                    const testKey = '_migration_test_';
                    localStorage.setItem(testKey, 'test');
                    localStorage.removeItem(testKey);
                    return true;
                } catch {
                    return false;
                }
            },
            up: async () => {
                const defaults = {
                    theme: 'light',
                    fontSize: 'normal',
                    language: 'id',
                    notifications: true,
                    dateFormat: 'DD/MM/YYYY',
                    timeFormat: '24h',
                    itemsPerPage: 25
                };
                
                if (!localStorage.getItem('app_settings')) {
                    localStorage.setItem('app_settings', JSON.stringify(defaults));
                }
                
                // Setup initial storage structure
                const initialKeys = {
                    'recent_documents': '[]',
                    'favorite_documents': '[]',
                    'search_history': '[]',
                    'form_drafts': '[]'
                };
                
                for (const [key, defaultValue] of Object.entries(initialKeys)) {
                    if (!localStorage.getItem(key)) {
                        localStorage.setItem(key, defaultValue);
                    }
                }
                
                return true;
            },
            down: async () => {
                // Hanya hapus keys yang dibuat oleh migrasi ini
                const keysToRemove = [
                    'app_settings',
                    'recent_documents',
                    'favorite_documents',
                    'search_history',
                    'form_drafts'
                ];
                
                for (const key of keysToRemove) {
                    localStorage.removeItem(key);
                }
                
                return true;
            }
        });
        
        // Migration: v2024.1.0 -> v2025.1.0
        this.registerMigration({
            version: '2025.1.0',
            name: 'Enhanced Security Layer',
            description: 'Add encryption to stored sensitive data and implement access control',
            critical: true,
            up: async () => {
                // Hanya encrypt data yang bukan system keys
                const sensitiveKeys = [
                    'auth_session',
                    'auth_token',
                    'user_preferences',
                    'form_drafts'
                ];
                
                for (const key of sensitiveKeys) {
                    const value = localStorage.getItem(key);
                    if (value && !value.startsWith('ENC:') && this.encryption) {
                        try {
                            const encrypted = await this.encryption.encrypt(value);
                            // Simpan dengan batasan ukuran
                            if (encrypted.length < 100000) { // 100KB limit
                                localStorage.setItem(key, `ENC:${encrypted}`);
                            } else {
                                this.log('warn', `Data for ${key} too large to encrypt`, {
                                    size: encrypted.length
                                });
                            }
                        } catch (error) {
                            this.log('warn', `Failed to encrypt ${key}`, {
                                error: error.message
                            });
                            // Lanjutkan tanpa encrypt key ini
                        }
                    }
                }
                
                // Tambah access control metadata
                const accessControl = {
                    version: '2025.1.0',
                    lastAccess: new Date().toISOString(),
                    roles: ['admin', 'user', 'viewer'],
                    features: {
                        encryption: true,
                        audit: true,
                        backup: true
                    }
                };
                localStorage.setItem('access_control', JSON.stringify(accessControl));
                
                return true;
            },
            down: async () => {
                // Dekripsi data yang di-encrypt
                const encryptedKeys = ['auth_session', 'auth_token', 'user_preferences', 'form_drafts'];
                
                for (const key of encryptedKeys) {
                    const value = localStorage.getItem(key);
                    if (value?.startsWith('ENC:') && this.encryption) {
                        try {
                            const decrypted = await this.encryption.decrypt(value.substring(4));
                            localStorage.setItem(key, decrypted);
                        } catch (error) {
                            this.log('error', `Failed to decrypt ${key}`, {
                                error: error.message
                            });
                            // Hapus data yang corrupted
                            localStorage.removeItem(key);
                        }
                    }
                }
                
                localStorage.removeItem('access_control');
                return true;
            }
        });
        
        // Migration: v2025.1.0 -> v2026.1.0
        this.registerMigration({
            version: '2026.1.0',
            name: 'Modern 2026 Schema',
            description: 'Update to 2026 schema with PWA support and new features',
            critical: true,
            validate: async () => {
                // Cek IndexedDB availability untuk PWA
                if (this.isPWA) {
                    return 'indexedDB' in window;
                }
                return true;
            },
            up: async () => {
                // Update settings dengan fitur baru
                const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
                settings.version = '2026.1.0';
                settings.features = {
                    darkMode: true,
                    qrCode: true,
                    digitalSignature: true,
                    approvalWorkflow: true,
                    autoNumbering: true,
                    exportPdf: true,
                    exportExcel: true,
                    bulkOperations: true,
                    advancedSearch: true,
                    realtimeNotifications: true,
                    offlineMode: true,
                    pwaSupport: this.isPWA,
                    biometricAuth: false, // Tergantung device
                    pushNotifications: false
                };
                
                // Tambah preferences baru
                settings.preferences = settings.preferences || {};
                settings.preferences.compactMode = false;
                settings.preferences.enableAnimations = true;
                settings.preferences.autoSave = true;
                settings.preferences.autoSaveInterval = 30000; // 30 detik
                
                localStorage.setItem('app_settings', JSON.stringify(settings));
                
                // Migrasi cache format
                await this.migrateCacheFormat();
                
                // Setup PWA storage jika diperlukan
                if (this.isPWA) {
                    await this.setupPWAStorage();
                }
                
                // Setup audit trail
                if (!localStorage.getItem('audit_trail')) {
                    localStorage.setItem('audit_trail', JSON.stringify([]));
                }
                
                return true;
            },
            down: async () => {
                // Rollback settings
                const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
                delete settings.features;
                delete settings.preferences;
                delete settings.version;
                localStorage.setItem('app_settings', JSON.stringify(settings));
                
                // Bersihkan PWA storage
                if (this.isPWA) {
                    await this.cleanupPWAStorage();
                }
                
                localStorage.removeItem('audit_trail');
                return true;
            }
        });
    }
    
    registerMigration(migration) {
        // Validasi migration object
        if (!migration.version || !migration.up || !migration.down) {
            this.log('error', 'Invalid migration registration', {
                name: migration.name || 'unnamed'
            });
            return;
        }
        
        // Cek duplikasi
        if (this.migrations.find(m => m.version === migration.version)) {
            this.log('warn', 'Duplicate migration version', {
                version: migration.version
            });
            return;
        }
        
        this.migrations.push({
            ...migration,
            registeredAt: new Date().toISOString()
        });
        
        // Sort migrations by version
        this.migrations.sort((a, b) => a.version.localeCompare(b.version));
    }
    
    // ============================================
    // MIGRATION EXECUTION (dengan locking)
    // ============================================
    
    async migrate(targetVersion = null) {
        // ✅ FIX: Cegah concurrent migrations
        if (this.migrationLock) {
            this.log('warn', 'Migration already in progress');
            return { success: false, error: 'Migration in progress' };
        }
        
        this.migrationLock = true;
        
        try {
            const target = targetVersion || this.currentVersion;
            
            // Dapatkan pending migrations
            const pending = this.migrations
                .filter(m => !this.appliedMigrations.has(m.version))
                .filter(m => m.version <= target);
            
            if (pending.length === 0) {
                this.log('debug', 'No pending migrations');
                return { success: true, applied: 0 };
            }
            
            this.log('info', 'Starting migrations', {
                pending: pending.length,
                versions: pending.map(m => m.version),
                target
            });
            
            // Pre-flight checks
            const preflightResult = await this.preflightCheck(pending);
            if (!preflightResult.success) {
                this.log('error', 'Preflight check failed', preflightResult);
                return {
                    success: false,
                    error: 'Preflight check failed',
                    details: preflightResult.errors
                };
            }
            
            // Create backup sebelum migrasi
            const backupKey = await this.createBackup();
            
            // Timeout untuk mencegah hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Migration timeout')), this.migrationTimeout);
            });
            
            let applied = 0;
            
            // Execute migrations satu per satu
            for (const migration of pending) {
                try {
                    this.log('info', 'Applying migration', {
                        version: migration.version,
                        name: migration.name
                    });
                    
                    // Execute dengan timeout
                    const result = await Promise.race([
                        migration.up(),
                        timeoutPromise
                    ]);
                    
                    if (result) {
                        this.appliedMigrations.add(migration.version);
                        this.saveAppliedMigrations();
                        applied++;
                        
                        // Update schema version
                        this.schemaVersion = migration.version;
                        
                        this.log('info', 'Migration applied successfully', {
                            version: migration.version,
                            progress: `${applied}/${pending.length}`
                        });
                        
                        // Dispatch event
                        this.dispatchMigrationEvent('applied', migration);
                    }
                } catch (error) {
                    this.log('error', 'Migration failed', {
                        version: migration.version,
                        name: migration.name,
                        error: error.message,
                        stack: error.stack
                    });
                    
                    // Rollback migration yang gagal
                    await this.rollback(migration.version);
                    
                    // Restore backup jika migrasi critical
                    if (migration.critical && backupKey) {
                        this.log('warn', 'Restoring backup due to critical migration failure');
                        await this.restoreBackup(backupKey);
                    }
                    
                    return {
                        success: false,
                        applied,
                        failedAt: migration.version,
                        error: error.message,
                        critical: migration.critical || false,
                        backupKey: migration.critical ? backupKey : null
                    };
                }
            }
            
            // Hapus backup setelah sukses (opsional)
            if (backupKey && applied > 0) {
                setTimeout(() => {
                    localStorage.removeItem(backupKey);
                }, 60000); // Hapus setelah 1 menit
            }
            
            return { 
                success: true, 
                applied,
                currentVersion: this.schemaVersion
            };
            
        } finally {
            this.migrationLock = false;
        }
    }
    
    async rollback(targetVersion) {
        const migration = this.migrations.find(m => m.version === targetVersion);
        
        if (!migration) {
            this.log('warn', 'No migration found for rollback', { version: targetVersion });
            return false;
        }
        
        if (!this.appliedMigrations.has(targetVersion)) {
            this.log('warn', 'Migration not applied, skipping rollback', { version: targetVersion });
            return false;
        }
        
        try {
            this.log('info', 'Rolling back migration', {
                version: targetVersion,
                name: migration.name
            });
            
            // Create backup sebelum rollback
            await this.createBackup();
            
            await migration.down();
            
            this.appliedMigrations.delete(targetVersion);
            this.saveAppliedMigrations();
            
            // Update schema version
            const appliedVersions = [...this.appliedMigrations].sort();
            this.schemaVersion = appliedVersions[appliedVersions.length - 1] || null;
            
            this.log('info', 'Migration rolled back successfully', {
                version: targetVersion
            });
            
            this.dispatchMigrationEvent('rolled-back', migration);
            
            return true;
        } catch (error) {
            this.log('error', 'Rollback failed', {
                version: targetVersion,
                error: error.message,
                stack: error.stack
            });
            
            return false;
        }
    }
    
    async rollbackAll() {
        this.log('warn', 'Rolling back ALL migrations');
        
        // Backup dulu
        await this.createBackup();
        
        const applied = [...this.appliedMigrations]
            .sort((a, b) => b.localeCompare(a)); // Reverse order
        
        let rolledBack = 0;
        
        for (const version of applied) {
            const success = await this.rollback(version);
            if (success) rolledBack++;
        }
        
        this.schemaVersion = null;
        
        return { success: rolledBack === applied.length, rolledBack };
    }
    
    // ============================================
    // BACKUP SYSTEM (dengan enkripsi)
    // ============================================
    
    async createBackup() {
        try {
            // Hanya backup whitelisted keys
            const backupData = {};
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                // Skip excluded keys
                if (this.excludedKeys.some(excluded => key.startsWith(excluded))) {
                    continue;
                }
                
                // Skip backup keys sendiri
                if (key.startsWith(this.backupPrefix)) {
                    continue;
                }
                
                // Include jika di whitelist atau tidak di exclude
                if (this.protectedKeys.some(protected => 
                    key.startsWith(protected) || key === protected)) {
                    try {
                        const value = localStorage.getItem(key);
                        // Batasi ukuran per key
                        if (value && value.length < 500000) { // 500KB limit
                            backupData[key] = value;
                        }
                    } catch {
                        // Skip key yang error
                    }
                }
            }
            
            const backup = {
                timestamp: new Date().toISOString(),
                version: this.currentVersion,
                schemaVersion: this.schemaVersion,
                data: backupData,
                metadata: {
                    appliedMigrations: [...this.appliedMigrations],
                    totalKeys: Object.keys(backupData).length,
                    estimatedSize: JSON.stringify(backupData).length,
                    userAgent: navigator?.userAgent?.substring(0, 100) || 'Unknown',
                    isPWA: this.isPWA
                }
            };
            
            const backupKey = `${this.backupPrefix}${Date.now()}`;
            let backupPayload = JSON.stringify(backup);
            
            // Enkripsi backup jika tersedia
            if (this.backupEncrypted && this.encryption) {
                try {
                    backupPayload = await this.encryption.encrypt(backupPayload);
                    backupPayload = `ENC:${backupPayload}`;
                } catch (error) {
                    this.log('warn', 'Backup encryption failed, storing unencrypted', {
                        error: error.message
                    });
                }
            }
            
            // Simpan dengan error handling
            try {
                localStorage.setItem(backupKey, backupPayload);
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    // Hapus backup lama
                    await this.cleanupOldBackups(true);
                    
                    // Coba lagi
                    try {
                        localStorage.setItem(backupKey, backupPayload);
                    } catch (retryError) {
                        throw new Error('Storage quota exceeded');
                    }
                } else {
                    throw error;
                }
            }
            
            // Cleanup old backups
            await this.cleanupOldBackups();
            
            this.log('info', 'Backup created', {
                key: backupKey,
                size: backupPayload.length,
                keys: backup.metadata.totalKeys,
                encrypted: backupPayload.startsWith('ENC:')
            });
            
            return backupKey;
            
        } catch (error) {
            this.log('error', 'Failed to create backup', {
                error: error.message
            });
            return null;
        }
    }
    
    async restoreBackup(backupKey) {
        try {
            let backupPayload = localStorage.getItem(backupKey);
            
            if (!backupPayload) {
                throw new Error('Backup not found');
            }
            
            // Dekripsi jika perlu
            if (backupPayload.startsWith('ENC:') && this.encryption) {
                try {
                    backupPayload = await this.encryption.decrypt(
                        backupPayload.substring(4)
                    );
                } catch (error) {
                    throw new Error('Failed to decrypt backup');
                }
            }
            
            const backup = JSON.parse(backupPayload);
            
            // Validasi backup structure
            if (!backup.data || !backup.metadata) {
                throw new Error('Invalid backup structure');
            }
            
            // Backup current state dulu (safety net)
            const safetyBackupKey = await this.createBackup();
            
            // Clear relevant keys saja (jangan clear semua)
            for (const key of Object.keys(backup.data)) {
                localStorage.removeItem(key);
            }
            
            // Restore data
            let restored = 0;
            for (const [key, value] of Object.entries(backup.data)) {
                try {
                    localStorage.setItem(key, value);
                    restored++;
                } catch (error) {
                    this.log('warn', `Failed to restore key: ${key}`, {
                        error: error.message
                    });
                }
            }
            
            // Restore migration state
            if (backup.metadata.appliedMigrations) {
                this.appliedMigrations = new Set(backup.metadata.appliedMigrations);
                this.saveAppliedMigrations();
            }
            
            this.schemaVersion = backup.schemaVersion;
            
            this.log('info', 'Backup restored successfully', {
                key: backupKey,
                restored,
                total: Object.keys(backup.data).length
            });
            
            return true;
            
        } catch (error) {
            this.log('error', 'Failed to restore backup', {
                key: backupKey,
                error: error.message
            });
            return false;
        }
    }
    
    async cleanupOldBackups(urgent = false) {
        try {
            const backupKeys = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this.backupPrefix)) {
                    backupKeys.push(key);
                }
            }
            
            // Sort by timestamp (oldest first)
            backupKeys.sort();
            
            // Keep only N newest backups
            const maxKeep = urgent ? Math.max(1, this.maxBackups - 3) : this.maxBackups;
            
            while (backupKeys.length > maxKeep) {
                const oldestKey = backupKeys.shift();
                localStorage.removeItem(oldestKey);
            }
            
            if (backupKeys.length > 0 && urgent) {
                this.log('info', 'Cleaned up old backups', {
                    removed: backupKeys.length,
                    kept: maxKeep
                });
            }
        } catch (error) {
            this.log('warn', 'Failed to cleanup backups', {
                error: error.message
            });
        }
    }
    
    // ============================================
    // INTEGRITY CHECKING
    // ============================================
    
    async checkIntegrity() {
        const issues = [];
        const warnings = [];
        
        // Check required keys
        for (const key of this.protectedKeys.filter(k => !k.includes('_'))) {
            if (!localStorage.getItem(key)) {
                warnings.push({
                    type: 'missing_key',
                    key,
                    severity: 'warning',
                    message: `Recommended key "${key}" is missing`
                });
            }
        }
        
        // Check encrypted data integrity
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            if (value?.startsWith('ENC:') && this.encryption) {
                try {
                    await this.encryption.decrypt(value.substring(4));
                } catch {
                    issues.push({
                        type: 'corrupted_encrypted',
                        key,
                        severity: 'error',
                        message: `Encrypted data for "${key}" is corrupted`
                    });
                }
            }
            
            // Check JSON data validity
            if (value && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    JSON.parse(value);
                } catch {
                    warnings.push({
                        type: 'invalid_json',
                        key,
                        severity: 'warning',
                        message: `JSON data for "${key}" is malformed`
                    });
                }
            }
            
            // Check large values
            if (value && value.length > 1000000) { // 1MB
                warnings.push({
                    type: 'large_value',
                    key,
                    severity: 'warning',
                    message: `Key "${key}" is too large (${(value.length / 1000000).toFixed(2)}MB)`
                });
            }
        }
        
        // Check migration consistency
        const storedMigrations = this.getAppliedMigrations();
        if (storedMigrations.length !== this.appliedMigrations.size) {
            warnings.push({
                type: 'migration_mismatch',
                severity: 'warning',
                message: 'Applied migrations count mismatch'
            });
        }
        
        return {
            valid: issues.length === 0,
            issues: [...issues, ...warnings],
            criticalCount: issues.length,
            warningCount: warnings.length
        };
    }
    
    async repairCommonIssues() {
        const { issues } = await this.checkIntegrity();
        let repaired = 0;
        const failed = [];
        
        for (const issue of issues) {
            try {
                switch (issue.type) {
                    case 'missing_key':
                        await this.repairMissingKey(issue.key);
                        repaired++;
                        break;
                        
                    case 'corrupted_encrypted':
                        // Hapus data corrupted
                        localStorage.removeItem(issue.key);
                        repaired++;
                        break;
                        
                    case 'invalid_json':
                        // Reset ke default value
                        await this.resetToDefault(issue.key);
                        repaired++;
                        break;
                        
                    case 'large_value':
                        // Truncate atau compress
                        await this.compressLargeValue(issue.key);
                        repaired++;
                        break;
                        
                    case 'migration_mismatch':
                        // Rebuild migration state
                        this.saveAppliedMigrations();
                        repaired++;
                        break;
                }
            } catch (error) {
                failed.push({
                    issue: issue.type,
                    key: issue.key,
                    error: error.message
                });
            }
        }
        
        return { 
            repaired, 
            failed, 
            total: issues.length,
            success: failed.length === 0
        };
    }
    
    async repairMissingKey(key) {
        const defaults = {
            'app_settings': {
                theme: 'light',
                fontSize: 'normal',
                version: this.currentVersion
            },
            'recent_documents': '[]',
            'favorite_documents': '[]',
            'search_history': '[]',
            'form_drafts': '[]'
        };
        
        if (defaults[key]) {
            localStorage.setItem(key, 
                typeof defaults[key] === 'object' ? 
                JSON.stringify(defaults[key]) : 
                defaults[key]
            );
        }
    }
    
    async resetToDefault(key) {
        // Hapus key yang corrupt
        localStorage.removeItem(key);
    }
    
    async compressLargeValue(key) {
        const value = localStorage.getItem(key);
        if (!value) return;
        
        // Truncate jika array
        if (value.startsWith('[')) {
            try {
                const arr = JSON.parse(value);
                if (arr.length > 100) {
                    const compressed = arr.slice(-100); // Keep last 100 items
                    localStorage.setItem(key, JSON.stringify(compressed));
                }
            } catch {
                localStorage.removeItem(key);
            }
        }
    }
    
    // ============================================
    // PWA STORAGE MANAGEMENT
    // ============================================
    
    async setupPWAStorage() {
        if (!('indexedDB' in window)) return;
        
        try {
            const request = indexedDB.open('EArsipStorage', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Buat object store untuk data yang lebih besar
                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }
            };
            
            await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.log('debug', 'PWA IndexedDB storage initialized');
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
            });
            
        } catch (error) {
            this.log('warn', 'Failed to setup PWA storage', {
                error: error.message
            });
        }
    }
    
    async cleanupPWAStorage() {
        if (!('indexedDB' in window)) return;
        
        try {
            await new Promise((resolve, reject) => {
                const request = indexedDB.deleteDatabase('EArsipStorage');
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        } catch (error) {
            this.log('warn', 'Failed to cleanup PWA storage', {
                error: error.message
            });
        }
    }
    
    // ============================================
    // HELPER METHODS
    // ============================================
    
    async preflightCheck(migrations) {
        const errors = [];
        
        // Cek storage availability
        try {
            const testKey = '_migration_test_';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
        } catch {
            errors.push('LocalStorage not available');
        }
        
        // Cek storage quota
        if (navigator?.storage?.estimate) {
            const estimate = await navigator.storage.estimate();
            const usageRatio = estimate.usage / estimate.quota;
            
            if (usageRatio > 0.9) { // 90% used
                errors.push(`Storage almost full (${(usageRatio * 100).toFixed(1)}%)`);
            }
        }
        
        // Validasi setiap migration
        for (const migration of migrations) {
            if (migration.validate) {
                try {
                    const valid = await migration.validate();
                    if (!valid) {
                        errors.push(`Validation failed for migration ${migration.version}`);
                    }
                } catch (error) {
                    errors.push(`Validation error for ${migration.version}: ${error.message}`);
                }
            }
        }
        
        return {
            success: errors.length === 0,
            errors
        };
    }
    
    async migrateCacheFormat() {
        const cacheMigrations = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('cache_') && !key?.startsWith('cache_app_')) {
                cacheMigrations.push(key);
            }
        }
        
        for (const key of cacheMigrations) {
            try {
                const value = localStorage.getItem(key);
                const newKey = key.replace('cache_', 'cache_app_');
                localStorage.setItem(newKey, value);
                localStorage.removeItem(key);
            } catch (error) {
                this.log('warn', `Failed to migrate cache key: ${key}`, {
                    error: error.message
                });
            }
        }
        
        this.log('info', 'Cache format migration completed', {
            migrated: cacheMigrations.length
        });
    }
    
    loadAppliedMigrations() {
        try {
            const stored = localStorage.getItem('applied_migrations');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.appliedMigrations = new Set(parsed);
                this.schemaVersion = parsed.length > 0 ? 
                    parsed.sort().pop() : null;
            }
        } catch (error) {
            this.log('warn', 'Failed to load applied migrations', {
                error: error.message
            });
            this.appliedMigrations = new Set();
        }
    }
    
    saveAppliedMigrations() {
        try {
            const migrations = [...this.appliedMigrations].sort();
            localStorage.setItem(
                'applied_migrations',
                JSON.stringify(migrations)
            );
            this.schemaVersion = migrations.length > 0 ? 
                migrations[migrations.length - 1] : null;
        } catch (error) {
            this.log('error', 'Failed to save migration state', {
                error: error.message
            });
        }
    }
    
    async checkSchemaVersion() {
        const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
        this.schemaVersion = settings.version || this.schemaVersion;
    }
    
    dispatchMigrationEvent(type, migration) {
        if (typeof window === 'undefined') return;
        
        window.dispatchEvent(new CustomEvent('migration-event', {
            detail: {
                type,
                version: migration.version,
                name: migration.name,
                timestamp: new Date().toISOString()
            }
        }));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getVersion() {
        return this.currentVersion;
    }
    
    getSchemaVersion() {
        return this.schemaVersion;
    }
    
    getAppliedMigrations() {
        return [...this.appliedMigrations].sort();
    }
    
    getPendingMigrations() {
        return this.migrations
            .filter(m => !this.appliedMigrations.has(m.version))
            .map(m => ({
                version: m.version,
                name: m.name,
                description: m.description,
                critical: m.critical || false
            }));
    }
    
    getMigrationHistory() {
        return this.migrations.map(m => ({
            version: m.version,
            name: m.name,
            description: m.description,
            applied: this.appliedMigrations.has(m.version),
            critical: m.critical || false
        }));
    }
    
    async getStorageStats() {
        const stats = {
            localStorage: {
                totalKeys: localStorage.length,
                estimatedSize: 0,
                encryptedKeys: 0
            },
            appliedMigrations: this.appliedMigrations.size,
            pendingMigrations: this.getPendingMigrations().length,
            schemaVersion: this.schemaVersion
        };
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key) || '';
            stats.localStorage.estimatedSize += value.length;
            
            if (value.startsWith('ENC:')) {
                stats.localStorage.encryptedKeys++;
            }
        }
        
        stats.localStorage.estimatedSizeMB = 
            (stats.localStorage.estimatedSize / 1024 / 1024).toFixed(2);
        
        return stats;
    }
    
    async forceMigrate() {
        return this.migrate();
    }
    
    isMigrating() {
        return this.migrationLock;
    }
    
    destroy() {
        this.migrations = [];
        this.log('info', 'Migration helper destroyed');
    }
}

// Create singleton dengan delay inisialisasi
const migrationHelper = new MigrationHelper();

// Export
export default migrationHelper;
export { MigrationHelper };