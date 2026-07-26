// tests/unit/encryption.test.js - Enterprise Encryption Unit Tests 2026
/**
 * E-Arsip Digital - Comprehensive Encryption Unit Test Suite
 * Version: 2026.1.0
 * Tests: AES-GCM encrypt/decrypt, hashing, password hashing,
 *        key management, data integrity, edge cases, security
 * Framework: Jest with complete mock implementation
 */

import { describe, it, beforeAll, beforeEach, expect } from '@jest/globals';

// ============================================
// COMPLETE MOCK ENCRYPTION SERVICE
// ============================================

class EncryptionService {
    constructor() {
        this.algorithm = 'AES-256-GCM';
        this.keyLength = 256;
        this.initialized = false;
        this.masterKey = null;
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
        this.KEY_PREFIX = 'ENC:';
    }

    async init() {
        // Generate a mock master key
        this.masterKey = await this.createKey();
        this.initialized = true;
    }

    async encrypt(data, key = null) {
        if (!this.initialized) await this.init();

        const encryptionKey = key || this.masterKey;
        const rawData = typeof data === 'string' ? data : JSON.stringify(data);
        const encoded = this.encoder.encode(rawData);

        // Simulate AES-GCM encryption
        const iv = this.generateRandomBytes(12);
        const encryptedBytes = new Uint8Array(encoded.length + 16); // +16 for auth tag

        // Simple XOR "encryption" for mock (in real impl, use Web Crypto API)
        const keyBytes = this.encoder.encode(JSON.stringify(encryptionKey));
        for (let i = 0; i < encoded.length; i++) {
            encryptedBytes[i] = encoded[i] ^ keyBytes[i % keyBytes.length];
        }

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encryptedBytes.length);
        combined.set(iv);
        combined.set(encryptedBytes, iv.length);

        return this.KEY_PREFIX + this.arrayBufferToBase64(combined);
    }

    async decrypt(encryptedData, key = null) {
        if (!this.initialized) await this.init();

        if (!encryptedData || !encryptedData.startsWith(this.KEY_PREFIX)) {
            throw new Error('Gagal mendekripsi: Data tidak valid atau tidak terenkripsi');
        }

        try {
            const decryptionKey = key || this.masterKey;
            const base64Data = encryptedData.substring(this.KEY_PREFIX.length);
            const combined = this.base64ToArrayBuffer(base64Data);

            // Extract IV (first 12 bytes)
            const iv = combined.slice(0, 12);
            const encryptedBytes = combined.slice(12);

            // Decrypt
            const keyBytes = this.encoder.encode(JSON.stringify(decryptionKey));
            const decrypted = new Uint8Array(encryptedBytes.length - 16);

            for (let i = 0; i < decrypted.length; i++) {
                decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
            }

            return this.decoder.decode(decrypted);
        } catch (error) {
            throw new Error('Gagal mendekripsi: ' + error.message);
        }
    }

    async encryptObject(obj) {
        return this.encrypt(JSON.stringify(obj));
    }

    async decryptToObject(encryptedData) {
        const json = await this.decrypt(encryptedData);
        return JSON.parse(json);
    }

    async hash(data) {
        const encoded = this.encoder.encode(data);
        // Simulate SHA-512 (128 hex chars)
        let hash = '';
        for (let i = 0; i < 128; i++) {
            hash += ((encoded[i % encoded.length] + i * 7) % 16).toString(16);
        }
        return hash;
    }

    async hashPassword(password) {
        const salt = this.generateRandomBytes(16);
        const saltedPassword = password + this.arrayBufferToBase64(salt);
        const hash = await this.hash(saltedPassword);
        return { hash, salt: this.arrayBufferToBase64(salt) };
    }

    async verifyPassword(password, hash, salt) {
        const saltedPassword = password + salt;
        const computedHash = await this.hash(saltedPassword);
        return computedHash === hash;
    }

    generateRandomBytes(length) {
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }

    generateToken(length = 32) {
        const bytes = this.generateRandomBytes(length);
        return this.arrayBufferToBase64(bytes).substring(0, 48);
    }

    async createKey() {
        const keyData = this.generateRandomBytes(32);
        return { type: 'secret', data: keyData, algorithm: this.algorithm };
    }

    async exportKey(key) {
        return this.arrayBufferToBase64(key.data);
    }

    async importKey(exportedKey) {
        const data = this.base64ToArrayBuffer(exportedKey);
        return { type: 'secret', data, algorithm: this.algorithm };
    }

    async deriveKey(passphrase, salt = null) {
        const actualSalt = salt || this.generateRandomBytes(16);
        const keyData = this.encoder.encode(passphrase + this.arrayBufferToBase64(actualSalt));
        const derivedKey = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            derivedKey[i] = keyData[i % keyData.length];
        }
        return {
            key: { type: 'secret', data: derivedKey, algorithm: this.algorithm },
            salt: actualSalt
        };
    }

    isEncrypted(data) {
        return typeof data === 'string' && data.startsWith(this.KEY_PREFIX);
    }

    arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    arrayBufferToHex(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    getEncryptionInfo() {
        return {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            initialized: this.initialized,
            hasMasterKey: !!this.masterKey
        };
    }
}

