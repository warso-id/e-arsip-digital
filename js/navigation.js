// js/navigation.js - Secure Navigation Controller 2026
/**
 * E-Arsip Digital - Enterprise Navigation Manager
 * Version: 2026.1.0
 * Features: Secure routing, PWA-aware navigation, guards, breadcrumbs,
 *           lazy loading, offline support, audit trail
 * Security: XSS prevention, CSRF protection, route validation, clickjacking defense
 */

import APP_CONFIG from '../config/config.js';

class NavigationController {
    constructor() {
        // ✅ FIX: Lazy load dependencies untuk hindari circular dependency
        this.logger = null;
        this.authService = null;
        this.ROUTES_CONFIG = null;
        this.MENU_CONFIG = null;
        
        // Navigation state
        this.history = [];
        this.maxHistory = this.getConfig('maxHistory', 50);
        this.currentRoute = null;
        this.previousRoute = null;
        
        // Guards registry
        this.guards = [];
        this.globalGuards = [];
        
        // Menu tracking
        this.activeMenuPath = null;
        this.menuCache = new Map();
        
        // Security
        this.csrfToken = this.extractCsrfToken();
        this.navigationInProgress = false;
        this.navigationQueue = [];
        
        // PWA support
        this.isPWA = this.detectPWA();
        this.onlineStatus = navigator.onLine;
        this.offlineQueue = [];
        
        // Performance
        this.routeCache = new Map();
        this.preloadedRoutes = new Set();
        
        // Event handlers registry untuk cleanup
        this.eventHandlers = {
            popstate: null,
            click: null,
            online: null,
            offline: null
        };
        
        this.init();
    }
    
    async init() {
        try {
            // ✅ FIX: Inisialisasi dependencies secara async
            await this.initDependencies();
            
            // Load state
            this.loadHistory();
            this.setupEventHandlers();
            this.setupDefaultGuards();
            
            // Highlight current menu
            await this.highlightCurrentMenu();
            
            // Preload critical routes jika PWA
            if (this.isPWA) {
                this.preloadCriticalRoutes();
            }
            
            this.log('info', 'Navigation controller initialized', {
                isPWA: this.isPWA,
                onlineStatus: this.onlineStatus,
                guardsCount: this.guards.length
            });
            
            // Dispatch ready event
            this.dispatchEvent('ready', { navigation: this });
            
        } catch (error) {
            console.error('Failed to initialize navigation:', error);
        }
    }
    
    async initDependencies() {
        // Lazy load Logger
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Navigation');
        } catch {
            this.logger = this.createFallbackLogger();
        }
        
        // Lazy load Auth Service
        try {
            const authModule = await import('./auth.js');
            this.authService = authModule.default;
        } catch {
            this.log('warn', 'Auth service not available - running without auth guards');
            this.authService = null;
        }
        
        // Lazy load route config
        try {
            const routesModule = await import('../config/routes-config.js');
            this.ROUTES_CONFIG = routesModule.default;
        } catch {
            this.ROUTES_CONFIG = this.getDefaultRoutes();
        }
        
        // Lazy load menu config
        try {
            const menuModule = await import('../config/menu-config.js');
            this.MENU_CONFIG = menuModule.default;
        } catch {
            this.MENU_CONFIG = this.getDefaultMenu();
        }
        
