// tests/integration/surat-keluar.test.js - Enterprise Surat Keluar Flow Tests 2026
/**
 * E-Arsip Digital - Integration Tests: Surat Keluar Workflow
 * Version: 2026.1.0
 * Tests: Full lifecycle (draft → submit → multi-approval → final),
 *        validation, error handling, security, edge cases
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';
import TestData from '../fixtures/test-data.js';

// Mock modules
jest.mock('../../js/api.js', () => ({
    saveDraftSuratKeluar: jest.fn(),
    updateDraftSuratKeluar: jest.fn(),
    submitSuratKeluar: jest.fn(),
    approveSuratKeluar: jest.fn(),
    rejectSuratKeluar: jest.fn(),
    generateNomorSurat: jest.fn(),
    generateSuratFinal: jest.fn(),
    getSuratKeluar: jest.fn(),
    getSuratKeluarList: jest.fn(),
    deleteSuratKeluar: jest.fn()
}));

jest.mock('../../js/auth.js', () => ({
    checkAuth: jest.fn(),
    isAuthenticated: true,
    currentUser: null,
    hasRole: jest.fn()
}));

import apiService from '../../js/api.js';
import authService from '../../js/auth.js';

describe('Integration Test: Surat Keluar Flow', () => {
    let testSuratId = null;
    let testNomorSurat = null;
    let testDraftData = null;

    const mockUsers = {
        user: { id: '3', username: 'user1', name: 'Test User', role: 'user', fullname: 'Test User' },
        admin: { id: '1', username: 'admin', name: 'Admin', role: 'admin', fullname: 'Administrator' },
        kasubag: { id: '4', username: 'kasubag', name: 'Kasubag', role: 'kasubag', fullname: 'Kepala Sub Bagian' },
        wadek: { id: '5', username: 'wadek', name: 'Wadek', role: 'wadek', fullname: 'Wakil Dekan' },
        dekan: { id: '6', username: 'dekan', name: 'Dekan', role: 'dekan', fullname: 'Dekan' }
    };

    beforeAll(() => {
        // Setup global mocks
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        
        global.window = {
            dispatchEvent: jest.fn(),
            location: { href: '', reload: jest.fn() }
        };
    });

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Set default user
        authService.currentUser = mockUsers.user;
        authService.isAuthenticated = true;
        authService.hasRole.mockReturnValue(true);
        
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'currentUser') return JSON.stringify(mockUsers.user);
            if (key === 'auth_token') return 'valid-token';
            if (key === 'csrf_token') return 'valid-csrf-token';
            return null;
        });
        
        // Reset test state
        testSuratId = null;
        testNomorSurat = null;
        testDraftData = TestData.surat.keluar.valid;
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ============================================
    // STEP 1: CREATE DRAFT
    // ============================================

    describe('Step 1: Create Draft Surat', () => {
        it('Should create draft surat successfully', async () => {
            const draftData = {
                ...TestData.surat.keluar.valid,
                createdBy: mockUsers.user.id
            };

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: true,
                id: 'DRAFT001',
                message: 'Draft berhasil disimpan',
                data: { ...draftData, id: 'DRAFT001', status: 'draft' }
            });

            const result = await apiService.saveDraftSuratKeluar(draftData);

            expect(result.success).toBe(true);
            expect(result.id).toBe('DRAFT001');
            expect(result.message).toContain('berhasil disimpan');
            
            testSuratId = result.id;
        });

        it('Should create draft with minimal required fields', async () => {
            const minimalData = TestData.surat.keluar.minimal;

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: true,
                id: 'DRAFT002',
                data: { ...minimalData, id: 'DRAFT002', status: 'draft' }
            });

            const result = await apiService.saveDraftSuratKeluar(minimalData);

            expect(result.success).toBe(true);
        });

        it('Should reject draft without perihal', async () => {
            const invalidData = TestData.surat.keluar.invalid.emptyPerihal;

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Perihal wajib diisi',
                status: 422
            });

            const result = await apiService.saveDraftSuratKeluar(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Perihal wajib diisi');
        });

        it('Should reject draft without jenis surat', async () => {
            const invalidData = TestData.surat.keluar.invalid.emptyJenis;

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Jenis surat wajib dipilih',
                status: 422
            });

            const result = await apiService.saveDraftSuratKeluar(invalidData);

            expect(result.success).toBe(false);
        });

        it('Should reject draft without tujuan', async () => {
            const invalidData = TestData.surat.keluar.invalid.emptyTujuan;

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Tujuan surat wajib diisi',
                status: 422
            });

            const result = await apiService.saveDraftSuratKeluar(invalidData);

            expect(result.success).toBe(false);
        });

        it('Should reject draft with perihal too long', async () => {
            const invalidData = TestData.surat.keluar.invalid.tooLong;

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Perihal maksimal 500 karakter',
                status: 422
            });

            const result = await apiService.saveDraftSuratKeluar(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('500 karakter');
        });

        it('Should sanitize XSS in draft data', async () => {
            const xssData = {
                ...TestData.surat.keluar.valid,
                perihal: '<script>alert("XSS")</script>Undangan'
            };

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: true,
                id: 'DRAFT003',
                data: {
                    ...xssData,
                    perihal: '&lt;script&gt;alert("XSS")&lt;/script&gt;Undangan'
                }
            });

            const result = await apiService.saveDraftSuratKeluar(xssData);

            expect(result.success).toBe(true);
            expect(result.data.perihal).not.toContain('<script>');
        });
    });

    // ============================================
    // STEP 2: UPDATE DRAFT
    // ============================================

    describe('Step 2: Update Draft', () => {
        beforeEach(() => {
            testSuratId = 'DRAFT001';
        });

        it('Should update existing draft', async () => {
            const updateData = TestData.surat.keluar.updateData;

            apiService.updateDraftSuratKeluar.mockResolvedValue({
                success: true,
                message: 'Draft berhasil diperbarui',
                data: { id: testSuratId, ...updateData, status: 'draft' }
            });

            const result = await apiService.updateDraftSuratKeluar(testSuratId, updateData);

            expect(result.success).toBe(true);
            expect(result.message).toContain('diperbarui');
        });

        it('Should reject update on non-existent draft', async () => {
            apiService.updateDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Not Found',
                message: 'Draft tidak ditemukan',
                status: 404
            });

            const result = await apiService.updateDraftSuratKeluar('NON-EXISTENT', { perihal: 'Test' });

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });

        it('Should reject update on submitted surat', async () => {
            apiService.updateDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Invalid Status',
                message: 'Surat yang sudah disubmit tidak dapat diubah',
                status: 422
            });

            const result = await apiService.updateDraftSuratKeluar('SUBMITTED001', { perihal: 'Test' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('tidak dapat diubah');
        });
    });

    // ============================================
    // STEP 3: GENERATE NOMOR SURAT
    // ============================================

    describe('Step 3: Generate Nomor Surat', () => {
        it('Should generate nomor surat automatically', async () => {
            apiService.generateNomorSurat.mockResolvedValue({
                success: true,
                nomorSurat: '005/UN.01/UM/VII/2026',
                noUrut: 5,
                kodeUnit: 'UN.01',
                klasifikasi: 'UM',
                bulanRomawi: 'VII',
                tahun: '2026'
            });

            const result = await apiService.generateNomorSurat('UM');

            expect(result.success).toBe(true);
            expect(result.noUrut).toBe(5);
            expect(result.nomorSurat).toContain('UN.01');
            expect(result.nomorSurat).toContain('VII');
            expect(result.nomorSurat).toContain('2026');
            expect(result.nomorSurat).toMatch(/^\d{3}\/UN\.01\/UM\/VII\/2026$/);
            
            testNomorSurat = result.nomorSurat;
        });

        it('Should generate unique sequential numbers', async () => {
            apiService.generateNomorSurat
                .mockResolvedValueOnce({ success: true, nomorSurat: '006/UN.01/UM/VII/2026', noUrut: 6 })
                .mockResolvedValueOnce({ success: true, nomorSurat: '007/UN.01/UM/VII/2026', noUrut: 7 });

            const result1 = await apiService.generateNomorSurat('UM');
            const result2 = await apiService.generateNomorSurat('UM');

            expect(result1.noUrut).toBe(6);
            expect(result2.noUrut).toBe(7);
            expect(result2.noUrut).toBeGreaterThan(result1.noUrut);
        });

        it('Should generate different format for different klasifikasi', async () => {
            apiService.generateNomorSurat.mockResolvedValue({
                success: true,
                nomorSurat: '001/UN.01/SP/VII/2026',
                noUrut: 1,
                klasifikasi: 'SP'
            });

            const result = await apiService.generateNomorSurat('SP');

            expect(result.nomorSurat).toContain('/SP/');
        });
    });

    // ============================================
    // STEP 4: SUBMIT FOR APPROVAL
    // ============================================

    describe('Step 4: Submit for Approval', () => {
        beforeEach(() => {
            testSuratId = 'DRAFT001';
            testNomorSurat = '005/UN.01/UM/VII/2026';
        });

        it('Should submit surat for approval', async () => {
            const submitData = {
                id: testSuratId,
                nomorSurat: testNomorSurat,
                ...TestData.surat.keluar.valid,
                status: 'pending_admin',
                createdBy: mockUsers.user.id
            };

            apiService.submitSuratKeluar.mockResolvedValue({
                success: true,
                message: 'Surat berhasil disubmit untuk approval',
                data: { ...submitData, status: 'pending_admin', submittedAt: new Date().toISOString() }
            });

            const result = await apiService.submitSuratKeluar(submitData);

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('pending_admin');
            expect(result.message).toContain('disubmit');
        });

        it('Should reject submit without nomor surat', async () => {
            const submitData = {
                id: testSuratId,
                perihal: 'Test',
                tujuan: 'Test'
            };

            apiService.submitSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Nomor surat harus digenerate terlebih dahulu',
                status: 422
            });

            const result = await apiService.submitSuratKeluar(submitData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Nomor surat');
        });

        it('Should reject duplicate submission', async () => {
            const submitData = {
                id: testSuratId,
                nomorSurat: testNomorSurat,
                ...TestData.surat.keluar.valid
            };

            apiService.submitSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Conflict',
                message: 'Surat dengan nomor ini sudah disubmit',
                status: 409
            });

            const result = await apiService.submitSuratKeluar(submitData);

            expect(result.success).toBe(false);
            expect(result.status).toBe(409);
        });
    });

    // ============================================
    // STEP 5-8: MULTI-LEVEL APPROVAL
    // ============================================

    describe('Multi-Level Approval Flow', () => {
        const approvalSteps = [
            { step: 1, user: mockUsers.admin, role: 'admin', nextStatus: 'pending_kasubag', catatan: 'Surat sudah sesuai' },
            { step: 2, user: mockUsers.kasubag, role: 'kasubag', nextStatus: 'pending_wadek', catatan: 'Konten sudah OK' },
            { step: 3, user: mockUsers.wadek, role: 'wadek', nextStatus: 'pending_dekan', catatan: 'Setuju untuk ditandatangani' },
            { step: 4, user: mockUsers.dekan, role: 'dekan', nextStatus: 'completed', catatan: 'Disetujui dan ditandatangani' }
        ];

        beforeEach(() => {
            testNomorSurat = '005/UN.01/UM/VII/2026';
        });

        approvalSteps.forEach(({ step, user, role, nextStatus, catatan }) => {
            it(`Step ${step + 4}: ${role} should approve surat`, async () => {
                // Set user
                authService.currentUser = user;
                localStorage.getItem.mockReturnValue(JSON.stringify(user));

                apiService.approveSuratKeluar.mockResolvedValue({
                    success: true,
                    message: `Surat disetujui oleh ${role}`,
                    data: {
                        nomorSurat: testNomorSurat,
                        status: nextStatus,
                        approvedBy: user,
                        approvedAt: new Date().toISOString(),
                        catatan
                    }
                });

                const result = await apiService.approveSuratKeluar(
                    testNomorSurat,
                    role,
                    'disetujui',
                    catatan
                );

                expect(result.success).toBe(true);
                expect(result.data.status).toBe(nextStatus);
                expect(result.data.approvedBy.role).toBe(role);
            });

            it(`Step ${step + 4}: ${role} should be able to reject surat`, async () => {
                authService.currentUser = user;

                apiService.approveSuratKeluar.mockResolvedValue({
                    success: true,
                    message: `Surat ditolak oleh ${role}`,
                    data: {
                        nomorSurat: testNomorSurat,
                        status: 'rejected',
                        rejectedBy: user,
                        catatan: 'Perlu revisi'
                    }
                });

                const result = await apiService.approveSuratKeluar(
                    testNomorSurat,
                    role,
                    'ditolak',
                    'Perlu revisi'
                );

                expect(result.success).toBe(true);
                expect(result.data.status).toBe('rejected');
            });
        });
    });

    // ============================================
    // STEP 9: GENERATE FINAL SURAT
    // ============================================

    describe('Step 9: Generate Final Surat', () => {
        beforeEach(() => {
            testNomorSurat = '005/UN.01/UM/VII/2026';
        });

        it('Should generate final surat with QR code', async () => {
            apiService.generateSuratFinal.mockResolvedValue({
                success: true,
                message: 'Surat final berhasil digenerate',
                data: {
                    nomorSurat: testNomorSurat,
                    fileUrl: 'https://drive.google.com/file/12345',
                    qrCode: 'https://api.qrserver.com/v1/create-qr-code/?data=005/UN.01/UM/VII/2026',
                    downloadUrl: '/api/surat/download/005',
                    generatedAt: new Date().toISOString()
                }
            });

            const result = await apiService.generateSuratFinal(testNomorSurat);

            expect(result.success).toBe(true);
            expect(result.data.fileUrl).toBeTruthy();
            expect(result.data.qrCode).toBeTruthy();
            expect(result.data.downloadUrl).toBeTruthy();
        });

        it('Should reject generation if surat not completed', async () => {
            apiService.generateSuratFinal.mockResolvedValue({
                success: false,
                error: 'Invalid Status',
                message: 'Surat harus dalam status completed untuk digenerate',
                status: 422
            });

            const result = await apiService.generateSuratFinal(testNomorSurat);

            expect(result.success).toBe(false);
            expect(result.message).toContain('completed');
        });

        it('Should reject generation for non-existent surat', async () => {
            apiService.generateSuratFinal.mockResolvedValue({
                success: false,
                error: 'Not Found',
                message: 'Surat tidak ditemukan',
                status: 404
            });

            const result = await apiService.generateSuratFinal('NON-EXISTENT');

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });
    });

    // ============================================
    // ERROR HANDLING TESTS
    // ============================================

    describe('Error Handling', () => {
        it('Should handle network error during save', async () => {
            apiService.saveDraftSuratKeluar.mockRejectedValue(
                new Error('Network Error: Failed to fetch')
            );

            await expect(
                apiService.saveDraftSuratKeluar(TestData.surat.keluar.valid)
            ).rejects.toThrow('Network Error');
        });

        it('Should handle server error during submit', async () => {
            apiService.submitSuratKeluar.mockRejectedValue(
                new Error('Internal Server Error')
            );

            await expect(
                apiService.submitSuratKeluar({ id: 'TEST', nomorSurat: 'TEST/001' })
            ).rejects.toThrow('Internal Server Error');
        });

        it('Should handle rate limiting', async () => {
            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Too Many Requests',
                message: 'Terlalu banyak permintaan. Coba lagi dalam 60 detik.',
                retryAfter: 60,
                status: 429
            });

            const result = await apiService.saveDraftSuratKeluar(TestData.surat.keluar.valid);

            expect(result.success).toBe(false);
            expect(result.status).toBe(429);
            expect(result.retryAfter).toBe(60);
        });
    });

    // ============================================
    // SECURITY TESTS
    // ============================================

    describe('Security', () => {
        it('Should reject unauthorized user from creating surat', async () => {
            authService.isAuthenticated = false;
            localStorage.getItem.mockReturnValue(null);

            apiService.saveDraftSuratKeluar.mockRejectedValue(
                new Error('Authentication required')
            );

            await expect(
                apiService.saveDraftSuratKeluar(TestData.surat.keluar.valid)
            ).rejects.toThrow('Authentication required');
        });

        it('Should validate CSRF token on submit', async () => {
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'csrf_token') return 'invalid-token';
                return JSON.stringify(mockUsers.user);
            });

            apiService.submitSuratKeluar.mockRejectedValue(
                new Error('Invalid CSRF token')
            );

            await expect(
                apiService.submitSuratKeluar({ id: 'TEST', nomorSurat: 'TEST/001' })
            ).rejects.toThrow('CSRF token');
        });

        it('Should sanitize XSS in surat content', async () => {
            const xssContent = {
                ...TestData.surat.keluar.valid,
                isi_ringkas: '<img src=x onerror=alert(1)>'
            };

            apiService.saveDraftSuratKeluar.mockResolvedValue({
                success: true,
                id: 'DRAFT004',
                data: {
                    ...xssContent,
                    isi_ringkas: '&lt;img src=x onerror=alert(1)&gt;'
                }
            });

            const result = await apiService.saveDraftSuratKeluar(xssContent);

            expect(result.success).toBe(true);
            expect(result.data.isi_ringkas).not.toContain('<img');
        });
    });

    // ============================================
    // GET & LIST TESTS
    // ============================================

    describe('Get & List Surat Keluar', () => {
        it('Should get surat keluar by ID', async () => {
            const suratData = {
                ...TestData.surat.keluar.valid,
                id: 'SRT-001',
                nomorSurat: '005/UN.01/UM/VII/2026',
                status: 'completed'
            };

            apiService.getSuratKeluar.mockResolvedValue({
                success: true,
                data: suratData
            });

            const result = await apiService.getSuratKeluar('SRT-001');

            expect(result.success).toBe(true);
            expect(result.data.id).toBe('SRT-001');
            expect(result.data.status).toBe('completed');
        });

        it('Should list surat keluar with pagination', async () => {
            const suratList = TestData.surat.keluar.list.slice(0, 10);

            apiService.getSuratKeluarList.mockResolvedValue({
                success: true,
                data: suratList,
                pagination: { page: 1, limit: 10, total: 25, totalPages: 3 }
            });

            const result = await apiService.getSuratKeluarList({ page: 1, limit: 10 });

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(10);
            expect(result.pagination.total).toBe(25);
        });

        it('Should filter surat keluar by status', async () => {
            apiService.getSuratKeluarList.mockResolvedValue({
                success: true,
                data: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
            });

            const result = await apiService.getSuratKeluarList({ status: 'draft' });

            expect(result.success).toBe(true);
        });
    });

    // ============================================
    // DELETE TESTS
    // ============================================

    describe('Delete Surat Keluar', () => {
        it('Should delete draft surat', async () => {
            apiService.deleteSuratKeluar.mockResolvedValue({
                success: true,
                message: 'Draft surat berhasil dihapus'
            });

            const result = await apiService.deleteSuratKeluar('DRAFT001');

            expect(result.success).toBe(true);
        });

        it('Should reject delete on submitted surat', async () => {
            apiService.deleteSuratKeluar.mockResolvedValue({
                success: false,
                error: 'Invalid Status',
                message: 'Surat yang sudah disubmit tidak dapat dihapus',
                status: 422
            });

            const result = await apiService.deleteSuratKeluar('SUBMITTED001');

            expect(result.success).toBe(false);
            expect(result.message).toContain('tidak dapat dihapus');
        });
    });

    // ============================================
    // COMPLETE FLOW VERIFICATION
    // ============================================

    describe('Complete Flow Verification', () => {
        it('Should track all approval stages in correct order', async () => {
            const expectedRoles = ['admin', 'kasubag', 'wadek', 'dekan'];
            const expectedStatuses = ['pending_kasubag', 'pending_wadek', 'pending_dekan', 'completed'];

            // Simulate complete flow
            for (let i = 0; i < expectedRoles.length; i++) {
                const user = mockUsers[expectedRoles[i]];
                authService.currentUser = user;

                apiService.approveSuratKeluar.mockResolvedValueOnce({
                    success: true,
                    data: { status: expectedStatuses[i], approvedBy: user }
                });

                await apiService.approveSuratKeluar(
                    testNomorSurat || '005/UN.01/UM/VII/2026',
                    expectedRoles[i],
                    'disetujui',
                    `Approved by ${expectedRoles[i]}`
                );
            }

            // Verify all calls
            const calls = apiService.approveSuratKeluar.mock.calls;
            expect(calls).toHaveLength(4);

            calls.forEach((call, index) => {
                const [, role, action] = call;
                expect(role).toBe(expectedRoles[index]);
                expect(action).toBe('disetujui');
            });
        });

        it('Should complete full lifecycle: draft → submit → approve → final', async () => {
            const timeline = [];

            // 1. Create draft
            apiService.saveDraftSuratKeluar.mockResolvedValueOnce({
                success: true, id: 'FULL001', data: { status: 'draft' }
            });
            await apiService.saveDraftSuratKeluar(TestData.surat.keluar.valid);
            timeline.push('draft');

            // 2. Generate nomor
            apiService.generateNomorSurat.mockResolvedValueOnce({
                success: true, nomorSurat: '001/UN.01/UM/VII/2026'
            });
            await apiService.generateNomorSurat('UM');
            timeline.push('nomor_generated');

            // 3. Submit
            apiService.submitSuratKeluar.mockResolvedValueOnce({
                success: true, data: { status: 'pending_admin' }
            });
            await apiService.submitSuratKeluar({ id: 'FULL001', nomorSurat: '001/UN.01/UM/VII/2026' });
            timeline.push('submitted');

            // 4. Final
            apiService.generateSuratFinal.mockResolvedValueOnce({
                success: true, data: { fileUrl: 'https://example.com/surat.pdf' }
            });
            await apiService.generateSuratFinal('001/UN.01/UM/VII/2026');
            timeline.push('final');

            expect(timeline).toEqual(['draft', 'nomor_generated', 'submitted', 'final']);
        });
    });
});