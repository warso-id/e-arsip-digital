// components/sidebar.js - Advanced Sidebar Component 2026
/**
 * E-Arsip Digital - Sidebar Component
 * Version: 2026.1.0
 * Features: Collapsible, responsive, mobile-friendly, role-based menu
 */

import { Logger } from '../js/logger.js';
import authService from '../js/auth.js';
import router from '../js/router.js';

class Sidebar {
    constructor(options = {}) {
        this.logger = new Logger('Sidebar');
        
        this.config = {
            container: '#sidebar',
            toggleButton: '#sidebar-toggle',
            mobileBreakpoint: 768,
            collapsed: false,
            saveState: true,
            animate: true,
            ...options
        };
        
        this.state = {
            collapsed: this.config.collapsed,
            mobileOpen: false,
            activeItem: null
        };
        
        this.container = null;
        this.toggleButton = null;
        this.overlay = null;
        
        this.init();
    }
    
    init() {
        this.container = document.querySelector(this.config.container);
        this.toggleButton = document.querySelector(this.config.toggleButton);
        
        if (!this.container) {
            this.logger.warn('Sidebar container not found');
            return;
        }
        
        this.loadState();
        this.setupOverlay();
        this.setupEventListeners();
        this.setupResponsive();
        this.highlightActiveItem();
        
        this.logger.info('Sidebar initialized');
    }
    
    loadState() {
        if (this.config.saveState) {
            try {
                const saved = localStorage.getItem('sidebar_collapsed');
                if (saved !== null) {
                    this.state.collapsed = saved === 'true';
                }
            } catch (e) {
                // Ignore
            }
        }
        
        this.updateUI();
    }
    
    saveState() {
        if (this.config.saveState) {
            try {
                localStorage.setItem('sidebar_collapsed', this.state.collapsed.toString());
            } catch (e) {
                // Ignore
            }
        }
    }
    
