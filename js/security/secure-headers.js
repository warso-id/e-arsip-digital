// js/security/secure-headers.js - Secure Headers Manager 2026 (SECURE)
/**
 * E-Arsip Digital - Secure Headers Manager
 * Version: 2026.1.0
 * 
 * CATATAN PENTING:
 * - Security headers utama HARUS di-set di SERVER (Nginx/Apache)
 * - Modul ini untuk CLIENT-SIDE CSP management via meta tag
 * - Tidak bisa set HSTS, X-Frame-Options, dll dari client
 * - Hanya CSP yang bisa di-manage via <meta> tag
 */

var SecureHeaders = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    
    /**
     * Build CSP yang AMAN untuk PWA + CDN
     * - Tidak ada 'unsafe-inline' jika memungkinkan
     * - Whitelist CDN yang digunakan
     * - PWA compatible (frame-ancestors, manifest, worker)
     */
    function buildCSP(options) {
        if (!options) options = {};
        
        var directives = {
            // Default
            'default-src': ["'self'"],
            
            // Scripts: Izinkan CDN + Google Scripts
            'script-src': [
                "'self'",
                "'unsafe-inline'",      // Diperlukan untuk inline scripts
                "'unsafe-eval'",         // Diperlukan untuk beberapa library
                'https://apis.google.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://unpkg.com',
                'https://script.google.com',
                'https://script.googleusercontent.com'
            ],
            
            // Styles: Izinkan CDN + inline
            'style-src': [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://unpkg.com'
            ],
            
            // Images: Izinkan self + data URIs + HTTPS
            'img-src': [
                "'self'",
                'data:',
                'blob:',
                'https:'
            ],
            
            // Fonts: Izinkan self + CDN
            'font-src': [
                "'self'",
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com'
            ],
            
            // Connections: Izinkan self + Google Scripts + CDN
            'connect-src': [
                "'self'",
                'https://script.google.com',
                'https://script.googleusercontent.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com'
            ],
            
            // Frame: Izinkan self + Google Scripts
            'frame-src': [
                "'self'",
                'https://script.google.com'
            ],
            
            // Frame ancestors: 'self' untuk PWA compatibility
            // NOTE: 'none' akan merusak PWA standalone!
            'frame-ancestors': ["'self'"],
            
            // Form actions
            'form-action': [
                "'self'",
                'https://script.google.com'
            ],
            
            // Base URI
            'base-uri': ["'self'"],
            
            // Object/Plugin: Block semua
            'object-src': ["'none'"],
            
            // PWA: Izinkan manifest + worker
            'manifest-src': ["'self'"],
            'worker-src': ["'self'", 'blob:'],
            
            // Media
            'media-src': ["'self'"],
            
            // Upgrade insecure requests (HTTPS)
            'upgrade-insecure-requests': []
        };
        
        // Merge options
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && directives.hasOwnProperty(key)) {
                    directives[key] = options[key];
                }
            }
        }
        
        // Build CSP string
        var parts = [];
        for (var directive in directives) {
            if (directives.hasOwnProperty(directive)) {
                var values = directives[directive];
                if (values.length === 0) {
                    parts.push(directive);
                } else {
                    parts.push(directive + ' ' + values.join(' '));
                }
            }
        }
        
        return parts.join('; ');
    }
    
    // ============================================
    // META TAG MANAGEMENT
    // ============================================
    
    /**
     * Inject or update CSP meta tag
     */
    function applyCSP(cspString) {
        if (!cspString) return;
        
        // Cari existing CSP meta tag
        var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        
        if (!meta) {
            // Buat baru
            meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            document.head.appendChild(meta);
        }
        
        meta.content = cspString;
        
        console.info('[SecureHeaders] CSP applied (' + cspString.length + ' chars)');
    }
    
    /**
     * Update directive dalam CSP yang sudah ada
     */
    function updateCSPDirective(directive, values) {
        // Parse existing CSP
        var existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        var existingCSP = existingMeta ? existingMeta.content : '';
        
        var directives = parseCSP(existingCSP);
        
        // Update directive
        directives[directive] = Array.isArray(values) ? values : [values];
        
        // Rebuild
        var newCSP = buildCSPFromDirectives(directives);
        applyCSP(newCSP);
        
        return newCSP;
    }
    
    /**
     * Parse CSP string ke object
     */
    function parseCSP(cspString) {
        var directives = {};
        if (!cspString) return directives;
        
        var parts = cspString.split(';');
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i].trim();
            if (!part) continue;
            
            var spaceIndex = part.indexOf(' ');
            if (spaceIndex === -1) {
                directives[part] = [];
            } else {
                var key = part.substring(0, spaceIndex);
                var values = part.substring(spaceIndex + 1).split(/\s+/);
                directives[key] = values;
            }
        }
        
        return directives;
    }
    
    /**
     * Build CSP string dari directives object
     */
    function buildCSPFromDirectives(directives) {
        var parts = [];
        for (var key in directives) {
            if (directives.hasOwnProperty(key)) {
                var values = directives[key];
                if (values.length === 0) {
                    parts.push(key);
                } else {
                    parts.push(key + ' ' + values.join(' '));
                }
            }
        }
        return parts.join('; ');
    }
    
    // ============================================
    // HEADER CHECK (Informational)
    // ============================================
    
    /**
     * Check if page is served over HTTPS
     */
    function isHTTPS() {
        return window.location.protocol === 'https:';
    }
    
    /**
     * Get security recommendations
     */
    function getRecommendations() {
        var recommendations = [];
        
        // Check HTTPS
        if (!isHTTPS()) {
            recommendations.push({
                priority: 'critical',
                header: 'HTTPS',
                message: 'Halaman tidak menggunakan HTTPS. Semua header keamanan memerlukan HTTPS.'
            });
        }
        
        // Check CSP
        var cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!cspMeta) {
            recommendations.push({
                priority: 'high',
                header: 'Content-Security-Policy',
                message: 'CSP meta tag tidak ditemukan. Tambahkan untuk mencegah XSS.'
            });
        }
        
        // Check if served from CDN (headers set by server)
        recommendations.push({
            priority: 'info',
            header: 'Server Headers',
            message: 'Header seperti HSTS, X-Frame-Options, X-Content-Type-Options harus di-set di server (Nginx/Apache).'
        });
        
        return recommendations;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        /**
         * Build CSP string
         */
        buildCSP: buildCSP,
        
        /**
         * Apply CSP ke halaman (meta tag)
         */
        applyCSP: applyCSP,
        
        /**
         * Update satu directive di CSP
         */
        updateDirective: updateCSPDirective,
        
        /**
         * Parse CSP string ke object
         */
        parseCSP: parseCSP,
        
        /**
         * Get current CSP dari meta tag
         */
        getCurrentCSP: function() {
            var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta ? meta.content : '';
        },
        
        /**
         * Check if HTTPS
         */
        isHTTPS: isHTTPS,
        
        /**
         * Get security recommendations
         */
        getRecommendations: getRecommendations,
        
        /**
         * Generate report
         */
        generateReport: function() {
            var csp = '';
            var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            if (meta) csp = meta.content;
            
            return {
                timestamp: new Date().toISOString(),
                https: isHTTPS(),
                csp: csp,
                cspLength: csp.length,
                recommendations: getRecommendations()
            };
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Build and apply CSP
// var csp = SecureHeaders.buildCSP();
// SecureHeaders.applyCSP(csp);
// 
// // Update one directive
// SecureHeaders.updateDirective('script-src', ["'self'", 'https://new-cdn.com']);
// 
// // Get report
// var report = SecureHeaders.generateReport();
// ============================================