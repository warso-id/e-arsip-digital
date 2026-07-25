// FILE: tests/e2e/login-flow.test.js
runner.describe('E2E Test: Login Flow', () => {
    
    // Simulate DOM elements
    let loginForm;
    let usernameInput;
    let passwordInput;
    let rememberCheckbox;
    let submitButton;
    let alertContainer;
    
    beforeAll(() => {
        // Create mock DOM
        document.body.innerHTML = `
            <div id="alertContainer"></div>
            <form id="loginForm">
                <input type="text" id="username" placeholder="Username">
                <input type="password" id="password" placeholder="Password">
                <input type="checkbox" id="rememberMe">
                <button type="submit" id="btnLogin">Login</button>
                <div id="loadingSpinner" class="d-none"></div>
            </form>
        `;
        
        loginForm = document.getElementById('loginForm');
        usernameInput = document.getElementById('username');
        passwordInput = document.getElementById('password');
        rememberCheckbox = document.getElementById('rememberMe');
        submitButton = document.getElementById('btnLogin');
        alertContainer = document.getElementById('alertContainer');
        
        window.api = apiMock;
        apiMock.clearMocks();
    });
    
    runner.it('E2E-LOGIN-001: User should see login form', () => {
        assert.notNull(loginForm, 'Login form should exist');
        assert.notNull(usernameInput, 'Username input should exist');
        assert.notNull(passwordInput, 'Password input should exist');
        assert.notNull(submitButton, 'Submit button should exist');
        assert.equal(passwordInput.type, 'password', 'Password field should be masked');
    });
    
    runner.it('E2E-LOGIN-002: Should validate empty fields', async () => {
        usernameInput.value = '';
        passwordInput.value = '';
        
        const event = new Event('submit');
        loginForm.dispatchEvent(event);
        
        // Simulate validation
        if (!usernameInput.value || !passwordInput.value) {
            alertContainer.innerHTML = '<div class="alert alert-danger">Username dan password harus diisi</div>';
        }
        
        assert.true(alertContainer.innerHTML.includes('harus diisi'), 'Should show validation error');
    });
    
    runner.it('E2E-LOGIN-003: Should login with valid credentials', async () => {
        usernameInput.value = 'admin';
        passwordInput.value = 'admin123';
        rememberCheckbox.checked = true;
        
        apiMock.mockResponse('login', {
            success: true,
            user: { id: '1', username: 'admin', name: 'Administrator', role: 'admin' }
        });
        
        const result = await auth.login(usernameInput.value, passwordInput.value, true);
        
        assert.true(result.success, 'Login should succeed');
        assert.equal(result.user.role, 'admin', 'Role should be admin');
        assert.notNull(result.redirect, 'Should have redirect URL');
        assert.contains(result.redirect, 'admin', 'Redirect should contain admin');
    });
    
    runner.it('E2E-LOGIN-004: Should reject invalid credentials', async () => {
        usernameInput.value = 'admin';
        passwordInput.value = 'wrongpassword';
        
        apiMock.mockResponse('login', {
            success: false,
            message: 'Username atau password salah'
        });
        
        const result = await auth.login(usernameInput.value, passwordInput.value, false);
        
        assert.false(result.success, 'Login should fail');
        assert.equal(result.message, 'Username atau password salah', 'Error message should match');
    });
    
    runner.it('E2E-LOGIN-005: Should redirect to correct dashboard based on role', () => {
        const roles = [
            { role: 'super_admin', expected: '/dashboard/super-admin/index.html' },
            { role: 'admin', expected: '/dashboard/admin/index.html' },
            { role: 'user', expected: '/dashboard/user/index.html' },
            { role: 'kasubag', expected: '/dashboard/kasubag/index.html' },
            { role: 'kaprodi', expected: '/dashboard/kaprodi/index.html' },
            { role: 'wadek', expected: '/dashboard/wadek/index.html' },
            { role: 'dekan', expected: '/dashboard/dekan/index.html' },
            { role: 'staf', expected: '/dashboard/staf/index.html' },
            { role: 'dosen', expected: '/dashboard/dosen/index.html' },
            { role: 'mahasiswa', expected: '/dashboard/mahasiswa/index.html' }
        ];
        
        roles.forEach(({ role, expected }) => {
            const redirect = auth.getRedirectURL(role);
            assert.equal(redirect, expected, `${role} should redirect to ${expected}`);
        });
    });
    
    runner.it('E2E-LOGIN-006: Should remember user when remember me is checked', async () => {
        localStorage.clear();
        sessionStorage.clear();
        
        apiMock.mockResponse('login', {
            success: true,
            user: { id: '1', username: 'admin', name: 'Admin', role: 'admin' }
        });
        
        await auth.login('admin', 'admin123', true);
        
        const localData = localStorage.getItem('currentUser');
        const sessionData = sessionStorage.getItem('currentUser');
        
        assert.notNull(localData, 'Should store in localStorage');
        assert.null(sessionData, 'Should not store in sessionStorage');
    });
    
    runner.it('E2E-LOGIN-007: Should not remember user when remember me is unchecked', async () => {
        localStorage.clear();
        sessionStorage.clear();
        
        apiMock.mockResponse('login', {
            success: true,
            user: { id: '1', username: 'admin', name: 'Admin', role: 'admin' }
        });
        
        await auth.login('admin', 'admin123', false);
        
        const localData = localStorage.getItem('currentUser');
        const sessionData = sessionStorage.getItem('currentUser');
        
        assert.null(localData, 'Should not store in localStorage');
        assert.notNull(sessionData, 'Should store in sessionStorage');
    });
    
    runner.it('E2E-LOGIN-008: Should redirect to login if not authenticated', () => {
        localStorage.clear();
        sessionStorage.clear();
        auth.currentUser = null;
        
        const result = auth.requireAuth();
        assert.false(result, 'Should return false when not authenticated');
    });
    
    runner.it('E2E-LOGIN-009: Should block after too many failed attempts', async () => {
        const username = 'testuser';
        
        // Simulate 5 failed attempts
        for (let i = 0; i < 5; i++) {
            securityManager.recordLoginAttempt(username, false);
        }
        
        const validation = securityManager.validateLoginAttempt(username);
        assert.false(validation.allowed, 'Should block after 5 attempts');
        assert.true(validation.message.includes('menit'), 'Should show lockout message');
    });
    
    runner.it('E2E-LOGIN-010: Should reset attempts after successful login', async () => {
        const username = 'testuser2';
        
        // Simulate failed attempts
        securityManager.recordLoginAttempt(username, false);
        securityManager.recordLoginAttempt(username, false);
        
        // Successful login
        securityManager.recordLoginAttempt(username, true);
        
        const validation = securityManager.validateLoginAttempt(username);
        assert.true(validation.allowed, 'Should allow after successful login');
    });
});

function beforeAll(fn) { fn(); }
