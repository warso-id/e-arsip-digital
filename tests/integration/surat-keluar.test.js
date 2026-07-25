// FILE: tests/integration/surat-keluar.test.js
// ============================================
// INTEGRATION TEST - SURAT KELUAR FLOW
// ============================================

runner.describe('Integration Test: Surat Keluar Flow', () => {
    
    let testSuratId = null;
    let testNomorSurat = null;
    
    // Setup: Mock API
    beforeAll(() => {
        window.api = apiMock;
        apiMock.clearMocks();
        
        // Mock user
        const userData = { id: '3', username: 'user1', name: 'Test User', role: 'user' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
    });
    
    runner.it('Step 1: User should be able to create draft surat', async () => {
        const draftData = {
            kategori: 'K.UM',
            perihal: 'Undangan Rapat',
            tujuan: 'Seluruh Dosen',
            isiSurat: 'Mengundang seluruh dosen untuk rapat koordinasi',
            tanggalSurat: '2024-07-20',
            createdBy: '3'
        };
        
        apiMock.mockResponse('saveDraftSuratKeluar', {
            success: true,
            id: 'DRAFT001',
            message: 'Draft saved'
        });
        
        const result = await api.saveDraftSuratKeluar(draftData);
        
        assert.true(result.success, 'Draft should be saved');
        assert.equal(result.id, 'DRAFT001', 'Should return draft ID');
        
        testSuratId = result.id;
    });
    
    runner.it('Step 2: Generate nomor surat automatically', async () => {
        apiMock.mockResponse('generateNomorSurat', {
            success: true,
            nomorSurat: '005/A/SEK/FIKOM/VII/2024',
            noUrut: 5
        });
        
        const result = await api.generateNomorSurat('K.UM');
        
        assert.true(result.success, 'Nomor should be generated');
        assert.equal(result.noUrut, 5, 'No urut should be 5');
        assert.contains(result.nomorSurat, 'FIKOM', 'Should contain instansi name');
        assert.contains(result.nomorSurat, 'VII', 'Should contain roman month');
        assert.contains(result.nomorSurat, '2024', 'Should contain year');
        
        testNomorSurat = result.nomorSurat;
    });
    
    runner.it('Step 3: Submit surat for approval', async () => {
        const submitData = {
            id: testSuratId,
            nomorSurat: testNomorSurat,
            kategori: 'K.UM',
            perihal: 'Undangan Rapat',
            tujuan: 'Seluruh Dosen',
            isiSurat: 'Mengundang seluruh dosen untuk rapat koordinasi',
            tanggalSurat: '2024-07-20',
            status: 'pending_admin',
            createdBy: '3'
        };
        
        apiMock.mockResponse('submitSuratKeluar', {
            success: true,
            message: 'Surat submitted',
            status: 'pending_admin'
        });
        
        const result = await api.submitSuratKeluar(submitData);
        
        assert.true(result.success, 'Surat should be submitted');
        assert.equal(result.status, 'pending_admin', 'Status should be pending_admin');
    });
    
    runner.it('Step 4: Admin should approve surat', async () => {
        // Switch to admin user
        const adminData = { id: '1', username: 'admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(adminData));
        auth.checkAuth();
        
        apiMock.mockResponse('approveSuratKeluar', {
            success: true,
            message: 'Approved by admin',
            nextStatus: 'pending_kasubag'
        });
        
        const result = await api.approveSuratKeluar(
            testNomorSurat,
            'admin',
            'disetujui',
            'Surat sudah sesuai'
        );
        
        assert.true(result.success, 'Admin should approve');
        assert.equal(result.nextStatus, 'pending_kasubag', 'Next status should be pending_kasubag');
    });
    
    runner.it('Step 5: Kasubag should review surat', async () => {
        const kasubagData = { id: '4', username: 'kasubag', role: 'kasubag' };
        localStorage.setItem('currentUser', JSON.stringify(kasubagData));
        auth.checkAuth();
        
        apiMock.mockResponse('approveSuratKeluar', {
            success: true,
            message: 'Reviewed by kasubag',
            nextStatus: 'pending_wadek'
        });
        
        const result = await api.approveSuratKeluar(
            testNomorSurat,
            'kasubag',
            'disetujui',
            'Konten sudah OK'
        );
        
        assert.true(result.success, 'Kasubag should review');
        assert.equal(result.nextStatus, 'pending_wadek', 'Next status should be pending_wadek');
    });
    
    runner.it('Step 6: Wakil Dekan should paraf surat', async () => {
        const wadekData = { id: '5', username: 'wadek', role: 'wadek' };
        localStorage.setItem('currentUser', JSON.stringify(wadekData));
        auth.checkAuth();
        
        apiMock.mockResponse('approveSuratKeluar', {
            success: true,
            message: 'Paraf by wadek',
            nextStatus: 'pending_dekan'
        });
        
        const result = await api.approveSuratKeluar(
            testNomorSurat,
            'wadek',
            'disetujui',
            'Setuju untuk ditandatangani'
        );
        
        assert.true(result.success, 'Wadek should paraf');
        assert.equal(result.nextStatus, 'pending_dekan', 'Next status should be pending_dekan');
    });
    
    runner.it('Step 7: Dekan should sign surat (final approval)', async () => {
        const dekanData = { id: '6', username: 'dekan', role: 'dekan' };
        localStorage.setItem('currentUser', JSON.stringify(dekanData));
        auth.checkAuth();
        
        apiMock.mockResponse('approveSuratKeluar', {
            success: true,
            message: 'Signed by dekan',
            nextStatus: 'completed'
        });
        
        apiMock.mockResponse('generateSuratFinal', {
            success: true,
            fileUrl: 'https://drive.google.com/file/12345',
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?data=005/A/SEK/FIKOM/VII/2024'
        });
        
        const approveResult = await api.approveSuratKeluar(
            testNomorSurat,
            'dekan',
            'disetujui',
            'Disetujui dan ditandatangani'
        );
        
        assert.true(approveResult.success, 'Dekan should approve');
        assert.equal(approveResult.nextStatus, 'completed', 'Status should be completed');
        
        // Generate final surat
        const genResult = await api.generateSuratFinal(testNomorSurat);
        assert.true(genResult.success, 'Should generate final surat');
        assert.notNull(genResult.fileUrl, 'Should have file URL');
        assert.notNull(genResult.qrCode, 'Should have QR code');
    });
    
    runner.it('Complete flow should pass all approval stages', () => {
        // Verify all stages passed
        const calls = apiMock.getCalls();
        const approvalCalls = calls.filter(c => c.data.action === 'approveSuratKeluar');
        
        assert.equal(approvalCalls.length, 4, 'Should have 4 approval calls');
        
        const roles = approvalCalls.map(c => c.data.role);
        assert.true(roles.includes('admin'), 'Admin should approve');
        assert.true(roles.includes('kasubag'), 'Kasubag should approve');
        assert.true(roles.includes('wadek'), 'Wadek should approve');
        assert.true(roles.includes('dekan'), 'Dekan should approve');
    });
});
