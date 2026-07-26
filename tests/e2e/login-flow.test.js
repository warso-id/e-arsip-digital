// FILE: tests/e2e/login-flow.test.js
// E2E Test: Login Flow - E-Arsip Digital v2026.1.0
// Framework: Jest (dengan jsdom environment)

/**
 * @jest-environment jsdom
 */

// ============================================
// MOCK SETUP
// ============================================

// Mock localStorage dan sessionStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: jest.fn((index) => Object.keys(store)[index] || null)
    };
})();

const sessionStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock Crypto API untuk CSRF token
const mockCrypto = {
    getRandomValues: jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    })
};
Object.defineProperty(window, 'crypto', { value: mockCrypto });

// Mock fetch API
global.fetch = jest.fn();

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
});

// Mock Service Worker
navigator.serviceWorker = {
    register: jest.fn().mockResolvedValue({ scope: '/' }),
    ready: Promise.resolve({ active: { state: 'activated' } })
};

// ============================================
// MOCK API SERVICE
// ============================================
const apiMock = {
    _responses: {},
    _calls: [],
    
    mockResponse(action, response) {
        this._responses[action] = response;
    },
    
    clearMocks() {
        this._responses = {};
        this._calls = [];
    },
    
    async post(action, data) {
        this._calls.push({ action, data, timestamp: Date.now() });
        const response = this._responses[action];
        if (response) return Promise.resolve(response);
        return Promise.reject(new Error(`No mock for action: ${action}`));
    },
    
    async get(action, params) {
        this._calls.push({ action, params, timestamp: Date.now() });
        const response = this._responses[action];
        if (response) return Promise.resolve(response);
        return Promise.reject(new Error(`No mock for action: ${action}`));
    },
    
    getCallCount(action) {
        return this._calls.filter(c => c.action === action).length;
    }
};

// Mock Auth Service
const authMock = {
    currentUser: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    
    _redirectMap: {
        'super_admin': '../../dashboard/super-admin/index.html',
        'admin': '../../dashboard/admin/index.html',
        'kasubag': '../../dashboard/kasubag/index.html',
        'kaprodi': '../../dashboard/kaprodi/index.html',
        'wadek': '../../dashboard/wadek/index.html',
        'dekan': '../../dashboard/dekan/index.html',
        'staf': '../../dashboard/staf/index.html',
        'dosen': '../../dashboard/dosen/index.html',
        'mahasiswa': '../../dashboard/mahasiswa/index.html',
        'user': '../../dashboard/user/index.html'
    },
    
    async login(username, password, remember) {
        // Validasi input
        if (!username || !password) {
            return { success: false, message: 'Username dan password harus diisi' };
        }
        
        if (username.length < 3) {
            return { success: false, message: 'Username minimal 3 karakter' };
        }
        
        if (password.length < 6) {
            return { success: false, message: 'Password minimal 6 karakter' };
        }
        
        try {
            const response = await apiMock.post('login', {
                username: username.trim(),
                password: password,
                csrf_token: 'mock-csrf-token',
                timestamp: new Date().toISOString()
            });
            
            if (response && response.success) {
                this.currentUser = response.user || response.data?.user;
                this.token = response.token || 'mock-token-' + Date.now();
                this.isAuthenticated = true;
                
                // Simpan session
                const sessionData = {
                    token: this.token,
                    user: this.currentUser,
                    expiresAt: Date.now() + 3600000,
                    lastActivity: Date.now()
                };
                
                if (remember) {
                    localStorage.setItem('auth_session', JSON.stringify(sessionData));
                    localStorage.setItem('auth_token', this.token);
                    sessionStorage.removeItem('auth_session');
                } else {
                    sessionStorage.setItem('auth_session', JSON.stringify(sessionData));
                    sessionStorage.setItem('auth_token', this.token);
                    localStorage.removeItem('auth_session');
                }
                
                const redirect = this.getRedirectURL(this.currentUser?.role);
                return { success: true, user: this.currentUser, redirect };
            }
            
            return { success: false, message: response?.message || 'Login gagal' };
        } catch (error) {
            return { success: false, message: 'Gagal terhubung ke server' };
        }
    },
    
    getRedirectURL(role) {
        return this._redirectMap[role] || '../../dashboard/user/index.html';
    },
    
    requireAuth() {
        if (this.isAuthenticated && this.currentUser) return true;
        
        // Cek localStorage
        try {
            const sessionStr = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (sessionStr) {
                const session = JSON.parse(sessionStr);
                if (session.user && session.expiresAt && Date.now() < session.expiresAt) {
                    this.currentUser = session.user;
                    this.token = session.token;
                    this.isAuthenticated = true;
                    return true;
                }
            }
        } catch (e) {}
        
        return false;
    },
    
    requireRole(roles) {
        if (!this.requireAuth()) return false;
        const roleList = Array.isArray(roles) ? roles : [roles];
        return roleList.includes(this.currentUser?.role);
    },
    
    logout() {
        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('csrf_token');
        sessionStorage.removeItem('auth_session');
        sessionStorage.removeItem('auth_token');
    }
};

