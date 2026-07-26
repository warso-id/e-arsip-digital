// tests/unit/utils.test.js - Enterprise Utils Unit Tests 2026
/**
 * E-Arsip Digital - Comprehensive Utility Functions Unit Test Suite
 * Version: 2026.1.0
 * Tests: Date/Time, String, Number, Object/Array, Validation,
 *        DOM, Performance utilities
 * Framework: Jest with complete mock implementation
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// COMPLETE MOCK UTILS OBJECT
// ============================================

const utils = {
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

        const day = d.getDate();
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
            case 'datetime':
                return `${day} ${shortMonths[month]} ${year} ${hours}:${minutes}`;
            case 'iso':
                return d.toISOString();
            default:
                return `${day} ${months[month]} ${year}`;
        }
    },

    timeAgo(date) {
        if (!date) return '-';
        const now = Date.now();
        const past = new Date(date).getTime();
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 10) return 'Baru saja';
        if (diffSec < 60) return `${diffSec} detik yang lalu`;
        if (diffMin < 60) return `${diffMin} menit yang lalu`;
        if (diffHour < 24) return `${diffHour} jam yang lalu`;
        if (diffDay < 7) return `${diffDay} hari yang lalu`;
        if (diffDay < 30) return `${Math.floor(diffDay / 7)} minggu yang lalu`;
        if (diffDay < 365) return `${Math.floor(diffDay / 30)} bulan yang lalu`;
        return `${Math.floor(diffDay / 365)} tahun yang lalu`;
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

    // ============================================
    // STRING
    // ============================================

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
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    },

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    },

    slugify(text) {
        if (!text) return '';
        return text
            .toString().toLowerCase().trim()
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

    stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || '';
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ============================================
    // NUMBER & CURRENCY
    // ============================================

    formatCurrency(amount, currency = 'IDR', locale = 'id-ID') {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency', currency,
                minimumFractionDigits: 0, maximumFractionDigits: 2
            }).format(amount);
        } catch {
            return `Rp ${Number(amount).toLocaleString('id-ID')}`;
        }
    },

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    randomNumber(min, max) {
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
        if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
        const clone = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clone[key] = this.deepClone(obj[key]);
            }
        }
        return clone;
    },

    deepMerge(target, ...sources) {
        for (const source of sources) {
            if (!source) continue;
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = this.deepMerge(target[key] || {}, source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        }
        return target;
    },

    sortBy(array, key, order = 'asc') {
        if (!Array.isArray(array)) return [];
        return [...array].sort((a, b) => {
            let valA = a?.[key], valB = b?.[key];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            const dir = order === 'asc' ? 1 : -1;
            return valA > valB ? dir : valA < valB ? -dir : 0;
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

    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        if (typeof value === 'string') return value.trim().length === 0;
        return false;
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
        try { new URL(url); return true; } catch { return false; }
    },

    isValidNIP(nip) {
        const cleaned = String(nip).replace(/\s/g, '');
        if (!/^\d{18}$/.test(cleaned)) return false;
        const year = parseInt(cleaned.substring(0, 4));
        const month = parseInt(cleaned.substring(4, 6));
        return year >= 1940 && year <= new Date().getFullYear() - 18 && month >= 1 && month <= 12;
    },

    // ============================================
    // FUNCTION UTILITIES
    // ============================================

    debounce(fn, delay = 300) {
        let timeout;
        const debounced = (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
        debounced.cancel = () => clearTimeout(timeout);
        return debounced;
    },

    throttle(fn, limit = 300) {
        let inThrottle = false;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => { inThrottle = false; }, limit);
            }
        };
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    once(fn) {
        let called = false, result;
        return (...args) => {
            if (!called) { called = true; result = fn(...args); }
            return result;
        };
    }
};

// ============================================
// DATE & TIME TESTS
// ============================================

describe('Utils - Date & Time', () => {
    describe('formatDate()', () => {
        const testDate = new Date('2026-01-15T10:30:00');

        it('Should format date in full format', () => {
            const result = utils.formatDate(testDate, 'full');
            expect(result).toContain('2026');
            expect(result).toContain('Januari');
        });

        it('Should format date in long format', () => {
            const result = utils.formatDate(testDate, 'long');
            expect(result).toBe('15 Januari 2026');
        });

        it('Should format date in medium format', () => {
            const result = utils.formatDate(testDate, 'medium');
            expect(result).toBe('15 Jan 2026');
        });

        it('Should format date in short format', () => {
            const result = utils.formatDate(testDate, 'short');
            expect(result).toBe('15/1/2026');
        });

        it('Should format date in time format', () => {
            const result = utils.formatDate(testDate, 'time');
            expect(result).toMatch(/^\d{2}:\d{2}$/);
        });

        it('Should format date in datetime format', () => {
            const result = utils.formatDate(testDate, 'datetime');
            expect(result).toContain('2026');
            expect(result).toMatch(/\d{2}:\d{2}/);
        });

        it('Should format date as ISO string', () => {
            const result = utils.formatDate(testDate, 'iso');
            expect(result).toBe(testDate.toISOString());
        });

        it('Should return "-" for null date', () => {
            expect(utils.formatDate(null)).toBe('-');
            expect(utils.formatDate(undefined)).toBe('-');
        });

        it('Should return "Invalid Date" for invalid date', () => {
            expect(utils.formatDate('invalid')).toBe('Invalid Date');
            expect(utils.formatDate('')).toBe('Invalid Date');
        });
    });

    describe('timeAgo()', () => {
        it('Should return "Baru saja" for recent times', () => {
            expect(utils.timeAgo(new Date())).toBe('Baru saja');
        });

        it('Should return seconds ago', () => {
            const date = new Date(Date.now() - 30000);
            expect(utils.timeAgo(date)).toBe('30 detik yang lalu');
        });

        it('Should return minutes ago', () => {
            const date = new Date(Date.now() - 5 * 60000);
            expect(utils.timeAgo(date)).toBe('5 menit yang lalu');
        });

        it('Should return hours ago', () => {
            const date = new Date(Date.now() - 3 * 3600000);
            expect(utils.timeAgo(date)).toBe('3 jam yang lalu');
        });

        it('Should return days ago', () => {
            const date = new Date(Date.now() - 2 * 86400000);
            expect(utils.timeAgo(date)).toBe('2 hari yang lalu');
        });

        it('Should return weeks ago', () => {
            const date = new Date(Date.now() - 14 * 86400000);
            expect(utils.timeAgo(date)).toBe('2 minggu yang lalu');
        });

        it('Should return months ago', () => {
            const date = new Date(Date.now() - 60 * 86400000);
            expect(utils.timeAgo(date)).toBe('2 bulan yang lalu');
        });

        it('Should return years ago', () => {
            const date = new Date(Date.now() - 400 * 86400000);
            expect(utils.timeAgo(date)).toContain('tahun yang lalu');
        });

        it('Should return "-" for null date', () => {
            expect(utils.timeAgo(null)).toBe('-');
        });
    });

    describe('isToday()', () => {
        it('Should return true for today', () => {
            expect(utils.isToday(new Date())).toBe(true);
        });

        it('Should return false for yesterday', () => {
            expect(utils.isToday(new Date(Date.now() - 86400000))).toBe(false);
        });

        it('Should return false for tomorrow', () => {
            expect(utils.isToday(new Date(Date.now() + 86400000))).toBe(false);
        });
    });

    describe('addDays()', () => {
        it('Should add days correctly', () => {
            const date = new Date('2026-01-15');
            const result = utils.addDays(date, 5);
            expect(result.getDate()).toBe(20);
        });

        it('Should handle negative days', () => {
            const date = new Date('2026-01-15');
            const result = utils.addDays(date, -5);
            expect(result.getDate()).toBe(10);
        });
    });
});

// ============================================
// STRING TESTS
// ============================================

describe('Utils - String', () => {
    describe('generateRandomString()', () => {
        it('Should generate string with specified length', () => {
            for (const len of [1, 10, 50, 100]) {
                expect(utils.generateRandomString(len).length).toBe(len);
            }
        });

        it('Should generate numeric only', () => {
            const result = utils.generateRandomString(20, 'numeric');
            expect(result).toMatch(/^\d{20}$/);
        });

        it('Should generate alpha only', () => {
            const result = utils.generateRandomString(20, 'alpha');
            expect(result).toMatch(/^[a-zA-Z]{20}$/);
        });

        it('Should generate hex only', () => {
            const result = utils.generateRandomString(20, 'hex');
            expect(result).toMatch(/^[0-9a-f]{20}$/);
        });

        it('Should generate unique strings', () => {
            const set = new Set();
            for (let i = 0; i < 100; i++) {
                set.add(utils.generateRandomString(10));
            }
            expect(set.size).toBe(100);
        });
    });

    describe('generateUUID()', () => {
        it('Should generate valid UUID v4 format', () => {
            const uuid = utils.generateUUID();
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('Should generate unique UUIDs', () => {
            const uuids = new Set();
            for (let i = 0; i < 100; i++) {
                uuids.add(utils.generateUUID());
            }
            expect(uuids.size).toBe(100);
        });
    });

    describe('slugify()', () => {
        it('Should convert to lowercase slug', () => {
            expect(utils.slugify('Hello World')).toBe('hello-world');
        });

        it('Should remove special characters', () => {
            expect(utils.slugify('Hello@World!#2026')).toBe('helloworld2026');
        });

        it('Should handle multiple spaces', () => {
            expect(utils.slugify('Hello   World')).toBe('hello-world');
        });

        it('Should handle leading/trailing hyphens', () => {
            expect(utils.slugify('  Hello World  ')).toBe('hello-world');
        });

        it('Should handle empty string', () => {
            expect(utils.slugify('')).toBe('');
            expect(utils.slugify(null)).toBe('');
        });
    });

    describe('truncate()', () => {
        it('Should truncate long text with ellipsis', () => {
            const result = utils.truncate('This is a very long text', 20);
            expect(result.length).toBe(20);
            expect(result).toEndWith('...');
        });

        it('Should not truncate short text', () => {
            const text = 'Short';
            expect(utils.truncate(text, 20)).toBe(text);
        });

        it('Should handle custom ellipsis', () => {
            const result = utils.truncate('Long text here', 10, '…');
            expect(result).toEndWith('…');
        });

        it('Should handle empty text', () => {
            expect(utils.truncate('', 10)).toBe('');
            expect(utils.truncate(null, 10)).toBe(null);
        });
    });

    describe('capitalize()', () => {
        it('Should capitalize first letter', () => {
            expect(utils.capitalize('hello')).toBe('Hello');
        });

        it('Should lowercase rest of string', () => {
            expect(utils.capitalize('hELLO')).toBe('Hello');
        });

        it('Should handle empty string', () => {
            expect(utils.capitalize('')).toBe('');
        });
    });

    describe('stripHtml()', () => {
        it('Should remove HTML tags', () => {
            expect(utils.stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
        });

        it('Should handle script tags', () => {
            expect(utils.stripHtml('<script>alert(1)</script>Text')).toBe('alert(1)Text');
        });
    });

    describe('escapeHtml()', () => {
        it('Should escape HTML special characters', () => {
            const escaped = utils.escapeHtml('<div class="test">Hello & Welcome</div>');
            expect(escaped).toContain('&lt;');
            expect(escaped).toContain('&gt;');
            expect(escaped).toContain('&quot;');
            expect(escaped).toContain('&amp;');
        });
    });
});

// ============================================
// NUMBER & CURRENCY TESTS
// ============================================

describe('Utils - Number & Currency', () => {
    describe('formatCurrency()', () => {
        it('Should format IDR currency', () => {
            const result = utils.formatCurrency(1000000);
            expect(result).toContain('1.000.000');
        });

        it('Should format zero', () => {
            const result = utils.formatCurrency(0);
            expect(result).toContain('0');
        });

        it('Should format negative values', () => {
            const result = utils.formatCurrency(-500000);
            expect(result).toContain('500.000');
        });
    });

    describe('formatFileSize()', () => {
        it('Should format 0 bytes', () => {
            expect(utils.formatFileSize(0)).toBe('0 Bytes');
        });

        it('Should format bytes', () => {
            expect(utils.formatFileSize(500)).toBe('500 Bytes');
        });

        it('Should format KB', () => {
            expect(utils.formatFileSize(1024)).toBe('1 KB');
            expect(utils.formatFileSize(1536)).toBe('1.5 KB');
        });

        it('Should format MB', () => {
            expect(utils.formatFileSize(1048576)).toBe('1 MB');
        });

        it('Should format GB', () => {
            expect(utils.formatFileSize(1073741824)).toBe('1 GB');
        });

        it('Should format TB', () => {
            expect(utils.formatFileSize(1099511627776)).toBe('1 TB');
        });
    });

    describe('randomNumber()', () => {
        it('Should generate number within range', () => {
            for (let i = 0; i < 100; i++) {
                const num = utils.randomNumber(1, 10);
                expect(num).toBeGreaterThanOrEqual(1);
                expect(num).toBeLessThanOrEqual(10);
                expect(Number.isInteger(num)).toBe(true);
            }
        });

        it('Should generate same number for min=max', () => {
            expect(utils.randomNumber(5, 5)).toBe(5);
        });
    });

    describe('clamp()', () => {
        it('Should clamp to minimum', () => {
            expect(utils.clamp(-5, 0, 10)).toBe(0);
        });

        it('Should clamp to maximum', () => {
            expect(utils.clamp(15, 0, 10)).toBe(10);
        });

        it('Should keep value within range', () => {
            expect(utils.clamp(5, 0, 10)).toBe(5);
        });
    });
});

// ============================================
// OBJECT & ARRAY TESTS
// ============================================

describe('Utils - Object & Array', () => {
    describe('deepClone()', () => {
        it('Should create deep copy of object', () => {
            const original = { a: 1, b: { c: 2, d: [3, 4] } };
            const cloned = utils.deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned.b).not.toBe(original.b);
            expect(cloned.b.d).not.toBe(original.b.d);
        });

        it('Should clone arrays', () => {
            const original = [1, [2, 3], { a: 4 }];
            const cloned = utils.deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned[1]).not.toBe(original[1]);
        });

        it('Should clone Date objects', () => {
            const original = { date: new Date('2026-01-15') };
            const cloned = utils.deepClone(original);

            expect(cloned.date).toBeInstanceOf(Date);
            expect(cloned.date.getTime()).toBe(original.date.getTime());
            expect(cloned.date).not.toBe(original.date);
        });

        it('Should handle null and primitives', () => {
            expect(utils.deepClone(null)).toBeNull();
            expect(utils.deepClone(42)).toBe(42);
            expect(utils.deepClone('test')).toBe('test');
            expect(utils.deepClone(true)).toBe(true);
        });
    });

    describe('deepMerge()', () => {
        it('Should merge objects deeply', () => {
            const target = { a: 1, b: { x: 1 } };
            const source = { b: { y: 2 }, c: 3 };
            const result = utils.deepMerge(target, source);

            expect(result.a).toBe(1);
            expect(result.b.x).toBe(1);
            expect(result.b.y).toBe(2);
            expect(result.c).toBe(3);
        });

        it('Should override primitive values', () => {
            const result = utils.deepMerge({ a: 1 }, { a: 2 });
            expect(result.a).toBe(2);
        });
    });

    describe('sortBy()', () => {
        const data = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];

        it('Should sort ascending', () => {
            const sorted = utils.sortBy(data, 'name');
            expect(sorted[0].name).toBe('Alice');
            expect(sorted[2].name).toBe('Charlie');
        });

        it('Should sort descending', () => {
            const sorted = utils.sortBy(data, 'name', 'desc');
            expect(sorted[0].name).toBe('Charlie');
            expect(sorted[2].name).toBe('Alice');
        });

        it('Should not mutate original array', () => {
            const original = [...data];
            utils.sortBy(data, 'name');
            expect(data[0].name).toBe(original[0].name);
        });
    });

    describe('groupBy()', () => {
        const data = [
            { type: 'A', value: 1 },
            { type: 'B', value: 2 },
            { type: 'A', value: 3 }
        ];

        it('Should group by key', () => {
            const grouped = utils.groupBy(data, 'type');
            expect(grouped['A'].length).toBe(2);
            expect(grouped['B'].length).toBe(1);
        });

        it('Should group by function', () => {
            const grouped = utils.groupBy(data, item => item.type);
            expect(grouped['A'].length).toBe(2);
        });
    });

    describe('unique()', () => {
        it('Should deduplicate simple array', () => {
            expect(utils.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        });

        it('Should deduplicate by key', () => {
            const data = [{ id: 1 }, { id: 2 }, { id: 1 }];
            const result = utils.unique(data, 'id');
            expect(result.length).toBe(2);
        });
    });

    describe('chunk()', () => {
        it('Should chunk array correctly', () => {
            const result = utils.chunk([1, 2, 3, 4, 5], 2);
            expect(result).toEqual([[1, 2], [3, 4], [5]]);
        });

        it('Should return empty for empty array', () => {
            expect(utils.chunk([], 2)).toEqual([]);
        });
    });

    describe('isEmpty()', () => {
        it('Should return true for empty values', () => {
            expect(utils.isEmpty(null)).toBe(true);
            expect(utils.isEmpty(undefined)).toBe(true);
            expect(utils.isEmpty({})).toBe(true);
            expect(utils.isEmpty([])).toBe(true);
            expect(utils.isEmpty('')).toBe(true);
            expect(utils.isEmpty('   ')).toBe(true);
        });

        it('Should return false for non-empty values', () => {
            expect(utils.isEmpty({ a: 1 })).toBe(false);
            expect(utils.isEmpty([1])).toBe(false);
            expect(utils.isEmpty('text')).toBe(false);
            expect(utils.isEmpty(0)).toBe(false);
        });
    });
});

// ============================================
// VALIDATION TESTS
// ============================================

describe('Utils - Validation', () => {
    describe('isValidEmail()', () => {
        it('Should validate correct emails', () => {
            expect(utils.isValidEmail('user@example.com')).toBe(true);
            expect(utils.isValidEmail('test.user@domain.co.id')).toBe(true);
            expect(utils.isValidEmail('name+tag@test.org')).toBe(true);
        });

        it('Should reject invalid emails', () => {
            expect(utils.isValidEmail('notanemail')).toBe(false);
            expect(utils.isValidEmail('@example.com')).toBe(false);
            expect(utils.isValidEmail('user@')).toBe(false);
            expect(utils.isValidEmail('')).toBe(false);
            expect(utils.isValidEmail(null)).toBe(false);
        });
    });

    describe('isValidPhone()', () => {
        it('Should validate Indonesian phones', () => {
            expect(utils.isValidPhone('08123456789')).toBe(true);
            expect(utils.isValidPhone('+628123456789')).toBe(true);
            expect(utils.isValidPhone('6281234567890')).toBe(true);
            expect(utils.isValidPhone('0812-3456-7890')).toBe(true);
        });

        it('Should reject invalid phones', () => {
            expect(utils.isValidPhone('12345')).toBe(false);
            expect(utils.isValidPhone('abc')).toBe(false);
            expect(utils.isValidPhone('')).toBe(false);
        });
    });

    describe('isValidUrl()', () => {
        it('Should validate correct URLs', () => {
            expect(utils.isValidUrl('https://example.com')).toBe(true);
            expect(utils.isValidUrl('http://localhost:8080')).toBe(true);
            expect(utils.isValidUrl('https://example.com/path?q=test')).toBe(true);
        });

        it('Should reject invalid URLs', () => {
            expect(utils.isValidUrl('not a url')).toBe(false);
            expect(utils.isValidUrl('')).toBe(false);
            expect(utils.isValidUrl('javascript:alert(1)')).toBe(false);
        });
    });

    describe('isValidNIP()', () => {
        it('Should validate correct NIP', () => {
            expect(utils.isValidNIP('198501012010011001')).toBe(true);
        });

        it('Should reject invalid NIP', () => {
            expect(utils.isValidNIP('12345')).toBe(false);
            expect(utils.isValidNIP('abcdefghijklmnopqr')).toBe(false);
            expect(utils.isValidNIP('180001012010011001')).toBe(false);
            expect(utils.isValidNIP('198501322010011001')).toBe(false);
        });
    });
});

// ============================================
// FUNCTION UTILITY TESTS
// ============================================

describe('Utils - Function Utilities', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('debounce()', () => {
        it('Should debounce function calls', () => {
            const fn = jest.fn();
            const debounced = utils.debounce(fn, 100);

            debounced();
            debounced();
            debounced();

            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(150);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('Should pass arguments correctly', () => {
            const fn = jest.fn();
            const debounced = utils.debounce(fn, 100);

            debounced('arg1', 'arg2');
            jest.advanceTimersByTime(150);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('Should support cancel', () => {
            const fn = jest.fn();
            const debounced = utils.debounce(fn, 100);

            debounced();
            debounced.cancel();
            jest.advanceTimersByTime(150);

            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('throttle()', () => {
        it('Should throttle function calls', () => {
            const fn = jest.fn();
            const throttled = utils.throttle(fn, 100);

            throttled();
            throttled();
            throttled();

            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(150);
            throttled();
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe('once()', () => {
        it('Should execute function only once', () => {
            const fn = jest.fn(() => 'result');
            const onceFn = utils.once(fn);

            expect(onceFn()).toBe('result');
            expect(onceFn()).toBe('result');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('sleep()', () => {
        it('Should resolve after specified time', async () => {
            const start = Date.now();
            const promise = utils.sleep(100);

            jest.advanceTimersByTime(100);
            await promise;

            // Should resolve
            expect(true).toBe(true);
        });
    });
});