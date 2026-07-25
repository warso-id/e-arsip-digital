// js/navigation.js - Navigation Controller 2026
/**
 * E-Arsip Digital - Navigation Controller
 * Version: 2026.1.0
 * Features: Route management, history tracking, navigation guards,
 *           breadcrumb sync, menu highlighting
 */

import { Logger } from './logger.js';
import authService from './auth.js';
import ROUTES_CONFIG from '../config/routes-config.js';
import MENU_CONFIG from '../config/menu-config.js';

class NavigationController {
    constructor() {
        this.logger = new Logger('Navigation');
        
        // Navigation history
        this.history = [];
        this.maxHistory = 50;
        this.currentRoute = null;
        
        // Navigation guards
        this.guards = [];
        
        // Active menu tracking
        this.activeMenuPath = null;
        
        this.init();
    }
    
    init() {
        this.loadHistory();
        this.setupPopStateHandler();
        this.setupLinkInterception();
        this.highlightCurrentMenu();
        
        this.logger.info('Navigation controller initialized');
    }
    
    // ============================================
    // NAVIGATION METHODS
    // ============================================
    
    navigateTo(path, options = {}) {
        const resolvedPath = this.resolvePath(path);
        
        // Run guards
        const guardResult = this.runGuards(resolvedPath);
        if (!guardResult.allowed) {
            this.logger.warn('Navigation blocked by guard', {
                path: resolvedPath,
                reason: guardResult.reason
            });
            
            if (guardResult.redirect) {
                this.navigateTo(guardResult.redirect, { replace: true });
            }
            
            return false;
        }
        
        // Store current route before changing
        if (this.currentRoute) {
            this.addToHistory(this.currentRoute);
        }
        
        // Update current route
        this.currentRoute = {
            path: resolvedPath,
            timestamp: Date.now(),
            title: options.title || this.getPageTitle(resolvedPath)
        };
        
        // Update URL
        this.updateURL(resolvedPath, options.replace);
        
        // Update document title
        if (this.currentRoute.title) {
            document.title = `${this.currentRoute.title} - E-Arsip Digital`;
        }
        
        // Highlight menu
        this.highlightMenu(resolvedPath);
        
        // Dispatch event
        this.dispatchNavigationEvent(resolvedPath);
        
        // Save history
        this.saveHistory();
        
        this.logger.debug('Navigation', { path: resolvedPath, replace: options.replace });
        
        return true;
    }
    
    navigateBack() {
        if (this.history.length > 0) {
            const previous = this.history.pop();
            this.navigateTo(previous.path, { replace: true });
            return true;
        }
        
        // Fallback to dashboard
        this.navigateTo('/dashboard/', { replace: true });
        return false;
    }
    
    navigateToDashboard() {
        const userRole = authService.currentUser?.role || 'user';
        const dashboards = ROUTES_CONFIG.dashboards || {};
        const dashboardPath = dashboards[userRole] || '/dashboard/user/index.html';
        
        this.navigateTo(dashboardPath, { replace: true });
    }
    
    redirectToLogin(reason = '') {
        const loginPath = '/login.html';
        if (reason) {
            this.navigateTo(`${loginPath}?message=${reason}`, { replace: true });
        } else {
            this.navigateTo(loginPath, { replace: true });
        }
    }
    
    // ============================================
    // PATH RESOLUTION
    // ============================================
    
    resolvePath(path) {
        // Handle relative paths
        if (path.startsWith('./') || path.startsWith('../')) {
            const base = this.currentRoute?.path || '/';
            const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
            path = baseDir + path.replace(/^\.\//, '');
        }
        
        // Ensure leading slash
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove trailing slash except root
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        return path;
    }
    
    getPageTitle(path) {
        // Search all route configs for matching path
        const allRoutes = [
            ...(ROUTES_CONFIG.public || []),
            ...(ROUTES_CONFIG.authenticated || []),
            ...(ROUTES_CONFIG.admin || []),
            ...(ROUTES_CONFIG.settings || [])
        ];
        
        const route = allRoutes.find(r => r.path === path || path.startsWith(r.path));
        return route?.title || 'E-Arsip Digital';
    }
    
    // ============================================
    // HISTORY MANAGEMENT
    // ============================================
    
    addToHistory(route) {
        this.history.push(route);
        
        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }
    
    loadHistory() {
        try {
            const stored = sessionStorage.getItem('nav_history');
            if (stored) {
                this.history = JSON.parse(stored);
            }
        } catch {
            this.history = [];
        }
    }
    
    saveHistory() {
        try {
            sessionStorage.setItem('nav_history', JSON.stringify(
                this.history.slice(-20)
            ));
        } catch {
            // Ignore
        }
    }
    
    getHistory() {
        return [...this.history];
    }
    
    clearHistory() {
        this.history = [];
        sessionStorage.removeItem('nav_history');
    }
    
    // ============================================
    // NAVIGATION GUARDS
    // ============================================
    
    addGuard(guardFn) {
        this.guards.push(guardFn);
    }
    
    runGuards(path) {
        for (const guard of this.guards) {
            const result = guard(path, this.currentRoute);
            if (result === false) {
                return { allowed: false, reason: 'Blocked by guard' };
            }
            if (typeof result === 'object' && result.allowed === false) {
                return result;
            }
        }
        
        return { allowed: true };
    }
    
    setupDefaultGuards() {
        // Auth guard for protected routes
        this.addGuard((path) => {
            const publicRoutes = (ROUTES_CONFIG.public || []).map(r => r.path);
            const isPublic = publicRoutes.some(r => path.startsWith(r));
            
            if (!isPublic && !authService.isAuthenticated) {
                return {
                    allowed: false,
                    reason: 'Authentication required',
                    redirect: `/login.html?redirect=${encodeURIComponent(path)}`
                };
            }
            
            return { allowed: true };
        });
        
        // Admin guard
        this.addGuard((path) => {
            const adminRoutes = [
                ...(ROUTES_CONFIG.admin || []).map(r => r.path),
                ...(ROUTES_CONFIG.settings || []).map(r => r.path),
                '/security-monitor.html'
            ];
            
            const isAdminRoute = adminRoutes.some(r => path.startsWith(r));
            
            if (isAdminRoute && !authService.hasRole(['super_admin', 'admin'])) {
                return {
                    allowed: false,
                    reason: 'Admin access required',
                    redirect: '/403.html'
                };
            }
            
            return { allowed: true };
        });
    }
    
    // ============================================
    // URL MANAGEMENT
    // ============================================
    
    updateURL(path, replace = false) {
        const url = new URL(path, window.location.origin);
        
        if (replace) {
            window.history.replaceState({ path, navTimestamp: Date.now() }, '', url);
        } else {
            window.history.pushState({ path, navTimestamp: Date.now() }, '', url);
        }
    }
    
    setupPopStateHandler() {
        window.addEventListener('popstate', (event) => {
            if (event.state?.path) {
                this.currentRoute = {
                    path: event.state.path,
                    timestamp: event.state.navTimestamp || Date.now()
                };
                
                this.highlightMenu(event.state.path);
                this.dispatchNavigationEvent(event.state.path);
            }
        });
    }
    
    setupLinkInterception() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href) return;
            
