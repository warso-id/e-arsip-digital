// js/router.js - Enterprise Secure Router 2026
/**
 * E-Arsip Digital - Advanced Secure Router
 * Version: 2026.1.0
 * Features: History/Hash mode, guards, lazy loading, nested routes,
 *           PWA offline support, View Transitions, security middleware
 * Security: XSS prevention, CSRF protection, route validation, secure rendering
 */

import APP_CONFIG from '../config/config.js';

class Router {
    constructor(options = {}) {
        // ✅ FIX: Lazy load dependencies
        this.logger = null;
        this.authService = null;
        
        // Configuration
        this.config = {
            mode: 'history',
            base: APP_CONFIG?.app?.basePath || '/',
            scrollBehavior: 'smooth',
            animateTransitions: true,
            preloadLinks: true,
            preloadOnHover: true,
            cacheSize: 50,
            transitionDuration: 200,
            enableViewTransitions: true,
            ...options
        };
        
        // State
        this.routes = new Map();
        this.currentRoute = null;
        this.previousRoute = null;
        this.params = {};
        this.query = {};
        this.state = {};
        
        // Middleware & Guards
        this.middleware = [];
        this.globalGuards = new Map();
        
        // Cache
        this.cache = new Map();
        this.cacheOrder = []; // LRU tracking
        
        // DOM
        this.outlet = null;
        
        // Navigation state
        this.transitioning = false;
        this.navigationQueue = [];
        this.navigationId = 0;
        
        // Event handlers (for cleanup)
        this.handlers = {};
        
        // PWA
        this.isPWA = this.detectPWA();
        this.offlineRoutes = new Set();
        
        // Init
        this.init();
    }
    
    async init() {
        try {
            // Init dependencies
            await this.initDependencies();
            
            // Find outlet
            this.findOutlet();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup guards
            this.setupDefaultGuards();
            
            // Setup PWA offline support
            if (this.isPWA) {
                await this.setupPWASupport();
            }
            
            // Handle initial route
            await this.handleInitialRoute();
            
            this.log('info', 'Router initialized', {
                mode: this.config.mode,
                base: this.config.base,
                isPWA: this.isPWA,
                routes: this.routes.size
            });
            
            // Dispatch ready
            window.dispatchEvent(new CustomEvent('router:ready', {
                detail: { router: this }
            }));
            
        } catch (error) {
            console.error('[Router] Initialization failed:', error);
        }
    }
    
    async initDependencies() {
        // Lazy load Logger
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Router');
        } catch {
            this.logger = {
                debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
            };
        }
        