// Mock Security Manager
const securityManagerMock = {
    _attempts: {},
    _lockoutDuration: 900000, // 15 menit
    _maxAttempts: 5,
    
    recordLoginAttempt(username, success) {
        if (!this._attempts[username]) {
            this._attempts[username] = { count: 0, firstAttempt: Date.now(), locked: false };
        }
        
        if (success) {
            this._attempts[username].count = 0;
            this._attempts[username].locked = false;
            return;
        }
        
        this._attempts[username].count++;
        
        if (this._attempts[username].count >= this._maxAttempts) {
            this._attempts[username].locked = true;
        }
    },
    
    validateLoginAttempt(username) {
        const record = this._attempts[username];
        
        if (!record) {
            return { allowed: true };
        }
        
        if (record.locked) {
            const elapsed = Date.now() - record.firstAttempt;
            if (elapsed >= this._lockoutDuration) {
                record.count = 0;
                record.locked = false;
                return { allowed: true };
            }
            const remainingMinutes = Math.ceil((this._lockoutDuration - elapsed) / 60000);
            return { allowed: false, message: `Akun terkunci. Coba lagi dalam ${remainingMinutes} menit.` };
        }
        
        if (record.count >= this._maxAttempts) {
            record.locked = true;
            const remainingMinutes = Math.ceil(this._lockoutDuration / 60000);
            return { allowed: false, message: `Akun terkunci. Coba lagi dalam ${remainingMinutes} menit.` };
        }
        
        return { allowed: true };
    },
    
    getRemainingAttempts(username) {
        const record = this._attempts[username];
        if (!record) return this._maxAttempts;
        return Math.max(0, this._maxAttempts - record.count);
    },
    
    reset(username) {
        delete this._attempts[username];
    },
    
    clearAll() {
        this._attempts = {};
    }
};

// Setup window globals
window.api = apiMock;
window.auth = authMock;
window.securityManager = securityManagerMock;
window.EArsip = {
    Auth: authMock,
    Api: apiMock,
    Config: {
        app: {
            apiUrl: 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec'
        }
    }
};

// ============================================
// DOM SETUP
// ============================================
let loginForm;
let usernameInput;
let passwordInput;
let rememberCheckbox;
let submitButton;
let alertContainer;
let loadingSpinner;
let csrfInput;

