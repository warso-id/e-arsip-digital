// js/security/secure-storage.js - Secure Browser Storage 2026
/**
 * E-Arsip Digital - Secure Browser Storage
 * Version: 2026.1.0
 * Features: Encrypted localStorage/sessionStorage wrapper, TTL support,
 *           quota management, cross-tab sync
 */

import { Logger } from '../logger.js';
import { EncryptionService } from './encryption.js';

class SecureStorage {
    constructor(options = {}) {
        this.logger = new Logger('SecureStorage');
        this.encryption = new EncryptionService();
        
        this.config = {
            prefix: 'secure_',
            encryptByDefault: true,
            defaultTTL: 3600000, // 1 hour
            quotaLimit: 5242880, // 5MB
            ...options
        };
        
        // Storage event listeners for cross-tab sync
        this.listeners = new Map();
        
        this.init();
    }
    
    init() {
        this.setupCrossTabSync();
        this.logger.info('Secure storage initialized');
    }
    
    // ============================================
    // CORE STORAGE METHODS
    // ============================================
    
    async set(key, value, options = {}) {
        const config = {
            encrypt: this.config.encryptByDefault,
            ttl: this.config.defaultTTL,
            storage: 'localStorage',
            ...options
        };
        
        try {
            const prefixedKey = this.prefixKey(key);
            
            // Prepare storage data
            let storageData = {
                value,
                timestamp: Date.now(),
                ttl: config.ttl
            };
            
            // Encrypt if needed
            if (config.encrypt) {
                const jsonData = JSON.stringify(storageData);
                storageData = {
                    _encrypted: true,
                    data: await this.encryption.encrypt(jsonData)
                };
            }
            
            // Check quota before storing
            if (!this.hasQuota(JSON.stringify(storageData).length)) {
                throw new Error('Storage quota exceeded');
            }
            
            // Store
            const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
            storage.setItem(prefixedKey, JSON.stringify(storageData));
            
            // Broadcast to other tabs
            this.broadcast('set', { key: prefixedKey });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to set secure storage', error);
            return false;
        }
    }
    
    async get(key, options = {}) {
        const config = {
            storage: 'localStorage',
            ...options
        };
        
        try {
            const prefixedKey = this.prefixKey(key);
            const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
            const rawData = storage.getItem(prefixedKey);
            
            if (!rawData) return null;
            
            const parsedData = JSON.parse(rawData);
            
            // Handle encrypted data
            if (parsedData._encrypted) {
                const decrypted = await this.encryption.decrypt(parsedData.data);
                parsedData.value = JSON.parse(decrypted).value;
            }
            
            // Check TTL
            if (parsedData.ttl && parsedData.timestamp) {
                const age = Date.now() - parsedData.timestamp;
                if (age > parsedData.ttl) {
                    this.remove(key, config);
                    return null;
                }
            }
            
            return parsedData.value;
        } catch (error) {
            this.logger.error('Failed to get secure storage', error);
            return null;
        }
    }
    
    remove(key, options = {}) {
        const config = {
            storage: 'localStorage',
            ...options
        };
        
        const prefixedKey = this.prefixKey(key);
        const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
        storage.removeItem(prefixedKey);
        
        this.broadcast('remove', { key: prefixedKey });
    }
    
    clear(options = {}) {
        const config = {
            storage: 'localStorage',
            prefix: this.config.prefix,
            ...options
        };
        
        const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
        
        for (let i = storage.length - 1; i >= 0; i--) {
            const key = storage.key(i);
            if (key.startsWith(config.prefix)) {
                storage.removeItem(key);
            }
        }
        
        this.broadcast('clear', { prefix: config.prefix });
    }
    
