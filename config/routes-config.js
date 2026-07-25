// config/routes-config.js - Routes Configuration 2026
/**
 * E-Arsip Digital - Routes Configuration
 * Version: 2026.1.0
 */

const ROUTES_CONFIG = {
    // ============================================
    // PUBLIC ROUTES (NO AUTH REQUIRED)
    // ============================================
    public: [
        { path: '/', component: 'index.html', title: 'Beranda' },
        { path: '/login', component: 'login.html', title: 'Login' },
        { path: '/404', component: '404.html', title: 'Halaman Tidak Ditemukan' },
        { path: '/403', component: 'error/403.html', title: 'Akses Ditolak' },
        { path: '/500', component: 'error/500.html', title: 'Kesalahan Server' },
        { path: '/help', component: 'help/index.html', title: 'Bantuan' }
    ],
    
    // ============================================
    // AUTHENTICATED ROUTES
    // ============================================
    authenticated: [
        { path: '/dashboard', component: 'dashboard/index.html', title: 'Dashboard' },
        { path: '/profile', component: 'profile/index.html', title: 'Profile' },
        { path: '/notifikasi', component: 'notifikasi/index.html', title: 'Notifikasi' },
        
        // Surat Keluar
        { path: '/surat-keluar', component: 'surat-keluar/list.html', title: 'Surat Keluar' },
        { path: '/surat-keluar/form', component: 'surat-keluar/form.html', title: 'Buat Surat' },
        { path: '/surat-keluar/draft', component: 'surat-keluar/draft.html', title: 'Draft Surat' },
        { path: '/surat-keluar/preview', component: 'surat-keluar/preview.html', title: 'Preview' },
        { path: '/surat-keluar/approval', component: 'surat-keluar/approval.html', title: 'Approval' },
        { path: '/surat-keluar/generate', component: 'surat-keluar/generate.html', title: 'Generate' },
        { path: '/surat-keluar/qrcode', component: 'surat-keluar/qrcode.html', title: 'QR Code' },
        
        // Surat Masuk
        { path: '/surat-masuk', component: 'surat-masuk/list.html', title: 'Surat Masuk' },
        { path: '/surat-masuk/form', component: 'surat-masuk/form.html', title: 'Input Surat' },
        { path: '/surat-masuk/disposisi', component: 'surat-masuk/disposisi.html', title: 'Disposisi' },
        { path: '/surat-masuk/agenda', component: 'surat-masuk/agenda.html', title: 'Agenda' },
        { path: '/surat-masuk/tracking', component: 'surat-masuk/tracking.html', title: 'Tracking' }
    ],
    
    // ============================================
    // ADMIN ROUTES (ADMIN & SUPER ADMIN ONLY)
    // ============================================
    admin: [
        { path: '/manajemen-user', component: 'manajemen-user/index.html', title: 'Manajemen User' },
        { path: '/laporan', component: 'laporan/index.html', title: 'Laporan' },
        { path: '/log-aktivitas', component: 'log-aktivitas/index.html', title: 'Log Aktivitas' },
        { path: '/security-monitor', component: 'security-monitor.html', title: 'Security Monitor' }
    ],
    
    // ============================================
    // SETTINGS ROUTES (ADMIN ONLY)
    // ============================================
    settings: [
        { path: '/pengaturan', component: 'pengaturan/index.html', title: 'Pengaturan' },
        { path: '/pengaturan/penomoran', component: 'pengaturan/penomoran.html', title: 'Penomoran' },
        { path: '/pengaturan/tanda-tangan', component: 'pengaturan/tanda-tangan.html', title: 'Tanda Tangan' },
        { path: '/pengaturan/backup', component: 'pengaturan/backup.html', title: 'Backup & Restore' }
    ],
    
    // ============================================
    // ROLE-BASED DASHBOARD ROUTES
    // ============================================
    dashboards: {
        super_admin: '/dashboard/super-admin/index.html',
        admin: '/dashboard/admin/index.html',
        kaprodi: '/dashboard/kaprodi/index.html',
        admin_kaprodi: '/dashboard/admin-kaprodi/index.html',
        wadek: '/dashboard/wadek/index.html',
        admin_wadek: '/dashboard/admin-wadek/index.html',
        dekan: '/dashboard/dekan/index.html',
        admin_dekan: '/dashboard/admin-dekan/index.html',
        kasubag: '/dashboard/kasubag/index.html',
        ketua_upm: '/dashboard/ketua_upm/index.html',
        litdianmas: '/dashboard/litdianmas/index.html',
        staf: '/dashboard/staf/index.html',
        dosen: '/dashboard/dosen/index.html',
        mahasiswa: '/dashboard/mahasiswa/index.html',
        lembaga_kemahasiswaan: '/dashboard/lembaga_kemahasiswaan/index.html',
        user: '/dashboard/user/index.html'
    },
    
    // ============================================
    // MENU STRUCTURE
    // ============================================
    menu: {
        super_admin: [
            { icon: 'home', label: 'Dashboard', path: '/dashboard/super-admin/' },
            { icon: 'paper-plane', label: 'Surat Keluar', path: '/surat-keluar/' },
            { icon: 'inbox', label: 'Surat Masuk', path: '/surat-masuk/' },
            { icon: 'users', label: 'Manajemen User', path: '/manajemen-user/' },
            { icon: 'chart-bar', label: 'Laporan', path: '/laporan/' },
            { icon: 'history', label: 'Log Aktivitas', path: '/log-aktivitas/' },
            { icon: 'shield-alt', label: 'Security', path: '/security-monitor.html' },
            { icon: 'cog', label: 'Pengaturan', path: '/pengaturan/' }
        ],
        admin: [
            { icon: 'home', label: 'Dashboard', path: '/dashboard/admin/' },
            { icon: 'paper-plane', label: 'Surat Keluar', path: '/surat-keluar/' },
            { icon: 'inbox', label: 'Surat Masuk', path: '/surat-masuk/' },
            { icon: 'users', label: 'Manajemen User', path: '/manajemen-user/' },
            { icon: 'chart-bar', label: 'Laporan', path: '/laporan/' },
            { icon: 'history', label: 'Log Aktivitas', path: '/log-aktivitas/' },
            { icon: 'cog', label: 'Pengaturan', path: '/pengaturan/' }
        ],
        user: [
            { icon: 'home', label: 'Dashboard', path: '/dashboard/user/' },
            { icon: 'paper-plane', label: 'Surat Keluar', path: '/surat-keluar/' },
            { icon: 'inbox', label: 'Surat Masuk', path: '/surat-masuk/' },
            { icon: 'bell', label: 'Notifikasi', path: '/notifikasi/' }
        ]
    }
};

export default ROUTES_CONFIG;