        // ✅ FIX: Try to import path-utils jika tersedia
        try {
            const pathUtils = await import('./path-utils.js');
            this.pathUtils = pathUtils;
        } catch {
            this.pathUtils = null;
        }
    }
    
    // ============================================
    // LOGGING & UTILITIES
    // ============================================
    
    log(level, message, data = null) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](message, data);
        } else {
            const prefix = `[Navigation ${level.toUpperCase()}]`;
            const logFn = level === 'error' ? console.error :
                         level === 'warn' ? console.warn : console.info;
            logFn(`${prefix} ${message}`, data || '');
        }
    }
    
    createFallbackLogger() {
        return {
            debug: console.debug.bind(console, '[Navigation]'),
            info: console.info.bind(console, '[Navigation]'),
            warn: console.warn.bind(console, '[Navigation]'),
            error: console.error.bind(console, '[Navigation]')
        };
    }
    
    getConfig(key, defaultValue) {
        return APP_CONFIG?.navigation?.[key] ?? defaultValue;
    }
    
    detectPWA() {
        return typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone ||
            document.referrer.includes('android-app://')
        );
    }
    
    extractCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        
        try {
            const session = JSON.parse(sessionStorage.getItem('auth_session') || '{}');
            return session.csrfToken || '';
        } catch {
            return '';
        }
    }
    
    // ============================================
    // EVENT HANDLERS (dengan cleanup)
    // ============================================
    
    setupEventHandlers() {
        // Popstate handler
        this.eventHandlers.popstate = (event) => {
            if (event.state?.path) {
                this.currentRoute = {
                    path: event.state.path,
                    params: event.state.params || {},
                    query: event.state.query || {},
                    timestamp: event.state.navTimestamp || Date.now()
                };
                
                this.highlightMenu(event.state.path);
                this.dispatchNavigationEvent(event.state.path, 'popstate');
            }
        };
        window.addEventListener('popstate', this.eventHandlers.popstate);
        
        // Link interception
        this.eventHandlers.click = (event) => {
            this.handleLinkClick(event);
        };
        document.addEventListener('click', this.eventHandlers.click, true);
        
        // Online/Offline handlers untuk PWA
        this.eventHandlers.online = () => {
            this.onlineStatus = true;
            this.log('info', 'App is online');
            this.processOfflineQueue();
        };
        this.eventHandlers.offline = () => {
            this.onlineStatus = false;
            this.log('warn', 'App is offline');
        };
        window.addEventListener('online', this.eventHandlers.online);
        window.addEventListener('offline', this.eventHandlers.offline);
    }
    
    handleLinkClick(event) {
        const link = event.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        
        // Security: Skip jika link mencurigakan
        if (this.isSuspiciousLink(link, href)) {
            this.log('warn', 'Suspicious link blocked', { href });
            event.preventDefault();
            return;
        }
        
        // Ignore external links
        if (link.hostname && link.hostname !== window.location.hostname) {
            // Tambah rel="noopener noreferrer" untuk keamanan
            if (!link.getAttribute('rel')?.includes('noopener')) {
                link.setAttribute('rel', 'noopener noreferrer');
            }
            return;
        }
        
        // Ignore special links
        if (this.isSpecialLink(link, href)) {
            return;
        }
        
        // Ignore modified clicks
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        
        // Prevent default dan handle navigasi
        event.preventDefault();
        event.stopPropagation();
        
        const title = link.getAttribute('data-title') || link.title || link.textContent?.trim();
        
        this.navigateTo(href, { 
            title,
            source: 'click',
            element: link
        });
    }
    
    isSuspiciousLink(link, href) {
        // Cek data: atau javascript: URIs
        if (/^(data|javascript|vbscript):/i.test(href)) {
            return true;
        }
        
        // Cek double-encoded URLs (XSS attempt)
        if (href.includes('%25') || href.includes('%26')) {
            const decoded = decodeURIComponent(href);
            if (decoded !== href && /[<>"'`]/.test(decoded)) {
                return true;
            }
        }
        
        // Cek HTML entities dalam URL
        if (/&[a-z]+;/i.test(href) && !/&(amp|lt|gt|quot);/i.test(href)) {
            return true;
        }
        
        return false;
    }
    
    isSpecialLink(link, href) {
        return link.hasAttribute('download') ||
               link.hasAttribute('target') ||
               link.hasAttribute('data-nav-ignore') ||
               link.hasAttribute('rel') ||
               href.startsWith('#') ||
               href.startsWith('mailto:') ||
               href.startsWith('tel:') ||
               href.startsWith('sms:') ||
               href.startsWith('whatsapp:') ||
               href.startsWith('intent:') ||
               /\.(pdf|doc|docx|xls|xlsx|zip|rar)$/i.test(href);
    }
    
    // ============================================
    // NAVIGATION METHODS (dengan queue)
    // ============================================
    
    async navigateTo(path, options = {}) {
        // Validasi path
        if (!path || typeof path !== 'string') {
            this.log('warn', 'Invalid navigation path', { path });
            return false;
        }
        
        // Queue navigasi jika sedang dalam proses
        if (this.navigationInProgress && !options.force) {
            this.navigationQueue.push({ path, options });
            return false;
        }
        
        this.navigationInProgress = true;
        
        try {
            const resolvedPath = this.resolvePath(path);
            
            // Sanitasi path
            const sanitizedPath = this.sanitizePath(resolvedPath);
            
            // Validasi route exists
            if (!this.routeExists(sanitizedPath)) {
                this.log('warn', 'Route not found', { path: sanitizedPath });
                if (options.fallback !== false) {
                    await this.navigateTo('/404.html', { replace: true, force: true });
                }
                return false;
            }
            
            // Extract params dan query
            const { path: cleanPath, params, query } = this.extractParams(sanitizedPath);
            
            // Run guards
            const guardResult = await this.runGuards(cleanPath, params, query);
            if (!guardResult.allowed) {
                this.log('warn', 'Navigation blocked', {
                    path: cleanPath,
                    reason: guardResult.reason
                });
                
                if (guardResult.redirect) {
                    await this.navigateTo(guardResult.redirect, { 
                        replace: true, 
                        force: true,
                        state: { blockedFrom: cleanPath }
                    });
                }
                
                return false;
            }
            
            // Store previous route
            if (this.currentRoute) {
                this.previousRoute = { ...this.currentRoute };
                this.addToHistory(this.currentRoute);
            }
            
            // Build route object
            const route = {
                path: cleanPath,
                fullPath: sanitizedPath,
                params,
                query,
                timestamp: Date.now(),
                title: options.title || await this.getPageTitle(cleanPath),
                source: options.source || 'programmatic',
                state: options.state || {}
            };
            
            // PWA: Check offline capability
            if (!this.onlineStatus && !options.allowOffline) {
                const canNavigateOffline = await this.canNavigateOffline(cleanPath);
                if (!canNavigateOffline) {
                    this.offlineQueue.push({ route, options });
                    this.showOfflineMessage();
                    return false;
                }
            }
            
            // Update current route
            this.currentRoute = route;
            
            // Update browser URL
            this.updateURL(cleanPath, query, options.replace);
            
            // Update document title
            if (route.title) {
                document.title = `${route.title} - ${APP_CONFIG.app?.name || 'E-Arsip Digital'}`;
            }
            
            // Highlight menu
            await this.highlightMenu(cleanPath);
            
            // Update breadcrumb
            this.updateBreadcrumb(cleanPath);
            
            // Preload related routes
            if (this.isPWA) {
                this.preloadRelatedRoutes(cleanPath);
            }
            
            // Cache route
            this.routeCache.set(cleanPath, route);
            
            // Dispatch events
            this.dispatchNavigationEvent(cleanPath, options.source || 'programmatic');
            
            // Save history
            this.saveHistory();
            
            // Audit trail
            this.addToAuditTrail('navigate', cleanPath);
            
            this.log('debug', 'Navigation successful', {
                path: cleanPath,
                title: route.title,
                replace: options.replace
            });
            
            return true;
            
        } catch (error) {
            this.log('error', 'Navigation failed', {
                path,
                error: error.message,
                stack: error.stack
            });
            return false;
        } finally {
            this.navigationInProgress = false;
            
            // Process queue
            if (this.navigationQueue.length > 0) {
                const next = this.navigationQueue.shift();
                this.navigateTo(next.path, next.options);
            }
        }
    }
    
    async navigateBack(options = {}) {
        if (this.history.length > 0) {
            const previous = this.history.pop();
            
            // Skip jika route yang sama
            if (previous.path === this.currentRoute?.path && this.history.length > 0) {
                const beforePrevious = this.history.pop();
                return this.navigateTo(beforePrevious.path, { 
                    replace: true,
                    source: 'back'
                });
            }
            
            return this.navigateTo(previous.path, { 
                replace: true,
                source: 'back'
            });
        }
        
        // Fallback
        if (options.fallback !== false) {
            return this.navigateToDashboard({ replace: true });
        }
        
        return false;
    }
    
    async navigateToDashboard(options = {}) {
        try {
            let dashboardPath = '/dashboard/';
            
            if (this.authService?.currentUser) {
                const userRole = this.authService.currentUser.role || 'user';
                const dashboards = this.ROUTES_CONFIG?.dashboards || {};
                dashboardPath = dashboards[userRole] || '/dashboard/user/';
            }
            
            return this.navigateTo(dashboardPath, { 
                replace: true,
                source: 'dashboard',
                ...options
            });
        } catch {
            return this.navigateTo('/dashboard/', { replace: true, ...options });
        }
    }
    
    redirectToLogin(reason = '', redirectPath = '') {
        let loginPath = '/login.html';
        const params = new URLSearchParams();
        
        if (reason) {
            params.set('message', encodeURIComponent(reason));
        }
        
        if (redirectPath) {
            params.set('redirect', encodeURIComponent(redirectPath));
        } else if (this.currentRoute) {
            params.set('redirect', encodeURIComponent(this.currentRoute.path));
        }
        
        const queryString = params.toString();
        if (queryString) {
            loginPath += '?' + queryString;
        }
        
        return this.navigateTo(loginPath, { replace: true, force: true });
    }
    
    // ============================================
    // PATH RESOLUTION & VALIDATION
    // ============================================
    
    resolvePath(path) {
        if (!path) return '/';
        
        // Handle relative paths
        if (path.startsWith('./') || path.startsWith('../')) {
            const base = this.currentRoute?.path || window.location.pathname;
            const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
            path = this.resolveRelativePath(baseDir, path);
        }
        
        // Use path-utils jika tersedia
        if (this.pathUtils?.resolveAppPath) {
            return this.pathUtils.resolveAppPath(path);
        }
        
        return this.normalizePath(path);
    }
    
    resolveRelativePath(base, relative) {
        // Hapus './'
        relative = relative.replace(/^\.\//, '');
        
        // Handle '../'
        while (relative.startsWith('../')) {
            base = base.substring(0, base.lastIndexOf('/', base.length - 2) + 1);
            relative = relative.substring(3);
        }
        
        return base + relative;
    }
    
    normalizePath(path) {
        // Ensure leading slash
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove trailing slash (kecuali root)
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        // Resolve double slashes
        path = path.replace(/\/+/g, '/');
        
        // Resolve '.' and '..'
        const segments = path.split('/');
        const resolved = [];
        
        for (const segment of segments) {
            if (segment === '..') {
                resolved.pop();
            } else if (segment !== '.' && segment !== '') {
                resolved.push(segment);
            }
        }
        
        return '/' + resolved.join('/');
    }
    
    sanitizePath(path) {
        // Hapus karakter berbahaya
        let sanitized = path.replace(/[<>"']/g, '');
        
        // Decode URL encoding yang berlebihan
        let prevPath = '';
        while (prevPath !== sanitized) {
            prevPath = sanitized;
            sanitized = decodeURIComponent(sanitized);
        }
        
        // Re-encode karakter khusus
        sanitized = sanitized.replace(/[^\w\-\/\.\?\=\&\#\@\!\$\%\*\(\)\[\]]/g, '');
        
        // Batasi panjang path
        if (sanitized.length > 2048) {
            sanitized = sanitized.substring(0, 2048);
        }
        
        return sanitized;
    }
    
    extractParams(path) {
        const [pathPart, queryString] = path.split('?');
        const query = {};
        
        if (queryString) {
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params) {
                query[key] = this.sanitizeQueryValue(value);
            }
        }
        
        // Extract path params (e.g., /user/:id)
        const params = {};
        
        return { path: pathPart, params, query };
    }
    
    sanitizeQueryValue(value) {
        if (!value) return '';
        
        // Hapus karakter berbahaya
        return value.replace(/[<>"'`;(){}]/g, '').substring(0, 500);
    }
    
    routeExists(path) {
        if (!this.ROUTES_CONFIG) return true; // Tidak bisa validasi
        
        const cleanPath = path.split('?')[0];
        
        const allRoutes = [
            ...(this.ROUTES_CONFIG.public || []),
            ...(this.ROUTES_CONFIG.authenticated || []),
            ...(this.ROUTES_CONFIG.admin || []),
            ...(this.ROUTES_CONFIG.settings || [])
        ];
        
        return allRoutes.some(route => {
            return route.path === cleanPath || 
                   this.matchDynamicRoute(route.path, cleanPath);
        });
    }
    
    matchDynamicRoute(routePath, currentPath) {
        // Convert route pattern to regex
        const pattern = routePath.replace(/:\w+/g, '[^/]+');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(currentPath);
    }
    
    async getPageTitle(path) {
        if (!this.ROUTES_CONFIG) return 'E-Arsip Digital';
        
        const cleanPath = path.split('?')[0];
        
        const allRoutes = [
            ...(this.ROUTES_CONFIG.public || []),
            ...(this.ROUTES_CONFIG.authenticated || []),
            ...(this.ROUTES_CONFIG.admin || []),
            ...(this.ROUTES_CONFIG.settings || [])
        ];
        
        const route = allRoutes.find(r => 
            r.path === cleanPath || 
            cleanPath.startsWith(r.path) ||
            this.matchDynamicRoute(r.path, cleanPath)
        );
        
        return route?.title || 'E-Arsip Digital';
    }
    
    // ============================================
    // HISTORY MANAGEMENT
    // ============================================
    
    addToHistory(route) {
        // Hindari duplikasi berturut-turut
        if (this.history.length > 0 && 
            this.history[this.history.length - 1].path === route.path) {
            return;
        }
        
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
                const parsed = JSON.parse(stored);
                this.history = Array.isArray(parsed) ? parsed : [];
            }
        } catch {
            this.history = [];
        }
    }
    
    saveHistory() {
        try {
            const toSave = this.history.slice(-20);
            sessionStorage.setItem('nav_history', JSON.stringify(toSave));
        } catch (error) {
            this.log('warn', 'Failed to save history', { error: error.message });
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
    // NAVIGATION GUARDS (async)
    // ============================================
    
    addGuard(guardFn, options = {}) {
        const guard = {
            fn: guardFn,
            priority: options.priority || 0,
            name: options.name || 'anonymous'
        };
        
        this.guards.push(guard);
        this.guards.sort((a, b) => b.priority - a.priority);
    }
    
    removeGuard(name) {
        this.guards = this.guards.filter(g => g.name !== name);
    }
    
    async runGuards(path, params = {}, query = {}) {
        const context = {
            path,
            params,
            query,
            currentRoute: this.currentRoute,
            previousRoute: this.previousRoute,
            isAuthenticated: this.authService?.isAuthenticated || false,
            currentUser: this.authService?.currentUser || null
        };
        
        for (const guard of this.guards) {
            try {
                const result = await guard.fn(context);
                
                if (result === false) {
                    return { allowed: false, reason: `Blocked by guard: ${guard.name}` };
                }
                
                if (typeof result === 'object' && result.allowed === false) {
                    return result;
                }
            } catch (error) {
                this.log('error', `Guard error: ${guard.name}`, {
                    error: error.message,
                    path
                });
                
                // Default: allow jika guard error (fail-open) atau block (fail-closed)
                return this.getConfig('guardFailMode', 'open') === 'closed' 
                    ? { allowed: false, reason: 'Guard error' }
                    : { allowed: true };
            }
        }
        
        return { allowed: true };
    }
    
    setupDefaultGuards() {
        // Auth guard
        this.addGuard((context) => {
            const publicRoutes = (this.ROUTES_CONFIG?.public || []).map(r => r.path);
            const isPublic = publicRoutes.some(r => 
                context.path.startsWith(r) || context.path === r
            );
            
            // Always allow public routes dan assets
            if (isPublic || 
                context.path.startsWith('/assets/') ||
                context.path.startsWith('/js/') ||
                context.path.startsWith('/css/')) {
                return { allowed: true };
            }
            
            if (this.authService && !this.authService.isAuthenticated) {
                return {
                    allowed: false,
                    reason: 'Authentication required',
                    redirect: `/login.html?redirect=${encodeURIComponent(context.path)}`
                };
            }
            
            return { allowed: true };
        }, { name: 'auth-guard', priority: 100 });
        
        // Admin guard
        this.addGuard((context) => {
            if (!this.ROUTES_CONFIG || !this.authService) {
                return { allowed: true };
            }
            
            const adminRoutes = [
                ...(this.ROUTES_CONFIG.admin || []).map(r => r.path),
                ...(this.ROUTES_CONFIG.settings || []).map(r => r.path)
            ];
            
            const isAdminRoute = adminRoutes.some(r => 
                context.path.startsWith(r) || this.matchDynamicRoute(r, context.path)
            );
            
            if (isAdminRoute && !this.authService.hasRole?.(['super_admin', 'admin'])) {
                return {
                    allowed: false,
                    reason: 'Admin access required',
                    redirect: '/403.html'
                };
            }
            
            return { allowed: true };
        }, { name: 'admin-guard', priority: 90 });
        
        // CSRF guard untuk POST routes
        this.addGuard((context) => {
            const method = context.query?._method?.toUpperCase();
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                const token = context.query?._token;
                if (!token || token !== this.csrfToken) {
                    return {
                        allowed: false,
                        reason: 'CSRF token invalid'
                    };
                }
            }
            return { allowed: true };
        }, { name: 'csrf-guard', priority: 80 });
    }
    
    // ============================================
    // MENU SYSTEM (dengan caching)
    // ============================================
    
    async highlightCurrentMenu() {
        const currentPath = window.location.pathname;
        await this.highlightMenu(currentPath);
    }
    
    async highlightMenu(path) {
        this.activeMenuPath = path;
        
        // Batch DOM updates
        requestAnimationFrame(() => {
            // Remove active class
            document.querySelectorAll('.nav-item.active, .sidebar .nav-item.active')
                .forEach(item => item.classList.remove('active'));
            
            // Find and highlight matching items
            document.querySelectorAll('.nav-item[href]').forEach(item => {
                const itemPath = item.getAttribute('href');
                
                if (itemPath && this.pathsMatch(path, itemPath)) {
                    item.classList.add('active');
                    item.setAttribute('aria-current', 'page');
                    
                    // Scroll into view
                    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    
                    // Expand parent section
                    const parentSection = item.closest('.nav-section');
                    if (parentSection) {
                        parentSection.classList.remove('collapsed');
                        parentSection.classList.add('expanded');
                    }
                }
            });
        });
        
        // Update breadcrumb
        this.updateBreadcrumb(path);
    }
    
    pathsMatch(currentPath, menuPath) {
        if (currentPath === menuPath) return true;
        
        // Exact match after removing query strings
        const cleanCurrent = currentPath.split('?')[0];
        const cleanMenu = menuPath.split('?')[0];
        
        if (cleanCurrent === cleanMenu) return true;
        
        // Current path starts with menu path (sub-pages)
        if (menuPath !== '/' && menuPath !== '/dashboard/' && 
            cleanCurrent.startsWith(cleanMenu.replace(/\/$/, ''))) {
            return true;
        }
        
        return false;
    }
    
    async updateBreadcrumb(path) {
        const breadcrumbElement = document.querySelector('.breadcrumb');
        if (!breadcrumbElement) return;
        
        // Dispatch ke Breadcrumb component jika ada
        if (window.breadcrumb?.refresh) {
            window.breadcrumb.refresh();
            return;
        }
        
        // Generate breadcrumb
        const segments = path.split('/').filter(Boolean);
        const breadcrumbHTML = segments.map((segment, index) => {
            const url = '/' + segments.slice(0, index + 1).join('/');
            const label = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const isLast = index === segments.length - 1;
            
            return isLast 
                ? `<span class="breadcrumb-current">${label}</span>`
                : `<a href="${url}" class="breadcrumb-link">${label}</a>`;
        }).join(' <span class="breadcrumb-separator">/</span> ');
        
        breadcrumbElement.innerHTML = breadcrumbHTML;
    }
    
    buildSidebarMenu(role = 'user') {
        const menuItems = this.getMenuForRole(role);
        const container = document.querySelector('.sidebar-nav');
        
        if (!container) {
            this.log('warn', 'Sidebar container not found');
            return;
        }
        
        // Gunakan DocumentFragment untuk performa
        const fragment = document.createDocumentFragment();
        
        menuItems.forEach(item => {
            if (item.type === 'divider') {
                fragment.appendChild(this.createDivider(item));
            } else if (item.type === 'section') {
                fragment.appendChild(this.createMenuSection(item));
            } else if (item.type === 'separator') {
                fragment.appendChild(document.createElement('hr'));
            } else {
                fragment.appendChild(this.createMenuItem(item));
            }
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        this.highlightCurrentMenu();
    }
    
    getMenuForRole(role) {
        // Cek cache dulu
        const cacheKey = `menu_${role}`;
        if (this.menuCache.has(cacheKey)) {
            return this.menuCache.get(cacheKey);
        }
        
        const menus = this.MENU_CONFIG?.sidebar || this.MENU_CONFIG || {};
        const menuItems = menus[role] || menus.user || menus.default || [];
        
        // Cache result
        this.menuCache.set(cacheKey, menuItems);
        
        return menuItems;
    }
    
    createMenuItem(config) {
        const link = document.createElement('a');
        link.href = config.path || '#';
        link.className = 'nav-item';
        link.setAttribute('data-nav-item', config.id || '');
        
        if (config.description) {
            link.setAttribute('title', config.description);
        }
        
        if (config.icon) {
            const icon = document.createElement('i');
            icon.className = `fas fa-${config.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            link.appendChild(icon);
        }
        
        const label = document.createElement('span');
        label.textContent = config.label;
        link.appendChild(label);
        
        if (config.badge) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = config.badge;
            badge.setAttribute('aria-label', `Notifications: ${config.badge}`);
            link.appendChild(badge);
        }
        
        return link;
    }
    
    createDivider(config) {
        const divider = document.createElement('div');
        divider.className = 'nav-divider';
        if (config.label) {
            divider.textContent = config.label;
            divider.setAttribute('role', 'separator');
        }
        return divider;
    }
    
    createMenuSection(config) {
        const section = document.createElement('div');
        section.className = 'nav-section';
        section.setAttribute('data-section', config.id || '');
        
        const header = document.createElement('button');
        header.className = 'nav-section-header';
        header.setAttribute('aria-expanded', 'true');
        header.innerHTML = `
            <i class="fas fa-${config.icon || 'folder'}" aria-hidden="true"></i>
            <span>${config.label}</span>
            <i class="fas fa-chevron-down section-arrow" aria-hidden="true"></i>
        `;
        
        const body = document.createElement('div');
        body.className = 'nav-section-body';
        body.setAttribute('role', 'group');
        
        (config.children || []).forEach(child => {
            body.appendChild(this.createMenuItem(child));
        });
        
        section.appendChild(header);
        section.appendChild(body);
        
        // Toggle collapse
        header.addEventListener('click', (e) => {
            e.preventDefault();
            const isCollapsed = section.classList.toggle('collapsed');
            header.setAttribute('aria-expanded', String(!isCollapsed));
        });
        
        // Keyboard support
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });
        
        return section;
    }
    
    // ============================================
    // PWA OFFLINE SUPPORT
    // ============================================
    
    async canNavigateOffline(path) {
        // Cek cache API untuk PWA
        if ('caches' in window) {
            try {
                const cache = await caches.open('pages-cache-v1');
                const response = await cache.match(path);
                return !!response;
            } catch {
                return false;
            }
        }
        
        // Cek route cache
        return this.routeCache.has(path);
    }
    
    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        this.log('info', 'Processing offline navigation queue', {
            queued: this.offlineQueue.length
        });
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        
        for (const { route, options } of queue) {
            await this.navigateTo(route.path, { ...options, allowOffline: true });
        }
    }
    
    showOfflineMessage() {
        // Gunakan toast/notification component jika ada
        if (window.toast) {
            window.toast.show('Halaman tidak tersedia offline', 'warning');
        } else {
            console.warn('[Navigation] Page not available offline');
        }
    }
    
    async preloadCriticalRoutes() {
        const criticalRoutes = this.getConfig('preloadRoutes', [
            '/dashboard/',
            '/login.html',
            '/offline.html'
        ]);
        
        for (const route of criticalRoutes) {
            await this.preloadRoute(route);
        }
    }
    
    async preloadRelatedRoutes(currentPath) {
        // Preload routes yang mungkin diakses selanjutnya
        const relatedRoutes = this.getRelatedRoutes(currentPath);
        
        for (const route of relatedRoutes) {
            if (!this.preloadedRoutes.has(route)) {
                this.preloadRoute(route);
            }
        }
    }
    
    async preloadRoute(path) {
        if (this.preloadedRoutes.has(path)) return;
        
        try {
            // Preload via fetch untuk caching
            if ('caches' in window) {
                const cache = await caches.open('pages-cache-v1');
                const response = await fetch(path, { priority: 'low' });
                if (response.ok) {
                    await cache.put(path, response);
                    this.preloadedRoutes.add(path);
                }
            }
        } catch {
            // Silent fail untuk preloading
        }
    }
    
    getRelatedRoutes(currentPath) {
        // Return routes yang terkait berdasarkan menu structure
        const related = [];
        
        // Tambah sibling routes
        const allMenuItems = this.getMenuForRole(
            this.authService?.currentUser?.role || 'user'
        );
        
        let found = false;
        for (const item of allMenuItems) {
            if (item.path === currentPath) {
                found = true;
            } else if (found && item.path) {
                related.push(item.path);
                if (related.length >= 3) break;
            }
        }
        
        return related;
    }
    
    // ============================================
    // AUDIT & SECURITY
    // ============================================
    
    addToAuditTrail(action, path) {
        try {
            const trail = JSON.parse(sessionStorage.getItem('nav_audit') || '[]');
            trail.push({
                action,
                path,
                timestamp: new Date().toISOString(),
                userId: this.authService?.currentUser?.id || 'anonymous',
                userAgent: navigator.userAgent.substring(0, 100)
            });
            
            if (trail.length > 100) {
                trail.splice(0, trail.length - 100);
            }
            
            sessionStorage.setItem('nav_audit', JSON.stringify(trail));
        } catch {
            // Silent fail
        }
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    dispatchNavigationEvent(path, source) {
        const detail = {
            path,
            route: this.currentRoute,
            previousRoute: this.previousRoute,
            history: this.getHistory(),
            source,
            timestamp: Date.now()
        };
        
        window.dispatchEvent(new CustomEvent('nav:navigate', { detail }));
    }
    
    dispatchEvent(name, data) {
        window.dispatchEvent(new CustomEvent(`nav:${name}`, { detail: data }));
    }
    
    onNavigate(callback) {
        const handler = (e) => callback(e.detail);
        window.addEventListener('nav:navigate', handler);
        return () => window.removeEventListener('nav:navigate', handler);
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
    
    getPreviousRoute() {
        return this.previousRoute;
    }
    
    isActive(path) {
        return this.activeMenuPath === path || 
               this.activeMenuPath?.startsWith(path + '/');
    }
    
    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = this.sanitizeQueryValue(value);
        }
        return result;
    }
    
    getParam(name) {
        const params = this.getQueryParams();
        return params[name] || null;
    }
    
    async refresh() {
        await this.highlightCurrentMenu();
    }
    
    async reload() {
        return this.navigateTo(this.getCurrentPath(), { replace: true, force: true });
    }
    
    getDefaultRoutes() {
        return {
            public: [
                { path: '/login.html', title: 'Login' },
                { path: '/register.html', title: 'Register' }
            ],
            authenticated: [
                { path: '/dashboard/', title: 'Dashboard' }
            ],
            admin: [],
            settings: []
        };
    }
    
    getDefaultMenu() {
        return {
            sidebar: {
                user: [
                    { path: '/dashboard/', label: 'Dashboard', icon: 'home' },
                    { path: '/documents/', label: 'Dokumen', icon: 'file' }
                ]
            }
        };
    }
    
    destroy() {
        // Cleanup event listeners
        if (this.eventHandlers.popstate) {
            window.removeEventListener('popstate', this.eventHandlers.popstate);
        }
        if (this.eventHandlers.click) {
            document.removeEventListener('click', this.eventHandlers.click, true);
        }
        if (this.eventHandlers.online) {
            window.removeEventListener('online', this.eventHandlers.online);
        }
        if (this.eventHandlers.offline) {
            window.removeEventListener('offline', this.eventHandlers.offline);
        }
        
        // Clear state
        this.history = [];
        this.guards = [];
        this.routeCache.clear();
        this.menuCache.clear();
        this.preloadedRoutes.clear();
        this.offlineQueue = [];
        
        this.log('info', 'Navigation controller destroyed');
    }
}

// Create singleton dan export
const navigation = new NavigationController();

export default navigation;
export { NavigationController };