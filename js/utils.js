// js/utils.js - Advanced Utility Functions 2026
/**
 * E-Arsip Digital - Utility Functions
 * Version: 2026.1.0
 * Provides common utility functions for the entire application
 */

import APP_CONFIG from '../config/config.js';
import { Logger } from './logger.js';

const logger = new Logger('Utils');

class Utils {
    constructor() {
        this.memoizeCache = new Map();
        this.debounceTimers = new Map();
        this.throttleTimestamps = new Map();
    }

    // ============================================
    // DATE & TIME UTILITIES
    // ============================================
    
    /**
     * Format date to Indonesian locale
     */
    formatDate(date, format = 'full', locale = 'id-ID') {
        if (!date) return '-';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        
        const options = {
            full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
            long: { year: 'numeric', month: 'long', day: 'numeric' },
            medium: { year: 'numeric', month: 'short', day: 'numeric' },
            short: { day: 'numeric', month: 'numeric', year: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            iso: null
        };
        
        if (format === 'iso') {
            return d.toISOString();
        }
        
        return d.toLocaleDateString(locale, options[format] || options.full);
    }

    /**
     * Format time ago (e.g., "5 menit yang lalu")
     */
    timeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);
        
        if (diffSec < 60) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit yang lalu`;
        if (diffHour < 24) return `${diffHour} jam yang lalu`;
        if (diffDay < 7) return `${diffDay} hari yang lalu`;
        if (diffWeek < 4) return `${diffWeek} minggu yang lalu`;
        if (diffMonth < 12) return `${diffMonth} bulan yang lalu`;
        return `${diffYear} tahun yang lalu`;
    }

    /**
     * Add days to date
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Get date range
     */
    getDateRange(startDate, endDate) {
        const dates = [];
        let currentDate = new Date(startDate);
        const end = new Date(endDate);
        
        while (currentDate <= end) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
    }

    /**
     * Check if date is today
     */
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    }

    // ============================================
    // STRING UTILITIES
    // ============================================
    
    /**
     * Generate random string
     */
    generateRandomString(length = 10, charset = 'alphanumeric') {
        const charsets = {
            numeric: '0123456789',
            alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            alphanumeric: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            hex: '0123456789abcdef',
            special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
        };
        
        const chars = charsets[charset] || charsets.alphanumeric;
        let result = '';
        
        // Use crypto for better randomness
        const array = new Uint32Array(length);
        crypto.getRandomValues(array);
        
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
        
        return result;
    }

    /**
     * Generate UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Slugify string
     */
    slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    /**
     * Truncate text with ellipsis
     */
    truncate(text, length = 100, ellipsis = '...') {
        if (!text || text.length <= length) return text;
        return text.substring(0, length - ellipsis.length) + ellipsis;
    }

    /**
     * Capitalize first letter
     */
    capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Convert camelCase to Title Case
     */
    camelToTitle(text) {
        const result = text.replace(/([A-Z])/g, ' $1');
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    /**
     * Strip HTML tags
     */
    stripHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    }

    /**
     * Highlight search text
     */
    highlightText(text, query, tag = 'mark') {
        if (!query) return text;
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, `<${tag} class="highlight">$1</${tag}>`);
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ============================================
    // NUMBER & CURRENCY UTILITIES
    // ============================================
    
    /**
     * Format currency (IDR)
     */
    formatCurrency(amount, currency = 'IDR', locale = 'id-ID') {
        const options = {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        };
        
        return new Intl.NumberFormat(locale, options).format(amount);
    }

    /**
     * Format number with thousand separator
     */
    formatNumber(number, decimals = 0, locale = 'id-ID') {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format percentage
     */
    formatPercentage(value, decimals = 1) {
        return `${(value * 100).toFixed(decimals)}%`;
    }

    /**
     * Generate random number between min and max
     */
    randomNumber(min, max) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return min + (array[0] % (max - min + 1));
    }

    /**
     * Clamp number between min and max
     */
    clamp(number, min, max) {
        return Math.min(Math.max(number, min), max);
    }

    // ============================================
    // OBJECT & ARRAY UTILITIES
    // ============================================
    
    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof RegExp) return new RegExp(obj);
        if (obj instanceof Map) return new Map(obj);
        if (obj instanceof Set) return new Set(obj);
        
        const clone = Array.isArray(obj) ? [] : {};
        
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clone[key] = this.deepClone(obj[key]);
            }
        }
        
        return clone;
    }

    /**
     * Deep merge objects
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else if (Array.isArray(source[key])) {
                    target[key] = target[key] || [];
                    target[key] = [...new Set([...target[key], ...source[key]])];
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    }

    /**
     * Pick specific keys from object
     */
    pick(obj, keys) {
        return keys.reduce((result, key) => {
            if (obj && obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            }
            return result;
        }, {});
    }

    /**
     * Omit specific keys from object
     */
    omit(obj, keys) {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
    }

    /**
     * Check if value is object
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Check if object is empty
     */
    isEmpty(obj) {
        if (!obj) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return !obj;
    }

    /**
     * Sort array of objects by key
     */
    sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (order === 'asc') {
                return valA > valB ? 1 : valA < valB ? -1 : 0;
            } else {
                return valA < valB ? 1 : valA > valB ? -1 : 0;
            }
        });
    }

    /**
     * Group array by key
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!result[groupKey]) {
                result[groupKey] = [];
            }
            result[groupKey].push(item);
            return result;
        }, {});
    }

    /**
     * Unique array values
     */
    unique(array, key = null) {
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const value = item[key];
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        }
        return [...new Set(array)];
    }

    /**
     * Chunk array into smaller arrays
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Shuffle array (Fisher-Yates)
     */
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ============================================
    // DOM UTILITIES
    // ============================================
    
    /**
     * Debounce function
     */
    debounce(func, wait = 300, immediate = false) {
        let timeout;
        
        return function executedFunction(...args) {
            const context = this;
            
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func.apply(context, args);
        };
    }

    /**
     * Throttle function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        
        return function executedFunction(...args) {
            const context = this;
            
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Memoize function results
     */
    memoize(func, resolver = null) {
        const memoizeFn = (...args) => {
            const key = resolver ? resolver(...args) : JSON.stringify(args);
            
            if (memoizeFn.cache.has(key)) {
                return memoizeFn.cache.get(key);
            }
            
            const result = func.apply(this, args);
            memoizeFn.cache.set(key, result);
            
            return result;
        };
        
        memoizeFn.cache = new Map();
        return memoizeFn;
    }

    /**
     * Once function (run only once)
     */
    once(func) {
        let called = false;
        let result;
        
        return function(...args) {
            if (!called) {
                called = true;
                result = func.apply(this, args);
            }
            return result;
        };
    }

    /**
     * Retry function with exponential backoff
     */
    async retry(func, options = {}) {
        const {
            retries = 3,
            delay = 1000,
            backoff = 2,
            onRetry = null
        } = options;
        
        for (let i = 0; i <= retries; i++) {
            try {
                return await func();
            } catch (error) {
                if (i === retries) throw error;
                
                const waitTime = delay * Math.pow(backoff, i);
                if (onRetry) onRetry(error, i + 1, waitTime);
                await this.sleep(waitTime);
            }
        }
    }

    /**
     * Sleep/delay function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Copy to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                return true;
            } catch {
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    /**
     * Download file
     */
    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Scroll to element
     */
    scrollTo(element, options = {}) {
        const target = typeof element === 'string' 
            ? document.querySelector(element) 
            : element;
        
        if (!target) return;
        
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            ...options
        });
    }

    // ============================================
    // VALIDATION UTILITIES
    // ============================================
    
    /**
     * Validate email
     */
    isValidEmail(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    }

    /**
     * Validate phone number (Indonesia)
     */
    isValidPhone(phone) {
        const re = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
        return re.test(phone.replace(/[\s-]/g, ''));
    }

    /**
     * Validate URL
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate NIP (Indonesian civil servant number)
     */
    isValidNIP(nip) {
        const re = /^\d{18}$/;
        if (!re.test(nip)) return false;
        
        // Additional validation logic for NIP
        const birthDate = nip.substring(0, 8);
        const birthYear = parseInt(birthDate.substring(0, 4));
        const birthMonth = parseInt(birthDate.substring(4, 6));
        const birthDay = parseInt(birthDate.substring(6, 8));
        
        if (birthYear < 1900 || birthYear > new Date().getFullYear()) return false;
        if (birthMonth < 1 || birthMonth > 12) return false;
        if (birthDay < 1 || birthDay > 31) return false;
        
        return true;
    }

    // ============================================
    // FILE UTILITIES
    // ============================================
    
    /**
     * Get file extension
     */
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * Get MIME type from extension
     */
    getMimeType(extension) {
        const mimeTypes = {
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            txt: 'text/plain',
            csv: 'text/csv',
            zip: 'application/zip'
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
    }

    /**
     * Read file as base64
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // COLOR UTILITIES
    // ============================================
    
    /**
     * Generate random color
     */
    randomColor(format = 'hex') {
        const r = this.randomNumber(0, 255);
        const g = this.randomNumber(0, 255);
        const b = this.randomNumber(0, 255);
        
        if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`;
        if (format === 'hsl') {
            const h = this.randomNumber(0, 360);
            const s = this.randomNumber(40, 70);
            const l = this.randomNumber(40, 60);
            return `hsl(${h}, ${s}%, ${l}%)`;
        }
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Get contrast color (black or white)
     */
    getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return '#000000';
        
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // ============================================
    // ENCODING UTILITIES
    // ============================================
    
