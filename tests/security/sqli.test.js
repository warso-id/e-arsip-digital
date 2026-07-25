// FILE: tests/security/sqli.test.js
// ============================================
// SECURITY TEST - SQL INJECTION PREVENTION
// ============================================

runner.describe('Security Test: SQL Injection Prevention', () => {
    
    runner.it('should detect UNION SELECT injection', () => {
        const malicious = "1 UNION SELECT * FROM users";
        const result = waf.inspectRequest('/api/data?q=' + encodeURIComponent(malicious));
        assert.false(result.allowed, 'Should block UNION SELECT');
    });
    
    runner.it('should detect OR 1=1 injection', () => {
        const malicious = "' OR '1'='1";
        const result = waf.inspectRequest('/api/login?user=' + encodeURIComponent(malicious));
        assert.false(result.allowed, 'Should block OR 1=1');
    });
    
    runner.it('should detect DROP TABLE injection', () => {
        const malicious = "'; DROP TABLE users; --";
        const result = waf.inspectRequest('/api/data?q=' + encodeURIComponent(malicious));
        assert.false(result.allowed, 'Should block DROP TABLE');
    });
    
    runner.it('should detect INSERT injection', () => {
        const malicious = "'; INSERT INTO users VALUES ('hacker','pass'); --";
        const result = waf.inspectRequest('/api/data', { body: malicious });
        assert.false(result.allowed, 'Should block INSERT INTO');
    });
    
    runner.it('should detect DELETE injection', () => {
        const malicious = "1; DELETE FROM users WHERE 1=1";
        const result = waf.inspectRequest('/api/data?q=' + encodeURIComponent(malicious));
        assert.false(result.allowed, 'Should block DELETE FROM');
    });
    
    runner.it('should detect UPDATE injection', () => {
        const malicious = "1; UPDATE users SET password='hacked'";
        const result = waf.inspectRequest('/api/data', { body: malicious });
        assert.false(result.allowed, 'Should block UPDATE SET');
    });
    
    runner.it('should detect EXEC injection', () => {
        const malicious = "1; EXEC xp_cmdshell('dir')";
        const result = waf.inspectRequest('/api/data?q=' + encodeURIComponent(malicious));
        assert.false(result.allowed, 'Should block EXEC');
    });
    
    runner.it('should detect ALTER TABLE injection', () => {
        const malicious = "1; ALTER TABLE users ADD COLUMN hacked TEXT";
        const result = waf.inspectRequest('/api/data', { body: malicious });
        assert.false(result.allowed, 'Should block ALTER TABLE');
    });
    
    runner.it('should allow normal queries', () => {
        const normalInputs = [
            'Laporan Kegiatan',
            'Surat Masuk',
            'Fakultas Ilmu Komputer',
            '12345',
            'test@example.com'
        ];
        
        normalInputs.forEach(input => {
            const result = waf.inspectRequest('/api/data?q=' + encodeURIComponent(input));
            assert.true(result.allowed, `Should allow: ${input}`);
        });
    });
    
    runner.it('sanitizeSQL should escape single quotes', () => {
        const input = "O'Brien";
        const sanitized = advancedSanitizer.sanitizeSQL(input);
        assert.equal(sanitized, "O''Brien", 'Single quote should be doubled');
    });
    
    runner.it('sanitizeSQL should remove SQL comments', () => {
        const input = "test--comment";
        const sanitized = advancedSanitizer.sanitizeSQL(input);
        assert.false(sanitized.includes('--'), 'SQL comments should be removed');
    });
<<<<<<< HEAD
});
=======
});
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
