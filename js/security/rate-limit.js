// js/security/rate-limit.js - Advanced Rate Limiter 2026
/**
 * E-Arsip Digital - Rate Limiter
 * Version: 2026.1.0
 * Features: Sliding window, token bucket, IP-based, endpoint-specific, burst allowance
 */

import { Logger } from '../logger.js';
import APP_CONFIG from '../../config/config.js';

class RateLimiter {
    constructor(config = APP_CONFIG.security?.rateLimit || {}) {
        this.logger = new Logger('RateLimiter');
        
        this.config = {
            enabled: config.enabled !== false,
            windowMs: config.windowMs || 60000,
            maxRequests: config.maxRequests || 100,
            burstMultiplier: config.burstMultiplier || 1.5,
            skipSuccessfulRequests: config.skipSuccessfulRequests || false,
            keyGenerator: config.keyGenerator || null,
            ...config
        };
        
        // Request stores
        this.requests = new Map();
        this.blockedIPs = new Map();
        this.whitelist = new Set(config.whitelist || []);
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            currentActive: 0
        };
        
        // Cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), this.config.windowMs * 2);
        
        this.initialized = false;
        
        this.init();
    }
    
    init() {
        if (!this.config.enabled) {
            this.logger.info('Rate limiter is disabled');
            return;
        }
        
        this.initialized = true;
        this.logger.info('Rate limiter initialized', {
            windowMs: this.config.windowMs,
            maxRequests: this.config.maxRequests
        });
    }
    
    // ============================================
    // RATE LIMITING CORE
    // ============================================
    
    check(key = null, options = {}) {
        if (!this.config.enabled) return { allowed: true };
        
        const identifier = key || this.generateKey();
        const maxRequests = options.maxRequests || this.config.maxRequests;
        const windowMs = options.windowMs || this.config.windowMs;
        
        // Check whitelist
        if (this.whitelist.has(identifier)) {
            return { allowed: true, whitelisted: true };
        }
        
        // Check if blocked
        if (this.isBlocked(identifier)) {
            this.stats.blockedRequests++;
            return { 
                allowed: false, 
                reason: 'IP blocked',
                retryAfter: this.getBlockTimeRemaining(identifier)
            };
        }
        
        this.stats.totalRequests++;
        
        const now = Date.now();
        
        // Get or create window
        if (!this.requests.has(identifier)) {
            this.requests.set(identifier, []);
        }
        
        const window = this.requests.get(identifier);
        
        // Remove expired entries (sliding window)
        const validRequests = window.filter(time => now - time < windowMs);
        this.requests.set(identifier, validRequests);
        
        // Check burst allowance
        const burstLimit = Math.floor(maxRequests * this.config.burstMultiplier);
        
        if (validRequests.length >= burstLimit) {
            // Block the IP temporarily
            this.blockIP(identifier, windowMs * 2);
            this.stats.blockedRequests++;
            
            this.logger.warn('Rate limit exceeded (burst)', {
                identifier,
                count: validRequests.length,
                limit: burstLimit
            });
            
            return { 
                allowed: false, 
                reason: 'Burst limit exceeded',
                retryAfter: windowMs * 2,
                current: validRequests.length,
                limit: burstLimit
            };
        }
        
        if (validRequests.length >= maxRequests) {
            this.stats.blockedRequests++;
            
            this.logger.warn('Rate limit exceeded', {
                identifier,
                count: validRequests.length,
                limit: maxRequests
            });
            
            return { 
                allowed: false, 
                reason: 'Rate limit exceeded',
                retryAfter: this.getRetryAfter(validRequests, windowMs),
                current: validRequests.length,
                limit: maxRequests
            };
        }
        
        // Add current request
        validRequests.push(now);
        this.requests.set(identifier, validRequests);
        this.stats.allowedRequests++;
        
        // Update active count
        this.stats.currentActive = this.requests.size;
        
        return {
            allowed: true,
            remaining: maxRequests - validRequests.length,
            reset: validRequests[0] + windowMs,
            current: validRequests.length,
            limit: maxRequests
        };
    }
    
    // ============================================
    // TOKEN BUCKET ALGORITHM
    // ============================================
    
    checkTokenBucket(key = null, options = {}) {
        const identifier = key || this.generateKey();
        const maxTokens = options.maxTokens || this.config.maxRequests;
        const refillRate = options.refillRate || maxTokens / (this.config.windowMs / 1000);
        
        if (!this.tokenBuckets) {
            this.tokenBuckets = new Map();
        }
        
        let bucket = this.tokenBuckets.get(identifier);
        const now = Date.now();
        
        if (!bucket) {
            bucket = {
                tokens: maxTokens,
                lastRefill: now,
                maxTokens
            };
            this.tokenBuckets.set(identifier, bucket);
        }
        
        // Refill tokens based on time elapsed
        const elapsed = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = elapsed * refillRate;
        
        bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
        
        if (bucket.tokens >= 1) {
            bucket.tokens--;
            return { allowed: true, remainingTokens: bucket.tokens };
        }
        
        const waitTime = ((1 - bucket.tokens) / refillRate) * 1000;
        
        return { 
            allowed: false, 
            reason: 'No tokens available',
            retryAfter: waitTime,
            remainingTokens: bucket.tokens
        };
    }
    
    // ============================================
    // IP BLOCKING
    // ============================================
    
    blockIP(identifier, duration = 300000) {
        this.blockedIPs.set(identifier, {
            blockedAt: Date.now(),
            expiresAt: Date.now() + duration,
            reason: 'rate_limit'
        });
        
        // Clear requests for this identifier
        this.requests.delete(identifier);
    }
    
    unblockIP(identifier) {
        this.blockedIPs.delete(identifier);
    }
    
    isBlocked(identifier) {
        const blockInfo = this.blockedIPs.get(identifier);
        
        if (!blockInfo) return false;
        
        // Check if block has expired
        if (Date.now() > blockInfo.expiresAt) {
            this.blockedIPs.delete(identifier);
            return false;
        }
        
        return true;
    }
    
    getBlockTimeRemaining(identifier) {
        const blockInfo = this.blockedIPs.get(identifier);
        if (!blockInfo) return 0;
        
        return Math.max(0, blockInfo.expiresAt - Date.now());
    }
    
    // ============================================
    // ENDPOINT-SPECIFIC LIMITS
    // ============================================
    
    checkEndpoint(endpoint, key = null) {
        const limits = {
            '/api/auth/login': { maxRequests: 5, windowMs: 60000 },
            '/api/auth/register': { maxRequests: 3, windowMs: 3600000 },
            '/api/upload': { maxRequests: 10, windowMs: 60000 },
            '/api/search': { maxRequests: 30, windowMs: 60000 },
            '/api/export': { maxRequests: 5, windowMs: 300000 }
        };
        
        const endpointConfig = limits[endpoint] || {};
        
        return this.check(key, {
            maxRequests: endpointConfig.maxRequests || this.config.maxRequests,
            windowMs: endpointConfig.windowMs || this.config.windowMs
        });
    }
    
    // ============================================
    // KEY GENERATION
    // ============================================
    
    generateKey() {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator();
        }
        
        // Use combination of IP and user agent
        const ip = this.getClientIP();
        const ua = navigator.userAgent.substring(0, 50);
        
        return `${ip}_${ua}`;
    }
    
    getClientIP() {
        // Client-side can't get real IP, use session-based identifier
        const sessionId = localStorage.getItem('session_id');
        if (sessionId) return sessionId;
        
        // Generate a client fingerprint
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ];
        
        return btoa(components.join('|')).substring(0, 32);
    }
    
    // ============================================
    // WHITELIST MANAGEMENT
    // ============================================
    
    addToWhitelist(identifier) {
        this.whitelist.add(identifier);
    }
    
    removeFromWhitelist(identifier) {
        this.whitelist.delete(identifier);
    }
    
    isWhitelisted(identifier) {
        return this.whitelist.has(identifier);
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getRetryAfter(window, windowMs) {
        if (window.length === 0) return 0;
        
        const oldest = window[0];
        const retryAfter = oldest + windowMs - Date.now();
        
        return Math.max(0, retryAfter);
    }
    
    getRemainingRequests(key) {
        const identifier = key || this.generateKey();
        const window = this.requests.get(identifier) || [];
        const validRequests = window.filter(time => 
            Date.now() - time < this.config.windowMs
        );
        
        return Math.max(0, this.config.maxRequests - validRequests.length);
    }
    
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        // Clean request windows
        for (const [key, window] of this.requests) {
            const valid = window.filter(time => now - time < this.config.windowMs);
            
            if (valid.length === 0) {
                this.requests.delete(key);
                cleaned++;
            } else {
                this.requests.set(key, valid);
            }
        }
        
        // Clean blocked IPs
        for (const [key, blockInfo] of this.blockedIPs) {
            if (now > blockInfo.expiresAt) {
                this.blockedIPs.delete(key);
                cleaned++;
            }
        }
        
        // Clean token buckets
        if (this.tokenBuckets) {
            for (const [key, bucket] of this.tokenBuckets) {
                if (now - bucket.lastRefill > 3600000) { // 1 hour idle
                    this.tokenBuckets.delete(key);
                    cleaned++;
                }
            }
        }
        
        this.stats.currentActive = this.requests.size;
        
        if (cleaned > 0) {
            this.logger.debug('Rate limiter cleanup', { cleaned });
        }
    }
    
    // ============================================
    // STATISTICS
    // ============================================
    
    getStats() {
        return {
            ...this.stats,
            blockedIPs: this.blockedIPs.size,
            whitelisted: this.whitelist.size,
            initialized: this.initialized,
            config: {
                windowMs: this.config.windowMs,
                maxRequests: this.config.maxRequests
            }
        };
    }
    
    getBlockedIPs() {
        const result = [];
        
        this.blockedIPs.forEach((info, ip) => {
            result.push({
                ip,
                blockedAt: info.blockedAt,
                expiresAt: info.expiresAt,
                remaining: Math.max(0, info.expiresAt - Date.now()),
                reason: info.reason
            });
        });
        
        return result;
    }
    
    // ============================================
    // STRICT MODE
    // ============================================
    
    enableStrictMode() {
        this.config.maxRequests = Math.floor(this.config.maxRequests / 2);
        this.config.windowMs = this.config.windowMs * 2;
        this.logger.warn('Strict mode enabled');
    }
    
    disableStrictMode() {
        this.config.maxRequests = APP_CONFIG.security?.rateLimit?.maxRequests || 100;
        this.config.windowMs = APP_CONFIG.security?.rateLimit?.windowMs || 60000;
        this.logger.info('Strict mode disabled');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    isEnabled() {
        return this.config.enabled && this.initialized;
    }
    
    reset() {
        this.requests.clear();
        this.blockedIPs.clear();
        if (this.tokenBuckets) this.tokenBuckets.clear();
        
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            currentActive: 0
        };
        
        this.logger.info('Rate limiter stats reset');
    }
    
    destroy() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.requests.clear();
        this.blockedIPs.clear();
        this.initialized = false;
        this.logger.info('Rate limiter destroyed');
    }
}

const rateLimiter = new RateLimiter();

export default rateLimiter;
export { RateLimiter };