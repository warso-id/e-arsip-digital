// FILE: tests/integration/approval.test.js
runner.describe('Integration Test: Approval Flow', () => {
    
    const approvalFlow = [
        { role: 'admin', status: 'pending_admin', nextStatus: 'pending_kasubag' },
        { role: 'kasubag', status: 'pending_kasubag', nextStatus: 'pending_wadek' },
        { role: 'wadek', status: 'pending_wadek', nextStatus: 'pending_dekan' },
        { role: 'dekan', status: 'pending_dekan', nextStatus: 'completed' }
    ];
    
    beforeAll(() => {
        window.api = apiMock;
        apiMock.clearMocks();
    });
    
    approvalFlow.forEach((step, index) => {
        runner.it(`Step ${index + 1}: ${step.role} should approve surat`, async () => {
            // Set user role
            const userData = { id: String(index + 1), username: step.role, role: step.role };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            auth.checkAuth();
            
            // Mock response
            apiMock.mockResponse('approveSuratKeluar', {
                success: true,
                message: `Approved by ${step.role}`,
                nextStatus: step.nextStatus
            });
            
            const result = await api.approveSuratKeluar(
                '001/A/SEK/FIKOM/VII/2024',
                step.role,
                'disetujui',
                `Catatan dari ${step.role}`
            );
            
            assert.true(result.success, `${step.role} should approve`);
            assert.equal(result.nextStatus, step.nextStatus, `Next status should be ${step.nextStatus}`);
        });
    });
    
    runner.it('Should reject invalid approval role', async () => {
        apiMock.mockResponse('approveSuratKeluar', {
            success: false,
            message: 'Invalid role for approval'
        });
        
        const result = await api.approveSuratKeluar(
            '001/A/SEK/FIKOM/VII/2024',
            'invalid_role',
            'disetujui',
            ''
        );
        
        assert.false(result.success, 'Should reject invalid role');
    });
    
    runner.it('Should reject approval when status is not pending', async () => {
        apiMock.mockResponse('approveSuratKeluar', {
            success: false,
            message: 'Surat tidak dalam status pending untuk role ini'
        });
        
        const result = await api.approveSuratKeluar(
            '001/A/SEK/FIKOM/VII/2024',
            'dekan',
            'disetujui',
            ''
        );
        
        assert.false(result.success, 'Should reject when not pending');
    });
    
    runner.it('Should handle rejected approval', async () => {
        const userData = { id: '1', username: 'admin', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        auth.checkAuth();
        
        apiMock.mockResponse('approveSuratKeluar', {
            success: true,
            message: 'Surat ditolak',
            nextStatus: 'rejected'
        });
        
        const result = await api.approveSuratKeluar(
            '001/A/SEK/FIKOM/VII/2024',
            'admin',
            'ditolak',
            'Perlu revisi format'
        );
        
        assert.true(result.success, 'Should process rejection');
        assert.equal(result.nextStatus, 'rejected', 'Status should be rejected');
    });
    
    runner.it('Should handle revisi approval', async () => {
        apiMock.mockResponse('approveSuratKeluar', {
            success: true,
            message: 'Surat perlu revisi',
            nextStatus: 'draft'
        });
        
        const result = await api.approveSuratKeluar(
            '001/A/SEK/FIKOM/VII/2024',
            'admin',
            'revisi',
            'Mohon perbaiki format penomoran'
        );
        
        assert.true(result.success, 'Should process revision');
        assert.equal(result.nextStatus, 'draft', 'Status should return to draft');
    });
    
    runner.it('Complete flow should track all approval stages', () => {
        const calls = apiMock.getCalls();
        const approvalCalls = calls.filter(c => c.data.action === 'approveSuratKeluar');
        
        assert.equal(approvalCalls.length, 8, 'Should have 8 approval calls in total');
        
        const roles = [...new Set(approvalCalls.map(c => c.data.role))];
        assert.true(roles.includes('admin'), 'Admin should be in roles');
        assert.true(roles.includes('kasubag'), 'Kasubag should be in roles');
        assert.true(roles.includes('wadek'), 'Wadek should be in roles');
        assert.true(roles.includes('dekan'), 'Dekan should be in roles');
        assert.true(roles.includes('invalid_role'), 'Invalid role should be recorded');
        
        const statuses = [...new Set(approvalCalls.map(c => c.data.status))];
        assert.true(statuses.includes('disetujui'), 'Approved status should exist');
        assert.true(statuses.includes('ditolak'), 'Rejected status should exist');
        assert.true(statuses.includes('revisi'), 'Revision status should exist');
    });
});

function beforeAll(fn) { fn(); }
