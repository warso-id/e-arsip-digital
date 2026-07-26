// js/i18n.js - Internationalization Module 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Internationalization (ID/EN)
 * Version: 2026.1.0
 * 
 * Features:
 * - Built-in translations (no fetch needed)
 * - Dynamic locale switching
 * - Interpolation ({key})
 * - DOM auto-update
 * - No external dependencies
 */

var I18n = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        defaultLocale: 'id',
        fallbackLocale: 'id',
        supportedLocales: ['id', 'en']
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _currentLocale = 'id';
    var _translations = {};        // { locale: { key: value } }
    var _listeners = [];           // Locale change listeners
    
    // ============================================
    // BUILT-IN TRANSLATIONS
    // ============================================
    var BUILT_IN = {
        'id': {
            'app.name': 'E-Arsip Digital',
            'app.loading': 'Memuat...',
            'app.error': 'Terjadi kesalahan',
            'app.save': 'Simpan',
            'app.cancel': 'Batal',
            'app.delete': 'Hapus',
            'app.edit': 'Edit',
            'app.view': 'Lihat',
            'app.search': 'Cari',
            'app.filter': 'Filter',
            'app.export': 'Export',
            'app.print': 'Cetak',
            'app.close': 'Tutup',
            'app.yes': 'Ya',
            'app.no': 'Tidak',
            'app.back': 'Kembali',
            'app.next': 'Selanjutnya',
            'app.submit': 'Kirim',
            'app.upload': 'Upload',
            'app.download': 'Download',
            'app.confirm_delete': 'Apakah Anda yakin ingin menghapus?',
            'app.no_data': 'Tidak ada data',
            
            'auth.login': 'Masuk',
            'auth.logout': 'Keluar',
            'auth.username': 'Username',
            'auth.password': 'Password',
            'auth.login_success': 'Login berhasil',
            'auth.login_failed': 'Login gagal',
            'auth.session_expired': 'Sesi berakhir',
            
            'nav.dashboard': 'Dashboard',
            'nav.surat_keluar': 'Surat Keluar',
            'nav.surat_masuk': 'Surat Masuk',
            'nav.laporan': 'Laporan',
            'nav.pengaturan': 'Pengaturan',
            'nav.profile': 'Profil',
            
            'surat.nomor': 'Nomor Surat',
            'surat.perihal': 'Perihal',
            'surat.tanggal': 'Tanggal',
            'surat.pengirim': 'Pengirim',
            'surat.tujuan': 'Tujuan',
            'surat.status': 'Status',
            
            'status.pending': 'Menunggu',
            'status.proses': 'Diproses',
            'status.selesai': 'Selesai',
            'status.disetujui': 'Disetujui',
            'status.ditolak': 'Ditolak',
            
            'msg.save_success': 'Data berhasil disimpan',
            'msg.delete_success': 'Data berhasil dihapus',
            'msg.loading': 'Memuat data...'
        },
        'en': {
            'app.name': 'E-Arsip Digital',
            'app.loading': 'Loading...',
            'app.error': 'An error occurred',
            'app.save': 'Save',
            'app.cancel': 'Cancel',
            'app.delete': 'Delete',
            'app.edit': 'Edit',
            'app.view': 'View',
            'app.search': 'Search',
            'app.filter': 'Filter',
            'app.export': 'Export',
            'app.print': 'Print',
            'app.close': 'Close',
            'app.yes': 'Yes',
            'app.no': 'No',
            'app.back': 'Back',
            'app.next': 'Next',
            'app.submit': 'Submit',
            'app.upload': 'Upload',
            'app.download': 'Download',
            'app.confirm_delete': 'Are you sure you want to delete?',
            'app.no_data': 'No data available',
            
            'auth.login': 'Login',
            'auth.logout': 'Logout',
            'auth.username': 'Username',
            'auth.password': 'Password',
            'auth.login_success': 'Login successful',
            'auth.login_failed': 'Login failed',
            'auth.session_expired': 'Session expired',
            
            'nav.dashboard': 'Dashboard',
            'nav.surat_keluar': 'Outgoing Mail',
            'nav.surat_masuk': 'Incoming Mail',
            'nav.laporan': 'Reports',
            'nav.pengaturan': 'Settings',
            'nav.profile': 'Profile',
            
            'surat.nomor': 'Letter Number',
            'surat.perihal': 'Subject',
            'surat.tanggal': 'Date',
            'surat.pengirim': 'Sender',
            'surat.tujuan': 'Recipient',
            'surat.status': 'Status',
            
            'status.pending': 'Pending',
            'status.proses': 'Processing',
            'status.selesai': 'Completed',
            'status.disetujui': 'Approved',
            'status.ditolak': 'Rejected',
            
            'msg.save_success': 'Data saved successfully',
            'msg.delete_success': 'Data deleted successfully',
            'msg.loading': 'Loading data...'
        }
    };
    
    // ============================================
    // TRANSLATION FUNCTIONS
    // ============================================
    
    /**
     * Get translation for key
     */
    function t(key, params, locale) {
        if (!locale) locale = _currentLocale;
        
        // Get translation
        var translation = getTranslation(key, locale);
        
        // Fallback
        if (translation === key && locale !== config.fallbackLocale) {
            translation = getTranslation(key, config.fallbackLocale);
        }
        
        // Interpolation: {key} → value
        if (params && translation) {
            translation = interpolate(translation, params);
        }
        
        return translation || key;
    }
    
    function getTranslation(key, locale) {
        var dict = _translations[locale] || BUILT_IN[locale];
        if (!dict) return key;
        
        // Support dot notation: 'nav.dashboard' → dict.nav.dashboard
        var parts = key.split('.');
        var value = dict;
        
        for (var i = 0; i < parts.length; i++) {
            if (value && typeof value === 'object' && value[parts[i]] !== undefined) {
                value = value[parts[i]];
            } else {
                return key;
            }
        }
        
        return typeof value === 'string' ? value : key;
    }
    
    function interpolate(text, params) {
        if (!text || typeof text !== 'string') return text;
        
        return text.replace(/\{(\w+)\}/g, function(match, key) {
            return params[key] !== undefined ? String(params[key]) : match;
        });
    }
    
    // ============================================
    // LOCALE MANAGEMENT
    // ============================================
    
    function setLocale(locale) {
        if (config.supportedLocales.indexOf(locale) === -1) {
            console.warn('[I18n] Unsupported locale: ' + locale);
            return false;
        }
        
        if (locale === _currentLocale) return true;
        
        _currentLocale = locale;
        
        // Save
        try {
            localStorage.setItem('app_locale', locale);
        } catch(e) {}
        
        // Update DOM
        updateDOM();
        
        // Set html lang
        document.documentElement.lang = locale;
        
        // Notify listeners
        notifyListeners(locale);
        
        console.info('[I18n] Locale changed: ' + locale);
        
        return true;
    }
    
    function getLocale() {
        return _currentLocale;
    }
    
    function detectLocale() {
        // 1. Saved preference
        try {
            var saved = localStorage.getItem('app_locale');
            if (saved && config.supportedLocales.indexOf(saved) !== -1) {
                return saved;
            }
        } catch(e) {}
        
        // 2. Browser language
        var browserLang = (navigator.language || navigator.userLanguage || '').split('-')[0];
        if (config.supportedLocales.indexOf(browserLang) !== -1) {
            return browserLang;
        }
        
        // 3. Default
        return config.defaultLocale;
    }
    
    // ============================================
    // DOM UPDATES
    // ============================================
    
    function updateDOM() {
        // data-i18n="key"
        updateElements('data-i18n', function(el, key) {
            el.textContent = t(key);
        });
        
        // data-i18n-placeholder="key"
        updateElements('data-i18n-placeholder', function(el, key) {
            el.placeholder = t(key);
        });
        
        // data-i18n-title="key"
        updateElements('data-i18n-title', function(el, key) {
            el.title = t(key);
        });
    }
    
    function updateElements(attribute, callback) {
        var elements = document.querySelectorAll('[' + attribute + ']');
        
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var key = el.getAttribute(attribute);
            
            if (key) {
                callback(el, key);
            }
        }
    }
    
    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    function onLocaleChange(callback) {
        _listeners.push(callback);
        
        // Return unsubscribe
        return function() {
            _listeners = _listeners.filter(function(cb) {
                return cb !== callback;
            });
        };
    }
    
    function notifyListeners(locale) {
        for (var i = 0; i < _listeners.length; i++) {
            try {
                _listeners[i](locale);
            } catch(e) {}
        }
    }
    
    // ============================================
    // TRANSLATION REGISTRATION
    // ============================================
    
    /**
     * Add custom translations
     */
    function addTranslations(locale, translations) {
        if (!_translations[locale]) {
            _translations[locale] = {};
        }
        
        for (var key in translations) {
            if (translations.hasOwnProperty(key)) {
                _translations[locale][key] = translations[key];
            }
        }
        
        // Update DOM jika locale aktif
        if (locale === _currentLocale) {
            updateDOM();
        }
    }
    
    // ============================================
    // FORMAT HELPERS
    // ============================================
    
    function formatDate(date) {
        if (!date) return '';
        try {
            var d = new Date(date);
            if (isNaN(d.getTime())) return String(date);
            
            if (_currentLocale === 'id') {
                return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch(e) {
            return String(date);
        }
    }
    
    function formatNumber(number) {
        if (number === null || number === undefined) return '0';
        try {
            return new Intl.NumberFormat(_currentLocale === 'id' ? 'id-ID' : 'en-US').format(number);
        } catch(e) {
            return String(number);
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init(options) {
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = options[key];
                }
            }
        }
        
        // Detect locale
        _currentLocale = detectLocale();
        
        // Set html lang
        document.documentElement.lang = _currentLocale;
        
        // Initial DOM update
        updateDOM();
        
        console.info('[I18n] Initialized: ' + _currentLocale);
    }
    
    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { init(); });
    } else {
        setTimeout(init, 50);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Core
        t: t,
        setLocale: setLocale,
        getLocale: getLocale,
        
        // Translation management
        addTranslations: addTranslations,
        
        // Listeners
        onLocaleChange: onLocaleChange,
        
        // Format
        formatDate: formatDate,
        formatNumber: formatNumber,
        
        // Config
        getSupportedLocales: function() {
            return config.supportedLocales.slice();
        },
        
        /**
         * Quick translate function (shorthand)
         */
        __: t,
        
        /**
         * Translate with params
         */
        translate: function(key, params) {
            return t(key, params);
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Basic
// I18n.t('app.save'); // → "Simpan"
// 
// // With interpolation
// I18n.t('msg.save_success'); // → "Data berhasil disimpan"
// 
// // Change locale
// I18n.setLocale('en');
// I18n.t('app.save'); // → "Save"
// 
// // Add custom translations
// I18n.addTranslations('id', {
//     'custom.key': 'Terjemahan Kustom'
// });
// 
// // Format
// I18n.formatDate('2024-07-15'); // → "15 Jul 2024"
// I18n.formatNumber(1500000); // → "1.500.000"
// ============================================