// js/offline.js - Enterprise Offline Support System 2026
/**
 * E-Arsip Digital - Advanced Offline Manager
 * Version: 2026.1.0
 * Features: Offline detection, encrypted queue, sync engine, conflict resolution,
 *           PWA service worker integration, storage management, background sync
 * Security: Encrypted local storage, data integrity checks, secure sync
 */

import APP_CONFIG from '../config/config.js';

class OfflineManager {
    constructor(options = {}) {
        // ✅ FIX: Lazy load dependencies
        this.logger = null;
        this.cache = null;
        this.notifications = null;
        this.encryption = null;
        
        // Configuration
        this.config = {
            syncInterval: 30000,
            maxRetries: 5,
            maxQueueSize: 200,
            maxStoragePercent: 80,
            enableEncryption: true,
            enableBackgroundSync: true,
            enableAutoSync: true,
            conflictStrategy: 'last-write-wins',
            ...APP_CONFIG?.offline,
            ...options
        };
        
        // State
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.wasOffline = false;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.syncErrors = 0;
        
        // Operation queue
        this.pendingOps = [];
        this.completedOps = [];
        this.failedOps = [];
        
        // Network quality monitoring
        this.connectionType = this.getConnectionType();
        this.connectionQuality = 'unknown';
        
        // Event listeners registry
        this.listeners = new Map();
        this.networkListeners = {};
        
        // Background sync
        this.bgSyncSupported = 'serviceWorker' in navigator && 'SyncManager' in window;
        
        // Storage monitoring
        this.storageWarningShown = false;
        
        // Integrity
        this.dataChecksums = new Map();
        
        this.init();
    }
    
