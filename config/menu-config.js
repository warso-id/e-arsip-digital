// config/menu-config.js - Menu Configuration 2026 (LENGKAP 16 ROLES)
/**
 * E-Arsip Digital - Menu Configuration
 * Version: 2026.1.0
 * 
 * Menu items untuk semua 16 role pengguna.
 * Path menggunakan RELATIF dari lokasi dashboard.
 */

window.EArsip = window.EArsip || {};

window.EArsip.MenuConfig = (function() {
    'use strict';
    
    // ============================================
    // ICON FALLBACK MAP
    // ============================================
    var ICON_MAP = {
        home: 'fa-home',
        dashboard: 'fa-tachometer-alt',
        inbox: 'fa-inbox',
        'paper-plane': 'fa-paper-plane',
        'surat-keluar': 'fa-paper-plane',
        'surat-masuk': 'fa-inbox',
        users: 'fa-users',
        'chart-bar': 'fa-chart-bar',
        history: 'fa-history',
        cog: 'fa-cog',
        'sign-out-alt': 'fa-sign-out-alt',
        user: 'fa-user',
        bell: 'fa-bell',
        'question-circle': 'fa-question-circle',
        'file-alt': 'fa-file-alt',
        plus: 'fa-plus',
        list: 'fa-list',
        'check-double': 'fa-check-double',
        qrcode: 'fa-qrcode',
        book: 'fa-book',
        search: 'fa-search',
        'shield-alt': 'fa-shield-alt',
        envelope: 'fa-envelope',
        'clipboard-list': 'fa-clipboard-list',
        'calendar-alt': 'fa-calendar-alt',
        'id-card': 'fa-id-card',
        tasks: 'fa-tasks',
        flask: 'fa-flask',
        'hands-helping': 'fa-hands-helping',
        'user-graduate': 'fa-user-graduate',
        'file-contract': 'fa-file-contract',
        'signature': 'fa-signature',
        'pen-fancy': 'fa-pen-fancy'
    };
    
    // ============================================
    // BASE PATHS (Relatif dari dashboard/{role}/)
    // ============================================
    var PATHS = {
        // Surat Keluar
        suratKeluarList: '../../surat-keluar/list.html',
        suratKeluarForm: '../../surat-keluar/form.html',
        suratKeluarDraft: '../../surat-keluar/draft.html',
        suratKeluarApproval: '../../surat-keluar/approval.html',
        suratKeluarPreview: '../../surat-keluar/preview.html',
        suratKeluarGenerate: '../../surat-keluar/generate.html',
        suratKeluarQRCode: '../../surat-keluar/qrcode.html',
        
        // Surat Masuk
        suratMasukList: '../../surat-masuk/list.html',
        suratMasukForm: '../../surat-masuk/form.html',
        suratMasukAgenda: '../../surat-masuk/agenda.html',
        suratMasukBukuAgenda: '../../surat-masuk/buku-agenda.html',
        suratMasukTracking: '../../surat-masuk/tracking.html',
        suratMasukDisposisi: '../../surat-masuk/disposisi.html',
        suratMasukDisposisiCetak: '../../surat-masuk/disposisi-cetak.html',
        
        // Management
        manajemenUser: '../../manajemen-user/index.html',
        laporan: '../../laporan/index.html',
        logAktivitas: '../../log-aktivitas/index.html',
        notifikasi: '../../notifikasi/index.html',
        pengaturan: '../../pengaturan/index.html',
        profile: '../../profile/index.html',
        help: '../../help/index.html',
        
        // Admin khusus
        securityMonitor: '../../security-monitor.html',
        backupRestore: '../../pengaturan/backup.html'
    };
    
    // ============================================
    // HELPER: Build menu item
    // ============================================
    function item(icon, label, path, options) {
        var result = {
            type: 'item',
            icon: icon || 'circle',
            label: label,
            path: path || '#'
        };
        if (options) {
            if (options.badge) result.badge = options.badge;
            if (options.external) result.external = true;
            if (options.roles) result.roles = options.roles;
        }
        return result;
    }
    
    function divider(label) {
        return { type: 'divider', label: label || '' };
    }
    
    function section(icon, label, children) {
        return {
            type: 'section',
            icon: icon || 'folder',
            label: label,
            children: children || []
        };
    }
    
    // ============================================
    // MENU CONFIGURATION (16 ROLES)
    // ============================================
    var SIDEBAR_MENUS = {
        // ==========================================
        // 1. SUPER ADMIN
        // ==========================================
        super_admin: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            section('envelope', 'Surat Keluar', [
                item('list', 'Daftar Surat', PATHS.suratKeluarList),
                item('plus', 'Buat Surat', PATHS.suratKeluarForm),
                item('file-alt', 'Draft', PATHS.suratKeluarDraft),
                item('check-double', 'Approval', PATHS.suratKeluarApproval),
                item('cog', 'Generate', PATHS.suratKeluarGenerate),
                item('qrcode', 'Verifikasi QR', PATHS.suratKeluarQRCode)
            ]),
            section('inbox', 'Surat Masuk', [
                item('list', 'Daftar Surat', PATHS.suratMasukList),
                item('plus', 'Input Surat', PATHS.suratMasukForm),
                item('book', 'Agenda', PATHS.suratMasukAgenda),
                item('book', 'Buku Agenda', PATHS.suratMasukBukuAgenda),
                item('search', 'Tracking', PATHS.suratMasukTracking),
                item('clipboard-list', 'Disposisi', PATHS.suratMasukDisposisi)
            ]),
            divider('Manajemen'),
            item('users', 'Manajemen User', PATHS.manajemenUser),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('history', 'Log Aktivitas', PATHS.logAktivitas),
            divider('Sistem'),
            item('shield-alt', 'Security Monitor', PATHS.securityMonitor),
            item('cog', 'Pengaturan', PATHS.pengaturan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 2. ADMIN
        // ==========================================
        admin: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('clipboard-list', 'Disposisi', PATHS.suratMasukDisposisi),
            divider('Manajemen'),
            item('users', 'Manajemen User', PATHS.manajemenUser),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('history', 'Log Aktivitas', PATHS.logAktivitas),
            divider('Sistem'),
            item('cog', 'Pengaturan', PATHS.pengaturan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 3. KASUBAG
        // ==========================================
        kasubag: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('book', 'Agenda Surat Masuk', PATHS.suratMasukAgenda),
            item('clipboard-list', 'Disposisi', PATHS.suratMasukDisposisi),
            item('check-double', 'Review Surat Keluar', PATHS.suratKeluarApproval),
            divider('Surat'),
            item('inbox', 'Semua Surat Masuk', PATHS.suratMasukList),
            item('paper-plane', 'Semua Surat Keluar', PATHS.suratKeluarList),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 4. KAPRODI
        // ==========================================
        kaprodi: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('clipboard-list', 'Disposisi Masuk', '#disposisi'),
            item('check-double', 'Approval Surat', '#approval'),
            divider('Surat'),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', '#laporan'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 5. ADMIN KAPRODI
        // ==========================================
        admin_kaprodi: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('clipboard-list', 'Disposisi', PATHS.suratMasukDisposisi),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 6. WADEK (Wakil Dekan)
        // ==========================================
        wadek: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('check-double', 'Approval Surat', '#approval'),
            item('pen-fancy', 'Pending Paraf', '#approval'),
            divider('Surat'),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 7. ADMIN WADEK
        // ==========================================
        admin_wadek: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('check-double', 'Approval', '#approval'),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 8. DEKAN
        // ==========================================
        dekan: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('signature', 'Final Approval & TTD', '#final-approval'),
            item('clipboard-list', 'Disposisi Masuk', '#disposisi'),
            divider('Surat'),
            item('list', 'Semua Surat', PATHS.suratKeluarList),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            divider('Lainnya'),
            item('chart-bar', 'Laporan Eksekutif', '#laporan'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 9. ADMIN DEKAN
        // ==========================================
        admin_dekan: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('signature', 'Final Approval', '#final-approval'),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 10. KETUA UPM
        // ==========================================
        ketua_upm: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('clipboard-list', 'Disposisi', '#disposisi'),
            divider('Mutu'),
            item('file-contract', 'Dokumen Mutu', '#dokumen-mutu'),
            item('search', 'Laporan Audit', '#laporan-audit'),
            divider('Lainnya'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 11. LITDIANMAS
        // ==========================================
        litdianmas: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            divider('Lainnya'),
            item('chart-bar', 'Laporan', PATHS.laporan),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 12. STAF
        // ==========================================
        staf: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            divider('Pekerjaan'),
            item('tasks', 'Tugas Saya', '#tugas-saya'),
            item('calendar-alt', 'Agenda', '#agenda'),
            divider('Lainnya'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 13. DOSEN
        // ==========================================
        dosen: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('envelope', 'Surat Saya', '#surat-saya'),
            item('plus', 'Buat Surat', PATHS.suratKeluarForm),
            divider('Akademik'),
            item('user-graduate', 'Bimbingan', '#bimbingan'),
            divider('Lainnya'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 14. LEMBAGA KEMAHASISWAAN
        // ==========================================
        lembaga_kemahasiswaan: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('envelope', 'Surat Saya', '#surat-saya'),
            item('plus', 'Buat Surat', PATHS.suratKeluarForm),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            divider('Lainnya'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 15. MAHASISWA
        // ==========================================
        mahasiswa: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('plus', 'Buat Surat', PATHS.suratKeluarForm),
            item('envelope', 'Surat Saya', '#surat-saya'),
            item('info-circle', 'Status Surat', '#status-surat'),
            divider('Lainnya'),
            item('user', 'Profil', PATHS.profile)
        ],
        
        // ==========================================
        // 16. USER (Default/Fallback)
        // ==========================================
        user: [
            item('home', 'Dashboard', './'),
            divider('Surat Menyurat'),
            item('paper-plane', 'Surat Keluar', PATHS.suratKeluarList),
            item('inbox', 'Surat Masuk', PATHS.suratMasukList),
            divider('Lainnya'),
            item('bell', 'Notifikasi', PATHS.notifikasi),
            item('question-circle', 'Bantuan', PATHS.help),
            item('user', 'Profil', PATHS.profile)
        ]
    };
    
    // ============================================
    // TOP NAVIGATION (Common)
    // ============================================
    var TOP_NAV = [
        { label: 'Dashboard', path: './' },
        { label: 'Surat Keluar', path: PATHS.suratKeluarList },
        { label: 'Surat Masuk', path: PATHS.suratMasukList }
    ];
    
    // ============================================
    // USER DROPDOWN MENU (Common)
    // ============================================
    var USER_MENU = [
        { icon: 'user', label: 'Profil', path: PATHS.profile },
        { icon: 'bell', label: 'Notifikasi', path: PATHS.notifikasi },
        { icon: 'cog', label: 'Pengaturan', path: PATHS.pengaturan },
        { type: 'divider' },
        { icon: 'sign-out-alt', label: 'Logout', action: 'logout' }
    ];
    
    // ============================================
    // PUBLIC API
    // ============================================
    return {
        /**
         * Get sidebar menu for a specific role
         * @param {string} role - User role
         * @returns {Array} Menu items array
         */
        getSidebarMenu: function(role) {
            return SIDEBAR_MENUS[role] || SIDEBAR_MENUS['user'] || [];
        },
        
        /**
         * Get top navigation
         * @returns {Array} Top nav items
         */
        getTopNav: function() {
            return TOP_NAV;
        },
        
        /**
         * Get user dropdown menu
         * @returns {Array} User menu items
         */
        getUserMenu: function() {
            return USER_MENU;
        },
        
        /**
         * Get all configured roles
         * @returns {string[]} Array of role names
         */
        getRoles: function() {
            return Object.keys(SIDEBAR_MENUS);
        },
        
        /**
         * Check if role has menu configuration
         * @param {string} role - User role
         * @returns {boolean}
         */
        hasMenu: function(role) {
            return !!SIDEBAR_MENUS[role];
        },
        
        /**
         * Get icon class for menu item
         * @param {string} icon - Icon key
         * @returns {string} Font Awesome class
         */
        getIcon: function(icon) {
            if (!icon) return 'fa-circle';
            if (icon.startsWith('fa-')) return icon;
            return 'fa-' + (ICON_MAP[icon] || icon);
        },
        
        /**
         * Get all path constants
         * @returns {Object} Path mappings
         */
        getPaths: function() {
            return PATHS;
        },
        
        // Export untuk testing
        _SIDEBAR_MENUS: SIDEBAR_MENUS,
        _PATHS: PATHS
    };
})();

// ============================================
// USAGE EXAMPLE:
// ============================================
// var menu = window.EArsip.MenuConfig.getSidebarMenu('admin');
// menu.forEach(function(item) {
//     if (item.type === 'item') {
//         console.log(item.label, item.path);
//     }
// });
// ============================================