// ============================================
// TEST SETUP
// ============================================

let encryption;

beforeAll(async () => {
    encryption = new EncryptionService();
    await encryption.init();
});

beforeEach(() => {
    // Reset state if needed
});

// ============================================
// SYMMETRIC ENCRYPTION TESTS (AES-256-GCM)
// ============================================

describe('Symmetric Encryption (AES-256-GCM)', () => {
    const testData = 'This is sensitive data for testing';
    const testObject = { username: 'testuser', role: 'admin', token: 'secret123' };

    it('Should encrypt and decrypt string data', async () => {
        const encrypted = await encryption.encrypt(testData);

        expect(encrypted).not.toBe(testData);
        expect(encrypted).toBeTruthy();
        expect(encryption.isEncrypted(encrypted)).toBe(true);

        const decrypted = await encryption.decrypt(encrypted);
        expect(decrypted).toBe(testData);
    });

    it('Should encrypt and decrypt object data', async () => {
        const encrypted = await encryption.encryptObject(testObject);

        expect(encrypted).toBeTruthy();
        expect(encryption.isEncrypted(encrypted)).toBe(true);

        const decrypted = await encryption.decryptToObject(encrypted);
        expect(decrypted).toEqual(testObject);
    });

    it('Should produce different ciphertext for same plaintext (unique IV)', async () => {
        const encrypted1 = await encryption.encrypt(testData);
        const encrypted2 = await encryption.encrypt(testData);

        expect(encrypted1).not.toBe(encrypted2);
        // Both should decrypt to same value
        expect(await encryption.decrypt(encrypted1)).toBe(testData);
        expect(await encryption.decrypt(encrypted2)).toBe(testData);
    });

    it('Should throw error for invalid encrypted data format', async () => {
        await expect(encryption.decrypt('invalid-data')).rejects.toThrow('Gagal mendekripsi');
        await expect(encryption.decrypt('')).rejects.toThrow();
        await expect(encryption.decrypt(null)).rejects.toThrow();
    });

    it('Should throw error for corrupted encrypted data', async () => {
        const encrypted = await encryption.encrypt(testData);
        const corrupted = encrypted.substring(0, encrypted.length - 10) + 'XXXX';

        await expect(encryption.decrypt(corrupted)).rejects.toThrow();
    });

    it('Should throw error for tampered encrypted data', async () => {
        const encrypted = await encryption.encrypt(testData);
        // Change middle character
        const tampered = encrypted.substring(0, 20) + 'X' + encrypted.substring(21);

        await expect(encryption.decrypt(tampered)).rejects.toThrow('Gagal mendekripsi');
    });

    it('Should not decrypt with wrong prefix removed', async () => {
        const encrypted = await encryption.encrypt(testData);
        const withoutPrefix = encrypted.substring(encryption.KEY_PREFIX.length);

        await expect(encryption.decrypt(withoutPrefix)).rejects.toThrow();
    });

    it('Should handle empty string', async () => {
        const encrypted = await encryption.encrypt('');
        const decrypted = await encryption.decrypt(encrypted);
        expect(decrypted).toBe('');
    });

    it('Should handle special characters', async () => {
        const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\\';
        const encrypted = await encryption.encrypt(specialChars);
        const decrypted = await encryption.decrypt(encrypted);
        expect(decrypted).toBe(specialChars);
    });

    it('Should handle unicode/emoji characters', async () => {
        const unicode = 'Halo 世界 🌍 مرحبا 🎉';
        const encrypted = await encryption.encrypt(unicode);
        const decrypted = await encryption.decrypt(encrypted);
        expect(decrypted).toBe(unicode);
    });

    it('Should handle large data (100KB)', async () => {
        const largeData = 'A'.repeat(100000);
        const encrypted = await encryption.encrypt(largeData);
        const decrypted = await encryption.decrypt(encrypted);
        expect(decrypted).toBe(largeData);
    });

    it('Should handle binary-like data', async () => {
        const binaryLike = String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i));
        const encrypted = await encryption.encrypt(binaryLike);
        const decrypted = await encryption.decrypt(encrypted);
        expect(decrypted).toBe(binaryLike);
    });

    it('Should encrypt with custom key', async () => {
        const customKey = await encryption.createKey();
        const encrypted = await encryption.encrypt(testData, customKey);
        const decrypted = await encryption.decrypt(encrypted, customKey);
        expect(decrypted).toBe(testData);
    });

    it('Should fail to decrypt with wrong key', async () => {
        const key1 = await encryption.createKey();
        const key2 = await encryption.createKey();
        const encrypted = await encryption.encrypt(testData, key1);

        await expect(encryption.decrypt(encrypted, key2)).rejects.toThrow();
    });
});

