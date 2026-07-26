// js/validator.js - Enterprise Secure Form Validator 2026
/**
 * E-Arsip Digital - Advanced Secure Form Validator
 * Version: 2026.1.0
 * Features: Real-time validation, async rules, i18n support, custom rules,
 *           accessibility (ARIA), mobile-friendly, secure error rendering
 * Security: XSS prevention, input sanitization, secure error messages
 */

class FormValidator {
    constructor(form, options = {}) {
        // ✅ FIX: No external imports, self-contained
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
            scrollOffset: 80,
            errorClass: 'is-invalid',
            successClass: 'is-valid',
            errorMessageClass: 'invalid-feedback',
            debounceDelay: 300,
            ...options
        };
        
        // State
        this.fields = new Map();
        this.rules = new Map();
        this.customMessages = new Map();
        this.errors = new Map();
        this.isSubmitting = false;
        this.validatedFields = new Set();
        
        // ✅ FIX: Separate default and custom rules
        this.defaultRules = new Map();
        this.customRules = new Map();
        
        // Debounce timers
        this.debounceTimers = new Map();
        
        // Event handlers registry untuk cleanup
        this.handlers = {};
        
        // Logger (minimal, no dependencies)
        this.log = (level, message, data) => {
            if (options.debug) {
                console[level](`[Validator] ${message}`, data || '');
            }
        };
        
