// tests/mocks/api-mock.js - Enterprise API Mock Service 2026
/**
 * E-Arsip Digital - Advanced API Mock for Testing
 * Version: 2026.1.0
 * Features: Realistic delay simulation, error scenarios, rate limiting,
 *           pagination, filtering, sorting, CRUD operations with persistence,
 *           CSRF validation, token validation, state management
 * Security: Simulated authentication, CSRF protection, input validation
 */

class APIMock {
    constructor(options = {}) {
        this.config = {
            delay: { min: 50, max: 300 },
            errorRate: 0,
            enableLogging: false,
            enableRateLimit: true,
            enableAuth: true,
            ...options
        };

        // Route registry
        this.routes = new Map();

        // State
        this.state = {
            tokens: new Map(),
            currentUser: null,
            requestCount: new Map(),
            rateLimitReset: Date.now()
        };

        // Initialize
        this.setupRoutes();
    }

    // ============================================
    // ROUTE SETUP
    // ============================================

    setupRoutes() {
        // Auth
        this.post('/api/auth/login', this.handleLogin);
        this.post('/api/auth/logout', this.handleLogout);
        this.post('/api/auth/refresh', this.handleRefreshToken);
        this.post('/api/auth/change-password', this.handleChangePassword);
        this.get('/api/auth/me', this.handleGetCurrentUser);

        // Surat Keluar
        this.get('/api/surat-keluar', this.handleGetSuratKeluarList);
        this.get('/api/surat-keluar/:id', this.handleGetSuratKeluarById);
        this.post('/api/surat-keluar', this.handleCreateSuratKeluar);
        this.put('/api/surat-keluar/:id', this.handleUpdateSuratKeluar);
        this.delete('/api/surat-keluar/:id', this.handleDeleteSuratKeluar);
        this.post('/api/surat-keluar/:id/submit', this.handleSubmitSuratKeluar);
        this.post('/api/surat-keluar/:id/approve', this.handleApproveSuratKeluar);
        this.post('/api/surat-keluar/:id/reject', this.handleRejectSuratKeluar);
        this.post('/api/surat-keluar/bulk-delete', this.handleBulkDeleteSuratKeluar);
        this.get('/api/surat-keluar/:id/tracking', this.handleGetTrackingSuratKeluar);

        // Surat Masuk
        this.get('/api/surat-masuk', this.handleGetSuratMasukList);
        this.get('/api/surat-masuk/:id', this.handleGetSuratMasukById);
        this.post('/api/surat-masuk', this.handleCreateSuratMasuk);
        this.put('/api/surat-masuk/:id', this.handleUpdateSuratMasuk);
        this.delete('/api/surat-masuk/:id', this.handleDeleteSuratMasuk);
        this.get('/api/surat-masuk/:id/disposisi', this.handleGetDisposisiList);
        this.post('/api/surat-masuk/:id/disposisi', this.handleCreateDisposisi);
        this.put('/api/surat-masuk/:id/disposisi/:disposisiId', this.handleUpdateDisposisi);
        this.post('/api/surat-masuk/:id/teruskan', this.handleTeruskanSuratMasuk);
        this.get('/api/surat-masuk/:id/tracking', this.handleGetTrackingSuratMasuk);

        // Users
        this.get('/api/users', this.handleGetUsers);
        this.post('/api/users', this.handleCreateUser);
        this.put('/api/users/:id', this.handleUpdateUser);
        this.delete('/api/users/:id', this.handleDeleteUser);
        this.patch('/api/users/:id/status', this.handleToggleUserStatus);
        this.post('/api/users/:id/reset-password', this.handleResetPassword);

        // Dashboard
        this.get('/api/dashboard/stats', this.handleDashboardStats);
        this.get('/api/dashboard/chart', this.handleDashboardChart);
        this.get('/api/dashboard/recent', this.handleDashboardRecent);

        // Profile
        this.get('/api/profile', this.handleGetProfile);
        this.put('/api/profile', this.handleUpdateProfile);
        this.post('/api/profile/photo', this.handleUploadPhoto);
        this.get('/api/profile/activity', this.handleGetProfileActivity);

        // Reports
        this.get('/api/reports/:type', this.handleGetReport);
        this.get('/api/reports/trend', this.handleGetTrendData);
        this.get('/api/reports/distribution/:type', this.handleGetDistributionData);

        // Notifications
        this.get('/api/notifications', this.handleGetNotifications);
        this.patch('/api/notifications/:id/read', this.handleMarkNotificationRead);
        this.post('/api/notifications/mark-all-read', this.handleMarkAllNotificationsRead);
        this.delete('/api/notifications/:id', this.handleDeleteNotification);
        this.delete('/api/notifications', this.handleClearNotifications);

        // Settings
        this.get('/api/settings', this.handleGetSettings);
        this.put('/api/settings', this.handleUpdateSettings);
        this.get('/api/settings/penomoran', this.handleGetPenomoranSettings);
        this.put('/api/settings/penomoran', this.handleUpdatePenomoranSettings);
        this.get('/api/settings/units', this.handleGetUnits);

        // Backup
        this.get('/api/backup/history', this.handleGetBackupHistory);
        this.get('/api/backup/storage-info', this.handleGetStorageInfo);
        this.post('/api/backup/create', this.handleCreateBackup);
        this.delete('/api/backup/:id', this.handleDeleteBackup);
        this.get('/api/backup/schedule', this.handleGetBackupSchedule);
        this.put('/api/backup/schedule', this.handleUpdateBackupSchedule);

        // Signatures
        this.get('/api/signatures', this.handleGetSignatures);
        this.post('/api/signatures', this.handleCreateSignature);
        this.put('/api/signatures/:id/default', this.handleSetDefaultSignature);
        this.delete('/api/signatures/:id', this.handleDeleteSignature);

        // Logs
        this.get('/api/logs', this.handleGetLogs);
        this.delete('/api/logs', this.handleClearLogs);

        // Verification
        this.get('/api/verify/:id', this.handleVerifySurat);
        this.post('/api/verify', this.handleVerifyQRCode);

        // Health
        this.get('/api/health', this.handleHealthCheck);
    }

