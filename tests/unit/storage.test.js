// FILE: tests/unit/storage.test.js
runner.describe('Unit Test: Secure Storage', () => {
    
    beforeAll(async () => {
        await secureStorage.init();
    });
    
    beforeEach(() => {
        secureStorage.clear();
    });
    
    runner.it('should store and retrieve data securely', async () => {
        const testData = { username: 'admin', role: 'admin', token: 'secret123' };
        
        const stored = await secureStorage.setItem('test', testData);
        assert.true(stored, 'Should store successfully');
        
        const retrieved = await secureStorage.getItem('test');
        assert.notNull(retrieved, 'Should retrieve data');
        assert.equal(retrieved.username, 'admin', 'Username should match');
        assert.equal(retrieved.role, 'admin', 'Role should match');
        assert.equal(retrieved.token, 'secret123', 'Token should match');
    });
    
    runner.it('should return null for non-existent key', async () => {
        const result = await secureStorage.getItem('non_existent_key');
        assert.null(result, 'Should return null');
    });
    
    runner.it('should remove item', async () => {
        await secureStorage.setItem('temp', { data: 'test' });
        secureStorage.removeItem('temp');
        
        const result = await secureStorage.getItem('temp');
        assert.null(result, 'Should be removed');
    });
    
    runner.it('should clear all secure storage', async () => {
        await secureStorage.setItem('key1', { data: 'value1' });
        await secureStorage.setItem('key2', { data: 'value2' });
        
        secureStorage.clear();
        
        const result1 = await secureStorage.getItem('key1');
        const result2 = await secureStorage.getItem('key2');
        
        assert.null(result1, 'Key1 should be cleared');
        assert.null(result2, 'Key2 should be cleared');
    });
    
    runner.it('should store and retrieve session data', async () => {
        const userData = { id: '1', username: 'admin', role: 'admin' };
        
        await secureStorage.storeSession(userData);
        
        const session = await secureStorage.getSession();
        assert.notNull(session, 'Session should exist');
        assert.equal(session.user.username, 'admin', 'Username should match');
        assert.notNull(session.timestamp, 'Timestamp should exist');
        assert.notNull(session.userAgent, 'User agent should exist');
    });
    
    runner.it('should store and retrieve preferences', async () => {
        const preferences = { theme: 'dark', language: 'id', notifications: true };
        
        await secureStorage.storePreferences(preferences);
        
        const retrieved = await secureStorage.getPreferences();
        assert.equal(retrieved.theme, 'dark', 'Theme should match');
        assert.equal(retrieved.language, 'id', 'Language should match');
        assert.true(retrieved.notifications, 'Notifications should match');
    });
    
    runner.it('should return empty object for no preferences', async () => {
        secureStorage.clear();
        
        const preferences = await secureStorage.getPreferences();
        assert.notNull(preferences, 'Should return object');
        assert.equal(Object.keys(preferences).length, 0, 'Should be empty');
    });
    
    runner.it('should encrypt data differently each time', async () => {
        const testData = { message: 'test' };
        
        await secureStorage.setItem('enc1', testData);
        
        // Get raw localStorage value
        const raw1 = localStorage.getItem('__e_arsip_secure_enc1');
        
        await secureStorage.setItem('enc2', testData);
        const raw2 = localStorage.getItem('__e_arsip_secure_enc2');
        
        assert.notEqual(raw1, raw2, 'Encrypted values should be different');
    });
});

function beforeAll(fn) { fn(); }
function beforeEach(fn) { fn(); }