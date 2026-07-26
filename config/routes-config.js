// config/routes-config.js - Routes Configuration 2026 (LENGKAP 16 ROLES)
/**
 * E-Arsip Digital - Routes Configuration
 * Version: 2026.1.0
 * 
 * Berisi definisi SEMUA route dengan:
 * - Role-based access control
 * - Metadata (title, breadcrumb, icon)
 * - PWA cache strategy
 * - Path RELATIF untuk GitHub Pages compatibility
 */

window.EArsip = window.EArsip || {};

window.EArsip.RoutesConfig = (function() {
    'use strict';
    
    // ============================================
    // ROLE CONSTANTS
    // ============================================
    var ROLES = {
        SUPER_ADMIN: 'super_admin',
        ADMIN: 'admin',
        KASUBAG: 'kasubag',
        KAPRODI: 'kaprodi',
        ADMIN_KAPRODI: 'admin_kaprodi',
        WADEK: 'wadek',
        ADMIN_WADEK: 'admin_wadek',
        DEKAN: 'dekan',
        ADMIN_DEKAN: 'admin_dekan',
        KETUA_UPM: 'ketua_upm',
        LITDIANMAS: 'litdianmas',
        STAF: 'staf',
        DOSEN: 'dosen',
        LEMBAGA_KEMAHASISWAAN: 'lembaga_kemahasiswaan',
        MAHASISWA: 'mahasiswa',
        USER: 'user'
    };
    
    // Role hierarchy (siapa yang bisa akses apa)
    var ROLE_HIERARCHY = {
        'super_admin': ['super_admin', 'admin', 'kasubag', 'kaprodi', 'wadek', 'dekan', 'staf', 'dosen', 'mahasiswa', 'user'],
        'admin': ['admin', 'kasubag', 'kaprodi', 'wadek', 'dekan', 'staf', 'dosen', 'mahasiswa', 'user'],
        'kasubag': ['kasubag'],
        'kaprodi': ['kaprodi'],
        'admin_kaprodi': ['admin_kaprodi', 'kaprodi'],
        'wadek': ['wadek'],
        'admin_wadek': ['admin_wadek', 'wadek'],
        'dekan': ['dekan'],
        'admin_dekan': ['admin_dekan', 'dekan'],
        'ketua_upm': ['ketua_upm'],
        'litdianmas': ['litdianmas'],
        'staf': ['staf'],
        'dosen': ['dosen'],
        'lembaga_kemahasiswaan': ['lembaga_kemahasiswaan'],
        'mahasiswa': ['mahasiswa'],
        'user': ['user']
    };
    
    // ============================================
    // CACHE STRATEGIES
    // ============================================
    var CACHE = {
        NETWORK_FIRST: 'network-first',
        CACHE_FIRST: 'cache-first',
        STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
        NETWORK_ONLY: 'network-only',
        CACHE_ONLY: 'cache-only'
    };
    
    // ============================================
    // ROUTE DEFINITIONS (Semua route)
    // ============================================
    var routes = [
        // ==========================================
        // PUBLIC ROUTES (No Auth Required)
        // ==========================================
        {
            path: '/',
            component: '../index.html',
            title: 'Beranda',
            breadcrumb: 'Beranda',
            cache: CACHE.NETWORK_FIRST,
            public: true
        },
        {
            path: '/login',
            component: '../login.html',
            title: 'Login',
            breadcrumb: 'Login',
            cache: CACHE.NETWORK_ONLY,
            public: true
        },
        {
            path: '/help',
            component: '../help/index.html',
            title: 'Bantuan',
            breadcrumb: 'Bantuan',
            cache: CACHE.NETWORK_FIRST,
            public: true
        },
        {
            path: '/offline',
            component: '../offline.html',
            title: 'Offline',
            cache: CACHE.CACHE_FIRST,
            public: true
        },
        
        // ==========================================
        // ERROR ROUTES
        // ==========================================
        {
            path: '/400',
            component: '../error/400.html',
            title: 'Bad Request',
            cache: CACHE.CACHE_FIRST,
            public: true
        },
        {
            path: '/401',
            component: '../error/401.html',
            title: 'Unauthorized',
            cache: CACHE.CACHE_FIRST,
            public: true
        },
        {
            path: '/403',
            component: '../error/403.html',
            title: 'Akses Ditolak',
            cache: CACHE.CACHE_FIRST,
            public: true
        },
        {
            path: '/404',
            component: '../error/404.html',
            title: 'Tidak Ditemukan',
            cache: CACHE.CACHE_FIRST,
            public: true
        },
        {
            path: '/500',
            component: '../error/500.html',
            title: 'Kesalahan Server',
            cache: CACHE.CACHE_FIRST,
            public: true
        },
        
        // ==========================================
        // DASHBOARD ROUTER
        // ==========================================
        {
            path: '/dashboard',
            component: '../dashboard/index.html',
            title: 'Dashboard Router',
            breadcrumb: 'Dashboard',
            cache: CACHE.NETWORK_ONLY,
            roles: Object.keys(ROLES)
        },
        
        // ==========================================
        // ROLE-BASED DASHBOARDS (16 Roles)
        // ==========================================
        {
            path: '/dashboard/super-admin',
            component: '../dashboard/super-admin/index.html',
            title: 'Dashboard Super Admin',
            breadcrumb: 'Super Admin',
            icon: 'shield-alt',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN]
        },
        {
            path: '/dashboard/admin',
            component: '../dashboard/admin/index.html',
            title: 'Dashboard Admin',
            breadcrumb: 'Admin',
            icon: 'user-shield',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN]
        },
        {
            path: '/dashboard/kasubag',
            component: '../dashboard/kasubag/index.html',
            title: 'Dashboard Kasubag',
            breadcrumb: 'Kasubag',
            icon: 'user-tie',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG]
        },
        {
            path: '/dashboard/kaprodi',
            component: '../dashboard/kaprodi/index.html',
            title: 'Dashboard Kaprodi',
            breadcrumb: 'Kaprodi',
            icon: 'user-graduate',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KAPRODI, ROLES.ADMIN_KAPRODI]
        },
        {
            path: '/dashboard/admin-kaprodi',
            component: '../dashboard/admin-kaprodi/index.html',
            title: 'Dashboard Admin Kaprodi',
            breadcrumb: 'Admin Kaprodi',
            icon: 'user-cog',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_KAPRODI]
        },
        {
            path: '/dashboard/wadek',
            component: '../dashboard/wadek/index.html',
            title: 'Dashboard Wakil Dekan',
            breadcrumb: 'Wakil Dekan',
            icon: 'user-tie',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WADEK, ROLES.ADMIN_WADEK]
        },
        {
            path: '/dashboard/admin-wadek',
            component: '../dashboard/admin-wadek/index.html',
            title: 'Dashboard Admin Wadek',
            breadcrumb: 'Admin Wadek',
            icon: 'user-cog',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_WADEK]
        },
        {
            path: '/dashboard/dekan',
            component: '../dashboard/dekan/index.html',
            title: 'Dashboard Dekan',
            breadcrumb: 'Dekan',
            icon: 'crown',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DEKAN, ROLES.ADMIN_DEKAN]
        },
        {
            path: '/dashboard/admin-dekan',
            component: '../dashboard/admin-dekan/index.html',
            title: 'Dashboard Admin Dekan',
            breadcrumb: 'Admin Dekan',
            icon: 'user-cog',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_DEKAN]
        },
        {
            path: '/dashboard/ketua-upm',
            component: '../dashboard/ketua-upm/index.html',
            title: 'Dashboard Ketua UPM',
            breadcrumb: 'Ketua UPM',
            icon: 'clipboard-check',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KETUA_UPM]
        },
        {
            path: '/dashboard/litdianmas',
            component: '../dashboard/litdianmas/index.html',
            title: 'Dashboard Litdianmas',
            breadcrumb: 'Litdianmas',
            icon: 'flask',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.LITDIANMAS]
        },
        {
            path: '/dashboard/staf',
            component: '../dashboard/staf/index.html',
            title: 'Dashboard Staf',
            breadcrumb: 'Staf',
            icon: 'user',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAF]
        },
        {
            path: '/dashboard/dosen',
            component: '../dashboard/dosen/index.html',
            title: 'Dashboard Dosen',
            breadcrumb: 'Dosen',
            icon: 'chalkboard-teacher',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOSEN]
        },
        {
            path: '/dashboard/lembaga-kemahasiswaan',
            component: '../dashboard/lembaga-kemahasiswaan/index.html',
            title: 'Dashboard Lembaga Kemahasiswaan',
            breadcrumb: 'Lembaga Kemahasiswaan',
            icon: 'users',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.LEMBAGA_KEMAHASISWAAN]
        },
        {
            path: '/dashboard/mahasiswa',
            component: '../dashboard/mahasiswa/index.html',
            title: 'Dashboard Mahasiswa',
            breadcrumb: 'Mahasiswa',
            icon: 'user-graduate',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAHASISWA]
        },
        {
            path: '/dashboard/user',
            component: '../dashboard/user/index.html',
            title: 'Dashboard User',
            breadcrumb: 'User',
            icon: 'user',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        
        // ==========================================
        // AUTHENTICATED ROUTES (Common)
        // ==========================================
        {
            path: '/profile',
            component: '../profile/index.html',
            title: 'Profil Saya',
            breadcrumb: 'Profil',
            icon: 'user',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/notifikasi',
            component: '../notifikasi/index.html',
            title: 'Notifikasi',
            breadcrumb: 'Notifikasi',
            icon: 'bell',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        
        // ==========================================
        // SURAT KELUAR ROUTES
        // ==========================================
        {
            path: '/surat-keluar',
            component: '../surat-keluar/list.html',
            title: 'Daftar Surat Keluar',
            breadcrumb: 'Surat Keluar',
            icon: 'paper-plane',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/surat-keluar/form',
            component: '../surat-keluar/form.html',
            title: 'Buat Surat Keluar',
            breadcrumb: 'Buat Surat',
            icon: 'plus',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/surat-keluar/draft',
            component: '../surat-keluar/draft.html',
            title: 'Draft Surat',
            breadcrumb: 'Draft',
            icon: 'file-alt',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/surat-keluar/preview',
            component: '../surat-keluar/preview.html',
            title: 'Preview Surat',
            breadcrumb: 'Preview',
            icon: 'eye',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/surat-keluar/approval',
            component: '../surat-keluar/approval.html',
            title: 'Tracking Approval',
            breadcrumb: 'Approval',
            icon: 'check-double',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG, ROLES.KAPRODI, ROLES.WADEK, ROLES.DEKAN]
        },
        {
            path: '/surat-keluar/generate',
            component: '../surat-keluar/generate.html',
            title: 'Generate Surat Final',
            breadcrumb: 'Generate',
            icon: 'cog',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG]
        },
        {
            path: '/surat-keluar/qrcode',
            component: '../surat-keluar/qrcode.html',
            title: 'Verifikasi QR Code',
            breadcrumb: 'QR Code',
            icon: 'qrcode',
            cache: CACHE.CACHE_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/surat-keluar/verify',
            component: '../surat-keluar/verify.html',
            title: 'Verifikasi Surat',
            breadcrumb: 'Verifikasi',
            icon: 'shield-alt',
            cache: CACHE.NETWORK_FIRST,
            public: true  // Public untuk verifikasi
        },
        
        // ==========================================
        // SURAT MASUK ROUTES
        // ==========================================
        {
            path: '/surat-masuk',
            component: '../surat-masuk/list.html',
            title: 'Daftar Surat Masuk',
            breadcrumb: 'Surat Masuk',
            icon: 'inbox',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        {
            path: '/surat-masuk/form',
            component: '../surat-masuk/form.html',
            title: 'Input Surat Masuk',
            breadcrumb: 'Input Surat',
            icon: 'plus',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG, ROLES.STAF]
        },
        {
            path: '/surat-masuk/disposisi',
            component: '../surat-masuk/disposisi.html',
            title: 'Disposisi Surat',
            breadcrumb: 'Disposisi',
            icon: 'clipboard-list',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG, ROLES.KAPRODI, ROLES.WADEK, ROLES.DEKAN]
        },
        {
            path: '/surat-masuk/disposisi-cetak',
            component: '../surat-masuk/disposisi-cetak.html',
            title: 'Cetak Disposisi',
            breadcrumb: 'Cetak Disposisi',
            icon: 'print',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG]
        },
        {
            path: '/surat-masuk/agenda',
            component: '../surat-masuk/agenda.html',
            title: 'Agenda Surat Masuk',
            breadcrumb: 'Agenda',
            icon: 'calendar-alt',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG, ROLES.STAF]
        },
        {
            path: '/surat-masuk/buku-agenda',
            component: '../surat-masuk/buku-agenda.html',
            title: 'Buku Agenda',
            breadcrumb: 'Buku Agenda',
            icon: 'book',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG]
        },
        {
            path: '/surat-masuk/tracking',
            component: '../surat-masuk/tracking.html',
            title: 'Tracking Surat Masuk',
            breadcrumb: 'Tracking',
            icon: 'search',
            cache: CACHE.NETWORK_FIRST,
            roles: Object.keys(ROLES)
        },
        
        // ==========================================
        // MANAGEMENT ROUTES (Admin & Super Admin)
        // ==========================================
        {
            path: '/manajemen-user',
            component: '../manajemen-user/index.html',
            title: 'Manajemen User',
            breadcrumb: 'Manajemen User',
            icon: 'users',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN]
        },
        {
            path: '/laporan',
            component: '../laporan/index.html',
            title: 'Laporan',
            breadcrumb: 'Laporan',
            icon: 'chart-bar',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG, ROLES.DEKAN, ROLES.KAPRODI]
        },
        {
            path: '/log-aktivitas',
            component: '../log-aktivitas/index.html',
            title: 'Log Aktivitas',
            breadcrumb: 'Log Aktivitas',
            icon: 'history',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN]
        },
        {
            path: '/pengaturan',
            component: '../pengaturan/index.html',
            title: 'Pengaturan',
            breadcrumb: 'Pengaturan',
            icon: 'cog',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KASUBAG]
        },
        {
            path: '/pengaturan/backup',
            component: '../pengaturan/backup.html',
            title: 'Backup & Restore',
            breadcrumb: 'Backup',
            icon: 'database',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN]
        },
        {
            path: '/security-monitor',
            component: '../security-monitor.html',
            title: 'Security Monitor',
            breadcrumb: 'Security',
            icon: 'shield-alt',
            cache: CACHE.NETWORK_FIRST,
            roles: [ROLES.SUPER_ADMIN]
        }
    ];
    
    // ============================================
    // PUBLIC API
    // ============================================
    return {
        /**
         * Get all routes
         * @returns {Array} Array of route objects
         */
        getAllRoutes: function() {
            return routes;
        },
        
        /**
         * Get routes for a specific role
         * @param {string} role - User role
         * @returns {Array} Filtered routes
         */
        getRoutesForRole: function(role) {
            if (!role) return this.getPublicRoutes();
            
            return routes.filter(function(route) {
                // Public routes always included
                if (route.public) return true;
                
                // Check role access
                if (!route.roles) return false;
                
                return route.roles.indexOf(role) !== -1;
            });
        },
        
        /**
         * Get only public routes
         * @returns {Array} Public routes
         */
        getPublicRoutes: function() {
            return routes.filter(function(route) {
                return route.public === true;
            });
        },
        
        /**
         * Find route by path
         * @param {string} path - Route path
         * @returns {Object|null} Route object
         */
        findByPath: function(path) {
            return routes.find(function(route) {
                return route.path === path;
            }) || null;
        },
        
        /**
         * Get dashboard route for role
         * @param {string} role - User role
         * @returns {string} Dashboard component path
         */
        getDashboardForRole: function(role) {
            var dashboardRoute = routes.find(function(route) {
                return route.path === '/dashboard/' + role;
            });
            
            return dashboardRoute ? dashboardRoute.component : '../dashboard/user/index.html';
        },
        
        /**
         * Check if user can access a route
         * @param {string} role - User role
         * @param {string} path - Route path
         * @returns {boolean}
         */
        canAccess: function(role, path) {
            var route = this.findByPath(path);
            if (!route) return false;
            if (route.public) return true;
            if (!route.roles) return false;
            return route.roles.indexOf(role) !== -1;
        },
        
        /**
         * Get breadcrumb trail for a path
         * @param {string} path - Current path
         * @returns {Array} Breadcrumb items
         */
        getBreadcrumb: function(path) {
            var route = this.findByPath(path);
            if (!route) return [{ label: 'Beranda', path: '../' }];
            
            var trail = [];
            
            // Add home
            trail.push({ label: 'Dashboard', path: '../dashboard/' });
            
            // Add route breadcrumb
            if (route.breadcrumb) {
                trail.push({ label: route.breadcrumb, path: '#' });
            }
            
            return trail;
        },
        
        /**
         * Get role hierarchy
         * @returns {Object} Role hierarchy map
         */
        getRoleHierarchy: function() {
            return ROLE_HIERARCHY;
        },
        
        /**
         * Get all role constants
         * @returns {Object} Role constants
         */
        getRoles: function() {
            return ROLES;
        },
        
        /**
         * Get cache strategies
         * @returns {Object} Cache strategy constants
         */
        getCacheStrategies: function() {
            return CACHE;
        },
        
        // Export untuk testing
        _routes: routes,
        _ROLES: ROLES,
        _ROLE_HIERARCHY: ROLE_HIERARCHY
    };
})();