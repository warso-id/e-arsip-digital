// components/breadcrumb.js - Breadcrumb Navigation 2026 (SECURE)
/**
 * E-Arsip Digital - Breadcrumb Component
 * Version: 2026.1.0
 * 
 * Automatically generates breadcrumb navigation based on current URL.
 * Supports role-based home URL, custom route mappings, and PWA.
 * 
 * Usage:
 *   <nav class="breadcrumb" id="myBreadcrumb"></nav>
 *   <script>
 *     Breadcrumb.init({ container: '#myBreadcrumb' });
 *   </script>
 */

var Breadcrumb = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _instances = {};
    var _instanceId = 0;
    
    // ============================================
    // ROLE-BASED HOME ROUTES
    // ============================================
    var HOME_ROUTES = {
        'super_admin': '../dashboard/super-admin/index.html',
        'admin': '../dashboard/admin/index.html',
        'kasubag': '../dashboard/kasubag/index.html',
        'kaprodi': '../dashboard/kaprodi/index.html',
        'wadek': '../dashboard/wadek/index.html',
        'dekan': '../dashboard/dekan/index.html',
        'staf': '../dashboard/staf/index.html',
        'dosen': '../dashboard/dosen/index.html',
        'mahasiswa': '../dashboard/mahasiswa/index.html',
        'user': '../dashboard/user/index.html',
        'default': '../dashboard/'
    };
    
    // ============================================
    // LABEL MAPPINGS (LENGKAP)
    // ============================================
    var LABEL_MAP = {
        // Dashboard
        'index': 'Dashboard',
        'dashboard': 'Dashboard',
        
        // Surat Keluar
        'surat-keluar': 'Surat Keluar',
        'list': 'Daftar',
        'form': 'Form',
        'preview': 'Preview',
        'approval': 'Approval',
        'draft': 'Draft',
        'generate': 'Generate',
        'qrcode': 'QR Code',
        'verify': 'Verifikasi',
        
        // Surat Masuk
        'surat-masuk': 'Surat Masuk',
        'agenda': 'Agenda',
        'buku-agenda': 'Buku Agenda',
        'disposisi': 'Disposisi',
        'disposisi-cetak': 'Cetak Disposisi',
        'tracking': 'Tracking',
        'detail': 'Detail',
        
        // Admin
        'super-admin': 'Super Admin',
        'admin-dekan': 'Admin Dekan',
        'admin-kaprodi': 'Admin Kaprodi',
        'admin-wadek': 'Admin Wadek',
        
        // Roles
        'kaprodi': 'Kaprodi',
        'wadek': 'Wakil Dekan',
        'dekan': 'Dekan',
        'kasubag': 'Kasubag',
        'ketua-upm': 'Ketua UPM',
        'litdianmas': 'Litdianmas',
        'staf': 'Staf',
        'dosen': 'Dosen',
        'lembaga-kemahasiswaan': 'Lembaga Kemahasiswaan',
        'mahasiswa': 'Mahasiswa',
        'user': 'User',
        
        // Management
        'manajemen-user': 'Manajemen User',
        'log-aktivitas': 'Log Aktivitas',
        'notifikasi': 'Notifikasi',
        'laporan': 'Laporan',
        'pengaturan': 'Pengaturan',
        'profile': 'Profil',
        'profil': 'Profil',
        'backup': 'Backup',
        'penomoran': 'Penomoran',
        'tanda-tangan': 'Tanda Tangan',
        'help': 'Bantuan',
        'error': 'Error',
        '403': 'Akses Ditolak',
        '404': 'Tidak Ditemukan',
        '500': 'Kesalahan Server'
    };
    
    // ============================================
    // SANITIZATION
    // ============================================
    function sanitizeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    function sanitizeURL(url) {
        if (!url) return '#';
        // Hanya izinkan path relatif
        if (/^\.\.?\//.test(url)) return url;
        if (/^\//.test(url)) return url;
        return './' + url;
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function formatLabel(segment) {
        if (!segment) return '';
        
        // Remove file extension
        var label = segment.replace(/\.(html|php|jsp|asp)$/i, '');
        
        // Remove query string
        label = label.split('?')[0];
        
        // Check label map first
        if (LABEL_MAP[label.toLowerCase()]) {
            return LABEL_MAP[label.toLowerCase()];
        }
        
        // Replace hyphens and underscores with spaces
        label = label.replace(/[-_]/g, ' ');
        
        // Capitalize each word
        label = label.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        
        return label;
    }
    
    function getHomeURL() {
        // Check session for role
        try {
            var sessionStr = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (sessionStr) {
                var session = JSON.parse(sessionStr);
                if (session.user && session.user.role && HOME_ROUTES[session.user.role]) {
                    return HOME_ROUTES[session.user.role];
                }
            }
        } catch(e) {
            // Invalid session
        }
        
        return HOME_ROUTES['default'];
    }
    
    function getCurrentPath() {
        var path = window.location.pathname;
        
        // Decode URI
        try {
            path = decodeURIComponent(path);
        } catch(e) {
            // Invalid URI
        }
        
        // Remove base path if on GitHub Pages
        // Adjust this based on your deployment
        var basePath = '';
        if (path.indexOf('/arsip-surat-digital-enterprise/') === 0) {
            basePath = '/arsip-surat-digital-enterprise';
            path = path.substring(basePath.length);
        }
        
        return { path: path, basePath: basePath };
    }
    
    // ============================================
    // BREADCRUMB CLASS
    // ============================================
    function BreadcrumbInstance(options) {
        var self = this;
        var id = ++_instanceId;
        _instances[id] = this;
        
        // Default config
        this.config = {
            container: '.breadcrumb',
            separator: '/',
            homeLabel: 'Dashboard',
            homeIcon: 'fa-home',
            autoGenerate: true,
            maxItems: 6,
            showHome: true,
            enableLinks: true
        };
        
        // Merge options
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    this.config[key] = options[key];
                }
            }
        }
        
        this.routes = options && options.routes ? options.routes : {};
        this.containerEl = null;
        
        // Initialize
        if (this.config.autoGenerate) {
            this.init();
        }
        
        // Public API
        return {
            render: function(items) { self.render(items); },
            update: function(items) { self.render(items); },
            refresh: function() { self.render(); },
            setRoutes: function(routes) { self.routes = routes; },
            destroy: function() { self.destroy(); }
        };
    }
    
    BreadcrumbInstance.prototype.init = function() {
        this.containerEl = document.querySelector(this.config.container);
        if (this.containerEl) {
            this.containerEl.setAttribute('role', 'navigation');
            this.containerEl.setAttribute('aria-label', 'Breadcrumb');
            this.render();
        }
    };
    
    BreadcrumbInstance.prototype.render = function(items) {
        var container = this.containerEl || document.querySelector(this.config.container);
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Generate items
        var breadcrumbItems = items || this.generateFromURL();
        
        // Limit items
        if (breadcrumbItems.length > this.config.maxItems) {
            var start = breadcrumbItems.slice(0, 2);
            var end = breadcrumbItems.slice(-2);
            breadcrumbItems = start.concat([{ label: '...', url: null, isEllipsis: true }], end);
        }
        
        // Home link
        if (this.config.showHome) {
            var homeLi = document.createElement('span');
            homeLi.className = 'breadcrumb-item';
            
            var homeLink = document.createElement('a');
            homeLink.href = sanitizeURL(getHomeURL());
            homeLink.innerHTML = '<i class="fas ' + sanitizeHTML(this.config.homeIcon) + '" aria-hidden="true"></i> ' + sanitizeHTML(this.config.homeLabel);
            homeLink.setAttribute('aria-label', 'Kembali ke Dashboard');
            homeLi.appendChild(homeLink);
            container.appendChild(homeLi);
            
            // Separator after home
            if (breadcrumbItems.length > 0) {
                var homeSep = document.createElement('span');
                homeSep.className = 'breadcrumb-separator';
                homeSep.setAttribute('aria-hidden', 'true');
                homeSep.textContent = this.config.separator;
                container.appendChild(homeSep);
            }
        }
        
        // Items
        breadcrumbItems.forEach(function(item, index) {
            var isLast = index === breadcrumbItems.length - 1;
            
            if (item.isEllipsis) {
                var ellipsisSpan = document.createElement('span');
                ellipsisSpan.className = 'breadcrumb-ellipsis';
                ellipsisSpan.textContent = '...';
                ellipsisSpan.setAttribute('aria-hidden', 'true');
                container.appendChild(ellipsisSpan);
                
                var ellipsisSep = document.createElement('span');
                ellipsisSep.className = 'breadcrumb-separator';
                ellipsisSep.setAttribute('aria-hidden', 'true');
                ellipsisSep.textContent = self.config.separator;
                container.appendChild(ellipsisSep);
                return;
            }
            
            var itemSpan = document.createElement('span');
            itemSpan.className = 'breadcrumb-item' + (isLast ? ' active' : '');
            
            if (isLast || !self.config.enableLinks) {
                // Last item - plain text
                itemSpan.textContent = sanitizeHTML(item.label);
                itemSpan.setAttribute('aria-current', 'page');
            } else {
                // Link
                var itemLink = document.createElement('a');
                itemLink.href = sanitizeURL(item.url || '#');
                itemLink.textContent = sanitizeHTML(item.label);
                itemSpan.appendChild(itemLink);
            }
            
            container.appendChild(itemSpan);
            
            // Separator (not after last)
            if (!isLast) {
                var sep = document.createElement('span');
                sep.className = 'breadcrumb-separator';
                sep.setAttribute('aria-hidden', 'true');
                sep.textContent = self.config.separator;
                container.appendChild(sep);
            }
        });
    };
    
    BreadcrumbInstance.prototype.generateFromURL = function() {
        var pathInfo = getCurrentPath();
        var path = pathInfo.path;
        var basePath = pathInfo.basePath;
        
        var segments = path.split('/').filter(function(s) { return s && s.length > 0; });
        
        var items = [];
        var currentPath = basePath;
        
        segments.forEach(function(segment, index) {
            currentPath += '/' + segment;
            
            // Check custom routes first
            var label = '';
            if (self.routes && self.routes[currentPath]) {
                label = self.routes[currentPath];
            } else {
                label = formatLabel(segment);
            }
            
            items.push({
                label: label,
                url: currentPath,
                isLast: index === segments.length - 1
            });
        });
        
        return items;
    };
    
    BreadcrumbInstance.prototype.destroy = function() {
        if (this.containerEl) {
            this.containerEl.innerHTML = '';
        }
        delete _instances[this._id];
    };
    
    // Fix: self reference
    var self;
    
    // ============================================
    // PUBLIC STATIC API
    // ============================================
    return {
        /**
         * Initialize breadcrumb
         * @param {Object} options - Configuration options
         * @returns {Object} Breadcrumb instance API
         */
        init: function(options) {
            return new BreadcrumbInstance(options);
        },
        
        /**
         * Get home URL based on current user role
         * @returns {string} Home URL
         */
        getHomeURL: getHomeURL,
        
        /**
         * Format a path segment to readable label
         * @param {string} segment - Path segment
         * @returns {string} Formatted label
         */
        formatLabel: formatLabel,
        
        /**
         * Add custom label mapping
         * @param {string} key - Path segment
         * @param {string} label - Display label
         */
        addLabel: function(key, label) {
            LABEL_MAP[key.toLowerCase()] = label;
        },
        
        /**
         * Add custom home route
         * @param {string} role - User role
         * @param {string} url - Home URL
         */
        addHomeRoute: function(role, url) {
            HOME_ROUTES[role] = url;
        },
        
        /**
         * Get all registered label mappings
         * @returns {Object} Label mappings
         */
        getLabels: function() {
            return Object.assign({}, LABEL_MAP);
        },
        
        /**
         * Get all home routes
         * @returns {Object} Home routes
         */
        getHomeRoutes: function() {
            return Object.assign({}, HOME_ROUTES);
        }
    };
})();

// ============================================
// AUTO-INITIALIZE ON DOM READY
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    var breadcrumbEls = document.querySelectorAll('.breadcrumb[data-auto-init]');
    breadcrumbEls.forEach(function(el) {
        var options = {};
        try {
            var dataOptions = el.getAttribute('data-options');
            if (dataOptions) {
                options = JSON.parse(dataOptions);
            }
        } catch(e) {
            // Invalid JSON
        }
        options.container = '#' + (el.id || 'breadcrumb-' + Date.now());
        if (!el.id) el.id = options.container.replace('#', '');
        Breadcrumb.init(options);
    });
    
    // Also auto-init if .breadcrumb exists without data-auto-init (backward compat)
    var autoEls = document.querySelectorAll('.breadcrumb:not([data-auto-init])');
    if (autoEls.length > 0) {
        autoEls.forEach(function(el) {
            if (!el.hasAttribute('data-manual')) {
                var options = {};
                if (!el.id) {
                    el.id = 'breadcrumb-auto-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                }
                options.container = '#' + el.id;
                Breadcrumb.init(options);
            }
        });
    }
});