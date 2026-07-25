// FILE: tests/unit/sanitizer.test.js
runner.describe('Unit Test: Advanced Sanitizer', () => {
    
    runner.it('sanitizeString should remove script tags', () => {
        const input = '<script>alert("XSS")</script>Hello';
        const result = advancedSanitizer.sanitizeString(input);
        assert.false(result.includes('<script>'), 'Script tags should be removed');
        assert.true(result.includes('Hello'), 'Safe text should remain');
    });
    
    runner.it('sanitizeString should remove event handlers', () => {
        const input = '<img onerror="alert(1)" src=x>';
        const result = advancedSanitizer.sanitizeString(input);
        assert.false(result.includes('onerror'), 'Event handler should be removed');
    });
    
    runner.it('sanitizeString should remove javascript: URLs', () => {
        const input = '<a href="javascript:alert(1)">Click</a>';
        const result = advancedSanitizer.sanitizeString(input);
        assert.false(result.includes('javascript:'), 'javascript: should be removed');
    });
    
    runner.it('sanitizeString should remove null bytes', () => {
        const input = 'test\0data\0';
        const result = advancedSanitizer.sanitizeString(input);
        assert.false(result.includes('\0'), 'Null bytes should be removed');
    });
    
    runner.it('sanitizeString should normalize unicode', () => {
        const input = '\u0065\u0301'; // e + combining accent
        const result = advancedSanitizer.sanitizeString(input);
        assert.equal(result, '\u00e9', 'Should normalize to single character');
    });
    
    runner.it('sanitizeHTML should keep allowed tags', () => {
        const html = '<p>Safe paragraph</p><b>Bold text</b><i>Italic</i>';
        const result = advancedSanitizer.sanitizeHTML(html);
        assert.true(result.includes('<p>'), 'P tag should remain');
        assert.true(result.includes('<b>'), 'B tag should remain');
        assert.true(result.includes('<i>'), 'I tag should remain');
    });
    
    runner.it('sanitizeHTML should remove script tags', () => {
        const html = '<p>Safe</p><script>alert(1)</script>';
        const result = advancedSanitizer.sanitizeHTML(html);
        assert.false(result.includes('<script>'), 'Script tags should be removed');
        assert.true(result.includes('<p>'), 'Safe tags should remain');
    });
    
    runner.it('sanitizeFilename should clean filenames', () => {
        assert.equal(advancedSanitizer.sanitizeFilename('test.txt'), 'test.txt', 'Simple filename');
        assert.equal(advancedSanitizer.sanitizeFilename('/etc/passwd'), 'etc_passwd', 'Remove path');
        assert.equal(advancedSanitizer.sanitizeFilename('../evil.txt'), '.._evil.txt', 'Remove traversal');
        assert.equal(advancedSanitizer.sanitizeFilename('file<script>.txt'), 'file_script_.txt', 'Remove script');
    });
    
    runner.it('sanitizeEmail should clean emails', () => {
        assert.equal(advancedSanitizer.sanitizeEmail('Test@Example.COM'), 'test@example.com', 'Lowercase');
        assert.equal(advancedSanitizer.sanitizeEmail('<script>@test.com'), '', 'Reject XSS');
        assert.equal(advancedSanitizer.sanitizeEmail('invalid'), '', 'Reject invalid');
    });
    
    runner.it('sanitizePhone should clean phone numbers', () => {
        assert.equal(advancedSanitizer.sanitizePhone('0812-3456-7890'), '0812-3456-7890', 'Keep format');
        assert.equal(advancedSanitizer.sanitizePhone('+6281234567890'), '+6281234567890', 'Keep +');
        assert.equal(advancedSanitizer.sanitizePhone('0812<script>'), '0812script', 'Remove XSS');
    });
    
    runner.it('sanitizeObject should sanitize recursively', () => {
        const input = {
            name: '<script>alert(1)</script>John',
            email: 'TEST@EXAMPLE.COM',
            nested: {
                value: 'javascript:void(0)',
                array: ['<img onerror=alert(1)>', 'safe']
            }
        };
        
        const result = advancedSanitizer.sanitizeObject(input);
        assert.false(result.name.includes('<script>'), 'Name should be sanitized');
        assert.equal(result.email, 'test@example.com', 'Email should be lowercased');
        assert.false(result.nested.value.includes('javascript:'), 'Nested value should be sanitized');
        assert.false(result.nested.array[0].includes('onerror'), 'Array value should be sanitized');
    });
    
    runner.it('sanitizeFormData should validate and sanitize', () => {
        const formData = {
            name: '<b>John</b>',
            email: 'TEST@EXAMPLE.COM',
            phone: '0812<script>3456'
        };
        
        const rules = {
            name: { type: 'string', required: true, maxLength: 50 },
            email: { type: 'email', required: true },
            phone: { type: 'phone', required: false }
        };
        
        const result = advancedSanitizer.sanitizeFormData(formData, rules);
        
        assert.true(result.valid, 'Form should be valid');
        assert.false(result.data.name.includes('<b>'), 'Name should be sanitized');
        assert.equal(result.data.email, 'test@example.com', 'Email should be sanitized');
        assert.false(result.data.phone.includes('<script>'), 'Phone should be sanitized');
        assert.null(result.errors, 'No errors should be present');
    });
    
    runner.it('sanitizeFormData should detect missing required fields', () => {
        const formData = { name: '' };
        const rules = {
            name: { type: 'string', required: true, message: 'Nama wajib diisi' }
        };
        
        const result = advancedSanitizer.sanitizeFormData(formData, rules);
        
        assert.false(result.valid, 'Form should be invalid');
        assert.notNull(result.errors, 'Errors should be present');
        assert.equal(result.errors.name, 'Nama wajib diisi', 'Error message should match');
    });
});