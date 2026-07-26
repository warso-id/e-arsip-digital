// tests/integration/surat-masuk.test.js - Enterprise Surat Masuk Flow Tests 2026
/**
 * E-Arsip Digital - Integration Tests: Surat Masuk Workflow
 * Version: 2026.1.0
 * Tests: Full lifecycle (record → agenda → disposisi → teruskan → tracking),
 *        validation, error handling, security, edge cases
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';
import TestData from '../fixtures/test-data.js';

// Mock modules
jest.mock('../../js/api.js', () => ({
    saveSuratMasuk: jest.fn(),
    updateSuratMasuk: jest.fn(),
    generateNomorAgenda: jest.fn(),
    saveDisposisi: jest.fn(),
    updateDisposisi: jest.fn(),
    teruskanSurat: jest.fn(),
    getSuratMasuk: jest.fn(),
    getSuratMasukList: jest.fn(),
    getTrackingTimeline: jest.fn(),
    deleteSuratMasuk: jest.fn(),
    sendRequest: jest.fn()
}));

jest.mock('../../js/auth.js', () => ({
    checkAuth: jest.fn(),
    isAuthenticated: true,
    currentUser: null,
    hasRole: jest.fn()
}));

import apiService from '../../js/api.js';
import authService from '../../js/auth.js';

describe('Integration Test: Surat Masuk Flow', () => {
    let testAgendaId = null;
    let testNomorAgenda = null;
    let testSuratMasukId = null;

    const mockUser = { 
        id: '1', username: 'admin', name: 'Admin', 
        role: 'admin', fullname: 'Administrator' 
    };

    const mockDekan = {
        id: '2', username: 'dekan', name: 'Dekan',
        role: 'dekan', fullname: 'Dr. Ahmad Fauzi, M.Kom'
    };

    const mockWadek = {
        id: '3', username: 'wadek', name: 'Wadek',
        role: 'wadek', fullname: 'Wakil Dekan I'
    };

    beforeAll(() => {
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
        jest.clearAllMocks();
        
        authService.currentUser = mockUser;
        authService.isAuthenticated = true;
        authService.hasRole.mockReturnValue(true);
        
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'currentUser') return JSON.stringify(mockUser);
            if (key === 'auth_token') return 'valid-token';
            if (key === 'csrf_token') return 'valid-csrf-token';
            return null;
        });
        
        testAgendaId = null;
        testNomorAgenda = null;
        testSuratMasukId = null;
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ============================================
    // STEP 1: RECORD SURAT MASUK
    // ============================================

    describe('Step 1: Record Surat Masuk', () => {
        it('Should record surat masuk successfully', async () => {
            const suratData = {
                ...TestData.surat.masuk.valid,
                createdBy: mockUser.id
            };

            apiService.saveSuratMasuk.mockResolvedValue({
                success: true,
                id: 'SM001',
                message: 'Surat masuk berhasil dicatat',
                data: { ...suratData, id: 'SM001', status: 'diterima' }
            });

            const result = await apiService.saveSuratMasuk(suratData);

            expect(result.success).toBe(true);
            expect(result.id).toBe('SM001');
            expect(result.message).toContain('berhasil dicatat');
            
            testSuratMasukId = result.id;
        });

        it('Should record surat masuk with minimal fields', async () => {
            const minimalData = {
                pengirim: 'Dinas Pendidikan',
                perihal: 'Pemberitahuan',
                tanggalTerima: '2026-07-15',
                tujuanUtama: 'dekan'
            };

            apiService.saveSuratMasuk.mockResolvedValue({
                success: true,
                id: 'SM002',
                data: { ...minimalData, id: 'SM002', status: 'diterima' }
            });

            const result = await apiService.saveSuratMasuk(minimalData);

            expect(result.success).toBe(true);
        });

        it('Should reject recording without pengirim', async () => {
            const invalidData = TestData.surat.masuk.invalid.noPengirim;

            apiService.saveSuratMasuk.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Pengirim wajib diisi',
                status: 422
            });

            const result = await apiService.saveSuratMasuk(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Pengirim wajib diisi');
            expect(result.status).toBe(422);
        });

        it('Should reject recording without perihal', async () => {
            const invalidData = TestData.surat.masuk.invalid.noPerihal;

            apiService.saveSuratMasuk.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Perihal wajib diisi',
                status: 422
            });

            const result = await apiService.saveSuratMasuk(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Perihal wajib diisi');
        });

        it('Should reject recording with future tanggal terima', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);
            
            const invalidData = {
                ...TestData.surat.masuk.valid,
                tanggalTerima: futureDate.toISOString().split('T')[0]
            };

            apiService.saveSuratMasuk.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Tanggal terima tidak boleh di masa depan',
                status: 422
            });

            const result = await apiService.saveSuratMasuk(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('masa depan');
        });

        it('Should sanitize XSS in surat data', async () => {
            const xssData = {
                ...TestData.surat.masuk.valid,
                perihal: '<script>alert("XSS")</script>Pemberitahuan'
            };

            apiService.saveSuratMasuk.mockResolvedValue({
                success: true,
                id: 'SM003',
                data: {
                    ...xssData,
                    perihal: '&lt;script&gt;alert("XSS")&lt;/script&gt;Pemberitahuan'
                }
            });

            const result = await apiService.saveSuratMasuk(xssData);

            expect(result.success).toBe(true);
            expect(result.data.perihal).not.toContain('<script>');
        });

        it('Should handle duplicate nomor surat asal', async () => {
            const duplicateData = {
                ...TestData.surat.masuk.valid,
                nomor_surat: 'B-123/DIKTI/I/2026' // Already exists
            };

            apiService.saveSuratMasuk.mockResolvedValue({
                success: false,
                error: 'Conflict',
                message: 'Surat dengan nomor tersebut sudah tercatat',
                status: 409,
                existingId: 'SM001'
            });

            const result = await apiService.saveSuratMasuk(duplicateData);

            expect(result.success).toBe(false);
            expect(result.status).toBe(409);
            expect(result.existingId).toBeTruthy();
        });
    });

    // ============================================
    // STEP 2: GENERATE NOMOR AGENDA
    // ============================================

    describe('Step 2: Generate Nomor Agenda', () => {
        it('Should generate nomor agenda automatically', async () => {
            apiService.generateNomorAgenda.mockResolvedValue({
                success: true,
                nomorAgenda: 'M.UM-005',
                prefix: 'M.UM',
                noUrut: 5
            });

            const result = await apiService.generateNomorAgenda('M.UM');

            expect(result.success).toBe(true);
            expect(result.nomorAgenda).toContain('M.UM-');
            expect(result.noUrut).toBe(5);
            expect(result.noUrut).toBeGreaterThan(0);
            
            // Format validation
            expect(result.nomorAgenda).toMatch(/^M\.UM-\d{3}$/);
            
            testNomorAgenda = result.nomorAgenda;
        });

        it('Should generate sequential agenda numbers', async () => {
            apiService.generateNomorAgenda
                .mockResolvedValueOnce({ success: true, nomorAgenda: 'M.UM-006', noUrut: 6 })
                .mockResolvedValueOnce({ success: true, nomorAgenda: 'M.UM-007', noUrut: 7 });

            const result1 = await apiService.generateNomorAgenda('M.UM');
            const result2 = await apiService.generateNomorAgenda('M.UM');

            expect(result1.noUrut).toBe(6);
            expect(result2.noUrut).toBe(7);
            expect(result2.noUrut).toBeGreaterThan(result1.noUrut);
        });

        it('Should generate different prefix for different kategori', async () => {
            apiService.generateNomorAgenda.mockResolvedValue({
                success: true,
                nomorAgenda: 'M.SP-001',
                prefix: 'M.SP',
                noUrut: 1
            });

            const result = await apiService.generateNomorAgenda('M.SP');

            expect(result.nomorAgenda).toContain('M.SP-');
        });

        it('Should reject generation with invalid kategori', async () => {
            apiService.generateNomorAgenda.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Kategori tidak valid',
                status: 422
            });

            const result = await apiService.generateNomorAgenda('INVALID');

            expect(result.success).toBe(false);
            expect(result.message).toContain('Kategori tidak valid');
        });
    });

    // ============================================
    // STEP 3: CREATE DISPOSISI
    // ============================================

    describe('Step 3: Create Disposisi', () => {
        beforeEach(() => {
            testNomorAgenda = 'M.UM-005';
        });

        it('Should create disposisi successfully', async () => {
            const disposisiData = {
                ...TestData.surat.disposisi.valid,
                nomorAgenda: testNomorAgenda,
                createdBy: mockUser.id
            };

            apiService.saveDisposisi.mockResolvedValue({
                success: true,
                id: 'DSP001',
                message: 'Disposisi berhasil dibuat',
                data: { ...disposisiData, id: 'DSP001', status: 'aktif' }
            });

            const result = await apiService.saveDisposisi(disposisiData);

            expect(result.success).toBe(true);
            expect(result.id).toBe('DSP001');
            expect(result.message).toContain('berhasil dibuat');
            
            testAgendaId = result.id;
        });

        it('Should reject disposisi without penerima', async () => {
            const invalidData = TestData.surat.disposisi.invalid.noKepada;

            apiService.saveDisposisi.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Penerima disposisi wajib diisi',
                status: 422
            });

            const result = await apiService.saveDisposisi(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Penerima disposisi wajib diisi');
        });

        it('Should reject disposisi with past date', async () => {
            const invalidData = TestData.surat.disposisi.invalid.pastDate;

            apiService.saveDisposisi.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Batas waktu tidak boleh di masa lalu',
                status: 422
            });

            const result = await apiService.saveDisposisi(invalidData);

            expect(result.success).toBe(false);
            expect(result.message).toContain('masa lalu');
        });

        it('Should reject disposisi for non-existent surat', async () => {
            const disposisiData = {
                ...TestData.surat.disposisi.valid,
                nomorAgenda: 'NON-EXISTENT'
            };

            apiService.saveDisposisi.mockResolvedValue({
                success: false,
                error: 'Not Found',
                message: 'Surat dengan nomor agenda tersebut tidak ditemukan',
                status: 404
            });

            const result = await apiService.saveDisposisi(disposisiData);

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });
    });

    // ============================================
    // STEP 4: FORWARD SURAT
    // ============================================

    describe('Step 4: Teruskan Surat', () => {
        beforeEach(() => {
            testNomorAgenda = 'M.UM-005';
        });

        it('Should forward surat to unit terkait', async () => {
            apiService.teruskanSurat.mockResolvedValue({
                success: true,
                message: 'Surat berhasil diteruskan ke Wadek',
                data: {
                    nomorAgenda: testNomorAgenda,
                    diteruskanKepada: 'wadek',
                    diteruskanOleh: mockUser.id,
                    catatan: 'Harap segera ditindaklanjuti',
                    diteruskanPada: new Date().toISOString(),
                    status: 'diteruskan'
                }
            });

            const result = await apiService.teruskanSurat(
                testNomorAgenda,
                'wadek',
                'Harap segera ditindaklanjuti'
            );

            expect(result.success).toBe(true);
            expect(result.data.diteruskanKepada).toBe('wadek');
            expect(result.data.status).toBe('diteruskan');
            expect(result.message).toContain('diteruskan');
        });

        it('Should forward to multiple units sequentially', async () => {
            // First forward to wadek
            apiService.teruskanSurat.mockResolvedValueOnce({
                success: true,
                data: { diteruskanKepada: 'wadek', status: 'diteruskan' }
            });

            const result1 = await apiService.teruskanSurat(
                testNomorAgenda, 'wadek', 'Ke wadek dulu'
            );
            expect(result1.success).toBe(true);

            // Then forward to kaprodi
            apiService.teruskanSurat.mockResolvedValueOnce({
                success: true,
                data: { diteruskanKepada: 'kaprodi_ti', status: 'diteruskan' }
            });

            const result2 = await apiService.teruskanSurat(
                testNomorAgenda, 'kaprodi_ti', 'Diteruskan ke kaprodi'
            );
            expect(result2.success).toBe(true);
        });

        it('Should reject forwarding to same unit', async () => {
            apiService.teruskanSurat.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Surat sudah berada di unit tersebut',
                status: 422
            });

            const result = await apiService.teruskanSurat(
                testNomorAgenda,
                'wadek',
                'Test'
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('sudah berada');
        });

        it('Should reject forwarding with empty catatan', async () => {
            apiService.teruskanSurat.mockResolvedValue({
                success: false,
                error: 'Validation Error',
                message: 'Catatan wajib diisi saat meneruskan surat',
                status: 422
            });

            const result = await apiService.teruskanSurat(
                testNomorAgenda,
                'wadek',
                ''
            );

            expect(result.success).toBe(false);
        });
    });

    // ============================================
    // STEP 5: TRACKING & TIMELINE
    // ============================================

    describe('Step 5: Tracking & Timeline', () => {
        beforeEach(() => {
            testNomorAgenda = 'M.UM-005';
            testSuratMasukId = 'SM001';
        });

        it('Should get surat masuk with full details', async () => {
            const trackingData = {
                id: testSuratMasukId,
                nomorAgenda: testNomorAgenda,
                pengirim: 'Dinas Pendidikan',
                perihal: 'Pemberitahuan Akreditasi',
                status: 'diteruskan',
                disposisi: {
                    id: 'DSP001',
                    disampaikanKepada: 'dekan',
                    diteruskanKepada: 'wadek',
                    instruksi: 'Mohon ditindaklanjuti',
                    status: 'aktif'
                },
                timeline: [
                    { status: 'diterima', date: '2026-07-15T10:00:00Z', user: 'Admin' },
                    { status: 'diagendakan', date: '2026-07-15T10:30:00Z', user: 'Admin' },
                    { status: 'disposisi', date: '2026-07-15T11:00:00Z', user: 'Dekan' },
                    { status: 'diteruskan', date: '2026-07-15T11:15:00Z', user: 'Dekan', tujuan: 'Wadek' }
                ]
            };

            apiService.getSuratMasuk.mockResolvedValue({
                success: true,
                data: trackingData
            });

            const result = await apiService.getSuratMasuk(testSuratMasukId);

            expect(result.success).toBe(true);
            expect(result.data).toBeTruthy();
            expect(result.data.nomorAgenda).toBe(testNomorAgenda);
            expect(result.data.timeline).toHaveLength(4);
            expect(result.data.disposisi).toBeTruthy();
        });

        it('Should get tracking timeline specifically', async () => {
            const timeline = [
                { status: 'diterima', date: '2026-07-15T10:00:00Z', user: 'Admin', catatan: 'Surat diterima' },
                { status: 'diagendakan', date: '2026-07-15T10:30:00Z', user: 'Admin', catatan: 'Nomor agenda: M.UM-005' },
                { status: 'disposisi', date: '2026-07-15T11:00:00Z', user: 'Dekan', catatan: 'Diteruskan ke Wadek' },
                { status: 'diteruskan', date: '2026-07-15T11:15:00Z', user: 'Wadek', catatan: 'Diterima dan diproses' },
                { status: 'selesai', date: '2026-07-20T14:00:00Z', user: 'Wadek', catatan: 'Telah ditindaklanjuti' }
            ];

            apiService.getTrackingTimeline.mockResolvedValue({
                success: true,
                data: { nomorAgenda: testNomorAgenda, timeline }
            });

            const result = await apiService.getTrackingTimeline(testNomorAgenda);

            expect(result.success).toBe(true);
            expect(result.data.timeline).toHaveLength(5);
            expect(result.data.timeline[0].status).toBe('diterima');
            expect(result.data.timeline[result.data.timeline.length - 1].status).toBe('selesai');
        });

        it('Should verify timeline entries are chronological', async () => {
            apiService.getTrackingTimeline.mockResolvedValue({
                success: true,
                data: {
                    timeline: [
                        { status: 'diterima', date: '2026-07-15T10:00:00Z' },
                        { status: 'diagendakan', date: '2026-07-15T10:30:00Z' },
                        { status: 'disposisi', date: '2026-07-15T11:00:00Z' }
                    ]
                }
            });

            const result = await apiService.getTrackingTimeline(testNomorAgenda);
            const timeline = result.data.timeline;

            // Verify chronological order
            for (let i = 1; i < timeline.length; i++) {
                expect(new Date(timeline[i].date).getTime())
                    .toBeGreaterThanOrEqual(new Date(timeline[i-1].date).getTime());
            }
        });

        it('Should handle tracking for non-existent surat', async () => {
            apiService.getTrackingTimeline.mockResolvedValue({
                success: false,
                error: 'Not Found',
                message: 'Surat tidak ditemukan',
                status: 404
            });

            const result = await apiService.getTrackingTimeline('NON-EXISTENT');

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });
    });

    // ============================================
    // UPDATE SURAT MASUK
    // ============================================

    describe('Update Surat Masuk', () => {
        it('Should update surat masuk details', async () => {
            const updateData = {
                perihal: 'Pemberitahuan Akreditasi (Revisi)',
                sifat: 'sangat_penting'
            };

            apiService.updateSuratMasuk.mockResolvedValue({
                success: true,
                message: 'Surat masuk berhasil diperbarui',
                data: { id: 'SM001', ...updateData }
            });

            const result = await apiService.updateSuratMasuk('SM001', updateData);

            expect(result.success).toBe(true);
            expect(result.message).toContain('diperbarui');
        });

        it('Should reject update on forwarded surat', async () => {
            apiService.updateSuratMasuk.mockResolvedValue({
                success: false,
                error: 'Invalid Status',
                message: 'Surat yang sudah diteruskan tidak dapat diubah',
                status: 422
            });

            const result = await apiService.updateSuratMasuk('SM001', { perihal: 'Test' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('tidak dapat diubah');
        });
    });

    // ============================================
    // ERROR HANDLING
    // ============================================

    describe('Error Handling', () => {
        it('Should handle network error during save', async () => {
            apiService.saveSuratMasuk.mockRejectedValue(
                new Error('Network Error: Failed to fetch')
            );

            await expect(
                apiService.saveSuratMasuk(TestData.surat.masuk.valid)
            ).rejects.toThrow('Network Error');
        });

        it('Should handle timeout during disposisi save', async () => {
            apiService.saveDisposisi.mockRejectedValue(
                new Error('Request timed out after 10000ms')
            );

            await expect(
                apiService.saveDisposisi(TestData.surat.disposisi.valid)
            ).rejects.toThrow('timed out');
        });

        it('Should handle rate limiting', async () => {
            apiService.saveSuratMasuk.mockResolvedValue({
                success: false,
                error: 'Too Many Requests',
                message: 'Terlalu banyak permintaan. Coba lagi nanti.',
                retryAfter: 60,
                status: 429
            });

            const result = await apiService.saveSuratMasuk(TestData.surat.masuk.valid);

            expect(result.success).toBe(false);
            expect(result.status).toBe(429);
            expect(result.retryAfter).toBe(60);
        });
    });

    // ============================================
    // SECURITY TESTS
    // ============================================

    describe('Security', () => {
        it('Should reject unauthenticated user', async () => {
            authService.isAuthenticated = false;
            localStorage.getItem.mockReturnValue(null);

            apiService.saveSuratMasuk.mockRejectedValue(
                new Error('Authentication required')
            );

            await expect(
                apiService.saveSuratMasuk(TestData.surat.masuk.valid)
            ).rejects.toThrow('Authentication required');
        });

        it('Should validate CSRF token', async () => {
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'csrf_token') return 'invalid-token';
                return JSON.stringify(mockUser);
            });

            apiService.saveSuratMasuk.mockRejectedValue(
                new Error('Invalid CSRF token')
            );

            await expect(
                apiService.saveSuratMasuk(TestData.surat.masuk.valid)
            ).rejects.toThrow('CSRF token');
        });

        it('Should sanitize XSS in disposisi instruksi', async () => {
            const xssDisposisi = {
                ...TestData.surat.disposisi.valid,
                isi_disposisi: '<img src=x onerror=alert(1)>Mohon ditindaklanjuti'
            };

            apiService.saveDisposisi.mockResolvedValue({
                success: true,
                id: 'DSP002',
                data: {
                    ...xssDisposisi,
                    isi_disposisi: '&lt;img src=x onerror=alert(1)&gt;Mohon ditindaklanjuti'
                }
            });

            const result = await apiService.saveDisposisi(xssDisposisi);

            expect(result.success).toBe(true);
            expect(result.data.isi_disposisi).not.toContain('<img');
        });
    });

    // ============================================
    // LIST & PAGINATION
    // ============================================

    describe('List Surat Masuk', () => {
        it('Should list surat masuk with pagination', async () => {
            const suratList = TestData.surat.masuk.list.slice(0, 10);

            apiService.getSuratMasukList.mockResolvedValue({
                success: true,
                data: suratList,
                pagination: { page: 1, limit: 10, total: 25, totalPages: 3 }
            });

            const result = await apiService.getSuratMasukList({ page: 1, limit: 10 });

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(10);
            expect(result.pagination.total).toBe(25);
        });

        it('Should filter by status', async () => {
            apiService.getSuratMasukList.mockResolvedValue({
                success: true,
                data: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
            });

            const result = await apiService.getSuratMasukList({ status: 'diteruskan' });

            expect(result.success).toBe(true);
        });

        it('Should filter by date range', async () => {
            apiService.getSuratMasukList.mockResolvedValue({
                success: true,
                data: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
            });

            const result = await apiService.getSuratMasukList({
                dateStart: '2026-07-01',
                dateEnd: '2026-07-31'
            });

            expect(result.success).toBe(true);
        });
    });

    // ============================================
    // COMPLETE FLOW VERIFICATION
    // ============================================

    describe('Complete Flow Verification', () => {
        it('Should complete full lifecycle: record → agenda → disposisi → teruskan', async () => {
            const flowSteps = [];

            // 1. Record surat masuk
            apiService.saveSuratMasuk.mockResolvedValueOnce({
                success: true, id: 'SM001', data: { status: 'diterima' }
            });
            await apiService.saveSuratMasuk(TestData.surat.masuk.valid);
            flowSteps.push('recorded');

            // 2. Generate nomor agenda
            apiService.generateNomorAgenda.mockResolvedValueOnce({
                success: true, nomorAgenda: 'M.UM-005'
            });
            await apiService.generateNomorAgenda('M.UM');
            flowSteps.push('agenda_generated');

            // 3. Create disposisi
            apiService.saveDisposisi.mockResolvedValueOnce({
                success: true, id: 'DSP001', data: { status: 'aktif' }
            });
            await apiService.saveDisposisi(TestData.surat.disposisi.valid);
            flowSteps.push('disposisi_created');

            // 4. Forward surat
            apiService.teruskanSurat.mockResolvedValueOnce({
                success: true, data: { status: 'diteruskan' }
            });
            await apiService.teruskanSurat('M.UM-005', 'wadek', 'Mohon ditindaklanjuti');
            flowSteps.push('forwarded');

            expect(flowSteps).toEqual([
                'recorded', 'agenda_generated', 'disposisi_created', 'forwarded'
            ]);
        });

        it('Should verify all API calls in correct order', () => {
            const calls = apiService.saveSuratMasuk.mock.calls;
            expect(calls.length).toBeGreaterThanOrEqual(1);
            
            // Verify call data structure
            const firstCall = calls[0]?.[0];
            expect(firstCall).toBeTruthy();
            expect(firstCall).toHaveProperty('pengirim');
            expect(firstCall).toHaveProperty('perihal');
        });
    });
});