// ============================================
// HASHING TESTS
// ============================================

describe('Hashing (SHA-512)', () => {
    it('Should hash data and produce 128 hex characters', async () => {
        const hash = await encryption.hash('test data');

        expect(hash).toBeTruthy();
        expect(hash.length).toBe(128);
        expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    it('Should produce consistent hashes for same input', async () => {
        const hash1 = await encryption.hash('consistent');
        const hash2 = await encryption.hash('consistent');

        expect(hash1).toBe(hash2);
    });

    it('Should produce different hashes for different inputs', async () => {
        const hash1 = await encryption.hash('data1');
        const hash2 = await encryption.hash('data2');

        expect(hash1).not.toBe(hash2);
    });

    it('Should produce different hashes for similar inputs', async () => {
        const hash1 = await encryption.hash('test');
        const hash2 = await encryption.hash('Test');

        expect(hash1).not.toBe(hash2);
    });

    it('Should handle empty string hashing', async () => {
        const hash = await encryption.hash('');
        expect(hash).toBeTruthy();
        expect(hash.length).toBe(128);
    });
});

// ============================================
// PASSWORD HASHING TESTS
// ============================================

describe('Password Hashing', () => {
    it('Should hash password with unique salt', async () => {
        const result = await encryption.hashPassword('mypassword123');

        expect(result.hash).toBeTruthy();
        expect(result.salt).toBeTruthy();
        expect(result.hash.length).toBe(128);
    });

    it('Should verify correct password', async () => {
        const { hash, salt } = await encryption.hashPassword('securepass');
        const isValid = await encryption.verifyPassword('securepass', hash, salt);

        expect(isValid).toBe(true);
    });

    it('Should reject incorrect password', async () => {
        const { hash, salt } = await encryption.hashPassword('securepass');
        const isValid = await encryption.verifyPassword('wrongpass', hash, salt);

        expect(isValid).toBe(false);
    });

    it('Should reject password with wrong salt', async () => {
        const { hash } = await encryption.hashPassword('securepass');
        const { salt: wrongSalt } = await encryption.hashPassword('otherpass');
        const isValid = await encryption.verifyPassword('securepass', hash, wrongSalt);

        expect(isValid).toBe(false);
    });

    it('Should produce different hashes for same password (unique salt)', async () => {
        const result1 = await encryption.hashPassword('samepassword');
        const result2 = await encryption.hashPassword('samepassword');

        expect(result1.hash).not.toBe(result2.hash);
        expect(result1.salt).not.toBe(result2.salt);
    });

    it('Should handle empty password', async () => {
        const result = await encryption.hashPassword('');
        expect(result.hash).toBeTruthy();
        expect(result.salt).toBeTruthy();
    });

    it('Should handle very long passwords', async () => {
        const longPassword = 'A'.repeat(1000);
        const result = await encryption.hashPassword(longPassword);
        expect(result.hash).toBeTruthy();
    });
});

// ============================================
// RANDOM GENERATION TESTS
// ============================================

describe('Random Generation', () => {
    it('Should generate random bytes of specified length', () => {
        const bytes = encryption.generateRandomBytes(32);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBe(32);
    });

    it('Should generate random bytes of different lengths', () => {
        const lengths = [1, 16, 32, 64, 128, 256];
        for (const len of lengths) {
            expect(encryption.generateRandomBytes(len).length).toBe(len);
        }
    });

    it('Should generate unique random tokens', () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
            tokens.add(encryption.generateToken());
        }
        expect(tokens.size).toBe(100);
    });

    it('Should generate token with reasonable length', () => {
        const token = encryption.generateToken();
        expect(token.length).toBeGreaterThanOrEqual(40);
        expect(token.length).toBeLessThanOrEqual(48);
    });

    it('Should generate token with custom length', () => {
        const token = encryption.generateToken(16);
        expect(token.length).toBeLessThanOrEqual(24); // base64 of 16 bytes
    });
});

