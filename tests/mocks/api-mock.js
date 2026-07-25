// tests/mocks/api-mock.js - API Mock Service 2026
/**
 * E-Arsip Digital - API Mock for Testing
 * Version: 2026.1.0
 * Provides mock responses for all API endpoints
 */

import dataMock from './data-mock.js';

class APIMock {
    constructor() {
        this.delay = 200; // Simulated network delay
        this.errorRate = 0; // 0-1, probability of random errors
        this.routes = new Map();
        
        this.setupRoutes();
    }
    
    setupRoutes() {
        // Auth routes
        this.addRoute('POST', '/api/auth/login', this.handleLogin.bind(this));
        this.addRoute('POST', '/api/auth/logout', this.handleLogout.bind(this));
        this.addRoute('POST', '/api/auth/refresh', this.handleRefreshToken.bind(this));
        this.addRoute('POST', '/api/auth/change-password', this.handleChangePassword.bind(this));
        
        // Surat Keluar routes
        this.addRoute('GET', '/api/surat-keluar', this.handleGetSuratKeluar.bind(this));
        this.addRoute('GET', '/api/surat-keluar/:id', this.handleGetSuratById.bind(this));
        this.addRoute('POST', '/api/surat-keluar/create', this.handleCreateSurat.bind(this));
        this.addRoute('PUT', '/api/surat-keluar/:id', this.handleUpdateSurat.bind(this));
        this.addRoute('DELETE', '/api/surat-keluar/:id', this.handleDeleteSurat.bind(this));
        this.addRoute('POST', '/api/surat-keluar/:id/approve', this.handleApproveSurat.bind(this));
        this.addRoute('POST', '/api/surat-keluar/:id/reject', this.handleRejectSurat.bind(this));
        this.addRoute('POST', '/api/surat-keluar/bulk-delete', this.handleBulkDelete.bind(this));
        
        // Surat Masuk routes
        this.addRoute('GET', '/api/surat-masuk', this.handleGetSuratMasuk.bind(this));
        this.addRoute('POST', '/api/surat-masuk/create', this.handleCreateSuratMasuk.bind(this));
        this.addRoute('GET', '/api/surat-masuk/:id/disposisi', this.handleGetDisposisi.bind(this));
        this.addRoute('POST', '/api/surat-masuk/:id/disposisi', this.handleCreateDisposisi.bind(this));
        
        // User routes
        this.addRoute('GET', '/api/users', this.handleGetUsers.bind(this));
        this.addRoute('POST', '/api/users', this.handleCreateUser.bind(this));
        this.addRoute('PUT', '/api/users/:id', this.handleUpdateUser.bind(this));
        this.addRoute('DELETE', '/api/users/:id', this.handleDeleteUser.bind(this));
        
        // Dashboard routes
        this.addRoute('GET', '/api/dashboard/stats', this.handleDashboardStats.bind(this));
        this.addRoute('GET', '/api/dashboard/chart', this.handleDashboardChart.bind(this));
        
        // Profile routes
        this.addRoute('GET', '/api/profile', this.handleGetProfile.bind(this));
        this.addRoute('PUT', '/api/profile', this.handleUpdateProfile.bind(this));
        
        // Report routes
        this.addRoute('GET', '/api/reports/:type', this.handleGetReport.bind(this));
        
        // Notification routes
        this.addRoute('GET', '/api/notifications', this.handleGetNotifications.bind(this));
        this.addRoute('PATCH', '/api/notifications/:id/read', this.handleMarkRead.bind(this));
        this.addRoute('DELETE', '/api/notifications', this.handleClearNotifications.bind(this));
        
        // Settings routes
        this.addRoute('GET', '/api/settings/penomoran', this.handleGetPenomoranSettings.bind(this));
        this.addRoute('PUT', '/api/settings/penomoran', this.handleUpdatePenomoranSettings.bind(this));
        
        // Backup routes
        this.addRoute('GET', '/api/backup/history', this.handleGetBackupHistory.bind(this));
        this.addRoute('POST', '/api/backup/create', this.handleCreateBackup.bind(this));
        
        // Log routes
        this.addRoute('GET', '/api/logs', this.handleGetLogs.bind(this));
        this.addRoute('DELETE', '/api/logs', this.handleClearLogs.bind(this));
        
        // Verification routes
        this.addRoute('GET', '/api/verify/:id', this.handleVerifySurat.bind(this));
    }
    
    addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        this.routes.set(key, handler);
    }
    
    matchRoute(method, path) {
        // Exact match first
        const exactKey = `${method}:${path}`;
        if (this.routes.has(exactKey)) {
            return { handler: this.routes.get(exactKey), params: {} };
        }
        
        // Pattern match
        for (const [key, handler] of this.routes) {
            const [routeMethod, routePath] = key.split(':');
            
            if (routeMethod !== method) continue;
            
            const routeParts = routePath.split('/');
            const pathParts = path.split('/');
            
            if (routeParts.length !== pathParts.length) continue;
            
            const params = {};
            let match = true;
            
            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(':')) {
                    params[routeParts[i].substring(1)] = pathParts[i];
                } else if (routeParts[i] !== pathParts[i]) {
                    match = false;
                    break;
                }
            }
            
            if (match) {
                return { handler, params };
            }
        }
        
        return null;
    }
    
    async request(method, url, data = null) {
        // Simulate network delay
        await this.sleep(this.delay + Math.random() * 100);
        
        // Simulate random errors
        if (Math.random() < this.errorRate) {
            throw new Error('Simulated network error');
        }
        
        const match = this.matchRoute(method, url);
        
        if (!match) {
            return {
                status: 404,
                data: { error: 'Not Found', message: `Route ${method} ${url} not found` }
            };
        }
        
        try {
            const result = await match.handler(data, match.params);
            return {
                status: 200,
                data: result
            };
        } catch (error) {
            return {
                status: error.status || 500,
                data: { error: error.message }
            };
        }
    }
    
    // ============================================
    // AUTH HANDLERS
    // ============================================
    
    async handleLogin(data) {
        const { username, password } = data;
        
        const user = dataMock.users.find(u => u.username === username);
        
        if (!user || password !== 'password123') {
            throw { status: 401, message: 'Username atau password salah' };
        }
        
        return {
            token: 'mock-jwt-token-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now(),
            user: { ...user, password: undefined }
        };
    }
    
    async handleLogout() {
        return { success: true, message: 'Logout berhasil' };
    }
    
    async handleRefreshToken() {
        return {
            token: 'mock-jwt-token-refreshed-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now()
        };
    }
    
    async handleChangePassword() {
        return { success: true, message: 'Password berhasil diubah' };
    }
    
    // ============================================
    // SURAT KELUAR HANDLERS
    // ============================================
    
    async handleGetSuratKeluar(data) {
        let result = [...dataMock.suratKeluar];
        
        if (data?.status) {
            result = result.filter(s => s.status === data.status);
        }
        
        if (data?.search) {
            const search = data.search.toLowerCase();
            result = result.filter(s => 
                s.nomor_surat?.toLowerCase().includes(search) ||
                s.perihal?.toLowerCase().includes(search)
            );
        }
        
        const page = data?.page || 1;
        const limit = data?.limit || 10;
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            data: result.slice(start, end),
            total: result.length,
            page,
            totalPages: Math.ceil(result.length / limit)
        };
    }
    
    async handleGetSuratById(data, params) {
        const surat = dataMock.suratKeluar.find(s => s.id === params.id);
        if (!surat) throw { status: 404, message: 'Surat tidak ditemukan' };
        return surat;
    }
    
    async handleCreateSurat(data) {
        const newSurat = {
            id: 'sk-' + Date.now(),
            ...data,
            status: 'proses',
            createdAt: new Date().toISOString()
        };
        dataMock.suratKeluar.unshift(newSurat);
        return newSurat;
    }
    
    async handleUpdateSurat(data, params) {
        const index = dataMock.suratKeluar.findIndex(s => s.id === params.id);
        if (index === -1) throw { status: 404, message: 'Surat tidak ditemukan' };
        
        dataMock.suratKeluar[index] = { ...dataMock.suratKeluar[index], ...data };
        return dataMock.suratKeluar[index];
    }
    
    async handleDeleteSurat(data, params) {
        const index = dataMock.suratKeluar.findIndex(s => s.id === params.id);
        if (index === -1) throw { status: 404, message: 'Surat tidak ditemukan' };
        
        dataMock.suratKeluar.splice(index, 1);
        return { success: true };
    }
    
    async handleApproveSurat(data, params) {
        return this.handleUpdateSurat({ status: 'disetujui', ...data }, params);
    }
    
    async handleRejectSurat(data, params) {
        return this.handleUpdateSurat({ status: 'ditolak', ...data }, params);
    }
    
    async handleBulkDelete(data) {
        const ids = data?.ids || [];
        dataMock.suratKeluar = dataMock.suratKeluar.filter(s => !ids.includes(s.id));
        return { success: true, deletedCount: ids.length };
    }
    
    // ============================================
    // SURAT MASUK HANDLERS
    // ============================================
    
    async handleGetSuratMasuk(data) {
        let result = [...dataMock.suratMasuk];
        
        const page = data?.page || 1;
        const limit = data?.limit || 10;
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            data: result.slice(start, end),
            total: result.length,
            page,
            totalPages: Math.ceil(result.length / limit)
        };
    }
    
    async handleCreateSuratMasuk(data) {
        const newSurat = {
            id: 'sm-' + Date.now(),
            ...data,
            createdAt: new Date().toISOString()
        };
        dataMock.suratMasuk.unshift(newSurat);
        return newSurat;
    }
    
    async handleGetDisposisi(data, params) {
        return dataMock.disposisi.filter(d => d.surat_id === params.id);
    }
    
    async handleCreateDisposisi(data, params) {
        const newDisposisi = {
            id: 'disp-' + Date.now(),
            surat_id: params.id,
            ...data,
            status: 'proses',
            createdAt: new Date().toISOString()
        };
        dataMock.disposisi.push(newDisposisi);
        return newDisposisi;
    }
    
    // ============================================
    // USER HANDLERS
    // ============================================
    
    async handleGetUsers(data) {
        let result = [...dataMock.users];
        
        if (data?.search) {
            const search = data.search.toLowerCase();
            result = result.filter(u => 
                u.fullname?.toLowerCase().includes(search) ||
                u.username?.toLowerCase().includes(search)
            );
        }
        
        if (data?.role) {
            result = result.filter(u => u.role === data.role);
        }
        
        return {
            users: result,
            total: result.length
        };
    }
    
    async handleCreateUser(data) {
        const newUser = {
            id: 'user-' + Date.now(),
            ...data,
            createdAt: new Date().toISOString()
        };
        dataMock.users.push(newUser);
        return newUser;
    }
    
    async handleUpdateUser(data, params) {
        const index = dataMock.users.findIndex(u => u.id === params.id);
        if (index === -1) throw { status: 404, message: 'User tidak ditemukan' };
        
        dataMock.users[index] = { ...dataMock.users[index], ...data };
        return dataMock.users[index];
    }
    
    async handleDeleteUser(data, params) {
        const index = dataMock.users.findIndex(u => u.id === params.id);
        if (index === -1) throw { status: 404, message: 'User tidak ditemukan' };
        
        dataMock.users.splice(index, 1);
        return { success: true };
    }
    
    // ============================================
    // DASHBOARD HANDLERS
    // ============================================
    
    async handleDashboardStats() {
        return {
            suratKeluar: dataMock.suratKeluar.length,
            suratMasuk: dataMock.suratMasuk.length,
            totalUsers: dataMock.users.length,
            pendingApprovals: dataMock.suratKeluar.filter(s => s.status === 'proses').length
        };
    }
    
    async handleDashboardChart(data) {
        const days = data?.days || 30;
        const labels = [];
        const keluar = [];
        const masuk = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            keluar.push(Math.floor(Math.random() * 10) + 1);
            masuk.push(Math.floor(Math.random() * 8) + 1);
        }
        
        return { labels, keluar, masuk };
    }
    
    // ============================================
    // PROFILE HANDLERS
    // ============================================
    
    async handleGetProfile() {
        return dataMock.users[0];
    }
    
    async handleUpdateProfile(data) {
        dataMock.users[0] = { ...dataMock.users[0], ...data };
        return dataMock.users[0];
    }
    
    // ============================================
    // REPORT HANDLERS
    // ============================================
    
    async handleGetReport(data, params) {
        return {
            records: dataMock.suratKeluar.slice(0, 10),
            summary: {
                total: dataMock.suratKeluar.length,
                masuk: dataMock.suratMasuk.length,
                keluar: dataMock.suratKeluar.length,
                pending: 3
            }
        };
    }
    
    // ============================================
    // NOTIFICATION HANDLERS
    // ============================================
    
    async handleGetNotifications(data) {
        return {
            notifications: dataMock.notifications,
            counts: {
                total: dataMock.notifications.length,
                unread: dataMock.notifications.filter(n => !n.read).length,
                info: 2,
                warning: 1
            },
            hasMore: false
        };
    }
    
    async handleMarkRead(data, params) {
        const notif = dataMock.notifications.find(n => n.id === params.id);
        if (notif) notif.read = true;
        return { success: true };
    }
    
    async handleClearNotifications() {
        dataMock.notifications = [];
        return { success: true };
    }
    
    // ============================================
    // SETTINGS HANDLERS
    // ============================================
    
    async handleGetPenomoranSettings() {
        return {
            format: '{nomor}/{kode_unit}/{klasifikasi}/{bulan_romawi}/{tahun}',
            separator: '/',
            resetPeriode: 'tahun',
            totalTahun: 1245,
            totalBulan: 45,
            nextNumber: 46
        };
    }
    
    async handleUpdatePenomoranSettings(data) {
        return { success: true, ...data };
    }
    
    // ============================================
    // BACKUP HANDLERS
    // ============================================
    
    async handleGetBackupHistory() {
        return dataMock.backups;
    }
    
    async handleCreateBackup(data) {
        const backup = {
            id: 'backup-' + Date.now(),
            name: data?.name || `backup-${Date.now()}`,
            type: data?.type || 'full',
            size: 1048576,
            createdAt: new Date().toISOString()
        };
        dataMock.backups.unshift(backup);
        return backup;
    }
    
    // ============================================
    // LOG HANDLERS
    // ============================================
    
    async handleGetLogs(data) {
        return {
            logs: dataMock.logs,
            stats: {
                total: dataMock.logs.length,
                login: 3,
                create: 5,
                update: 4,
                delete: 1,
                security: 2
            },
            totalPages: 1
        };
    }
    
    async handleClearLogs() {
        dataMock.logs = [];
        return { success: true };
    }
    
    // ============================================
    // VERIFICATION HANDLERS
    // ============================================
    
    async handleVerifySurat(data, params) {
        const surat = dataMock.suratKeluar.find(s => s.id === params.id);
        
        if (surat) {
            return {
                valid: true,
                ...surat
            };
        }
        
        return {
            valid: false,
            message: 'Surat tidak ditemukan dalam sistem'
        };
    }
    
    // ============================================
    // UTILITY
    // ============================================
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create singleton
const apiMock = new APIMock();

// Override fetch for testing
window._originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    const method = options.method || 'GET';
    let body = null;
    
    if (options.body) {
        try {
            body = JSON.parse(options.body);
        } catch {
            body = options.body;
        }
    }
    
    const response = await apiMock.request(method, url, body);
    
    return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        json: async () => response.data,
        text: async () => JSON.stringify(response.data),
        blob: async () => new Blob([JSON.stringify(response.data)]),
        headers: new Headers({ 'Content-Type': 'application/json' })
    };
};

export default apiMock;
export { APIMock };
