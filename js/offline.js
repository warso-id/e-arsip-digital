// js/offline.js - Offline Support Module 2026
/**
 * E-Arsip Digital - Offline Support
 * Version: 2026.1.0
 * Features: Offline detection, data synchronization, queue management,
 *           conflict resolution, storage estimation
 */

import { Logger } from './logger.js';
import { CacheManager } from './cache.js';
import notifications from './notifications.js';

class OfflineManager {
    constructor() {
        this.logger = new Logger('Offline');
        
        // State
        this.isOnline = navigator.onLine;
        this.wasOffline = false;
        this.syncInProgress = false;
        
        // Offline cache
        this.cache = new CacheManager('offline', {
            defaultTTL: 86400000, // 24 hours
            maxMemoryItems: 500
        });
        
        // Pending operations queue
        this.pendingOps = this.loadPendingOps();
        
        // Sync configuration
        this.syncInterval = 30000; // 30 seconds
        this.maxRetries = 5;
        this.retryDelays = [1000, 5000, 15000, 30000, 60000];
        
        // Event listeners
        this.listeners = new Map();
        
        this.init();
    }
    
    init() {
        this.setupNetworkListeners();
        this.setupSyncScheduler();
        this.setupPageVisibilityHandler();
        
        // Process any pending operations from previous session
        if (this.isOnline && this.pendingOps.length > 0) {
            this.syncPendingOps();
        }
        
        this.logger.info('Offline manager initialized', {
            online: this.isOnline,
            pendingOps: this.pendingOps.length
        });
    }
    
    // ============================================
    // NETWORK DETECTION
    // ============================================
    
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.wasOffline = true;
            
            this.logger.info('Network connection restored');
            
            // Notify user
            notifications.success('Koneksi internet kembali', {
                duration: 3000,
                title: 'Online'
            });
            
            // Sync pending operations
            this.syncPendingOps();
            
            // Dispatch events
            this.dispatchEvent('online', { timestamp: Date.now() });
            window.dispatchEvent(new CustomEvent('app:online'));
            
            // Update body class
            document.body.classList.remove('offline');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            
            this.logger.warn('Network connection lost');
            
            // Notify user
            notifications.warning('Koneksi internet terputus. Data akan disimpan secara lokal.', {
                duration: 0,
                title: 'Offline'
            });
            
            // Dispatch events
            this.dispatchEvent('offline', { timestamp: Date.now() });
            window.dispatchEvent(new CustomEvent('app:offline'));
            
