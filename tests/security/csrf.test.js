// FILE: tests/security/csrf.test.js
// ============================================
// SECURITY TEST - CSRF PROTECTION
// ============================================

runner.describe('Security Test: CSRF Protection', () => {
    
    runner.it('should generate CSRF token', () => {
        const token = csrfProtection.generateToken();
        assert.equal(token.length, 64, 'Token should be 64 characters');
        assert.type(token, 'string', 'Token should be string');
    });
    
    runner.it('should store and retrieve CSRF token', () => {
        const token = csrfProtection.generateToken();
        csrfProtection.setToken(token);
        
        const retrieved = csrfProtection.getToken();
        assert.equal(retrieved, token, 'Retrieved token should match');
    });
    
    runner.it('should refresh CSRF token', () => {
        const oldToken = csrfProtection.getToken();
        const newToken = csrfProtection.refreshToken();
        
        assert.notEqual(oldToken, newToken, 'New token should be different');
        assert.equal(newToken.length, 64, 'New token should be 64 characters');
    });
    
    runner.it('should detect same origin', () => {
        const sameOrigin = '/api/data';
        const differentOrigin = 'https://evil.com/api/data';
        
        assert.true(csrfProtection.isSameOrigin(sameOrigin), 'Relative URL is same origin');
        assert.true(csrfProtection.isSameOrigin(window.location.origin + '/test'), 'Same origin URL');
        assert.false(csrfProtection.isSameOrigin(differentOrigin), 'Different origin should be detected');
    });
    
    runner.it('should add CSRF token to headers', () => {
        const token = csrfProtection.generateToken();
        csrfProtection.setToken(token);
        
        const headers = csrfProtection.getHeaders();
        assert.equal(headers[csrfProtection.getHeaderName()], token, 'CSRF token should be in headers');
        assert.equal(headers['Content-Type'], 'application/json', 'Content-Type should be set');
    });
    
    runner.it('should create CSRF-protected form data', () => {
        const data = { name: 'Test', value: '123' };
        const formData = csrfProtection.createFormData(data);
        
        assert.true(formData.has('csrf_token'), 'FormData should contain CSRF token');
        assert.true(formData.has('name'), 'FormData should contain original data');
        assert.true(formData.has('value'), 'FormData should contain original data');
    });
    
    runner.it('should add token to forms', () => {
        // Create test form
        const form = document.createElement('form');
        form.id = 'testForm';
        document.body.appendChild(form);
        
        csrfProtection.addTokenToForm(form);
        
        const csrfInput = form.querySelector('input[name="csrf_token"]');
        assert.notNull(csrfInput, 'CSRF input should be added');
        assert.equal(csrfInput.type, 'hidden', 'Input should be hidden');
        assert.equal(csrfInput.value, csrfProtection.getToken(), 'Token should match');
        
        // Cleanup
        form.remove();
    });
});