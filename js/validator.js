// js/validator.js - Advanced Form Validator 2026
/**
 * E-Arsip Digital - Form Validator
 * Version: 2026.1.0
 * Features: Real-time validation, custom rules, async validation, i18n support
 */

import { Logger } from './logger.js';
import utils from './utils.js';

class FormValidator {
    constructor(form, options = {}) {
        this.logger = new Logger('Validator');
        this.form = typeof form === 'string' ? document.querySelector(form) : form;
        
        if (!this.form) {
            throw new Error('Form element not found');
        }
        
        // Configuration
        this.config = {
            validateOnInput: true,
            validateOnBlur: true,
            validateOnSubmit: true,
            showErrors: true,
            scrollToError: true,
            errorClass: 'error',
            successClass: 'success',
            errorMessageClass: 'form-error',
            ...options
        };
        
        // State
        this.fields = new Map();
        this.rules = new Map();
        this.customMessages = new Map();
        this.errors = new Map();
        this.isSubmitting = false;
        this.validatedFields = new Set();
        
        // Async validation tracking
        this.pendingAsyncValidations = new Map();
        
        // Initialize
        this.init();
    }
    
    init() {
        this.registerDefaultRules();
        this.scanFormFields();
        this.attachEventListeners();
        
        this.logger.info('Form validator initialized', {
            formId: this.form.id || 'unnamed',
            fields: this.fields.size
        });
    }
    
    // ============================================
    // FIELD REGISTRATION
    // ============================================
    
    scanFormFields() {
        const fields = this.form.querySelectorAll('[data-validate], [required], [data-rules]');
        
        fields.forEach(field => {
            const name = field.name || field.id;
            if (!name) return;
            
            const rules = this.parseFieldRules(field);
            if (rules.length > 0) {
                this.fields.set(name, field);
                this.rules.set(name, rules);
                
                // Parse custom messages
                const messages = field.dataset.messages;
                if (messages) {
                    try {
                        this.customMessages.set(name, JSON.parse(messages));
                    } catch (e) {
                        this.logger.warn('Invalid messages JSON for field:', name);
                    }
                }
            }
        });
    }
    
    parseFieldRules(field) {
        const rules = [];
        
        // Parse data-rules attribute
        const rulesStr = field.dataset.rules || field.dataset.validate;
        if (rulesStr) {
            rulesStr.split('|').forEach(rule => {
                const [ruleName, ...params] = rule.split(':');
                rules.push({
                    name: ruleName.trim(),
                    params: params.join(':').split(',').map(p => p.trim())
                });
            });
        }
        
        // Add implicit rules from HTML5 attributes
        if (field.required && !rules.find(r => r.name === 'required')) {
            rules.unshift({ name: 'required', params: [] });
        }
        
        if (field.type === 'email' && !rules.find(r => r.name === 'email')) {
            rules.push({ name: 'email', params: [] });
        }
        
        if (field.minLength && !rules.find(r => r.name === 'minlength')) {
            rules.push({ name: 'minlength', params: [field.minLength.toString()] });
        }
        
        if (field.maxLength && !rules.find(r => r.name === 'maxlength')) {
            rules.push({ name: 'maxlength', params: [field.maxLength.toString()] });
        }
        
        if (field.pattern && !rules.find(r => r.name === 'pattern')) {
            rules.push({ name: 'pattern', params: [field.pattern] });
        }
        
        return rules;
    }
    
    // ============================================
    // DEFAULT RULES
    // ============================================
    
