// FILE: tests/integration/surat-masuk.test.js
// ============================================
// INTEGRATION TEST - SURAT MASUK FLOW
// ============================================

runner.describe('Integration Test: Surat Masuk Flow', () => {
    
    let testAgendaId = null;
    let testNomorAgenda = null;
    
    beforeAll(() => {
        window.api = apiMock;
        apiMock.clearMocks();
        
        const userData = { id: '1', username: 'admin', name: 'Admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
    });
    
    runner.it('Step 1: Record surat masuk', async () => {
        const suratData = {
            kategori: 'M.UM',
            pengirim: 'Dinas Pendidikan',
            perihal: 'Pemberitahuan Akreditasi',
            tanggalTerima: '2024-07-15',
            tanggalSurat: '2024-07-10',
            nomorSuratAsal: '123/DP/2024',
            tujuanUtama: 'dekan',
            createdBy: '1'
        };
        
        apiMock.mockResponse('saveSuratMasuk', {
            success: true,
            id: 'SM001',
            message: 'Surat masuk dicatat'
        });
        
        const result = await api.saveSuratMasuk(suratData);
        
        assert.true(result.success, 'Surat masuk should be recorded');
        assert.equal(result.id, 'SM001', 'Should return ID');
        
        testAgendaId = result.id;
    });
    
    runner.it('Step 2: Generate nomor agenda', async () => {
        apiMock.mockResponse('generateNomorAgenda', {
            success: true,
            nomorAgenda: 'M.UM-005'
        });
        
        const result = await api.generateNomorAgenda('M.UM');
        
        assert.true(result.success, 'Nomor agenda should be generated');
        assert.contains(result.nomorAgenda, 'M.UM-', 'Should contain prefix M.UM-');
        
        const number = parseInt(result.nomorAgenda.split('-')[1]);
        assert.greaterThan(number, 0, 'Number should be positive');
        
        testNomorAgenda = result.nomorAgenda;
    });
    
    runner.it('Step 3: Create disposisi for surat masuk', async () => {
        const disposisiData = {
            nomorAgenda: testNomorAgenda,
            diterimaTanggal: '15 Juli 2024',
            diterimaJam: '10:30',
            disampaikanKepada: 'dekan',
            diteruskanKepada: 'wadek',
            instruksi: 'Mohon ditindaklanjuti untuk persiapan akreditasi',
            catatan: 'Batas waktu 2 minggu',
            sifat: 'penting',
            createdBy: '1'
        };
        
        apiMock.mockResponse('saveDisposisi', {
            success: true,
            id: 'DSP001',
            message: 'Disposisi saved'
        });
        
        const result = await api.saveDisposisi(disposisiData);
        
        assert.true(result.success, 'Disposisi should be saved');
        assert.equal(result.id, 'DSP001', 'Should return disposisi ID');
    });
    
    runner.it('Step 4: Teruskan surat ke unit terkait', async () => {
        apiMock.mockResponse('teruskanSurat', {
            success: true,
            message: 'Surat diteruskan ke wadek'
        });
        
        const result = await api.teruskanSurat(
            testNomorAgenda,
            'wadek',
            'Harap segera ditindaklanjuti'
        );
        
        assert.true(result.success, 'Surat should be forwarded');
    });
    
    runner.it('Step 5: Surat should be trackable', async () => {
        const trackingData = {
            id: testAgendaId,
            nomorAgenda: testNomorAgenda,
            status: 'diagendakan',
            disposisi: {
                disampaikanKepada: 'dekan',
                diteruskanKepada: 'wadek',
                instruksi: 'Mohon ditindaklanjuti'
            },
            timeline: [
                { status: 'diterima', date: '2024-07-15T10:00:00Z' },
                { status: 'diagendakan', date: '2024-07-15T10:30:00Z' },
                { status: 'disposisi', date: '2024-07-15T11:00:00Z' },
                { status: 'diteruskan', date: '2024-07-15T11:15:00Z' }
            ]
        };
        
        apiMock.mockResponse('getSuratMasuk', {
            success: true,
            data: trackingData
        });
        
        const result = await api.sendRequest({
            action: 'getSuratMasuk',
            id: testAgendaId
        });
        
        assert.true(result.success, 'Should get tracking data');
        assert.notNull(result.data, 'Data should not be null');
        assert.equal(result.data.nomorAgenda, testNomorAgenda, 'Nomor agenda should match');
        assert.notNull(result.data.timeline, 'Should have timeline');
        assert.equal(result.data.timeline.length, 4, 'Should have 4 timeline entries');
    });
    
    runner.it('Complete flow should record all stages', () => {
        const calls = apiMock.getCalls();
        
        const saveCall = calls.find(c => c.data.action === 'saveSuratMasuk');
        assert.notNull(saveCall, 'Should have save call');
        
        const agendaCall = calls.find(c => c.data.action === 'generateNomorAgenda');
        assert.notNull(agendaCall, 'Should have agenda call');
        
        const disposisiCall = calls.find(c => c.data.action === 'saveDisposisi');
        assert.notNull(disposisiCall, 'Should have disposisi call');
        
        const teruskanCall = calls.find(c => c.data.action === 'teruskanSurat');
        assert.notNull(teruskanCall, 'Should have teruskan call');
    });
});
