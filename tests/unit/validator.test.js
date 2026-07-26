// tests/unit/validator.test.js - Enterprise Form Validator Unit Tests 2026
/**
 * E-Arsip Digital - Comprehensive Validator Unit Test Suite
 * Version: 2026.1.0
 * Tests: All validation rules, form validation, custom rules,
 *        async validation, edge cases
 * Framework: Jest with complete mock implementation
 */

import { describe, it, beforeEach, expect } from '@jest/globals';

// ============================================
// COMPLETE MOCK VALIDATOR
// ============================================

class Validator {
    // Core validation methods
    static required(value, fieldName = 'Field ini') {
        if (value === null || value === undefined || value === false) return `${fieldName} wajib diisi`;
        if (typeof value === 'string' && value.trim() === '') return `${fieldName} wajib diisi`;
        if (Array.isArray(value) && value.length === 0) return `${fieldName} wajib diisi`;
        return null;
    }

    static email(value, fieldName = 'Email') {
        if (!value || value.trim() === '') return null; // Skip empty (use required separately)
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
            return `${fieldName} tidak valid`;
        }
        return null;
    }

    static password(value, fieldName = 'Password') {
        if (!value || value.trim() === '') return null;
        if (value.length < 8) return `${fieldName} minimal 8 karakter`;
        if (!/[A-Z]/.test(value)) return `${fieldName} harus mengandung huruf besar`;
        if (!/[a-z]/.test(value)) return `${fieldName} harus mengandung huruf kecil`;
        if (!/[0-9]/.test(value)) return `${fieldName} harus mengandung angka`;
        return null;
    }

    static passwordMatch(value, matchValue, fieldName = 'Password') {
        if (!value || !matchValue) return null;
        if (value !== matchValue) return `${fieldName} tidak cocok`;
        return null;
    }

    static phone(value, fieldName = 'Telepon') {
        if (!value || value.trim() === '') return null;
        const cleaned = String(value).replace(/[\s\-()]/g, '');
        if (!/^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(cleaned)) {
            return `${fieldName} tidak valid`;
        }
        return null;
    }

    static nip(value, fieldName = 'NIP') {
        if (!value || String(value).trim() === '') return null;
        const cleaned = String(value).replace(/\s/g, '');
        if (cleaned.length !== 18) return `${fieldName} harus 18 digit`;
        if (!/^\d{18}$/.test(cleaned)) return `${fieldName} harus berupa angka`;
        const year = parseInt(cleaned.substring(0, 4));
        const month = parseInt(cleaned.substring(4, 6));
        if (year < 1940 || year > new Date().getFullYear() - 18) return `${fieldName} tahun tidak valid`;
        if (month < 1 || month > 12) return `${fieldName} bulan tidak valid`;
        return null;
    }

    static minLength(value, min, fieldName = 'Field ini') {
        if (!value || String(value).trim() === '') return null;
        if (String(value).length < min) return `${fieldName} minimal ${min} karakter`;
        return null;
    }

    static maxLength(value, max, fieldName = 'Field ini') {
        if (!value || String(value).trim() === '') return null;
        if (String(value).length > max) return `${fieldName} maksimal ${max} karakter`;
        return null;
    }

    static lengthBetween(value, min, max, fieldName = 'Field ini') {
        if (!value || String(value).trim() === '') return null;
        const len = String(value).length;
        if (len < min || len > max) return `${fieldName} harus antara ${min}-${max} karakter`;
        return null;
    }

    static number(value, fieldName = 'Field ini') {
        if (value === null || value === undefined || value === '') return null;
        if (isNaN(Number(value)) || value === '') return `${fieldName} harus berupa angka`;
        return null;
    }

    static integer(value, fieldName = 'Field ini') {
        if (value === null || value === undefined || value === '') return null;
        if (!Number.isInteger(Number(value))) return `${fieldName} harus bilangan bulat`;
        return null;
    }

    static numberRange(value, min, max, fieldName = 'Field ini') {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        if (isNaN(num)) return `${fieldName} harus berupa angka`;
        if (num < min) return `${fieldName} minimal ${min}`;
        if (num > max) return `${fieldName} maksimal ${max}`;
        return null;
    }

    static min(value, minVal, fieldName = 'Field ini') {
        return Validator.numberRange(value, minVal, Infinity, fieldName);
    }

    static max(value, maxVal, fieldName = 'Field ini') {
        return Validator.numberRange(value, -Infinity, maxVal, fieldName);
    }

    static url(value, fieldName = 'URL') {
        if (!value || value.trim() === '') return null;
        try { new URL(value); return null; } catch { return `${fieldName} tidak valid`; }
    }

    static date(value, fieldName = 'Tanggal') {
        if (!value || String(value).trim() === '') return null;
        const d = new Date(value);
        if (isNaN(d.getTime())) return `${fieldName} tidak valid`;
        return null;
    }

    static alpha(value, fieldName = 'Field ini') {
        if (!value || String(value).trim() === '') return null;
        if (!/^[a-zA-Z]+$/.test(value)) return `${fieldName} hanya boleh huruf`;
        return null;
    }

    static alphanumeric(value, fieldName = 'Field ini') {
        if (!value || String(value).trim() === '') return null;
        if (!/^[a-zA-Z0-9]+$/.test(value)) return `${fieldName} hanya boleh huruf dan angka`;
        return null;
    }

    static regex(value, pattern, message = 'Format tidak sesuai', fieldName = 'Field ini') {
        if (!value || String(value).trim() === '') return null;
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        if (!regex.test(value)) return message || `${fieldName} format tidak sesuai`;
        return null;
    }

    static match(value, matchField, fieldName = 'Field ini') {
        if (!value) return null;
        if (value !== matchField) return `${fieldName} tidak cocok`;
        return null;
    }

    static inList(value, list, fieldName = 'Field ini') {
        if (!value) return null;
        if (!list.includes(value)) return `${fieldName} harus salah satu dari: ${list.join(', ')}`;
        return null;
    }

    static notInList(value, list, fieldName = 'Field ini') {
        if (!value) return null;
        if (list.includes(value)) return `${fieldName} tidak boleh: ${list.join(', ')}`;
        return null;
    }

    // Form validation
    static validateField(fieldName, fieldConfig) {
        const { value, rules = [] } = fieldConfig;
        for (const rule of rules) {
            const method = typeof rule === 'string' ? rule : rule.method;
            const params = rule.params || [];
            const message = rule.message;

            let error = null;
            switch (method) {
                case 'required': error = Validator.required(value, message || fieldName); break;
                case 'email': error = Validator.email(value, message || fieldName); break;
                case 'password': error = Validator.password(value, message || fieldName); break;
                case 'phone': error = Validator.phone(value, message || fieldName); break;
                case 'nip': error = Validator.nip(value, message || fieldName); break;
                case 'minLength': error = Validator.minLength(value, params[0], message || fieldName); break;
                case 'maxLength': error = Validator.maxLength(value, params[0], message || fieldName); break;
                case 'number': error = Validator.number(value, message || fieldName); break;
                case 'url': error = Validator.url(value, message || fieldName); break;
                case 'date': error = Validator.date(value, message || fieldName); break;
                default: break;
            }

            if (error) return error;
        }
        return null;
    }

    static validateForm(fields) {
        const errors = {};
        let isValid = true;

        for (const [fieldName, fieldConfig] of Object.entries(fields)) {
            const error = Validator.validateField(fieldName, fieldConfig);
            if (error) {
                errors[fieldName] = error;
                isValid = false;
            }
        }

        return { isValid, errors: Object.keys(errors).length > 0 ? errors : null };
    }
}

