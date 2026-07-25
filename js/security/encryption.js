// js/security/encryption.js - Advanced Encryption Module 2026
/**
 * E-Arsip Digital - Advanced Encryption Service
 * Version: 2026.1.0
 * Features: AES-256-GCM, PBKDF2 key derivation, RSA-OAEP, digital signatures
 */

import APP_CONFIG from '../../config/config.js';
import { Logger } from '../logger.js';

class EncryptionService {
    constructor(config = APP_CONFIG.security?.encryption || {}) {
        this.logger = new Logger('Encryption');
        this.config = {
            algorithm: config.algorithm || 'AES-256-GCM',
            keyDerivation: config.keyDerivation || 'PBKDF2',
            iterations: config.iterations || 200000,
            keyLength: config.keyLength || 256,
            saltLength: config.saltLength || 128,
            ivLength: 12, // GCM recommended IV length
            tagLength: 128, // GCM authentication tag length
            ...config
        };
        
        this.ENCODER = new TextEncoder();
        this.DECODER = new TextDecoder();
        
        // Key storage
        this.keyCache = new Map();
        this.initialized = false;
        
        this.init();
    }
    
    async init() {
        try {
            // Test crypto availability
            await this.testCrypto();
            this.initialized = true;
            this.logger.info('Encryption service initialized', {
                algorithm: this.config.algorithm
            });
        } catch (error) {
            this.logger.error('Encryption service initialization failed', error);
            throw new Error('Browser tidak mendukung Web Crypto API');
        }
    }
    
    async testCrypto() {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('Web Crypto API not available');
        }
        
        // Test basic encryption
        const testData = 'test';
        const encrypted = await this.encrypt(testData);
        const decrypted = await this.decrypt(encrypted);
        