    async keys(options = {}) {
        const config = {
            storage: 'localStorage',
            ...options
        };
        
        const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
        const keys = [];
        
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key.startsWith(this.config.prefix)) {
                keys.push(this.unprefixKey(key));
            }
        }
        
        return keys;
    }
    
    async has(key, options = {}) {
        const value = await this.get(key, options);
        return value !== null;
    }
    
    // ============================================
    // BULK OPERATIONS
    // ============================================
    
    async setMany(entries, options = {}) {
        const results = [];
        
        for (const [key, value] of Object.entries(entries)) {
            const result = await this.set(key, value, options);
            results.push({ key, success: result });
        }
        
        return results;
    }
    
    async getMany(keys, options = {}) {
        const results = {};
        
        for (const key of keys) {
            results[key] = await this.get(key, options);
        }
        
        return results;
    }
    
    async getAll(options = {}) {
        const allKeys = await this.keys(options);
        return this.getMany(allKeys, options);
    }
    
    // ============================================
    // QUOTA MANAGEMENT
    // ============================================
    
    hasQuota(additionalBytes = 0) {
        try {
            const currentUsage = this.getStorageUsage();
            const total = currentUsage + additionalBytes;
            
            return total <= this.config.quotaLimit;
        } catch {
            return true; // If we can't check, allow
        }
    }
    
    getStorageUsage() {
        let total = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.config.prefix)) {
                const value = localStorage.getItem(key);
                total += (key.length + value.length) * 2; // UTF-16
            }
        }
        
        return total;
    }
    
    getStorageQuota() {
        return this.config.quotaLimit;
    }
    
    getStorageInfo() {
        const usage = this.getStorageUsage();
        const quota = this.config.quotaLimit;
        
        return {
            usage,
            quota,
            available: quota - usage,
            percentUsed: ((usage / quota) * 100).toFixed(1),
            items: this.countItems()
        };
    }
    
    countItems() {
        let count = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).startsWith(this.config.prefix)) {
                count++;
            }
        }
        
        return count;
    }
    
    cleanup() {
        // Remove expired items
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            
            if (key.startsWith(this.config.prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    
                    if (data.timestamp && data.ttl) {
                        const age = Date.now() - data.timestamp;
                        if (age > data.ttl) {
                            localStorage.removeItem(key);
                        }
                    }
                } catch {
                    // Remove corrupted data
                    localStorage.removeItem(key);
                }
            }
        }
        
        this.logger.info('Storage cleanup completed');
    }
    
    // ============================================
    // CROSS-TAB SYNCHRONIZATION
    // ============================================
    
    setupCrossTabSync() {
        window.addEventListener('storage', (event) => {
            if (event.key?.startsWith(this.config.prefix)) {
                const unprefixedKey = this.unprefixKey(event.key);
                
                if (event.newValue === null) {
                    this.notifyListeners('remove', unprefixedKey, null);
                } else {
                    try {
                        const data = JSON.parse(event.newValue);
                        this.notifyListeners('change', unprefixedKey, data);
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        });
        
        // BroadcastChannel for same-origin tabs
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('secure-storage-sync');
            
            this.channel.onmessage = (event) => {
                const { action, key } = event.data;
                
                if (action === 'set') {
                    this.notifyListeners('external_set', this.unprefixKey(key), null);
                } else if (action === 'remove') {
                    this.notifyListeners('external_remove', this.unprefixKey(key), null);
                } else if (action === 'clear') {
                    this.notifyListeners('external_clear', null, null);
                }
            };
        }
    }
    
    broadcast(action, data) {
        if (this.channel) {
            this.channel.postMessage({ action, ...data });
        }
    }
    
    onChange(key, callback) {
        const unprefixedKey = typeof key === 'string' ? key : '*';
        
        if (!this.listeners.has(unprefixedKey)) {
            this.listeners.set(unprefixedKey, new Set());
        }
        
        this.listeners.get(unprefixedKey).add(callback);
        
        return () => {
            this.listeners.get(unprefixedKey)?.delete(callback);
        };
    }
    
    notifyListeners(event, key, data) {
        // Notify specific key listeners
        if (key && this.listeners.has(key)) {
            this.listeners.get(key).forEach(cb => cb(event, data));
        }
        
        // Notify wildcard listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(cb => cb(event, key, data));
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    prefixKey(key) {
        return `${this.config.prefix}${key}`;
    }
    
    unprefixKey(prefixedKey) {
        return prefixedKey.replace(this.config.prefix, '');
    }
    
    async exportData(options = {}) {
        const allData = await this.getAll(options);
        
        return {
            version: '2026.1.0',
            exportedAt: new Date().toISOString(),
            prefix: this.config.prefix,
            data: allData
        };
    }
    
    async importData(exportedData, options = {}) {
        if (!exportedData?.data) {
            throw new Error('Invalid import data');
        }
        
        const results = await this.setMany(exportedData.data, options);
        
        return {
            total: results.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    destroy() {
        if (this.channel) {
            this.channel.close();
        }
        
        this.listeners.clear();
        this.logger.info('Secure storage destroyed');
    }
}

const secureStorage = new SecureStorage();

export default secureStorage;
export { SecureStorage };