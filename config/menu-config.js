// config/menu-config.js - Menu Configuration 2026
/**
 * E-Arsip Digital - Menu Configuration
 * Version: 2026.1.0
 */

const MENU_CONFIG = {
    // ============================================
    // SIDEBAR MENU ITEMS PER ROLE
    // ============================================
    sidebar: {
        super_admin: [
            { type: 'item', icon: 'home', label: 'Dashboard', path: '/dashboard/super-admin/' },
            { type: 'divider', label: 'Surat Menyurat' },
            { type: 'section', icon: 'envelope', label: 'Surat Keluar', children: [
                { icon: 'list', label: 'Daftar Surat', path: '/surat-keluar/list.html' },
                { icon: 'plus', label: 'Buat Surat', path: '/surat-keluar/form.html' },
                { icon: 'file-alt', label: 'Draft', path: '/surat-keluar/draft.html' },
                { icon: 'check-double', label: 'Approval', path: '/surat-keluar/approval.html' },
                { icon: 'qrcode', label: 'QR Code', path: '/surat-keluar/qrcode.html' }
            ]},
            { type: 'section', icon: 'inbox', label: 'Surat Masuk', children: [
                { icon: 'list', label: 'Daftar Surat', path: '/surat-masuk/list.html' },
                { icon: 'plus', label: 'Input Surat', path: '/surat-masuk/form.html' },
                { icon: 'book', label: 'Agenda', path: '/surat-masuk/agenda.html' },
                { icon: 'search', label: 'Tracking', path: '/surat-masuk/tracking.html' }
            ]},
            { type: 'divider', label: 'Manajemen' },
            { icon: 'users', label: 'Manajemen User', path: '/manajemen-user/' },
            { icon: 'chart-bar', label: 'Laporan', path: '/laporan/' },
            { icon: 'history', label: 'Log Aktivitas', path: '/log-aktivitas/' },
            { type: 'divider', label: 'Sistem' },
            { icon: 'shield-alt', label: 'Security Monitor', path: '/security-monitor.html' },
            { icon: 'cog', label: 'Pengaturan', path: '/pengaturan/' }
        ],
        admin: [
            { type: 'item', icon: 'home', label: 'Dashboard', path: '/dashboard/admin/' },
            { type: 'divider', label: 'Surat Menyurat' },
            { icon: 'paper-plane', label: 'Surat Keluar', path: '/surat-keluar/list.html' },
            { icon: 'inbox', label: 'Surat Masuk', path: '/surat-masuk/list.html' },
            { type: 'divider', label: 'Manajemen' },
            { icon: 'users', label: 'Manajemen User', path: '/manajemen-user/' },
            { icon: 'chart-bar', label: 'Laporan', path: '/laporan/' },
            { icon: 'history', label: 'Log Aktivitas', path: '/log-aktivitas/' },
            { type: 'divider', label: 'Sistem' },
            { icon: 'cog', label: 'Pengaturan', path: '/pengaturan/' }
        ],
        dekan: [
            { type: 'item', icon: 'home', label: 'Dashboard', path: '/dashboard/dekan/' },
            { type: 'divider', label: 'Surat Menyurat' },
            { icon: 'paper-plane', label: 'Surat Keluar', path: '/surat-keluar/list.html' },
            { icon: 'inbox', label: 'Surat Masuk', path: '/surat-masuk/list.html' },
            { icon: 'check-double', label: 'Approval', path: '/surat-keluar/approval.html' },
            { type: 'divider', label: 'Laporan' },
            { icon: 'chart-bar', label: 'Laporan', path: '/laporan/' }
        ],
        user: [
            { type: 'item', icon: 'home', label: 'Dashboard', path: '/dashboard/user/' },
            { type: 'divider', label: 'Surat Menyurat' },
            { icon: 'paper-plane', label: 'Surat Keluar', path: '/surat-keluar/list.html' },
            { icon: 'inbox', label: 'Surat Masuk', path: '/surat-masuk/list.html' },
            { type: 'divider', label: 'Lainnya' },
            { icon: 'bell', label: 'Notifikasi', path: '/notifikasi/' },
            { icon: 'question-circle', label: 'Bantuan', path: '/help/' }
        ]
    },
    
    // ============================================
    // TOP NAVIGATION ITEMS
    // ============================================
    topNav: [
        { label: 'Dashboard', path: '/dashboard/' },
        { label: 'Surat Keluar', path: '/surat-keluar/list.html' },
        { label: 'Surat Masuk', path: '/surat-masuk/list.html' }
    ],
    
    // ============================================
    // USER DROPDOWN MENU
    // ============================================
    userMenu: [
        { icon: 'user', label: 'Profile', path: '/profile/' },
        { icon: 'bell', label: 'Notifikasi', path: '/notifikasi/' },
        { icon: 'cog', label: 'Pengaturan', path: '/pengaturan/' },
        { type: 'divider' },
        { icon: 'sign-out-alt', label: 'Logout', action: 'logout' }
    ]
};

export default MENU_CONFIG;