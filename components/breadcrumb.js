// components/breadcrumb.js - Breadcrumb Navigation 2026
/**
 * E-Arsip Digital - Breadcrumb Component
 * Version: 2026.1.0
 * Automatically generates breadcrumb navigation based on current URL
 */

import { Logger } from '../js/logger.js';

class Breadcrumb {
    constructor(options = {}) {
        this.logger = new Logger('Breadcrumb');
        
        this.config = {
            container: '.breadcrumb',
            separator: '/',
            homeLabel: 'Dashboard',
            homeIcon: 'fa-home',
            homeUrl: '../dashboard/',
            autoGenerate: true,
            ...options
        };
        
        this.routes = options.routes || {};
        
        if (this.config.autoGenerate) {
            this.init();
        }
    }
    
    init() {
        this.render();
        this.logger.info('Breadcrumb initialized');
    }
    
    render(items = null) {
        const container = document.querySelector(this.config.container);
        if (!container) return;
        
        const breadcrumbItems = items || this.generateFromURL();
        
        container.innerHTML = '';
        
        // Home link
        const homeLink = document.createElement('a');
        homeLink.href = this.config.homeUrl;
        homeLink.innerHTML = `<i class="fas ${this.config.homeIcon}"></i> ${this.config.homeLabel}`;
        container.appendChild(homeLink);
        
        // Separator
        const homeSep = document.createElement('span');
        homeSep.className = 'breadcrumb-separator';
        homeSep.textContent = this.config.separator;
        container.appendChild(homeSep);
        
        // Items
        breadcrumbItems.forEach((item, index) => {
            if (index === breadcrumbItems.length - 1) {
                // Last item is plain text
                const span = document.createElement('span');
                span.className = 'breadcrumb-current';
                span.textContent = item.label;
                container.appendChild(span);
            } else {
                // Link
                const link = document.createElement('a');
                link.href = item.url || '#';
                link.textContent = item.label;
                container.appendChild(link);
                
                // Separator
                const sep = document.createElement('span');
                sep.className = 'breadcrumb-separator';
                sep.textContent = this.config.separator;
                container.appendChild(sep);
            }
        });
    }
    
    generateFromURL() {
        const path = window.location.pathname;
        const segments = path.split('/').filter(s => s);
        
        const items = [];
        let currentPath = '';
        
        segments.forEach((segment, index) => {
            currentPath += '/' + segment;
            
            // Check for custom labels
            const label = this.routes[currentPath] || 
                         this.formatLabel(segment);
            
            items.push({
                label,
                url: currentPath,
                isLast: index === segments.length - 1
            });
        });
        
        return items;
    }
    
    formatLabel(segment) {
        // Remove file extension
        let label = segment.replace(/\.(html|php)$/, '');
        
        // Replace hyphens and underscores with spaces
        label = label.replace(/[-_]/g, ' ');
        
        // Capitalize
        label = label.replace(/\b\w/g, c => c.toUpperCase());
        
        // Special mappings
        const specialMap = {
            'Surat Keluar': 'Surat Keluar',
            'Surat Masuk': 'Surat Masuk',
            'Manajemen User': 'Manajemen User',
            'Log Aktivitas': 'Log Aktivitas',
            'Index': 'Daftar',
            'Form': 'Form',
            'List': 'Daftar',
            'Preview': 'Preview',
            'Approval': 'Approval',
            'Draft': 'Draft',
            'Generate': 'Generate',
            'Qrcode': 'QR Code',
            'Disposisi': 'Disposisi',
            'Agenda': 'Agenda',
            'Buku Agenda': 'Buku Agenda',
            'Tracking': 'Tracking',
            'Pengaturan': 'Pengaturan',
            'Penomoran': 'Penomoran',
            'Tanda Tangan': 'Tanda Tangan',
            'Backup': 'Backup & Restore'
        };
        
        return specialMap[label] || label;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    setRoutes(routes) {
        this.routes = routes;
    }
    
    update(items) {
        this.render(items);
    }
    
    refresh() {
        this.render();
    }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const breadcrumbEl = document.querySelector('.breadcrumb');
    if (breadcrumbEl) {
        window.breadcrumb = new Breadcrumb();
    }
});

export default Breadcrumb;
export { Breadcrumb };