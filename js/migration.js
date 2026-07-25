// js/migration.js - Data Migration Helper 2026
/**
 * E-Arsip Digital - Migration Helper
 * Version: 2026.1.0
 * Features: Schema versioning, data migration, rollback support,
 *           integrity checking, backup before migration
 */

import { Logger } from './logger.js';
import { EncryptionService } from './security/encryption.js';

class MigrationHelper {
    constructor() {
        this.logger = new Logger('Migration');
        this.encryption = new EncryptionService();
        
        // Migration history
        this.migrations = [];
        this.appliedMigrations = new Set();
        
        // Current schema version
        this.currentVersion = '2026.1.0';
        
        this.init();
    }
    
    init() {
        this.loadAppliedMigrations();
        this.registerMigrations();
        
        this.logger.info('Migration helper initialized', {
            currentVersion: this.currentVersion,
            appliedCount: this.appliedMigrations.size
        });
    }
    
    // ============================================
    // MIGRATION REGISTRY
    // ============================================
    
    registerMigrations() {
        // Migration: v1.0.0 -> v2024.1.0
        this.registerMigration({
            version: '2024.1.0',
            name: 'Initial Schema',
            description: 'Create initial data structures',
            up: async () => {
                // Set default settings
                const defaults = {
                    theme: 'light',
                    fontSize: 'normal',
                    language: 'id',
                    notifications: true
                };
                
                if (!localStorage.getItem('app_settings')) {
                    localStorage.setItem('app_settings', JSON.stringify(defaults));
                }
                
                return true;
            },
            down: async () => {
                localStorage.removeItem('app_settings');
                return true;
            }
        });
        
        // Migration: v2024.1.0 -> v2025.1.0
        this.registerMigration({
            version: '2025.1.0',
            name: 'Enhanced Security Schema',
            description: 'Add encryption to stored data',
            up: async () => {
                // Encrypt existing sensitive data
                const keysToEncrypt = ['auth_session', 'auth_token', 'user_preferences'];
                
                for (const key of keysToEncrypt) {
                    const value = localStorage.getItem(key);
                    if (value && !value.startsWith('ENC:')) {
                        const encrypted = await this.encryption.encrypt(value);
                        localStorage.setItem(key, `ENC:${encrypted}`);
                    }
                }
                
                return true;
            },
            down: async () => {
                const keysToDecrypt = ['auth_session', 'auth_token', 'user_preferences'];
                
                for (const key of keysToDecrypt) {
                    const value = localStorage.getItem(key);
                    if (value?.startsWith('ENC:')) {
                        const decrypted = await this.encryption.decrypt(value.substring(4));
                        localStorage.setItem(key, decrypted);
                    }
                }
                
                return true;
            }
        });
        
        // Migration: v2025.1.0 -> v2026.1.0
        this.registerMigration({
            version: '2026.1.0',
            name: 'Modern Schema Update',
            description: 'Update to 2026 schema with new features',
            up: async () => {
                // Add new settings
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
                    offlineMode: true
                };
                localStorage.setItem('app_settings', JSON.stringify(settings));
                
                // Migrate old cache format
                const cachePrefix = 'cache_';
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('cache_') && !key?.startsWith('cache_app_')) {
                        keys.push(key);
                    }
                }
                
                keys.forEach(key => {
                    try {
                        const value = localStorage.getItem(key);
                        const newKey = key.replace('cache_', 'cache_app_');
                        localStorage.setItem(newKey, value);
                        localStorage.removeItem(key);
                    } catch (e) {
                        // Skip problematic entries
                    }
                });
                
                return true;
            },
            down: async () => {
                const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
                delete settings.features;
                delete settings.version;
                localStorage.setItem('app_settings', JSON.stringify(settings));
                return true;
            }
        });
    }
    
    registerMigration(migration) {
        this.migrations.push(migration);
    }
    
    // ============================================
    // MIGRATION EXECUTION
    // ============================================
    
    async migrate(targetVersion = null) {
        const target = targetVersion || this.currentVersion;
        
        // Sort migrations by version
        const pending = this.migrations
            .filter(m => !this.appliedMigrations.has(m.version))
            .sort((a, b) => a.version.localeCompare(b.version));
        
        if (pending.length === 0) {
            this.logger.info('No pending migrations');
            return { success: true, applied: 0 };
        }
        
        this.logger.info('Starting migrations', {
            pending: pending.length,
            versions: pending.map(m => m.version)
        });
        
        // Create backup before migration
        await this.createBackup();
        
        let applied = 0;
        
        for (const migration of pending) {
            try {
                this.logger.info('Applying migration', {
                    version: migration.version,
                    name: migration.name
                });
                
                const result = await migration.up();
                
                if (result) {
                    this.appliedMigrations.add(migration.version);
                    this.saveAppliedMigrations();
                    applied++;
                    
                    this.logger.info('Migration applied', { version: migration.version });
                }
            } catch (error) {
                this.logger.error('Migration failed', {
                    version: migration.version,
                    error: error.message
                });
                
                // Attempt rollback
                await this.rollback(migration.version);
                
                return {
                    success: false,
                    applied,
                    failedAt: migration.version,
                    error: error.message
                };
            }
        }
        
        return { success: true, applied };
    }
    
    async rollback(targetVersion) {
        const migration = this.migrations.find(m => m.version === targetVersion);
        
        if (!migration) {
            this.logger.warn('No migration found for rollback', { version: targetVersion });
            return false;
        }
        
        if (!this.appliedMigrations.has(targetVersion)) {
            this.logger.warn('Migration not applied, cannot rollback', { version: targetVersion });
            return false;
        }
        
        try {
            this.logger.info('Rolling back migration', { version: targetVersion });
            
            await migration.down();
            
            this.appliedMigrations.delete(targetVersion);
            this.saveAppliedMigrations();
            
            this.logger.info('Migration rolled back', { version: targetVersion });
            
            return true;
        } catch (error) {
            this.logger.error('Rollback failed', {
                version: targetVersion,
                error: error.message
            });
            
            return false;
        }
    }
    
    async rollbackAll() {
        const applied = [...this.appliedMigrations]
            .sort((a, b) => b.localeCompare(a)); // Reverse order
        
        for (const version of applied) {
            await this.rollback(version);
        }
    }
    
    // ============================================
    // BACKUP
    // ============================================
    
    async createBackup() {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                version: this.currentVersion,
                localStorage: { ...localStorage },
                sessionStorage: { ...sessionStorage },
                appliedMigrations: [...this.appliedMigrations]
            };
            
            const backupKey = `migration_backup_${Date.now()}`;
            const encrypted = await this.encryption.encrypt(JSON.stringify(backup));
            
            localStorage.setItem(backupKey, encrypted);
            
            // Keep only last 5 backups
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('migration_backup_')) {
                    backupKeys.push(key);
                }
            }
            
            backupKeys.sort();
            while (backupKeys.length > 5) {
                localStorage.removeItem(backupKeys.shift());
            }
            
            this.logger.info('Migration backup created', { key: backupKey });
            
            return backupKey;
        } catch (error) {
            this.logger.error('Failed to create backup', error);
            return null;
        }
    }
    
    async restoreBackup(backupKey) {
        try {
            const encrypted = localStorage.getItem(backupKey);
            if (!encrypted) return false;
            
            const decrypted = await this.encryption.decrypt(encrypted);
            const backup = JSON.parse(decrypted);
            
            // Restore localStorage
            localStorage.clear();
            Object.entries(backup.localStorage).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });
            
            // Restore migration state
            this.appliedMigrations = new Set(backup.appliedMigrations);
            this.saveAppliedMigrations();
            
            this.logger.info('Backup restored', { key: backupKey });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to restore backup', error);
            return false;
        }
    }
    
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    
    loadAppliedMigrations() {
        try {
            const stored = localStorage.getItem('applied_migrations');
            if (stored) {
                this.appliedMigrations = new Set(JSON.parse(stored));
            }
        } catch {
            this.appliedMigrations = new Set();
        }
    }
    
    saveAppliedMigrations() {
        try {
            localStorage.setItem(
                'applied_migrations',
                JSON.stringify([...this.appliedMigrations])
            );
        } catch {
            // Ignore
        }
    }
    
    // ============================================
    // INTEGRITY CHECK
    // ============================================
    
    async checkIntegrity() {
        const issues = [];
        
        // Check required localStorage keys
        const requiredKeys = ['app_settings', 'applied_migrations'];
        for (const key of requiredKeys) {
            if (!localStorage.getItem(key)) {
                issues.push({
                    type: 'missing_key',
                    key,
                    severity: 'warning',
                    message: `Required key "${key}" is missing`
                });
            }
        }
        
        // Check for corrupted data
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key?.startsWith('ENC:')) {
                const value = localStorage.getItem(key);
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
        }
        
        return {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            issues
        };
    }
    
    async repairCommonIssues() {
        const { issues } = await this.checkIntegrity();
        let repaired = 0;
        
        for (const issue of issues) {
            if (issue.type === 'missing_key') {
                if (issue.key === 'app_settings') {
                    localStorage.setItem('app_settings', JSON.stringify({
                        theme: 'light',
                        fontSize: 'normal',
                        version: this.currentVersion
                    }));
                    repaired++;
                }
            } else if (issue.type === 'corrupted_encrypted') {
                localStorage.removeItem(issue.key);
                repaired++;
            }
        }
        
        return { repaired, total: issues.length };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getVersion() {
        return this.currentVersion;
    }
    
    getAppliedMigrations() {
        return [...this.appliedMigrations];
    }
    
    getPendingMigrations() {
        return this.migrations
            .filter(m => !this.appliedMigrations.has(m.version))
            .map(m => ({ version: m.version, name: m.name, description: m.description }));
    }
    
    getMigrationHistory() {
        return this.migrations.map(m => ({
            version: m.version,
            name: m.name,
            description: m.description,
            applied: this.appliedMigrations.has(m.version)
        }));
    }
    
    async forceMigrate() {
        return this.migrate();
    }
    
    destroy() {
        this.migrations = [];
        this.logger.info('Migration helper destroyed');
    }
}

// Create singleton
const migration = new MigrationHelper();

// Auto-migrate on load
setTimeout(() => {
    migration.migrate().then(result => {
        if (!result.success) {
            console.warn('Migration failed:', result);
        }
    });
}, 1000);

export default migration;
export { MigrationHelper };