    registerDefaultRules() {
        // Required
        this.addRule('required', {
            validate: (value) => {
                if (value === null || value === undefined) return false;
                if (typeof value === 'string') return value.trim().length > 0;
                if (Array.isArray(value)) return value.length > 0;
                if (value instanceof File) return true;
                return true;
            },
            message: 'Field ini wajib diisi'
        });
        
        // Email
        this.addRule('email', {
            validate: (value) => utils.isValidEmail(value),
            message: 'Format email tidak valid'
        });
        
        // Phone (Indonesia)
        this.addRule('phone', {
            validate: (value) => utils.isValidPhone(value),
            message: 'Format nomor telepon tidak valid'
        });
        
        // NIP
        this.addRule('nip', {
            validate: (value) => utils.isValidNIP(value),
            message: 'Format NIP tidak valid'
        });
        
        // URL
        this.addRule('url', {
            validate: (value) => utils.isValidUrl(value),
            message: 'Format URL tidak valid'
        });
        
        // Min length
        this.addRule('minlength', {
            validate: (value, min) => value && value.length >= parseInt(min),
            message: (min) => `Minimal ${min} karakter`
        });
        
        // Max length
        this.addRule('maxlength', {
            validate: (value, max) => value && value.length <= parseInt(max),
            message: (max) => `Maksimal ${max} karakter`
        });
        
        // Length between
        this.addRule('length', {
            validate: (value, min, max) => {
                const len = value ? value.length : 0;
                return len >= parseInt(min) && len <= parseInt(max);
            },
            message: (min, max) => `Harus antara ${min}-${max} karakter`
        });
        
        // Numeric
        this.addRule('numeric', {
            validate: (value) => !isNaN(value) && isFinite(value),
            message: 'Harus berupa angka'
        });
        
        // Integer
        this.addRule('integer', {
            validate: (value) => Number.isInteger(Number(value)),
            message: 'Harus berupa bilangan bulat'
        });
        
        // Min value
        this.addRule('min', {
            validate: (value, min) => Number(value) >= Number(min),
            message: (min) => `Minimal nilai ${min}`
        });
        
        // Max value
        this.addRule('max', {
            validate: (value, max) => Number(value) <= Number(max),
            message: (max) => `Maksimal nilai ${max}`
        });
        
        // Range
        this.addRule('range', {
            validate: (value, min, max) => {
                const num = Number(value);
                return num >= Number(min) && num <= Number(max);
            },
            message: (min, max) => `Harus antara ${min}-${max}`
        });
        
        // Alpha only
        this.addRule('alpha', {
            validate: (value) => /^[a-zA-Z]+$/.test(value),
            message: 'Hanya boleh berisi huruf'
        });
        
        // Alphanumeric
        this.addRule('alphanumeric', {
            validate: (value) => /^[a-zA-Z0-9]+$/.test(value),
            message: 'Hanya boleh berisi huruf dan angka'
        });
        
        // Match another field
        this.addRule('match', {
            validate: (value, fieldName) => {
                const targetField = this.form.querySelector(`[name="${fieldName}"]`);
                return targetField && value === targetField.value;
            },
            message: (fieldName) => `Harus sama dengan field ${fieldName}`
        });
        
        // Different from another field
        this.addRule('different', {
            validate: (value, fieldName) => {
                const targetField = this.form.querySelector(`[name="${fieldName}"]`);
                return targetField && value !== targetField.value;
            },
            message: (fieldName) => `Tidak boleh sama dengan field ${fieldName}`
        });
        
        // In list
        this.addRule('in', {
            validate: (value, ...list) => list.includes(value),
            message: (list) => `Harus salah satu dari: ${list.join(', ')}`
        });
        
        // Not in list
        this.addRule('notIn', {
            validate: (value, ...list) => !list.includes(value),
            message: (list) => `Tidak boleh salah satu dari: ${list.join(', ')}`
        });
        
        // Regex pattern
        this.addRule('pattern', {
            validate: (value, pattern) => new RegExp(pattern).test(value),
            message: 'Format tidak sesuai'
        });
        
        // Date format
        this.addRule('date', {
            validate: (value) => !isNaN(Date.parse(value)),
            message: 'Format tanggal tidak valid'
        });
        
        // Date before
        this.addRule('before', {
            validate: (value, dateStr) => {
                const date = new Date(value);
                const maxDate = dateStr === 'today' ? new Date() : new Date(dateStr);
                return date < maxDate;
            },
            message: (dateStr) => `Tanggal harus sebelum ${dateStr}`
        });
        
        // Date after
        this.addRule('after', {
            validate: (value, dateStr) => {
                const date = new Date(value);
                const minDate = dateStr === 'today' ? new Date() : new Date(dateStr);
                return date > minDate;
            },
            message: (dateStr) => `Tanggal harus setelah ${dateStr}`
        });
        
        // File size
        this.addRule('filesize', {
            validate: (value, maxSize) => {
                if (value instanceof File) {
                    return value.size <= parseInt(maxSize) * 1024;
                }
                return true;
            },
            message: (maxSize) => `Ukuran file maksimal ${maxSize}KB`
        });
        
        // File type
        this.addRule('filetype', {
            validate: (value, ...types) => {
                if (value instanceof File) {
                    return types.includes(value.type) || 
                           types.includes(value.name.split('.').pop());
                }
                return true;
            },
            message: (types) => `Tipe file harus: ${types.join(', ')}`
        });
    }
    