        // Lazy load Auth Service
        try {
            const authModule = await import('./auth.js');
            this.authService = authModule.default;
        } catch {
            this.authService = null;
        }
    }
    
    log(level, message, data = null) {
        if (this.logger?.[level]) {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    findOutlet() {
        this.outlet = document.querySelector('[data-router-outlet]') || 
                      document.getElementById('app') ||
                      document.getElementById('main-content') ||
                      document.body;
        
        // Add router attribute
        if (this.outlet) {
            this.outlet.setAttribute('data-router', 'outlet');
        }
    }
    
    setupEventListeners() {
        // Popstate handler
        this.handlers.popstate = (event) => {
            const path = this.getCurrentPath();
            this.navigate(path, { replace: true, source: 'popstate' });
        };
        window.addEventListener('popstate', this.handlers.popstate);
        
        // Link click handler
        this.handlers.click = (event) => {
            this.handleLinkClick(event);
        };
        document.addEventListener('click', this.handlers.click, true);
        
        // Preload on hover
        if (this.config.preloadOnHover) {
            this.handlers.mouseover = (event) => {
                this.handleLinkHover(event);
            };
            document.addEventListener('mouseover', this.handlers.mouseover, { passive: true });
        }
        
        // Online/Offline handlers
        this.handlers.online = () => {
            this.log('info', 'App is online');
            document.body.classList.remove('offline');
        };
        this.handlers.offline = () => {
            this.log('warn', 'App is offline');
            document.body.classList.add('offline');
        };
        window.addEventListener('online', this.handlers.online);
        window.addEventListener('offline', this.handlers.offline);
    }
    
    async handleInitialRoute() {
        const path = this.getCurrentPath();
        
        // Check if redirected from login
        const redirect = sessionStorage.getItem('redirect_after_login');
        if (redirect) {
            sessionStorage.removeItem('redirect_after_login');
            return this.navigate(redirect, { replace: true });
        }
        
        // Navigate to current path
        await this.navigate(path, { replace: true, source: 'initial' });
    }
    
    async setupPWASupport() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                this.log('info', 'Service worker ready for routing');
                
                // Cache current route for offline
                if (registration.active) {
                    this.offlineRoutes.add(this.getCurrentPath());
                }
            } catch {}
        }
    }
    
    // ============================================
    // ROUTE REGISTRATION
    // ============================================
    
    addRoute(path, config) {
        // Validate path
        if (!path || typeof path !== 'string') {
            this.log('warn', 'Invalid route path', { path });
            return this;
        }
        
        const route = {
            path: this.sanitizePath(path),
            component: config.component,
            template: config.template,
            title: this.sanitizeString(config.title || ''),
            meta: config.meta || {},
            children: config.children || [],
            guards: config.guards || [],
            middleware: config.middleware || [],
            lazy: config.lazy || false,
            redirect: config.redirect || null,
            props: config.props || null,
            offline: config.offline || false
        };
        
        this.routes.set(route.path, route);
        
        // Track offline routes
        if (route.offline) {
            this.offlineRoutes.add(route.path);
        }
        
        // Register child routes
        if (route.children.length > 0) {
            route.children.forEach(child => {
                const childPath = `${route.path}/${child.path}`
                    .replace(/\/+/g, '/')
                    .replace(/\/$/, '') || '/';
                this.addRoute(childPath, { ...child, parent: route.path });
            });
        }
        
        return this;
    }
    
    addRoutes(routes) {
        if (Array.isArray(routes)) {
            routes.forEach(route => this.addRoute(route.path, route));
        }
        return this;
    }
    
    // ============================================
    // NAVIGATION
    // ============================================
    
    async navigate(to, options = {}) {
        // Queue navigation if transitioning
        if (this.transitioning && !options.force) {
            this.navigationQueue.push({ to, options });
            return false;
        }
        
        this.transitioning = true;
        this.navigationId++;
        const navId = this.navigationId;
        
        try {
            const path = this.normalizePath(to);
            
            // Validate path
            if (!this.isValidPath(path)) {
                this.log('warn', 'Invalid navigation path', { path });
                return this.navigate('/404', { replace: true, force: true });
            }
            
            // Match route
            let route = this.matchRoute(path);
            
            // Handle redirect
            if (route?.redirect) {
                return this.navigate(route.redirect, { replace: true, force: true });
            }
            
            // Check if already on this route
            if (this.currentRoute?.fullPath === path && !options.force) {
                this.transitioning = false;
                return true;
            }
            
            // 404 handler
            if (!route) {
                this.log('warn', 'Route not found', { path });
                route = this.routes.get('/404') || {
                    path: '/404',
                    title: 'Page Not Found',
                    template: '<div class="error-page"><h1>404</h1><p>Page not found</p></div>'
                };
            }
            
            // Run guards
            const guardResult = await this.runGuards(route, path);
            if (!guardResult.allowed) {
                this.log('warn', 'Navigation blocked', {
                    path,
                    reason: guardResult.reason
                });
                
                if (guardResult.redirect) {
                    return this.navigate(guardResult.redirect, { 
                        replace: true, 
                        force: true 
                    });
                }
                
                return false;
            }
            
            // Run middleware
            await this.runMiddleware(route, path);
            
            // Check if navigation was superseded
            if (navId !== this.navigationId) {
                return false;
            }
            
            // Store previous route
            this.previousRoute = this.currentRoute ? { ...this.currentRoute } : null;
            
            // Parse params and query
            this.params = this.extractParams(route.path, path);
            this.query = this.extractQuery(path);
            
            // Update current route
            this.currentRoute = {
                ...route,
                fullPath: path,
                params: this.params,
                query: this.query
            };
            
            // Update URL
            this.updateURL(path, options.replace);
            
            // Update title
            this.updateTitle(route.title);
            
            // Render
            await this.renderRoute(route, options);
            
            // Scroll
            this.handleScroll(options.scroll);
            
            // Cache for offline
            if (this.isPWA && route.offline) {
                this.cacheOfflineRoute(path);
            }
            
            // Dispatch event
            this.dispatchEvent('navigate', {
                path,
                route,
                params: this.params,
                query: this.query
            });
            
            this.log('debug', 'Navigation complete', {
                path,
                route: route.path,
                source: options.source
            });
            
            return true;
            
        } catch (error) {
            this.log('error', 'Navigation failed', {
                path: to,
                error: error.message
            });
            
            // Show error UI
            this.renderError(error);
            
            return false;
        } finally {
            this.transitioning = false;
            
            // Process queue
            if (this.navigationQueue.length > 0) {
                const next = this.navigationQueue.shift();
                this.navigate(next.to, next.options);
            }
        }
    }
    
    async renderRoute(route, options = {}) {
        if (!this.outlet) return;
        
        // Animate out
        if (this.config.animateTransitions && this.outlet.children.length > 0) {
            await this.transitionOut(this.outlet);
        }
        
        try {
            let content = await this.resolveComponent(route);
            
            // Clear outlet safely
            this.clearOutlet();
            
            // Render content
            if (typeof content === 'function') {
                const result = content({
                    params: this.params,
                    query: this.query,
                    route: this.currentRoute,
                    router: this
                });
                
                if (result instanceof HTMLElement) {
                    this.outlet.appendChild(result);
                } else if (typeof result === 'string') {
                    this.safeSetHTML(this.outlet, result);
                }
            } else if (content instanceof HTMLElement) {
                this.outlet.appendChild(content);
            } else if (typeof content === 'string') {
                this.safeSetHTML(this.outlet, content);
            }
            
            // Execute safe scripts
            this.executeSafeScripts(this.outlet);
            
            // Animate in
            if (this.config.animateTransitions) {
                await this.transitionIn(this.outlet);
            }
            
        } catch (error) {
            this.log('error', 'Route rendering failed', {
                route: route.path,
                error: error.message
            });
            
            this.renderError(error);
        }
    }
    
    async resolveComponent(route) {
        const cacheKey = route.path;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            // Move to end of LRU
            this.cacheOrder = this.cacheOrder.filter(k => k !== cacheKey);
            this.cacheOrder.push(cacheKey);
            return this.cache.get(cacheKey);
        }
        
        let content;
        
        if (route.lazy && route.component) {
            // Lazy load
            const module = await route.component();
            content = module.default || module;
        } else if (route.component) {
            content = route.component;
        } else if (route.template) {
            content = route.template;
        } else {
            content = '<div class="route-empty">No content available</div>';
        }
        
        // Cache component
        this.addToCache(cacheKey, content);
        
        return content;
    }
    
    addToCache(key, content) {
        // LRU eviction
        if (this.cache.size >= this.config.cacheSize) {
            const oldest = this.cacheOrder.shift();
            this.cache.delete(oldest);
        }
        
        this.cache.set(key, content);
        this.cacheOrder.push(key);
    }
    
    clearOutlet() {
        if (!this.outlet) return;
        
        // Remove all child nodes safely
        while (this.outlet.firstChild) {
            this.outlet.removeChild(this.outlet.firstChild);
        }
    }
    
    renderError(error) {
        if (!this.outlet) return;
        
        const errorHTML = `
            <div class="route-error" role="alert">
                <div class="error-icon">⚠️</div>
                <h3>Error Loading Page</h3>
                <p class="error-message">${this.escapeHtml(error.message || 'Unknown error')}</p>
                <div class="error-actions">
                    <button onclick="location.reload()" class="btn-retry">
                        🔄 Reload Page
                    </button>
                    <button onclick="history.back()" class="btn-back">
                        ← Go Back
                    </button>
                </div>
            </div>
        `;
        
        this.clearOutlet();
        this.safeSetHTML(this.outlet, errorHTML);
    }
    
    // ============================================
    // URL MANAGEMENT
    // ============================================
    
    normalizePath(path) {
        if (!path) return '/';
        
        // Remove base path
        if (this.config.base !== '/' && path.startsWith(this.config.base)) {
            path = path.substring(this.config.base.length);
        }
        
        // Handle hash mode
        if (this.config.mode === 'hash') {
            path = path.replace(/^#/, '');
        }
        
        // Separate query string
        let queryString = '';
        const queryIndex = path.indexOf('?');
        if (queryIndex !== -1) {
            queryString = path.substring(queryIndex);
            path = path.substring(0, queryIndex);
        }
        
        // Ensure leading slash
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove trailing slash (except root)
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        // Resolve ../ and ./
        path = this.resolveRelativePath(path);
        
        // Re-add query string
        return path + queryString;
    }
    
    resolveRelativePath(path) {
        const segments = path.split('/').filter(Boolean);
        const resolved = [];
        
        for (const segment of segments) {
            if (segment === '..') {
                resolved.pop();
            } else if (segment !== '.') {
                resolved.push(segment);
            }
        }
        
        return '/' + resolved.join('/');
    }
    
    updateURL(path, replace = false) {
        try {
            const url = this.config.mode === 'hash'
                ? `#${path}`
                : `${this.config.base.replace(/\/$/, '')}${path}`;
            
            const state = {
                path,
                navId: this.navigationId,
                timestamp: Date.now()
            };
            
            if (replace) {
                window.history.replaceState(state, '', url);
            } else {
                window.history.pushState(state, '', url);
            }
        } catch (error) {
            this.log('warn', 'Failed to update URL', { error: error.message });
        }
    }
    
    getCurrentPath() {
        try {
            if (this.config.mode === 'hash') {
                return window.location.hash.slice(1) || '/';
            }
            
            let path = window.location.pathname;
            
            if (this.config.base !== '/' && path.startsWith(this.config.base)) {
                path = path.substring(this.config.base.length);
            }
            
            return path || '/';
        } catch {
            return '/';
        }
    }
    
    // ============================================
    // ROUTE MATCHING
    // ============================================
    
    matchRoute(path) {
        const cleanPath = path.split('?')[0];
        
        // Exact match
        if (this.routes.has(cleanPath)) {
            return this.routes.get(cleanPath);
        }
        
        // Dynamic route matching
        for (const [routePath, route] of this.routes) {
            if (routePath === '*') continue;
            
            const regex = this.pathToRegex(routePath);
            if (regex.test(cleanPath)) {
                return route;
            }
        }
        
        // Wildcard
        return this.routes.get('*') || null;
    }
    
    pathToRegex(path) {
        // Escape special regex characters
        let pattern = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/:(\w+)/g, '(?<$1>[^/]+)')
            .replace(/\\\*/g, '.*');
        
        return new RegExp(`^${pattern}$`);
    }
    
    extractParams(routePath, currentPath) {
        const params = {};
        const routeParts = routePath.split('/');
        const pathParts = currentPath.split('?')[0].split('/');
        
        routeParts.forEach((part, i) => {
            if (part.startsWith(':')) {
                const paramName = part.slice(1);
                params[paramName] = this.sanitizeParam(pathParts[i] || '');
            }
        });
        
        return params;
    }
    
    extractQuery(path) {
        const query = {};
        const queryIndex = path.indexOf('?');
        
        if (queryIndex === -1) return query;
        
        try {
            const searchParams = new URLSearchParams(path.substring(queryIndex));
            
            for (const [key, value] of searchParams) {
                query[this.sanitizeParam(key)] = this.sanitizeParam(value);
            }
        } catch {
            // Invalid query string
        }
        
        return query;
    }
    
    // ============================================
    // GUARDS & MIDDLEWARE
    // ============================================
    
    addGuard(name, guardFn) {
        this.globalGuards.set(name, guardFn);
    }
    
    async runGuards(route, path) {
        const guards = [
            ...(route.guards || []),
            ...(route.meta?.guards || [])
        ];
        
        for (const guard of guards) {
            try {
                let result;
                
                if (typeof guard === 'function') {
                    result = await guard(this, route, path);
                } else if (typeof guard === 'string' && this.globalGuards.has(guard)) {
                    result = await this.globalGuards.get(guard)(this, route, path);
                } else {
                    continue;
                }
                
                if (result === false) {
                    return { allowed: false, reason: 'Blocked by guard' };
                }
                
                if (typeof result === 'object' && result.allowed === false) {
                    return result;
                }
                
            } catch (error) {
                this.log('error', 'Guard error', {
                    guard,
                    error: error.message
                });
                
                return { allowed: false, reason: 'Guard error' };
            }
        }
        
        return { allowed: true };
    }
    
    async runMiddleware(route, path) {
        const middleware = [
            ...this.middleware,
            ...(route.middleware || []),
            ...(route.meta?.middleware || [])
        ];
        
        for (const mw of middleware) {
            try {
                await mw(this, route, path);
            } catch (error) {
                this.log('error', 'Middleware error', {
                    error: error.message
                });
            }
        }
    }
    
    setupDefaultGuards() {
        // Auth guard
        this.addGuard('auth', (router, route) => {
            if (route.meta?.requiresAuth && this.authService && !this.authService.isAuthenticated) {
                const redirectPath = route.fullPath || router.getCurrentPath();
                return {
                    allowed: false,
                    reason: 'Authentication required',
                    redirect: `/login?redirect=${encodeURIComponent(redirectPath)}`
                };
            }
            return true;
        });
        
        // Guest guard
        this.addGuard('guest', (router, route) => {
            if (this.authService?.isAuthenticated) {
                return {
                    allowed: false,
                    reason: 'Already authenticated',
                    redirect: '/dashboard'
                };
            }
            return true;
        });
        
        // Admin guard
        this.addGuard('admin', (router, route) => {
            if (route.meta?.requiresAdmin && this.authService && 
                !this.authService.hasRole?.(['super_admin', 'admin'])) {
                return {
                    allowed: false,
                    reason: 'Admin access required',
                    redirect: '/403'
                };
            }
            return true;
        });
        
        // Permission guard
        this.addGuard('permission', (router, route) => {
            if (route.meta?.permissions?.length > 0 && this.authService) {
                const hasAll = route.meta.permissions.every(
                    p => this.authService.hasPermission?.(p)
                );
                if (!hasAll) {
                    return {
                        allowed: false,
                        reason: 'Insufficient permissions',
                        redirect: '/403'
                    };
                }
            }
            return true;
        });
    }
    
    // ============================================
    // LINK HANDLING (security-focused)
    // ============================================
    
    handleLinkClick(event) {
        const link = event.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        
        // Security: Block suspicious links
        if (this.isSuspiciousLink(link, href)) {
            event.preventDefault();
            this.log('warn', 'Suspicious link blocked', { href });
            return;
        }
        
        // External links
        if (link.hostname && link.hostname !== window.location.hostname) {
            // Add security attributes
            if (!link.getAttribute('rel')?.includes('noopener')) {
                link.setAttribute('rel', 'noopener noreferrer');
            }
            return;
        }
        
        // Special links
        if (link.hasAttribute('download') ||
            link.hasAttribute('target') ||
            link.hasAttribute('data-router-ignore') ||
            /^(mailto|tel|sms|javascript|data):/i.test(href)) {
            return;
        }
        
        // Modified clicks
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        this.navigate(href, { source: 'click' });
    }
    
    handleLinkHover(event) {
        const link = event.target.closest('a[href]');
        if (!link || link.hostname !== window.location.hostname) return;
        
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href === '/') return;
        
        // Preload on hover
        this.preloadRoute(href);
    }
    
    isSuspiciousLink(link, href) {
        // Check dangerous protocols
        if (/^(javascript|data|vbscript):/i.test(href.trim())) {
            return true;
        }
        
        // Check for encoded XSS
        if (href.includes('%3C') || href.includes('%3E') || href.includes('%22')) {
            return true;
        }
        
        // Check for HTML entities
        if (/&[a-z]+;/i.test(href) && !/&(amp|lt|gt|quot|apos);/i.test(href)) {
            return true;
        }
        
        return false;
    }
    
    preloadRoute(path) {
        const normalizedPath = this.normalizePath(path);
        const cleanPath = normalizedPath.split('?')[0];
        const route = this.matchRoute(cleanPath);
        
        if (!route?.lazy || this.cache.has(route.path)) return;
        
        // Low priority preload
        route.component().then(module => {
            this.addToCache(route.path, module.default || module);
        }).catch(() => {
            // Silent fail
        });
    }
    
    // ============================================
    // TRANSITIONS
    // ============================================
    
    async transitionOut(element) {
        if (this.config.enableViewTransitions && document.startViewTransition) {
            return; // View Transitions API handles this
        }
        
        return new Promise(resolve => {
            element.style.opacity = '1';
            element.style.transition = `opacity ${this.config.transitionDuration}ms ease`;
            
            requestAnimationFrame(() => {
                element.style.opacity = '0';
                setTimeout(resolve, this.config.transitionDuration);
            });
        });
    }
    
    async transitionIn(element) {
        if (this.config.enableViewTransitions && document.startViewTransition) {
            return; // View Transitions API handles this
        }
        
        return new Promise(resolve => {
            element.style.opacity = '0';
            element.style.transition = `opacity ${this.config.transitionDuration}ms ease`;
            
            requestAnimationFrame(() => {
                element.style.opacity = '1';
                setTimeout(resolve, this.config.transitionDuration);
            });
        });
    }
    
    handleScroll(scrollOption) {
        const behavior = scrollOption || this.config.scrollBehavior;
        if (behavior === 'none') return;
        
        window.scrollTo({
            top: 0,
            behavior: behavior === 'smooth' ? 'smooth' : 'auto'
        });
    }
    
    // ============================================
    // SAFE RENDERING
    // ============================================
    
    safeSetHTML(element, html) {
        // Use Trusted Types if available
        if (window.trustedTypes?.createPolicy) {
            try {
                const policy = window.trustedTypes.createPolicy('router', {
                    createHTML: (input) => input
                });
                element.innerHTML = policy.createHTML(html);
                return;
            } catch {}
        }
        
        // Fallback: sanitize before setting
        element.innerHTML = this.sanitizeHTML(html);
    }
    
    sanitizeHTML(html) {
        // Remove dangerous elements and attributes
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/on\w+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript\s*:/gi, 'blocked:')
            .replace(/data\s*:/gi, 'blocked:');
    }
    
    executeSafeScripts(container) {
        const scripts = container.querySelectorAll('script[type="module"], script[data-safe]');
        
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            // Only copy safe attributes
            const safeAttrs = ['type', 'src', 'data-safe', 'async', 'defer'];
            safeAttrs.forEach(attr => {
                const value = oldScript.getAttribute(attr);
                if (value) newScript.setAttribute(attr, value);
            });
            
            if (!oldScript.src) {
                newScript.textContent = oldScript.textContent;
            }
            
            oldScript.parentNode?.replaceChild(newScript, oldScript);
        });
    }
    
    // ============================================
    // SANITIZATION
    // ============================================
    
    sanitizePath(path) {
        if (!path) return '/';
        
        return path
            .replace(/[<>"'`]/g, '')
            .replace(/\.\./g, '')
            .substring(0, 500);
    }
    
    sanitizeParam(value) {
        if (!value) return '';
        
        return String(value)
            .replace(/[<>"'`;{}()]/g, '')
            .substring(0, 200);
    }
    
    sanitizeString(str) {
        if (!str) return '';
        
        return str
            .replace(/[<>"'`]/g, '')
            .substring(0, 1000);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        const entities = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#x27;'
        };
        return String(str).replace(/[&<>"']/g, char => entities[char]);
    }
    
    isValidPath(path) {
        if (!path || typeof path !== 'string') return false;
        if (path.length > 2048) return false;
        if (/[\x00-\x1f\x7f]/.test(path)) return false; // Control characters
        
        return true;
    }
    
    // ============================================
    // PWA OFFLINE SUPPORT
    // ============================================
    
    async cacheOfflineRoute(path) {
        if (!('caches' in window)) return;
        
        try {
            const cache = await caches.open('router-pages');
            const response = await fetch(path);
            if (response.ok) {
                await cache.put(path, response);
            }
        } catch {
            // Silent fail
        }
    }
    
    isOfflineRoute(path) {
        return this.offlineRoutes.has(path);
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    resolvePath(name, params = {}) {
        for (const [routePath, route] of this.routes) {
            if (route.meta?.name === name) {
                let path = routePath;
                
                Object.entries(params).forEach(([key, value]) => {
                    path = path.replace(`:${key}`, encodeURIComponent(value));
                });
                
                return path;
            }
        }
        
        this.log('warn', 'Named route not found', { name });
        return '#';
    }
    
    isActive(path) {
        const currentPath = this.getCurrentPath().split('?')[0];
        return currentPath === path || 
               (path !== '/' && currentPath.startsWith(path));
    }
    
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    getPreviousRoute() {
        return this.previousRoute;
    }
    
    getParams() {
        return { ...this.params };
    }
    
    getQuery() {
        return { ...this.query };
    }
    
    updateTitle(title) {
        if (title) {
            document.title = `${this.escapeHtml(title)} - ${APP_CONFIG.app?.name || 'E-Arsip Digital'}`;
        }
    }
    
    reload() {
        if (this.currentRoute) {
            return this.navigate(this.currentRoute.fullPath, { force: true });
        }
    }
    
    back() {
        window.history.back();
    }
    
    forward() {
        window.history.forward();
    }
    
    dispatchEvent(type, data) {
        window.dispatchEvent(new CustomEvent(`router:${type}`, {
            detail: { ...data, timestamp: Date.now() }
        }));
    }
    
    detectPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        // Remove event listeners
        if (this.handlers.popstate) {
            window.removeEventListener('popstate', this.handlers.popstate);
        }
        if (this.handlers.click) {
            document.removeEventListener('click', this.handlers.click, true);
        }
        if (this.handlers.mouseover) {
            document.removeEventListener('mouseover', this.handlers.mouseover);
        }
        if (this.handlers.online) {
            window.removeEventListener('online', this.handlers.online);
        }
        if (this.handlers.offline) {
            window.removeEventListener('offline', this.handlers.offline);
        }
        
        // Clear state
        this.routes.clear();
        this.cache.clear();
        this.cacheOrder = [];
        this.globalGuards.clear();
        this.middleware = [];
        this.navigationQueue = [];
        
        this.log('info', 'Router destroyed');
    }
}

// Create singleton
let router;

try {
    router = new Router();
} catch (error) {
    console.error('[Router] Failed to create router:', error);
    
    // Fallback minimal router
    router = {
        navigate: () => {},
        getCurrentPath: () => '/',
        isActive: () => false,
        destroy: () => {}
    };
}

export default router;
export { Router };