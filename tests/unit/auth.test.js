// tests/unit/auth.test.js - Enterprise Authentication Service Unit Tests 2026
/**
 * E-Arsip Digital - Auth Service Unit Test Suite
 * Version: 2026.1.0
 * Tests: Login/logout, remember me, role checking, permissions,
 *        token management, session handling, security checks
 * Framework: Jest with proper mocking
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// MOCK AUTH SERVICE
// ============================================

class AuthService {
    constructor() {
        this.currentUser = null;
        this.currentToken = null;
        this.refreshToken = null;
        this.isAuthenticated = false;
        this.tokenExpiry = null;
        this.USER_KEY = 'currentUser';
        this.TOKEN_KEY = 'auth_token';
        this.REFRESH_KEY = 'auth_refresh_token';
        this.SESSION_KEY = 'session_data';
    }

    checkAuth() {
        // Try localStorage first
        let userData = localStorage.getItem(this.USER_KEY);
        let source = 'localStorage';

        // Try sessionStorage if not in localStorage
        if (!userData) {
            userData = sessionStorage.getItem(this.USER_KEY);
            source = 'sessionStorage';
        }

        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.isAuthenticated = true;
                this.currentToken = localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
                return true;
            } catch {
                this.clearAuth();
                return false;
            }
        }

        this.isAuthenticated = false;
        return false;
    }

    async login(username, password, rememberMe = false) {
        if (!username || !password) {
            return { success: false, message: 'Username dan password wajib diisi' };
        }

        // Simulate API call
        const response = await this.mockLoginAPI(username, password);

        if (response.success) {
            this.currentUser = response.user;
            this.currentToken = response.token;
            this.refreshToken = response.refreshToken;
            this.isAuthenticated = true;
            this.tokenExpiry = Date.now() + 3600000;

            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem(this.USER_KEY, JSON.stringify(response.user));

            if (rememberMe) {
                localStorage.setItem(this.TOKEN_KEY, response.token);
                localStorage.setItem(this.REFRESH_KEY, response.refreshToken);
            } else {
                sessionStorage.setItem(this.TOKEN_KEY, response.token);
                sessionStorage.setItem(this.REFRESH_KEY, response.refreshToken);
            }
        }

        return response;
    }

    async mockLoginAPI(username, password) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 10));

        const validUsers = {
            'admin': { password: 'admin123', user: { id: '1', username: 'admin', name: 'Administrator', role: 'super_admin', permissions: ['all'] } },
            'dekan': { password: 'dekan123', user: { id: '2', username: 'dekan', name: 'Dr. Ahmad Fauzi, M.Kom', role: 'dekan', permissions: ['approve_surat', 'view_reports'] } },
            'kaprodi': { password: 'kaprodi123', user: { id: '3', username: 'kaprodi', name: 'Siti Nurhaliza, S.Kom., M.T.', role: 'kaprodi', permissions: ['manage_surat', 'view_reports'] } },
            'staf': { password: 'staf123', user: { id: '4', username: 'staf', name: 'Budi Santoso', role: 'staf', permissions: ['create_surat'] } },
            'user': { password: 'user123', user: { id: '5', username: 'user', name: 'Regular User', role: 'user', permissions: [] } }
        };

        const userRecord = validUsers[username];

        if (!userRecord) {
            return { success: false, message: 'Username tidak ditemukan' };
        }

        if (userRecord.password !== password) {
            return { success: false, message: 'Password salah' };
        }

        return {
            success: true,
            user: { ...userRecord.user },
            token: `mock-token-${username}-${Date.now()}`,
            refreshToken: `mock-refresh-${username}-${Date.now()}`,
            message: 'Login berhasil'
        };
    }

    logout() {
        this.currentUser = null;
        this.currentToken = null;
        this.refreshToken = null;
        this.isAuthenticated = false;
        this.tokenExpiry = null;

        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_KEY);
        sessionStorage.removeItem(this.USER_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.REFRESH_KEY);
        sessionStorage.removeItem(this.SESSION_KEY);
    }

    clearAuth() {
        this.logout();
    }

    getRedirectURL(role) {
        const redirects = {
            'super_admin': '/dashboard/super-admin/index.html',
            'admin': '/dashboard/admin/index.html',
            'user': '/dashboard/user/index.html',
            'kasubag': '/dashboard/kasubag/index.html',
            'kaprodi': '/dashboard/kaprodi/index.html',
            'wadek': '/dashboard/wadek/index.html',
            'dekan': '/dashboard/dekan/index.html',
            'staf': '/dashboard/staf/index.html',
            'dosen': '/dashboard/dosen/index.html',
            'mahasiswa': '/dashboard/mahasiswa/index.html'
        };

        return redirects[role] || '/dashboard/user/index.html';
    }

    hasRole(role) {
        if (!this.currentUser) return false;
        // super_admin has all roles
        if (this.currentUser.role === 'super_admin') return true;
        return this.currentUser.role === role;
    }

    hasAnyRole(roles) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'super_admin') return true;
        return roles.includes(this.currentUser.role);
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'super_admin') return true;
        if (this.currentUser.permissions?.includes('all')) return true;
        return this.currentUser.permissions?.includes(permission) || false;
    }

    requireAuth() {
        if (!this.checkAuth()) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login.html';
            }
            return false;
        }
        return true;
    }

    getCurrentUser() {
        return this.currentUser ? { ...this.currentUser } : null;
    }

    updateCurrentUser(updates) {
        if (this.currentUser) {
            this.currentUser = { ...this.currentUser, ...updates };
            // Update storage
            const stored = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);
            if (stored) {
                const storage = localStorage.getItem(this.USER_KEY) ? localStorage : sessionStorage;
                storage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
            }
        }
    }

    isTokenExpired() {
        if (!this.tokenExpiry) return true;
        return Date.now() > this.tokenExpiry;
    }

    async refreshAuthToken() {
        if (!this.refreshToken) return false;
        // Simulate token refresh
        this.currentToken = `refreshed-token-${Date.now()}`;
        this.tokenExpiry = Date.now() + 3600000;
        return true;
    }
}

// ============================================
// STORAGE MOCKS
// ============================================

const createStorageMock = () => {
    const store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        get length() { return Object.keys(store).length; },
        key: jest.fn((index) => Object.keys(store)[index] || null),
        _store: store
    };
};

// ============================================
// TEST SETUP
// ============================================

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

let auth;

beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true });
    Object.defineProperty(window, 'location', {
        value: { href: '', origin: 'https://e-arsip.example.com' },
        writable: true, configurable: true
    });
});

beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    jest.clearAllMocks();
    auth = new AuthService();
});

// ============================================
// AUTHENTICATION STATUS TESTS
// ============================================

describe('Authentication Status', () => {
    it('Should return false when no user data exists', () => {
        const result = auth.checkAuth();

        expect(result).toBe(false);
        expect(auth.currentUser).toBeNull();
        expect(auth.isAuthenticated).toBe(false);
    });

    it('Should return true when user data in localStorage', () => {
        const userData = { id: '1', username: 'admin', name: 'Admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));

        const result = auth.checkAuth();

        expect(result).toBe(true);
        expect(auth.currentUser).toBeDefined();
        expect(auth.currentUser.username).toBe('admin');
        expect(auth.isAuthenticated).toBe(true);
    });

    it('Should return true when user data in sessionStorage', () => {
        const userData = { id: '2', username: 'user', name: 'User', role: 'user' };
        sessionStorage.setItem('currentUser', JSON.stringify(userData));

        const result = auth.checkAuth();

        expect(result).toBe(true);
        expect(auth.currentUser.role).toBe('user');
    });

    it('Should prioritize localStorage over sessionStorage', () => {
        localStorage.setItem('currentUser', JSON.stringify({ id: '1', role: 'admin' }));
        sessionStorage.setItem('currentUser', JSON.stringify({ id: '2', role: 'user' }));

        auth.checkAuth();

        expect(auth.currentUser.role).toBe('admin');
    });

    it('Should handle corrupted user data gracefully', () => {
        localStorage.setItem('currentUser', 'not-valid-json{{{');

        const result = auth.checkAuth();

        expect(result).toBe(false);
        expect(auth.currentUser).toBeNull();
    });
});

// ============================================
// LOGIN TESTS
// ============================================

describe('Login', () => {
    it('Should login successfully with valid admin credentials', async () => {
        const result = await auth.login('admin', 'admin123', false);

        expect(result.success).toBe(true);
        expect(result.user.role).toBe('super_admin');
        expect(result.token).toBeDefined();
        expect(auth.currentUser).toBeDefined();
        expect(auth.isAuthenticated).toBe(true);
        expect(auth.currentToken).toBeDefined();
    });

    it('Should login successfully with valid dekan credentials', async () => {
        const result = await auth.login('dekan', 'dekan123', false);

        expect(result.success).toBe(true);
        expect(result.user.role).toBe('dekan');
    });

    it('Should login successfully with valid staf credentials', async () => {
        const result = await auth.login('staf', 'staf123', false);

        expect(result.success).toBe(true);
        expect(result.user.role).toBe('staf');
    });

    it('Should fail with wrong password', async () => {
        const result = await auth.login('admin', 'wrongpass', false);

        expect(result.success).toBe(false);
        expect(result.message).toContain('salah');
        expect(auth.currentUser).toBeNull();
    });

    it('Should fail with non-existent username', async () => {
        const result = await auth.login('hacker', 'password', false);

        expect(result.success).toBe(false);
        expect(result.message).toContain('tidak ditemukan');
    });

    it('Should fail with empty credentials', async () => {
        const result = await auth.login('', '', false);

        expect(result.success).toBe(false);
        expect(result.message).toContain('wajib diisi');
    });

    it('Should fail with null credentials', async () => {
        const result = await auth.login(null, null, false);

        expect(result.success).toBe(false);
    });

    it('Should store in localStorage when remember me is checked', async () => {
        await auth.login('admin', 'admin123', true);

        expect(localStorage.setItem).toHaveBeenCalledWith('currentUser', expect.any(String));
        expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', expect.any(String));
        expect(sessionStorage.setItem).not.toHaveBeenCalledWith('currentUser', expect.any(String));
    });

    it('Should store in sessionStorage when remember me is unchecked', async () => {
        await auth.login('admin', 'admin123', false);

        expect(sessionStorage.setItem).toHaveBeenCalledWith('currentUser', expect.any(String));
        expect(localStorage.setItem).not.toHaveBeenCalledWith('currentUser', expect.any(String));
    });

    it('Should set token expiry on login', async () => {
        await auth.login('admin', 'admin123', false);

        expect(auth.tokenExpiry).toBeDefined();
        expect(auth.tokenExpiry).toBeGreaterThan(Date.now());
    });
});

// ============================================
// LOGOUT TESTS
// ============================================

describe('Logout', () => {
    beforeEach(async () => {
        await auth.login('admin', 'admin123', true);
    });

    it('Should clear all user data', () => {
        auth.logout();

        expect(auth.currentUser).toBeNull();
        expect(auth.currentToken).toBeNull();
        expect(auth.refreshToken).toBeNull();
        expect(auth.isAuthenticated).toBe(false);
        expect(auth.tokenExpiry).toBeNull();
    });

    it('Should clear localStorage', () => {
        auth.logout();

        expect(localStorage.removeItem).toHaveBeenCalledWith('currentUser');
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('Should clear sessionStorage', () => {
        auth.logout();

        expect(sessionStorage.removeItem).toHaveBeenCalledWith('currentUser');
        expect(sessionStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('Should be able to login again after logout', async () => {
        auth.logout();
        const result = await auth.login('dekan', 'dekan123', false);

        expect(result.success).toBe(true);
        expect(auth.currentUser.role).toBe('dekan');
    });
});

// ============================================
// ROLE & PERMISSION TESTS
// ============================================

describe('Roles & Permissions', () => {
    it('Should redirect to correct dashboard for each role', () => {
        const redirects = {
            'super_admin': '/dashboard/super-admin/index.html',
            'admin': '/dashboard/admin/index.html',
            'user': '/dashboard/user/index.html',
            'kasubag': '/dashboard/kasubag/index.html',
            'kaprodi': '/dashboard/kaprodi/index.html',
            'wadek': '/dashboard/wadek/index.html',
            'dekan': '/dashboard/dekan/index.html',
            'staf': '/dashboard/staf/index.html',
            'dosen': '/dashboard/dosen/index.html',
            'mahasiswa': '/dashboard/mahasiswa/index.html'
        };

        for (const [role, expectedPath] of Object.entries(redirects)) {
            expect(auth.getRedirectURL(role)).toBe(expectedPath);
        }
    });

    it('Should return user dashboard for unknown role', () => {
        expect(auth.getRedirectURL('unknown_role')).toBe('/dashboard/user/index.html');
    });

    it('Should check hasRole correctly for admin', () => {
        auth.currentUser = { id: '1', role: 'admin' };

        expect(auth.hasRole('admin')).toBe(true);
        expect(auth.hasRole('dekan')).toBe(false);
        expect(auth.hasRole('super_admin')).toBe(false);
    });

    it('Should grant all roles to super_admin', () => {
        auth.currentUser = { id: '1', role: 'super_admin' };

        expect(auth.hasRole('admin')).toBe(true);
        expect(auth.hasRole('dekan')).toBe(true);
        expect(auth.hasRole('user')).toBe(true);
        expect(auth.hasRole('kaprodi')).toBe(true);
    });

    it('Should return false for all roles when not authenticated', () => {
        expect(auth.hasRole('admin')).toBe(false);
        expect(auth.hasRole('dekan')).toBe(false);
    });

    it('Should check hasAnyRole correctly', () => {
        auth.currentUser = { id: '1', role: 'admin' };

        expect(auth.hasAnyRole(['admin', 'dekan'])).toBe(true);
        expect(auth.hasAnyRole(['dekan', 'kaprodi'])).toBe(false);
        expect(auth.hasAnyRole([])).toBe(false);
    });

    it('Should check permissions correctly', () => {
        auth.currentUser = {
            id: '1',
            role: 'admin',
            permissions: ['manage_users', 'approve_surat']
        };

        expect(auth.hasPermission('manage_users')).toBe(true);
        expect(auth.hasPermission('approve_surat')).toBe(true);
        expect(auth.hasPermission('delete_surat')).toBe(false);
    });

    it('Should grant all permissions to super_admin', () => {
        auth.currentUser = { id: '1', role: 'super_admin', permissions: [] };

        expect(auth.hasPermission('any_permission')).toBe(true);
    });

    it('Should grant all permissions with "all" permission', () => {
        auth.currentUser = { id: '1', role: 'admin', permissions: ['all'] };

        expect(auth.hasPermission('any_permission')).toBe(true);
    });
});

// ============================================
// USER MANAGEMENT TESTS
// ============================================

describe('User Management', () => {
    beforeEach(() => {
        auth.currentUser = { id: '1', username: 'admin', name: 'Admin', role: 'admin', email: 'admin@test.com' };
    });

    it('Should get current user', () => {
        const user = auth.getCurrentUser();

        expect(user).toBeDefined();
        expect(user.username).toBe('admin');
        expect(user.role).toBe('admin');
        // Should return a copy, not reference
        expect(user).not.toBe(auth.currentUser);
    });

    it('Should return null when no user', () => {
        auth.currentUser = null;

        expect(auth.getCurrentUser()).toBeNull();
    });

    it('Should update current user', () => {
        auth.currentUser = { id: '1', username: 'admin', name: 'Admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(auth.currentUser));

        auth.updateCurrentUser({ name: 'Admin Updated', phone: '08123456789' });

        expect(auth.currentUser.name).toBe('Admin Updated');
        expect(auth.currentUser.phone).toBe('08123456789');
        expect(auth.currentUser.role).toBe('admin'); // Unchanged
    });

    it('Should not throw when updating null user', () => {
        auth.currentUser = null;

        expect(() => auth.updateCurrentUser({ name: 'Test' })).not.toThrow();
    });

    it('Should update storage when updating user', () => {
        auth.currentUser = { id: '1', name: 'Original' };
        localStorage.setItem('currentUser', JSON.stringify(auth.currentUser));

        auth.updateCurrentUser({ name: 'Updated' });

        expect(localStorage.setItem).toHaveBeenCalledWith('currentUser', expect.stringContaining('Updated'));
    });
});

// ============================================
// TOKEN MANAGEMENT TESTS
// ============================================

describe('Token Management', () => {
    it('Should detect expired token', () => {
        auth.tokenExpiry = Date.now() - 1000;
        expect(auth.isTokenExpired()).toBe(true);
    });

    it('Should detect valid token', () => {
        auth.tokenExpiry = Date.now() + 3600000;
        expect(auth.isTokenExpired()).toBe(false);
    });

    it('Should return expired when no expiry set', () => {
        auth.tokenExpiry = null;
        expect(auth.isTokenExpired()).toBe(true);
    });

    it('Should refresh token successfully', async () => {
        auth.refreshToken = 'valid-refresh-token';
        auth.tokenExpiry = Date.now() - 1000;

        const result = await auth.refreshAuthToken();

        expect(result).toBe(true);
        expect(auth.currentToken).toContain('refreshed-token');
        expect(auth.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('Should fail refresh without refresh token', async () => {
        auth.refreshToken = null;

        const result = await auth.refreshAuthToken();

        expect(result).toBe(false);
    });
});

// ============================================
// REQUIRE AUTH TESTS
// ============================================

describe('Require Auth', () => {
    it('Should return true when authenticated', () => {
        localStorage.setItem('currentUser', JSON.stringify({ id: '1', role: 'admin' }));

        const result = auth.requireAuth();

        expect(result).toBe(true);
    });

    it('Should return false and redirect when not authenticated', () => {
        const result = auth.requireAuth();

        expect(result).toBe(false);
        expect(window.location.href).toBe('/login.html');
    });
});

// ============================================
// SECURITY TESTS
// ============================================

describe('Security', () => {
    it('Should not expose password in user object', async () => {
        const result = await auth.login('admin', 'admin123', false);

        expect(result.user.password).toBeUndefined();
        expect(auth.currentUser.password).toBeUndefined();
    });

    it('Should not store password in storage', async () => {
        await auth.login('admin', 'admin123', true);

        const stored = JSON.parse(localStorageMock._store['currentUser'] || '{}');
        expect(stored.password).toBeUndefined();
    });

    it('Should clear sensitive data on logout', async () => {
        await auth.login('admin', 'admin123', true);
        auth.logout();

        expect(auth.currentToken).toBeNull();
        expect(auth.refreshToken).toBeNull();
    });

    it('Should handle rapid login/logout cycles', async () => {
        for (let i = 0; i < 5; i++) {
            await auth.login('admin', 'admin123', false);
            auth.logout();
        }

        expect(auth.currentUser).toBeNull();
        expect(auth.isAuthenticated).toBe(false);
    });
});