    // ============================================
    // CUSTOM RULES
    // ============================================
    
    addRule(name, rule) {
        if (!rule.validate || typeof rule.validate !== 'function') {
            throw new Error(`Rule "${name}" must have a validate function`);
        }
        
        this.customRules = this.customRules || new Map();
        this.customRules.set(name, {
            validate: rule.validate,
            message: rule.message || 'Nilai tidak valid',
            async: rule.async || false
        });
    }
    
    getRule(name) {
        return this.customRules?.get(name) || null;
    }
    
    // ============================================
    // VALIDATION
    // ============================================
    
    async validateField(fieldName) {
        const field = this.fields.get(fieldName);
        const rules = this.rules.get(fieldName);
        
        if (!field || !rules) return true;
        
        const value = this.getFieldValue(field);
        const errors = [];
        
        for (const rule of rules) {
            // Skip validation if field is empty and not required
            if (!value && rule.name !== 'required') continue;
            
            const result = await this.executeRule(rule, value, field);
            
            if (result !== true) {
                errors.push(typeof result === 'string' ? result : this.getRuleMessage(rule));
            }
        }
        
        // Update errors
        if (errors.length > 0) {
            this.errors.set(fieldName, errors);
            this.showFieldError(field, errors[0]);
            return false;
        } else {
            this.errors.delete(fieldName);
            this.showFieldSuccess(field);
            return true;
        }
    }
    
    async executeRule(rule, value, field) {
        // Check custom rules first
        const customRule = this.getRule(rule.name);
        if (customRule) {
            try {
                if (customRule.async) {
                    return await customRule.validate(value, ...rule.params, field, this.form);
                }
                return customRule.validate(value, ...rule.params, field, this.form);
            } catch (error) {
                this.logger.error(`Custom rule "${rule.name}" failed`, error);
                return 'Validasi gagal';
            }
        }
        
        // Default rules
        const defaultRule = this.defaultRules?.get(rule.name);
        if (defaultRule) {
            try {
                return defaultRule.validate(value, ...rule.params);
            } catch (error) {
                this.logger.error(`Rule "${rule.name}" execution failed`, error);
                return 'Validasi gagal';
            }
        }
        
        this.logger.warn(`Unknown validation rule: ${rule.name}`);
        return true;
    }
    
    async validateForm() {
        this.errors.clear();
        this.clearAllErrors();
        
        const validations = Array.from(this.fields.keys()).map(fieldName => 
            this.validateField(fieldName)
        );
        
        const results = await Promise.all(validations);
        const isValid = results.every(result => result === true);
        
        if (!isValid && this.config.scrollToError) {
            this.scrollToFirstError();
        }
        
        return isValid;
    }
    
    async validateSection(sectionSelector) {
        const section = this.form.querySelector(sectionSelector);
        if (!section) return true;
        
        const fields = section.querySelectorAll('[name], [data-rules]');
        const validations = [];
        
        fields.forEach(field => {
            const name = field.name || field.id;
            if (this.fields.has(name)) {
                validations.push(this.validateField(name));
            }
        });
        
        const results = await Promise.all(validations);
        return results.every(result => result === true);
    }
    
    // ============================================
    // ERROR MANAGEMENT
    // ============================================
    