            // Update body class
            document.body.classList.add('offline');
        });
        
        // Update body class initially
        if (!this.isOnline) {
            document.body.classList.add('offline');
        }
    }
    
    setupPageVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline && this.wasOffline) {
                this.wasOffline = false;
                this.syncPendingOps();
            }
        });
    }
    
    // ============================================
    // SYNC SCHEDULER
    // ============================================
    
    setupSyncScheduler() {
        this.syncTimer = setInterval(() => {
            if (this.isOnline && this.pendingOps.length > 0 && !this.syncInProgress) {
                this.syncPendingOps();
            }
        }, this.syncInterval);
    }
    
    async syncPendingOps() {
        if (this.syncInProgress || this.pendingOps.length === 0) return;
        
        this.syncInProgress = true;
        this.logger.info('Starting sync', { pendingCount: this.pendingOps.length });
        
        const ops = [...this.pendingOps];
        let successCount = 0;
        let failCount = 0;
        
        for (const op of ops) {
            try {
                const result = await this.executeOperation(op);
                
                if (result.success) {
                    this.removePendingOp(op.id);
                    successCount++;
                } else {
                    op.retries++;
                    
                    if (op.retries >= this.maxRetries) {
                        this.removePendingOp(op.id);
                        failCount++;
                        
                        this.logger.warn('Operation failed permanently', {
                            id: op.id,
                            type: op.type
                        });
                    } else {
                        op.lastError = result.error;
                        this.updatePendingOp(op);
                    }
                }
            } catch (error) {
                op.retries++;
                op.lastError = error.message;
                
                if (op.retries >= this.maxRetries) {
                    this.removePendingOp(op.id);
                    failCount++;
                } else {
                    this.updatePendingOp(op);
                }
            }
        }
        
        this.syncInProgress = false;
        
        this.logger.info('Sync completed', {
            success: successCount,
            failed: failCount,
            remaining: this.pendingOps.length
        });
        
        if (successCount > 0) {
            this.dispatchEvent('synced', { successCount, failCount });
        }
    }
    
    async executeOperation(op) {
        const { apiService } = await import('./api.js');
        
        switch (op.type) {
            case 'create':
                return apiService.post(op.endpoint, op.data);
            case 'update':
                return apiService.put(op.endpoint, op.data);
            case 'delete':
                return apiService.delete(op.endpoint);
            case 'upload':
                return apiService.uploadFile(op.endpoint, op.file, op.options);
            default:
                throw new Error(`Unknown operation type: ${op.type}`);
        }
    }
    
    // ============================================
    // OPERATION QUEUE
    // ============================================
    
    addPendingOp(type, endpoint, data = null, options = {}) {
        const op = {
            id: this.generateOpId(),
            type,
            endpoint,
            data,
            options,
            retries: 0,
            lastError: null,
            createdAt: Date.now(),
            priority: options.priority || 'normal'
        };
        
        // Add based on priority
        if (op.priority === 'high') {
            this.pendingOps.unshift(op);
        } else {
            this.pendingOps.push(op);
        }
        
        this.savePendingOps();
        
        this.logger.info('Operation queued', {
            id: op.id,
            type,
            endpoint,
            totalPending: this.pendingOps.length
        });
        
        // Try to sync immediately if online
        if (this.isOnline) {
            this.syncPendingOps();
        }
        
        return op.id;
    }
    
    removePendingOp(id) {
        const index = this.pendingOps.findIndex(op => op.id === id);
        if (index !== -1) {
            this.pendingOps.splice(index, 1);
            this.savePendingOps();
        }
    }
    
    updatePendingOp(updatedOp) {
        const index = this.pendingOps.findIndex(op => op.id === updatedOp.id);
        if (index !== -1) {
            this.pendingOps[index] = updatedOp;
            this.savePendingOps();
        }
    }
    
    loadPendingOps() {
        try {
            const stored = localStorage.getItem('offline_pending_ops');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }
    
    savePendingOps() {
        try {
            localStorage.setItem('offline_pending_ops', 
                JSON.stringify(this.pendingOps.slice(0, 100)));
        } catch (error) {
            this.logger.warn('Failed to save pending ops', error);
        }
    }
    
    getPendingOps() {
        return [...this.pendingOps];
    }
    
    getPendingCount() {
        return this.pendingOps.length;
    }
    
    clearPendingOps() {
        this.pendingOps = [];
        localStorage.removeItem('offline_pending_ops');
        this.logger.info('Pending operations cleared');
    }
    
    // ============================================
    // OFFLINE DATA CACHING
    // ============================================
    
    async cacheData(key, data, ttl = 3600000) {
        return this.cache.set(key, data, { ttl });
    }
    
    async getCachedData(key) {
        return this.cache.get(key);
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
                return {
                    usage: estimate.usage,
                    quota: estimate.quota,
                    percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1),
                    isAvailable: true
                };
            } catch (error) {
                this.logger.warn('Storage estimation failed', error);
            }
        }
        
        return {
            usage: 0,
            quota: 0,
            percentUsed: '0.0',
            isAvailable: false
        };
    }
    
    async hasStorageSpace(requiredBytes) {
        const estimate = await this.getStorageEstimate();
        
        if (!estimate.isAvailable) return true; // Can't check, assume yes
        
        return (estimate.quota - estimate.usage) > requiredBytes;
    }
    
    // ============================================
    // CONFLICT RESOLUTION
    // ============================================
    
    resolveConflict(localData, serverData, strategy = 'last-write-wins') {
        switch (strategy) {
            case 'last-write-wins':
                const localTime = new Date(localData.updatedAt).getTime();
                const serverTime = new Date(serverData.updatedAt).getTime();
                return localTime > serverTime ? localData : serverData;
                
            case 'client-wins':
                return localData;
                
            case 'server-wins':
                return serverData;
                
            case 'merge':
                return { ...serverData, ...localData };
                
            default:
                return serverData;
        }
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        this.listeners.get(event).add(callback);
        
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
                    this.logger.error('Event listener error', error);
                }
            });
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateOpId() {
        return `op_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    getRetryDelay(retries) {
        return this.retryDelays[Math.min(retries, this.retryDelays.length - 1)];
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getStatus() {
        return {
            online: this.isOnline,
            pendingOps: this.pendingOps.length,
            syncInProgress: this.syncInProgress
        };
    }
    
    async forceSync() {
        if (!this.isOnline) {
            throw new Error('Cannot sync while offline');
        }
        
        return this.syncPendingOps();
    }
    
    destroy() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        this.cache.destroy();
        this.listeners.clear();
        this.logger.info('Offline manager destroyed');
    }
}

// Create singleton
const offlineManager = new OfflineManager();

// Make available globally
window.offlineManager = offlineManager;

export default offlineManager;
export { OfflineManager };