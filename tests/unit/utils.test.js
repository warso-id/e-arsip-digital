// tests/unit/utils.test.js - Utility Functions Unit Tests 2026
/**
 * E-Arsip Digital - Utils Unit Tests
 * Version: 2026.1.0
 */

import { describe, it, expect, beforeEach } from '../test-runner.js';
import utils from '../../js/utils.js';

describe('Utils - Date & Time', () => {
    describe('formatDate()', () => {
        it('should format date in full format', () => {
            const date = new Date('2026-01-15');
            const result = utils.formatDate(date, 'full');
            expect(result).toContain('2026');
            expect(result).toContain('Januari');
        });
        
        it('should format date in short format', () => {
            const date = new Date('2026-01-15');
            const result = utils.formatDate(date, 'short');
            expect(result).toBe('15/1/2026');
        });
        
        it('should return "-" for null date', () => {
            expect(utils.formatDate(null)).toBe('-');
        });
        
        it('should return "Invalid Date" for invalid date', () => {
            expect(utils.formatDate('invalid')).toBe('Invalid Date');
        });
        
        it('should format as ISO string', () => {
            const date = new Date('2026-01-15T10:30:00Z');
            const result = utils.formatDate(date, 'iso');
            expect(result).toBe('2026-01-15T10:30:00.000Z');
        });
    });
    
    describe('timeAgo()', () => {
        it('should return "Baru saja" for recent times', () => {
            const now = new Date();
            expect(utils.timeAgo(now)).toBe('Baru saja');
        });
        
        it('should return minutes ago', () => {
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
            expect(utils.timeAgo(fiveMinAgo)).toBe('5 menit yang lalu');
        });
        
        it('should return hours ago', () => {
            const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
            expect(utils.timeAgo(threeHoursAgo)).toBe('3 jam yang lalu');
        });
        
        it('should return days ago', () => {
            const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
            expect(utils.timeAgo(twoDaysAgo)).toBe('2 hari yang lalu');
        });
    });
    
    describe('isToday()', () => {
        it('should return true for today', () => {
            expect(utils.isToday(new Date())).toBe(true);
        });
        
        it('should return false for yesterday', () => {
            const yesterday = new Date(Date.now() - 86400000);
            expect(utils.isToday(yesterday)).toBe(false);
        });
    });
});

describe('Utils - String', () => {
    describe('generateRandomString()', () => {
        it('should generate string with specified length', () => {
            const result = utils.generateRandomString(10);
            expect(result.length).toBe(10);
        });
        
        it('should generate numeric only', () => {
            const result = utils.generateRandomString(8, 'numeric');
            expect(/^\d+$/.test(result)).toBe(true);
        });
        
        it('should generate alpha only', () => {
            const result = utils.generateRandomString(8, 'alpha');
            expect(/^[a-zA-Z]+$/.test(result)).toBe(true);
        });
    });
    
    describe('generateUUID()', () => {
        it('should generate valid UUID v4 format', () => {
            const uuid = utils.generateUUID();
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(regex.test(uuid)).toBe(true);
        });
        
        it('should generate unique UUIDs', () => {
            const uuid1 = utils.generateUUID();
            const uuid2 = utils.generateUUID();
            expect(uuid1).not.toBe(uuid2);
        });
    });
    
    describe('slugify()', () => {
        it('should convert to lowercase slug', () => {
            expect(utils.slugify('Hello World')).toBe('hello-world');
        });
        
        it('should remove special characters', () => {
            expect(utils.slugify('Hello@World!')).toBe('helloworld');
        });
        
        it('should handle multiple spaces', () => {
            expect(utils.slugify('Hello   World')).toBe('hello-world');
        });
    });
    
    describe('truncate()', () => {
        it('should truncate long text', () => {
            const text = 'This is a very long text that needs to be truncated';
            const result = utils.truncate(text, 20);
            expect(result.length).toBe(20);
            expect(result.endsWith('...')).toBe(true);
        });
        
        it('should not truncate short text', () => {
            const text = 'Short text';
            expect(utils.truncate(text, 20)).toBe(text);
        });
    });
    
    describe('capitalize()', () => {
        it('should capitalize first letter', () => {
            expect(utils.capitalize('hello')).toBe('Hello');
        });
        
        it('should handle empty string', () => {
            expect(utils.capitalize('')).toBe('');
        });
    });
    
    describe('stripHtml()', () => {
        it('should remove HTML tags', () => {
            const html = '<p>Hello <b>World</b></p>';
            expect(utils.stripHtml(html)).toBe('Hello World');
        });
    });
});