    showFieldError(field, message) {
        field.classList.add(this.config.errorClass);
        field.classList.remove(this.config.successClass);
        
        if (this.config.showErrors) {
            let errorElement = this.getErrorElement(field);
            
            if (!errorElement) {
                errorElement = this.createErrorElement(field);
            }
            
            errorElement.textContent = message;
            errorElement.classList.add('show');
            errorElement.setAttribute('role', 'alert');
        }
        
        // Dispatch event
        field.dispatchEvent(new CustomEvent('validation:error', {
            detail: { field: field.name || field.id, message },
            bubbles: true
        }));
    }
    
    showFieldSuccess(field) {
        field.classList.remove(this.config.errorClass);
        field.classList.add(this.config.successClass);
        
        const errorElement = this.getErrorElement(field);
        if (errorElement) {
            errorElement.classList.remove('show');
        }
        
        // Dispatch event
        field.dispatchEvent(new CustomEvent('validation:success', {
            detail: { field: field.name || field.id },
            bubbles: true
        }));
    }
    
    clearFieldError(fieldName) {
        const field = this.fields.get(fieldName);
        if (!field) return;
        
        field.classList.remove(this.config.errorClass, this.config.successClass);
        
        const errorElement = this.getErrorElement(field);
        if (errorElement) {
            errorElement.classList.remove('show');
            errorElement.textContent = '';
        }
        
        this.errors.delete(fieldName);
    }
    
    clearAllErrors() {
        this.fields.forEach((field, name) => {
            this.clearFieldError(name);
        });
        this.errors.clear();
    }
    
    getErrorElement(field) {
        // Look for error element by ID convention
        const errorId = `${field.id || field.name}-error`;
        let errorElement = document.getElementById(errorId);
        
        // Look for adjacent error element
        if (!errorElement) {
            errorElement = field.parentElement?.querySelector(`.${this.config.errorMessageClass}`);
        }
        
        // Look for sibling error element
        if (!errorElement) {
            errorElement = field.nextElementSibling?.classList.contains(this.config.errorMessageClass) 
                ? field.nextElementSibling : null;
        }
        
        return errorElement;
    }
    
    createErrorElement(field) {
        const errorElement = document.createElement('div');
        errorElement.className = this.config.errorMessageClass;
        errorElement.id = `${field.id || field.name}-error`;
        
        // Insert after field
        field.parentNode?.insertBefore(errorElement, field.nextSibling);
        
        return errorElement;
    }
    