        this.init();
    }
    
    init() {
        this.registerDefaultRules();
        this.scanFormFields();
        this.attachEventListeners();
        
        this.log('info', 'Form validator initialized', {
            formId: this.form.id || 'unnamed',
            fields: this.fields.size
        });
    }
    
    // ============================================
    // FIELD SCANNING
    // ============================================
    
    scanFormFields() {
        const fields = this.form.querySelectorAll(
            'input, select, textarea, [data-validate], [data-rules]'
        );
        
        fields.forEach(field => {
            // Skip submit/button/checkbox/radio without rules
            if (['submit', 'button', 'reset', 'image'].includes(field.type)) return;
            if (field.type === 'hidden' && !field.dataset.rules) return;
            
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
                    } catch {
                        this.log('warn', 'Invalid messages JSON', { field: name });
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
                const parts = rule.split(':');
                const ruleName = parts[0].trim();
                const params = parts.slice(1).join(':').split(',').map(p => p.trim()).filter(Boolean);
                
                if (ruleName) {
                    rules.push({ name: ruleName, params });
                }
            });
        }
        
        // Add implicit rules from HTML5 attributes (only if not already defined)
        if (field.required && !rules.find(r => r.name === 'required')) {
            rules.unshift({ name: 'required', params: [] });
        }
        
        if (field.type === 'email' && !rules.find(r => r.name === 'email')) {
            rules.push({ name: 'email', params: [] });
        }
        
        if (field.type === 'url' && !rules.find(r => r.name === 'url')) {
            rules.push({ name: 'url', params: [] });
        }
        
        if (field.minLength > 0 && !rules.find(r => r.name === 'minlength')) {
            rules.push({ name: 'minlength', params: [String(field.minLength)] });
        }
        
        if (field.maxLength > 0 && !rules.find(r => r.name === 'maxlength')) {
            rules.push({ name: 'maxlength', params: [String(field.maxLength)] });
        }
        
        if (field.min && !rules.find(r => r.name === 'min')) {
            rules.push({ name: 'min', params: [field.min] });
        }
        
        if (field.max && !rules.find(r => r.name === 'max')) {
            rules.push({ name: 'max', params: [field.max] });
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
        this.defaultRules.set('required', {
            validate: (value) => {
                if (value === null || value === undefined || value === false) return false;
                if (typeof value === 'string') return value.trim().length > 0;
                if (Array.isArray(value)) return value.length > 0;
                if (value instanceof File) return value.size > 0;
                return true;
            },
            message: 'Field ini wajib diisi'
        });
        
        // Email
        this.defaultRules.set('email', {
            validate: (value) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value),
            message: 'Format email tidak valid'
        });
        
        // URL
        this.defaultRules.set('url', {
            validate: (value) => {
                try { new URL(value); return true; } catch { return false; }
            },
            message: 'Format URL tidak valid'
        });
        
        // Phone (Indonesia)
        this.defaultRules.set('phone', {
            validate: (value) => /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(
                String(value).replace(/[\s\-()]/g, '')
            ),
            message: 'Format nomor telepon tidak valid'
        });
        
        // NIP
        this.defaultRules.set('nip', {
            validate: (value) => {
                const cleaned = String(value).replace(/\s/g, '');
                if (!/^\d{18}$/.test(cleaned)) return false;
                const year = parseInt(cleaned.substring(0, 4));
                const month = parseInt(cleaned.substring(4, 6));
                const day = parseInt(cleaned.substring(6, 8));
                return year >= 1940 && year <= new Date().getFullYear() - 18 &&
                       month >= 1 && month <= 12 && day >= 1 && day <= 31;
            },
            message: 'Format NIP tidak valid'
        });
        
        // Min length
        this.defaultRules.set('minlength', {
            validate: (value, min) => String(value || '').length >= parseInt(min),
            message: (min) => `Minimal ${min} karakter`
        });
        
        // Max length
        this.defaultRules.set('maxlength', {
            validate: (value, max) => String(value || '').length <= parseInt(max),
            message: (max) => `Maksimal ${max} karakter`
        });
        
        // Length between
        this.defaultRules.set('length', {
            validate: (value, min, max) => {
                const len = String(value || '').length;
                return len >= parseInt(min) && len <= parseInt(max);
            },
            message: (min, max) => `Harus antara ${min}-${max} karakter`
        });
        
        // Numeric
        this.defaultRules.set('numeric', {
            validate: (value) => value !== '' && !isNaN(value) && isFinite(value),
            message: 'Harus berupa angka'
        });
        
        // Integer
        this.defaultRules.set('integer', {
            validate: (value) => /^-?\d+$/.test(String(value)),
            message: 'Harus berupa bilangan bulat'
        });
        
        // Min value
        this.defaultRules.set('min', {
            validate: (value, min) => Number(value) >= Number(min),
            message: (min) => `Minimal nilai ${min}`
        });
        
        // Max value
        this.defaultRules.set('max', {
            validate: (value, max) => Number(value) <= Number(max),
            message: (max) => `Maksimal nilai ${max}`
        });
        
        // Range
        this.defaultRules.set('range', {
            validate: (value, min, max) => {
                const num = Number(value);
                return num >= Number(min) && num <= Number(max);
            },
            message: (min, max) => `Harus antara ${min}-${max}`
        });
        
        // Alpha only
        this.defaultRules.set('alpha', {
            validate: (value) => /^[a-zA-Z]+$/.test(value),
            message: 'Hanya boleh berisi huruf'
        });
        
        // Alphanumeric
        this.defaultRules.set('alphanumeric', {
            validate: (value) => /^[a-zA-Z0-9]+$/.test(value),
            message: 'Hanya boleh berisi huruf dan angka'
        });
        
        // Match field
        this.defaultRules.set('match', {
            validate: (value, fieldName) => {
                const target = this.form.querySelector(`[name="${fieldName}"]`);
                return target ? value === target.value : false;
            },
            message: (fieldName) => `Harus sama dengan field ${this.getFieldLabel(fieldName)}`
        });
        
        // Different from field
        this.defaultRules.set('different', {
            validate: (value, fieldName) => {
                const target = this.form.querySelector(`[name="${fieldName}"]`);
                return target ? value !== target.value : true;
            },
            message: (fieldName) => `Tidak boleh sama dengan field ${this.getFieldLabel(fieldName)}`
        });
        
        // In list
        this.defaultRules.set('in', {
            validate: (value, ...list) => list.includes(value),
            message: (...list) => `Harus salah satu dari: ${list.join(', ')}`
        });
        
        // Not in list
        this.defaultRules.set('notIn', {
            validate: (value, ...list) => !list.includes(value),
            message: (...list) => `Tidak boleh: ${list.join(', ')}`
        });
        
        // Regex pattern
        this.defaultRules.set('pattern', {
            validate: (value, pattern) => new RegExp(pattern).test(value),
            message: 'Format tidak sesuai'
        });
        
        // Date
        this.defaultRules.set('date', {
            validate: (value) => !isNaN(Date.parse(value)),
            message: 'Format tanggal tidak valid'
        });
        
        // Date before
        this.defaultRules.set('before', {
            validate: (value, dateStr) => {
                const date = new Date(value);
                const maxDate = dateStr === 'today' ? new Date() : new Date(dateStr);
                return date < maxDate;
            },
            message: (dateStr) => `Tanggal harus sebelum ${dateStr}`
        });
        
        // Date after
        this.defaultRules.set('after', {
            validate: (value, dateStr) => {
                const date = new Date(value);
                const minDate = dateStr === 'today' ? new Date() : new Date(dateStr);
                return date > minDate;
            },
            message: (dateStr) => `Tanggal harus setelah ${dateStr}`
        });
        
        // File size (KB)
        this.defaultRules.set('filesize', {
            validate: (value, maxKB) => {
                if (value instanceof File) return value.size <= parseInt(maxKB) * 1024;
                if (value?.size) return value.size <= parseInt(maxKB) * 1024;
                return true;
            },
            message: (maxKB) => `Ukuran file maksimal ${maxKB} KB`
        });
        
        // File type
        this.defaultRules.set('filetype', {
            validate: (value, ...types) => {
                if (value instanceof File) {
                    return types.includes(value.type) || 
                           types.includes(value.name.split('.').pop()?.toLowerCase());
                }
                return true;
            },
            message: (...types) => `Tipe file harus: ${types.join(', ')}`
        });
        
        // File extension
        this.defaultRules.set('fileext', {
            validate: (value, ...exts) => {
                if (value instanceof File) {
                    return exts.includes(value.name.split('.').pop()?.toLowerCase());
                }
                return true;
            },
            message: (...exts) => `Ekstensi file harus: ${exts.join(', ')}`
        });
        
        // No HTML (XSS prevention)
        this.defaultRules.set('nohtml', {
            validate: (value) => !/<[^>]*>/.test(value),
            message: 'Tidak boleh mengandung HTML'
        });
        
        // Strong password
        this.defaultRules.set('strongpassword', {
            validate: (value) => {
                return value.length >= 8 &&
                       /[A-Z]/.test(value) &&
                       /[a-z]/.test(value) &&
                       /[0-9]/.test(value) &&
                       /[^A-Za-z0-9]/.test(value);
            },
            message: 'Password harus 8+ karakter dengan huruf besar, kecil, angka, dan karakter khusus'
        });
    }
    
    // ============================================
    // CUSTOM RULES
    // ============================================
    
    addRule(name, rule) {
        if (!rule || typeof rule.validate !== 'function') {
            throw new Error(`Rule "${name}" must have a validate function`);
        }
        
        this.customRules.set(name, {
            validate: rule.validate,
            message: rule.message || 'Nilai tidak valid',
            async: rule.async || false
        });
    }
    
    removeRule(name) {
        this.customRules.delete(name);
    }
    
    getRule(name) {
        return this.customRules.get(name) || this.defaultRules.get(name) || null;
    }
    
    // ============================================
    // VALIDATION
    // ============================================
    
    async validateField(fieldName) {
        const field = this.fields.get(fieldName);
        const rules = this.rules.get(fieldName);
        
        if (!field || !rules || field.disabled) return true;
        
        // Don't validate hidden fields unless they have rules
        if (field.type === 'hidden' && rules.length === 0) return true;
        
        const value = this.getFieldValue(field);
        const errors = [];
        
        for (const rule of rules) {
            // Skip non-required rules if value is empty
            const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
            if (isEmpty && rule.name !== 'required') continue;
            
            try {
                const result = await this.executeRule(rule, value, field);
                
                if (result !== true) {
                    errors.push(typeof result === 'string' ? result : this.getRuleMessage(rule, fieldName));
                    
                    // Stop on first error for better UX
                    break;
                }
            } catch (error) {
                this.log('error', `Rule execution failed: ${rule.name}`, { error: error.message });
                errors.push('Validasi gagal');
                break;
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
        const ruleDef = this.getRule(rule.name);
        
        if (!ruleDef) {
            this.log('warn', `Unknown rule: ${rule.name}`);
            return true;
        }
        
        if (ruleDef.async) {
            return await ruleDef.validate(value, ...rule.params, field, this.form);
        }
        
        return ruleDef.validate(value, ...rule.params, field, this.form);
    }
    
    async validateForm() {
        this.errors.clear();
        this.clearAllErrors();
        
        const validations = [];
        
        for (const fieldName of this.fields.keys()) {
            validations.push(this.validateField(fieldName));
        }
        
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
        
        const fields = section.querySelectorAll('[name]');
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
    // ERROR DISPLAY (Accessible)
    // ============================================
    
    showFieldError(field, message) {
        // Sanitize error message
        const safeMessage = this.sanitizeMessage(message);
        
        // Update field classes
        field.classList.add(this.config.errorClass);
        field.classList.remove(this.config.successClass);
        
        // Set ARIA attributes
        field.setAttribute('aria-invalid', 'true');
        
        // Create or update error element
        let errorElement = this.getErrorElement(field);
        
        if (!errorElement && this.config.showErrors) {
            errorElement = this.createErrorElement(field);
        }
        
        if (errorElement) {
            errorElement.textContent = safeMessage;
            errorElement.classList.add('show');
            errorElement.setAttribute('role', 'alert');
            
            // Link error to field
            const errorId = errorElement.id;
            field.setAttribute('aria-describedby', errorId);
            field.setAttribute('aria-errormessage', errorId);
        }
        
        // Dispatch event
        field.dispatchEvent(new CustomEvent('validation:error', {
            detail: { field: field.name || field.id, message: safeMessage },
            bubbles: true
        }));
    }
    
    showFieldSuccess(field) {
        field.classList.remove(this.config.errorClass);
        field.classList.add(this.config.successClass);
        field.setAttribute('aria-invalid', 'false');
        field.removeAttribute('aria-errormessage');
        
        const errorElement = this.getErrorElement(field);
        if (errorElement) {
            errorElement.classList.remove('show');
            errorElement.textContent = '';
        }
        
        field.dispatchEvent(new CustomEvent('validation:success', {
            detail: { field: field.name || field.id },
            bubbles: true
        }));
    }
    
    clearFieldError(fieldName) {
        const field = this.fields.get(fieldName);
        if (!field) return;
        
        field.classList.remove(this.config.errorClass, this.config.successClass);
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-errormessage');
        
        const errorElement = this.getErrorElement(field);
        if (errorElement) {
            errorElement.classList.remove('show');
            errorElement.textContent = '';
        }
        
        this.errors.delete(fieldName);
    }
    
    clearAllErrors() {
        this.fields.forEach((_, name) => this.clearFieldError(name));
        this.errors.clear();
    }
    
    getErrorElement(field) {
        const errorId = `${field.id || field.name}-error`;
        return document.getElementById(errorId) ||
               field.parentElement?.querySelector(`.${this.config.errorMessageClass}`) ||
               field.closest('.form-group')?.querySelector(`.${this.config.errorMessageClass}`);
    }
    
    createErrorElement(field) {
        const errorElement = document.createElement('div');
        errorElement.className = this.config.errorMessageClass;
        errorElement.id = `${field.id || field.name}-error`;
        errorElement.setAttribute('role', 'alert');
        errorElement.setAttribute('aria-live', 'polite');
        
        // Insert after field or in parent
        const parent = field.closest('.form-group, .input-group') || field.parentNode;
        parent.appendChild(errorElement);
        
        return errorElement;
    }
    
    scrollToFirstError() {
        const firstError = this.form.querySelector(`.${this.config.errorClass}`);
        if (firstError) {
            const rect = firstError.getBoundingClientRect();
            const scrollTop = window.pageYOffset + rect.top - (this.config.scrollOffset || 80);
            
            window.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
            });
            
            setTimeout(() => {
                if (typeof firstError.focus === 'function') {
                    firstError.focus();
                }
            }, 300);
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getFieldValue(field) {
        if (!field) return '';
        
        // Checkboxes
        if (field.type === 'checkbox') {
            if (!field.name) return field.checked;
            
            const checkboxes = this.form.querySelectorAll(`[name="${field.name}"]`);
            if (checkboxes.length > 1) {
                return Array.from(checkboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);
            }
            return field.checked ? field.value || true : false;
        }
        
        // Radio buttons
        if (field.type === 'radio') {
            const checked = this.form.querySelector(`[name="${field.name}"]:checked`);
            return checked ? checked.value : '';
        }
        
        // File inputs
        if (field.type === 'file') {
            return field.multiple ? Array.from(field.files) : field.files[0] || null;
        }
        
        // Select multiple
        if (field.type === 'select-multiple' || (field.tagName === 'SELECT' && field.multiple)) {
            return Array.from(field.selectedOptions).map(opt => opt.value);
        }
        
        return field.value || '';
    }
    
    getRuleMessage(rule, fieldName) {
        // Check field-specific messages
        const fieldMessages = this.customMessages.get(fieldName);
        if (fieldMessages?.[rule.name]) {
            const msg = fieldMessages[rule.name];
            return typeof msg === 'function' ? msg(...rule.params) : msg;
        }
        
        // Get from rule definition
        const ruleDef = this.getRule(rule.name);
        if (ruleDef?.message) {
            return typeof ruleDef.message === 'function' 
                ? ruleDef.message(...rule.params) 
                : ruleDef.message;
        }
        
        return 'Nilai tidak valid';
    }
    
    getFieldLabel(fieldName) {
        const field = this.fields.get(fieldName);
        if (!field) return fieldName;
        
        // Try to find associated label
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) return label.textContent.trim();
        
        // Try placeholder
        if (field.placeholder) return field.placeholder;
        
        return fieldName;
    }
    
    sanitizeMessage(message) {
        if (!message) return '';
        
        // Remove HTML tags and limit length
        return String(message)
            .replace(/<[^>]*>/g, '')
            .replace(/[<>"'`]/g, '')
            .trim()
            .substring(0, 200);
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
            if (errors.length > 0) {
                return { field: fieldName, message: errors[0] };
            }
        }
        return null;
    }
    
    getFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        formData.forEach((value, key) => {
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
    
    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    attachEventListeners() {
        // Input event
        if (this.config.validateOnInput) {
            this.handlers.input = (e) => {
                const field = e.target;
                const name = field.name || field.id;
                
                if (this.fields.has(name) && this.validatedFields.has(name)) {
                    this.debounceValidate(name);
                }
            };
            this.form.addEventListener('input', this.handlers.input);
        }
        
        // Blur event
        if (this.config.validateOnBlur) {
            this.handlers.blur = (e) => {
                const field = e.target;
                const name = field.name || field.id;
                
                if (this.fields.has(name) && !field.disabled) {
                    this.validatedFields.add(name);
                    this.validateField(name);
                }
            };
            this.form.addEventListener('blur', this.handlers.blur, true);
        }
        
        // Change event (for selects, files, radios)
        this.handlers.change = (e) => {
            const field = e.target;
            const name = field.name || field.id;
            
            if (this.fields.has(name) && !field.disabled) {
                if (['select-one', 'select-multiple', 'file', 'radio', 'checkbox'].includes(field.type) ||
                    field.tagName === 'SELECT') {
                    this.validatedFields.add(name);
                    this.validateField(name);
                }
            }
        };
        this.form.addEventListener('change', this.handlers.change);
        
        // Submit event
        if (this.config.validateOnSubmit) {
            this.handlers.submit = async (e) => {
                e.preventDefault();
                
                if (this.isSubmitting) return;
                
                // Mark all as validated
                this.fields.forEach((_, name) => this.validatedFields.add(name));
                
                const isValid = await this.validateForm();
                
                if (isValid) {
                    this.isSubmitting = true;
                    
                    const submitEvent = new CustomEvent('validated', {
                        detail: { formData: this.getFormData() },
                        cancelable: true
                    });
                    
                    this.form.dispatchEvent(submitEvent);
                    
                    if (!submitEvent.defaultPrevented) {
                        // Use requestSubmit for native validation
                        if (typeof this.form.requestSubmit === 'function') {
                            this.form.requestSubmit();
                        } else {
                            HTMLFormElement.prototype.submit.call(this.form);
                        }
                    }
                    
                    this.isSubmitting = false;
                }
            };
            this.form.addEventListener('submit', this.handlers.submit);
        }
        
        // Prevent Enter key submitting on invalid form
        this.handlers.keydown = (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                const name = e.target.name || e.target.id;
                if (this.fields.has(name) && this.errors.has(name)) {
                    e.preventDefault();
                }
            }
        };
        this.form.addEventListener('keydown', this.handlers.keydown);
    }
    
    debounceValidate(fieldName) {
        if (this.debounceTimers.has(fieldName)) {
            clearTimeout(this.debounceTimers.get(fieldName));
        }
        
        this.debounceTimers.set(fieldName, setTimeout(() => {
            this.debounceTimers.delete(fieldName);
            this.validateField(fieldName);
        }, this.config.debounceDelay));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    async validate() {
        this.fields.forEach((_, name) => this.validatedFields.add(name));
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
    
    resetForm() {
        this.resetValidation();
        this.form.reset();
    }
    
    setFieldValue(fieldName, value) {
        const field = this.fields.get(fieldName);
        if (!field) return;
        
        if (field.type === 'checkbox') {
            field.checked = Boolean(value);
        } else if (field.type === 'radio') {
            const radio = this.form.querySelector(`[name="${fieldName}"][value="${value}"]`);
            if (radio) radio.checked = true;
        } else if (field.type === 'file') {
            // Can't set file value programmatically
        } else {
            field.value = value || '';
        }
        
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
        // Remove event listeners
        if (this.handlers.input) this.form.removeEventListener('input', this.handlers.input);
        if (this.handlers.blur) this.form.removeEventListener('blur', this.handlers.blur, true);
        if (this.handlers.change) this.form.removeEventListener('change', this.handlers.change);
        if (this.handlers.submit) this.form.removeEventListener('submit', this.handlers.submit);
        if (this.handlers.keydown) this.form.removeEventListener('keydown', this.handlers.keydown);
        
        // Clear timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Clear state
        this.fields.clear();
        this.rules.clear();
        this.errors.clear();
        this.validatedFields.clear();
        this.customMessages.clear();
        this.defaultRules.clear();
        this.customRules.clear();
        
        this.log('info', 'Form validator destroyed');
    }
}

export default FormValidator;
export { FormValidator };