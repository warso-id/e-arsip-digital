// tests/unit/encryption.test.js - Encryption Unit Tests 2026
/**
 * E-Arsip Digital - Encryption Unit Tests
 * Version: 2026.1.0
 */

import { describe, it, expect, beforeAll } from '../test-runner.js';
import EncryptionService from '../../js/security/encryption.js';

describe('EncryptionService', () => {
    let encryption;
    const testData = 'This is sensitive data for testing';
    const testObject = { username: 'testuser', role: 'admin', token: 'secret123' };
    
    beforeAll(async () => {
        encryption = new EncryptionService();
        await encryption.init();
    });
    
    describe('Symmetric Encryption (AES-256-GCM)', () => {
        it('should encrypt and decrypt string data', async () => {
            const encrypted = await encryption.encrypt(testData);
            
            expect(encrypted).not.toBe(testData);
            expect(encrypted).toBeTruthy();
            
            const decrypted = await encryption.decrypt(encrypted);
            expect(decrypted).toBe(testData);
        });
        
        it('should encrypt and decrypt object data', async () => {
            const encrypted = await encryption.encryptObject(testObject);
            
            expect(encrypted).toBeTruthy();
            
            const decrypted = await encryption.decryptToObject(encrypted);
            expect(decrypted).toEqual(testObject);
        });
        
        it('should produce different ciphertext for same plaintext', async () => {
            const encrypted1 = await encryption.encrypt(testData);
            const encrypted2 = await encryption.encrypt(testData);
            
            // Different IV should produce different ciphertext
            expect(encrypted1).not.toBe(encrypted2);
        });
        
        it('should throw error for invalid encrypted data', async () => {
            try {
                await encryption.decrypt('invalid-base64-data!@#');
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error.message).toContain('Gagal mendekripsi');
            }
        });
        
        it('should handle empty string', async () => {
            const encrypted = await encryption.encrypt('');
            const decrypted = await encryption.decrypt(encrypted);
            expect(decrypted).toBe('');
        });
        
        it('should handle special characters', async () => {
            const specialChars = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
            const encrypted = await encryption.encrypt(specialChars);
            const decrypted = await encryption.decrypt(encrypted);
            expect(decrypted).toBe(specialChars);
        });
        
        it('should handle unicode characters', async () => {
            const unicode = 'Halo 世界 🌍 مرحبا';
            const encrypted = await encryption.encrypt(unicode);
            const decrypted = await encryption.decrypt(encrypted);
            expect(decrypted).toBe(unicode);
        });
        
        it('should handle large data', async () => {
            const largeData = 'A'.repeat(100000);
            const encrypted = await encryption.encrypt(largeData);
            const decrypted = await encryption.decrypt(encrypted);
            expect(decrypted).toBe(largeData);
        });
    });
    
    describe('Hashing', () => {
        it('should hash data with SHA-512', async () => {
            const hash = await encryption.hash(testData);
            
            expect(hash).toBeTruthy();
            expect(hash.length).toBe(128); // SHA-512 produces 128 hex chars
        });
        
        it('should produce consistent hashes', async () => {
            const hash1 = await encryption.hash(testData);
            const hash2 = await encryption.hash(testData);
            
            expect(hash1).toBe(hash2);
        });
        
        it('should produce different hashes for different data', async () => {
            const hash1 = await encryption.hash('data1');
            const hash2 = await encryption.hash('data2');
            
            expect(hash1).not.toBe(hash2);
        });
    });
    
    describe('Password Hashing', () => {
        it('should hash password with salt', async () => {
            const result = await encryption.hashPassword('mypassword123');
            
            expect(result.hash).toBeTruthy();
            expect(result.salt).toBeTruthy();
        });
        
        it('should verify correct password', async () => {
            const { hash, salt } = await encryption.hashPassword('securepass');
            const isValid = await encryption.verifyPassword('securepass', hash, salt);
            
            expect(isValid).toBe(true);
        });
        
        it('should reject incorrect password', async () => {
            const { hash, salt } = await encryption.hashPassword('securepass');
            const isValid = await encryption.verifyPassword('wrongpass', hash, salt);
            
            expect(isValid).toBe(false);
        });
        
        it('should produce different hashes for same password', async () => {
            const result1 = await encryption.hashPassword('samepassword');
            const result2 = await encryption.hashPassword('samepassword');
            
            // Different salts should produce different hashes
            expect(result1.hash).not.toBe(result2.hash);
            expect(result1.salt).not.toBe(result2.salt);
        });
    });
    
    describe('Random Generation', () => {
        it('should generate random bytes', () => {
            const bytes = encryption.generateRandomBytes(32);
            expect(bytes).toBeTruthy();
        });
        
        it('should generate random tokens', () => {
            const token1 = encryption.generateToken();
            const token2 = encryption.generateToken();
            
            expect(token1).not.toBe(token2);
            expect(token1.length).toBeLessThanOrEqual(48);
        });
    });
    
    describe('Key Management', () => {
        it('should create and export key', async () => {
            const key = await encryption.createKey();
            const exported = await encryption.exportKey(key);
            
            expect(exported).toBeTruthy();
            
            const imported = await encryption.importKey(exported);
            expect(imported).toBeTruthy();
        });
        
        it('should derive key from passphrase', async () => {
            const { key, salt } = await encryption.deriveKey('mysecretpassphrase');
            expect(key).toBeTruthy();
            expect(salt).toBeTruthy();
        });
        
        it('should derive same key with same passphrase and salt', async () => {
            const salt = new Uint8Array(16).fill(1);
            const { key: key1 } = await encryption.deriveKey('samepass', salt);
            const { key: key2 } = await encryption.deriveKey('samepass', salt);
            
            const exported1 = await encryption.exportKey(key1);
            const exported2 = await encryption.exportKey(key2);
            
            expect(exported1).toBe(exported2);
        });
    });
    
    describe('isEncrypted()', () => {
        it('should detect encrypted data', async () => {
            const encrypted = await encryption.encrypt('test data');
            expect(encryption.isEncrypted(encrypted)).toBe(true);
        });
        
        it('should detect non-encrypted data', () => {
            expect(encryption.isEncrypted('plain text')).toBe(false);
            expect(encryption.isEncrypted('short')).toBe(false);
        });
    });
    
    describe('Utility Methods', () => {
        it('should convert ArrayBuffer to Base64 and back', () => {
            const original = new Uint8Array([1, 2, 3, 4, 5]);
            const base64 = encryption.arrayBufferToBase64(original);
            const converted = encryption.base64ToArrayBuffer(base64);
            
            expect(Array.from(converted)).toEqual([1, 2, 3, 4, 5]);
        });
        
        it('should convert ArrayBuffer to hex', () => {
            const buffer = new Uint8Array([0, 15, 255]).buffer;
            const hex = encryption.arrayBufferToHex(buffer);
            expect(hex).toBe('000fff');
        });
        
        it('should return encryption info', () => {
            const info = encryption.getEncryptionInfo();
            expect(info.algorithm).toBe('AES-256-GCM');
            expect(info.keyLength).toBe(256);
        });
    });
});
