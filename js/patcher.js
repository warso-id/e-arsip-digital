// js/patcher.js - Auto-Fix Common Issues 2026
/**
 * E-Arsip Digital - Auto-Fix Patcher
 * Version: 2026.1.0
 * Features: Automatic issue detection and repair,
 *           localStorage cleanup, session recovery,
 *           cache invalidation, dependency repair
 */

import { Logger } from './logger.js';

class Patcher {
    constructor() {
        this.logger = new Logger('Patcher');
        
        // Patch definitions
        this.patches = [];
        
        // Fix history
        this.fixHistory = this.loadFixHistory();
        
        // Register default patches
        this.registerDefaultPatches();
        
        this.init();
    }
    
    init() {
        // Auto-run patches on startup
        setTimeout(() => {
            this.runAutoPatches();
        }, 2000);
        
        this.logger.info('Patcher initialized', {
            patches: this.patches.length,
            historyCount: this.fixHistory.length
        });
    }
    
    // ============================================
    // PATCH REGISTRY
    // ============================================
    
    registerPatch(patch) {
        this.patches.push(patch);
    }
    
    registerDefaultPatches() {
        // Patch 1: Fix corrupted localStorage
        this.registerPatch({
            id: 'fix_corrupted_storage',
            name: 'Fix Corrupted Storage',
            description: 'Remove corrupted entries from localStorage',
            autoRun: true,
            severity: 'high',
            detect: () => {
                let corrupted = 0;
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    
                    if (key?.startsWith('ENC:')) {
                        try {
                            const value = localStorage.getItem(key);
                            atob(value.substring(4));
                        } catch {
                            corrupted++;
                        }
                    }
                    
                    // Check JSON validity for known JSON keys
                    const jsonKeys = ['app_settings', 'user_preferences', 'recent_searches',
                                      'export_history', 'audit_logs', 'applied_migrations'];
                    
                    if (jsonKeys.includes(key)) {
                        try {
                            JSON.parse(localStorage.getItem(key));
                        } catch {
                            corrupted++;
                        }
                    }
                }
                
                return corrupted > 0 ? { corrupted } : null;
            },
            fix: () => {
                let fixed = 0;
                
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    
                    // Remove corrupted encrypted data
                    if (key?.startsWith('ENC:')) {
                        try {
                            const value = localStorage.getItem(key);
                            atob(value.substring(4));
                        } catch {
                            localStorage.removeItem(key);
                            fixed++;
                        }
                    }
                    
                    // Remove corrupted JSON data
                    const jsonKeys = ['app_settings', 'user_preferences', 'recent_searches',
                                      'export_history', 'audit_logs', 'applied_migrations'];
                    
                    if (jsonKeys.includes(key)) {
                        try {
                            JSON.parse(localStorage.getItem(key));
                        } catch {
                            localStorage.removeItem(key);
                            fixed++;
                        }
                    }
                }
                
                return { fixed };
            }
        });
        
        // Patch 2: Fix expired cache
        this.registerPatch({
            id: 'fix_expired_cache',
            name: 'Clean Expired Cache',
            description: 'Remove expired cache entries',
            autoRun: true,
            severity: 'low',
            detect: () => {
                let expired = 0;
                const prefix = 'cache_';
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    
                    if (key?.startsWith(prefix)) {
                        try {
                            const entry = JSON.parse(localStorage.getItem(key));
                            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                                expired++;
                            }
                        } catch {
                            expired++;
                        }
                    }
                }
                
                return expired > 0 ? { expired } : null;
            },
            fix: () => {
                let fixed = 0;
                const prefix = 'cache_';
                
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    
                    if (key?.startsWith(prefix)) {
                        try {
                            const entry = JSON.parse(localStorage.getItem(key));
                            if (!entry.expiresAt || Date.now() > entry.expiresAt) {
                                localStorage.removeItem(key);
                                fixed++;
                            }
                        } catch {
                            localStorage.removeItem(key);
                            fixed++;
                        }
                    }
                }
                
                return { fixed };
            }
        });
        
        // Patch 3: Fix missing default settings
        this.registerPatch({
            id: 'fix_missing_settings',
            name: 'Restore Default Settings',
            description: 'Restore missing default application settings',
            autoRun: true,
            severity: 'medium',
            detect: () => {
                const settings = localStorage.getItem('app_settings');
                
                if (!settings) {
                    return { missing: true };
                }
                
                try {
                    const parsed = JSON.parse(settings);
                    const requiredKeys = ['theme', 'fontSize', 'language'];
                    const missing = requiredKeys.filter(k => !(k in parsed));
                    
                    return missing.length > 0 ? { missing: true, keys: missing } : null;
                } catch {
                    return { missing: true, corrupted: true };
                }
            },
            fix: () => {
                const defaults = {
                    theme: 'light',
                    fontSize: 'normal',
                    language: 'id',
                    notifications: true,
                    autoBackup: true,
                    version: '2026.1.0'
                };
                
                let settings = {};
                
                try {
                    const existing = localStorage.getItem('app_settings');
                    if (existing) {
                        settings = JSON.parse(existing);
                    }
                } catch {
                    // Use defaults
                }
                
                // Merge with defaults (existing values take priority)
                const merged = { ...defaults, ...settings };
                localStorage.setItem('app_settings', JSON.stringify(merged));
                
                return { restored: true };
            }
        });
        
        // Patch 4: Fix duplicate session data
        this.registerPatch({
            id: 'fix_duplicate_sessions',
            name: 'Clean Duplicate Sessions',
            description: 'Remove duplicate session entries',
            autoRun: true,
            severity: 'low',
            detect: () => {
                const sessionKeys = [];
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('auth_') || key?.startsWith('session_')) {
                        sessionKeys.push(key);
                    }
                }
                
                const duplicates = sessionKeys.filter((key, index) => 
                    sessionKeys.indexOf(key) !== index
                );
                
                return duplicates.length > 0 ? { duplicates: duplicates.length } : null;
            },
            fix: () => {
                const seen = new Set();
                let removed = 0;
                
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    
                    if (key?.startsWith('auth_') || key?.startsWith('session_')) {
                        if (seen.has(key)) {
                            localStorage.removeItem(key);
                            removed++;
                        } else {
                            seen.add(key);
                        }
                    }
                }
                
                return { removed };
            }
        });
        
        // Patch 5: Fix large localStorage
        this.registerPatch({
            id: 'fix_large_storage',
            name: 'Optimize Storage Size',
            description: 'Reduce localStorage size by removing old data',
            autoRun: false,
            severity: 'low',
            detect: () => {
                let totalSize = 0;
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    const value = localStorage.getItem(key);
                    totalSize += (key.length + value.length) * 2;
                }
                
                const limitMB = 5 * 1024 * 1024; // 5MB
                const usagePercent = (totalSize / limitMB) * 100;
                
                return usagePercent > 80 ? { usagePercent: usagePercent.toFixed(1) } : null;
            },
            fix: () => {
                let freed = 0;
                
                // Remove old cache entries first
                const cachePrefixes = ['cache_', 'api-cache_'];
                
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    
                    if (cachePrefixes.some(p => key?.startsWith(p))) {
                        try {
                            const entry = JSON.parse(localStorage.getItem(key));
                            const age = Date.now() - (entry.timestamp || 0);
                            
                            if (age > 86400000) { // Older than 1 day
                                freed += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
                                localStorage.removeItem(key);
                            }
                        } catch {
                            freed += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
                            localStorage.removeItem(key);
                        }
                    }
                }
                
                // Remove old backups
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    
                    if (key?.startsWith('migration_backup_')) {
                        const age = Date.now() - parseInt(key.replace('migration_backup_', '') || '0');
                        
                        if (isNaN(age) || age > 604800000) { // Older than 7 days
                            freed += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
                            localStorage.removeItem(key);
                        }
                    }
                }
                
                return { 
                    freedBytes: freed,
                    freedFormatted: this.formatBytes(freed)
                };
            }
        });
        
        // Patch 6: Fix session recovery
        this.registerPatch({
            id: 'fix_session_recovery',
            name: 'Session Recovery',
            description: 'Attempt to recover corrupted session data',
            autoRun: true,
            severity: 'high',
            detect: () => {
                const authSession = localStorage.getItem('auth_session');
                const authToken = localStorage.getItem('auth_token');
                
                // Has partial session data
                if ((authSession && !authToken) || (!authSession && authToken)) {
                    return { partial: true };
                }
                
                // Check session validity
                if (authSession) {
                    try {
                        const parsed = JSON.parse(authSession);
                        if (!parsed.user || !parsed.tokens) {
                            return { invalid: true };
                        }
                    } catch {
                        return { corrupted: true };
                    }
                }
                
                return null;
            },
            fix: () => {
                const authSession = localStorage.getItem('auth_session');
                const authToken = localStorage.getItem('auth_token');
                
                // If partial or corrupted, clear all auth data
                if ((authSession && !authToken) || (!authSession && authToken)) {
                    localStorage.removeItem('auth_session');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_refresh_token');
                    sessionStorage.clear();
                    
                    return { cleared: true, action: 'redirect_to_login' };
                }
                
                // Try to repair session
                if (authSession) {
                    try {
                        JSON.parse(authSession);
                    } catch {
                        localStorage.removeItem('auth_session');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_refresh_token');
                        
                        return { cleared: true, action: 'redirect_to_login' };
                    }
                }
                
                return { noAction: true };
            }
        });
    }
    
    // ============================================
    // PATCH EXECUTION
    // ============================================
    
    async runAutoPatches() {
        const autoPatches = this.patches.filter(p => p.autoRun);
        
        for (const patch of autoPatches) {
            try {
                const issue = patch.detect();
                
                if (issue) {
                    this.logger.info('Issue detected', {
                        patch: patch.id,
                        issue
                    });
                    
                    const result = patch.fix();
                    
                    this.recordFix(patch.id, result);
                    
                    this.logger.info('Patch applied', {
                        patch: patch.id,
                        result
                    });
                }
            } catch (error) {
                this.logger.error('Patch failed', {
                    patch: patch.id,
                    error: error.message
                });
            }
        }
    }
    
    async runPatch(patchId) {
        const patch = this.patches.find(p => p.id === patchId);
        
        if (!patch) {
            throw new Error(`Patch not found: ${patchId}`);
        }
        
        const issue = patch.detect();
        
        if (!issue) {
            return { applied: false, reason: 'No issue detected' };
        }
        
        const result = patch.fix();
        this.recordFix(patchId, result);
        
        return { applied: true, issue, result };
    }
    
    async runAllPatches() {
        const results = [];
        
        for (const patch of this.patches) {
            const result = await this.runPatch(patch.id);
            results.push({
                patchId: patch.id,
                name: patch.name,
                ...result
            });
        }
        
        return results;
    }
    
    // ============================================
    // DIAGNOSTICS
    // ============================================
    
    async runDiagnostics() {
        const issues = [];
        
        for (const patch of this.patches) {
            try {
                const issue = patch.detect();
                
                if (issue) {
                    issues.push({
                        patchId: patch.id,
                        name: patch.name,
                        description: patch.description,
                        severity: patch.severity,
                        issue,
                        autoFix: patch.autoRun
                    });
                }
            } catch (error) {
                issues.push({
                    patchId: patch.id,
                    name: patch.name,
                    severity: 'error',
                    issue: { error: error.message },
                    autoFix: false
                });
            }
        }
        
        return {
            timestamp: new Date().toISOString(),
            totalPatches: this.patches.length,
            issuesFound: issues.length,
            issues,
            storage: this.getStorageInfo()
        };
    }
    
    getStorageInfo() {
        let totalSize = 0;
        let itemCount = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += (key.length + value.length) * 2;
            itemCount++;
        }
        
        return {
            itemCount,
            totalSize,
            totalSizeFormatted: this.formatBytes(totalSize),
            quotaEstimate: navigator.storage?.estimate ? 'available' : 'unavailable'
        };
    }
    
    // ============================================
    // FIX HISTORY
    // ============================================
    
    recordFix(patchId, result) {
        this.fixHistory.push({
            patchId,
            result,
            timestamp: Date.now()
        });
        
        // Keep only last 50 entries
        if (this.fixHistory.length > 50) {
            this.fixHistory = this.fixHistory.slice(-50);
        }
        
        this.saveFixHistory();
    }
    
    loadFixHistory() {
        try {
            const stored = localStorage.getItem('fix_history');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }
    
    saveFixHistory() {
        try {
            localStorage.setItem('fix_history', JSON.stringify(this.fixHistory));
        } catch {
            // Ignore
        }
    }
    
    getFixHistory() {
        return [...this.fixHistory];
    }
    
    clearFixHistory() {
        this.fixHistory = [];
        localStorage.removeItem('fix_history');
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    getPatches() {
        return this.patches.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            autoRun: p.autoRun,
            severity: p.severity
        }));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    async fixAll() {
        return this.runAllPatches();
    }
    
    async diagnose() {
        return this.runDiagnostics();
    }
    
    async repair(patchId) {
        return this.runPatch(patchId);
    }
    
    destroy() {
        this.patches = [];
        this.logger.info('Patcher destroyed');
    }
}

// Create singleton
const patcher = new Patcher();

// Expose globally
window.patcher = patcher;

export default patcher;
export { Patcher };