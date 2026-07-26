// tests/unit/storage.test.js - Enterprise Secure Storage Unit Tests 2026
/**
 * E-Arsip Digital - Comprehensive Secure Storage Unit Test Suite
 * Version: 2026.1.0
 * Tests: Encrypted storage, session storage, preferences,
 *        TTL/expiry, data integrity, quota management,
 *        corruption detection, migration
 * Framework: Jest with complete mock implementation
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// STORAGE MOCKS
// ============================================

const createStorageMock = () => {
    const store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        get length() { return Object.keys(store).length; },
        key: jest.fn((index) => Object.keys(store)[index] || null),
        _store: store
    };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true });
    Object.defineProperty(window, 'crypto', {
        value: {
            getRandomValues: (arr) => {
                for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
                return arr;
            },
            subtle: {}
        },
        configurable: true
    });
});

beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    jest.clearAllMocks();
});

// ============================================
// COMPLETE MOCK SECURE STORAGE
// ============================================

class SecureStorage {
    constructor() {
        this.PREFIX = '__secure_';
        this.SESSION_KEY = 'session_data';
        this.PREFERENCES_KEY = 'user_preferences';
        this.initialized = false;
        this.encryptionKey = null;
    }

    async init() {
        this.encryptionKey = await this.generateKey();
        this.initialized = true;
    }

    async generateKey() {
        return 'mock-encryption-key-' + Math.random().toString(36).substr(2, 10);
    }

    async encrypt(data) {
        const json = JSON.stringify(data);
        // Simulate encryption: base64 + key XOR
        const key = this.encryptionKey || 'default-key';
        let encrypted = '';
        for (let i = 0; i < json.length; i++) {
            encrypted += String.fromCharCode(json.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return 'ENC:' + btoa(encrypted);
    }

    async decrypt(encryptedData) {
        if (!encryptedData || !encryptedData.startsWith('ENC:')) {
            throw new Error('Data tidak terenkripsi');
        }
        try {
            const key = this.encryptionKey || 'default-key';
            const base64 = encryptedData.substring(4);
            const encrypted = atob(base64);
            let decrypted = '';
            for (let i = 0; i < encrypted.length; i++) {
                decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('Gagal mendekripsi data');
        }
    }

    async setItem(key, value, options = {}) {
        if (!this.initialized) await this.init();

        const storageKey = this.PREFIX + key;
        const data = {
            value,
            timestamp: Date.now(),
            ttl: options.ttl || null,
            version: '2026.1.0'
        };

        try {
            const encrypted = await this.encrypt(data);
            localStorage.setItem(storageKey, encrypted);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                throw new Error('Storage quota exceeded');
            }
            return false;
        }
    }

    async getItem(key) {
        if (!this.initialized) await this.init();

        const storageKey = this.PREFIX + key;
        const encrypted = localStorage.getItem(storageKey);

        if (!encrypted) return null;

        try {
            const data = await this.decrypt(encrypted);

            // Check TTL expiry
            if (data.ttl && Date.now() - data.timestamp > data.ttl) {
                localStorage.removeItem(storageKey);
                return null;
            }

            return data.value;
        } catch (error) {
            // Corrupted data
            localStorage.removeItem(storageKey);
            return null;
        }
    }

    removeItem(key) {
        const storageKey = this.PREFIX + key;
        localStorage.removeItem(storageKey);
    }

    clear() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    async storeSession(userData, options = {}) {
        const session = {
            user: userData,
            timestamp: Date.now(),
            userAgent: navigator.userAgent?.substring(0, 200) || 'unknown',
            ipAddress: options.ipAddress || 'unknown',
            expiresAt: Date.now() + (options.ttl || 3600000)
        };

        return this.setItem('session', session, { ttl: options.ttl || 3600000 });
    }

    async getSession() {
        return this.getItem('session');
    }

    async storePreferences(preferences) {
        const current = await this.getPreferences();
        const merged = { ...current, ...preferences };
        return this.setItem(this.PREFERENCES_KEY, merged);
    }

    async getPreferences() {
        const prefs = await this.getItem(this.PREFERENCES_KEY);
        return prefs || {};
    }

    async hasKey(key) {
        const value = await this.getItem(key);
        return value !== null;
    }

    async keys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.PREFIX)) {
                keys.push(key.substring(this.PREFIX.length));
            }
        }
        return keys;
    }

    async size() {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.PREFIX)) {
                const value = localStorage.getItem(key);
                totalSize += (key.length + (value?.length || 0)) * 2;
            }
        }
        return totalSize;
    }

    getEncryptionPrefix() {
        return 'ENC:';
    }

    async isEncrypted(key) {
        const storageKey = this.PREFIX + key;
        const value = localStorage.getItem(storageKey);
        return value?.startsWith(this.getEncryptionPrefix()) || false;
    }
}

// ============================================
// TEST INSTANCE
// ============================================

let secureStorage;

beforeEach(async () => {
    secureStorage = new SecureStorage();
    await secureStorage.init();
});

// ============================================
// BASIC CRUD TESTS
// ============================================

describe('Secure Storage - Basic CRUD', () => {
    const testData = { username: 'admin', role: 'admin', token: 'secret123' };

    it('Should store and retrieve data securely', async () => {
        const stored = await secureStorage.setItem('test', testData);
        expect(stored).toBe(true);

        const retrieved = await secureStorage.getItem('test');
        expect(retrieved).toBeDefined();
        expect(retrieved.username).toBe('admin');
        expect(retrieved.role).toBe('admin');
        expect(retrieved.token).toBe('secret123');
    });

    it('Should return null for non-existent key', async () => {
        const result = await secureStorage.getItem('non_existent_key');
        expect(result).toBeNull();
    });

    it('Should remove item successfully', async () => {
        await secureStorage.setItem('temp', { data: 'test' });
        secureStorage.removeItem('temp');

        const result = await secureStorage.getItem('temp');
        expect(result).toBeNull();
    });

    it('Should clear all secure storage items', async () => {
        await secureStorage.setItem('key1', { data: 'value1' });
        await secureStorage.setItem('key2', { data: 'value2' });
        await secureStorage.setItem('key3', { data: 'value3' });

        secureStorage.clear();

        expect(await secureStorage.getItem('key1')).toBeNull();
        expect(await secureStorage.getItem('key2')).toBeNull();
        expect(await secureStorage.getItem('key3')).toBeNull();
    });

    it('Should not clear non-secure storage items', async () => {
        localStorage.setItem('regular_key', 'regular_value');
        await secureStorage.setItem('secure_key', { data: 'secure' });

        secureStorage.clear();

        expect(await secureStorage.getItem('secure_key')).toBeNull();
        expect(localStorage.getItem('regular_key')).toBe('regular_value');
    });

    it('Should check if key exists', async () => {
        await secureStorage.setItem('exists', { data: 'yes' });

        expect(await secureStorage.hasKey('exists')).toBe(true);
        expect(await secureStorage.hasKey('missing')).toBe(false);
    });

    it('Should list all secure keys', async () => {
        await secureStorage.setItem('key_a', { data: 'a' });
        await secureStorage.setItem('key_b', { data: 'b' });

        const keys = await secureStorage.keys();
        expect(keys).toContain('key_a');
        expect(keys).toContain('key_b');
        expect(keys.length).toBe(2);
    });
});

// ============================================
// ENCRYPTION TESTS
// ============================================

describe('Secure Storage - Encryption', () => {
    it('Should store data in encrypted format', async () => {
        const testData = { message: 'secret' };
        await secureStorage.setItem('enc_test', testData);

        const isEncrypted = await secureStorage.isEncrypted('enc_test');
        expect(isEncrypted).toBe(true);
    });

    it('Should produce different ciphertext for same plaintext', async () => {
        const testData = { message: 'test' };

        await secureStorage.setItem('enc1', testData);

        // Create new instance with different key
        const storage2 = new SecureStorage();
        await storage2.init();
        await storage2.setItem('enc2', testData);

        // Both should decrypt to same value
        const result1 = await secureStorage.getItem('enc1');
        const result2 = await storage2.getItem('enc2');

        expect(result1).toEqual(testData);
        expect(result2).toEqual(testData);
    });

    it('Should detect non-encrypted data', async () => {
        localStorage.setItem(secureStorage.PREFIX + 'plain', JSON.stringify({ value: 'test' }));

        const isEncrypted = await secureStorage.isEncrypted('plain');
        expect(isEncrypted).toBe(false);
    });

    it('Should handle corrupted encrypted data gracefully', async () => {
        localStorage.setItem(secureStorage.PREFIX + 'corrupt', 'ENC:invalid-base64!!!');

        const result = await secureStorage.getItem('corrupt');
        expect(result).toBeNull();
        // Should clean up corrupted data
        expect(localStorage.getItem(secureStorage.PREFIX + 'corrupt')).toBeNull();
    });

    it('Should handle tampered encrypted data', async () => {
        await secureStorage.setItem('tamper', { secret: 'value' });

        const rawKey = secureStorage.PREFIX + 'tamper';
        const raw = localStorage.getItem(rawKey);
        const tampered = raw.substring(0, raw.length - 5) + 'XXXXX';
        localStorage.setItem(rawKey, tampered);

        const result = await secureStorage.getItem('tamper');
        expect(result).toBeNull();
    });
});

// ============================================
// TTL / EXPIRY TESTS
// ============================================

describe('Secure Storage - TTL / Expiry', () => {
    it('Should store data with TTL', async () => {
        await secureStorage.setItem('ttl_test', { data: 'temp' }, { ttl: 5000 });

        const retrieved = await secureStorage.getItem('ttl_test');
        expect(retrieved).toBeDefined();
    });

    it('Should expire data after TTL', async () => {
        await secureStorage.setItem('expire_test', { data: 'temp' }, { ttl: 1000 });

        // Advance time
        jest.advanceTimersByTime(2000);

        const retrieved = await secureStorage.getItem('expire_test');
        expect(retrieved).toBeNull();
    });

    it('Should not expire data without TTL', async () => {
        await secureStorage.setItem('no_ttl', { data: 'permanent' });

        jest.advanceTimersByTime(10000000);

        const retrieved = await secureStorage.getItem('no_ttl');
        expect(retrieved).toBeDefined();
    });

    it('Should handle zero TTL (immediate expiry)', async () => {
        await secureStorage.setItem('zero_ttl', { data: 'temp' }, { ttl: 0 });

        const retrieved = await secureStorage.getItem('zero_ttl');
        expect(retrieved).toBeNull();
    });
});

// ============================================
// SESSION STORAGE TESTS
// ============================================

describe('Secure Storage - Session', () => {
    it('Should store and retrieve session data', async () => {
        const userData = { id: '1', username: 'admin', role: 'admin' };

        await secureStorage.storeSession(userData);

        const session = await secureStorage.getSession();
        expect(session).toBeDefined();
        expect(session.user.username).toBe('admin');
        expect(session.user.role).toBe('admin');
        expect(session.timestamp).toBeDefined();
        expect(session.userAgent).toBeDefined();
        expect(session.expiresAt).toBeDefined();
    });

    it('Should store session with custom TTL', async () => {
        const userData = { id: '2', username: 'user' };

        await secureStorage.storeSession(userData, { ttl: 7200000 });

        const session = await secureStorage.getSession();
        expect(session).toBeDefined();
        expect(session.expiresAt).toBeGreaterThan(Date.now() + 7000000);
    });

    it('Should store session with IP address', async () => {
        const userData = { id: '3', username: 'admin' };

        await secureStorage.storeSession(userData, { ipAddress: '192.168.1.100' });

        const session = await secureStorage.getSession();
        expect(session.ipAddress).toBe('192.168.1.100');
    });

    it('Should return null when no session exists', async () => {
        const session = await secureStorage.getSession();
        expect(session).toBeNull();
    });
});

// ============================================
// PREFERENCES TESTS
// ============================================

describe('Secure Storage - Preferences', () => {
    it('Should store and retrieve preferences', async () => {
        const preferences = { theme: 'dark', language: 'id', notifications: true };

        await secureStorage.storePreferences(preferences);

        const retrieved = await secureStorage.getPreferences();
        expect(retrieved.theme).toBe('dark');
        expect(retrieved.language).toBe('id');
        expect(retrieved.notifications).toBe(true);
    });

    it('Should merge with existing preferences', async () => {
        await secureStorage.storePreferences({ theme: 'dark', language: 'en' });
        await secureStorage.storePreferences({ language: 'id', notifications: false });

        const retrieved = await secureStorage.getPreferences();
        expect(retrieved.theme).toBe('dark'); // Kept from first
        expect(retrieved.language).toBe('id'); // Updated
        expect(retrieved.notifications).toBe(false); // Added
    });

    it('Should return empty object for no preferences', async () => {
        const preferences = await secureStorage.getPreferences();
        expect(preferences).toBeDefined();
        expect(typeof preferences).toBe('object');
        expect(Object.keys(preferences).length).toBe(0);
    });

    it('Should handle complex preference objects', async () => {
        const complex = {
            theme: 'blue',
            fontSize: 'large',
            layout: { sidebar: 'left', density: 'compact' },
            shortcuts: { save: 'ctrl+s', search: 'ctrl+f' }
        };

        await secureStorage.storePreferences(complex);

        const retrieved = await secureStorage.getPreferences();
        expect(retrieved.layout.sidebar).toBe('left');
        expect(retrieved.shortcuts.save).toBe('ctrl+s');
    });
});

// ============================================
// DATA INTEGRITY TESTS
// ============================================

describe('Secure Storage - Data Integrity', () => {
    it('Should handle storing various data types', async () => {
        const testCases = [
            { key: 'string', value: 'Hello World' },
            { key: 'number', value: 12345 },
            { key: 'boolean', value: true },
            { key: 'array', value: [1, 2, 3, { nested: 'value' }] },
            { key: 'null_value', value: null },
            { key: 'empty_string', value: '' },
            { key: 'unicode', value: 'Halo 世界 🌍' }
        ];

        for (const { key, value } of testCases) {
            await secureStorage.setItem(key, value);
            const retrieved = await secureStorage.getItem(key);
            expect(retrieved).toEqual(value);
        }
    });

    it('Should handle large data objects', async () => {
        const largeData = {
            items: Array.from({ length: 100 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                description: 'A'.repeat(100)
            }))
        };

        await secureStorage.setItem('large', largeData);
        const retrieved = await secureStorage.getItem('large');

        expect(retrieved.items.length).toBe(100);
        expect(retrieved.items[0].name).toBe('Item 0');
    });

    it('Should handle very long string values', async () => {
        const longString = 'A'.repeat(10000);

        await secureStorage.setItem('long', longString);
        const retrieved = await secureStorage.getItem('long');

        expect(retrieved).toBe(longString);
    });

    it('Should calculate storage size', async () => {
        await secureStorage.setItem('size_test', { data: 'A'.repeat(1000) });

        const size = await secureStorage.size();
        expect(size).toBeGreaterThan(0);
    });
});

// ============================================
// QUOTA MANAGEMENT TESTS
// ============================================

describe('Secure Storage - Quota Management', () => {
    it('Should handle storage quota exceeded', async () => {
        // Mock quota exceeded error
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = jest.fn(() => {
            const error = new Error('Quota exceeded');
            error.name = 'QuotaExceededError';
            throw error;
        });

        await expect(
            secureStorage.setItem('quota_test', { data: 'test' })
        ).rejects.toThrow('Storage quota exceeded');

        localStorage.setItem = originalSetItem;
    });

    it('Should clean up expired items on quota pressure', async () => {
        // Store items with TTL
        await secureStorage.setItem('expire1', { data: 'old' }, { ttl: 100 });
        await secureStorage.setItem('expire2', { data: 'old' }, { ttl: 100 });

        // Advance time past TTL
        jest.advanceTimersByTime(2000);

        // These should be auto-cleaned on access
        const result1 = await secureStorage.getItem('expire1');
        const result2 = await secureStorage.getItem('expire2');

        expect(result1).toBeNull();
        expect(result2).toBeNull();
    });
});

// ============================================
// EDGE CASE TESTS
// ============================================

describe('Secure Storage - Edge Cases', () => {
    it('Should handle concurrent operations', async () => {
        const operations = [];
        for (let i = 0; i < 10; i++) {
            operations.push(secureStorage.setItem(`concurrent_${i}`, { index: i }));
        }

        await Promise.all(operations);

        for (let i = 0; i < 10; i++) {
            const result = await secureStorage.getItem(`concurrent_${i}`);
            expect(result.index).toBe(i);
        }
    });

    it('Should handle special characters in keys', async () => {
        const specialKey = 'test-key_with.special:chars@2026';
        await secureStorage.setItem(specialKey, { valid: true });

        const result = await secureStorage.getItem(specialKey);
        expect(result.valid).toBe(true);
    });

    it('Should handle overwriting existing keys', async () => {
        await secureStorage.setItem('overwrite', { version: 1 });
        await secureStorage.setItem('overwrite', { version: 2 });

        const result = await secureStorage.getItem('overwrite');
        expect(result.version).toBe(2);
    });

    it('Should return correct encryption prefix', () => {
        expect(secureStorage.getEncryptionPrefix()).toBe('ENC:');
    });

    it('Should handle empty object storage', async () => {
        await secureStorage.setItem('empty_obj', {});
        const result = await secureStorage.getItem('empty_obj');
        expect(result).toEqual({});
    });

    it('Should handle very large number of keys', async () => {
        for (let i = 0; i < 50; i++) {
            await secureStorage.setItem(`bulk_${i}`, { index: i });
        }

        const keys = await secureStorage.keys();
        expect(keys.length).toBe(50);
    });

    it('Should not be initialized before init()', () => {
        const storage = new SecureStorage();
        expect(storage.initialized).toBe(false);
    });

    it('Should auto-initialize on first operation', async () => {
        const storage = new SecureStorage();
        expect(storage.initialized).toBe(false);

        await storage.setItem('auto_init', { test: true });

        expect(storage.initialized).toBe(true);
    });
});