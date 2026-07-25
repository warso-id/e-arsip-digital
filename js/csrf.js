// FILE: js/csrf.js
// ============================================
// CSRF PROTECTION - E-ARSIP DIGITAL
// ============================================

class CSRFProtection {
    constructor() {
        this.tokenKey = 'csrf_token';
        this.headerName = 'X-CSRF-Token';
        this.token = null;
        
        this.init();
    }
    
    /**
     * Initialize CSRF protection
     */
    init() {
        // Generate token if not exists
        this.token = this.getToken();
        if (!this.token) {
            this.token = this.generateToken();
            this.setToken(this.token);
        }
        
        // Add token to all AJAX requests
        this.interceptFetch();
        this.interceptXHR();
        
        // Add token to all forms
        this.addTokenToForms();
        
        // Validate token on page load
        this.validateToken();
    }
    
    /**
     * Generate CSRF token
     */
    generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Get token from storage
     */
    getToken() {
        return sessionStorage.getItem(this.tokenKey);
    }
    
    /**
     * Set token to storage
     */
    setToken(token) {
        sessionStorage.setItem(this.tokenKey, token);
        this.token = token;
    }
    
    /**
     * Refresh token
     */
    refreshToken() {
        const newToken = this.generateToken();
        this.setToken(newToken);
        this.addTokenToForms();
        return newToken;
    }
    
    /**
     * Validate token
     */
    validateToken() {
        // Token validation is typically done server-side
        // This is client-side check
        if (!this.token) {
            console.warn('CSRF token not found. Generating new token.');
            this.refreshToken();
        }
    }
    
    /**
     * Intercept fetch requests
     */
    interceptFetch() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(url, options = {}) {
            // Only add token to same-origin requests
            if (self.isSameOrigin(url)) {
                options.headers = options.headers || {};
                
                if (options.headers instanceof Headers) {
                    options.headers.append(self.headerName, self.token);
                } else {
                    options.headers[self.headerName] = self.token;
                }
            }
            
            return originalFetch.call(this, url, options);
        };
    }
    
    /**
     * Intercept XMLHttpRequest
     */
    interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const self = this;
        
        XMLHttpRequest.prototype.open = function() {
            const url = arguments[1];
            
            // Store URL for later use
            this._url = url;
            
            return originalOpen.apply(this, arguments);
        };
        
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.send = function() {
            // Add CSRF token header
            if (self.isSameOrigin(this._url)) {
                this.setRequestHeader(self.headerName, self.token);
            }
            
            return originalSend.apply(this, arguments);
        };
    }
    
    /**
     * Add CSRF token to all forms
     */
    addTokenToForms() {
        // Remove existing CSRF inputs
        document.querySelectorAll('input[name="csrf_token"]').forEach(el => el.remove());
        
        // Add to all forms
        document.querySelectorAll('form').forEach(form => {
            // Skip forms with external action
            const action = form.getAttribute('action');
            if (action && !this.isSameOrigin(action)) return;
            
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'csrf_token';
            input.value = this.token;
            form.appendChild(input);
        });
    }
    
    /**
     * Add CSRF token to specific form
     */
    addTokenToForm(formElement) {
        const existing = formElement.querySelector('input[name="csrf_token"]');
        if (existing) existing.remove();
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrf_token';
        input.value = this.token;
        formElement.appendChild(input);
    }
    
    /**
     * Check if URL is same origin
     */
    isSameOrigin(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            return parsed.origin === window.location.origin;
        } catch (e) {
            // Relative URL
            return true;
        }
    }
    
    /**
     * Get CSRF token for API calls
     */
    getCSRFToken() {
        return this.token;
    }
    
    /**
     * Get CSRF header name
     */
    getHeaderName() {
        return this.headerName;
    }
    
    /**
     * Create CSRF-protected form data
     */
    createFormData(data) {
        const formData = new FormData();
        
        // Add CSRF token
        formData.append('csrf_token', this.token);
        
        // Add data
        for (const [key, value] of Object.entries(data)) {
            formData.append(key, value);
        }
        
        return formData;
    }
    
    /**
     * Create CSRF-protected request headers
     */
    getHeaders() {
        return {
            [this.headerName]: this.token,
            'Content-Type': 'application/json'
        };
    }
}

// Create global instance
const csrfProtection = new CSRFProtection();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSRFProtection;
}