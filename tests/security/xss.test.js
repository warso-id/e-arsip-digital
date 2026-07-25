// FILE: tests/security/xss.test.js
// ============================================
// SECURITY TEST - XSS PREVENTION
// ============================================

runner.describe('Security Test: XSS Prevention', () => {
    
    runner.it('should sanitize script tags', () => {
        const input = '<script>alert("XSS")</script>';
        const sanitized = xssPrevention.sanitize(input);
        assert.false(sanitized.includes('<script>'), 'Script tags should be removed');
        assert.false(sanitized.includes('</script>'), 'Closing script tags should be removed');
    });
    
    runner.it('should sanitize javascript: URLs', () => {
        const input = 'javascript:alert("XSS")';
        const sanitized = xssPrevention.sanitize(input);
        assert.false(sanitized.includes('javascript:'), 'javascript: should be removed');
    });
    
    runner.it('should sanitize event handlers', () => {
        const input = '<img onerror="alert(1)" src=x>';
        const sanitized = xssPrevention.sanitize(input);
        assert.false(sanitized.includes('onerror'), 'Event handlers should be removed');
    });
    
    runner.it('should sanitize onclick handlers', () => {
        const input = '<button onclick="stealCookies()">Click</button>';
        const sanitized = xssPrevention.sanitize(input);
        assert.false(sanitized.includes('onclick'), 'onclick should be removed');
    });
    
    runner.it('should sanitize onload handlers', () => {
        const input = '<body onload="malicious()">';
        const sanitized = xssPrevention.sanitize(input);
        assert.false(sanitized.includes('onload'), 'onload should be removed');
    });
    
    runner.it('should escape HTML entities', () => {
        const input = '<div>Test & Demo</div>';
        const escaped = xssPrevention.escapeHTML(input);
        assert.true(escaped.includes('&lt;'), 'Should escape <');
        assert.true(escaped.includes('&gt;'), 'Should escape >');
        assert.true(escaped.includes('&amp;'), 'Should escape &');
    });
    
    runner.it('should validate against XSS patterns', () => {
        const maliciousInputs = [
            '<script>alert(1)</script>',
            'javascript:void(0)',
            'onerror=alert(1)',
            '<iframe src="evil.com">',
            'eval("malicious code")',
            'document.cookie',
            'window.location="evil.com"',
            'data:text/html,<script>alert(1)</script>'
        ];
        
        maliciousInputs.forEach(input => {
            const result = xssPrevention.validateAgainstXSS(input);
            assert.false(result.valid, `Should detect XSS in: ${input.substring(0, 30)}...`);
        });
    });
    
    runner.it('should allow safe inputs', () => {
        const safeInputs = [
            'Hello World',
            'Nama: John Doe',
            'Email: test@example.com',
            'Alamat: Jl. Sudirman No. 123',
            '08123456789',
            'Laporan Kegiatan 2024'
        ];
        
        safeInputs.forEach(input => {
            const result = xssPrevention.validateAgainstXSS(input);
            assert.true(result.valid, `Should allow safe input: ${input}`);
        });
    });
    
    runner.it('should sanitize HTML content', () => {
        const html = '<p>Safe content</p><script>alert(1)</script><b>Bold</b>';
        const sanitized = xssPrevention.sanitizeHTML(html);
        assert.true(sanitized.includes('<p>'), 'Safe tags should remain');
        assert.true(sanitized.includes('<b>'), 'Safe tags should remain');
        assert.false(sanitized.includes('<script>'), 'Script tags should be removed');
    });
    
    runner.it('sanitizeObject should sanitize recursively', () => {
        const input = {
            name: '<script>alert(1)</script>',
            email: 'test@test.com',
            nested: {
                value: 'javascript:void(0)',
                array: ['<img onerror=alert(1)>', 'safe']
            }
        };
        
        const sanitized = xssPrevention.sanitizeObject(input);
        assert.false(sanitized.name.includes('<script>'), 'Nested script should be removed');
        assert.false(sanitized.nested.value.includes('javascript:'), 'Nested javascript: should be removed');
        assert.false(sanitized.nested.array[0].includes('onerror'), 'Array event handler should be removed');
        assert.equal(sanitized.nested.array[1], 'safe', 'Safe value should remain unchanged');
    });
<<<<<<< HEAD
});
=======
});
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