            // Ignore external links
            if (link.hostname !== window.location.hostname) return;
            
            // Ignore special links
            if (link.hasAttribute('download') ||
                link.hasAttribute('target') ||
                link.hasAttribute('data-nav-ignore') ||
                href.startsWith('#') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                href.startsWith('javascript:')) {
                return;
            }
            
            // Ignore modified clicks
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }
            
            event.preventDefault();
            this.navigateTo(href);
        });
    }
    
    // ============================================
    // MENU HIGHLIGHTING
    // ============================================
    
    highlightCurrentMenu() {
        const currentPath = window.location.pathname;
        this.highlightMenu(currentPath);
    }
    
    highlightMenu(path) {
        this.activeMenuPath = path;
        
        // Remove active from all menu items
        document.querySelectorAll('.nav-item, .sidebar .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Find and highlight matching menu item
        document.querySelectorAll('.nav-item[href]').forEach(item => {
            const itemPath = item.getAttribute('href');
            
            if (itemPath && this.pathsMatch(path, itemPath)) {
                item.classList.add('active');
                
                // Expand parent section if exists
                const parentSection = item.closest('.nav-section');
                if (parentSection) {
                    parentSection.classList.remove('collapsed');
                }
            }
        });
        
        // Update breadcrumb if exists
        this.updateBreadcrumb(path);
    }
    
    pathsMatch(currentPath, menuPath) {
        // Exact match
        if (currentPath === menuPath) return true;
        
        // Current path starts with menu path (for sub-pages)
        if (menuPath !== '/' && menuPath !== '/dashboard/' && 
            currentPath.startsWith(menuPath.replace(/\/$/, ''))) {
            return true;
        }
        
        return false;
    }
    
    updateBreadcrumb(path) {
        const breadcrumb = document.querySelector('.breadcrumb');
        if (!breadcrumb) return;
        
        // Breadcrumb update is handled by the Breadcrumb component
        if (window.breadcrumb) {
            window.breadcrumb.refresh();
        }
    }
    
    // ============================================
    // MENU GENERATION
    // ============================================
    
    getMenuForRole(role) {
        const menus = MENU_CONFIG?.sidebar || {};
        return menus[role] || menus.user || [];
    }
    
    buildSidebarMenu(role) {
        const menuItems = this.getMenuForRole(role);
        const container = document.querySelector('.sidebar-nav');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        menuItems.forEach(item => {
            if (item.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'nav-divider';
                if (item.label) divider.textContent = item.label;
                container.appendChild(divider);
            } else if (item.type === 'section') {
                container.appendChild(this.createMenuSection(item));
            } else {
                container.appendChild(this.createMenuItem(item));
            }
        });
        
        this.highlightCurrentMenu();
    }
    
    createMenuItem(config) {
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
    
    createMenuSection(config) {
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
        
        (config.children || []).forEach(child => {
            body.appendChild(this.createMenuItem(child));
        });
        
        section.appendChild(header);
        section.appendChild(body);
        
        header.addEventListener('click', () => {
            section.classList.toggle('collapsed');
        });
        
        return section;
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    dispatchNavigationEvent(path) {
        window.dispatchEvent(new CustomEvent('nav:navigate', {
            detail: {
                path,
                route: this.currentRoute,
                history: this.getHistory()
            }
        }));
    }
    
    onNavigate(callback) {
        window.addEventListener('nav:navigate', (e) => callback(e.detail));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getCurrentPath() {
        return this.currentRoute?.path || window.location.pathname;
    }
    
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    isActive(path) {
        return this.activeMenuPath === path || 
               this.activeMenuPath?.startsWith(path + '/');
    }
    
    refresh() {
        this.highlightCurrentMenu();
    }
    
    destroy() {
        this.history = [];
        this.guards = [];
        this.logger.info('Navigation controller destroyed');
    }
}

// Create singleton
const navigation = new NavigationController();

// Setup default guards
navigation.setupDefaultGuards();

export default navigation;
export { NavigationController };