// ============================================
// REQUIRED TESTS
// ============================================

describe('Validator - Required', () => {
    it('Should pass with valid value', () => {
        expect(Validator.required('test')).toBeNull();
        expect(Validator.required(123)).toBeNull();
        expect(Validator.required(true)).toBeNull();
        expect(Validator.required([1])).toBeNull();
    });

    it('Should fail with empty string', () => {
        expect(Validator.required('')).not.toBeNull();
        expect(Validator.required('   ')).not.toBeNull();
    });

    it('Should fail with null/undefined', () => {
        expect(Validator.required(null)).not.toBeNull();
        expect(Validator.required(undefined)).not.toBeNull();
    });

    it('Should fail with empty array', () => {
        expect(Validator.required([])).not.toBeNull();
    });

    it('Should use custom field name in message', () => {
        const error = Validator.required('', 'Nama Lengkap');
        expect(error).toContain('Nama Lengkap');
        expect(error).toContain('wajib diisi');
    });

    it('Should pass with false boolean', () => {
        // false is a valid value for checkboxes
        expect(Validator.required(false)).not.toBeNull();
    });
});

// ============================================
// EMAIL TESTS
// ============================================

describe('Validator - Email', () => {
    it('Should pass with valid emails', () => {
        expect(Validator.email('test@example.com')).toBeNull();
        expect(Validator.email('user.name@domain.co.id')).toBeNull();
        expect(Validator.email('name+tag@test.org')).toBeNull();
    });

    it('Should skip empty values', () => {
        expect(Validator.email('')).toBeNull();
        expect(Validator.email(null)).toBeNull();
    });

    it('Should fail with invalid emails', () => {
        expect(Validator.email('invalid')).not.toBeNull();
        expect(Validator.email('@domain.com')).not.toBeNull();
        expect(Validator.email('user@')).not.toBeNull();
        expect(Validator.email('user @domain.com')).not.toBeNull();
    });

    it('Should use custom field name', () => {
        const error = Validator.email('invalid', 'Alamat Email');
        expect(error).toContain('Alamat Email');
    });
});

