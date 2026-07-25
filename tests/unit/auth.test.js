// FILE: tests/unit/auth.test.js
// ============================================
// UNIT TEST - AUTHENTICATION SERVICE
// ============================================

runner.describe('Unit Test: Authentication Service', () => {
    
    // Setup mock localStorage and sessionStorage
    const storageMock = {};
    
    beforeAll(() => {
        // Mock localStorage
        global.localStorage = {
            getItem: (key) => storageMock[key] || null,
            setItem: (key, value) => { storageMock[key] = value; },
            removeItem: (key) => { delete storageMock[key]; },
            clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
        };
        
        // Mock sessionStorage
        global.sessionStorage = {
            getItem: (key) => storageMock['session_' + key] || null,
            setItem: (key, value) => { storageMock['session_' + key] = value; },
            removeItem: (key) => { delete storageMock['session_' + key]; },
            clear: () => { Object.keys(storageMock).forEach(k => { if (k.startsWith('session_')) delete storageMock[k]; }) }
        };
    });
    
    beforeEach(() => {
        storageMock.clear = storageMock.clear || function() {};
        localStorage.clear();
        sessionStorage.clear();
    });
    
    runner.it('checkAuth should return false when no user data', () => {
        const result = auth.checkAuth();
        assert.false(result, 'Should return false when not authenticated');
        assert.null(auth.currentUser, 'Current user should be null');
    });
    
    runner.it('checkAuth should return true when user data exists in localStorage', () => {
        const userData = { id: '1', username: 'admin', name: 'Admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        const result = auth.checkAuth();
        assert.true(result, 'Should return true when user data exists');
        assert.notNull(auth.currentUser, 'Current user should not be null');
        assert.equal(auth.currentUser.username, 'admin', 'Username should match');
    });
    
    runner.it('checkAuth should return true when user data exists in sessionStorage', () => {
        const userData = { id: '2', username: 'user', name: 'User', role: 'user' };
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        
        const result = auth.checkAuth();
        assert.true(result, 'Should return true when session data exists');
        assert.equal(auth.currentUser.role, 'user', 'Role should match');
    });
    
    runner.it('login should authenticate valid credentials', async () => {
        // Mock API
        const originalSendRequest = api.sendRequest;
        api.sendRequest = async () => ({
            success: true,
            user: { id: '1', username: 'admin', name: 'Admin', role: 'admin' }
        });
        
        const result = await auth.login('admin', 'admin123', false);
        
        assert.true(result.success, 'Login should succeed');
        assert.equal(result.user.role, 'admin', 'Role should be admin');
        assert.notNull(auth.currentUser, 'Current user should be set');
        
        // Restore
        api.sendRequest = originalSendRequest;
    });
    
    runner.it('login should fail with invalid credentials', async () => {
        const originalSendRequest = api.sendRequest;
        api.sendRequest = async () => ({
            success: false,
            message: 'Username atau password salah'
        });
        
        const result = await auth.login('admin', 'wrongpass', false);
        
        assert.false(result.success, 'Login should fail');
        assert.equal(result.message, 'Username atau password salah', 'Error message should match');
        
        api.sendRequest = originalSendRequest;
    });
    
    runner.it('login with remember me should store in localStorage', async () => {
        const originalSendRequest = api.sendRequest;
        api.sendRequest = async () => ({
            success: true,
            user: { id: '1', username: 'admin', name: 'Admin', role: 'admin' }
        });
        
        await auth.login('admin', 'admin123', true);
        
        const stored = localStorage.getItem('currentUser');
        assert.notNull(stored, 'Should store in localStorage');
        
        api.sendRequest = originalSendRequest;
    });
    
    runner.it('login without remember me should store in sessionStorage', async () => {
        const originalSendRequest = api.sendRequest;
        api.sendRequest = async () => ({
            success: true,
            user: { id: '1', username: 'admin', name: 'Admin', role: 'admin' }
        });
        
        await auth.login('admin', 'admin123', false);
        
        const stored = sessionStorage.getItem('currentUser');
        assert.notNull(stored, 'Should store in sessionStorage');
        
        api.sendRequest = originalSendRequest;
    });
    
    runner.it('logout should clear all storage', () => {
        localStorage.setItem('currentUser', JSON.stringify({ id: '1' }));
        sessionStorage.setItem('currentUser', JSON.stringify({ id: '1' }));
        
        auth.logout();
        
        assert.null(localStorage.getItem('currentUser'), 'localStorage should be cleared');
        assert.null(sessionStorage.getItem('currentUser'), 'sessionStorage should be cleared');
        assert.null(auth.currentUser, 'Current user should be null');
    });
    
    runner.it('getRedirectURL should return correct URL for each role', () => {
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
            const path = auth.getRedirectURL(role);
            assert.equal(path, expectedPath, `${role} should redirect to ${expectedPath}`);
        }
    });
    
    runner.it('hasRole should check role correctly', () => {
        const userData = { id: '1', username: 'admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
        
        assert.true(auth.hasRole('admin'), 'Should have admin role');
        assert.false(auth.hasRole('dekan'), 'Should not have dekan role');
        assert.false(auth.hasRole('super_admin'), 'Should not have super_admin role');
    });
    
    runner.it('super_admin should have access to all roles', () => {
        const userData = { id: '1', username: 'super', role: 'super_admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
        
        assert.true(auth.hasRole('admin'), 'Super admin should access admin');
        assert.true(auth.hasRole('dekan'), 'Super admin should access dekan');
        assert.true(auth.hasRole('user'), 'Super admin should access user');
    });
    
    runner.it('hasAnyRole should check multiple roles', () => {
        const userData = { id: '1', username: 'admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
        
        assert.true(auth.hasAnyRole(['admin', 'dekan']), 'Should have one of the roles');
        assert.false(auth.hasAnyRole(['dekan', 'kaprodi']), 'Should not have any of the roles');
    });
    
    runner.it('requireAuth should redirect when not authenticated', () => {
        localStorage.clear();
        sessionStorage.clear();
        auth.currentUser = null;
        
        const originalLocation = window.location;
        delete window.location;
        window.location = { href: '' };
        
        const result = auth.requireAuth();
        assert.false(result, 'Should return false');
        
        window.location = originalLocation;
    });
    
    runner.it('getCurrentUser should return current user', () => {
        const userData = { id: '1', username: 'admin', name: 'Admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
        
        const user = auth.getCurrentUser();
        assert.notNull(user, 'Should return user');
        assert.equal(user.username, 'admin', 'Username should match');
        assert.equal(user.role, 'admin', 'Role should match');
    });
    
    runner.it('updateCurrentUser should update user data', () => {
        const userData = { id: '1', username: 'admin', name: 'Admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
        
        auth.updateCurrentUser({ name: 'Admin Updated', phone: '08123456789' });
        
        const updated = auth.getCurrentUser();
        assert.equal(updated.name, 'Admin Updated', 'Name should be updated');
        assert.equal(updated.phone, '08123456789', 'Phone should be updated');
        assert.equal(updated.role, 'admin', 'Role should remain unchanged');
    });
});

// Helper functions for test setup
function beforeAll(fn) { fn(); }
function beforeEach(fn) { fn(); }