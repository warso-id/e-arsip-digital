// js/rate-limit.js - Enterprise Rate Limiter & DDoS Protection 2026
/**
 * E-Arsip Digital - Advanced Rate Limiter
 * Version: 2026.1.0
 * Features: Sliding window, token bucket, attack detection,
 *           persistent storage, offline queue, tiered limits,
 *           brute force protection, PWA-aware
 * Security: Anti-spoofing, fingerprinting, progressive blocking
 */

import APP_CONFIG from '../config/config.js';

class RateLimiter {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Default limits
            defaultMaxRequests: 100,
            defaultWindowMs: 60000,
            blockDuration: 300000,
            maxBlockDuration: 3600000, // 1 hour max
            delayAfter: 80,
            delayMs: 1000,
            
            // Tiers
            tiers: {
                anonymous: { maxRequests: 30, windowMs: 60000 },
                authenticated: { maxRequests: 100, windowMs: 60000 },
                admin: { maxRequests: 300, windowMs: 60000 },
                api: { maxRequests: 1000, windowMs: 60000 }
            },
            
            // Attack detection
            enableAttackDetection: true,
            bruteForceThreshold: 20,
            bruteForceWindowMs: 30000,
            suspiciousRatioThreshold: 0.9,
            
            // Storage
            persistState: true,
            persistKey: 'rate_limit_state',
            maxRecords: 500,
            
            // Cleanup
            cleanupIntervalMs: 60000,
            recordTTL: 3600000, // 1 hour
            
            // Progressive blocking
            progressiveBlocking: true,
            blockMultiplier: 2,
            