    /**
     * Base64 encode
     */
    base64Encode(text) {
        return btoa(unescape(encodeURIComponent(text)));
    }

    /**
     * Base64 decode
     */
    base64Decode(encoded) {
        return decodeURIComponent(escape(atob(encoded)));
    }

    /**
     * URL encode object to query string
     */
    objectToQueryString(obj) {
        return Object.entries(obj)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
    }

    /**
     * Parse query string to object
     */
    queryStringToObject(queryString) {
        const params = new URLSearchParams(queryString);
        const obj = {};
        
        for (const [key, value] of params) {
            obj[key] = value;
        }
        
        return obj;
    }

    // ============================================
    // DEBOUNCE/THROTTLE WITH MEMORY
    // ============================================
    
    debounceWithKey(key, func, wait = 300) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        this.debounceTimers.set(key, setTimeout(() => {
            this.debounceTimers.delete(key);
            func();
        }, wait));
    }

    throttleWithKey(key, func, limit = 300) {
        const now = Date.now();
        const lastRun = this.throttleTimestamps.get(key) || 0;
        
        if (now - lastRun >= limit) {
            this.throttleTimestamps.set(key, now);
            func();
        }
    }

    // ============================================
    // CACHE UTILITIES
    // ============================================
    
    memoizeWithTTL(func, ttl = 60000, resolver = null) {
        const cache = new Map();
        
        return (...args) => {
            const key = resolver ? resolver(...args) : JSON.stringify(args);
            const cached = cache.get(key);
            
            if (cached && Date.now() - cached.timestamp < ttl) {
                return cached.value;
            }
            
            const value = func.apply(this, args);
            cache.set(key, { value, timestamp: Date.now() });
            
            return value;
        };
    }

    clearMemoizeCache() {
        this.memoizeCache.clear();
    }

    // ============================================
    // ENVIRONMENT UTILITIES
    // ============================================
    
    /**
     * Check if running in browser
     */
    isBrowser() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    /**
     * Check if running in development
     */
    isDevelopment() {
        return APP_CONFIG.app.environment === 'development';
    }

    /**
     * Check if running in production
     */
    isProduction() {
        return APP_CONFIG.app.environment === 'production';
    }

    /**
     * Get browser info
     */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        if (ua.includes('Firefox')) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
            version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Chrome')) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari')) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        }
        
        return { browser, version, userAgent: ua };
    }

    /**
     * Get device type
     */
    getDeviceType() {
        const ua = navigator.userAgent;
        
        if (/mobile/i.test(ua)) return 'mobile';
        if (/tablet/i.test(ua)) return 'tablet';
        if (/iPad|Android/.test(ua) && !/Mobile/.test(ua)) return 'tablet';
        
        return 'desktop';
    }

    // ============================================
    // PERFORMANCE UTILITIES
    // ============================================
    
    /**
     * Measure function performance
     */
    measurePerformance(label, func) {
        const start = performance.now();
        const result = func();
        const end = performance.now();
        
        logger.debug(`Performance [${label}]`, { duration: `${(end - start).toFixed(2)}ms` });
        
        return result;
    }

    /**
     * Batch DOM updates
     */
    batchDOMUpdates(callback) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                callback();
                resolve();
            });
        });
    }
}

// Create singleton instance
const utils = new Utils();

export default utils;
export { Utils };