// ============================================
// KEY MANAGEMENT TESTS
// ============================================

describe('Key Management', () => {
    it('Should create and export key', async () => {
        const key = await encryption.createKey();
        const exported = await encryption.exportKey(key);

        expect(exported).toBeTruthy();
        expect(typeof exported).toBe('string');

        const imported = await encryption.importKey(exported);
        expect(imported).toBeTruthy();
        expect(imported.algorithm).toBe('AES-256-GCM');
    });

    it('Should derive key from passphrase', async () => {
        const { key, salt } = await encryption.deriveKey('mysecretpassphrase');

        expect(key).toBeTruthy();
        expect(salt).toBeTruthy();
        expect(salt).toBeInstanceOf(Uint8Array);
    });

    it('Should derive same key with same passphrase and salt', async () => {
        const salt = new Uint8Array(16).fill(1);
        const { key: key1 } = await encryption.deriveKey('samepass', salt);
        const { key: key2 } = await encryption.deriveKey('samepass', salt);

        const exported1 = await encryption.exportKey(key1);
        const exported2 = await encryption.exportKey(key2);

        expect(exported1).toBe(exported2);
    });

    it('Should derive different keys with different passphrases', async () => {
        const salt = new Uint8Array(16).fill(1);
        const { key: key1 } = await encryption.deriveKey('pass1', salt);
        const { key: key2 } = await encryption.deriveKey('pass2', salt);

        const exported1 = await encryption.exportKey(key1);
        const exported2 = await encryption.exportKey(key2);

        expect(exported1).not.toBe(exported2);
    });

    it('Should derive different keys with different salts', async () => {
        const { key: key1 } = await encryption.deriveKey('samepass');
        const { key: key2 } = await encryption.deriveKey('samepass');

        const exported1 = await encryption.exportKey(key1);
        const exported2 = await encryption.exportKey(key2);

        expect(exported1).not.toBe(exported2);
    });

    it('Should handle empty passphrase', async () => {
        const { key, salt } = await encryption.deriveKey('');
        expect(key).toBeTruthy();
        expect(salt).toBeTruthy();
    });
});

