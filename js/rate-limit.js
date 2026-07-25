// FILE: js/rate-limit.js
// ============================================
// RATE LIMITER - E-ARSIP DIGITAL
// ============================================

class RateLimiter {
    constructor() {
        this.limits = new Map();
        this.defaultConfig = {
            maxRequests: 100,
            windowMs: 60000, // 1 menit
            blockDuration: 300000, // 5 menit
            delayAfter: 80, // Mulai delay setelah 80 requests
            delayMs: 1000 // 1 detik delay
        };
    }
    
    /**
     * Check rate limit
     */
    checkLimit(key, config = {}) {
        const mergedConfig = { ...this.defaultConfig, ...config };
        const now = Date.now();
        
        let record = this.limits.get(key);
        
        if (!record) {
            record = {
                requests: [],
                blocked: false,
                blockedUntil: 0,
                totalRequests: 0
            };
            this.limits.set(key, record);
        }
        
        // Check if blocked
        if (record.blocked) {
            if (now < record.blockedUntil) {
                const remainingBlock = Math.ceil((record.blockedUntil - now) / 1000);
                return {
                    allowed: false,
                    message: `Terlalu banyak permintaan. Coba lagi dalam ${remainingBlock} detik.`,
                    retryAfter: remainingBlock
                };
            } else {
                // Unblock
                record.blocked = false;
                record.blockedUntil = 0;
                record.requests = [];
            }
        }
        
        // Remove old requests outside window
        record.requests = record.requests.filter(time => now - time < mergedConfig.windowMs);
        
        // Check limit
        if (record.requests.length >= mergedConfig.maxRequests) {
            record.blocked = true;
            record.blockedUntil = now + mergedConfig.blockDuration;
            
            return {
                allowed: false,
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(mergedConfig.blockDuration / 1000)
            };
        }
        
        // Add current request
        record.requests.push(now);
        record.totalRequests++;
        
        // Check if should delay
        if (record.requests.length >= mergedConfig.delayAfter) {
            return {
                allowed: true,
                delayed: true,
                delayMs: mergedConfig.delayMs
            };
        }
        
        return {
            allowed: true,
            remaining: mergedConfig.maxRequests - record.requests.length
        };
    }
    
    /**
     * Get rate limit status
     */
    getStatus(key, config = {}) {
        const mergedConfig = { ...this.defaultConfig, ...config };
        const record = this.limits.get(key);
        
        if (!record) {
            return {
                allowed: true,
                remaining: mergedConfig.maxRequests,
                reset: Math.ceil(mergedConfig.windowMs / 1000)
            };
        }
        
        const now = Date.now();
        const recentRequests = record.requests.filter(time => now - time < mergedConfig.windowMs);
        
        return {
            allowed: !record.blocked,
            remaining: Math.max(0, mergedConfig.maxRequests - recentRequests.length),
            reset: recentRequests.length > 0 ? 
                Math.ceil((recentRequests[0] + mergedConfig.windowMs - now) / 1000) : 0,
            totalRequests: record.totalRequests,
            blocked: record.blocked,
            blockedUntil: record.blockedUntil
        };
    }
    
    /**
     * Reset rate limit for key
     */
    reset(key) {
        this.limits.delete(key);
    }
    
    /**
     * Reset all rate limits
     */
    resetAll() {
        this.limits.clear();
    }
    
    /**
     * Get all rate limit records
     */
    getAllRecords() {
        const records = {};
        this.limits.forEach((value, key) => {
            records[key] = {
                ...value,
                recentRequests: value.requests.length
            };
        });
        return records;
    }
    
    /**
     * Clean up old records
     */
    cleanup() {
        const now = Date.now();
        this.limits.forEach((value, key) => {
            // Remove records that are not blocked and have no recent requests
            if (!value.blocked && value.requests.every(time => now - time > this.defaultConfig.windowMs)) {
                this.limits.delete(key);
            }
        });
    }
    
    /**
     * Start auto cleanup
     */
    startAutoCleanup(intervalMs = 300000) { // 5 menit
        setInterval(() => {
            this.cleanup();
        }, intervalMs);
    }
    
    /**
     * Create middleware for API calls
     */
    createMiddleware(config = {}) {
        return async (request, next) => {
            const key = request.userId || request.ip || 'anonymous';
            const check = this.checkLimit(key, config);
            
            if (!check.allowed) {
                throw new Error(check.message);
            }
            
            if (check.delayed) {
                await new Promise(resolve => setTimeout(resolve, check.delayMs));
            }
            
            return next(request);
        };
    }
    
    /**
     * Throttle function execution
     */
    static throttle(fn, limit = 1000) {
        let lastCall = 0;
        let timeout = null;
        
        return function(...args) {
            const now = Date.now();
            const remaining = limit - (now - lastCall);
            
            if (remaining <= 0) {
                lastCall = now;
                fn.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    lastCall = Date.now();
                    timeout = null;
                    fn.apply(this, args);
                }, remaining);
            }
        };
    }
    
    /**
     * Debounce function execution
     */
    static debounce(fn, delay = 300) {
        let timeout = null;
        
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
    }
}

// Create global instance
const rateLimiter = new RateLimiter();

// Start auto cleanup
rateLimiter.startAutoCleanup();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateLimiter;
}