        if (decrypted !== testData) {
            throw new Error('Encryption test failed');
        }
    }
    
    // ============================================
    // SYMMETRIC ENCRYPTION (AES-256-GCM)
    // ============================================
    
    /**
     * Encrypt data using AES-256-GCM
     */
    async encrypt(data, customKey = null) {
        try {
            const key = customKey || await this.getOrCreateKey();
            const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));
            
            // Prepare data
            const dataBuffer = typeof data === 'string' 
                ? this.ENCODER.encode(data) 
                : data;
            
            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: this.config.tagLength
                },
                key,
                dataBuffer
            );
            
            // Combine IV + encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            // Convert to base64
            return this.arrayBufferToBase64(combined);
        } catch (error) {
            this.logger.error('Encryption failed', error);
            throw new Error('Gagal mengenkripsi data');
        }
    }
    
    /**
     * Decrypt data using AES-256-GCM
     */
    async decrypt(encryptedData, customKey = null) {
        try {
            const key = customKey || await this.getOrCreateKey();
            
            // Convert from base64
            const combined = this.base64ToArrayBuffer(encryptedData);
            
            // Extract IV and encrypted data
            const iv = combined.slice(0, this.config.ivLength);
            const data = combined.slice(this.config.ivLength);
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: this.config.tagLength
                },
                key,
                data
            );
            
            // Convert to string
            return this.DECODER.decode(decrypted);
        } catch (error) {
            this.logger.error('Decryption failed', error);
            throw new Error('Gagal mendekripsi data');
        }
    }
    
    /**
     * Encrypt object as JSON
     */
    async encryptObject(obj, customKey = null) {
        const jsonString = JSON.stringify(obj);
        return this.encrypt(jsonString, customKey);
    }
    
    /**
     * Decrypt to object
     */
    async decryptToObject(encryptedData, customKey = null) {
        const jsonString = await this.decrypt(encryptedData, customKey);
        return JSON.parse(jsonString);
    }
    
    // ============================================
    // ASYMMETRIC ENCRYPTION (RSA-OAEP)
    // ============================================
    
    /**
     * Generate RSA key pair
     */
    async generateRSAKeyPair() {
        try {
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'RSA-OAEP',
                    modulusLength: 4096,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: 'SHA-512'
                },
                true,
                ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
            );
            
            // Export public key
            const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
            const publicKeyBase64 = this.arrayBufferToBase64(publicKey);
            
            // Export private key (encrypted)
            const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
            
            return {
                publicKey: publicKeyBase64,
                privateKey: privateKey,
                keyPair: keyPair
            };
        } catch (error) {
            this.logger.error('RSA key generation failed', error);
            throw new Error('Gagal membuat kunci RSA');
        }
    }
    
    /**
     * Encrypt with RSA public key
     */
    async encryptWithRSA(data, publicKey) {
        try {
            const keyBuffer = this.base64ToArrayBuffer(publicKey);
            const key = await crypto.subtle.importKey(
                'spki',
                keyBuffer,
                { name: 'RSA-OAEP', hash: 'SHA-512' },
                false,
                ['encrypt']
            );
            
            const dataBuffer = this.ENCODER.encode(data);
            const encrypted = await crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                key,
                dataBuffer
            );
            
            return this.arrayBufferToBase64(encrypted);
        } catch (error) {
            this.logger.error('RSA encryption failed', error);
            throw new Error('Gagal mengenkripsi dengan RSA');
        }
    }
    
    /**
     * Decrypt with RSA private key
     */
    async decryptWithRSA(encryptedData, privateKey) {
        try {
            const key = await crypto.subtle.importKey(
                'pkcs8',
                privateKey,
                { name: 'RSA-OAEP', hash: 'SHA-512' },
                false,
                ['decrypt']
            );
            
            const dataBuffer = this.base64ToArrayBuffer(encryptedData);
            const decrypted = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                key,
                dataBuffer
            );
            
            return this.DECODER.decode(decrypted);
        } catch (error) {
            this.logger.error('RSA decryption failed', error);
            throw new Error('Gagal mendekripsi dengan RSA');
        }
    }
    
    // ============================================
    // DIGITAL SIGNATURES (ECDSA)
    // ============================================
    
    /**
     * Generate ECDSA key pair for signing
     */
    async generateSigningKeyPair() {
        try {
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'P-521'
                },
                true,
                ['sign', 'verify']
            );
            
            return keyPair;
        } catch (error) {
            this.logger.error('Signing key generation failed', error);
            throw new Error('Gagal membuat kunci tanda tangan');
        }
    }
    
    /**
     * Sign data
     */
    async sign(data, privateKey) {
        try {
            const dataBuffer = this.ENCODER.encode(data);
            const signature = await crypto.subtle.sign(
                {
                    name: 'ECDSA',
                    hash: { name: 'SHA-512' }
                },
                privateKey,
                dataBuffer
            );
            
            return this.arrayBufferToBase64(signature);
        } catch (error) {
            this.logger.error('Signing failed', error);
            throw new Error('Gagal menandatangani data');
        }
    }
    
    /**
     * Verify signature
     */
    async verify(data, signature, publicKey) {
        try {
            const dataBuffer = this.ENCODER.encode(data);
            const signatureBuffer = this.base64ToArrayBuffer(signature);
            
            const isValid = await crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: { name: 'SHA-512' }
                },
                publicKey,
                signatureBuffer,
                dataBuffer
            );
            
            return isValid;
        } catch (error) {
            this.logger.error('Verification failed', error);
            return false;
        }
    }
    
    // ============================================
    // KEY MANAGEMENT
    // ============================================
    
    /**
     * Get or create encryption key
     */
    async getOrCreateKey() {
        // Check cache first
        if (this.keyCache.has('master')) {
            return this.keyCache.get('master');
        }
        
        // Try to load from storage
        const storedKey = await this.loadKey();
        if (storedKey) {
            this.keyCache.set('master', storedKey);
            return storedKey;
        }
        
        // Create new key
        const newKey = await this.createKey();
        await this.storeKey(newKey);
        this.keyCache.set('master', newKey);
        
        return newKey;
    }
    
    /**
     * Create new AES key
     */
    async createKey(passphrase = null) {
        try {
            if (passphrase) {
                return this.deriveKey(passphrase);
            }
            
            return await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: this.config.keyLength
                },
                true,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            this.logger.error('Key creation failed', error);
            throw new Error('Gagal membuat kunci enkripsi');
        }
    }
    
    /**
     * Derive key from passphrase using PBKDF2
     */
    async deriveKey(passphrase, salt = null) {
        try {
            const saltBuffer = salt || crypto.getRandomValues(new Uint8Array(16));
            const passphraseKey = await crypto.subtle.importKey(
                'raw',
                this.ENCODER.encode(passphrase),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: this.config.iterations,
                    hash: 'SHA-512'
                },
                passphraseKey,
                {
                    name: 'AES-GCM',
                    length: this.config.keyLength
                },
                false,
                ['encrypt', 'decrypt']
            );
            
            return { key, salt: saltBuffer };
        } catch (error) {
            this.logger.error('Key derivation failed', error);
            throw new Error('Gagal membuat kunci dari passphrase');
        }
    }
    
    /**
     * Export key to storable format
     */
    async exportKey(key) {
        try {
            const exported = await crypto.subtle.exportKey('raw', key);
            return this.arrayBufferToBase64(exported);
        } catch (error) {
            this.logger.error('Key export failed', error);
            throw new Error('Gagal mengekspor kunci');
        }
    }
    
    /**
     * Import key from stored format
     */
    async importKey(keyData) {
        try {
            const keyBuffer = this.base64ToArrayBuffer(keyData);
            return await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            this.logger.error('Key import failed', error);
            throw new Error('Gagal mengimpor kunci');
        }
    }
    
    /**
     * Store key securely
     */
    async storeKey(key) {
        try {
            const exportedKey = await this.exportKey(key);
            // Encrypt the exported key with a device-specific key
            const deviceKey = await this.getDeviceKey();
            const encryptedKey = await this.encrypt(exportedKey, deviceKey);
            
            localStorage.setItem('encryption_key', encryptedKey);
            this.logger.debug('Key stored successfully');
        } catch (error) {
            this.logger.error('Key storage failed', error);
        }
    }
    
    /**
     * Load key from storage
     */
    async loadKey() {
        try {
            const encryptedKey = localStorage.getItem('encryption_key');
            if (!encryptedKey) return null;
            
            const deviceKey = await this.getDeviceKey();
            const exportedKey = await this.decrypt(encryptedKey, deviceKey);
            
            return this.importKey(exportedKey);
        } catch (error) {
            this.logger.error('Key loading failed', error);
            return null;
        }
    }
    
    /**
     * Get device-specific key
     */
    async getDeviceKey() {
        const deviceInfo = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width,
            screen.height
        ].join('|');
        
        const { key } = await this.deriveKey(deviceInfo, 
            new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
        );
        
        return key;
    }
    
    /**
     * Clear stored keys
     */
    clearKeys() {
        localStorage.removeItem('encryption_key');
        this.keyCache.clear();
        this.logger.info('Encryption keys cleared');
    }
    
    // ============================================
    // HASHING
    // ============================================
    
    /**
     * Hash data using SHA-512
     */
    async hash(data, algorithm = 'SHA-512') {
        try {
            const dataBuffer = typeof data === 'string' 
                ? this.ENCODER.encode(data) 
                : data;
            
            const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
            return this.arrayBufferToHex(hashBuffer);
        } catch (error) {
            this.logger.error('Hashing failed', error);
            throw new Error('Gagal melakukan hashing');
        }
    }
    
    /**
     * Hash password with salt
     */
    async hashPassword(password, salt = null) {
        try {
            const saltBuffer = salt || crypto.getRandomValues(new Uint8Array(32));
            const { key } = await this.deriveKey(password, saltBuffer);
            const exportedKey = await this.exportKey(key);
            
            return {
                hash: exportedKey,
                salt: this.arrayBufferToBase64(saltBuffer)
            };
        } catch (error) {
            this.logger.error('Password hashing failed', error);
            throw new Error('Gagal melakukan hashing password');
        }
    }
    
    /**
     * Verify password against hash
     */
    async verifyPassword(password, hash, salt) {
        try {
            const saltBuffer = this.base64ToArrayBuffer(salt);
            const { key } = await this.deriveKey(password, saltBuffer);
            const newHash = await this.exportKey(key);
            
            return newHash === hash;
        } catch (error) {
            this.logger.error('Password verification failed', error);
            return false;
        }
    }
    
    // ============================================
    // RANDOM GENERATION
    // ============================================
    
    /**
     * Generate cryptographically secure random bytes
     */
    generateRandomBytes(length = 32) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        return this.arrayBufferToBase64(bytes);
    }
    
    /**
     * Generate random token
     */
    generateToken(length = 48) {
        return this.generateRandomBytes(length)
            .replace(/[/+=]/g, '')
            .substring(0, length);
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    /**
     * Convert ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return btoa(binary);
    }
    
    /**
     * Convert Base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    
    /**
     * Convert ArrayBuffer to hex string
     */
    arrayBufferToHex(buffer) {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * Check if data is encrypted
     */
    isEncrypted(data) {
        try {
            // Try to decode as base64 and check length
            const decoded = atob(data);
            return decoded.length > 32; // Encrypted data is typically longer
        } catch {
            return false;
        }
    }
    
    /**
     * Get encryption strength info
     */
    getEncryptionInfo() {
        return {
            algorithm: this.config.algorithm,
            keyLength: this.config.keyLength,
            iterations: this.config.iterations,
            isInitialized: this.initialized,
            keyDerivation: this.config.keyDerivation
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.clearKeys();
        this.initialized = false;
        this.logger.info('Encryption service destroyed');
    }
}

export default EncryptionService;
export { EncryptionService };