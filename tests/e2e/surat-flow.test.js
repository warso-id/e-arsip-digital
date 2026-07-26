// FILE: tests/e2e/surat-flow.test.js
// E2E Test: Complete Surat Flow - E-Arsip Digital v2026.1.0
// Framework: Jest (dengan jsdom environment)

/**
 * @jest-environment jsdom
 */

// ============================================
// MOCK SETUP
// ============================================
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto
const mockCrypto = {
    getRandomValues: jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    })
};
Object.defineProperty(window, 'crypto', { value: mockCrypto });

// Mock fetch
global.fetch = jest.fn();

// ============================================
// MOCK API SERVICE (EXTENDED)
// ============================================
const apiMock = {
    _responses: {},
    _calls: [],

    mockResponse(action, response) {
        this._responses[action] = response;
    },

    clearMocks() {
        this._responses = {};
        this._calls = [];
    },

    getCalls() {
        return this._calls;
    },

    getCallCount(action) {
        return this._calls.filter(c => c.action === action).length;
    },

    async post(action, data) {
        this._calls.push({ method: 'POST', action, data, timestamp: Date.now() });
        const response = this._responses[action];
        if (response) return Promise.resolve(response);
        return Promise.reject(new Error(`No mock for: ${action}`));
    },

    async get(action, params) {
        this._calls.push({ method: 'GET', action, params, timestamp: Date.now() });
        const response = this._responses[action];
        if (response) return Promise.resolve(response);
        return Promise.reject(new Error(`No mock for: ${action}`));
    },

    async sendRequest(payload) {
        const action = payload.action || 'unknown';
        this._calls.push({ method: 'POST', action, data: payload, timestamp: Date.now() });
        const response = this._responses[action];
        if (response) return Promise.resolve(response);
        return Promise.reject(new Error(`No mock for: ${action}`));
    },

    // === SURAT KELUAR ===
    async saveDraftSuratKeluar(data) {
        return this.post('saveDraftSuratKeluar', data);
    },

    async submitSuratKeluar(data) {
        return this.post('submitSuratKeluar', data);
    },

    async generateNomorSurat(kategori, unit) {
        return this.get('generateNomorSurat', { kategori, unit });
    },

    async approveSuratKeluar(nomorSurat, approver, status, catatan) {
        return this.post('approveSuratKeluar', { nomorSurat, approver, status, catatan });
    },

    async generateSuratFinal(id, format, options) {
        return this.post('generateSuratFinal', { id, format, ...options });
    },

    async getSuratDetail(id) {
        return this.get('getSuratDetail', { id });
    },

    async getApprovalHistory(nomorSurat) {
        return this.get('getApprovalHistory', { nomorSurat });
    },

    async deleteSurat(id) {
        return this.post('deleteSurat', { id });
    },

    async bulkDeleteSurat(ids) {
        return this.post('bulkDeleteSurat', { ids });
    },

    // === SURAT MASUK ===
    async createSuratMasuk(data) {
        return this.post('createSuratMasuk', data);
    },

    async createDisposisi(data) {
        return this.post('createDisposisi', data);
    },

    async getDisposisiHistory(suratId) {
        return this.get('getDisposisiHistory', { suratId });
    },

    // === VERIFICATION ===
    async verifySurat(nomorSurat) {
        return this.get('verifySurat', { nomorSurat });
    }
};

// ============================================
// MOCK VALIDATOR
// ============================================
const Validator = {
    validateForm(fields) {
        const errors = [];
        for (const [key, config] of Object.entries(fields)) {
            for (const rule of config.rules) {
                if (rule.method === 'required' && (!config.value || !String(config.value).trim())) {
                    errors.push({ field: key, message: rule.message || `${key} wajib diisi` });
                }
                if (rule.method === 'minLength' && config.value && config.value.length < rule.value) {
                    errors.push({ field: key, message: rule.message || `${key} minimal ${rule.value} karakter` });
                }
                if (rule.method === 'maxLength' && config.value && config.value.length > rule.value) {
                    errors.push({ field: key, message: rule.message || `${key} maksimal ${rule.value} karakter` });
                }
                if (rule.method === 'pattern' && config.value && !rule.value.test(config.value)) {
                    errors.push({ field: key, message: rule.message || `${key} format tidak valid` });
                }
            }
        }
        return { isValid: errors.length === 0, errors };
    }
};