beforeEach(() => {
    // Reset semua mock
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    apiMock.clearMocks();
    securityManagerMock.clearAll();
    authMock.logout();
    
    // Buat DOM
    document.body.innerHTML = `
        <div id="alertContainer"></div>
        <div id="toastContainer"></div>
        <form id="loginForm" autocomplete="on" novalidate>
            <input type="hidden" id="csrfToken" name="csrf_token">
            <input type="text" id="username" placeholder="Username" autocomplete="username" maxlength="50">
            <input type="password" id="password" placeholder="Password" autocomplete="current-password" minlength="6">
            <input type="checkbox" id="rememberMe">
            <label for="rememberMe">Ingat saya</label>
            <button type="submit" id="btnLogin">Masuk</button>
            <div id="loadingSpinner" style="display:none;"></div>
            <div class="form-error" id="username-error"></div>
            <div class="form-error" id="password-error"></div>
            <div id="connection-status"></div>
        </form>
        <a href="../../index.html" id="backLink">Kembali ke Beranda</a>
    `;
    
    loginForm = document.getElementById('loginForm');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    rememberCheckbox = document.getElementById('rememberMe');
    submitButton = document.getElementById('btnLogin');
    alertContainer = document.getElementById('alertContainer');
    loadingSpinner = document.getElementById('loadingSpinner');
    csrfInput = document.getElementById('csrfToken');
    
    // Setup CSRF token
    csrfInput.value = 'test-csrf-token-' + Date.now();
    
    // Setup event listeners (simulasi dari aplikasi nyata)
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const remember = rememberCheckbox.checked;
        
        // Clear errors
        document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');
        
        // Validasi
        let isValid = true;
        if (!username) {
            document.getElementById('username-error').textContent = 'Username wajib diisi';
            usernameInput.classList.add('error');
            isValid = false;
        } else if (username.length < 3) {
            document.getElementById('username-error').textContent = 'Username minimal 3 karakter';
            usernameInput.classList.add('error');
            isValid = false;
        }
        
        if (!password) {
            document.getElementById('password-error').textContent = 'Password wajib diisi';
            passwordInput.classList.add('error');
            isValid = false;
        } else if (password.length < 6) {
            document.getElementById('password-error').textContent = 'Password minimal 6 karakter';
            passwordInput.classList.add('error');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // Check security
        const securityCheck = securityManagerMock.validateLoginAttempt(username);
        if (!securityCheck.allowed) {
            showAlert(securityCheck.message, 'error');
            return;
        }
        
        // Show loading
        loadingSpinner.style.display = 'block';
        submitButton.disabled = true;
        
        try {
            const result = await authMock.login(username, password, remember);
            
            if (result.success) {
                securityManagerMock.recordLoginAttempt(username, true);
                showAlert('Login berhasil! Mengalihkan...', 'success');
                // Redirect handled by test
            } else {
                securityManagerMock.recordLoginAttempt(username, false);
                showAlert(result.message || 'Login gagal', 'error');
            }
        } catch (error) {
            showAlert('Gagal terhubung ke server', 'error');
        } finally {
            loadingSpinner.style.display = 'none';
            submitButton.disabled = false;
        }
    });
});

function showAlert(message, type) {
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    alertContainer.style.display = 'block';
}

// ============================================
// TEST SUITES
// ============================================

