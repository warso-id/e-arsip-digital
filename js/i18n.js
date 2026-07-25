// js/i18n.js - Internationalization Module 2026
/**
 * E-Arsip Digital - Internationalization (ID/EN)
 * Version: 2026.1.0
 * Features: Multi-language support, dynamic switching, interpolation, pluralization
 */

import { Logger } from './logger.js';
import APP_CONFIG from '../config/config.js';

class I18n {
    constructor(config = {}) {
        this.logger = new Logger('I18n');
        
        this.config = {
            defaultLocale: APP_CONFIG.app?.language || 'id',
            fallbackLocale: APP_CONFIG.app?.fallbackLanguage || 'en',
            supportedLocales: ['id', 'en'],
            ...config
        };
        
        // Current locale
        this.currentLocale = this.loadLocale() || this.config.defaultLocale;
        
        // Translation storage
        this.translations = new Map();
        
        // Registered listeners for locale changes
        this.listeners = new Set();
        
        this.init();
    }
    
    async init() {
        await this.loadTranslations(this.currentLocale);
        this.updateDOM();
        
        this.logger.info('I18n initialized', {
            locale: this.currentLocale,
            supported: this.config.supportedLocales
        });
    }
    
    // ============================================
    // TRANSLATION LOADING
    // ============================================
    
    async loadTranslations(locale) {
        if (this.translations.has(locale)) return;
        
        try {
            const response = await fetch(`/locales/${locale}.json`);
            if (response.ok) {
                const data = await response.json();
                this.translations.set(locale, data);
            }
        } catch (error) {
            this.logger.warn(`Failed to load translations for ${locale}`, error);
        }
        
        // Load fallback if not loaded
        if (locale !== this.config.fallbackLocale && !this.translations.has(this.config.fallbackLocale)) {
            await this.loadTranslations(this.config.fallbackLocale);
        }
    }
    
    // ============================================
    // CORE TRANSLATION
    // ============================================
    
    t(key, params = {}, locale = null) {
        const loc = locale || this.currentLocale;
        
        // Get translation
        let translation = this.getTranslation(key, loc);
        
        if (translation === key) {
            // Try fallback locale
            translation = this.getTranslation(key, this.config.fallbackLocale);
        }
        
        // Interpolation
        translation = this.interpolate(translation, params);
        
        // Pluralization
        if (params.count !== undefined) {
            translation = this.pluralize(translation, params.count, loc);
        }
        
        return translation;
    }
    
    getTranslation(key, locale) {
        const translations = this.translations.get(locale);
        if (!translations) return key;
        
        // Support dot notation
        return key.split('.').reduce((obj, k) => {
            return obj && obj[k] !== undefined ? obj[k] : key;
        }, translations);
    }
    
    interpolate(text, params) {
        if (!text || typeof text !== 'string') return text;
        
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }
    
    pluralize(text, count, locale) {
        const pluralRules = {
            id: (n) => 0, // Indonesian has no plural forms
            en: (n) => n === 1 ? 0 : 1
        };
        
        const rule = pluralRules[locale] || pluralRules.en;
        const form = rule(Math.abs(count));
        
        if (typeof text === 'object') {
            return text[form] || text[0] || '';
        }
        
        return text;
    }
    
    // ============================================
    // LOCALE MANAGEMENT
    // ============================================
    
    async setLocale(locale) {
        if (!this.config.supportedLocales.includes(locale)) {
            this.logger.warn('Unsupported locale', { locale });
            return false;
        }
        
        if (locale === this.currentLocale) return true;
        
        this.currentLocale = locale;
        this.saveLocale(locale);
        
        await this.loadTranslations(locale);
        this.updateDOM();
        this.notifyListeners(locale);
        
        document.documentElement.lang = locale;
        
        this.logger.info('Locale changed', { locale });
        
        return true;
    }
    
    getLocale() {
        return this.currentLocale;
    }
    
    getSupportedLocales() {
        return [...this.config.supportedLocales];
    }
    
    loadLocale() {
        try {
            return localStorage.getItem('app_locale');
        } catch {
            return null;
        }
    }
    
    saveLocale(locale) {
        try {
            localStorage.setItem('app_locale', locale);
        } catch {
            // Ignore
        }
    }
    