describe('Utils - Number & Currency', () => {
    describe('formatCurrency()', () => {
        it('should format IDR currency', () => {
            const result = utils.formatCurrency(1000000);
            expect(result).toContain('1.000.000');
        });
        
        it('should format zero', () => {
            const result = utils.formatCurrency(0);
            expect(result).toContain('0');
        });
    });
    
    describe('formatFileSize()', () => {
        it('should format bytes', () => {
            expect(utils.formatFileSize(0)).toBe('0 Bytes');
            expect(utils.formatFileSize(1024)).toBe('1 KB');
            expect(utils.formatFileSize(1048576)).toBe('1 MB');
        });
    });
    
    describe('randomNumber()', () => {
        it('should generate number within range', () => {
            for (let i = 0; i < 100; i++) {
                const num = utils.randomNumber(1, 10);
                expect(num).toBeGreaterThanOrEqual(1);
                expect(num).toBeLessThanOrEqual(10);
            }
        });
    });
});

describe('Utils - Object & Array', () => {
    describe('deepClone()', () => {
        it('should create deep copy of object', () => {
            const original = { a: 1, b: { c: 2 } };
            const cloned = utils.deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned.b).not.toBe(original.b);
        });
        
        it('should clone arrays', () => {
            const original = [1, [2, 3], { a: 4 }];
            const cloned = utils.deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
        });
    });
    
    describe('sortBy()', () => {
        it('should sort array of objects ascending', () => {
            const data = [{ name: 'C' }, { name: 'A' }, { name: 'B' }];
            const sorted = utils.sortBy(data, 'name');
            
            expect(sorted[0].name).toBe('A');
            expect(sorted[2].name).toBe('C');
        });
        
        it('should sort array descending', () => {
            const data = [{ value: 1 }, { value: 3 }, { value: 2 }];
            const sorted = utils.sortBy(data, 'value', 'desc');
            
            expect(sorted[0].value).toBe(3);
            expect(sorted[2].value).toBe(1);
        });
    });
    
    describe('groupBy()', () => {
        it('should group array by key', () => {
            const data = [
                { type: 'A', value: 1 },
                { type: 'B', value: 2 },
                { type: 'A', value: 3 }
            ];
            const grouped = utils.groupBy(data, 'type');
            
            expect(grouped['A'].length).toBe(2);
            expect(grouped['B'].length).toBe(1);
        });
    });
    
    describe('unique()', () => {
        it('should return unique values', () => {
            const result = utils.unique([1, 2, 2, 3, 3, 3]);
            expect(result).toEqual([1, 2, 3]);
        });
    });
    
    describe('isEmpty()', () => {
        it('should return true for empty values', () => {
            expect(utils.isEmpty(null)).toBe(true);
            expect(utils.isEmpty({})).toBe(true);
            expect(utils.isEmpty([])).toBe(true);
            expect(utils.isEmpty('')).toBe(true);
        });
        
        it('should return false for non-empty values', () => {
            expect(utils.isEmpty({ a: 1 })).toBe(false);
            expect(utils.isEmpty([1])).toBe(false);
            expect(utils.isEmpty('text')).toBe(false);
        });
    });
});

describe('Utils - Validation', () => {
    describe('isValidEmail()', () => {
        it('should validate correct email', () => {
            expect(utils.isValidEmail('user@example.com')).toBe(true);
        });
        
        it('should reject invalid email', () => {
            expect(utils.isValidEmail('notanemail')).toBe(false);
            expect(utils.isValidEmail('@example.com')).toBe(false);
            expect(utils.isValidEmail('')).toBe(false);
        });
    });
    
    describe('isValidPhone()', () => {
        it('should validate Indonesian phone numbers', () => {
            expect(utils.isValidPhone('08123456789')).toBe(true);
            expect(utils.isValidPhone('+628123456789')).toBe(true);
        });
        
        it('should reject invalid phone numbers', () => {
            expect(utils.isValidPhone('12345')).toBe(false);
            expect(utils.isValidPhone('abc')).toBe(false);
        });
    });
    
    describe('isValidUrl()', () => {
        it('should validate correct URLs', () => {
            expect(utils.isValidUrl('https://example.com')).toBe(true);
            expect(utils.isValidUrl('http://localhost:8080')).toBe(true);
        });
        
        it('should reject invalid URLs', () => {
            expect(utils.isValidUrl('not a url')).toBe(false);
        });
    });
});

describe('Utils - DOM', () => {
    describe('debounce()', () => {
        it('should debounce function calls', (done) => {
            let callCount = 0;
            const debouncedFn = utils.debounce(() => {
                callCount++;
            }, 100);
            
            debouncedFn();
            debouncedFn();
            debouncedFn();
            
            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 200);
        });
    });
    
    describe('throttle()', () => {
        it('should throttle function calls', (done) => {
            let callCount = 0;
            const throttledFn = utils.throttle(() => {
                callCount++;
            }, 100);
            
            throttledFn();
            throttledFn();
            throttledFn();
            
            expect(callCount).toBe(1);
            
            setTimeout(() => {
                throttledFn();
                expect(callCount).toBe(2);
                done();
            }, 150);
        });
    });
});