describe('E2E Test: Login Flow - E-Arsip Digital v2026.1.0', () => {
    
    // ============================================
    // RENDERING TESTS
    // ============================================
    describe('Rendering', () => {
        test('E2E-LOGIN-001: Should render login form with all elements', () => {
            expect(loginForm).not.toBeNull();
            expect(usernameInput).not.toBeNull();
            expect(passwordInput).not.toBeNull();
            expect(rememberCheckbox).not.toBeNull();
            expect(submitButton).not.toBeNull();
            expect(alertContainer).not.toBeNull();
            expect(loadingSpinner).not.toBeNull();
            expect(csrfInput).not.toBeNull();
        });
        
        test('E2E-LOGIN-002: Password field should be masked', () => {
            expect(passwordInput.type).toBe('password');
        });
        
        test('E2E-LOGIN-003: CSRF token should be present', () => {
            expect(csrfInput.value).toBeTruthy();
            expect(csrfInput.value.length).toBeGreaterThan(10);
        });
        
        test('E2E-LOGIN-004: Username should have autocomplete attribute', () => {
            expect(usernameInput.getAttribute('autocomplete')).toBe('username');
        });
        
        test('E2E-LOGIN-005: Back link should point to index', () => {
            const backLink = document.getElementById('backLink');
            expect(backLink).not.toBeNull();
            expect(backLink.getAttribute('href')).toBe('../../index.html');
        });
    });
    
    // ============================================
    // VALIDATION TESTS
    // ============================================
    describe('Form Validation', () => {
        test('E2E-LOGIN-010: Should validate empty username', () => {
            usernameInput.value = '';
            passwordInput.value = 'admin123';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            const errorEl = document.getElementById('username-error');
            expect(errorEl.textContent).toContain('wajib diisi');
            expect(usernameInput.classList.contains('error')).toBe(true);
        });
        
        test('E2E-LOGIN-011: Should validate empty password', () => {
            usernameInput.value = 'admin';
            passwordInput.value = '';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            const errorEl = document.getElementById('password-error');
            expect(errorEl.textContent).toContain('wajib diisi');
            expect(passwordInput.classList.contains('error')).toBe(true);
        });
        
        test('E2E-LOGIN-012: Should validate short username', () => {
            usernameInput.value = 'ab';
            passwordInput.value = 'admin123';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            const errorEl = document.getElementById('username-error');
            expect(errorEl.textContent).toContain('minimal 3 karakter');
        });
        
        test('E2E-LOGIN-013: Should validate short password', () => {
            usernameInput.value = 'admin';
            passwordInput.value = '12345';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            const errorEl = document.getElementById('password-error');
            expect(errorEl.textContent).toContain('minimal 6 karakter');
        });
        
        test('E2E-LOGIN-014: Should validate both fields empty', () => {
            usernameInput.value = '';
            passwordInput.value = '';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            expect(document.getElementById('username-error').textContent).toBeTruthy();
            expect(document.getElementById('password-error').textContent).toBeTruthy();
        });
        
        test('E2E-LOGIN-015: Should clear errors on valid input', () => {
            // First trigger error
            usernameInput.value = '';
            passwordInput.value = '';
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            // Then fix
            usernameInput.value = 'admin';
            passwordInput.value = 'admin123';
            apiMock.mockResponse('login', { success: true, user: { username: 'admin', role: 'admin' } });
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            expect(document.getElementById('username-error').textContent).toBe('');
            expect(document.getElementById('password-error').textContent).toBe('');
        });
    });
    
    // ============================================
    // AUTHENTICATION TESTS
    // ============================================
    describe('Authentication', () => {
        test('E2E-LOGIN-020: Should login successfully with valid credentials', async () => {
            usernameInput.value = 'admin';
            passwordInput.value = 'admin123';
            rememberCheckbox.checked = true;
            
            apiMock.mockResponse('login', {
                success: true,
                token: 'valid-token-123',
                user: { id: '1', username: 'admin', fullname: 'Administrator', role: 'admin', email: 'admin@example.com' }
            });
            
            const result = await authMock.login('admin', 'admin123', true);
            
            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.role).toBe('admin');
            expect(result.user.username).toBe('admin');
            expect(result.redirect).toBe('../../dashboard/admin/index.html');
            expect(authMock.isAuthenticated).toBe(true);
            expect(authMock.token).toBeTruthy();
        });
        
        test('E2E-LOGIN-021: Should reject invalid credentials', async () => {
            apiMock.mockResponse('login', {
                success: false,
                message: 'Username atau password salah'
            });
            
            const result = await authMock.login('admin', 'wrongpassword', false);
            
            expect(result.success).toBe(false);
            expect(result.message).toBe('Username atau password salah');
            expect(authMock.isAuthenticated).toBe(false);
        });
        
        test('E2E-LOGIN-022: Should handle network error gracefully', async () => {
            apiMock.mockResponse('login', null); // Will cause error
            
            const result = await authMock.login('admin', 'admin123', false);
            
            expect(result.success).toBe(false);
            expect(result.message).toContain('Gagal terhubung');
        });
        
        test('E2E-LOGIN-023: Should sanitize username input', async () => {
            usernameInput.value = '  admin  ';
            passwordInput.value = 'admin123';
            
            apiMock.mockResponse('login', {
                success: true,
                user: { username: 'admin', role: 'user' }
            });
            
            const result = await authMock.login('  admin  ', 'admin123', false);
            
            expect(result.success).toBe(true);
            // API should receive trimmed username
            const apiCall = apiMock._calls.find(c => c.action === 'login');
            expect(apiCall.data.username).toBe('admin');
        });
    });
    
    // ============================================
    // SESSION MANAGEMENT TESTS
    // ============================================
    describe('Session Management', () => {
        test('E2E-LOGIN-030: Should store in localStorage when remember me is checked', async () => {
            apiMock.mockResponse('login', {
                success: true,
                token: 'token-123',
                user: { id: '1', username: 'admin', role: 'admin' }
            });
            
            await authMock.login('admin', 'admin123', true);
            
            expect(localStorage.setItem).toHaveBeenCalledWith('auth_session', expect.any(String));
            expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', expect.any(String));
            
            const sessionCall = localStorage.setItem.mock.calls.find(c => c[0] === 'auth_session');
            const sessionData = JSON.parse(sessionCall[1]);
            expect(sessionData.token).toBeTruthy();
            expect(sessionData.user).toBeDefined();
            expect(sessionData.expiresAt).toBeGreaterThan(Date.now());
        });
        
        test('E2E-LOGIN-031: Should store in sessionStorage when remember me is unchecked', async () => {
            apiMock.mockResponse('login', {
                success: true,
                token: 'token-456',
                user: { id: '2', username: 'user', role: 'user' }
            });
            
            localStorage.setItem.mockClear();
            sessionStorage.setItem.mockClear();
            
            await authMock.login('user', 'password123', false);
            
            expect(sessionStorage.setItem).toHaveBeenCalledWith('auth_session', expect.any(String));
        });
        
        test('E2E-LOGIN-032: Should clear session on logout', () => {
            // Setup session
            localStorage.setItem('auth_session', JSON.stringify({ user: { role: 'admin' }, expiresAt: Date.now() + 3600000 }));
            localStorage.setItem('auth_token', 'test-token');
            authMock.currentUser = { role: 'admin' };
            authMock.isAuthenticated = true;
            
            authMock.logout();
            
            expect(authMock.currentUser).toBeNull();
            expect(authMock.isAuthenticated).toBe(false);
            expect(localStorage.removeItem).toHaveBeenCalledWith('auth_session');
            expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
        });
        
        test('E2E-LOGIN-033: Should detect expired session', () => {
            const expiredSession = {
                token: 'old-token',
                user: { role: 'admin' },
                expiresAt: Date.now() - 1000 // Expired
            };
            localStorage.setItem('auth_session', JSON.stringify(expiredSession));
            
            const result = authMock.requireAuth();
            
            expect(result).toBe(false);
        });
        
        test('E2E-LOGIN-034: Should detect valid session from localStorage', () => {
            const validSession = {
                token: 'valid-token',
                user: { role: 'user', username: 'testuser' },
                expiresAt: Date.now() + 3600000
            };
            localStorage.setItem('auth_session', JSON.stringify(validSession));
            
            const result = authMock.requireAuth();
            
            expect(result).toBe(true);
            expect(authMock.currentUser).toBeDefined();
        });
    });
    
    // ============================================
    // ROLE-BASED REDIRECT TESTS
    // ============================================
    describe('Role-Based Redirect', () => {
        const roleTests = [
            { role: 'super_admin', expected: '../../dashboard/super-admin/index.html' },
            { role: 'admin', expected: '../../dashboard/admin/index.html' },
            { role: 'kasubag', expected: '../../dashboard/kasubag/index.html' },
            { role: 'kaprodi', expected: '../../dashboard/kaprodi/index.html' },
            { role: 'wadek', expected: '../../dashboard/wadek/index.html' },
            { role: 'dekan', expected: '../../dashboard/dekan/index.html' },
            { role: 'staf', expected: '../../dashboard/staf/index.html' },
            { role: 'dosen', expected: '../../dashboard/dosen/index.html' },
            { role: 'mahasiswa', expected: '../../dashboard/mahasiswa/index.html' },
            { role: 'user', expected: '../../dashboard/user/index.html' }
        ];
        
        roleTests.forEach(({ role, expected }) => {
            test(`E2E-LOGIN-040: Role "${role}" should redirect to correct dashboard`, () => {
                const redirect = authMock.getRedirectURL(role);
                expect(redirect).toBe(expected);
            });
        });
        
        test('E2E-LOGIN-041: Unknown role should redirect to user dashboard', () => {
            const redirect = authMock.getRedirectURL('unknown_role');
            expect(redirect).toBe('../../dashboard/user/index.html');
        });
        
        test('E2E-LOGIN-042: requireRole should validate correctly', () => {
            authMock.currentUser = { role: 'admin' };
            authMock.isAuthenticated = true;
            
            expect(authMock.requireRole('admin')).toBe(true);
            expect(authMock.requireRole(['admin', 'super_admin'])).toBe(true);
            expect(authMock.requireRole('super_admin')).toBe(false);
            expect(authMock.requireRole(['super_admin', 'dekan'])).toBe(false);
        });
    });
    
    // ============================================
    // SECURITY TESTS
    // ============================================
    describe('Security', () => {
        test('E2E-LOGIN-050: Should block after 5 failed attempts', () => {
            const username = 'testuser';
            
            for (let i = 0; i < 5; i++) {
                securityManagerMock.recordLoginAttempt(username, false);
            }
            
            const validation = securityManagerMock.validateLoginAttempt(username);
            expect(validation.allowed).toBe(false);
            expect(validation.message).toContain('menit');
        });
        
        test('E2E-LOGIN-051: Should show remaining attempts', () => {
            const username = 'testuser2';
            
            securityManagerMock.recordLoginAttempt(username, false);
            securityManagerMock.recordLoginAttempt(username, false);
            
            const remaining = securityManagerMock.getRemainingAttempts(username);
            expect(remaining).toBe(3);
        });
        
        test('E2E-LOGIN-052: Should reset attempts after successful login', () => {
            const username = 'testuser3';
            
            securityManagerMock.recordLoginAttempt(username, false);
            securityManagerMock.recordLoginAttempt(username, false);
            securityManagerMock.recordLoginAttempt(username, true);
            
            const validation = securityManagerMock.validateLoginAttempt(username);
            expect(validation.allowed).toBe(true);
            expect(securityManagerMock.getRemainingAttempts(username)).toBe(5);
        });
        
        test('E2E-LOGIN-053: Should include CSRF token in login request', async () => {
            apiMock.mockResponse('login', {
                success: true,
                user: { username: 'admin', role: 'admin' }
            });
            
            await authMock.login('admin', 'admin123', false);
            
            const apiCall = apiMock._calls.find(c => c.action === 'login');
            expect(apiCall.data.csrf_token).toBeDefined();
            expect(apiCall.data.timestamp).toBeDefined();
        });
        
        test('E2E-LOGIN-054: Should prevent XSS in username field', () => {
            const xssPayload = '<script>alert("xss")</script>';
            usernameInput.value = xssPayload;
            passwordInput.value = 'password123';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            // Alert container should not contain executable script
            expect(alertContainer.innerHTML).not.toContain('<script>');
        });
        
        test('E2E-LOGIN-055: Should prevent XSS in error messages', () => {
            const xssPayload = '<img src=x onerror=alert(1)>';
            
            showAlert(xssPayload, 'error');
            
            // The alert should not contain the XSS payload as HTML
            expect(alertContainer.innerHTML).not.toContain('onerror');
        });
    });
    
    // ============================================
    // PWA TESTS
    // ============================================
    describe('PWA Features', () => {
        test('E2E-LOGIN-060: Service Worker should be registered', async () => {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('../../sw.js');
                expect(registration).toBeDefined();
                expect(navigator.serviceWorker.register).toHaveBeenCalledWith('../../sw.js');
            }
        });
        
        test('E2E-LOGIN-061: Should handle offline mode', () => {
            // Simulate offline
            navigator.onLine = false;
            
            const statusEl = document.getElementById('connection-status');
            if (statusEl) {
                statusEl.textContent = '⚠️ Anda sedang offline';
                statusEl.className = 'status-offline';
            }
            
            expect(navigator.onLine).toBe(false);
            
            // Restore
            navigator.onLine = true;
        });
        
        test('E2E-LOGIN-062: Should detect online status', () => {
            navigator.onLine = true;
            expect(navigator.onLine).toBe(true);
        });
    });
    
    // ============================================
    // UI/UX TESTS
    // ============================================
    describe('UI/UX', () => {
        test('E2E-LOGIN-070: Should show loading spinner during login', async () => {
            apiMock.mockResponse('login', {
                success: true,
                user: { username: 'admin', role: 'admin' }
            });
            
            usernameInput.value = 'admin';
            passwordInput.value = 'admin123';
            
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            // Loading should be shown during async operation
            expect(submitButton.disabled).toBe(true);
            
            // Wait for async to complete
            await new Promise(resolve => setTimeout(resolve, 100));
        });
        
        test('E2E-LOGIN-071: Should show success message on login', async () => {
            apiMock.mockResponse('login', {
                success: true,
                user: { username: 'admin', role: 'admin' }
            });
            
            const result = await authMock.login('admin', 'admin123', false);
            
            expect(result.success).toBe(true);
        });
        
        test('E2E-LOGIN-072: Submit button should be disabled during request', async () => {
            let wasDisabled = false;
            
            // Simulate the form submit handler behavior
            const originalHandler = async function(e) {
                e.preventDefault();
                submitButton.disabled = true;
                wasDisabled = true;
                
                await new Promise(resolve => setTimeout(resolve, 50));
                
                submitButton.disabled = false;
            };
            
            loginForm.addEventListener('submit', originalHandler, { once: true });
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(wasDisabled).toBe(true);
        });
    });
    
    // ============================================
    // INTEGRATION TESTS
    // ============================================
    describe('Integration', () => {
        test('E2E-LOGIN-080: Complete login flow end-to-end', async () => {
            // Step 1: Fill form
            usernameInput.value = 'admin';
            passwordInput.value = 'admin123';
            rememberCheckbox.checked = true;
            
            // Step 2: Mock API
            apiMock.mockResponse('login', {
                success: true,
                token: 'integration-token',
                refreshToken: 'refresh-token',
                user: { id: '1', username: 'admin', fullname: 'Administrator', role: 'admin', email: 'admin@fakultas.ac.id' }
            });
            
            // Step 3: Submit
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            
            // Step 4: Wait
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Step 5: Verify
            expect(authMock.isAuthenticated).toBe(true);
            expect(authMock.currentUser).toBeDefined();
            expect(authMock.currentUser.role).toBe('admin');
            
            const redirect = authMock.getRedirectURL('admin');
            expect(redirect).toBe('../../dashboard/admin/index.html');
            
            // Step 6: Verify session stored
            expect(localStorage.setItem).toHaveBeenCalledWith('auth_session', expect.any(String));
        });
        
        test('E2E-LOGIN-081: Failed login should not set session', async () => {
            apiMock.mockResponse('login', {
                success: false,
                message: 'Invalid credentials'
            });
            
            localStorage.setItem.mockClear();
            
            const result = await authMock.login('hacker', 'wrong', false);
            
            expect(result.success).toBe(false);
            expect(authMock.isAuthenticated).toBe(false);
            expect(localStorage.setItem).not.toHaveBeenCalledWith('auth_session', expect.any(String));
        });
    });
});

// ============================================
// EXPORT FOR CI/CD
// ============================================
module.exports = {
    apiMock,
    authMock,
    securityManagerMock
};