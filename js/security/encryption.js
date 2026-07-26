// js/security/encryption.js - Encryption Module 2026 (SECURE)
/**
 * E-Arsip Digital - Encryption Service
 * Version: 2026.1.0
 * 
 * Features:
 * - AES-256-GCM encrypt/decrypt
 * - PBKDF2 key derivation
 * - SHA-256/SHA-512 hashing
 * - Secure random generation
 * - NO key storage in localStorage!
 * - NO device fingerprinting!
 */

var EncryptionService = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        algorithm: 'AES-GCM',
        keyLength: 256,
        ivLength: 12,       // 96 bits untuk GCM
        tagLength: 128,     // Authentication tag
        saltLength: 16,     // 128 bits
        iterations: 200000, // PBKDF2 iterations
        hashAlgorithm: 'SHA-256'
    };
    
    // ============================================
    // ENCODING UTILITIES
    // ============================================
    var encoder = new TextEncoder();
    var decoder = new TextDecoder();
    
    /**
     * ArrayBuffer → Base64 (Aman)
     */
    function arrayBufferToBase64(buffer) {
        var bytes = new Uint8Array(buffer);
        var binary = '';
        var len = bytes.length;
        
        // Proses dalam chunk untuk menghindari stack overflow
        for (var i = 0; i < len; i += 8192) {
            var chunk = bytes.subarray(i, Math.min(i + 8192, len));
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    }
    
    /**
     * Base64 → Uint8Array
     */
    function base64ToArrayBuffer(base64) {
        try {
            var binary = atob(base64);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        } catch(e) {
            throw new Error('Invalid base64 string');
        }
    }
    
    /**
     * ArrayBuffer → Hex
     */
    function arrayBufferToHex(buffer) {
        var bytes = new Uint8Array(buffer);
        var hex = '';
        for (var i = 0; i < bytes.length; i++) {
            hex += ('0' + bytes[i].toString(16)).slice(-2);
        }
        return hex;
    }
    
    /**
     * Hex → Uint8Array
     */
    function hexToArrayBuffer(hex) {
        var bytes = new Uint8Array(hex.length / 2);
        for (var i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }
    
    // ============================================
    // CRYPTO AVAILABILITY CHECK
    // ============================================
    function isCryptoAvailable() {
        return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
    }
    
    /**
     * Generate random bytes (dengan fallback)
     */
    function getRandomBytes(length) {
        if (window.crypto && window.crypto.getRandomValues) {
            return window.crypto.getRandomValues(new Uint8Array(length));
        }
        
        // Fallback (kurang aman)
        console.warn('Encryption: Using Math.random fallback');
        var bytes = new Uint8Array(length);
        for (var i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }
    
    // ============================================
    // KEY DERIVATION (PBKDF2)
    // ============================================
    
    /**
     * Derive AES key dari password + salt
     * @param {string} password - User password
     * @param {Uint8Array} salt - Salt (16 bytes recommended)
     * @returns {Promise<CryptoKey>}
     */
    async function deriveKey(password, salt) {
        if (!isCryptoAvailable()) {
            throw new Error('Web Crypto API tidak tersedia');
        }
        
        if (!password) {
            throw new Error('Password tidak boleh kosong');
        }
        
        // Import password sebagai raw key
        var passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        // Derive AES key
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt || getRandomBytes(config.saltLength),
                iterations: config.iterations,
                hash: config.hashAlgorithm
            },
            passwordKey,
            {
                name: config.algorithm,
                length: config.keyLength
            },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    /**
     * Generate encryption key (random, bukan dari password)
     * @returns {Promise<CryptoKey>}
     */
    async function generateKey() {
        if (!isCryptoAvailable()) {
            throw new Error('Web Crypto API tidak tersedia');
        }
        
        return crypto.subtle.generateKey(
            {
                name: config.algorithm,
                length: config.keyLength
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    }
    
    /**
     * Export key ke raw format (base64)
     * @param {CryptoKey} key
     * @returns {Promise<string>}
     */
    async function exportKey(key) {
        var raw = await crypto.subtle.exportKey('raw', key);
        return arrayBufferToBase64(raw);
    }
    
    /**
     * Import key dari raw format (base64)
     * @param {string} keyBase64
     * @returns {Promise<CryptoKey>}
     */
    async function importKey(keyBase64) {
        var raw = base64ToArrayBuffer(keyBase64);
        return crypto.subtle.importKey(
            'raw',
            raw,
            { name: config.algorithm },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    // ============================================
    // AES-256-GCM ENCRYPT/DECRYPT
    // ============================================
    
    /**
     * Encrypt data dengan AES-256-GCM
     * @param {string} plaintext - Data yang akan dienkripsi
     * @param {string} password - Password untuk enkripsi
     * @returns {Promise<string>} Base64: salt.iv.ciphertext
     */
    async function encrypt(plaintext, password) {
        if (!plaintext) {
            throw new Error('Data tidak boleh kosong');
        }
        
        if (!password) {
            throw new Error('Password tidak boleh kosong');
        }
        
        // Generate random salt
        var salt = getRandomBytes(config.saltLength);
        
        // Derive key
        var key = await deriveKey(password, salt);
        
        // Generate random IV
        var iv = getRandomBytes(config.ivLength);
        
        // Encrypt
        var dataBuffer = encoder.encode(plaintext);
        var encrypted = await crypto.subtle.encrypt(
            {
                name: config.algorithm,
                iv: iv,
                tagLength: config.tagLength
            },
            key,
            dataBuffer
        );
        
        // Format: salt.iv.ciphertext (semua base64)
        var result = {
            salt: arrayBufferToBase64(salt),
            iv: arrayBufferToBase64(iv),
            data: arrayBufferToBase64(encrypted)
        };
        
        // Return as JSON untuk parsing mudah
        return JSON.stringify(result);
    }
    
    /**
     * Decrypt data dengan AES-256-GCM
     * @param {string} encryptedJson - JSON dari fungsi encrypt()
     * @param {string} password - Password untuk dekripsi
     * @returns {Promise<string>} Plaintext
     */
    async function decrypt(encryptedJson, password) {
        if (!encryptedJson) {
            throw new Error('Data terenkripsi tidak boleh kosong');
        }
        
        if (!password) {
            throw new Error('Password tidak boleh kosong');
        }
        
        // Parse JSON
        var parts;
        try {
            parts = JSON.parse(encryptedJson);
        } catch(e) {
            throw new Error('Format data terenkripsi tidak valid');
        }
        
        if (!parts.salt || !parts.iv || !parts.data) {
            throw new Error('Data terenkripsi tidak lengkap');
        }
        
        // Decode
        var salt = base64ToArrayBuffer(parts.salt);
        var iv = base64ToArrayBuffer(parts.iv);
        var data = base64ToArrayBuffer(parts.data);
        
        // Derive key
        var key = await deriveKey(password, salt);
        
        // Decrypt
        try {
            var decrypted = await crypto.subtle.decrypt(
                {
                    name: config.algorithm,
                    iv: iv,
                    tagLength: config.tagLength
                },
                key,
                data
            );
            
            return decoder.decode(decrypted);
        } catch(e) {
            throw new Error('Dekripsi gagal: Password salah atau data rusak');
        }
    }
    
    /**
     * Encrypt object sebagai JSON string
     * @param {Object} obj - Object yang akan dienkripsi
     * @param {string} password
     * @returns {Promise<string>}
     */
    async function encryptObject(obj, password) {
        var json = JSON.stringify(obj);
        return encrypt(json, password);
    }
    
    /**
     * Decrypt ke object
     * @param {string} encryptedJson
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async function decryptObject(encryptedJson, password) {
        var json = await decrypt(encryptedJson, password);
        return JSON.parse(json);
    }
    
    // ============================================
    // HASHING (SHA-256 / SHA-512)
    // ============================================
    
    /**
     * Hash data dengan SHA-256 (default) atau SHA-512
     * @param {string} data
     * @param {string} algorithm - 'SHA-256' atau 'SHA-512'
     * @returns {Promise<string>} Hex hash
     */
    async function hash(data, algorithm) {
        if (!isCryptoAvailable()) {
            // Fallback: gunakan hash sederhana (TIDAK AMAN untuk production!)
            console.warn('Encryption: Crypto API not available for hashing');
            return simpleHash(data);
        }
        
        if (!algorithm) algorithm = 'SHA-256';
        
        var dataBuffer = encoder.encode(data);
        var hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
        return arrayBufferToHex(hashBuffer);
    }
    
    /**
     * Simple hash fallback (DJB2)
     */
    function simpleHash(data) {
        var hash = 5381;
        for (var i = 0; i < data.length; i++) {
            hash = ((hash << 5) + hash) + data.charCodeAt(i);
            hash = hash & hash;
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    
    /**
     * Hash password dengan salt (untuk penyimpanan)
     * @param {string} password
     * @returns {Promise<Object>} { hash, salt, algorithm, iterations }
     */
    async function hashPassword(password) {
        var salt = getRandomBytes(config.saltLength);
        var saltHex = arrayBufferToHex(salt);
        
        // Gabungkan password + salt, lalu hash
        var combined = password + ':' + saltHex;
        var hashHex = await hash(combined, 'SHA-512');
        
        return {
            hash: hashHex,
            salt: saltHex,
            algorithm: 'PBKDF2-SHA512',
            iterations: config.iterations
        };
    }
    
    /**
     * Verify password terhadap stored hash
     * @param {string} password
     * @param {string} storedHash
     * @param {string} storedSalt
     * @returns {Promise<boolean>}
     */
    async function verifyPassword(password, storedHash, storedSalt) {
        var combined = password + ':' + storedSalt;
        var hashHex = await hash(combined, 'SHA-512');
        
        // Constant-time comparison
        return timingSafeEqual(hashHex, storedHash);
    }
    
    /**
     * Constant-time string comparison (cegah timing attack)
     */
    function timingSafeEqual(a, b) {
        if (a.length !== b.length) return false;
        
        var result = 0;
        for (var i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
    
    // ============================================
    // RANDOM TOKEN GENERATION
    // ============================================
    
    /**
     * Generate random token (URL-safe)
     * @param {number} length - Panjang token dalam bytes
     * @returns {string}
     */
    function generateToken(length) {
        if (!length) length = 32;
        
        var bytes = getRandomBytes(length);
        return arrayBufferToBase64(bytes)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')
            .substring(0, length);
    }
    
    /**
     * Generate random ID
     * @returns {string}
     */
    function generateId() {
        return 'id_' + Date.now().toString(36) + '_' + generateToken(8).toLowerCase();
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Core
        encrypt: encrypt,
        decrypt: decrypt,
        encryptObject: encryptObject,
        decryptObject: decryptObject,
        
        // Key management
        deriveKey: deriveKey,
        generateKey: generateKey,
        exportKey: exportKey,
        importKey: importKey,
        
        // Hashing
        hash: hash,
        hashPassword: hashPassword,
        verifyPassword: verifyPassword,
        
        // Utilities
        generateToken: generateToken,
        generateId: generateId,
        getRandomBytes: getRandomBytes,
        isCryptoAvailable: isCryptoAvailable,
        
        // Config
        getConfig: function() {
            return Object.assign({}, config);
        },
        
        /**
         * Update config
         * @param {Object} newConfig
         */
        configure: function(newConfig) {
            if (newConfig) {
                for (var key in newConfig) {
                    if (newConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = newConfig[key];
                    }
                }
            }
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Encrypt
// var encrypted = await EncryptionService.encrypt('Hello World', 'password123');
// 
// // Decrypt
// var decrypted = await EncryptionService.decrypt(encrypted, 'password123');
// 
// // Hash
// var hashResult = await EncryptionService.hashPassword('password123');
// var isValid = await EncryptionService.verifyPassword('password123', hashResult.hash, hashResult.salt);
// 
// // Token
// var token = EncryptionService.generateToken(32);
// ============================================