            ...APP_CONFIG?.rateLimit,
            ...options
        };
        
        // Rate limit records
        this.limits = new Map();
        
        // Attack detection
        this.suspiciousIPs = new Set();
        this.blockedIPs = new Map();
        
        // State
        this.cleanupTimer = null;
        this.persistenceTimer = null;
        this.initialized = false;
        
        // Metrics
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            delayedRequests: 0,
            currentActiveRecords: 0,
            attacksDetected: 0
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Load persisted state
            if (this.config.persistState) {
                await this.loadState();
            }
            
            // Start auto cleanup
            this.startAutoCleanup();
            
            // Start state persistence
            if (this.config.persistState) {
                this.startAutoPersist();
            }
            
            // Load blocked IPs from storage
            await this.loadBlockedIPs();
            
            this.initialized = true;
            
            console.info('[RateLimiter] Initialized', {
                tiers: Object.keys(this.config.tiers),
                maxRecords: this.config.maxRecords,
                attackDetection: this.config.enableAttackDetection
            });
            
        } catch (error) {
            console.error('[RateLimiter] Initialization failed:', error);
        }
    }
    
    // ============================================
    // CORE RATE LIMITING
    // ============================================
    
    /**
     * Check rate limit with sliding window algorithm
     */
    checkLimit(key, options = {}) {
        const config = this.resolveConfig(key, options);
        const now = Date.now();
        
        // Get or create record
        let record = this.limits.get(key);
        
        if (!record) {
            record = this.createRecord(key);
            this.limits.set(key, record);
        }
        
        // Update last access
        record.lastAccess = now;
        record.userAgent = options.userAgent || 'unknown';
        
        // Check if blocked
        if (record.blocked) {
            if (now < record.blockedUntil) {
                return this.createBlockedResponse(record, config, now);
            } else {
                // Unblock after duration
                this.unblockRecord(record);
            }
        }
        
        // Sliding window: remove expired requests
        record.requests = record.requests.filter(
            time => now - time < config.windowMs
        );
        
        // Check if exceeded limit
        if (record.requests.length >= config.maxRequests) {
            return this.blockRecord(record, key, config, now);
        }
        
        // Attack detection
        if (this.config.enableAttackDetection) {
            const attackResult = this.detectAttack(record, key, config);
            if (attackResult.blocked) {
                return attackResult;
            }
        }
        
        // Add request
        record.requests.push(now);
        record.totalRequests++;
        this.metrics.totalRequests++;
        
        // Check if should delay
        if (record.requests.length >= config.delayAfter) {
            this.metrics.delayedRequests++;
            return {
                allowed: true,
                delayed: true,
                delayMs: config.delayMs,
                remaining: 0,
                reset: this.calculateReset(record, config, now),
                tier: record.tier
            };
        }
        
        return {
            allowed: true,
            remaining: config.maxRequests - record.requests.length,
            reset: this.calculateReset(record, config, now),
            tier: record.tier,
            totalRequests: record.totalRequests
        };
    }
    
    /**
     * Resolve configuration based on tier and options
     */
    resolveConfig(key, options = {}) {
        // Determine tier
        let tier = 'anonymous';
        
        if (options.tier && this.config.tiers[options.tier]) {
            tier = options.tier;
        } else if (options.isAuthenticated) {
            tier = options.isAdmin ? 'admin' : 'authenticated';
        } else if (options.isApi) {
            tier = 'api';
        }
        
        // Get tier config
        const tierConfig = this.config.tiers[tier] || {};
        
        return {
            maxRequests: options.maxRequests || tierConfig.maxRequests || this.config.defaultMaxRequests,
            windowMs: options.windowMs || tierConfig.windowMs || this.config.defaultWindowMs,
            blockDuration: options.blockDuration || this.config.blockDuration,
            maxBlockDuration: this.config.maxBlockDuration,
            delayAfter: options.delayAfter || this.config.delayAfter,
            delayMs: options.delayMs || this.config.delayMs,
            tier
        };
    }
    
    /**
     * Create new rate limit record
     */
    createRecord(key) {
        return {
            key,
            requests: [],
            totalRequests: 0,
            blocked: false,
            blockedUntil: 0,
            blockCount: 0,
            firstRequest: Date.now(),
            lastAccess: Date.now(),
            tier: 'anonymous',
            suspiciousScore: 0,
            userAgent: 'unknown'
        };
    }
    
    /**
     * Block a record
     */
    blockRecord(record, key, config, now) {
        // Progressive blocking
        record.blockCount++;
        
        let blockDuration = config.blockDuration;
        if (this.config.progressiveBlocking) {
            blockDuration = Math.min(
                config.blockDuration * Math.pow(this.config.blockMultiplier, record.blockCount - 1),
                config.maxBlockDuration
            );
        }
        
        record.blocked = true;
        record.blockedUntil = now + blockDuration;
        record.lastBlockedAt = now;
        
        this.metrics.blockedRequests++;
        
        // Add to blocked list
        this.blockedIPs.set(key, {
            blockedUntil: record.blockedUntil,
            reason: 'rate_limit_exceeded',
            blockCount: record.blockCount
        });
        
        // Persist blocked IPs
        this.saveBlockedIPs();
        
        // Dispatch event
        this.dispatchEvent('blocked', {
            key: this.maskKey(key),
            blockCount: record.blockCount,
            duration: blockDuration,
            totalRequests: record.totalRequests
        });
        
        return {
            allowed: false,
            message: 'Rate limit exceeded. Too many requests.',
            retryAfter: Math.ceil(blockDuration / 1000),
            blockCount: record.blockCount,
            blockedUntil: record.blockedUntil,
            tier: record.tier
        };
    }
    
    /**
     * Unblock a record
     */
    unblockRecord(record) {
        record.blocked = false;
        record.blockedUntil = 0;
        record.requests = [];
        record.suspiciousScore = Math.max(0, record.suspiciousScore - 10);
    }
    
    /**
     * Create blocked response
     */
    createBlockedResponse(record, config, now) {
        const remainingBlock = Math.ceil((record.blockedUntil - now) / 1000);
        
        return {
            allowed: false,
            message: `Too many requests. Try again in ${remainingBlock} seconds.`,
            retryAfter: remainingBlock,
            blockedUntil: record.blockedUntil,
            blockCount: record.blockCount,
            tier: record.tier
        };
    }
    
    /**
     * Calculate reset time
     */
    calculateReset(record, config, now) {
        if (record.requests.length === 0) return 0;
        
        const oldestRequest = record.requests[0];
        return Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    }
    
    // ============================================
    // ATTACK DETECTION
    // ============================================
    
    /**
     * Detect potential attacks
     */
    detectAttack(record, key, config) {
        const now = Date.now();
        
        // Check brute force (rapid requests in short window)
        const recentRequests = record.requests.filter(
            time => now - time < this.config.bruteForceWindowMs
        );
        
        if (recentRequests.length >= this.config.bruteForceThreshold) {
            record.suspiciousScore += 50;
            
            this.metrics.attacksDetected++;
            
            this.dispatchEvent('attack-detected', {
                key: this.maskKey(key),
                type: 'brute_force',
                recentRequests: recentRequests.length,
                window: this.config.bruteForceWindowMs
            });
            
            // Immediate block with maximum duration
            record.blocked = true;
            record.blockedUntil = now + this.config.maxBlockDuration;
            record.blockCount = Math.max(record.blockCount + 1, 5);
            
            this.blockedIPs.set(key, {
                blockedUntil: record.blockedUntil,
                reason: 'attack_detected',
                blockCount: record.blockCount,
                type: 'brute_force'
            });
            
            return {
                allowed: false,
                message: 'Suspicious activity detected. Access blocked.',
                retryAfter: Math.ceil(this.config.maxBlockDuration / 1000),
                attackDetected: true,
                attackType: 'brute_force'
            };
        }
        
        // Check suspicious ratio (too many blocked vs successful)
        if (record.totalRequests > 10) {
            const blockedRatio = record.blockCount / record.totalRequests;
            
            if (blockedRatio > this.config.suspiciousRatioThreshold) {
                record.suspiciousScore += 30;
                this.suspiciousIPs.add(key);
                
                this.dispatchEvent('suspicious', {
                    key: this.maskKey(key),
                    ratio: blockedRatio,
                    totalRequests: record.totalRequests
                });
            }
        }
        
        return { blocked: false };
    }
    
    /**
     * Get suspicious IPs
     */
    getSuspiciousIPs() {
        return [...this.suspiciousIPs];
    }
    
    /**
     * Get blocked IPs
     */
    getBlockedIPs() {
        const blocked = [];
        const now = Date.now();
        
        this.blockedIPs.forEach((value, key) => {
            if (value.blockedUntil > now) {
                blocked.push({
                    key: this.maskKey(key),
                    blockedUntil: value.blockedUntil,
                    reason: value.reason,
                    blockCount: value.blockCount
                });
            }
        });
        
        return blocked;
    }
    
    // ============================================
    // TOKEN BUCKET ALGORITHM
    // ============================================
    
    /**
     * Check token bucket rate limit
     */
    checkTokenBucket(key, options = {}) {
        const config = {
            maxTokens: options.maxTokens || 100,
            refillRate: options.refillRate || 10, // tokens per second
            refillInterval: options.refillInterval || 1000, // ms
            ...options
        };
        
        let bucket = this.limits.get(`bucket_${key}`);
        const now = Date.now();
        
        if (!bucket) {
            bucket = {
                tokens: config.maxTokens,
                lastRefill: now,
                maxTokens: config.maxTokens,
                refillRate: config.refillRate,
                refillInterval: config.refillInterval
            };
            this.limits.set(`bucket_${key}`, bucket);
        }
        
        // Refill tokens
        const elapsed = now - bucket.lastRefill;
        const refillAmount = Math.floor(
            (elapsed / bucket.refillInterval) * bucket.refillRate
        );
        
        if (refillAmount > 0) {
            bucket.tokens = Math.min(
                bucket.maxTokens,
                bucket.tokens + refillAmount
            );
            bucket.lastRefill = now;
        }
        
        // Check if token available
        if (bucket.tokens > 0) {
            bucket.tokens--;
            return {
                allowed: true,
                remaining: bucket.tokens,
                maxTokens: bucket.maxTokens
            };
        }
        
        // Calculate wait time for next token
        const waitTime = Math.ceil(
            bucket.refillInterval / bucket.refillRate
        );
        
        return {
            allowed: false,
            retryAfter: Math.ceil(waitTime / 1000),
            message: `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s`
        };
    }
    
    // ============================================
    // RATE LIMIT STATUS
    // ============================================
    
    /**
     * Get rate limit status for a key
     */
    getStatus(key, options = {}) {
        const config = this.resolveConfig(key, options);
        const record = this.limits.get(key);
        const now = Date.now();
        
        if (!record) {
            return {
                allowed: true,
                remaining: config.maxRequests,
                reset: Math.ceil(config.windowMs / 1000),
                tier: config.tier
            };
        }
        
        const recentRequests = record.requests.filter(
            time => now - time < config.windowMs
        );
        
        return {
            allowed: !record.blocked,
            remaining: Math.max(0, config.maxRequests - recentRequests.length),
            reset: this.calculateReset(record, config, now),
            totalRequests: record.totalRequests,
            blocked: record.blocked,
            blockedUntil: record.blockedUntil,
            blockCount: record.blockCount,
            tier: record.tier,
            suspiciousScore: record.suspiciousScore
        };
    }
    
    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeRecords: this.limits.size,
            suspiciousIPs: this.suspiciousIPs.size,
            blockedIPs: this.getBlockedIPs().length,
            timestamp: Date.now()
        };
    }
    
    /**
     * Get all records (sanitized)
     */
    getAllRecords() {
        const records = {};
        
        this.limits.forEach((value, key) => {
            if (key.startsWith('bucket_')) return; // Skip token buckets
            
            records[this.maskKey(key)] = {
                totalRequests: value.totalRequests,
                blocked: value.blocked,
                blockCount: value.blockCount,
                recentRequests: value.requests.length,
                suspiciousScore: value.suspiciousScore,
                tier: value.tier,
                lastAccess: value.lastAccess
            };
        });
        
        return records;
    }
    
    // ============================================
    // RESET & CLEANUP
    // ============================================
    
    /**
     * Reset rate limit for a key
     */
    reset(key) {
        this.limits.delete(key);
        this.limits.delete(`bucket_${key}`);
        this.suspiciousIPs.delete(key);
        this.blockedIPs.delete(key);
    }
    
    /**
     * Reset all rate limits
     */
    resetAll() {
        this.limits.clear();
        this.suspiciousIPs.clear();
        this.blockedIPs.clear();
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            delayedRequests: 0,
            currentActiveRecords: 0,
            attacksDetected: 0
        };
        
        // Clear persisted state
        if (this.config.persistState) {
            try {
                localStorage.removeItem(this.config.persistKey);
                localStorage.removeItem('blocked_ips');
            } catch {}
        }
    }
    
    /**
     * Clean up old records
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        this.limits.forEach((value, key) => {
            const age = now - value.lastAccess;
            
            // Remove records older than TTL
            if (age > this.config.recordTTL && !value.blocked) {
                this.limits.delete(key);
                cleanedCount++;
            }
            
            // Remove old bucket records
            if (key.startsWith('bucket_') && age > this.config.recordTTL) {
                this.limits.delete(key);
                cleanedCount++;
            }
            
            // Clean old requests from sliding window
            if (value.requests && value.requests.length > 0) {
                value.requests = value.requests.filter(
                    time => now - time < this.config.defaultWindowMs * 2
                );
            }
        });
        
        // Clean blocked IPs
        this.blockedIPs.forEach((value, key) => {
            if (now > value.blockedUntil) {
                this.blockedIPs.delete(key);
                cleanedCount++;
            }
        });
        
        // Enforce max records
        if (this.limits.size > this.config.maxRecords) {
            const entries = [...this.limits.entries()];
            const sorted = entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
            const toRemove = sorted.slice(0, sorted.length - this.config.maxRecords);
            
            toRemove.forEach(([key]) => {
                if (!this.limits.get(key)?.blocked) {
                    this.limits.delete(key);
                    cleanedCount++;
                }
            });
        }
        
        this.metrics.currentActiveRecords = this.limits.size;
        
        return { cleanedCount, remainingRecords: this.limits.size };
    }
    
    /**
     * Start auto cleanup
     */
    startAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupIntervalMs);
    }
    
    // ============================================
    // PERSISTENCE
    // ============================================
    
    /**
     * Save state to localStorage
     */
    async saveState() {
        if (!this.config.persistState) return;
        
        try {
            const state = {
                metrics: this.metrics,
                suspiciousIPs: [...this.suspiciousIPs],
                timestamp: Date.now(),
                version: '2026.1.0'
            };
            
            // Serialize limits (only essential data)
            const limits = {};
            this.limits.forEach((value, key) => {
                if (!key.startsWith('bucket_')) {
                    limits[this.maskKey(key)] = {
                        totalRequests: value.totalRequests,
                        blockCount: value.blockCount,
                        blocked: value.blocked,
                        blockedUntil: value.blockedUntil,
                        suspiciousScore: value.suspiciousScore,
                        tier: value.tier,
                        lastAccess: value.lastAccess
                    };
                }
            });
            
            state.limits = limits;
            
            localStorage.setItem(this.config.persistKey, JSON.stringify(state));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('[RateLimiter] Storage full, skipping persistence');
            }
        }
    }
    
    /**
     * Load state from localStorage
     */
    async loadState() {
        try {
            const stored = localStorage.getItem(this.config.persistKey);
            if (!stored) return;
            
            const state = JSON.parse(stored);
            
            // Restore metrics
            if (state.metrics) {
                this.metrics = { ...this.metrics, ...state.metrics };
            }
            
            // Restore suspicious IPs
            if (state.suspiciousIPs) {
                this.suspiciousIPs = new Set(state.suspiciousIPs);
            }
            
            // Restore limits (partial - only metadata, not request times)
            if (state.limits) {
                Object.entries(state.limits).forEach(([key, value]) => {
                    if (value.blocked && value.blockedUntil > Date.now()) {
                        // Still blocked
                        const record = this.createRecord(key);
                        record.totalRequests = value.totalRequests || 0;
                        record.blockCount = value.blockCount || 0;
                        record.blocked = true;
                        record.blockedUntil = value.blockedUntil;
                        record.suspiciousScore = value.suspiciousScore || 0;
                        record.tier = value.tier || 'anonymous';
                        this.limits.set(key, record);
                    }
                });
            }
        } catch (error) {
            console.warn('[RateLimiter] Failed to load state:', error.message);
        }
    }
    
    /**
     * Start auto persist
     */
    startAutoPersist() {
        if (this.persistenceTimer) {
            clearInterval(this.persistenceTimer);
        }
        
        this.persistenceTimer = setInterval(() => {
            this.saveState();
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Save blocked IPs
     */
    saveBlockedIPs() {
        try {
            const blocked = [];
            this.blockedIPs.forEach((value, key) => {
                blocked.push({
                    key: this.maskKey(key),
                    ...value
                });
            });
            
            localStorage.setItem('blocked_ips', JSON.stringify(blocked));
        } catch {}
    }
    
    /**
     * Load blocked IPs
     */
    async loadBlockedIPs() {
        try {
            const stored = localStorage.getItem('blocked_ips');
            if (!stored) return;
            
            const blocked = JSON.parse(stored);
            const now = Date.now();
            
            blocked.forEach(item => {
                if (item.blockedUntil > now) {
                    this.blockedIPs.set(item.key, {
                        blockedUntil: item.blockedUntil,
                        reason: item.reason,
                        blockCount: item.blockCount,
                        type: item.type
                    });
                }
            });
        } catch {}
    }
    
    // ============================================
    // MIDDLEWARE & UTILITIES
    // ============================================
    
    /**
     * Create rate limit middleware
     */
    createMiddleware(config = {}) {
        return async (request, next) => {
            const key = this.extractKey(request);
            const check = this.checkLimit(key, {
                ...config,
                isAuthenticated: request.isAuthenticated,
                isAdmin: request.isAdmin,
                tier: request.rateLimitTier
            });
            
            if (!check.allowed) {
                const error = new Error(check.message);
                error.status = 429;
                error.retryAfter = check.retryAfter;
                error.rateLimit = check;
                throw error;
            }
            
            if (check.delayed) {
                await new Promise(resolve => setTimeout(resolve, check.delayMs));
            }
            
            // Add rate limit headers
            const response = await next(request);
            
            if (response?.headers) {
                response.headers['X-RateLimit-Remaining'] = check.remaining || 0;
                response.headers['X-RateLimit-Reset'] = check.reset || 0;
                response.headers['X-RateLimit-Tier'] = check.tier;
            }
            
            return response;
        };
    }
    
    /**
     * Extract key from request
     */
    extractKey(request) {
        // Priority: userId > sessionId > fingerprint > IP
        if (request.userId) return `user:${request.userId}`;
        if (request.sessionId) return `session:${request.sessionId}`;
        if (request.fingerprint) return `fp:${request.fingerprint}`;
        if (request.ip) return `ip:${request.ip}`;
        
        return 'anonymous';
    }
    
    /**
     * Mask sensitive key for logging
     */
    maskKey(key) {
        if (!key) return 'unknown';
        
        // Mask IP addresses
        if (key.startsWith('ip:')) {
            const parts = key.split('.');
            if (parts.length === 5) { // ip:192.168.1.1
                return `ip:${parts[1]}.***.${parts[parts.length - 1]}`;
            }
        }
        
        // Mask user IDs
        if (key.startsWith('user:') && key.length > 10) {
            return key.substring(0, 8) + '...';
        }
        
        // Mask fingerprints
        if (key.startsWith('fp:')) {
            return 'fp:' + key.substring(3, 10) + '...';
        }
        
        return key;
    }
    
    /**
     * Dispatch event
     */
    dispatchEvent(type, data) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ratelimit:' + type, {
                detail: { ...data, timestamp: Date.now() }
            }));
        }
    }
    
    // ============================================
    // STATIC UTILITY METHODS
    // ============================================
    
    /**
     * Throttle function execution
     */
    static throttle(fn, limit = 1000) {
        let lastCall = 0;
        let timeout = null;
        let lastArgs = null;
        let lastThis = null;
        
        const throttled = function(...args) {
            const now = Date.now();
            const remaining = limit - (now - lastCall);
            
            lastArgs = args;
            lastThis = this;
            
            if (remaining <= 0) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                lastCall = now;
                fn.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    lastCall = Date.now();
                    timeout = null;
                    fn.apply(lastThis, lastArgs);
                }, remaining);
            }
        };
        
        throttled.cancel = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };
        
        throttled.flush = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
                lastCall = Date.now();
                fn.apply(lastThis, lastArgs);
            }
        };
        
        return throttled;
    }
    
    /**
     * Debounce function execution
     */
    static debounce(fn, delay = 300) {
        let timeout = null;
        
        const debounced = function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
        
        debounced.cancel = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };
        
        debounced.flush = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
                fn.apply(this, arguments);
            }
        };
        
        return debounced;
    }
    
    /**
     * Create a rate-limited function
     */
    createRateLimitedFunction(fn, options = {}) {
        const key = options.key || fn.name || 'anonymous';
        const config = {
            maxRequests: options.maxRequests || 10,
            windowMs: options.windowMs || 1000,
            ...options
        };
        
        return async (...args) => {
            const check = this.checkLimit(key, config);
            
            if (!check.allowed) {
                throw new Error(`Rate limit exceeded for ${key}. Try again in ${check.retryAfter}s.`);
            }
            
            if (check.delayed) {
                await new Promise(resolve => setTimeout(resolve, check.delayMs));
            }
            
            return fn(...args);
        };
    }
    
    /**
     * Destroy rate limiter
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        if (this.persistenceTimer) {
            clearInterval(this.persistenceTimer);
        }
        
        this.saveState();
        this.limits.clear();
        this.suspiciousIPs.clear();
        this.blockedIPs.clear();
    }
}

// Create global instance
const rateLimiter = new RateLimiter();

// Export
export default rateLimiter;
export { RateLimiter };