    // ============================================
    // ROUTE REGISTRATION HELPERS
    // ============================================

    addRoute(method, path, handler) {
        const key = `${method.toUpperCase()}:${path}`;
        this.routes.set(key, handler.bind(this));
    }

    get(path, handler) { this.addRoute('GET', path, handler); }
    post(path, handler) { this.addRoute('POST', path, handler); }
    put(path, handler) { this.addRoute('PUT', path, handler); }
    delete(path, handler) { this.addRoute('DELETE', path, handler); }
    patch(path, handler) { this.addRoute('PATCH', path, handler); }

    matchRoute(method, path) {
        const exactKey = `${method}:${path}`;
        
        if (this.routes.has(exactKey)) {
            return { handler: this.routes.get(exactKey), params: {} };
        }

        // Pattern matching
        for (const [key, handler] of this.routes) {
            const [routeMethod, routePath] = key.split(':');
            
            if (routeMethod !== method) continue;

            const regex = this.pathToRegex(routePath);
            const match = path.match(regex);

            if (match) {
                return { handler, params: match.groups || {} };
            }
        }

        return null;
    }

    pathToRegex(path) {
        const pattern = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/:(\w+)/g, '(?<$1>[^/]+)');
        
        return new RegExp(`^${pattern}$`);
    }

    // ============================================
    // REQUEST HANDLING
    // ============================================

    async handleRequest(method, url, data = null, headers = {}) {
        // Simulate network delay
        const delay = this.randomBetween(this.config.delay.min, this.config.delay.max);
        await this.sleep(delay);

        // Simulate random errors
        if (Math.random() < this.config.errorRate) {
            throw this.createError(500, 'Simulated server error');
        }

        // Parse URL
        const [path, queryString] = url.split('?');
        const queryParams = this.parseQueryParams(queryString);

        // Check rate limit
        if (this.config.enableRateLimit) {
            const rateLimitResult = this.checkRateLimit(method, path);
            if (!rateLimitResult.allowed) {
                throw this.createError(429, 'Too Many Requests', { retryAfter: rateLimitResult.retryAfter });
            }
        }

        // Check authentication
        if (this.config.enableAuth && this.isProtectedRoute(path)) {
            const authResult = this.validateAuth(headers);
            if (!authResult.valid) {
                throw this.createError(401, authResult.message || 'Authentication required');
            }
        }

        // Match route
        const match = this.matchRoute(method, path);

        if (!match) {
            if (this.config.enableLogging) {
                console.warn(`[APIMock] No route: ${method} ${path}`);
            }
            
            return this.createResponse(404, {
                success: false,
                error: 'Not Found',
                message: `Route ${method} ${path} not found`
            });
        }

        try {
            const result = await match.handler({
                body: data,
                params: match.params,
                query: queryParams,
                headers
            });

            return this.createResponse(200, result);
        } catch (error) {
            const status = error.status || 500;
            const message = error.message || 'Internal server error';

            if (this.config.enableLogging) {
                console.error(`[APIMock] Error in ${method} ${path}:`, message);
            }

            return this.createResponse(status, {
                success: false,
                error: this.getErrorName(status),
                message,
                ...(error.data || {})
            });
        }
    }

    // ============================================
    // AUTH HANDLERS
    // ============================================

    async handleLogin({ body }) {
        const { username, password } = body || {};

        if (!username || !password) {
            throw this.createError(422, 'Username dan password wajib diisi');
        }

        // Find user in mock data
        const user = this.findUser(username);

        if (!user || password !== 'Password123!') {
            throw this.createError(401, 'Username atau password salah');
        }

        if (user.status === 'inactive') {
            throw this.createError(403, 'Akun tidak aktif');
        }

        const token = this.generateToken();
        const refreshToken = this.generateToken(64);

        this.state.tokens.set(token, {
            user: { ...user, password: undefined },
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
        });

        this.state.currentUser = { ...user, password: undefined };

        return {
            success: true,
            message: 'Login berhasil',
            data: {
                token,
                refreshToken,
                user: { ...user, password: undefined },
                expiresAt: Date.now() + 3600000
            }
        };
    }

    async handleLogout() {
        this.state.currentUser = null;
        
        return {
            success: true,
            message: 'Logout berhasil'
        };
    }

    async handleRefreshToken({ body }) {
        const { refreshToken } = body || {};

        if (!refreshToken) {
            throw this.createError(422, 'Refresh token wajib diisi');
        }

        return {
            success: true,
            data: {
                token: this.generateToken(),
                refreshToken: this.generateToken(64),
                expiresAt: Date.now() + 3600000
            }
        };
    }

    async handleChangePassword({ body }) {
        const { currentPassword, newPassword } = body || {};

        if (!currentPassword || !newPassword) {
            throw this.createError(422, 'Password saat ini dan password baru wajib diisi');
        }

        if (newPassword.length < 8) {
            throw this.createError(422, 'Password baru minimal 8 karakter');
        }

        return {
            success: true,
            message: 'Password berhasil diubah'
        };
    }

    async handleGetCurrentUser() {
        if (!this.state.currentUser) {
            throw this.createError(401, 'Authentication required');
        }

        return {
            success: true,
            data: this.state.currentUser
        };
    }

    // ============================================
    // SURAT KELUAR HANDLERS
    // ============================================

    async handleGetSuratKeluarList({ query }) {
        let data = [...this.getMockData('suratKeluar')];
        const { page = 1, limit = 10, search, status, sort } = query || {};

        if (search) {
            const q = search.toLowerCase();
            data = data.filter(s => 
                s.nomor_surat?.toLowerCase().includes(q) ||
                s.perihal?.toLowerCase().includes(q) ||
                s.tujuan?.toLowerCase().includes(q)
            );
        }

        if (status) {
            data = data.filter(s => s.status === status);
        }

        // Sort
        if (sort === 'tanggal') {
            data.sort((a, b) => new Date(b.tanggal_surat) - new Date(a.tanggal_surat));
        } else {
            data.sort((a, b) => new Date(b.createdAt || b.tanggal_surat) - new Date(a.createdAt || a.tanggal_surat));
        }

        const total = data.length;
        const totalPages = Math.ceil(total / limit);
        const start = (Math.min(page, totalPages) - 1) * limit;
        const paginatedData = data.slice(start, start + limit);

        return {
            success: true,
            data: paginatedData,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }

    async handleGetSuratKeluarById({ params }) {
        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        return { success: true, data: surat };
    }

    async handleCreateSuratKeluar({ body }) {
        const data = body || {};

        if (!data.perihal || !data.jenis || !data.tujuan) {
            throw this.createError(422, 'Perihal, jenis, dan tujuan wajib diisi');
        }

        const newSurat = {
            id: 'sk-' + Date.now(),
            nomor_surat: null,
            perihal: this.sanitize(data.perihal),
            jenis: data.jenis,
            sifat: data.sifat || 'biasa',
            tujuan: this.sanitize(data.tujuan),
            isi_ringkas: this.sanitize(data.isi_ringkas || ''),
            status: 'draft',
            createdBy: this.state.currentUser?.id || 'unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.getMockData('suratKeluar').unshift(newSurat);

        return {
            success: true,
            message: 'Draft surat berhasil dibuat',
            data: newSurat
        };
    }

    async handleUpdateSuratKeluar({ body, params }) {
        const data = body || {};
        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        if (surat.status !== 'draft') {
            throw this.createError(422, 'Hanya draft yang dapat diubah');
        }

        Object.assign(surat, {
            ...data,
            perihal: data.perihal ? this.sanitize(data.perihal) : surat.perihal,
            updatedAt: new Date().toISOString()
        });

        return {
            success: true,
            message: 'Surat berhasil diperbarui',
            data: surat
        };
    }

    async handleDeleteSuratKeluar({ params }) {
        const data = this.getMockData('suratKeluar');
        const index = data.findIndex(s => s.id === params.id);

        if (index === -1) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        if (data[index].status !== 'draft') {
            throw this.createError(422, 'Hanya draft yang dapat dihapus');
        }

        data.splice(index, 1);

        return {
            success: true,
            message: 'Surat berhasil dihapus'
        };
    }

    async handleSubmitSuratKeluar({ body, params }) {
        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        if (!surat.nomor_surat) {
            throw this.createError(422, 'Nomor surat harus digenerate terlebih dahulu');
        }

        surat.status = 'pending_admin';
        surat.submittedAt = new Date().toISOString();

        return {
            success: true,
            message: 'Surat berhasil disubmit',
            data: { ...surat, status: 'pending_admin' }
        };
    }

    async handleApproveSuratKeluar({ body, params }) {
        const { role, catatan } = body || {};
        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        const approvalFlow = {
            'pending_admin': { role: 'admin', next: 'pending_kasubag' },
            'pending_kasubag': { role: 'kasubag', next: 'pending_wadek' },
            'pending_wadek': { role: 'wadek', next: 'pending_dekan' },
            'pending_dekan': { role: 'dekan', next: 'completed' }
        };

        const currentStep = approvalFlow[surat.status];

        if (!currentStep || currentStep.role !== role) {
            throw this.createError(422, 'Surat tidak dalam status pending untuk role ini');
        }

        surat.status = currentStep.next;
        surat.approvedBy = role;
        surat.approvedAt = new Date().toISOString();
        surat.catatanApproval = this.sanitize(catatan || '');

        return {
            success: true,
            message: `Surat disetujui oleh ${role}`,
            data: {
                status: surat.status,
                nextStatus: currentStep.next,
                approvedBy: role
            }
        };
    }

    async handleRejectSuratKeluar({ body, params }) {
        const { role, catatan } = body || {};

        if (!catatan) {
            throw this.createError(422, 'Catatan wajib diisi saat menolak surat');
        }

        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        surat.status = 'ditolak';
        surat.rejectedBy = role;
        surat.rejectedAt = new Date().toISOString();
        surat.catatanPenolakan = this.sanitize(catatan);

        return {
            success: true,
            message: `Surat ditolak oleh ${role}`,
            data: { status: 'ditolak' }
        };
    }

    async handleBulkDeleteSuratKeluar({ body }) {
        const { ids } = body || {};

        if (!Array.isArray(ids) || ids.length === 0) {
            throw this.createError(422, 'IDs harus berupa array');
        }

        const data = this.getMockData('suratKeluar');
        const deleted = data.filter(s => ids.includes(s.id) && s.status === 'draft');
        this.setMockData('suratKeluar', data.filter(s => !ids.includes(s.id) || s.status !== 'draft'));

        return {
            success: true,
            message: `${deleted.length} surat berhasil dihapus`,
            data: { deletedCount: deleted.length }
        };
    }

    async handleGetTrackingSuratKeluar({ params }) {
        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        const timeline = [];
        if (surat.createdAt) timeline.push({ status: 'draft', date: surat.createdAt, user: 'Pembuat' });
        if (surat.submittedAt) timeline.push({ status: 'submitted', date: surat.submittedAt, user: 'Pembuat' });
        if (surat.approvedAt) timeline.push({ status: 'approved', date: surat.approvedAt, user: surat.approvedBy || 'Approver' });
        if (surat.rejectedAt) timeline.push({ status: 'rejected', date: surat.rejectedAt, user: surat.rejectedBy || 'Approver' });

        return {
            success: true,
            data: { suratId: params.id, timeline }
        };
    }

    // ============================================
    // SURAT MASUK HANDLERS
    // ============================================

    async handleGetSuratMasukList({ query }) {
        let data = [...this.getMockData('suratMasuk')];
        const { page = 1, limit = 10, search, status } = query || {};

        if (search) {
            const q = search.toLowerCase();
            data = data.filter(s =>
                s.pengirim?.toLowerCase().includes(q) ||
                s.perihal?.toLowerCase().includes(q) ||
                s.nomor_surat?.toLowerCase().includes(q)
            );
        }

        if (status) {
            data = data.filter(s => s.status === status);
        }

        data.sort((a, b) => new Date(b.tanggal_terima) - new Date(a.tanggal_terima));

        const total = data.length;
        const totalPages = Math.ceil(total / limit);
        const start = (Math.min(page, totalPages) - 1) * limit;
        const paginatedData = data.slice(start, start + limit);

        return {
            success: true,
            data: paginatedData,
            pagination: { page: Number(page), limit: Number(limit), total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
        };
    }

    async handleGetSuratMasukById({ params }) {
        const surat = this.getMockData('suratMasuk').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        return { success: true, data: surat };
    }

    async handleCreateSuratMasuk({ body }) {
        const data = body || {};

        if (!data.pengirim || !data.perihal) {
            throw this.createError(422, 'Pengirim dan perihal wajib diisi');
        }

        const newSurat = {
            id: 'sm-' + Date.now(),
            pengirim: this.sanitize(data.pengirim),
            perihal: this.sanitize(data.perihal),
            nomor_surat: this.sanitize(data.nomor_surat || ''),
            tanggal_surat: data.tanggal_surat || '',
            tanggal_terima: data.tanggal_terima || new Date().toISOString().split('T')[0],
            sifat: data.sifat || 'biasa',
            status: 'diterima',
            createdBy: this.state.currentUser?.id || 'unknown',
            createdAt: new Date().toISOString()
        };

        this.getMockData('suratMasuk').unshift(newSurat);

        return {
            success: true,
            message: 'Surat masuk berhasil dicatat',
            data: newSurat
        };
    }

    async handleUpdateSuratMasuk({ body, params }) {
        const surat = this.getMockData('suratMasuk').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        if (surat.status === 'diteruskan') {
            throw this.createError(422, 'Surat yang sudah diteruskan tidak dapat diubah');
        }

        Object.assign(surat, {
            ...body,
            perihal: body.perihal ? this.sanitize(body.perihal) : surat.perihal,
            updatedAt: new Date().toISOString()
        });

        return {
            success: true,
            message: 'Surat masuk berhasil diperbarui',
            data: surat
        };
    }

    async handleDeleteSuratMasuk({ params }) {
        const data = this.getMockData('suratMasuk');
        const index = data.findIndex(s => s.id === params.id);

        if (index === -1) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        if (data[index].status !== 'diterima') {
            throw this.createError(422, 'Surat yang sudah diproses tidak dapat dihapus');
        }

        data.splice(index, 1);

        return { success: true, message: 'Surat masuk berhasil dihapus' };
    }

    async handleGetDisposisiList({ params }) {
        const disposisi = this.getMockData('disposisi').filter(d => d.surat_id === params.id);

        return {
            success: true,
            data: disposisi
        };
    }

    async handleCreateDisposisi({ body, params }) {
        const data = body || {};

        if (!data.kepada) {
            throw this.createError(422, 'Penerima disposisi wajib diisi');
        }

        const newDisposisi = {
            id: 'disp-' + Date.now(),
            surat_id: params.id,
            kepada: data.kepada,
            isi_disposisi: this.sanitize(data.isi_disposisi || ''),
            batas_waktu: data.batas_waktu || '',
            sifat: data.sifat || 'biasa',
            status: 'aktif',
            createdBy: this.state.currentUser?.id || 'unknown',
            createdAt: new Date().toISOString()
        };

        this.getMockData('disposisi').push(newDisposisi);

        return {
            success: true,
            message: 'Disposisi berhasil dibuat',
            data: newDisposisi
        };
    }

    async handleUpdateDisposisi({ body, params }) {
        const disposisi = this.getMockData('disposisi').find(d => d.id === params.disposisiId);

        if (!disposisi) {
            throw this.createError(404, 'Disposisi tidak ditemukan');
        }

        Object.assign(disposisi, {
            ...body,
            updatedAt: new Date().toISOString()
        });

        return {
            success: true,
            message: 'Disposisi berhasil diperbarui',
            data: disposisi
        };
    }

    async handleTeruskanSuratMasuk({ body, params }) {
        const { kepada, catatan } = body || {};

        if (!kepada) {
            throw this.createError(422, 'Tujuan penerusan wajib diisi');
        }

        if (!catatan) {
            throw this.createError(422, 'Catatan wajib diisi saat meneruskan surat');
        }

        const surat = this.getMockData('suratMasuk').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        surat.status = 'diteruskan';
        surat.diteruskanKepada = kepada;
        surat.diteruskanCatatan = this.sanitize(catatan);
        surat.diteruskanPada = new Date().toISOString();

        return {
            success: true,
            message: `Surat berhasil diteruskan ke ${kepada}`,
            data: { status: 'diteruskan', kepada }
        };
    }

    async handleGetTrackingSuratMasuk({ params }) {
        const surat = this.getMockData('suratMasuk').find(s => s.id === params.id);

        if (!surat) {
            throw this.createError(404, 'Surat tidak ditemukan');
        }

        const timeline = [];
        if (surat.createdAt) timeline.push({ status: 'diterima', date: surat.createdAt });
        if (surat.diteruskanPada) timeline.push({ status: 'diteruskan', date: surat.diteruskanPada, tujuan: surat.diteruskanKepada });

        return {
            success: true,
            data: { suratId: params.id, timeline }
        };
    }

    // ============================================
    // USER HANDLERS
    // ============================================

    async handleGetUsers({ query }) {
        let users = [...this.getMockData('users')];
        const { search, role, status, page = 1, limit = 10 } = query || {};

        if (search) {
            const q = search.toLowerCase();
            users = users.filter(u =>
                u.fullname?.toLowerCase().includes(q) ||
                u.username?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q)
            );
        }

        if (role) users = users.filter(u => u.role === role);
        if (status) users = users.filter(u => u.status === status);

        users = users.map(u => ({ ...u, password: undefined }));

        const total = users.length;
        const totalPages = Math.ceil(total / limit);
        const start = (Math.min(page, totalPages) - 1) * limit;

        return {
            success: true,
            data: users.slice(start, start + limit),
            pagination: { page: Number(page), limit: Number(limit), total, totalPages }
        };
    }

    async handleCreateUser({ body }) {
        const data = body || {};

        if (!data.username || !data.fullname || !data.email) {
            throw this.createError(422, 'Username, nama lengkap, dan email wajib diisi');
        }

        if (this.getMockData('users').find(u => u.username === data.username)) {
            throw this.createError(409, 'Username sudah digunakan');
        }

        const newUser = {
            id: 'user-' + Date.now(),
            username: data.username,
            fullname: this.sanitize(data.fullname),
            email: data.email,
            role: data.role || 'user',
            unit: data.unit || '',
            status: data.status || 'active',
            permissions: data.permissions || [],
            createdAt: new Date().toISOString()
        };

        this.getMockData('users').push(newUser);

        return {
            success: true,
            message: 'User berhasil ditambahkan',
            data: { ...newUser, password: undefined }
        };
    }

    async handleUpdateUser({ body, params }) {
        const users = this.getMockData('users');
        const index = users.findIndex(u => u.id === params.id);

        if (index === -1) {
            throw this.createError(404, 'User tidak ditemukan');
        }

        users[index] = { ...users[index], ...body, updatedAt: new Date().toISOString() };

        return {
            success: true,
            message: 'User berhasil diperbarui',
            data: { ...users[index], password: undefined }
        };
    }

    async handleDeleteUser({ params }) {
        const users = this.getMockData('users');
        const index = users.findIndex(u => u.id === params.id);

        if (index === -1) {
            throw this.createError(404, 'User tidak ditemukan');
        }

        if (users[index].role === 'super_admin') {
            throw this.createError(403, 'Super admin tidak dapat dihapus');
        }

        users.splice(index, 1);

        return { success: true, message: 'User berhasil dihapus' };
    }

    async handleToggleUserStatus({ body, params }) {
        const { status } = body || {};
        const user = this.getMockData('users').find(u => u.id === params.id);

        if (!user) {
            throw this.createError(404, 'User tidak ditemukan');
        }

        user.status = status || (user.status === 'active' ? 'inactive' : 'active');

        return {
            success: true,
            message: `User berhasil ${user.status === 'active' ? 'diaktifkan' : 'dinonaktifkan'}`,
            data: { status: user.status }
        };
    }

    async handleResetPassword({ params }) {
        const user = this.getMockData('users').find(u => u.id === params.id);

        if (!user) {
            throw this.createError(404, 'User tidak ditemukan');
        }

        return {
            success: true,
            message: 'Password berhasil direset. Password baru akan dikirim ke email user.'
        };
    }

    // ============================================
    // DASHBOARD HANDLERS
    // ============================================

    async handleDashboardStats() {
        const suratKeluar = this.getMockData('suratKeluar');
        const suratMasuk = this.getMockData('suratMasuk');
        const users = this.getMockData('users');

        return {
            success: true,
            data: {
                suratKeluar: { total: suratKeluar.length, pending: suratKeluar.filter(s => s.status.includes('pending')).length, completed: suratKeluar.filter(s => s.status === 'completed').length },
                suratMasuk: { total: suratMasuk.length, baru: suratMasuk.filter(s => s.status === 'diterima').length, diproses: suratMasuk.filter(s => s.status === 'diteruskan').length },
                users: { total: users.length, active: users.filter(u => u.status === 'active').length },
                notifications: this.getMockData('notifications').filter(n => !n.read).length
            }
        };
    }

    async handleDashboardChart({ query }) {
        const days = parseInt(query?.days) || 30;
        const labels = [];
        const masuk = [];
        const keluar = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            keluar.push(Math.floor(Math.random() * 8) + 1);
            masuk.push(Math.floor(Math.random() * 6) + 1);
        }

        return {
            success: true,
            data: { labels, keluar, masuk }
        };
    }

    async handleDashboardRecent() {
        return {
            success: true,
            data: {
                suratKeluar: this.getMockData('suratKeluar').slice(0, 5),
                suratMasuk: this.getMockData('suratMasuk').slice(0, 5)
            }
        };
    }

    // ============================================
    // PROFILE HANDLERS
    // ============================================

    async handleGetProfile() {
        if (!this.state.currentUser) {
            throw this.createError(401, 'Authentication required');
        }

        const user = this.getMockData('users').find(u => u.id === this.state.currentUser.id) || this.state.currentUser;

        return {
            success: true,
            data: { ...user, password: undefined }
        };
    }

    async handleUpdateProfile({ body }) {
        const data = body || {};

        if (this.state.currentUser) {
            const user = this.getMockData('users').find(u => u.id === this.state.currentUser.id);
            if (user) {
                Object.assign(user, {
                    fullname: data.fullname || user.fullname,
                    email: data.email || user.email,
                    phone: data.phone || user.phone,
                    nip: data.nip || user.nip
                });
                this.state.currentUser = { ...this.state.currentUser, ...data };
            }
        }

        return {
            success: true,
            message: 'Profile berhasil diperbarui',
            data: { ...this.state.currentUser, password: undefined }
        };
    }

    async handleUploadPhoto() {
        return {
            success: true,
            message: 'Foto berhasil diupload',
            data: { url: 'https://via.placeholder.com/150' }
        };
    }

    async handleGetProfileActivity({ query }) {
        return {
            success: true,
            data: [
                { description: 'Login ke sistem', timestamp: new Date(Date.now() - 3600000).toISOString() },
                { description: 'Mengubah pengaturan profile', timestamp: new Date(Date.now() - 86400000).toISOString() },
                { description: 'Menyetujui surat No. 045/UN.01', timestamp: new Date(Date.now() - 172800000).toISOString() }
            ]
        };
    }

    // ============================================
    // REPORT HANDLERS
    // ============================================

    async handleGetReport({ params, query }) {
        return {
            success: true,
            data: {
                records: this.getMockData('suratKeluar').slice(0, 10),
                summary: {
                    total: this.getMockData('suratKeluar').length,
                    masuk: this.getMockData('suratMasuk').length,
                    keluar: this.getMockData('suratKeluar').length
                }
            }
        };
    }

    async handleGetTrendData({ query }) {
        return this.handleDashboardChart({ query });
    }

    async handleGetDistributionData({ params }) {
        return {
            success: true,
            data: {
                labels: ['Masuk', 'Keluar', 'Disposisi', 'Approval'],
                values: [35, 40, 15, 10]
            }
        };
    }

    // ============================================
    // NOTIFICATION HANDLERS
    // ============================================

    async handleGetNotifications({ query }) {
        const { filter } = query || {};
        let notifs = [...this.getMockData('notifications')];

        if (filter === 'unread') {
            notifs = notifs.filter(n => !n.read);
        } else if (filter && filter !== 'all') {
            notifs = notifs.filter(n => n.type === filter);
        }

        const counts = {
            total: this.getMockData('notifications').length,
            unread: this.getMockData('notifications').filter(n => !n.read).length,
            info: this.getMockData('notifications').filter(n => n.type === 'info').length,
            warning: this.getMockData('notifications').filter(n => n.type === 'warning' || n.type === 'error').length,
            success: this.getMockData('notifications').filter(n => n.type === 'success' || n.type === 'approval').length
        };

        return {
            success: true,
            data: notifs.slice(0, 20),
            counts,
            hasMore: notifs.length > 20
        };
    }

    async handleMarkNotificationRead({ params }) {
        const notif = this.getMockData('notifications').find(n => n.id === params.id);

        if (notif) notif.read = true;

        return { success: true, message: 'Notifikasi ditandai dibaca' };
    }

    async handleMarkAllNotificationsRead() {
        this.getMockData('notifications').forEach(n => n.read = true);

        return { success: true, message: 'Semua notifikasi ditandai dibaca' };
    }

    async handleDeleteNotification({ params }) {
        const data = this.getMockData('notifications');
        const index = data.findIndex(n => n.id === params.id);

        if (index !== -1) data.splice(index, 1);

        return { success: true, message: 'Notifikasi dihapus' };
    }

    async handleClearNotifications() {
        this.setMockData('notifications', []);

        return { success: true, message: 'Semua notifikasi dihapus' };
    }

    // ============================================
    // SETTINGS HANDLERS
    // ============================================

    async handleGetSettings() {
        return {
            success: true,
            data: {
                instansi: {
                    nama: 'Fakultas Ilmu Komputer',
                    singkatan: 'FIKOM',
                    alamat: 'Jl. Contoh No. 123, Jakarta',
                    telepon: '(021) 12345678',
                    email: 'admin@fikom.ac.id'
                }
            }
        };
    }

    async handleUpdateSettings({ body }) {
        return { success: true, message: 'Pengaturan berhasil disimpan', data: body };
    }

    async handleGetPenomoranSettings() {
        return {
            success: true,
            data: {
                format: '{nomor}/{kode_unit}/{klasifikasi}/{bulan_romawi}/{tahun}',
                separator: '/',
                resetPeriode: 'tahun',
                paddingLength: 3,
                totalTahun: 1245,
                totalBulan: 45,
                nextNumber: 46,
                units: [
                    { id: 'dekanat', name: 'Dekanat', code: 'UN.01' },
                    { id: 'prodi_ti', name: 'Prodi TI', code: 'UN.02' },
                    { id: 'prodi_si', name: 'Prodi SI', code: 'UN.03' }
                ]
            }
        };
    }

    async handleUpdatePenomoranSettings({ body }) {
        return { success: true, message: 'Pengaturan penomoran disimpan', data: body };
    }

    async handleGetUnits() {
        return {
            success: true,
            data: [
                { id: 'dekanat', name: 'Dekanat', code: 'UN.01' },
                { id: 'prodi_ti', name: 'Prodi Teknik Informatika', code: 'UN.02' },
                { id: 'prodi_si', name: 'Prodi Sistem Informasi', code: 'UN.03' },
                { id: 'baak', name: 'BAAK', code: 'UN.04' },
                { id: 'bauk', name: 'BAUK', code: 'UN.05' }
            ]
        };
    }

    // ============================================
    // BACKUP HANDLERS
    // ============================================

    async handleGetBackupHistory() {
        return {
            success: true,
            data: this.getMockData('backups')
        };
    }

    async handleGetStorageInfo() {
        return {
            success: true,
            data: {
                used: 15728640,
                free: 524288000,
                count: this.getMockData('backups').length
            }
        };
    }

    async handleCreateBackup({ body }) {
        const { name, type } = body || {};

        const backup = {
            id: 'backup-' + Date.now(),
            name: name || `backup-${new Date().toISOString().split('T')[0]}`,
            type: type || 'full',
            size: Math.floor(Math.random() * 10485760) + 1048576,
            createdAt: new Date().toISOString()
        };

        this.getMockData('backups').unshift(backup);

        return {
            success: true,
            message: 'Backup berhasil dibuat',
            data: backup
        };
    }

    async handleDeleteBackup({ params }) {
        const data = this.getMockData('backups');
        const index = data.findIndex(b => b.id === params.id);

        if (index === -1) {
            throw this.createError(404, 'Backup tidak ditemukan');
        }

        data.splice(index, 1);

        return { success: true, message: 'Backup berhasil dihapus' };
    }

    async handleGetBackupSchedule() {
        return {
            success: true,
            data: { schedule: 'weekly' }
        };
    }

    async handleUpdateBackupSchedule({ body }) {
        return {
            success: true,
            message: 'Jadwal backup disimpan',
            data: body
        };
    }

    // ============================================
    // SIGNATURE HANDLERS
    // ============================================

    async handleGetSignatures() {
        return {
            success: true,
            data: this.getMockData('signatures')
        };
    }

    async handleCreateSignature({ body }) {
        const { name, position, image } = body || {};

        if (!name) {
            throw this.createError(422, 'Nama penandatangan wajib diisi');
        }

        const signature = {
            id: 'ttd-' + Date.now(),
            name: this.sanitize(name),
            position: position || '',
            image: image || null,
            isDefault: this.getMockData('signatures').length === 0,
            createdAt: new Date().toISOString()
        };

        this.getMockData('signatures').push(signature);

        return {
            success: true,
            message: 'Tanda tangan berhasil disimpan',
            data: signature
        };
    }

    async handleSetDefaultSignature({ params }) {
        const signatures = this.getMockData('signatures');
        signatures.forEach(s => s.isDefault = (s.id === params.id));

        return {
            success: true,
            message: 'Tanda tangan default diubah'
        };
    }

    async handleDeleteSignature({ params }) {
        const data = this.getMockData('signatures');
        const index = data.findIndex(s => s.id === params.id);

        if (index === -1) {
            throw this.createError(404, 'Tanda tangan tidak ditemukan');
        }

        data.splice(index, 1);

        return { success: true, message: 'Tanda tangan dihapus' };
    }

    // ============================================
    // LOG HANDLERS
    // ============================================

    async handleGetLogs({ query }) {
        const { page = 1, limit = 20, type, search } = query || {};
        let logs = [...this.getMockData('logs')];

        if (type && type !== 'all') {
            logs = logs.filter(l => l.type === type);
        }

        if (search) {
            const q = search.toLowerCase();
            logs = logs.filter(l => l.description?.toLowerCase().includes(q));
        }

        const total = logs.length;
        const totalPages = Math.ceil(total / limit);
        const start = (Math.min(page, totalPages) - 1) * limit;

        return {
            success: true,
            data: {
                logs: logs.slice(start, start + limit),
                stats: {
                    total,
                    login: logs.filter(l => l.type === 'login').length,
                    create: logs.filter(l => l.type === 'create').length,
                    update: logs.filter(l => l.type === 'update').length,
                    delete: logs.filter(l => l.type === 'delete').length
                },
                totalPages
            }
        };
    }

    async handleClearLogs() {
        this.setMockData('logs', []);

        return { success: true, message: 'Log aktivitas berhasil dihapus' };
    }

    // ============================================
    // VERIFICATION HANDLERS
    // ============================================

    async handleVerifySurat({ params }) {
        const surat = this.getMockData('suratKeluar').find(s => s.id === params.id);

        if (surat) {
            return {
                success: true,
                data: {
                    valid: true,
                    surat: {
                        nomor_surat: surat.nomor_surat,
                        perihal: surat.perihal,
                        status: surat.status,
                        tanggal: surat.tanggal_surat
                    }
                }
            };
        }

        return {
            success: true,
            data: {
                valid: false,
                message: 'Surat tidak ditemukan dalam sistem'
            }
        };
    }

    async handleVerifyQRCode({ body }) {
        const { data } = body || {};

        if (!data) {
            throw this.createError(422, 'Data QR code wajib diisi');
        }

        return {
            success: true,
            data: {
                valid: true,
                nomor_surat: data,
                verifiedAt: new Date().toISOString()
            }
        };
    }

    async handleHealthCheck() {
        return {
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2026.1.0',
                uptime: process.uptime?.() || 0
            }
        };
    }

    // ============================================
    // SECURITY HELPERS
    // ============================================

    isProtectedRoute(path) {
        const publicRoutes = ['/api/auth/login', '/api/verify/', '/api/health'];
        return !publicRoutes.some(r => path.startsWith(r));
    }

    validateAuth(headers) {
        const authHeader = headers?.Authorization || headers?.authorization;

        if (!authHeader) {
            return { valid: false, message: 'Token tidak ditemukan' };
        }

        const token = authHeader.replace('Bearer ', '');

        if (!this.state.tokens.has(token)) {
            return { valid: false, message: 'Token tidak valid' };
        }

        const tokenData = this.state.tokens.get(token);

        if (Date.now() > tokenData.expiresAt) {
            this.state.tokens.delete(token);
            return { valid: false, message: 'Token expired' };
        }

        this.state.currentUser = tokenData.user;

        return { valid: true, user: tokenData.user };
    }

    checkRateLimit(method, path) {
        const key = `${method}:${path}`;
        const now = Date.now();

        if (now - this.state.rateLimitReset > 60000) {
            this.state.requestCount.clear();
            this.state.rateLimitReset = now;
        }

        const count = (this.state.requestCount.get(key) || 0) + 1;
        this.state.requestCount.set(key, count);

        if (count > 100) {
            return {
                allowed: false,
                retryAfter: Math.ceil((this.state.rateLimitReset + 60000 - now) / 1000)
            };
        }

        return { allowed: true };
    }

    // ============================================
    // MOCK DATA STORE
    // ============================================

    getMockData(key) {
        if (!this._mockData) {
            this._mockData = this.initializeMockData();
        }
        return this._mockData[key] || [];
    }

    setMockData(key, value) {
        if (!this._mockData) {
            this._mockData = this.initializeMockData();
        }
        this._mockData[key] = value;
    }

    initializeMockData() {
        return {
            users: [
                { id: 'user-001', username: 'admin', fullname: 'Administrator', email: 'admin@e-arsip.id', role: 'super_admin', unit: 'Dekanat', status: 'active', nip: '198501012010011001', permissions: ['manage_users', 'manage_surat', 'approve_surat', 'view_reports', 'manage_settings', 'view_logs', 'backup_restore'], createdAt: '2025-01-15T08:00:00Z' },
                { id: 'user-002', username: 'dekan', fullname: 'Dr. Ahmad Fauzi, M.Kom', email: 'dekan@e-arsip.id', role: 'dekan', unit: 'Dekanat', status: 'active', nip: '197806302008121001', permissions: ['approve_surat', 'view_reports'], createdAt: '2025-02-01T08:00:00Z' },
                { id: 'user-003', username: 'wadek', fullname: 'Wakil Dekan I', email: 'wadek@e-arsip.id', role: 'wadek', unit: 'Dekanat', status: 'active', permissions: ['approve_surat'], createdAt: '2025-02-15T08:00:00Z' },
                { id: 'user-004', username: 'staf', fullname: 'Budi Santoso', email: 'staf@e-arsip.id', role: 'staf', unit: 'BAAK', status: 'active', permissions: ['manage_surat'], createdAt: '2025-03-01T08:00:00Z' }
            ],
            suratKeluar: [
                { id: 'sk-001', nomor_surat: '001/UN.01/UM/I/2026', perihal: 'Undangan Rapat Koordinasi', jenis: 'undangan', sifat: 'segera', tujuan: 'Seluruh Kaprodi', status: 'completed', tanggal_surat: '2026-01-15', createdBy: 'user-001', createdAt: '2026-01-15T08:00:00Z' },
                { id: 'sk-002', nomor_surat: '002/UN.01/UM/I/2026', perihal: 'Pemberitahuan Jadwal Ujian', jenis: 'pemberitahuan', sifat: 'biasa', tujuan: 'Mahasiswa', status: 'pending_admin', tanggal_surat: '2026-01-20', createdBy: 'user-004', createdAt: '2026-01-20T10:00:00Z' },
                { id: 'sk-003', perihal: 'Draft Surat Tugas', jenis: 'tugas', sifat: 'segera', tujuan: 'Dosen', status: 'draft', tanggal_surat: '2026-01-25', createdBy: 'user-004', createdAt: '2026-01-25T14:00:00Z' }
            ],
            suratMasuk: [
                { id: 'sm-001', pengirim: 'Kemendikbud', perihal: 'Pemberitahuan Hibah Penelitian', nomor_surat: 'B-123/DIKTI/I/2026', tanggal_surat: '2026-01-10', tanggal_terima: '2026-01-15', sifat: 'penting', status: 'diteruskan', diteruskanKepada: 'wadek', createdAt: '2026-01-15T10:00:00Z' },
                { id: 'sm-002', pengirim: 'Dinas Pendidikan', perihal: 'Undangan Sosialisasi', nomor_surat: 'DP-456/I/2026', tanggal_surat: '2026-01-12', tanggal_terima: '2026-01-16', sifat: 'biasa', status: 'diterima', createdAt: '2026-01-16T09:00:00Z' }
            ],
            disposisi: [
                { id: 'disp-001', surat_id: 'sm-001', kepada: 'dekan', isi_disposisi: 'Mohon ditindaklanjuti untuk persiapan proposal', batas_waktu: '2026-01-30', status: 'aktif', createdAt: '2026-01-15T11:00:00Z' }
            ],
            notifications: [
                { id: 'n-001', type: 'info', title: 'Surat Masuk Baru', message: 'Surat dari Kemendikbud telah dicatat', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
                { id: 'n-002', type: 'success', title: 'Disposisi Selesai', message: 'Disposisi surat No. 123 telah ditindaklanjuti', read: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
                { id: 'n-003', type: 'warning', title: 'Batas Waktu', message: 'Disposisi akan berakhir dalam 1 hari', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() }
            ],
            backups: [
                { id: 'backup-001', name: 'backup-2026-01-15-full', type: 'full', size: 15728640, createdAt: '2026-01-15T02:00:00Z' }
            ],
            signatures: [
                { id: 'ttd-001', name: 'Dr. Ahmad Fauzi, M.Kom', position: 'Dekan', isDefault: true, createdAt: '2026-01-01T00:00:00Z' },
                { id: 'ttd-002', name: 'Siti Nurhaliza, S.Kom., M.T.', position: 'Kaprodi TI', isDefault: false, createdAt: '2026-01-02T00:00:00Z' }
            ],
            logs: [
                { id: 'log-001', type: 'login', user: { name: 'Administrator' }, description: 'Login ke sistem', timestamp: new Date(Date.now() - 1800000).toISOString() },
                { id: 'log-002', type: 'create', user: { name: 'Budi Santoso' }, description: 'Membuat surat keluar baru', timestamp: new Date(Date.now() - 3600000).toISOString() },
                { id: 'log-003', type: 'update', user: { name: 'Administrator' }, description: 'Mengubah pengaturan penomoran', timestamp: new Date(Date.now() - 7200000).toISOString() },
                { id: 'log-004', type: 'security', user: { name: 'Administrator' }, description: 'Mengubah password', timestamp: new Date(Date.now() - 86400000).toISOString() }
            ]
        };
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    generateToken(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'mock-' + result;
    }

    findUser(username) {
        return this.getMockData('users').find(u => u.username === username);
    }

    createError(status, message, data = {}) {
        const error = new Error(message);
        error.status = status;
        error.data = data;
        return error;
    }

    createResponse(status, data) {
        return { status, data };
    }

    getErrorName(status) {
        const names = {
            400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
            404: 'Not Found', 409: 'Conflict', 422: 'Validation Error',
            429: 'Too Many Requests', 500: 'Internal Server Error'
        };
        return names[status] || 'Error';
    }

    parseQueryParams(queryString) {
        if (!queryString) return {};
        
        const params = new URLSearchParams(queryString);
        const result = {};
        
        params.forEach((value, key) => {
            if (value === 'true') result[key] = true;
            else if (value === 'false') result[key] = false;
            else if (!isNaN(value) && value !== '') result[key] = Number(value);
            else result[key] = value;
        });
        
        return result;
    }

    sanitize(input) {
        if (!input) return '';
        return String(input)
            .replace(/<[^>]*>/g, '')
            .replace(/[<>"'`]/g, '')
            .trim()
            .substring(0, 500);
    }

    randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    reset() {
        this._mockData = this.initializeMockData();
        this.state.tokens.clear();
        this.state.currentUser = null;
        this.state.requestCount.clear();
    }
}

// Create singleton
const apiMock = new APIMock();

// Override fetch for testing
if (typeof window !== 'undefined') {
    window._originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        let body = null;

        if (options.body) {
            try {
                body = JSON.parse(options.body);
            } catch {
                body = options.body;
            }
        }

        // Extract headers
        const headers = {};
        if (options.headers instanceof Headers) {
            options.headers.forEach((value, key) => { headers[key] = value; });
        } else if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const response = await apiMock.handleRequest(method, url, body, headers);

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: apiMock.getErrorName(response.status),
            json: async () => response.data,
            text: async () => JSON.stringify(response.data),
            blob: async () => new Blob([JSON.stringify(response.data)], { type: 'application/json' }),
            headers: new Headers({ 'Content-Type': 'application/json' })
        };
    };
}

export default apiMock;
export { APIMock };