    async init() {
        try {
            // Init dependencies
            await this.initDependencies();
            
            // Load state
            await this.loadState();
            
            // Setup listeners
            this.setupNetworkListeners();
            this.setupStorageMonitoring();
            this.setupPageVisibilityHandler();
            
            // Setup sync scheduler
            if (this.config.enableAutoSync) {
                this.setupSyncScheduler();
            }
            
            // Register background sync
            if (this.bgSyncSupported && this.config.enableBackgroundSync) {
                await this.registerBackgroundSync();
            }
            
            // Process pending ops dari session sebelumnya
            if (this.isOnline && this.pendingOps.length > 0) {
                this.syncPendingOps();
            }
            
            // Update UI
            this.updateOnlineStatus();
            
            this.log('info', 'Offline manager initialized', {
                online: this.isOnline,
                pendingOps: this.pendingOps.length,
                bgSync: this.bgSyncSupported,
                connectionType: this.connectionType
            });
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('offline:ready', {
                detail: { manager: this }
            }));
            
        } catch (error) {
            console.error('Failed to initialize offline manager:', error);
        }
    }
    
    async initDependencies() {
        // Lazy load Logger
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Offline');
        } catch {
            this.logger = this.createFallbackLogger();
        }
        
        // Lazy load CacheManager
        try {
            const cacheModule = await import('./cache.js');
            this.cache = new cacheModule.CacheManager('offline', {
                defaultTTL: 86400000,
                maxMemoryItems: 500
            });
        } catch {
            this.cache = this.createFallbackCache();
        }
        
        // Lazy load notifications
        try {
            const notifModule = await import('./notifications.js');
            this.notifications = notifModule.default;
        } catch {
            this.notifications = {
                success: (msg, opts) => console.log('[Offline]', msg),
                warning: (msg, opts) => console.warn('[Offline]', msg),
                error: (msg, opts) => console.error('[Offline]', msg),
                info: (msg, opts) => console.info('[Offline]', msg)
            };
        }
        
        // Lazy load encryption
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
            const prefix = `[Offline ${level.toUpperCase()}]`;
            const logFn = level === 'error' ? console.error :
                         level === 'warn' ? console.warn : console.info;
            logFn(`${prefix} ${message}`, data || '');
        }
    }
    
    createFallbackLogger() {
        return {
            debug: console.debug.bind(console, '[Offline]'),
            info: console.info.bind(console, '[Offline]'),
            warn: console.warn.bind(console, '[Offline]'),
            error: console.error.bind(console, '[Offline]')
        };
    }
    
    createFallbackCache() {
        const store = new Map();
        return {
            set: (key, value) => { store.set(key, value); return Promise.resolve(); },
            get: (key) => Promise.resolve(store.get(key)),
            remove: (key) => { store.delete(key); return Promise.resolve(); },
            clear: () => { store.clear(); return Promise.resolve(); },
            getStats: () => ({ size: store.size }),
            getKeys: () => [...store.keys()],
            destroy: () => store.clear()
        };
    }
    
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    
    async loadState() {
        try {
            const stored = localStorage.getItem('offline_state');
            if (stored) {
                let state;
                
                if (this.encryption && stored.startsWith('ENC:')) {
                    const decrypted = await this.encryption.decrypt(stored.substring(4));
                    state = JSON.parse(decrypted);
                } else {
                    state = JSON.parse(stored);
                }
                
                this.pendingOps = state.pendingOps || [];
                this.completedOps = state.completedOps || [];
                this.failedOps = state.failedOps || [];
                this.lastSyncTime = state.lastSyncTime || null;
                
                // Validate ops
                this.validateOps();
            }
        } catch (error) {
            this.log('warn', 'Failed to load state, starting fresh', {
                error: error.message
            });
            this.pendingOps = [];
            this.completedOps = [];
            this.failedOps = [];
        }
    }
    
    async saveState() {
        try {
            const state = {
                pendingOps: this.pendingOps.slice(0, this.config.maxQueueSize),
                completedOps: this.completedOps.slice(-50), // Keep last 50
                failedOps: this.failedOps.slice(-20), // Keep last 20
                lastSyncTime: this.lastSyncTime,
                version: '2026.1.0',
                savedAt: Date.now()
            };
            
            let payload = JSON.stringify(state);
            let checksum = this.generateChecksum(payload);
            
            // Encrypt jika tersedia
            if (this.config.enableEncryption && this.encryption) {
                try {
                    const encrypted = await this.encryption.encrypt(payload);
                    payload = `ENC:${encrypted}`;
                } catch (error) {
                    this.log('warn', 'Encryption failed, storing unencrypted');
                }
            }
            
            localStorage.setItem('offline_state', payload);
            localStorage.setItem('offline_state_checksum', checksum);
            
            this.dataChecksums.set('state', checksum);
            
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.handleQuotaExceeded();
            } else {
                this.log('error', 'Failed to save state', {
                    error: error.message
                });
            }
        }
    }
    
    validateOps() {
        // Remove corrupted ops
        this.pendingOps = this.pendingOps.filter(op => {
            return op && op.id && op.type && op.endpoint && 
                   typeof op.retries === 'number' && op.createdAt;
        });
        
        this.completedOps = this.completedOps.filter(op => op && op.id);
        this.failedOps = this.failedOps.filter(op => op && op.id);
    }
    
    generateChecksum(data) {
        // Simple checksum untuk data integrity
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }
    
    async verifyIntegrity() {
        try {
            const stored = localStorage.getItem('offline_state');
            const storedChecksum = localStorage.getItem('offline_state_checksum');
            
            if (stored && storedChecksum) {
                const payload = stored.startsWith('ENC:') ? 
                    stored.substring(4) : stored;
                const checksum = this.generateChecksum(payload);
                
                return checksum === storedChecksum;
            }
        } catch {
            return false;
        }
        
        return true; // No data to verify
    }
    
    // ============================================
    // NETWORK DETECTION
    // ============================================
    
    setupNetworkListeners() {
        this.networkListeners.online = async () => {
            this.isOnline = true;
            this.wasOffline = true;
            
            // Update connection info
            this.connectionType = this.getConnectionType();
            
            this.log('info', 'Network restored', {
                type: this.connectionType
            });
            
            // Show notification
            this.notifications.success('Koneksi internet kembali tersedia', {
                duration: 3000,
                title: '🟢 Online',
                id: 'online-notification'
            });
            
            // Sync pending operations
            await this.syncPendingOps();
            
            // Update UI
            this.updateOnlineStatus();
            
            // Dispatch events
            this.dispatchEvent('online', { 
                timestamp: Date.now(),
                connectionType: this.connectionType
            });
            window.dispatchEvent(new CustomEvent('app:online'));
        };
        
        this.networkListeners.offline = () => {
            this.isOnline = false;
            
            this.log('warn', 'Network lost');
            
            // Show notification
            this.notifications.warning(
                'Anda sedang offline. Perubahan akan disimpan secara lokal dan disinkronkan saat online kembali.',
                {
                    duration: 5000,
                    title: '🔴 Offline',
                    id: 'offline-notification'
                }
            );
            
            // Update UI
            this.updateOnlineStatus();
            
            // Dispatch events
            this.dispatchEvent('offline', { timestamp: Date.now() });
            window.dispatchEvent(new CustomEvent('app:offline'));
        };
        
        // Network quality monitoring
        this.networkListeners.connectionChange = () => {
            this.connectionType = this.getConnectionType();
            this.connectionQuality = this.estimateConnectionQuality();
            
            this.log('debug', 'Connection changed', {
                type: this.connectionType,
                quality: this.connectionQuality
            });
            
            // Adjust sync behavior based on quality
            if (this.connectionQuality === 'slow' && this.syncInProgress) {
                this.log('warn', 'Slow connection detected during sync');
            }
        };
        
        window.addEventListener('online', this.networkListeners.online);
        window.addEventListener('offline', this.networkListeners.offline);
        
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', 
                this.networkListeners.connectionChange);
        }
        
        // Initial status
        this.updateOnlineStatus();
    }
    
    getConnectionType() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            return {
                type: conn.type || 'unknown',
                effectiveType: conn.effectiveType || 'unknown',
                downlink: conn.downlink,
                rtt: conn.rtt,
                saveData: conn.saveData || false
            };
        }
        return { type: 'unknown', effectiveType: 'unknown', saveData: false };
    }
    
    estimateConnectionQuality() {
        const conn = this.getConnectionType();
        
        if (conn.saveData) return 'slow';
        
        switch (conn.effectiveType) {
            case 'slow-2g':
            case '2g':
                return 'very-slow';
            case '3g':
                return 'slow';
            case '4g':
                return conn.downlink > 5 ? 'fast' : 'medium';
            default:
                return 'unknown';
        }
    }
    
    updateOnlineStatus() {
        document.body.classList.toggle('offline', !this.isOnline);
        document.body.classList.toggle('online', this.isOnline);
        
        // Update connection quality class
        document.body.dataset.connectionQuality = this.connectionQuality;
        
        // Update status bar jika ada
        const statusBar = document.getElementById('connection-status');
        if (statusBar) {
            statusBar.textContent = this.isOnline ? 
                `🟢 Online (${this.connectionType.effectiveType})` : 
                '🔴 Offline';
            statusBar.className = this.isOnline ? 'status-online' : 'status-offline';
        }
    }
    
    setupPageVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline && this.wasOffline) {
                this.log('info', 'Page visible, checking sync');
                this.wasOffline = false;
                this.syncPendingOps();
            }
        });
    }
    
    // ============================================
    // STORAGE MONITORING
    // ============================================
    
    setupStorageMonitoring() {
        // Check storage periodically
        this.storageMonitorTimer = setInterval(async () => {
            await this.checkStorageQuota();
        }, 60000); // Every minute
        
        // Initial check
        this.checkStorageQuota();
    }
    
    async checkStorageQuota() {
        const estimate = await this.getStorageEstimate();
        
        if (estimate.isAvailable && estimate.percentUsed > this.config.maxStoragePercent) {
            if (!this.storageWarningShown) {
                this.storageWarningShown = true;
                
                this.notifications.warning(
                    `Penyimpanan hampir penuh (${estimate.percentUsed}%). Bersihkan data yang tidak diperlukan.`,
                    {
                        duration: 0,
                        title: '⚠️ Storage Warning',
                        id: 'storage-warning'
                    }
                );
                
                this.log('warn', 'Storage quota warning', estimate);
                
                // Auto cleanup
                await this.cleanupOldData();
            }
        } else if (estimate.percentUsed < this.config.maxStoragePercent - 20) {
            this.storageWarningShown = false;
        }
        
        return estimate;
    }
    
    async handleQuotaExceeded() {
        this.log('error', 'Storage quota exceeded, performing emergency cleanup');
        
        // Emergency cleanup
        this.pendingOps = this.pendingOps.slice(-50); // Keep last 50
        this.completedOps = [];
        this.failedOps = this.failedOps.slice(-5);
        
        // Clear old cache
        if (this.cache) {
            await this.cache.clear();
        }
        
        // Notify user
        this.notifications.error(
            'Penyimpanan penuh. Beberapa data offline telah dibersihkan.',
            {
                duration: 0,
                title: '🚨 Storage Full'
            }
        );
        
        // Try save again
        await this.saveState();
    }
    
    async cleanupOldData() {
        // Remove completed ops older than 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        this.completedOps = this.completedOps.filter(op => 
            op.completedAt && op.completedAt > sevenDaysAgo
        );
        
        // Remove failed ops older than 1 day
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.failedOps = this.failedOps.filter(op => 
            op.failedAt && op.failedAt > oneDayAgo
        );
        
        await this.saveState();
        
        this.log('info', 'Storage cleanup completed');
    }
    
    // ============================================
    // SYNC ENGINE
    // ============================================
    
    setupSyncScheduler() {
        this.syncTimer = setInterval(() => {
            if (this.isOnline && this.pendingOps.length > 0 && !this.syncInProgress) {
                // Check connection quality
                if (this.connectionQuality === 'very-slow') {
                    this.log('debug', 'Skipping sync due to very slow connection');
                    return;
                }
                
                this.syncPendingOps();
            }
        }, this.config.syncInterval);
    }
    
    async syncPendingOps() {
        if (this.syncInProgress || this.pendingOps.length === 0) return;
        
        this.syncInProgress = true;
        const syncStartTime = Date.now();
        
        this.log('info', 'Starting sync', {
            pendingCount: this.pendingOps.length,
            connectionQuality: this.connectionQuality
        });
        
        // Sort by priority
        const ops = [...this.pendingOps].sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        });
        
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        
        // Process ops dengan concurrency control
        const concurrency = this.connectionQuality === 'fast' ? 3 : 1;
        
        for (let i = 0; i < ops.length; i += concurrency) {
            const batch = ops.slice(i, i + concurrency);
            
            const results = await Promise.allSettled(
                batch.map(op => this.processOperation(op))
            );
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        successCount++;
                    } else {
                        failCount++;
                        errors.push({
                            opId: batch[index].id,
                            error: result.value.error
                        });
                    }
                } else {
                    failCount++;
                    errors.push({
                        opId: batch[index].id,
                        error: result.reason?.message || 'Unknown error'
                    });
                }
            });
        }
        
        this.syncInProgress = false;
        this.lastSyncTime = Date.now();
        
        const syncDuration = Date.now() - syncStartTime;
        
        // Save state
        await this.saveState();
        
        this.log('info', 'Sync completed', {
            success: successCount,
            failed: failCount,
            remaining: this.pendingOps.length,
            duration: `${syncDuration}ms`
        });
        
        if (successCount > 0 || failCount > 0) {
            this.dispatchEvent('synced', {
                successCount,
                failCount,
                errors: errors.slice(0, 10),
                duration: syncDuration
            });
        }
        
        // Reset error count on success
        if (successCount > 0 && failCount === 0) {
            this.syncErrors = 0;
        } else if (failCount > 0) {
            this.syncErrors++;
        }
        
        return { successCount, failCount, errors };
    }
    
    async processOperation(op) {
        try {
            // Check retry delay
            if (op.retries > 0 && op.lastRetryAt) {
                const delay = this.getRetryDelay(op.retries);
                const elapsed = Date.now() - op.lastRetryAt;
                
                if (elapsed < delay) {
                    // Skip, belum waktunya retry
                    return { success: false, error: 'Waiting for retry delay' };
                }
            }
            
            op.lastRetryAt = Date.now();
            
            // Execute operation
            const result = await this.executeOperation(op);
            
            if (result.success) {
                // Move to completed
                this.removePendingOp(op.id);
                this.completedOps.push({
                    ...op,
                    completedAt: Date.now()
                });
                
                this.log('debug', 'Operation completed', {
                    id: op.id,
                    type: op.type
                });
                
                return { success: true };
            } else {
                op.retries++;
                op.lastError = result.error;
                
                if (op.retries >= this.config.maxRetries) {
                    // Move to failed
                    this.removePendingOp(op.id);
                    this.failedOps.push({
                        ...op,
                        failedAt: Date.now()
                    });
                    
                    this.log('warn', 'Operation failed permanently', {
                        id: op.id,
                        type: op.type,
                        retries: op.retries
                    });
                    
                    return { success: false, error: result.error };
                } else {
                    this.updatePendingOp(op);
                    return { success: false, error: result.error };
                }
            }
        } catch (error) {
            op.retries++;
            op.lastError = error.message;
            
            if (op.retries >= this.config.maxRetries) {
                this.removePendingOp(op.id);
                this.failedOps.push({
                    ...op,
                    failedAt: Date.now()
                });
            } else {
                this.updatePendingOp(op);
            }
            
            return { success: false, error: error.message };
        }
    }
    
    async executeOperation(op) {
        try {
            let apiService;
            
            // Dynamic import API service
            try {
                const apiModule = await import('./api.js');
                apiService = apiModule.default || apiModule.api;
            } catch {
                // Fallback: use fetch directly
                apiService = this.createFallbackApi();
            }
            
            let response;
            
            switch (op.type) {
                case 'create':
                case 'post':
                    response = await apiService.post(op.endpoint, op.data);
                    break;
                    
                case 'update':
                case 'put':
                    response = await apiService.put(op.endpoint, op.data);
                    break;
                    
                case 'delete':
                    response = await apiService.delete(op.endpoint);
                    break;
                    
                case 'patch':
                    response = await apiService.patch(op.endpoint, op.data);
                    break;
                    
                case 'upload':
                    response = await apiService.uploadFile(
                        op.endpoint, 
                        op.file, 
                        op.options
                    );
                    break;
                    
                default:
                    throw new Error(`Unknown operation type: ${op.type}`);
            }
            
            return { success: true, data: response };
            
        } catch (error) {
            return { 
                success: false, 
                error: error.message,
                status: error.status || 0
            };
        }
    }
    
    createFallbackApi() {
        return {
            post: async (url, data) => {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            },
            put: async (url, data) => {
                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            },
            delete: async (url) => {
                const response = await fetch(url, { method: 'DELETE' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            },
            patch: async (url, data) => {
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            },
            uploadFile: async (url, file, options) => {
                const formData = new FormData();
                formData.append('file', file);
                if (options) {
                    Object.entries(options).forEach(([key, value]) => {
                        formData.append(key, value);
                    });
                }
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            }
        };
    }
    
    // ============================================
    // BACKGROUND SYNC (PWA)
    // ============================================
    
    async registerBackgroundSync() {
        if (!this.bgSyncSupported) return;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Register sync tags
            await registration.sync.register('offline-sync');
            
            this.log('info', 'Background sync registered');
            
            // Listen for sync events via message channel
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SYNC_COMPLETED') {
                    this.log('info', 'Background sync completed', event.data);
                    this.dispatchEvent('background-synced', event.data);
                }
            });
            
        } catch (error) {
            this.log('warn', 'Failed to register background sync', {
                error: error.message
            });
        }
    }
    
    // ============================================
    // OPERATION QUEUE MANAGEMENT
    // ============================================
    
    addPendingOp(type, endpoint, data = null, options = {}) {
        // Validate
        if (!type || !endpoint) {
            this.log('warn', 'Invalid operation', { type, endpoint });
            return null;
        }
        
        // Check queue size
        if (this.pendingOps.length >= this.config.maxQueueSize) {
            this.log('warn', 'Queue full, removing oldest operation');
            
            // Remove oldest low priority op
            const lowPriorityIndex = this.pendingOps.findIndex(op => 
                op.priority === 'low'
            );
            
            if (lowPriorityIndex !== -1) {
                const removed = this.pendingOps.splice(lowPriorityIndex, 1)[0];
                this.log('info', 'Removed low priority op', {
                    id: removed.id,
                    type: removed.type
                });
            } else {
                // Remove oldest normal priority
                const normalIndex = this.pendingOps.findIndex(op => 
                    op.priority === 'normal' || !op.priority
                );
                
                if (normalIndex !== -1) {
                    this.pendingOps.splice(normalIndex, 1);
                } else {
                    this.pendingOps.shift(); // Remove oldest
                }
            }
        }
        
        const op = {
            id: this.generateOpId(),
            type,
            endpoint: this.sanitizeEndpoint(endpoint),
            data: this.sanitizeData(data),
            options: options || {},
            retries: 0,
            lastError: null,
            lastRetryAt: null,
            createdAt: Date.now(),
            priority: options.priority || 'normal',
            checksum: null
        };
        
        // Generate checksum for data integrity
        if (data) {
            op.checksum = this.generateChecksum(JSON.stringify(data));
        }
        
        // Add based on priority
        if (op.priority === 'high') {
            this.pendingOps.unshift(op);
        } else if (op.priority === 'low') {
            this.pendingOps.push(op);
        } else {
            // Normal: insert before low priority
            const lastLowIndex = this.pendingOps.findLastIndex(o => o.priority === 'low');
            if (lastLowIndex !== -1) {
                this.pendingOps.splice(lastLowIndex, 0, op);
            } else {
                this.pendingOps.push(op);
            }
        }
        
        this.saveState();
        
        this.log('info', 'Operation queued', {
            id: op.id,
            type,
            priority: op.priority,
            endpoint: this.maskSensitiveEndpoint(endpoint),
            totalPending: this.pendingOps.length
        });
        
        // Try sync immediately if online and high priority
        if (this.isOnline && op.priority === 'high') {
            setTimeout(() => this.syncPendingOps(), 100);
        } else if (this.isOnline && !this.syncInProgress) {
            this.syncPendingOps();
        }
        
        return op.id;
    }
    
    removePendingOp(id) {
        const index = this.pendingOps.findIndex(op => op.id === id);
        if (index !== -1) {
            this.pendingOps.splice(index, 1);
            return true;
        }
        return false;
    }
    
    updatePendingOp(updatedOp) {
        const index = this.pendingOps.findIndex(op => op.id === updatedOp.id);
        if (index !== -1) {
            this.pendingOps[index] = updatedOp;
            this.saveState();
            return true;
        }
        return false;
    }
    
    retryFailedOps() {
        let count = 0;
        const now = Date.now();
        
        this.failedOps.forEach(op => {
            // Only retry if failed less than 1 hour ago
            if (op.failedAt && (now - op.failedAt) < 3600000) {
                op.retries = 0;
                op.lastError = null;
                op.lastRetryAt = null;
                this.pendingOps.push(op);
                count++;
            }
        });
        
        this.failedOps = this.failedOps.filter(op => {
            const isRetried = op.retries === 0;
            return !isRetried;
        });
        
        if (count > 0) {
            this.saveState();
            
            if (this.isOnline) {
                this.syncPendingOps();
            }
            
            this.log('info', 'Failed operations requeued', { count });
        }
        
        return count;
    }
    
    // ============================================
    // OFFLINE DATA CACHING
    // ============================================
    
    async cacheData(key, data, options = {}) {
        const config = {
            ttl: 3600000, // 1 hour default
            encrypt: this.config.enableEncryption,
            priority: 'normal',
            ...options
        };
        
        try {
            let cacheData = {
                value: data,
                timestamp: Date.now(),
                ttl: config.ttl,
                checksum: this.generateChecksum(JSON.stringify(data))
            };
            
            if (config.encrypt && this.encryption) {
                try {
                    const encrypted = await this.encryption.encrypt(
                        JSON.stringify(cacheData)
                    );
                    cacheData = { value: `ENC:${encrypted}`, encrypted: true };
                } catch {
                    // Store unencrypted
                }
            }
            
            return this.cache.set(key, cacheData, { ttl: config.ttl });
        } catch (error) {
            this.log('error', 'Failed to cache data', {
                key,
                error: error.message
            });
            return false;
        }
    }
    
    async getCachedData(key, options = {}) {
        try {
            const cached = await this.cache.get(key);
            
            if (!cached) return null;
            
            let data = cached;
            
            // Decrypt if needed
            if (data?.encrypted && data.value?.startsWith('ENC:') && this.encryption) {
                try {
                    const decrypted = await this.encryption.decrypt(
                        data.value.substring(4)
                    );
                    data = JSON.parse(decrypted);
                } catch {
                    return null; // Decryption failed
                }
            }
            
            // Verify integrity
            if (data?.checksum && data?.value && !data.encrypted) {
                const checksum = this.generateChecksum(JSON.stringify(data.value));
                if (checksum !== data.checksum && !options.skipIntegrityCheck) {
                    this.log('warn', 'Cache integrity check failed', { key });
                    await this.removeCachedData(key);
                    return null;
                }
            }
            
            return data.value ?? data;
        } catch (error) {
            this.log('error', 'Failed to get cached data', {
                key,
                error: error.message
            });
            return null;
        }
    }
    
    async removeCachedData(key) {
        return this.cache.remove(key);
    }
    
    async clearCache() {
        return this.cache.clear();
    }
    
    async getCacheInfo() {
        return {
            stats: this.cache.getStats(),
            keys: this.cache.getKeys()
        };
    }
    
    // ============================================
    // STORAGE ESTIMATION
    // ============================================
    
    async getStorageEstimate() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                
                // Request persistent storage untuk PWA
                if (this.isPWA() && estimate.quota < 1000000000) { // Less than 1GB
                    this.requestPersistentStorage();
                }
                
                return {
                    usage: estimate.usage,
                    quota: estimate.quota,
                    percentUsed: parseFloat(
                        ((estimate.usage / estimate.quota) * 100).toFixed(1)
                    ),
                    usageFormatted: this.formatBytes(estimate.usage),
                    quotaFormatted: this.formatBytes(estimate.quota),
                    isAvailable: true
                };
            } catch (error) {
                this.log('warn', 'Storage estimation failed', {
                    error: error.message
                });
            }
        }
        
        // Fallback: estimate based on localStorage
        return this.estimateLocalStorage();
    }
    
    estimateLocalStorage() {
        let totalSize = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += (key?.length || 0) + (value?.length || 0);
        }
        
        // Assume 5MB quota (browser minimum)
        const assumedQuota = 5 * 1024 * 1024;
        
        return {
            usage: totalSize * 2, // UTF-16 encoding
            quota: assumedQuota,
            percentUsed: parseFloat(((totalSize * 2 / assumedQuota) * 100).toFixed(1)),
            usageFormatted: this.formatBytes(totalSize * 2),
            quotaFormatted: this.formatBytes(assumedQuota),
            isAvailable: true
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async requestPersistentStorage() {
        if ('storage' in navigator && 'persist' in navigator.storage) {
            try {
                const isPersisted = await navigator.storage.persist();
                this.log('info', 'Persistent storage requested', {
                    granted: isPersisted
                });
                return isPersisted;
            } catch {
                return false;
            }
        }
        return false;
    }
    
    async hasStorageSpace(requiredBytes) {
        const estimate = await this.getStorageEstimate();
        
        if (!estimate.isAvailable) return true;
        
        return (estimate.quota - estimate.usage) > requiredBytes;
    }
    
    // ============================================
    // CONFLICT RESOLUTION
    // ============================================
    
    resolveConflict(localData, serverData, strategy = null) {
        const resolveStrategy = strategy || this.config.conflictStrategy;
        
        switch (resolveStrategy) {
            case 'last-write-wins':
                const localTime = new Date(localData.updatedAt || localData.timestamp || 0).getTime();
                const serverTime = new Date(serverData.updatedAt || serverData.timestamp || 0).getTime();
                
                if (localTime === serverTime) {
                    // If same time, prefer server
                    return { data: serverData, strategy: 'server-wins-tie' };
                }
                
                return {
                    data: localTime > serverTime ? localData : serverData,
                    strategy: localTime > serverTime ? 'client-wins' : 'server-wins'
                };
                
            case 'client-wins':
                return { data: localData, strategy: 'client-wins' };
                
            case 'server-wins':
                return { data: serverData, strategy: 'server-wins' };
                
            case 'merge-deep':
                return {
                    data: this.deepMerge(serverData, localData),
                    strategy: 'merge-deep'
                };
                
            case 'merge-shallow':
                return {
                    data: { ...serverData, ...localData },
                    strategy: 'merge-shallow'
                };
                
            case 'manual':
                return {
                    data: null,
                    strategy: 'manual',
                    local: localData,
                    server: serverData,
                    requiresResolution: true
                };
                
            default:
                return { data: serverData, strategy: 'default-server-wins' };
        }
    }
    
    deepMerge(target, source) {
        const output = { ...target };
        
        for (const key in source) {
            if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
                output[key] = this.deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        
        return output;
    }
    
    // ============================================
    // SANITIZATION & SECURITY
    // ============================================
    
    sanitizeEndpoint(endpoint) {
        if (!endpoint) return '';
        
        // Remove any potentially dangerous characters
        let sanitized = endpoint.replace(/[<>"'`]/g, '');
        
        // Ensure it starts with /
        if (!sanitized.startsWith('/') && !sanitized.startsWith('http')) {
            sanitized = '/' + sanitized;
        }
        
        // Limit length
        if (sanitized.length > 500) {
            sanitized = sanitized.substring(0, 500);
        }
        
        return sanitized;
    }
    
    sanitizeData(data) {
        if (!data) return data;
        
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'credit'];
        
        if (typeof data === 'object' && !Array.isArray(data)) {
            const sanitized = { ...data };
            sensitiveFields.forEach(field => {
                if (field in sanitized) {
                    sanitized[field] = '***REDACTED***';
                }
            });
            return sanitized;
        }
        
        return data;
    }
    
    maskSensitiveEndpoint(endpoint) {
        // Mask query parameters that might contain sensitive data
        return endpoint.replace(/([?&])(token|key|secret|password)=[^&]*/gi, '$1$2=***');
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        this.listeners.get(event).add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }
    
    dispatchEvent(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log('error', 'Event listener error', {
                        event,
                        error: error.message
                    });
                }
            });
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateOpId() {
        return `op_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`;
    }
    
    getRetryDelay(retries) {
        // Exponential backoff: 1s, 5s, 15s, 30s, 60s
        const delays = [1000, 5000, 15000, 30000, 60000];
        return delays[Math.min(retries, delays.length - 1)];
    }
    
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getStatus() {
        return {
            online: this.isOnline,
            pendingOps: this.pendingOps.length,
            completedOps: this.completedOps.length,
            failedOps: this.failedOps.length,
            syncInProgress: this.syncInProgress,
            lastSyncTime: this.lastSyncTime,
            connectionType: this.connectionType,
            connectionQuality: this.connectionQuality
        };
    }
    
    getPendingOps(filter = {}) {
        let ops = [...this.pendingOps];
        
        if (filter.type) {
            ops = ops.filter(op => op.type === filter.type);
        }
        
        if (filter.priority) {
            ops = ops.filter(op => op.priority === filter.priority);
        }
        
        return ops;
    }
    
    getPendingCount() {
        return this.pendingOps.length;
    }
    
    getFailedOps() {
        return [...this.failedOps];
    }
    
    clearPendingOps() {
        this.pendingOps = [];
        this.saveState();
        this.log('info', 'Pending operations cleared');
    }
    
    clearFailedOps() {
        this.failedOps = [];
        this.saveState();
        this.log('info', 'Failed operations cleared');
    }
    
    async forceSync() {
        if (!this.isOnline) {
            throw new Error('Cannot sync while offline');
        }
        
        return this.syncPendingOps();
    }
    
    async verifyDataIntegrity() {
        const stateValid = await this.verifyIntegrity();
        const cacheValid = true; // Cache has its own integrity checks
        
        return {
            valid: stateValid && cacheValid,
            state: stateValid,
            cache: cacheValid
        };
    }
    
    destroy() {
        // Cleanup timers
        if (this.syncTimer) clearInterval(this.syncTimer);
        if (this.storageMonitorTimer) clearInterval(this.storageMonitorTimer);
        
        // Remove event listeners
        window.removeEventListener('online', this.networkListeners.online);
        window.removeEventListener('offline', this.networkListeners.offline);
        
        if ('connection' in navigator && this.networkListeners.connectionChange) {
            navigator.connection.removeEventListener('change', 
                this.networkListeners.connectionChange);
        }
        
        // Final save
        this.saveState();
        
        // Clear state
        this.listeners.clear();
        
        // Destroy cache
        if (this.cache && typeof this.cache.destroy === 'function') {
            this.cache.destroy();
        }
        
        this.log('info', 'Offline manager destroyed');
    }
}

// Create singleton
const offlineManager = new OfflineManager();

// Make available globally untuk debugging
if (typeof window !== 'undefined') {
    window.offlineManager = offlineManager;
}

export default offlineManager;
export { OfflineManager };