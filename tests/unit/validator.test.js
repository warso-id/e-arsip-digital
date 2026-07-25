// FILE: tests/unit/validator.test.js
// ============================================
// UNIT TEST - FORM VALIDATOR
// ============================================

runner.describe('Unit Test: Form Validator', () => {
    
    runner.it('required should validate required fields', () => {
        assert.notNull(Validator.required('test'), 'Should pass with value');
        assert.notNull(Validator.required(''), 'Should fail with empty string');
        assert.notNull(Validator.required(null), 'Should fail with null');
        assert.notNull(Validator.required(undefined), 'Should fail with undefined');
        assert.equal(Validator.required('  '), 'Field ini harus diisi', 'Should fail with whitespace');
    });
    
    runner.it('email should validate email format', () => {
        assert.null(Validator.email('test@example.com'), 'Valid email');
        assert.null(Validator.email(''), 'Empty is ok');
        assert.notNull(Validator.email('invalid'), 'Invalid email');
        assert.contains(Validator.email('invalid', 'Email'), 'Email', 'Custom field name');
    });
    
    runner.it('password should validate password strength', () => {
        assert.null(Validator.password('abc123'), 'Valid password');
        assert.notNull(Validator.password('12345'), 'Too short');
        assert.contains(Validator.password('12345'), 'minimal 6', 'Min length message');
    });
    
    runner.it('passwordMatch should compare passwords', () => {
        assert.null(Validator.passwordMatch('abc123', 'abc123'), 'Matching');
        assert.equal(Validator.passwordMatch('abc123', 'abc124'), 'Password tidak cocok', 'Not matching');
    });
    
    runner.it('phone should validate phone numbers', () => {
        assert.null(Validator.phone('08123456789'), 'Valid phone');
        assert.null(Validator.phone('+628123456789'), 'Valid with +');
        assert.null(Validator.phone(''), 'Empty is ok');
        assert.notNull(Validator.phone('123'), 'Too short');
    });
    
    runner.it('nip should validate NIP format', () => {
        assert.null(Validator.nip('123456789012345678'), 'Valid NIP 18 digits');
        assert.notNull(Validator.nip('12345'), 'Too short');
        assert.notNull(Validator.nip('abcdefghijklmnopqr'), 'Not numeric');
    });
    
    runner.it('minLength should validate minimum length', () => {
        assert.null(Validator.minLength('test', 3), 'Sufficient length');
        assert.notNull(Validator.minLength('ab', 3), 'Too short');
        assert.null(Validator.minLength('', 3), 'Empty string passes');
    });
    
    runner.it('maxLength should validate maximum length', () => {
        assert.null(Validator.maxLength('test', 10), 'Within limit');
        assert.notNull(Validator.maxLength('this is too long', 5), 'Exceeds limit');
    });
    
    runner.it('number should validate numeric values', () => {
        assert.null(Validator.number('123'), 'Valid number string');
        assert.null(Validator.number(123), 'Valid number');
        assert.notNull(Validator.number('abc'), 'Not a number');
    });
    
    runner.it('numberRange should validate numeric range', () => {
        assert.null(Validator.numberRange('50', 0, 100), 'Within range');
        assert.notNull(Validator.numberRange('150', 0, 100), 'Above range');
        assert.notNull(Validator.numberRange('-10', 0, 100), 'Below range');
    });
    
    runner.it('validateForm should validate multiple fields', () => {
        const result = Validator.validateForm({
            name: {
                value: '',
                rules: [{ method: 'required', message: 'Nama harus diisi' }]
            },
            email: {
                value: 'invalid-email',
                rules: [{ method: 'email', message: 'Email tidak valid' }]
            }
        });
        
        assert.false(result.isValid, 'Should be invalid');
        assert.notNull(result.errors.name, 'Name should have error');
        assert.notNull(result.errors.email, 'Email should have error');
    });
});