    scrollToFirstError() {
        const firstError = this.form.querySelector(`.${this.config.errorClass}`);
        if (firstError) {
            firstError.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Focus the field
            setTimeout(() => firstError.focus(), 300);
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getFieldValue(field) {
        if (field.type === 'checkbox') {
            return field.checked;
        }
        
        if (field.type === 'radio') {
            const checked = this.form.querySelector(`[name="${field.name}"]:checked`);
            return checked ? checked.value : null;
        }
        
        if (field.type === 'file') {
            return field.files[0] || null;
        }
        
        if (field.type === 'select-multiple') {
            return Array.from(field.selectedOptions).map(opt => opt.value);
        }
        
        return field.value || '';
    }
    
    getRuleMessage(rule) {
        // Check custom messages first
        const customMessages = this.customMessages.get(rule.name);
        if (customMessages) {
            if (typeof customMessages === 'string') return customMessages;
            if (customMessages[rule.name]) return customMessages[rule.name];
        }
        
        // Get default message
        const defaultRule = this.defaultRules?.get(rule.name);
        const customRule = this.getRule(rule.name);
        const ruleDef = customRule || defaultRule;
        
        if (ruleDef) {
            if (typeof ruleDef.message === 'function') {
                return ruleDef.message(...rule.params);
            }
            return ruleDef.message;
        }
        
        return 'Nilai tidak valid';
    }
    
    getFieldErrors(fieldName) {
        return this.errors.get(fieldName) || [];
    }
    
    getAllErrors() {
        const allErrors = {};
        this.errors.forEach((errors, fieldName) => {
            allErrors[fieldName] = errors;
        });
        return allErrors;
    }
    
    hasErrors() {
        return this.errors.size > 0;
    }
    
    getFirstError() {
        for (const [fieldName, errors] of this.errors) {
            return { field: fieldName, message: errors[0] };
        }
        return null;
    }
    
    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    attachEventListeners() {
        // Input event for real-time validation
        if (this.config.validateOnInput) {
            this.form.addEventListener('input', (e) => {
                const field = e.target;
                const name = field.name || field.id;
                
                if (this.fields.has(name) && this.validatedFields.has(name)) {
                    this.debounceValidate(name);
                }
            });
        }
        
        // Blur event
        if (this.config.validateOnBlur) {
            this.form.addEventListener('blur', (e) => {
                const field = e.target;
                const name = field.name || field.id;
                
                if (this.fields.has(name)) {
                    this.validatedFields.add(name);
                    this.validateField(name);
                }
            }, true);
        }
        
        // Submit event
        if (this.config.validateOnSubmit) {
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Mark all fields as validated
                this.fields.forEach((_, name) => this.validatedFields.add(name));
                
                const isValid = await this.validateForm();
                
                if (isValid) {
                    this.isSubmitting = true;
                    
                    // Dispatch custom event for form processing
                    const submitEvent = new CustomEvent('validated', {
                        detail: { formData: this.getFormData() },
                        cancelable: true
                    });
                    
                    this.form.dispatchEvent(submitEvent);
                    
                    if (!submitEvent.defaultPrevented) {
                        this.form.submit();
                    }
                    
                    this.isSubmitting = false;
                }
            });
        }
        
        // Change event for files and selects
        this.form.addEventListener('change', (e) => {
            const field = e.target;
            const name = field.name || field.id;
            
            if (this.fields.has(name) && 
                (field.type === 'file' || field.tagName === 'SELECT')) {
                this.validatedFields.add(name);
                this.validateField(name);
            }
        });
    }
    
    debounceValidate(fieldName) {
        if (this._debounceTimers?.has(fieldName)) {
            clearTimeout(this._debounceTimers.get(fieldName));
        }
        
        if (!this._debounceTimers) {
            this._debounceTimers = new Map();
        }
        
        this._debounceTimers.set(fieldName, setTimeout(() => {
            this._debounceTimers.delete(fieldName);
            this.validateField(fieldName);
        }, 300));
    }
    
    // ============================================
    // FORM DATA
    // ============================================
    
    getFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        formData.forEach((value, key) => {
            // Handle multiple values for same key
            if (data[key] !== undefined) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });
        
        return data;
    }
    
    getFormJSON() {
        return JSON.stringify(this.getFormData());
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    async validate() {
        return this.validateForm();
    }
    
    async validateFieldByName(fieldName) {
        this.validatedFields.add(fieldName);
        return this.validateField(fieldName);
    }
    
    resetValidation() {
        this.errors.clear();
        this.validatedFields.clear();
        this.clearAllErrors();
    }
    
    setFieldValue(fieldName, value) {
        const field = this.fields.get(fieldName);
        if (!field) return;
        
        if (field.type === 'checkbox') {
            field.checked = value;
        } else if (field.type === 'radio') {
            const radio = this.form.querySelector(`[name="${fieldName}"][value="${value}"]`);
            if (radio) radio.checked = true;
        } else {
            field.value = value;
        }
        
        // Re-validate if already validated
        if (this.validatedFields.has(fieldName)) {
            this.validateField(fieldName);
        }
    }
    
    disableField(fieldName) {
        const field = this.fields.get(fieldName);
        if (field) {
            field.disabled = true;
            this.clearFieldError(fieldName);
        }
    }
    
    enableField(fieldName) {
        const field = this.fields.get(fieldName);
        if (field) {
            field.disabled = false;
        }
    }
    
    destroy() {
        this.fields.clear();
        this.rules.clear();
        this.errors.clear();
        this.validatedFields.clear();
        this._debounceTimers?.clear();
        this.logger.info('Form validator destroyed');
    }
}

export default FormValidator;
export { FormValidator };