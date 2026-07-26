// js/utils.js - Enterprise Utility Library 2026
/**
 * E-Arsip Digital - Comprehensive Utility Functions
 * Version: 2026.1.0
 * Features: Date/Time, String, Number, Object/Array, DOM, Validation,
 *           File, Color, Encoding, Performance, Security utilities
 * Export: ES Module (default) + Global fallback (window.EArsip.Utils)
 */

const Utils = {
    // ============================================
    // DATE & TIME
    // ============================================
    
    formatDate(date, format = 'long', locale = 'id-ID') {
        if (!date) return '-';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                            'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.getMonth();
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        switch (format) {
            case 'full':
                return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            case 'long':
                return `${day} ${months[month]} ${year}`;
            case 'medium':
                return `${day} ${shortMonths[month]} ${year}`;
            case 'short':
                return `${day}/${month + 1}/${year}`;
            case 'time':
                return `${hours}:${minutes}`;
            case 'time-full':
                return `${hours}:${minutes}:${seconds}`;
            case 'datetime':
                return `${day} ${shortMonths[month]} ${year} ${hours}:${minutes}`;
            case 'datetime-full':
                return `${day} ${months[month]} ${year} ${hours}:${minutes}:${seconds}`;
            case 'iso':
                return d.toISOString();
            case 'iso-date':
                return d.toISOString().split('T')[0];
            default:
                return `${day} ${months[month]} ${year}`;
        }
    },
    
    timeAgo(date) {
        if (!date) return '-';
        
        const now = Date.now();
        const past = new Date(date).getTime();
        const diffMs = now - past;
        
        if (diffMs < 0) return 'Akan datang';
        
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);
        
        if (diffSec < 10) return 'Baru saja';
        if (diffSec < 60) return `${diffSec} detik yang lalu`;
        if (diffMin < 60) return `${diffMin} menit yang lalu`;
        if (diffHour < 24) return `${diffHour} jam yang lalu`;
        if (diffDay < 7) return `${diffDay} hari yang lalu`;
        if (diffWeek < 5) return `${diffWeek} minggu yang lalu`;
        if (diffMonth < 12) return `${diffMonth} bulan yang lalu`;
        return `${diffYear} tahun yang lalu`;
    },
    
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.toDateString() === today.toDateString();
    },
    
    isPast(date) {
        return new Date(date).getTime() < Date.now();
    },
    
    isFuture(date) {
        return new Date(date).getTime() > Date.now();
    },
    
    getDaysBetween(start, end) {
        const diff = new Date(end).getTime() - new Date(start).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    },
    
    // ============================================
    // STRING UTILITIES
    // ============================================
    
    generateId(length = 10) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint32Array(length);
            crypto.getRandomValues(array);
            for (let i = 0; i < length; i++) {
                result += chars[array[i] % chars.length];
            }
        } else {
            for (let i = 0; i < length; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
        }
        
        return result;
    },
    
    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    },
    
    slugify(text) {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    },
    
    truncate(text, length = 100, ellipsis = '...') {
        if (!text || text.length <= length) return text;
        return text.substring(0, length - ellipsis.length) + ellipsis;
    },
    
    capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    },
    
    camelToTitle(text) {
        if (!text) return '';
        const result = text.replace(/([A-Z])/g, ' $1');
        return result.charAt(0).toUpperCase() + result.slice(1);
    },
    
    stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    },
    
    escapeHtml(str) {
        if (!str) return '';
        const entities = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
        };
        return String(str).replace(/[&<>"'\/]/g, char => entities[char]);
    },
    
    escapeRegex(text) {
        if (!text) return '';
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    highlightText(text, query, tag = 'mark') {
        if (!query || !text) return this.escapeHtml(text);
        const escaped = this.escapeRegex(query);
        const regex = new RegExp(`(${escaped})`, 'gi');
        return this.escapeHtml(text).replace(regex, `<${tag} class="highlight">$1</${tag}>`);
    },
    
    // ============================================
    // NUMBER & CURRENCY
    // ============================================
    
    formatCurrency(amount, currency = 'IDR', locale = 'id-ID') {
        const num = Number(amount);
        if (isNaN(num)) return 'Rp 0';
        
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(num);
        } catch {
            return `Rp ${num.toLocaleString('id-ID')}`;
        }
    },
    
    formatNumber(number, decimals = 0, locale = 'id-ID') {
        const num = Number(number);
        if (isNaN(num)) return '0';
        
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    },
    
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    
    formatPercentage(value, decimals = 1) {
        return `${(Number(value) * 100).toFixed(decimals)}%`;
    },
    
    randomNumber(min, max) {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return min + (array[0] % (max - min + 1));
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    clamp(number, min, max) {
        return Math.min(Math.max(Number(number), min), max);
    },
    
    // ============================================
    // OBJECT & ARRAY
    // ============================================
    
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
    },
    
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        
        for (const source of sources) {
            if (!source) continue;
            
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = this.deepMerge(target[key] || {}, source[key]);
                    } else if (Array.isArray(source[key])) {
                        target[key] = [...(target[key] || []), ...source[key]];
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        }
        
        return target;
    },
    
    pick(obj, keys) {
        return keys.reduce((result, key) => {
            if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = obj[key];
            }
            return result;
        }, {});
    },
    
    omit(obj, keys) {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
    },
    
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        if (typeof value === 'string') return value.trim().length === 0;
        return false;
    },
    
    sortBy(array, key, order = 'asc') {
        if (!Array.isArray(array)) return [];
        
        return [...array].sort((a, b) => {
            let valA = a?.[key];
            let valB = b?.[key];
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA === valB) return 0;
            
            const comparison = valA > valB ? 1 : -1;
            return order === 'desc' ? -comparison : comparison;
        });
    },
    
    groupBy(array, key) {
        if (!Array.isArray(array)) return {};
        
        return array.reduce((result, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item?.[key];
            if (!result[groupKey]) result[groupKey] = [];
            result[groupKey].push(item);
            return result;
        }, {});
    },
    
    unique(array, key = null) {
        if (!Array.isArray(array)) return [];
        
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const value = item?.[key];
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        }
        
        return [...new Set(array)];
    },
    
    chunk(array, size) {
        if (!Array.isArray(array)) return [];
        
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },
    
    shuffle(array) {
        if (!Array.isArray(array)) return [];
        
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
    // ============================================
    // FUNCTION UTILITIES
    // ============================================
    
    debounce(func, wait = 300, immediate = false) {
        let timeout;
        
        const debounced = function(...args) {
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
        
        debounced.cancel = () => {
            clearTimeout(timeout);
            timeout = null;
        };
        
        return debounced;
    },
    
    throttle(func, limit = 300) {
        let inThrottle;
        let lastArgs;
        let lastThis;
        
        const throttled = function(...args) {
            lastArgs = args;
            lastThis = this;
            
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                    if (lastArgs) {
                        throttled.apply(lastThis, lastArgs);
                        lastArgs = null;
                    }
                }, limit);
            }
        };
        
        return throttled;
    },
    
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
    },
    
    async retry(func, options = {}) {
        const { retries = 3, delay = 1000, backoff = 2, onRetry = null } = options;
        
        let lastError;
        
        for (let i = 0; i <= retries; i++) {
            try {
                return await func();
            } catch (error) {
                lastError = error;
                
                if (i < retries) {
                    const waitTime = delay * Math.pow(backoff, i);
                    if (onRetry) onRetry(error, i + 1, waitTime);
                    await this.sleep(waitTime);
                }
            }
        }
        
        throw lastError;
    },
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // ============================================
    // DOM UTILITIES
    // ============================================
    
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {}
        
        // Fallback
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch {
            return false;
        }
    },
    
    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || '';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            if (link.href.startsWith('blob:')) {
                URL.revokeObjectURL(link.href);
            }
        }, 100);
    },
    
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
    },
    
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },
    
    setUrlParam(name, value) {
        const params = new URLSearchParams(window.location.search);
        if (value) {
            params.set(name, value);
        } else {
            params.delete(name);
        }
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
    },
    
    // ============================================
    // VALIDATION
    // ============================================
    
    isValidEmail(email) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    },
    
    isValidPhone(phone) {
        const cleaned = String(phone).replace(/[\s\-()]/g, '');
        return /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(cleaned);
    },
    
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    isValidNIP(nip) {
        const cleaned = String(nip).replace(/\s/g, '');
        if (!/^\d{18}$/.test(cleaned)) return false;
        
        const year = parseInt(cleaned.substring(0, 4));
        const month = parseInt(cleaned.substring(4, 6));
        const day = parseInt(cleaned.substring(6, 8));
        
        if (year < 1940 || year > new Date().getFullYear() - 18) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        
        return true;
    },
    
    // ============================================
    // FILE UTILITIES
    // ============================================
    
    getFileExtension(filename) {
        if (!filename) return '';
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    },
    
    getMimeType(extension) {
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'txt': 'text/plain',
            'csv': 'text/csv',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed'
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
    },
    
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    },
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },
    
    // ============================================
    // COLOR UTILITIES
    // ============================================
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },
    
    getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return '#000000';
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    },
    
    // ============================================
    // ENCODING
    // ============================================
    
    base64Encode(text) {
        try {
            return btoa(unescape(encodeURIComponent(text)));
        } catch {
            return btoa(text);
        }
    },
    
    base64Decode(encoded) {
        try {
            return decodeURIComponent(escape(atob(encoded)));
        } catch {
            return atob(encoded);
        }
    },
    
    objectToQueryString(obj) {
        if (!obj) return '';
        
        return Object.entries(obj)
            .filter(([_, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.map(v => 
                        `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`
                    ).join('&');
                }
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .join('&');
    },
    
    queryStringToObject(queryString) {
        const params = new URLSearchParams(queryString);
        const obj = {};
        
        for (const [key, value] of params) {
            if (key.endsWith('[]')) {
                const cleanKey = key.slice(0, -2);
                if (!obj[cleanKey]) obj[cleanKey] = [];
                obj[cleanKey].push(value);
            } else if (obj[key]) {
                if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
                obj[key].push(value);
            } else {
                obj[key] = value;
            }
        }
        
        return obj;
    },
    
    // ============================================
    // ENVIRONMENT
    // ============================================
    
    isBrowser() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    },
    
    isPWA() {
        return typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone
        );
    },
    
    getDeviceType() {
        const ua = navigator.userAgent;
        
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
            if (/iPad|Android/.test(ua) && !/Mobile/.test(ua)) return 'tablet';
            if (window.innerWidth >= 768) return 'tablet';
            return 'mobile';
        }
        
        return 'desktop';
    },
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let name = 'Unknown';
        let version = 'Unknown';
        
        if (ua.includes('Firefox')) {
            name = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edg')) {
            name = 'Edge';
            version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Chrome')) {
            name = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari')) {
            name = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        }
        
        return { name, version };
    },
    
    // ============================================
    // PERFORMANCE
    // ============================================
    
    measurePerformance(label, func) {
        const start = performance.now();
        const result = func();
        const end = performance.now();
        const duration = end - start;
        
        if (duration > 16) { // More than one frame
            console.debug(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
        }
        
        return result;
    },
    
    async measureAsyncPerformance(label, func) {
        const start = performance.now();
        const result = await func();
        const end = performance.now();
        const duration = end - start;
        
        if (duration > 100) {
            console.debug(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
        }
        
        return result;
    }
};

// ============================================
// EXPORTS
// ============================================

// ES Module export
export default Utils;
export { Utils };

// Global fallback
if (typeof window !== 'undefined') {
    window.EArsip = window.EArsip || {};
    window.EArsip.Utils = Utils;
}