// FILE: tests/unit/security.test.js
runner.describe('Unit Test: Security Modules', () => {
    
    runner.it('SecurityManager should validate password strength', () => {
        const result = securityManager.validatePasswordStrength('Weak1!');
        assert.true(result.valid, 'Valid password should pass');
        assert.greaterThan(result.strength, 60, 'Strength should be > 60');
    });
    
    runner.it('SecurityManager should reject weak password', () => {
        const result = securityManager.validatePasswordStrength('12345');
        assert.false(result.valid, 'Weak password should fail');
        assert.true(result.errors.length > 0, 'Should have error messages');
        assert.lessThan(result.strength, 40, 'Strength should be < 40');
    });
    
    runner.it('WAF should detect SQL injection in request body', () => {
        const result = waf.inspectRequest('/api/data', {
            method: 'POST',
            body: "'; DROP TABLE users; --"
        });
        assert.false(result.allowed, 'Should block SQL injection');
        assert.equal(result.severity, 'critical', 'Should be critical severity');
    });
    
    runner.it('WAF should allow normal requests', () => {
        const result = waf.inspectRequest('/api/surat?kategori=K.UM', {
            method: 'GET'
        });
        assert.true(result.allowed, 'Should allow normal GET request');
    });
    
    runner.it('WAF should detect scanner user agents', () => {
        const result = waf.inspectRequest('/api/data', {
            headers: { 'User-Agent': 'sqlmap/1.0' }
        });
        assert.false(result.allowed, 'Should block scanner');
    });
    
    runner.it('RateLimiter should allow within limit', () => {
        for (let i = 0; i < 50; i++) {
            const result = rateLimiter.checkLimit('test-key-' + i);
            assert.true(result.allowed, `Request ${i} should be allowed`);
        }
    });
    
    runner.it('RateLimiter should block after exceeding limit', () => {
        const key = 'block-test-key';
        
        for (let i = 0; i < 150; i++) {
            rateLimiter.checkLimit(key);
        }
        
        const result = rateLimiter.checkLimit(key);
        assert.false(result.allowed, 'Should block after exceeding limit');
    });
    
    runner.it('CSRF token should be unique', () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
            tokens.add(csrfProtection.generateToken());
        }
        assert.equal(tokens.size, 100, 'All tokens should be unique');
    });
    
    runner.it('IDS should detect brute force', () => {
        for (let i = 0; i < 10; i++) {
            ids.recordEvent('login_attempt', {
                username: 'test',
                success: false,
                timestamp: Date.now()
            });
        }
        
        const stats = ids.getStatistics();
        assert.greaterThan(stats.threatLevel, 0, 'Threat level should increase');
    });
    
    runner.it('Session hardening should detect fingerprint change', () => {
        sessionHardening.createSessionFingerprint();
        
        // Simulate fingerprint change
        const originalFingerprint = sessionHardening.sessionFingerprint;
        sessionHardening.sessionFingerprint = 'different-fingerprint';
        
        const check = sessionHardening.checkFingerprint();
        assert.false(check.passed, 'Should detect fingerprint change');
        
        // Restore
        sessionHardening.sessionFingerprint = originalFingerprint;
    });
});

function beforeAll(fn) { fn(); }