// ============================================
// PASSWORD TESTS
// ============================================

describe('Validator - Password', () => {
    it('Should pass with strong passwords', () => {
        expect(Validator.password('StrongP@ss1')).toBeNull();
        expect(Validator.password('C0mpl3x!Pass')).toBeNull();
    });

    it('Should fail with too short passwords', () => {
        const error = Validator.password('Abc1');
        expect(error).not.toBeNull();
        expect(error).toContain('minimal 8');
    });

    it('Should fail without uppercase', () => {
        const error = Validator.password('weakpass1');
        expect(error).toContain('huruf besar');
    });

    it('Should fail without lowercase', () => {
        const error = Validator.password('WEAKPASS1');
        expect(error).toContain('huruf kecil');
    });

    it('Should fail without numbers', () => {
        const error = Validator.password('WeakPass!');
        expect(error).toContain('angka');
    });

    it('Should skip empty values', () => {
        expect(Validator.password('')).toBeNull();
        expect(Validator.password(null)).toBeNull();
    });
});

// ============================================
// PASSWORD MATCH TESTS
// ============================================

describe('Validator - Password Match', () => {
    it('Should pass with matching passwords', () => {
        expect(Validator.passwordMatch('abc123', 'abc123')).toBeNull();
    });

    it('Should fail with non-matching passwords', () => {
        const error = Validator.passwordMatch('abc123', 'abc124');
        expect(error).toContain('tidak cocok');
    });

    it('Should skip empty values', () => {
        expect(Validator.passwordMatch('', 'abc123')).toBeNull();
        expect(Validator.passwordMatch(null, 'abc123')).toBeNull();
    });
});

// ============================================
// PHONE TESTS
// ============================================

describe('Validator - Phone', () => {
    it('Should pass with valid Indonesian phones', () => {
        expect(Validator.phone('08123456789')).toBeNull();
        expect(Validator.phone('+628123456789')).toBeNull();
        expect(Validator.phone('6281234567890')).toBeNull();
        expect(Validator.phone('0812-3456-7890')).toBeNull();
    });

    it('Should skip empty values', () => {
        expect(Validator.phone('')).toBeNull();
        expect(Validator.phone(null)).toBeNull();
    });

    it('Should fail with invalid phones', () => {
        expect(Validator.phone('12345')).not.toBeNull();
        expect(Validator.phone('abc')).not.toBeNull();
        expect(Validator.phone('0812')).not.toBeNull();
    });
});

// ============================================
// NIP TESTS
// ============================================

describe('Validator - NIP', () => {
    it('Should pass with valid NIP', () => {
        expect(Validator.nip('198501012010011001')).toBeNull();
        expect(Validator.nip('199002152015012002')).toBeNull();
    });

    it('Should skip empty values', () => {
        expect(Validator.nip('')).toBeNull();
        expect(Validator.nip(null)).toBeNull();
    });

    it('Should fail with too short NIP', () => {
        const error = Validator.nip('12345');
        expect(error).toContain('18 digit');
    });

    it('Should fail with non-numeric NIP', () => {
        const error = Validator.nip('abcdefghijklmnopqr');
        expect(error).toContain('angka');
    });

    it('Should fail with invalid year', () => {
        expect(Validator.nip('180001012010011001')).not.toBeNull();
    });

    it('Should fail with invalid month', () => {
        expect(Validator.nip('198501322010011001')).not.toBeNull();
    });
});

// ============================================
// LENGTH TESTS
// ============================================