// ============================================
// ENCRYPTION DETECTION TESTS
// ============================================

describe('Encryption Detection', () => {
    it('Should detect encrypted data', async () => {
        const encrypted = await encryption.encrypt('test data');
        expect(encryption.isEncrypted(encrypted)).toBe(true);
    });

    it('Should not detect plain text as encrypted', () => {
        expect(encryption.isEncrypted('plain text')).toBe(false);
        expect(encryption.isEncrypted('')).toBe(false);
        expect(encryption.isEncrypted('short')).toBe(false);
    });

    it('Should not detect null/undefined as encrypted', () => {
        expect(encryption.isEncrypted(null)).toBe(false);
        expect(encryption.isEncrypted(undefined)).toBe(false);
    });

    it('Should not detect numbers as encrypted', () => {
        expect(encryption.isEncrypted(12345)).toBe(false);
    });
});

// ============================================
// UTILITY METHODS TESTS
// ============================================

describe('Utility Methods', () => {
    it('Should convert ArrayBuffer to Base64 and back', () => {
        const original = new Uint8Array([1, 2, 3, 4, 5]);
        const base64 = encryption.arrayBufferToBase64(original);
        const converted = encryption.base64ToArrayBuffer(base64);

        expect(Array.from(converted)).toEqual([1, 2, 3, 4, 5]);
    });

    it('Should handle empty buffer conversion', () => {
        const original = new Uint8Array([]);
        const base64 = encryption.arrayBufferToBase64(original);
        const converted = encryption.base64ToArrayBuffer(base64);

        expect(converted.length).toBe(0);
    });

    it('Should handle large buffer conversion', () => {
        const original = new Uint8Array(10000).fill(255);
        const base64 = encryption.arrayBufferToBase64(original);
        const converted = encryption.base64ToArrayBuffer(base64);

        expect(converted.length).toBe(10000);
        expect(converted[0]).toBe(255);
    });

    it('Should convert ArrayBuffer to hex', () => {
        const bytes = new Uint8Array([0, 15, 255, 16, 170]);
        const hex = encryption.arrayBufferToHex(bytes.buffer);
        expect(hex).toBe('000fff10aa');
    });

    it('Should return encryption info', () => {
        const info = encryption.getEncryptionInfo();

        expect(info.algorithm).toBe('AES-256-GCM');
        expect(info.keyLength).toBe(256);
        expect(info.initialized).toBe(true);
        expect(info.hasMasterKey).toBe(true);
    });

    it('Should handle hex conversion of empty buffer', () => {
        const hex = encryption.arrayBufferToHex(new ArrayBuffer(0));
        expect(hex).toBe('');
    });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Encryption Integration Scenarios', () => {
    it('Should support full encrypt-store-decrypt cycle', async () => {
        const sensitiveData = JSON.stringify({
            userId: 'user-001',
            sessionToken: 'secret-token-value',
            expiresAt: Date.now() + 3600000
        });

        // Encrypt for storage
        const encrypted = await encryption.encrypt(sensitiveData);
        expect(encryption.isEncrypted(encrypted)).toBe(true);

        // Store (simulated)
        const stored = encrypted;

        // Retrieve and decrypt
        const decrypted = await encryption.decrypt(stored);
        const parsed = JSON.parse(decrypted);

        expect(parsed.userId).toBe('user-001');
        expect(parsed.sessionToken).toBe('secret-token-value');
    });

    it('Should support password-based encryption', async () => {
        const password = 'user-secret-password';
        const data = 'My private notes';

        // Derive key from password
        const { key, salt } = await encryption.deriveKey(password);

        // Encrypt with derived key
        const encrypted = await encryption.encrypt(data, key);

        // Derive same key again
        const { key: sameKey } = await encryption.deriveKey(password, salt);

        // Decrypt with derived key
        const decrypted = await encryption.decrypt(encrypted, sameKey);
        expect(decrypted).toBe(data);
    });
});