    setupOverlay() {
        if (document.querySelector('.sidebar-overlay')) return;
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 998;
            display: none;
            transition: opacity 0.3s;
        `;
        
        document.body.appendChild(this.overlay);
        
        this.overlay.addEventListener('click', () => this.closeMobile());
    }
    
    setupEventListeners() {
        // Toggle button
        this.toggleButton?.addEventListener('click', () => this.toggle());
        
        // Sidebar links
        this.container.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.setActiveItem(item);
                
                // Close mobile sidebar on navigation
                if (window.innerWidth <= this.config.mobileBreakpoint) {
                    this.closeMobile();
                }
            });
        });
        
        // Collapsible sections
        this.container.querySelectorAll('.nav-section-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                section.classList.toggle('collapsed');
            });
        });
        
        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggle();
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => this.setupResponsive());
    }
    
    setupResponsive() {
        if (window.innerWidth <= this.config.mobileBreakpoint) {
            this.container.classList.add('mobile');
            if (!this.state.mobileOpen) {
                this.container.classList.add('closed');
            }
        } else {
            this.container.classList.remove('mobile', 'closed');
            this.state.mobileOpen = false;
            this.hideOverlay();
        }
        
        this.updateUI();
    }
    
    toggle() {
        if (window.innerWidth <= this.config.mobileBreakpoint) {
            this.state.mobileOpen ? this.closeMobile() : this.openMobile();
        } else {
            this.state.collapsed = !this.state.collapsed;
            this.updateUI();
            this.saveState();
        }
        
        this.dispatchEvent('toggle', {
            collapsed: this.state.collapsed,
            mobileOpen: this.state.mobileOpen
        });
    }
    
    openMobile() {
        this.state.mobileOpen = true;
        this.container.classList.remove('closed');
        this.showOverlay();
        document.body.style.overflow = 'hidden';
    }
    
    closeMobile() {
        this.state.mobileOpen = false;
        this.container.classList.add('closed');
        this.hideOverlay();
        document.body.style.overflow = '';
    }
    
    collapse() {
        this.state.collapsed = true;
        this.updateUI();
        this.saveState();
    }
    
    expand() {
        this.state.collapsed = false;
        this.updateUI();
        this.saveState();
    }
    
    updateUI() {
        if (this.state.collapsed) {
            this.container.classList.add('collapsed');
        } else {
            this.container.classList.remove('collapsed');
        }
        
        // Update toggle button icon
        const icon = this.toggleButton?.querySelector('i');
        if (icon) {
            icon.className = this.state.collapsed 
                ? 'fas fa-chevron-right' 
                : 'fas fa-chevron-left';
        }
        
        // Update main content margin
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            if (this.state.collapsed) {
                mainContent.classList.add('sidebar-collapsed');
            } else {
                mainContent.classList.remove('sidebar-collapsed');
            }
        }
    }
    
    showOverlay() {
        if (this.overlay) {
            this.overlay.style.display = 'block';
            setTimeout(() => this.overlay.style.opacity = '1', 10);
        }
    }
    
    hideOverlay() {
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            setTimeout(() => this.overlay.style.display = 'none', 300);
        }
    }
    
    setActiveItem(item) {
        // Remove active from all items
        this.container.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        
        // Add active to selected item
        item.classList.add('active');
        this.state.activeItem = item;
    }
    
    highlightActiveItem() {
        const currentPath = window.location.pathname;
        
        this.container.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href && currentPath.startsWith(href)) {
                item.classList.add('active');
                this.state.activeItem = item;
            }
        });
    }
    
    // ============================================
    // MENU BUILDER
    // ============================================
    
    buildMenu(menuConfig) {
        const nav = this.container.querySelector('.sidebar-nav');
        if (!nav) return;
        
        nav.innerHTML = '';
        
        menuConfig.forEach(item => {
            if (item.divider) {
                nav.appendChild(this.createDivider(item.label));
            } else if (item.children) {
                nav.appendChild(this.createSection(item));
            } else {
                nav.appendChild(this.createItem(item));
            }
        });
        
        this.highlightActiveItem();
    }
    
    createItem(config) {
        // Check role access
        if (config.roles && !authService.hasRole(config.roles)) return document.createDocumentFragment();
        
        const link = document.createElement('a');
        link.href = config.path || '#';
        link.className = 'nav-item';
        
        if (config.icon) {
            const icon = document.createElement('i');
            icon.className = `fas fa-${config.icon}`;
            link.appendChild(icon);
        }
        
        const label = document.createElement('span');
        label.textContent = config.label;
        link.appendChild(label);
        
        if (config.badge) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = config.badge;
            link.appendChild(badge);
        }
        
        return link;
    }
    
    createSection(config) {
        const section = document.createElement('div');
        section.className = 'nav-section';
        
        const header = document.createElement('div');
        header.className = 'nav-section-header';
        header.innerHTML = `
            <i class="fas fa-${config.icon || 'folder'}"></i>
            <span>${config.label}</span>
            <i class="fas fa-chevron-down section-arrow"></i>
        `;
        
        const body = document.createElement('div');
        body.className = 'nav-section-body';
        
        config.children.forEach(child => {
            body.appendChild(this.createItem(child));
        });
        
        section.appendChild(header);
        section.appendChild(body);
        
        header.addEventListener('click', () => section.classList.toggle('collapsed'));
        
        return section;
    }
    
    createDivider(label) {
        const divider = document.createElement('div');
        divider.className = 'nav-divider';
        if (label) {
            divider.textContent = label;
        }
        return divider;
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    dispatchEvent(name, detail) {
        window.dispatchEvent(new CustomEvent(`sidebar:${name}`, { detail }));
    }
    
    on(event, callback) {
        window.addEventListener(`sidebar:${event}`, (e) => callback(e.detail));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    isCollapsed() {
        return this.state.collapsed;
    }
    
    isMobileOpen() {
        return this.state.mobileOpen;
    }
    
    getActiveItem() {
        return this.state.activeItem;
    }
    
    destroy() {
        this.overlay?.remove();
        this.container = null;
        this.logger.info('Sidebar destroyed');
    }
}

// Create singleton
const sidebar = new Sidebar();

export default sidebar;
export { Sidebar };