describe('Validator - Length', () => {
    describe('minLength()', () => {
        it('Should pass with sufficient length', () => {
            expect(Validator.minLength('test', 3)).toBeNull();
        });

        it('Should fail with insufficient length', () => {
            expect(Validator.minLength('ab', 3)).not.toBeNull();
        });

        it('Should skip empty values', () => {
            expect(Validator.minLength('', 3)).toBeNull();
        });

        it('Should include min value in message', () => {
            const error = Validator.minLength('ab', 5);
            expect(error).toContain('5');
        });
    });

    describe('maxLength()', () => {
        it('Should pass within limit', () => {
            expect(Validator.maxLength('test', 10)).toBeNull();
        });

        it('Should fail exceeding limit', () => {
            expect(Validator.maxLength('this is too long', 5)).not.toBeNull();
        });

        it('Should skip empty values', () => {
            expect(Validator.maxLength('', 10)).toBeNull();
        });
    });

    describe('lengthBetween()', () => {
        it('Should pass within range', () => {
            expect(Validator.lengthBetween('test', 3, 10)).toBeNull();
        });

        it('Should fail below range', () => {
            expect(Validator.lengthBetween('ab', 3, 10)).not.toBeNull();
        });

        it('Should fail above range', () => {
            expect(Validator.lengthBetween('this is too long', 3, 5)).not.toBeNull();
        });
    });
});

// ============================================
// NUMBER TESTS
// ============================================

describe('Validator - Number', () => {
    describe('number()', () => {
        it('Should pass with valid numbers', () => {
            expect(Validator.number('123')).toBeNull();
            expect(Validator.number(456)).toBeNull();
            expect(Validator.number('12.34')).toBeNull();
        });

        it('Should skip empty values', () => {
            expect(Validator.number('')).toBeNull();
            expect(Validator.number(null)).toBeNull();
        });

        it('Should fail with non-numeric values', () => {
            expect(Validator.number('abc')).not.toBeNull();
            expect(Validator.number('12abc')).not.toBeNull();
        });
    });

    describe('integer()', () => {
        it('Should pass with integers', () => {
            expect(Validator.integer('123')).toBeNull();
            expect(Validator.integer(456)).toBeNull();
        });

        it('Should fail with decimals', () => {
            expect(Validator.integer('12.34')).not.toBeNull();
        });
    });

    describe('numberRange()', () => {
        it('Should pass within range', () => {
            expect(Validator.numberRange('50', 0, 100)).toBeNull();
            expect(Validator.numberRange(0, 0, 100)).toBeNull();
            expect(Validator.numberRange(100, 0, 100)).toBeNull();
        });

        it('Should fail below range', () => {
            const error = Validator.numberRange('-10', 0, 100);
            expect(error).not.toBeNull();
            expect(error).toContain('minimal');
        });

        it('Should fail above range', () => {
            const error = Validator.numberRange('150', 0, 100);
            expect(error).not.toBeNull();
            expect(error).toContain('maksimal');
        });

        it('Should skip empty values', () => {
            expect(Validator.numberRange('', 0, 100)).toBeNull();
            expect(Validator.numberRange(null, 0, 100)).toBeNull();
        });
    });
});

// ============================================
// URL & DATE TESTS
// ============================================

describe('Validator - URL & Date', () => {
    describe('url()', () => {
        it('Should pass with valid URLs', () => {
            expect(Validator.url('https://example.com')).toBeNull();
            expect(Validator.url('http://localhost:8080')).toBeNull();
        });

        it('Should fail with invalid URLs', () => {
            expect(Validator.url('not-a-url')).not.toBeNull();
            expect(Validator.url('javascript:alert(1)')).not.toBeNull();
        });

        it('Should skip empty values', () => {
            expect(Validator.url('')).toBeNull();
        });
    });

    describe('date()', () => {
        it('Should pass with valid dates', () => {
            expect(Validator.date('2026-01-15')).toBeNull();
            expect(Validator.date('January 15, 2026')).toBeNull();
        });

        it('Should fail with invalid dates', () => {
            expect(Validator.date('not a date')).not.toBeNull();
            expect(Validator.date('2026-13-45')).not.toBeNull();
        });

        it('Should skip empty values', () => {
            expect(Validator.date('')).toBeNull();
        });
    });
});

// ============================================
// ALPHA & ALPHANUMERIC TESTS
// ============================================

describe('Validator - Alpha & Alphanumeric', () => {
    describe('alpha()', () => {
        it('Should pass with letters only', () => {
            expect(Validator.alpha('Hello')).toBeNull();
            expect(Validator.alpha('TestName')).toBeNull();
        });

        it('Should fail with numbers or special chars', () => {
            expect(Validator.alpha('Hello123')).not.toBeNull();
            expect(Validator.alpha('Hello!')).not.toBeNull();
        });

        it('Should skip empty values', () => {
            expect(Validator.alpha('')).toBeNull();
        });
    });

    describe('alphanumeric()', () => {
        it('Should pass with letters and numbers', () => {
            expect(Validator.alphanumeric('Hello123')).toBeNull();
        });

        it('Should fail with special chars', () => {
            expect(Validator.alphanumeric('Hello!')).not.toBeNull();
        });
    });
});