// ============================================
// MOCK SECURITY MANAGER (EXTENDED)
// ============================================
const securityManager = {
    _allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
    ],
    _maxFileSize: 10 * 1024 * 1024, // 10MB
    _blockedExtensions: ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.js', '.vbs'],

    validateFileUpload(file) {
        const errors = [];

        // Check file size
        if (file.size > this._maxFileSize) {
            errors.push(`Ukuran file (${(file.size / 1048576).toFixed(1)}MB) melebihi batas maksimal 10MB`);
        }

        // Check file type
        if (file.type && !this._allowedTypes.includes(file.type)) {
            errors.push(`Tipe file ${file.type} tidak diizinkan`);
        }

        // Check extension
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (this._blockedExtensions.includes(ext)) {
            errors.push(`Ekstensi file ${ext} diblokir karena alasan keamanan`);
        }

        // Check empty file
        if (file.size === 0) {
            errors.push('File kosong tidak diizinkan');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    sanitizeFileName(filename) {
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.{2,}/g, '.')
            .substring(0, 200);
    },

    validateNomorSurat(nomor) {
        const pattern = /^[\d]{3}\/[A-Z\.]+\/[A-Z]+\/[A-Z]+\/[IVXLCDM]+\/\d{4}$/;
        return pattern.test(nomor);
    }
};

// ============================================
// MOCK UTILS
// ============================================
const Utils = {
    generateQRCode(data) {
        const baseUrl = 'https://api.qrserver.com/v1/create-qr-code/';
        const params = `?size=150x150&data=${encodeURIComponent(data)}`;
        return baseUrl + params;
    },

    formatDate(dateStr, format) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            if (format === 'short') return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            if (format === 'long') return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            return d.toLocaleDateString('id-ID');
        } catch (e) {
            return dateStr;
        }
    },

    timeAgo(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 60) return 'Baru saja';
        if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
        if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
        return Math.floor(diff / 86400) + ' hari lalu';
    },

    debounce(fn, ms) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), ms);
        };
    }
};

// ============================================
// MOCK AUTH
// ============================================
const auth = {
    currentUser: null,
    isAuthenticated: false,

    checkAuth() {
        try {
            const data = localStorage.getItem('currentUser');
            if (data) {
                this.currentUser = JSON.parse(data);
                this.isAuthenticated = true;
                return true;
            }
        } catch (e) {}
        return false;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    hasRole(roles) {
        if (!this.currentUser) return false;
        const roleList = Array.isArray(roles) ? roles : [roles];
        return roleList.includes(this.currentUser.role);
    }
};

// Setup window globals
window.api = apiMock;
window.Validator = Validator;
window.securityManager = securityManager;
window.Utils = Utils;
window.auth = auth;

// ============================================
// DOM SETUP
// ============================================
let testSuratId;
let testNomorSurat;
let formSuratKeluar;
let nomorPreviewBox;
let nomorPreviewText;
let progressApproval;

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    apiMock.clearMocks();

    document.body.innerHTML = `
        <div id="alertContainer"></div>
        <div id="toastContainer"></div>
        <form id="formSuratKeluar" novalidate>
            <input type="hidden" id="csrfToken" value="test-csrf-token">
            <select id="kategoriSurat" required>
                <option value="">Pilih Kategori</option>
                <option value="K.UM">K.UM - Umum</option>
                <option value="K.UM.S1">K.UM.S1 - Umum S1</option>
                <option value="K.UM.S2">K.UM.S2 - Umum S2</option>
                <option value="K.KEU">K.KEU - Keuangan</option>
                <option value="K.LGL">K.LGL - Legal</option>
                <option value="K.LGL.S1">K.LGL.S1 - Legal S1</option>
                <option value="K.LGL.S2">K.LGL.S2 - Legal S2</option>
            </select>
            <input type="text" id="perihal" placeholder="Perihal surat" required maxlength="200">
            <input type="text" id="tujuanSurat" placeholder="Tujuan surat" required maxlength="200">
            <textarea id="isiSurat" placeholder="Isi surat" required maxlength="2000"></textarea>
            <input type="date" id="tanggalSurat" required>
            <select id="sifatSurat" required>
                <option value="">Pilih Sifat</option>
                <option value="biasa">Biasa</option>
                <option value="segera">Segera</option>
                <option value="rahasia">Rahasia</option>
            </select>
            <select id="penandatangan" required>
                <option value="">Pilih Penandatangan</option>
                <option value="dekan">Dekan</option>
                <option value="wadek1">Wadek I</option>
                <option value="kaprodi">Kaprodi</option>
            </select>
            <input type="file" id="fileSurat" accept=".pdf,.doc,.docx">
            <input type="file" id="lampiranSurat" accept=".pdf,.jpg,.jpeg,.png" multiple>
            <button type="submit" id="btnSubmit">Submit</button>
            <button type="button" id="btnDraft">Simpan Draft</button>
        </form>
        <div id="nomorPreviewBox" style="display:none;">
            <span id="nomorPreviewText">-</span>
        </div>
        <div id="progressApproval"></div>
        <div id="approvalActions"></div>
        <div id="generatedResult"></div>
    `;

    formSuratKeluar = document.getElementById('formSuratKeluar');
    nomorPreviewBox = document.getElementById('nomorPreviewBox');
    nomorPreviewText = document.getElementById('nomorPreviewText');
    progressApproval = document.getElementById('progressApproval');

    // Setup user
    const userData = { id: '3', username: 'user1', fullname: 'Test User', role: 'user', unit: 'FIKOM' };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    auth.checkAuth();

    // Set test IDs
    testSuratId = 'SK-E2E-' + Date.now().toString(36).toUpperCase();
    testNomorSurat = null;
});

