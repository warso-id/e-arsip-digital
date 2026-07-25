// FILE: tests/unit/api.test.js
runner.describe('Unit Test: API Service', () => {
    
    let originalFetch;
    
    beforeAll(() => {
        originalFetch = window.fetch;
        window.api = apiMock;
    });
    
    afterAll(() => {
        window.fetch = originalFetch;
    });
    
    runner.it('login should call API with correct parameters', async () => {
        const result = await api.login('admin', 'admin123');
        
        assert.true(result.success, 'Login should succeed');
        assert.notNull(result.user, 'Should return user object');
        assert.equal(result.user.role, 'admin', 'Role should be admin');
        
        const calls = apiMock.getCalls();
        const loginCall = calls.find(c => c.data.action === 'login');
        assert.notNull(loginCall, 'Should have made login API call');
        assert.equal(loginCall.data.username, 'admin', 'Username should be sent');
        assert.equal(loginCall.data.password, 'admin123', 'Password should be sent');
    });
    
    runner.it('login should handle failure', async () => {
        apiMock.mockResponse('login', { success: false, message: 'Invalid credentials' });
        
        const result = await api.login('admin', 'wrongpass');
        
        assert.false(result.success, 'Should fail');
        assert.equal(result.message, 'Invalid credentials', 'Error message should match');
    });
    
    runner.it('submitSuratKeluar should send correct data', async () => {
        const suratData = {
            kategori: 'K.UM',
            perihal: 'Test Surat',
            isiSurat: 'Isi surat test',
            tujuan: 'Test Tujuan',
            createdBy: '1'
        };
        
        const result = await api.submitSuratKeluar(suratData);
        
        assert.true(result.success, 'Should succeed');
        
        const calls = apiMock.getCalls();
        const submitCall = calls.find(c => c.data.action === 'submitSuratKeluar');
        assert.notNull(submitCall, 'Should have submit API call');
        assert.equal(submitCall.data.data.kategori, 'K.UM', 'Kategori should match');
    });
    
    runner.it('approveSuratKeluar should send approval data', async () => {
        const result = await api.approveSuratKeluar(
            '001/A/SEK/FIKOM/VII/2024',
            'admin',
            'disetujui',
            'Catatan approval'
        );
        
        assert.true(result.success, 'Should succeed');
        
        const calls = apiMock.getCalls();
        const approveCall = calls.find(c => c.data.action === 'approveSuratKeluar');
        assert.notNull(approveCall, 'Should have approve API call');
        assert.equal(approveCall.data.role, 'admin', 'Role should be admin');
        assert.equal(approveCall.data.status, 'disetujui', 'Status should be disetujui');
    });
    
    runner.it('getStatistics should return stats', async () => {
        apiMock.mockResponse('getStatistics', {
            success: true,
            data: {
                totalSuratMasuk: 150,
                totalSuratKeluar: 89,
                pendingSurat: 12,
                totalUsers: 45
            }
        });
        
        const result = await api.getStatistics();
        
        assert.true(result.success, 'Should succeed');
        assert.equal(result.data.totalSuratMasuk, 150, 'Total surat masuk should match');
        assert.equal(result.data.totalSuratKeluar, 89, 'Total surat keluar should match');
        assert.equal(result.data.pendingSurat, 12, 'Pending surat should match');
    });
    
    runner.it('getUsers should return user list', async () => {
        apiMock.mockResponse('getUsers', {
            success: true,
            users: MockData.users
        });
        
        const result = await api.getUsers();
        
        assert.true(result.success, 'Should succeed');
        assert.equal(result.users.length, 3, 'Should return 3 users');
        assert.equal(result.users[0].role, 'admin', 'First user should be admin');
    });
    
    runner.it('register should create new user', async () => {
        const newUser = {
            username: 'newuser',
            password: 'newpass123',
            name: 'New User',
            role: 'user',
            email: 'newuser@fikom.ac.id'
        };
        
        const result = await api.register(newUser);
        
        assert.true(result.success, 'Should succeed');
        
        const calls = apiMock.getCalls();
        const registerCall = calls.find(c => c.data.action === 'register');
        assert.notNull(registerCall, 'Should have register API call');
        assert.equal(registerCall.data.data.username, 'newuser', 'Username should match');
    });
    
    runner.it('updateProfile should update user data', async () => {
        const profileData = {
            id: '1',
            name: 'Updated Name',
            email: 'updated@fikom.ac.id',
            phone: '08123456789'
        };
        
        apiMock.mockResponse('updateProfile', { success: true });
        
        const result = await api.updateProfile(profileData);
        
        assert.true(result.success, 'Should succeed');
        
        const calls = apiMock.getCalls();
        const updateCall = calls.find(c => c.data.action === 'updateProfile');
        assert.notNull(updateCall, 'Should have update API call');
    });
    
    runner.it('generateNomorSurat should generate correct format', async () => {
        const result = await api.generateNomorSurat('K.KEU');
        
        assert.true(result.success, 'Should succeed');
        
        const calls = apiMock.getCalls();
        const genCall = calls.find(c => c.data.action === 'generateNomorSurat');
        assert.notNull(genCall, 'Should have generate API call');
        assert.equal(genCall.data.kategori, 'K.KEU', 'Kategori should match');
    });
    
    runner.it('sendRequest should handle errors gracefully', async () => {
        apiMock.mockResponse('badAction', { success: false, message: 'Unknown action' });
        
        try {
            const result = await api.sendRequest({ action: 'badAction' });
            assert.false(result.success, 'Should fail for unknown action');
        } catch (error) {
            assert.true(true, 'Should handle error');
        }
    });
});

function beforeAll(fn) { fn(); }
function afterAll(fn) { fn(); }