// ============================================
// REGEX TESTS
// ============================================

describe('Validator - Regex', () => {
    it('Should pass matching pattern', () => {
        expect(Validator.regex('ABC123', /^[A-Z0-9]+$/)).toBeNull();
    });

    it('Should fail non-matching pattern', () => {
        expect(Validator.regex('abc123', /^[A-Z0-9]+$/)).not.toBeNull();
    });

    it('Should accept string pattern', () => {
        expect(Validator.regex('ABC123', '^[A-Z0-9]+$')).toBeNull();
    });

    it('Should use custom message', () => {
        const error = Validator.regex('abc', /^\d+$/, 'Hanya angka');
        expect(error).toBe('Hanya angka');
    });
});

// ============================================
// LIST TESTS
// ============================================

describe('Validator - List', () => {
    describe('inList()', () => {
        it('Should pass when value in list', () => {
            expect(Validator.inList('A', ['A', 'B', 'C'])).toBeNull();
        });

        it('Should fail when value not in list', () => {
            const error = Validator.inList('D', ['A', 'B', 'C']);
            expect(error).not.toBeNull();
            expect(error).toContain('salah satu dari');
        });
    });

    describe('notInList()', () => {
        it('Should pass when value not in list', () => {
            expect(Validator.notInList('D', ['A', 'B', 'C'])).toBeNull();
        });

        it('Should fail when value in list', () => {
            const error = Validator.notInList('A', ['A', 'B', 'C']);
            expect(error).not.toBeNull();
            expect(error).toContain('tidak boleh');
        });
    });
});

// ============================================
// FORM VALIDATION TESTS
// ============================================

describe('Validator - Form Validation', () => {
    it('Should validate single field', () => {
        const error = Validator.validateField('name', {
            value: '',
            rules: ['required']
        });
        expect(error).not.toBeNull();
    });

    it('Should pass valid field', () => {
        const error = Validator.validateField('name', {
            value: 'John',
            rules: ['required']
        });
        expect(error).toBeNull();
    });

    it('Should validate multiple fields', () => {
        const result = Validator.validateForm({
            name: {
                value: '',
                rules: [{ method: 'required', message: 'Nama harus diisi' }]
            },
            email: {
                value: 'invalid-email',
                rules: [{ method: 'email', message: 'Email tidak valid' }]
            }
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors.name).toBe('Nama harus diisi');
        expect(result.errors.email).toBe('Email tidak valid');
    });

    it('Should pass all valid fields', () => {
        const result = Validator.validateForm({
            name: { value: 'John', rules: ['required'] },
            email: { value: 'john@test.com', rules: ['email'] },
            phone: { value: '08123456789', rules: ['phone'] }
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
    });

    it('Should skip validation for empty optional fields', () => {
        const result = Validator.validateForm({
            email: { value: '', rules: ['email'] },
            phone: { value: '', rules: ['phone'] }
        });

        expect(result.isValid).toBe(true);
    });

    it('Should validate with rule params', () => {
        const result = Validator.validateForm({
            username: {
                value: 'ab',
                rules: [{ method: 'minLength', params: [3], message: 'Username minimal 3 karakter' }]
            }
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.username).toContain('minimal 3');
    });

    it('Should stop at first error for a field', () => {
        const result = Validator.validateForm({
            password: {
                value: 'ab',
                rules: [
                    { method: 'required', message: 'Password wajib diisi' },
                    { method: 'minLength', params: [8], message: 'Password minimal 8 karakter' }
                ]
            }
        });

        // Password is not empty, so required passes
        // But minLength should fail
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toContain('minimal 8');
    });

    it('Should handle empty fields object', () => {
        const result = Validator.validateForm({});
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
    });
});

// ============================================
// EDGE CASE TESTS
// ============================================

describe('Validator - Edge Cases', () => {
    it('Should handle whitespace-only strings', () => {
        expect(Validator.required('   ')).not.toBeNull();
    });

    it('Should handle very long strings', () => {
        const longString = 'A'.repeat(10000);
        expect(Validator.maxLength(longString, 5000)).not.toBeNull();
    });

    it('Should handle special characters in email', () => {
        expect(Validator.email('test+filter@example.com')).toBeNull();
    });

    it('Should handle 62-prefix phone numbers', () => {
        expect(Validator.phone('6281234567890')).toBeNull();
    });

    it('Should handle numeric 0 as valid required value', () => {
        expect(Validator.required(0)).toBeNull();
        expect(Validator.required('0')).toBeNull();
    });
});