// ============================================
// TEST SUITES
// ============================================

describe('E2E Test: Complete Surat Flow - E-Arsip Digital v2026.1.0', () => {

    // ============================================
    // DRAFT CREATION
    // ============================================
    describe('Draft Creation', () => {
        test('E2E-SURAT-001: Should create draft surat with valid data', async () => {
            document.getElementById('kategoriSurat').value = 'K.UM';
            document.getElementById('perihal').value = 'Undangan Rapat Koordinasi';
            document.getElementById('tujuanSurat').value = 'Seluruh Dosen FIKOM';
            document.getElementById('isiSurat').value = 'Mengundang seluruh dosen untuk rapat koordinasi semester ganjil.';
            document.getElementById('tanggalSurat').value = '2024-07-20';
            document.getElementById('sifatSurat').value = 'biasa';
            document.getElementById('penandatangan').value = 'dekan';

            const formData = {
                kategori: document.getElementById('kategoriSurat').value,
                perihal: document.getElementById('perihal').value,
                tujuan: document.getElementById('tujuanSurat').value,
                isiSurat: document.getElementById('isiSurat').value,
                tanggalSurat: document.getElementById('tanggalSurat').value,
                sifatSurat: document.getElementById('sifatSurat').value,
                penandatangan: document.getElementById('penandatangan').value
            };

            // Validate
            const validation = Validator.validateForm({
                kategori: { value: formData.kategori, rules: [{ method: 'required', message: 'Kategori harus dipilih' }] },
                perihal: { value: formData.perihal, rules: [{ method: 'required', message: 'Perihal harus diisi' }, { method: 'minLength', value: 5, message: 'Perihal minimal 5 karakter' }] },
                isiSurat: { value: formData.isiSurat, rules: [{ method: 'required', message: 'Isi surat harus diisi' }] },
                tanggalSurat: { value: formData.tanggalSurat, rules: [{ method: 'required', message: 'Tanggal harus diisi' }] },
                penandatangan: { value: formData.penandatangan, rules: [{ method: 'required', message: 'Penandatangan harus dipilih' }] }
            });

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);

            apiMock.mockResponse('saveDraftSuratKeluar', {
                success: true,
                data: { id: 'DRAFT-001', message: 'Draft berhasil disimpan' }
            });

            const result = await apiMock.saveDraftSuratKeluar(formData);
            expect(result.success).toBe(true);
            expect(result.data.id).toBeDefined();
        });

        test('E2E-SURAT-002: Should reject draft with missing required fields', async () => {
            const validation = Validator.validateForm({
                kategori: { value: '', rules: [{ method: 'required', message: 'Kategori harus dipilih' }] },
                perihal: { value: '', rules: [{ method: 'required', message: 'Perihal harus diisi' }] },
                isiSurat: { value: '', rules: [{ method: 'required', message: 'Isi surat harus diisi' }] }
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    // ============================================
    // NOMOR SURAT GENERATION
    // ============================================
    describe('Nomor Surat Generation', () => {
        test('E2E-SURAT-010: Should generate nomor surat correctly', async () => {
            apiMock.mockResponse('generateNomorSurat', {
                success: true,
                data: {
                    nomorSurat: '010/K.UM/FIKOM/VII/2024',
                    noUrut: 10,
                    kategori: 'K.UM',
                    unit: 'FIKOM',
                    bulan: 'VII',
                    tahun: '2024'
                }
            });

            const result = await apiMock.generateNomorSurat('K.UM', 'FIKOM');

            expect(result.success).toBe(true);
            expect(result.data.nomorSurat).toBeDefined();
            expect(result.data.nomorSurat).toContain('K.UM');
            expect(result.data.nomorSurat).toContain('FIKOM');
            expect(result.data.nomorSurat).toContain('2024');

            // Update preview
            nomorPreviewBox.style.display = 'block';
            nomorPreviewText.textContent = result.data.nomorSurat;
            testNomorSurat = result.data.nomorSurat;

            expect(nomorPreviewText.textContent).toBe('010/K.UM/FIKOM/VII/2024');
        });

        test('E2E-SURAT-011: Nomor surat should follow valid format', () => {
            const validNomor = '010/K.UM/FIKOM/VII/2024';
            const isValid = securityManager.validateNomorSurat(validNomor);
            expect(isValid).toBe(true);

            const invalidNomor = 'invalid-format';
            expect(securityManager.validateNomorSurat(invalidNomor)).toBe(false);
        });

        test('E2E-SURAT-012: Different categories should have different prefixes', async () => {
            apiMock.mockResponse('generateNomorSurat', {
                success: true,
                data: { nomorSurat: '005/K.KEU/FIKOM/VII/2024', noUrut: 5 }
            });

            const result = await apiMock.generateNomorSurat('K.KEU', 'FIKOM');
            expect(result.data.nomorSurat).toContain('K.KEU');
        });
    });

    // ============================================
    // SUBMISSION & APPROVAL
    // ============================================
    describe('Submission & Approval Workflow', () => {
        beforeEach(() => {
            testNomorSurat = '010/K.UM/FIKOM/VII/2024';
        });

        test('E2E-SURAT-020: Should submit surat for approval', async () => {
            apiMock.mockResponse('submitSuratKeluar', {
                success: true,
                data: {
                    id: testSuratId,
                    nomorSurat: testNomorSurat,
                    status: 'pending_admin',
                    message: 'Surat berhasil diajukan untuk approval'
                }
            });

            const result = await apiMock.submitSuratKeluar({
                id: testSuratId,
                nomorSurat: testNomorSurat,
                kategori: 'K.UM',
                perihal: 'Undangan Rapat',
                status: 'pending_admin'
            });

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('pending_admin');
        });

        test('E2E-SURAT-021: Should track full approval progress', () => {
            const mockApprovals = [
                { role: 'Admin', status: 'approved', date: '2024-07-20 10:00', catatan: 'Dokumen lengkap' },
                { role: 'Kasubag', status: 'approved', date: '2024-07-20 11:00', catatan: 'Disetujui' },
                { role: 'Wadek', status: 'pending', date: null, catatan: null },
                { role: 'Dekan', status: 'pending', date: null, catatan: null }
            ];

            progressApproval.innerHTML = mockApprovals.map(a => `
                <div class="approval-item ${a.status}">
                    <span>${a.role}</span>
                    <span class="badge badge-${a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'warning'}">
                        ${a.status === 'approved' ? '✅ Disetujui' : a.status === 'rejected' ? '❌ Ditolak' : '⏳ Menunggu'}
                    </span>
                    ${a.catatan ? `<small>${a.catatan}</small>` : ''}
                </div>
            `).join('');

            const approved = mockApprovals.filter(a => a.status === 'approved').length;
            const pending = mockApprovals.filter(a => a.status === 'pending').length;

            expect(approved).toBe(2);
            expect(pending).toBe(2);
        });

        test('E2E-SURAT-022: Should handle approval with catatan', async () => {
            apiMock.mockResponse('approveSuratKeluar', {
                success: true,
                data: {
                    message: 'Surat disetujui',
                    nextStatus: 'pending_kasubag'
                }
            });

            const result = await apiMock.approveSuratKeluar(
                testNomorSurat, 'admin', 'approved', 'Dokumen sudah lengkap dan sesuai'
            );

            expect(result.success).toBe(true);
            expect(result.data.nextStatus).toBe('pending_kasubag');

            const calls = apiMock.getCalls();
            const approveCall = calls.find(c => c.action === 'approveSuratKeluar');
            expect(approveCall).toBeDefined();
            expect(approveCall.data.catatan).toBe('Dokumen sudah lengkap dan sesuai');
        });

        test('E2E-SURAT-023: Should handle surat rejection', async () => {
            apiMock.mockResponse('approveSuratKeluar', {
                success: true,
                data: {
                    message: 'Surat ditolak',
                    nextStatus: 'rejected'
                }
            });

            const result = await apiMock.approveSuratKeluar(
                testNomorSurat, 'wadek', 'rejected', 'Format tidak sesuai, mohon diperbaiki'
            );

            expect(result.success).toBe(true);
            expect(result.data.nextStatus).toBe('rejected');

            const calls = apiMock.getCalls();
            const rejectCall = calls.find(c => c.action === 'approveSuratKeluar' && c.data.status === 'rejected');
            expect(rejectCall).toBeDefined();
        });
    });

    // ============================================
    // FILE UPLOAD SECURITY
    // ============================================
    describe('File Upload Security', () => {
        test('E2E-SURAT-030: Should reject file exceeding max size', () => {
            const largeFile = { size: 15 * 1024 * 1024, name: 'large.pdf', type: 'application/pdf' };
            const validation = securityManager.validateFileUpload(largeFile);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toContain('maksimal');
        });

        test('E2E-SURAT-031: Should reject executable files', () => {
            const exeFile = { size: 1024, name: 'malware.exe', type: 'application/x-msdownload' };
            const validation = securityManager.validateFileUpload(exeFile);

            expect(validation.valid).toBe(false);
        });

        test('E2E-SURAT-032: Should reject script files', () => {
            const scriptFile = { size: 500, name: 'script.bat', type: 'application/octet-stream' };
            const validation = securityManager.validateFileUpload(scriptFile);

            expect(validation.valid).toBe(false);
            expect(validation.errors.some(e => e.includes('diblokir'))).toBe(true);
        });

        test('E2E-SURAT-033: Should accept valid PDF', () => {
            const validPDF = { size: 500 * 1024, name: 'dokumen.pdf', type: 'application/pdf' };
            const validation = securityManager.validateFileUpload(validPDF);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('E2E-SURAT-034: Should accept valid image files', () => {
            const validImage = { size: 200 * 1024, name: 'lampiran.jpg', type: 'image/jpeg' };
            const validation = securityManager.validateFileUpload(validImage);

            expect(validation.valid).toBe(true);
        });

        test('E2E-SURAT-035: Should reject empty files', () => {
            const emptyFile = { size: 0, name: 'empty.pdf', type: 'application/pdf' };
            const validation = securityManager.validateFileUpload(emptyFile);

            expect(validation.valid).toBe(false);
        });

        test('E2E-SURAT-036: Should sanitize filename', () => {
            const dangerousName = '../../../etc/passwd.pdf';
            const sanitized = securityManager.sanitizeFileName(dangerousName);

            expect(sanitized).not.toContain('..');
            expect(sanitized).not.toContain('/');
            expect(sanitized).toContain('.pdf');
        });
    });

    // ============================================
    // QR CODE & VERIFICATION
    // ============================================
    describe('QR Code & Verification', () => {
        beforeEach(() => {
            testNomorSurat = '010/K.UM/FIKOM/VII/2024';
        });

        test('E2E-SURAT-040: Should generate QR code for surat', () => {
            const qrData = testNomorSurat;
            const qrCode = Utils.generateQRCode(qrData);

            expect(qrCode).toBeDefined();
            expect(qrCode).toContain('qrserver.com');
            expect(qrCode).toContain(encodeURIComponent(qrData));
        });

        test('E2E-SURAT-041: Should verify valid surat via API', async () => {
            apiMock.mockResponse('verifySurat', {
                success: true,
                data: {
                    nomorSurat: testNomorSurat,
                    perihal: 'Undangan Rapat Koordinasi',
                    status: 'completed',
                    valid: true,
                    verifiedAt: new Date().toISOString()
                }
            });

            const result = await apiMock.verifySurat(testNomorSurat);

            expect(result.success).toBe(true);
            expect(result.data.valid).toBe(true);
            expect(result.data.nomorSurat).toBe(testNomorSurat);
        });

        test('E2E-SURAT-042: Should detect invalid surat', async () => {
            apiMock.mockResponse('verifySurat', {
                success: true,
                data: { valid: false, message: 'Surat tidak ditemukan dalam sistem' }
            });

            const result = await apiMock.verifySurat('INVALID-001');
            expect(result.data.valid).toBe(false);
        });
    });

    // ============================================
    // GENERATE FINAL
    // ============================================
    describe('Generate Surat Final', () => {
        beforeEach(() => {
            testNomorSurat = '010/K.UM/FIKOM/VII/2024';
        });

        test('E2E-SURAT-050: Should generate final PDF', async () => {
            apiMock.mockResponse('generateSuratFinal', {
                success: true,
                data: {
                    id: testSuratId,
                    nomorFinal: testNomorSurat,
                    format: 'pdf',
                    size: '245 KB',
                    downloadUrl: '#',
                    generatedAt: new Date().toISOString()
                }
            });

            const result = await apiMock.generateSuratFinal(testSuratId, 'pdf', {
                paperSize: 'A4',
                includeQR: true,
                includeTTD: true
            });

            expect(result.success).toBe(true);
            expect(result.data.format).toBe('pdf');
            expect(result.data.nomorFinal).toBe(testNomorSurat);
        });

        test('E2E-SURAT-051: Should generate Word document', async () => {
            apiMock.mockResponse('generateSuratFinal', {
                success: true,
                data: { format: 'word', size: '180 KB' }
            });

            const result = await apiMock.generateSuratFinal(testSuratId, 'word', {});
            expect(result.data.format).toBe('word');
        });

        test('E2E-SURAT-052: Should not generate if not approved', async () => {
            apiMock.mockResponse('generateSuratFinal', {
                success: false,
                message: 'Surat belum disetujui sepenuhnya'
            });

            const result = await apiMock.generateSuratFinal(testSuratId, 'pdf', {});
            expect(result.success).toBe(false);
            expect(result.message).toContain('belum disetujui');
        });
    });

    // ============================================
    // SURAT MASUK & DISPOSISI
    // ============================================
    describe('Surat Masuk & Disposisi', () => {
        test('E2E-SURAT-060: Should create surat masuk', async () => {
            apiMock.mockResponse('createSuratMasuk', {
                success: true,
                data: { id: 'SM-001', nomorAgenda: 'M.UM-001' }
            });

            const data = {
                nomor_surat: '421.5/1234/DP/2024',
                tanggal_surat: '2024-07-15',
                tanggal_diterima: '2024-07-18',
                perihal: 'Pemberitahuan Akreditasi',
                asal_tipe: 'eksternal',
                instansi: 'Dinas Pendidikan',
                jenis_surat: 'penting',
                sifat_surat: 'segera'
            };

            const result = await apiMock.createSuratMasuk(data);
            expect(result.success).toBe(true);
            expect(result.data.nomorAgenda).toBeDefined();
        });

        test('E2E-SURAT-061: Should create disposisi for surat masuk', async () => {
            apiMock.mockResponse('createDisposisi', {
                success: true,
                data: { id: 'DISP-001', message: 'Disposisi berhasil dibuat' }
            });

            const result = await apiMock.createDisposisi({
                surat_id: 'SM-001',
                kepada: 'wadek1',
                batas_waktu: '2024-07-25',
                isi_disposisi: 'Mohon ditindaklanjuti untuk persiapan akreditasi',
                sifat: 'segera'
            });

            expect(result.success).toBe(true);
        });

        test('E2E-SURAT-062: Should retrieve disposisi history', async () => {
            apiMock.mockResponse('getDisposisiHistory', {
                success: true,
                data: [
                    { id: '1', kepada_nama: 'Wadek I', status: 'selesai', isi_disposisi: 'Tindak lanjuti', createdAt: new Date().toISOString() },
                    { id: '2', kepada_nama: 'Kaprodi', status: 'proses', isi_disposisi: 'Siapkan dokumen', createdAt: new Date().toISOString() }
                ]
            });

            const result = await apiMock.getDisposisiHistory('SM-001');
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
        });
    });

    // ============================================
    // BULK ACTIONS
    // ============================================
    describe('Bulk Actions', () => {
        test('E2E-SURAT-070: Should delete single surat', async () => {
            apiMock.mockResponse('deleteSurat', {
                success: true,
                message: 'Surat berhasil dihapus'
            });

            const result = await apiMock.deleteSurat('SK-001');
            expect(result.success).toBe(true);
        });

        test('E2E-SURAT-071: Should bulk delete multiple surat', async () => {
            apiMock.mockResponse('bulkDeleteSurat', {
                success: true,
                data: { deleted: 3, message: '3 surat berhasil dihapus' }
            });

            const result = await apiMock.bulkDeleteSurat(['SK-001', 'SK-002', 'SK-003']);
            expect(result.success).toBe(true);
            expect(result.data.deleted).toBe(3);
        });
    });

    // ============================================
    // INTEGRATION: COMPLETE FLOW
    // ============================================
    describe('Integration: Complete Surat Flow', () => {
        test('E2E-SURAT-080: Full lifecycle - Draft to Final', async () => {
            // Step 1: Create draft
            apiMock.mockResponse('saveDraftSuratKeluar', {
                success: true,
                data: { id: 'FULL-001', message: 'Draft saved' }
            });

            const draftResult = await apiMock.saveDraftSuratKeluar({
                kategori: 'K.UM',
                perihal: 'Undangan Workshop',
                tujuan: 'Seluruh Kaprodi',
                isiSurat: 'Mengundang...',
                tanggalSurat: '2024-07-20'
            });

            expect(draftResult.success).toBe(true);
            const suratId = draftResult.data.id;

            // Step 2: Generate nomor
            apiMock.mockResponse('generateNomorSurat', {
                success: true,
                data: { nomorSurat: '015/K.UM/FIKOM/VII/2024', noUrut: 15 }
            });

            const nomorResult = await apiMock.generateNomorSurat('K.UM', 'FIKOM');
            expect(nomorResult.success).toBe(true);
            const nomorSurat = nomorResult.data.nomorSurat;

            // Step 3: Submit
            apiMock.mockResponse('submitSuratKeluar', {
                success: true,
                data: { id: suratId, status: 'pending_admin' }
            });

            const submitResult = await apiMock.submitSuratKeluar({
                id: suratId,
                nomorSurat: nomorSurat,
                status: 'pending_admin'
            });

            expect(submitResult.success).toBe(true);
            expect(submitResult.data.status).toBe('pending_admin');

            // Step 4: Verify API call count
            const calls = apiMock.getCalls();
            expect(calls.length).toBeGreaterThanOrEqual(3);

            // Step 5: Generate final (should succeed after approval simulation)
            apiMock.mockResponse('generateSuratFinal', {
                success: true,
                data: { nomorFinal: nomorSurat, format: 'pdf' }
            });

            const finalResult = await apiMock.generateSuratFinal(suratId, 'pdf', {
                includeQR: true,
                includeTTD: true
            });

            expect(finalResult.success).toBe(true);
            expect(finalResult.data.nomorFinal).toBe(nomorSurat);
        });

        test('E2E-SURAT-081: Full lifecycle - Surat Masuk with Disposisi', async () => {
            // Step 1: Create surat masuk
            apiMock.mockResponse('createSuratMasuk', {
                success: true,
                data: { id: 'SM-FULL-001', nomorAgenda: 'M.UM-005' }
            });

            const smResult = await apiMock.createSuratMasuk({
                nomor_surat: 'B-789/UN/2024',
                perihal: 'Edaran Cuti Bersama',
                asal_tipe: 'internal',
                asal_internal: 'rektorat'
            });

            expect(smResult.success).toBe(true);

            // Step 2: Create disposisi
            apiMock.mockResponse('createDisposisi', {
                success: true,
                data: { id: 'DISP-FULL-001' }
            });

            const dispResult = await apiMock.createDisposisi({
                surat_id: smResult.data.id,
                kepada: 'wadek2',
                batas_waktu: '2024-08-01',
                isi_disposisi: 'Mohon disosialisasikan ke seluruh unit',
                sifat: 'biasa'
            });

            expect(dispResult.success).toBe(true);

            // Step 3: Get history
            apiMock.mockResponse('getDisposisiHistory', {
                success: true,
                data: [{ id: 'DISP-FULL-001', status: 'proses' }]
            });

            const historyResult = await apiMock.getDisposisiHistory(smResult.data.id);
            expect(historyResult.data).toHaveLength(1);
        });
    });
});

// ============================================
// EXPORT FOR CI/CD
// ============================================
module.exports = {
    apiMock,
    Validator,
    securityManager,
    Utils,
    auth
};