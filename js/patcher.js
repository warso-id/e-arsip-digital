// js/patcher.js - Enterprise Auto-Fix & Recovery System 2026
/**
 * E-Arsip Digital - Advanced System Patcher
 * Version: 2026.1.0
 * Features: Automatic issue detection, safe repair with rollback,
 *           PWA cache management, IndexedDB repair, service worker recovery,
 *           storage optimization, session recovery
 * Security: Backup before patch, integrity verification, safe operations
 */

import APP_CONFIG from '../config/config.js';

class Patcher {
    constructor(options = {}) {
        // ✅ FIX: Lazy load dependencies
        this.logger = null;
        this.encryption = null;
        
        // Configuration
        this.config = {
            autoRunDelay: 2000,
            maxBackups: 3,
            enableRollback: true,
            enableIndexedDBRepair: true,
            enableSWRecovery: true,
            ...APP_CONFIG?.patcher,
            ...options
        };
        
        // Patches registry
        this.patches = [];
        
        // Fix history
        this.fixHistory = [];
        
        // Backup state
        this.backups = [];
        
        // Patch status
        this.isPatching = false;
        this.lastPatchTime = null;
        this.patchInProgress = null;
        
        // Storage safety
        this.protectedKeys = [
            'encryption_key',
            'master_key',
            'private_key',
            'csrf_token'
        ];
        
        // PWA support
        this.isPWA = this.detectPWA();
        this.swRegistration = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Init dependencies
            await this.initDependencies();
            
            // Load state
            await this.loadState();
            
            // Register patches
            this.registerDefaultPatches();
            
            // Setup PWA recovery
            if (this.isPWA && this.config.enableSWRecovery) {
                await this.setupServiceWorkerRecovery();
            }
            
            // Auto-run patches on startup
            if (this.config.autoRun !== false) {
                this.scheduleAutoPatch();
            }
            
            this.log('info', 'Patcher initialized', {
                patches: this.patches.length,
                historyCount: this.fixHistory.length,
                backupsCount: this.backups.length,
                isPWA: this.isPWA
            });
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('patcher:ready', {
                detail: { patcher: this }
            }));
            
        } catch (error) {
            console.error('Failed to initialize patcher:', error);
        }
    }
    
    async initDependencies() {
        // Lazy load Logger
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Patcher');
        } catch {
            this.logger = this.createFallbackLogger();
        }
        
        // Lazy load EncryptionService
        try {
            const encModule = await import('./security/encryption.js');
            this.encryption = new encModule.EncryptionService();
        } catch {
            this.encryption = null;
        }
    }
    
    // ============================================
    // LOGGING & UTILITIES
    // ============================================
    
    log(level, message, data = null) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](message, data);
        } else {
            const prefix = `[Patcher ${level.toUpperCase()}]`;
            const logFn = level === 'error' ? console.error :
                         level === 'warn' ? console.warn : console.info;
            logFn(`${prefix} ${message}`, data || '');
        }
    }
    
    createFallbackLogger() {
        return {
            debug: console.debug.bind(console, '[Patcher]'),
            info: console.info.bind(console, '[Patcher]'),
            warn: console.warn.bind(console, '[Patcher]'),
            error: console.error.bind(console, '[Patcher]')
        };
    }
    
    detectPWA() {
        return typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone
        );
    }
    
    async loadState() {
        try {
            const stored = localStorage.getItem('patcher_state');
            if (stored) {
                const state = JSON.parse(stored);
                this.fixHistory = state.fixHistory || [];
                this.backups = state.backups || [];
                this.lastPatchTime = state.lastPatchTime || null;
            }
        } catch {
            this.fixHistory = [];
            this.backups = [];
        }
    }
    
    async saveState() {
        try {
            const state = {
                fixHistory: this.fixHistory.slice(-50),
                backups: this.backups.slice(-this.config.maxBackups),
                lastPatchTime: this.lastPatchTime,
                version: '2026.1.0'
            };
            localStorage.setItem('patcher_state', JSON.stringify(state));
        } catch (error) {
            this.log('warn', 'Failed to save patcher state', {
                error: error.message
            });
        }
    }
    
    scheduleAutoPatch() {
        const runPatches = async () => {
            try {
                // Tunggu service worker jika PWA
                if (this.isPWA && 'serviceWorker' in navigator) {
                    await navigator.serviceWorker.ready;
                }
                
                await this.runAutoPatches();
            } catch (error) {
                this.log('error', 'Auto-patch failed', {
                    error: error.message
                });
            }
        };
        
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => runPatches(), { 
                timeout: this.config.autoRunDelay + 1000 
            });
        } else {
            setTimeout(runPatches, this.config.autoRunDelay);
        }
    }
    
    async setupServiceWorkerRecovery() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            this.swRegistration = registration;
            
            // Monitor service worker updates
            registration.addEventListener('updatefound', () => {
                this.log('info', 'Service Worker update found - may fix itself');
            });
            
        } catch (error) {
            this.log('warn', 'Service Worker not available for recovery');
        }
    }
    
    // ============================================
    // PATCH REGISTRY (dengan validasi)
    // ============================================
    
    registerPatch(patch) {
        // Validate patch structure
        if (!patch.id || !patch.detect || !patch.fix) {
            this.log('warn', 'Invalid patch registration', {
                id: patch.id || 'unknown'
            });
            return;
        }
        
        // Check duplicate
        if (this.patches.find(p => p.id === patch.id)) {
            this.log('warn', 'Duplicate patch ID', { id: patch.id });
            return;
        }
        
        this.patches.push({
            ...patch,
            registeredAt: Date.now()
        });
        
        // Sort by severity
        this.patches.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        });
    }
    
    registerDefaultPatches() {
        // Patch 1: Fix corrupted localStorage (Critical)
        this.registerPatch({
            id: 'fix_corrupted_storage',
            name: 'Fix Corrupted Storage',
            description: 'Detect and remove corrupted entries from localStorage',
            autoRun: true,
            severity: 'critical',
            category: 'storage',
            canRollback: false,
            detect: () => {
                const corrupted = [];
                const scanned = this.scanLocalStorage();
                
                scanned.forEach(({ key, value }) => {
                    // Check encrypted data
                    if (value?.startsWith('ENC:') && this.encryption) {
                        try {
                            // Simple validation - check if it's valid base64
                            const encoded = value.substring(4);
                            if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) {
                                corrupted.push({ key, type: 'invalid_encrypted' });
                            }
                        } catch {
                            corrupted.push({ key, type: 'corrupted_encrypted' });
                        }
                    }
                    
                    // Check JSON validity
                    const jsonKeys = [
                        'app_settings', 'user_preferences', 'recent_searches',
                        'export_history', 'audit_logs', 'applied_migrations',
                        'offline_pending_ops', 'offline_state'
                    ];
                    
                    if (jsonKeys.includes(key) && value) {
                        try {
                            JSON.parse(value);
                        } catch {
                            corrupted.push({ key, type: 'invalid_json' });
                        }
                    }
                });
                
                return corrupted.length > 0 ? { corrupted, count: corrupted.length } : null;
            },
            fix: () => {
                const fixed = [];
                const scanned = this.scanLocalStorage();
                
                scanned.forEach(({ key, value }) => {
                    // Fix corrupted encrypted data
                    if (value?.startsWith('ENC:')) {
                        const encoded = value.substring(4);
                        if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) {
                            try {
                                localStorage.removeItem(key);
                                fixed.push({ key, action: 'removed' });
                            } catch {
                                fixed.push({ key, action: 'failed' });
                            }
                        }
                    }
                    
                    // Fix corrupted JSON
                    const jsonKeys = [
                        'app_settings', 'user_preferences', 'recent_searches',
                        'export_history', 'audit_logs', 'applied_migrations',
                        'offline_pending_ops', 'offline_state'
                    ];
                    
                    if (jsonKeys.includes(key) && value) {
                        try {
                            JSON.parse(value);
                        } catch {
                            try {
                                localStorage.removeItem(key);
                                fixed.push({ key, action: 'removed' });
                            } catch {
                                fixed.push({ key, action: 'failed' });
                            }
                        }
                    }
                });
                
                return { fixed, count: fixed.length };
            }
        });
        
        // Patch 2: Clean expired cache (Low)
        this.registerPatch({
            id: 'fix_expired_cache',
            name: 'Clean Expired Cache',
            description: 'Remove expired cache entries to free storage',
            autoRun: true,
            severity: 'low',
            category: 'cache',
            canRollback: false,
            detect: () => {
                const expired = [];
                const now = Date.now();
                const cachePrefixes = ['cache_', 'api-cache_', 'cache_app_'];
                
                this.scanLocalStorage(cachePrefixes).forEach(({ key, value }) => {
                    try {
                        const entry = JSON.parse(value);
                        if (entry.expiresAt && now > entry.expiresAt) {
                            expired.push({ key, expiresAt: entry.expiresAt });
                        } else if (entry.timestamp && (now - entry.timestamp) > 86400000) {
                            expired.push({ key, age: now - entry.timestamp });
                        }
                    } catch {
                        // Corrupted cache entry
                        expired.push({ key, type: 'corrupted' });
                    }
                });
                
                return expired.length > 0 ? { expired, count: expired.length } : null;
            },
            fix: () => {
                const fixed = [];
                const now = Date.now();
                const cachePrefixes = ['cache_', 'api-cache_', 'cache_app_'];
                
                this.scanLocalStorage(cachePrefixes).forEach(({ key, value }) => {
                    let shouldRemove = false;
                    
                    try {
                        const entry = JSON.parse(value);
                        if (entry.expiresAt && now > entry.expiresAt) {
                            shouldRemove = true;
                        } else if (entry.timestamp && (now - entry.timestamp) > 604800000) {
                            shouldRemove = true;
                        }
                    } catch {
                        shouldRemove = true;
                    }
                    
                    if (shouldRemove) {
                        try {
                            localStorage.removeItem(key);
                            fixed.push({ key, action: 'removed' });
                        } catch {
                            fixed.push({ key, action: 'failed' });
                        }
                    }
                });
                
                return { fixed, count: fixed.length };
            }
        });
        
        // Patch 3: Restore default settings (Medium)
        this.registerPatch({
            id: 'fix_missing_settings',
            name: 'Restore Default Settings',
            description: 'Restore missing or corrupted application settings',
            autoRun: true,
            severity: 'medium',
            category: 'settings',
            canRollback: true,
            detect: () => {
                const settings = localStorage.getItem('app_settings');
                
                if (!settings) {
                    return { missing: true };
                }
                
                try {
                    const parsed = JSON.parse(settings);
                    const requiredKeys = ['theme', 'fontSize', 'language', 'version'];
                    const missing = requiredKeys.filter(k => !(k in parsed));
                    
                    return missing.length > 0 ? { 
                        missing: true, 
                        keys: missing,
                        currentKeys: Object.keys(parsed)
                    } : null;
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
                    version: APP_CONFIG.app?.version || '2026.1.0',
                    preferences: {
                        compactMode: false,
                        enableAnimations: true,
                        autoSave: true
                    }
                };
                
                let currentSettings = {};
                
                try {
                    const existing = localStorage.getItem('app_settings');
                    if (existing) {
                        currentSettings = JSON.parse(existing);
                    }
                } catch {
                    // Use defaults entirely
                }
                
                // Backup old settings
                if (Object.keys(currentSettings).length > 0) {
                    try {
                        localStorage.setItem(
                            `backup_settings_${Date.now()}`,
                            JSON.stringify(currentSettings)
                        );
                    } catch {}
                }
                
                // Merge with defaults (existing values take priority)
                const merged = { ...defaults, ...currentSettings };
                localStorage.setItem('app_settings', JSON.stringify(merged));
                
                return { restored: true, merged: !!Object.keys(currentSettings).length };
            }
        });
        
        // Patch 4: Fix duplicate session data (Medium)
        this.registerPatch({
            id: 'fix_session_conflicts',
            name: 'Resolve Session Conflicts',
            description: 'Detect and resolve conflicting session data',
            autoRun: true,
            severity: 'medium',
            category: 'session',
            canRollback: true,
            detect: () => {
                const issues = [];
                const sessionData = {};
                
                this.scanLocalStorage(['auth_', 'session_']).forEach(({ key, value }) => {
                    if (!sessionData[key]) {
                        sessionData[key] = [];
                    }
                    sessionData[key].push({ value, length: value?.length || 0 });
                });
                
                // Check for duplicates
                Object.entries(sessionData).forEach(([key, entries]) => {
                    if (entries.length > 1) {
                        issues.push({ key, type: 'duplicate', count: entries.length });
                    }
                });
                
                // Check partial session
                const hasAuthSession = !!localStorage.getItem('auth_session');
                const hasAuthToken = !!localStorage.getItem('auth_token');
                const hasRefreshToken = !!localStorage.getItem('auth_refresh_token');
                
                if (hasAuthSession && (!hasAuthToken || !hasRefreshToken)) {
                    issues.push({ type: 'partial_session', missing: 'tokens' });
                }
                
                if ((hasAuthToken || hasRefreshToken) && !hasAuthSession) {
                    issues.push({ type: 'partial_session', missing: 'session' });
                }
                
                return issues.length > 0 ? { issues, count: issues.length } : null;
            },
            fix: () => {
                const fixed = [];
                
                // Fix partial sessions
                const hasAuthSession = !!localStorage.getItem('auth_session');
                const hasAuthToken = !!localStorage.getItem('auth_token');
                const hasRefreshToken = !!localStorage.getItem('auth_refresh_token');
                
                if (!hasAuthSession && (hasAuthToken || hasRefreshToken)) {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_refresh_token');
                    sessionStorage.clear();
                    fixed.push({ action: 'cleared_tokens' });
                }
                
                if (hasAuthSession && (!hasAuthToken || !hasRefreshToken)) {
                    // Try to recover from session
                    try {
                        const session = JSON.parse(localStorage.getItem('auth_session'));
                        if (session?.tokens?.accessToken) {
                            localStorage.setItem('auth_token', session.tokens.accessToken);
                            fixed.push({ action: 'recovered_token' });
                        }
                        if (session?.tokens?.refreshToken) {
                            localStorage.setItem('auth_refresh_token', session.tokens.refreshToken);
                            fixed.push({ action: 'recovered_refresh_token' });
                        }
                    } catch {
                        localStorage.removeItem('auth_session');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_refresh_token');
                        sessionStorage.clear();
                        fixed.push({ action: 'cleared_all' });
                    }
                }
                
                return { fixed, count: fixed.length };
            }
        });
        
        // Patch 5: Optimize storage (Low)
        this.registerPatch({
            id: 'optimize_storage',
            name: 'Optimize Storage Usage',
            description: 'Reduce localStorage size by removing unnecessary data',
            autoRun: false,
            severity: 'low',
            category: 'optimization',
            canRollback: false,
            detect: () => {
                const estimate = this.estimateStorageUsage();
                const usagePercent = estimate.percentUsed;
                
                return usagePercent > 75 ? { 
                    usagePercent,
                    totalSize: estimate.totalSizeFormatted,
                    itemCount: estimate.itemCount
                } : null;
            },
            fix: () => {
                const freed = [];
                const now = Date.now();
                
                // Remove old backup files
                this.scanLocalStorage(['backup_', 'migration_backup_']).forEach(({ key }) => {
                    const timestamp = parseInt(key.replace(/[^0-9]/g, '') || '0');
                    if (now - timestamp > 604800000) { // 7 days
                        try {
                            localStorage.removeItem(key);
                            freed.push({ key, type: 'old_backup' });
                        } catch {}
                    }
                });
                
                // Remove old error logs
                try {
                    const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
                    if (errors.length > 50) {
                        localStorage.setItem('error_logs', JSON.stringify(errors.slice(-25)));
                        freed.push({ key: 'error_logs', type: 'trimmed' });
                    }
                } catch {
                    localStorage.removeItem('error_logs');
                    freed.push({ key: 'error_logs', type: 'removed' });
                }
                
                // Remove large items
                this.scanLocalStorage().forEach(({ key, value }) => {
                    if (value && value.length > 500000) { // 500KB
                        try {
                            const parsed = JSON.parse(value);
                            if (Array.isArray(parsed) && parsed.length > 100) {
                                localStorage.setItem(key, JSON.stringify(parsed.slice(-50)));
                                freed.push({ key, type: 'trimmed_array' });
                            }
                        } catch {}
                    }
                });
                
                return { freed, count: freed.length };
            }
        });
        
        // Patch 6: Session recovery (Critical)
        this.registerPatch({
            id: 'recover_session',
            name: 'Session Recovery',
            description: 'Attempt to recover corrupted or expired session',
            autoRun: true,
            severity: 'critical',
            category: 'session',
            canRollback: true,
            detect: () => {
                try {
                    const authSession = localStorage.getItem('auth_session');
                    
                    if (!authSession) return null;
                    
                    const session = JSON.parse(authSession);
                    
                    // Check expiration
                    if (session.expiresAt && Date.now() > session.expiresAt) {
                        return { expired: true, expiresAt: session.expiresAt };
                    }
                    
                    // Check structure
                    if (!session.user || !session.tokens) {
                        return { invalid: true, hasUser: !!session.user, hasTokens: !!session.tokens };
                    }
                    
                    // Check token validity (basic check)
                    if (session.tokens?.accessToken) {
                        try {
                            const tokenParts = session.tokens.accessToken.split('.');
                            if (tokenParts.length !== 3) {
                                return { invalidToken: true };
                            }
                        } catch {
                            return { invalidToken: true };
                        }
                    }
                    
                } catch {
                    return { corrupted: true };
                }
                
                return null;
            },
            fix: () => {
                try {
                    const authSession = localStorage.getItem('auth_session');
                    
                    if (!authSession) {
                        return { action: 'no_session' };
                    }
                    
                    const session = JSON.parse(authSession);
                    
                    // Check if expired - clear all auth data
                    if (session.expiresAt && Date.now() > session.expiresAt) {
                        localStorage.removeItem('auth_session');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_refresh_token');
                        sessionStorage.clear();
                        return { action: 'cleared_expired', redirectToLogin: true };
                    }
                    
                    // Check if invalid structure
                    if (!session.user || !session.tokens) {
                        localStorage.removeItem('auth_session');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_refresh_token');
                        sessionStorage.clear();
                        return { action: 'cleared_invalid', redirectToLogin: true };
                    }
                    
                    return { action: 'session_valid' };
                    
                } catch {
                    // Corrupted - clear all
                    localStorage.removeItem('auth_session');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_refresh_token');
                    sessionStorage.clear();
                    return { action: 'cleared_corrupted', redirectToLogin: true };
                }
            }
        });
        
        // Patch 7: PWA IndexedDB repair (Low - PWA only)
        if (this.isPWA && this.config.enableIndexedDBRepair) {
            this.registerPatch({
                id: 'repair_indexeddb',
                name: 'Repair IndexedDB',
                description: 'Check and repair IndexedDB databases',
                autoRun: true,
                severity: 'low',
                category: 'pwa',
                canRollback: false,
                detect: async () => {
                    if (!('indexedDB' in window)) return null;
                    
                    try {
                        const databases = await indexedDB.databases();
                        const issues = [];
                        
                        for (const db of databases) {
                            try {
                                await new Promise((resolve, reject) => {
                                    const request = indexedDB.open(db.name);
                                    request.onsuccess = (e) => {
                                        e.target.result.close();
                                        resolve();
                                    };
                                    request.onerror = () => reject(request.error);
                                    request.onblocked = () => {
                                        issues.push({ database: db.name, type: 'blocked' });
                                        resolve();
                                    };
                                });
                            } catch {
                                issues.push({ database: db.name, type: 'corrupted' });
                            }
                        }
                        
                        return issues.length > 0 ? { issues, count: issues.length } : null;
                    } catch {
                        return null;
                    }
                },
                fix: async () => {
                    if (!('indexedDB' in window)) return { fixed: 0 };
                    
                    const fixed = [];
                    
                    try {
                        const databases = await indexedDB.databases();
                        
                        for (const db of databases) {
                            try {
                                await new Promise((resolve, reject) => {
                                    const request = indexedDB.open(db.name);
                                    
                                    request.onblocked = () => {
                                        // Database blocked, try to close and delete
                                        request.result?.close();
                                        const deleteRequest = indexedDB.deleteDatabase(db.name);
                                        deleteRequest.onsuccess = () => {
                                            fixed.push({ database: db.name, action: 'deleted_blocked' });
                                            resolve();
                                        };
                                        deleteRequest.onerror = () => resolve();
                                    };
                                    
                                    request.onsuccess = (e) => {
                                        e.target.result.close();
                                        resolve();
                                    };
                                    
                                    request.onerror = () => {
                                        // Corrupted database, delete it
                                        const deleteRequest = indexedDB.deleteDatabase(db.name);
                                        deleteRequest.onsuccess = () => {
                                            fixed.push({ database: db.name, action: 'deleted_corrupted' });
                                            resolve();
                                        };
                                        deleteRequest.onerror = () => resolve();
                                    };
                                });
                            } catch {}
                        }
                    } catch {}
                    
                    return { fixed, count: fixed.length };
                }
            });
        }
        
        // Patch 8: Service Worker recovery (Critical - PWA only)
        if (this.isPWA) {
            this.registerPatch({
                id: 'recover_service_worker',
                name: 'Service Worker Recovery',
                description: 'Recover from corrupted or stuck service worker',
                autoRun: true,
                severity: 'critical',
                category: 'pwa',
                canRollback: false,
                detect: async () => {
                    if (!('serviceWorker' in navigator)) return null;
                    
                    try {
                        const registration = await navigator.serviceWorker.getRegistration();
                        
                        if (!registration) return null;
                        
                        const issues = [];
                        
                        // Check if waiting or installing for too long
                        if (registration.waiting) {
                            issues.push({ state: 'waiting' });
                        }
                        
                        if (registration.installing) {
                            issues.push({ state: 'installing' });
                        }
                        
                        // Check if active but not controlling
                        if (registration.active && !navigator.serviceWorker.controller) {
                            issues.push({ state: 'not_controlling' });
                        }
                        
                        return issues.length > 0 ? { issues, count: issues.length } : null;
                    } catch {
                        return null;
                    }
                },
                fix: async () => {
                    if (!('serviceWorker' in navigator)) return { fixed: 0 };
                    
                    const fixed = [];
                    
                    try {
                        const registration = await navigator.serviceWorker.getRegistration();
                        
                        if (!registration) return { fixed: 0 };
                        
                        // Update service worker
                        await registration.update();
                        fixed.push({ action: 'updated' });
                        
                        // If still having issues, unregister and re-register
                        if (registration.waiting || registration.installing) {
                            await registration.unregister();
                            fixed.push({ action: 'unregistered' });
                            
                            // Clear SW cache
                            if ('caches' in window) {
                                const cacheNames = await caches.keys();
                                await Promise.all(
                                    cacheNames.map(name => caches.delete(name))
                                );
                                fixed.push({ action: 'cleared_cache' });
                            }
                            
                            // Re-register
                            try {
                                const newReg = await navigator.serviceWorker.register('/sw.js');
                                fixed.push({ action: 're-registered', scope: newReg.scope });
                            } catch {}
                        }
                    } catch (error) {
                        fixed.push({ action: 'failed', error: error.message });
                    }
                    
                    return { fixed, count: fixed.length };
                }
            });
        }
    }
    
    // ============================================
    // SAFE STORAGE OPERATIONS
    // ============================================
    
    scanLocalStorage(prefixes = null) {
        const results = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Skip protected keys
            if (this.protectedKeys.includes(key)) continue;
            
            if (prefixes) {
                const matches = Array.isArray(prefixes) 
                    ? prefixes.some(p => key?.startsWith(p))
                    : key?.startsWith(prefixes);
                
                if (!matches) continue;
            }
            
            try {
                const value = localStorage.getItem(key);
                results.push({ key, value });
            } catch {
                results.push({ key, value: null, error: true });
            }
        }
        
        return results;
    }
    
    estimateStorageUsage() {
        let totalSize = 0;
        let itemCount = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key) || '';
            totalSize += (key?.length || 0) + value.length;
            itemCount++;
        }
        
        // Account for UTF-16 encoding (2 bytes per char)
        totalSize *= 2;
        
        // Assume minimum 5MB quota
        const assumedQuota = 5 * 1024 * 1024;
        
        return {
            itemCount,
            totalSize,
            totalSizeFormatted: this.formatBytes(totalSize),
            percentUsed: parseFloat(((totalSize / assumedQuota) * 100).toFixed(1))
        };
    }
    
    // ============================================
    // BACKUP & ROLLBACK
    // ============================================
    
    async createBackup(patchId) {
        if (!this.config.enableRollback) return null;
        
        try {
            const backup = {
                id: `backup_${Date.now()}`,
                patchId,
                timestamp: Date.now(),
                data: {}
            };
            
            // Backup relevant keys only
            const keysToBackup = [
                'app_settings', 'applied_migrations', 'auth_session',
                'auth_token', 'user_preferences', 'offline_state'
            ];
            
            keysToBackup.forEach(key => {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    backup.data[key] = value;
                }
            });
            
            // Store backup
            const backupKey = `patch_backup_${backup.id}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            
            this.backups.push(backup);
            this.cleanupOldBackups();
            
            await this.saveState();
            
            this.log('debug', 'Backup created', {
                backupId: backup.id,
                patchId,
                keys: Object.keys(backup.data).length
            });
            
            return backup;
        } catch (error) {
            this.log('warn', 'Failed to create backup', {
                error: error.message
            });
            return null;
        }
    }
    
    async rollback(patchId) {
        const backup = this.backups.find(b => b.patchId === patchId);
        
        if (!backup) {
            this.log('warn', 'No backup found for rollback', { patchId });
            return false;
        }
        
        try {
            // Restore backup data
            Object.entries(backup.data).forEach(([key, value]) => {
                if (value === null) {
                    localStorage.removeItem(key);
                } else {
                    localStorage.setItem(key, value);
                }
            });
            
            // Remove backup
            this.backups = this.backups.filter(b => b.id !== backup.id);
            localStorage.removeItem(`patch_backup_${backup.id}`);
            
            await this.saveState();
            
            this.log('info', 'Rollback successful', { patchId });
            
            return true;
        } catch (error) {
            this.log('error', 'Rollback failed', {
                patchId,
                error: error.message
            });
            return false;
        }
    }
    
    cleanupOldBackups() {
        while (this.backups.length > this.config.maxBackups) {
            const oldest = this.backups.shift();
            localStorage.removeItem(`patch_backup_${oldest.id}`);
        }
    }
    
    // ============================================
    // PATCH EXECUTION
    // ============================================
    
    async runAutoPatches() {
        if (this.isPatching) {
            this.log('warn', 'Patching already in progress');
            return;
        }
        
        this.isPatching = true;
        
        const autoPatches = this.patches.filter(p => p.autoRun);
        const results = [];
        
        this.log('info', 'Running auto patches', {
            count: autoPatches.length
        });
        
        for (const patch of autoPatches) {
            try {
                const result = await this.applyPatch(patch);
                results.push({
                    patchId: patch.id,
                    name: patch.name,
                    ...result
                });
            } catch (error) {
                this.log('error', 'Auto-patch failed', {
                    patch: patch.id,
                    error: error.message
                });
                
                results.push({
                    patchId: patch.id,
                    name: patch.name,
                    applied: false,
                    error: error.message
                });
            }
        }
        
        this.isPatching = false;
        this.lastPatchTime = Date.now();
        
        await this.saveState();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('patcher:complete', {
            detail: { results }
        }));
        
        return results;
    }
    
    async applyPatch(patch) {
        const startTime = performance.now();
        
        this.log('debug', 'Checking patch', {
            patch: patch.id,
            name: patch.name
        });
        
        // Detect issue
        let issue;
        try {
            issue = await patch.detect();
        } catch (error) {
            return {
                applied: false,
                error: `Detection failed: ${error.message}`,
                duration: performance.now() - startTime
            };
        }
        
        if (!issue) {
            return {
                applied: false,
                reason: 'No issue detected',
                duration: performance.now() - startTime
            };
        }
        
        this.log('info', 'Issue detected', {
            patch: patch.id,
            issue: typeof issue === 'object' ? 
                Object.keys(issue).filter(k => k !== 'corrupted' && k !== 'expired') : 
                issue
        });
        
        // Create backup if rollback enabled
        if (this.config.enableRollback && patch.canRollback) {
            await this.createBackup(patch.id);
        }
        
        // Apply fix
        let fixResult;
        try {
            fixResult = await patch.fix();
        } catch (error) {
            // Rollback if enabled
            if (this.config.enableRollback && patch.canRollback) {
                await this.rollback(patch.id);
            }
            
            return {
                applied: false,
                error: `Fix failed: ${error.message}`,
                rolledBack: this.config.enableRollback,
                duration: performance.now() - startTime
            };
        }
        
        // Record fix
        this.recordFix(patch.id, fixResult);
        
        this.log('info', 'Patch applied successfully', {
            patch: patch.id,
            result: fixResult
        });
        
        return {
            applied: true,
            issue,
            result: fixResult,
            duration: performance.now() - startTime
        };
    }
    
    async runPatch(patchId) {
        const patch = this.patches.find(p => p.id === patchId);
        
        if (!patch) {
            throw new Error(`Patch not found: ${patchId}`);
        }
        
        this.patchInProgress = patchId;
        const result = await this.applyPatch(patch);
        this.patchInProgress = null;
        
        return result;
    }
    
    async runAllPatches() {
        const results = [];
        
        for (const patch of this.patches) {
            const result = await this.runPatch(patch.id);
            results.push({
                patchId: patch.id,
                name: patch.name,
                severity: patch.severity,
                ...result
            });
        }
        
        this.lastPatchTime = Date.now();
        await this.saveState();
        
        return results;
    }
    
    // ============================================
    // DIAGNOSTICS
    // ============================================
    
    async runDiagnostics() {
        const issues = [];
        const patches = this.patches;
        
        for (const patch of patches) {
            try {
                const issue = await patch.detect();
                
                if (issue) {
                    issues.push({
                        patchId: patch.id,
                        name: patch.name,
                        description: patch.description,
                        severity: patch.severity,
                        category: patch.category,
                        autoRun: patch.autoRun,
                        canRollback: patch.canRollback,
                        issue: typeof issue === 'object' ? 
                            this.sanitizeIssue(issue) : issue
                    });
                }
            } catch (error) {
                issues.push({
                    patchId: patch.id,
                    name: patch.name,
                    severity: 'error',
                    issue: { error: error.message }
                });
            }
        }
        
        const storageInfo = this.estimateStorageUsage();
        
        // Add PWA diagnostics
        const pwaInfo = this.isPWA ? await this.getPWADiagnostics() : null;
        
        return {
            timestamp: new Date().toISOString(),
            totalPatches: patches.length,
            issuesFound: issues.length,
            issues,
            storage: storageInfo,
            pwa: pwaInfo,
            fixHistory: {
                total: this.fixHistory.length,
                lastFix: this.lastPatchTime
            }
        };
    }
    
    async getPWADiagnostics() {
        const info = {
            isPWA: true,
            serviceWorker: false,
            cacheStorage: false,
            backgroundSync: false
        };
        
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                info.serviceWorker = !!registration;
                info.swState = registration?.active?.state || 'none';
                info.swScope = registration?.scope || '';
                
                if (registration?.waiting) info.swWaiting = true;
                if (registration?.installing) info.swInstalling = true;
            } catch {}
        }
        
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                info.cacheStorage = true;
                info.cacheCount = cacheNames.length;
            } catch {}
        }
        
        if ('SyncManager' in window) {
            info.backgroundSync = true;
        }
        
        return info;
    }
    
    sanitizeIssue(issue) {
        // Remove large data dari issue object
        const sanitized = {};
        
        for (const [key, value] of Object.entries(issue)) {
            if (key === 'corrupted' && Array.isArray(value)) {
                sanitized[key] = value.length; // Just count
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeIssue(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    // ============================================
    // FIX HISTORY
    // ============================================
    
    recordFix(patchId, result) {
        this.fixHistory.push({
            patchId,
            result: typeof result === 'object' ? 
                { summary: Object.keys(result).filter(k => k !== 'fixed' && k !== 'corrupted') } : 
                result,
            timestamp: Date.now()
        });
        
        // Keep last 50 entries
        if (this.fixHistory.length > 50) {
            this.fixHistory = this.fixHistory.slice(-50);
        }
        
        this.saveState();
    }
    
    getFixHistory() {
        return [...this.fixHistory];
    }
    
    clearFixHistory() {
        this.fixHistory = [];
        this.saveState();
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
            severity: p.severity,
            category: p.category,
            autoRun: p.autoRun,
            canRollback: p.canRollback
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
    
    async rollbackPatch(patchId) {
        return this.rollback(patchId);
    }
    
    getStatus() {
        return {
            isPatching: this.isPatching,
            lastPatchTime: this.lastPatchTime,
            patchesAvailable: this.patches.length,
            historyCount: this.fixHistory.length,
            backupsCount: this.backups.length
        };
    }
    
    destroy() {
        this.patches = [];
        this.backups = [];
        this.fixHistory = [];
        
        // Cleanup backup keys
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith('patch_backup_')) {
                try {
                    localStorage.removeItem(key);
                } catch {}
            }
        }
        
        this.saveState();
        this.log('info', 'Patcher destroyed');
    }
}

// Create singleton
const patcher = new Patcher();

// Make available globally
if (typeof window !== 'undefined') {
    window.patcher = patcher;
}

export default patcher;
export { Patcher };