    detectBrowserLocale() {
        const browserLocale = navigator.language || navigator.userLanguage;
        const shortLocale = browserLocale.split('-')[0];
        
        if (this.config.supportedLocales.includes(shortLocale)) {
            return shortLocale;
        }
        
        return this.config.defaultLocale;
    }
    
    // ============================================
    // DOM UPDATES
    // ============================================
    
    updateDOM() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            element.textContent = this.t(key);
        });
        
        // Update all elements with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.dataset.i18nPlaceholder;
            element.placeholder = this.t(key);
        });
        
        // Update all elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.dataset.i18nTitle;
            element.title = this.t(key);
        });
        
        // Update all elements with data-i18n-html
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.dataset.i18nHtml;
            element.innerHTML = this.t(key);
        });
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    onLocaleChange(callback) {
        this.listeners.add(callback);
        
        return () => {
            this.listeners.delete(callback);
        };
    }
    
    notifyListeners(locale) {
        this.listeners.forEach(callback => {
            try {
                callback(locale);
            } catch (error) {
                this.logger.error('Locale change listener error', error);
            }
        });
    }
    
    // ============================================
    // BUILT-IN TRANSLATIONS
    // ============================================
    
    getBuiltInTranslations() {
        return {
            id: {
                // Common
                'app.name': 'E-Arsip Digital',
                'app.tagline': 'Sistem Manajemen Arsip Digital',
                'app.loading': 'Memuat...',
                'app.error': 'Terjadi kesalahan',
                'app.retry': 'Coba Lagi',
                'app.cancel': 'Batal',
                'app.save': 'Simpan',
                'app.delete': 'Hapus',
                'app.edit': 'Edit',
                'app.view': 'Lihat',
                'app.search': 'Cari',
                'app.filter': 'Filter',
                'app.export': 'Export',
                'app.print': 'Cetak',
                'app.close': 'Tutup',
                'app.confirm': 'Konfirmasi',
                'app.yes': 'Ya',
                'app.no': 'Tidak',
                'app.back': 'Kembali',
                'app.next': 'Selanjutnya',
                'app.previous': 'Sebelumnya',
                'app.submit': 'Kirim',
                'app.reset': 'Reset',
                'app.refresh': 'Segarkan',
                'app.upload': 'Upload',
                'app.download': 'Download',
                
                // Auth
                'auth.login': 'Masuk',
                'auth.logout': 'Keluar',
                'auth.username': 'Username',
                'auth.password': 'Password',
                'auth.email': 'Email',
                'auth.remember': 'Ingat saya',
                'auth.forgot': 'Lupa password?',
                'auth.login_success': 'Login berhasil',
                'auth.login_failed': 'Login gagal',
                'auth.session_expired': 'Sesi berakhir',
                
                // Navigation
                'nav.dashboard': 'Dashboard',
                'nav.surat_keluar': 'Surat Keluar',
                'nav.surat_masuk': 'Surat Masuk',
                'nav.manajemen_user': 'Manajemen User',
                'nav.laporan': 'Laporan',
                'nav.log_aktivitas': 'Log Aktivitas',
                'nav.notifikasi': 'Notifikasi',
                'nav.pengaturan': 'Pengaturan',
                'nav.bantuan': 'Bantuan',
                'nav.profile': 'Profil',
                
                // Surat
                'surat.nomor': 'Nomor Surat',
                'surat.perihal': 'Perihal',
                'surat.tanggal': 'Tanggal Surat',
                'surat.pengirim': 'Pengirim',
                'surat.tujuan': 'Tujuan',
                'surat.jenis': 'Jenis Surat',
                'surat.sifat': 'Sifat Surat',
                'surat.status': 'Status',
                'surat.create': 'Buat Surat',
                'surat.draft': 'Draft',
                'surat.approval': 'Approval',
                
                // Status
                'status.pending': 'Menunggu',
                'status.proses': 'Diproses',
                'status.selesai': 'Selesai',
                'status.disetujui': 'Disetujui',
                'status.ditolak': 'Ditolak',
                'status.aktif': 'Aktif',
                'status.nonaktif': 'Nonaktif',
                
                // Messages
                'msg.save_success': 'Data berhasil disimpan',
                'msg.save_failed': 'Gagal menyimpan data',
                'msg.delete_confirm': 'Apakah Anda yakin ingin menghapus?',
                'msg.delete_success': 'Data berhasil dihapus',
                'msg.delete_failed': 'Gagal menghapus data',
                'msg.no_data': 'Tidak ada data',
                'msg.loading': 'Memuat data...'
            },
            en: {
                // Common
                'app.name': 'E-Arsip Digital',
                'app.tagline': 'Digital Archive Management System',
                'app.loading': 'Loading...',
                'app.error': 'An error occurred',
                'app.retry': 'Retry',
                'app.cancel': 'Cancel',
                'app.save': 'Save',
                'app.delete': 'Delete',
                'app.edit': 'Edit',
                'app.view': 'View',
                'app.search': 'Search',
                'app.filter': 'Filter',
                'app.export': 'Export',
                'app.print': 'Print',
                'app.close': 'Close',
                'app.confirm': 'Confirm',
                'app.yes': 'Yes',
                'app.no': 'No',
                'app.back': 'Back',
                'app.next': 'Next',
                'app.previous': 'Previous',
                'app.submit': 'Submit',
                'app.reset': 'Reset',
                'app.refresh': 'Refresh',
                'app.upload': 'Upload',
                'app.download': 'Download',
                
                // Auth
                'auth.login': 'Login',
                'auth.logout': 'Logout',
                'auth.username': 'Username',
                'auth.password': 'Password',
                'auth.email': 'Email',
                'auth.remember': 'Remember me',
                'auth.forgot': 'Forgot password?',
                'auth.login_success': 'Login successful',
                'auth.login_failed': 'Login failed',
                'auth.session_expired': 'Session expired',
                
                // Navigation
                'nav.dashboard': 'Dashboard',
                'nav.surat_keluar': 'Outgoing Mail',
                'nav.surat_masuk': 'Incoming Mail',
                'nav.manajemen_user': 'User Management',
                'nav.laporan': 'Reports',
                'nav.log_aktivitas': 'Activity Log',
                'nav.notifikasi': 'Notifications',
                'nav.pengaturan': 'Settings',
                'nav.bantuan': 'Help',
                'nav.profile': 'Profile',
                
                // Surat
                'surat.nomor': 'Letter Number',
                'surat.perihal': 'Subject',
                'surat.tanggal': 'Date',
                'surat.pengirim': 'Sender',
                'surat.tujuan': 'Recipient',
                'surat.jenis': 'Type',
                'surat.sifat': 'Priority',
                'surat.status': 'Status',
                'surat.create': 'Create Letter',
                'surat.draft': 'Draft',
                'surat.approval': 'Approval',
                
                // Status
                'status.pending': 'Pending',
                'status.proses': 'Processing',
                'status.selesai': 'Completed',
                'status.disetujui': 'Approved',
                'status.ditolak': 'Rejected',
                'status.aktif': 'Active',
                'status.nonaktif': 'Inactive',
                
                // Messages
                'msg.save_success': 'Data saved successfully',
                'msg.save_failed': 'Failed to save data',
                'msg.delete_confirm': 'Are you sure you want to delete?',
                'msg.delete_success': 'Data deleted successfully',
                'msg.delete_failed': 'Failed to delete data',
                'msg.no_data': 'No data available',
                'msg.loading': 'Loading data...'
            }
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    formatDate(date, options = {}) {
        const locale = options.locale || this.currentLocale;
        return new Date(date).toLocaleDateString(locale, options);
    }
    
    formatNumber(number, options = {}) {
        const locale = options.locale || this.currentLocale;
        return new Intl.NumberFormat(locale, options).format(number);
    }
    
    formatCurrency(amount, currency = 'IDR') {
        const locale = this.currentLocale === 'id' ? 'id-ID' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency
        }).format(amount);
    }
    
    getDirection() {
        return 'ltr';
    }
    
    destroy() {
        this.listeners.clear();
        this.translations.clear();
    }
}

// Create singleton
const i18n = new I18n();

export default i18n;
export { I18n };