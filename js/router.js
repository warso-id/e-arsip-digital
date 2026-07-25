// js/router.js - Advanced Client-Side Router 2026
/**
 * E-Arsip Digital - Advanced Router
 * Version: 2026.1.0
 * Features: Hash & History mode, middleware, guards, lazy loading, nested routes
 */

import { Logger } from './logger.js';
import authService from './auth.js';

class Router {
    constructor(options = {}) {
        this.logger = new Logger('Router');
        
        // Configuration
        this.config = {
            mode: 'history', // history | hash
            base: '/',
            scrollBehavior: 'auto', // auto | smooth | none
            animateTransitions: true,
            preloadLinks: true,
            ...options
        };
        
        // State
        this.routes = new Map();
        this.currentRoute = null;
        this.previousRoute = null;
        this.params = {};
        this.query = {};
        this.middleware = [];
        this.guards = new Map();
        this.cache = new Map();
        this.transitioning = false;
        
        // DOM
        this.outlet = null;
        
        // Bind
        this.handlePopState = this.handlePopState.bind(this);
        this.handleLinkClick = this.handleLinkClick.bind(this);
        
        // Initialize
        this.init();
    }
    
    init() {
        // Find outlet element
        this.outlet = document.querySelector('[data-router-outlet]') || 
                      document.getElementById('app') ||
                      document.body;
        
        // Setup event listeners
        window.addEventListener('popstate', this.handlePopState);
        
        if (this.config.preloadLinks) {
            document.addEventListener('click', this.handleLinkClick);
        }
        
        // Setup link preloading
        if (this.config.preloadLinks) {
            this.setupLinkPreloading();
        }
        
        this.logger.info('Router initialized', {
            mode: this.config.mode,
            base: this.config.base
        });
    }
    
    // ============================================
    // ROUTE REGISTRATION
    // ============================================
    
    addRoute(path, config) {
        const route = {
            path,
            component: config.component,
            template: config.template,
            title: config.title || '',
            meta: config.meta || {},
            children: config.children || [],
            guards: config.guards || [],
            middleware: config.middleware || [],
            lazy: config.lazy || false,
            redirect: config.redirect || null,
            props: config.props || null
        };
        
        this.routes.set(path, route);
        
        // Register child routes
        if (route.children.length > 0) {
            route.children.forEach(child => {
                const childPath = `${path}/${child.path}`.replace(/\/+/g, '/');
                this.addRoute(childPath, child);
            });
        }
        
        return this;
    }
    
    addRoutes(routes) {
        routes.forEach(route => this.addRoute(route.path, route));
        return this;
    }
    
    // ============================================
    // NAVIGATION
    // ============================================
    
    async navigate(to, options = {}) {
        if (this.transitioning) return;
        
        const path = this.normalizePath(to);
        const route = this.matchRoute(path);
        
        if (!route) {
            this.logger.warn('Route not found:', path);
            return this.navigate('/404', { replace: true });
        }
        
        // Check redirect
        if (route.redirect) {
            return this.navigate(route.redirect, { replace: true });
        }
        
        // Run guards
        const canActivate = await this.runGuards(route);
        if (!canActivate) {
            this.logger.warn('Navigation blocked by guard:', path);
            return false;
        }
        
        // Run middleware
        await this.runMiddleware(route);
        
        // Store previous route
        this.previousRoute = this.currentRoute;
        
        // Parse params and query
        this.params = this.extractParams(route.path, path);
        this.query = this.extractQuery(path);
        
        // Update state
        this.currentRoute = { ...route, fullPath: path };
        
        // Update URL
        this.updateURL(path, options.replace);
        
        // Update title
        if (route.title) {
            document.title = `${route.title} - E-Arsip Digital`;
        }
        
        // Render component
        this.transitioning = true;
        await this.renderRoute(route);
        this.transitioning = false;
        
        // Scroll
        this.handleScroll();
        
        // Dispatch event
        this.dispatchNavigationEvent(path, route);
        
        // Log
        this.logger.debug('Navigation complete', {
            path,
            route: route.path,
            params: this.params
        });
        
        return true;
    }
    
    async renderRoute(route) {
        if (!this.outlet) return;
        
        // Animate out current content
        if (this.config.animateTransitions && this.outlet.children.length > 0) {
            await this.animateOut(this.outlet);
        }
        
        try {
            let content;
            
            if (route.lazy && route.component) {
                // Lazy load component
                const module = await route.component();
                content = module.default || module;
                
                // Cache for future use
                this.cache.set(route.path, content);
            } else if (route.component) {
                content = route.component;
            } else if (route.template) {
                content = route.template;
            } else {
                content = `<div class="route-error">Component not found for route: ${route.path}</div>`;
            }
            
            // Render content
            if (typeof content === 'function') {
                // Component is a render function
                const result = content({
                    params: this.params,
                    query: this.query,
                    route: route
                });
                
                if (typeof result === 'string') {
                    this.outlet.innerHTML = result;
                } else if (result instanceof HTMLElement) {
                    this.outlet.innerHTML = '';
                    this.outlet.appendChild(result);
                }
            } else if (typeof content === 'string') {
                this.outlet.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                this.outlet.innerHTML = '';
                this.outlet.appendChild(content);
            }
            
            // Execute scripts in the new content
            this.executeScripts(this.outlet);
            
            // Animate in new content
            if (this.config.animateTransitions) {
                await this.animateIn(this.outlet);
            }
            
        } catch (error) {
            this.logger.error('Route rendering failed', error);
            this.outlet.innerHTML = `
                <div class="route-error">
                    <h3>Error Loading Page</h3>
                    <p>${error.message}</p>
                    <button onclick="window.router.reload()">Try Again</button>
                </div>
            `;
        }
    }
    
    reload() {
        if (this.currentRoute) {
            return this.navigate(this.currentRoute.fullPath);
        }
    }
    
    back() {
        window.history.back();
    }
    
    forward() {
        window.history.forward();
    }
    
    // ============================================
    // URL MANAGEMENT
    // ============================================
    
    normalizePath(path) {
        // Handle query strings
        let queryString = '';
        if (path.includes('?')) {
            const parts = path.split('?');
            path = parts[0];
            queryString = parts[1];
        }
        
        // Remove base path
        if (path.startsWith(this.config.base)) {
            path = path.substring(this.config.base.length);
        }
        
        // Ensure leading slash
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove trailing slash (except root)
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        // Add query string back
        if (queryString) {
            path += '?' + queryString;
        }
        
        return path;
    }
    
    updateURL(path, replace = false) {
        const url = this.config.mode === 'hash' 
            ? `#${path}` 
            : `${this.config.base}${path}`.replace(/\/+/g, '/');
        
        if (replace) {
            window.history.replaceState({ path }, '', url);
        } else {
            window.history.pushState({ path }, '', url);
        }
    }
    
    getCurrentPath() {
        if (this.config.mode === 'hash') {
            return window.location.hash.slice(1) || '/';
        }
        return window.location.pathname.replace(this.config.base, '') || '/';
    }
    
    // ============================================
    // ROUTE MATCHING
    // ============================================
    
    matchRoute(path) {
        // Exact match first
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }
        
        // Dynamic route matching
        for (const [routePath, route] of this.routes) {
            if (routePath === '*') continue; // Skip wildcard
            
            const pattern = this.routeToRegex(routePath);
            const match = path.match(pattern);
            
            if (match) {
                return route;
            }
        }
        
        // Wildcard route
        return this.routes.get('*') || null;
    }
    
    routeToRegex(path) {
        return new RegExp(
            '^' + path
                .replace(/\//g, '\\/')
                .replace(/:(\w+)/g, '(?<$1>[^/]+)')
                .replace(/\*/g, '.*') + '$'
        );
    }
    
    extractParams(routePath, currentPath) {
        const params = {};
        const routeParts = routePath.split('/');
        const pathParts = currentPath.split('/');
        
        routeParts.forEach((part, i) => {
            if (part.startsWith(':')) {
                const paramName = part.slice(1);
                params[paramName] = pathParts[i] || '';
            }
        });
        
        return params;
    }
    
    extractQuery(path) {
        const query = {};
        const queryIndex = path.indexOf('?');
        
        if (queryIndex !== -1) {
            const queryString = path.substring(queryIndex + 1);
            const pairs = queryString.split('&');
            
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                query[decodeURIComponent(key)] = decodeURIComponent(value || '');
            });
        }
        
        return query;
    }
    
    // ============================================
    // GUARDS & MIDDLEWARE
    // ============================================
    
    addGuard(name, guardFn) {
        this.guards.set(name, guardFn);
    }
    
    async runGuards(route) {
        const guards = route.guards || [];
        
        for (const guard of guards) {
            if (typeof guard === 'function') {
                const result = await guard(this, route);
                if (result === false) return false;
            } else if (this.guards.has(guard)) {
                const result = await this.guards.get(guard)(this, route);
                if (result === false) return false;
            }
        }
        
        return true;
    }
    
    async runMiddleware(route) {
        const middleware = [...this.middleware, ...(route.middleware || [])];
        
        for (const mw of middleware) {
            await mw(this, route);
        }
    }
    
    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    handlePopState(event) {
        const path = this.getCurrentPath();
        this.navigate(path, { replace: true });
    }
    
    handleLinkClick(event) {
        const link = event.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Ignore external links
        if (link.hostname !== window.location.hostname) return;
        
        // Ignore special links
        if (link.hasAttribute('download') || 
            link.hasAttribute('target') ||
            link.hasAttribute('data-router-ignore') ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:')) {
            return;
        }
        
        // Ignore modified clicks
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        
        event.preventDefault();
        this.navigate(href);
    }
    
    dispatchNavigationEvent(path, route) {
        window.dispatchEvent(new CustomEvent('router:navigate', {
            detail: {
                path,
                route,
                params: this.params,
                query: this.query,
                previousRoute: this.previousRoute
            }
        }));
    }
    
    // ============================================
    // ANIMATIONS
    // ============================================
    
    async animateOut(element) {
        return new Promise(resolve => {
            element.style.opacity = '1';
            element.style.transition = 'opacity 200ms ease';
            
            requestAnimationFrame(() => {
                element.style.opacity = '0';
                setTimeout(resolve, 200);
            });
        });
    }
    
    async animateIn(element) {
        return new Promise(resolve => {
            element.style.opacity = '0';
            element.style.transition = 'opacity 200ms ease';
            
            requestAnimationFrame(() => {
                element.style.opacity = '1';
                setTimeout(resolve, 200);
            });
        });
    }
    
    handleScroll() {
        if (this.config.scrollBehavior === 'none') return;
        
        window.scrollTo({
            top: 0,
            behavior: this.config.scrollBehavior === 'smooth' ? 'smooth' : 'auto'
        });
    }
    
    // ============================================
    // LINK PRELOADING
    // ============================================
    
    setupLinkPreloading() {
        // Preload links on hover
        document.addEventListener('mouseover', (event) => {
            const link = event.target.closest('a[href]');
            if (!link || link.hostname !== window.location.hostname) return;
            
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#')) return;
            
            this.preloadRoute(href);
        }, { passive: true });
    }
    
    preloadRoute(path) {
        const route = this.matchRoute(this.normalizePath(path));
        if (!route?.lazy || this.cache.has(route.path)) return;
        
        // Preload lazy component
        route.component().then(module => {
            this.cache.set(route.path, module.default || module);
        }).catch(() => {
            // Silently fail preloading
        });
    }
    
    // ============================================
    // SCRIPT EXECUTION
    // ============================================
    
    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            // Copy attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy content
            newScript.textContent = oldScript.textContent;
            
            // Replace
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    resolvePath(name, params = {}) {
        let path = null;
        
        // Find route by name
        for (const [routePath, route] of this.routes) {
            if (route.meta.name === name) {
                path = routePath;
                break;
            }
        }
        
        if (!path) {
            this.logger.warn('Named route not found:', name);
            return '#';
        }
        
        // Replace params
        Object.entries(params).forEach(([key, value]) => {
            path = path.replace(`:${key}`, value);
        });
        
        return path;
    }
    
    isActive(path) {
        const currentPath = this.getCurrentPath();
        return currentPath === path || currentPath.startsWith(path + '/');
    }
    
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    getParams() {
        return { ...this.params };
    }
    
    getQuery() {
        return { ...this.query };
    }
    
    // ============================================
    // DEFAULT GUARDS
    // ============================================
    
    setupDefaultGuards() {
        // Auth guard
        this.addGuard('auth', (router, route) => {
            if (route.meta.requiresAuth && !authService.isAuthenticated) {
                router.navigate('/login?redirect=' + encodeURIComponent(route.fullPath || ''));
                return false;
            }
            return true;
        });
        
        // Guest guard (for login/register pages)
        this.addGuard('guest', (router, route) => {
            if (authService.isAuthenticated) {
                router.navigate('/dashboard');
                return false;
            }
            return true;
        });
        
        // Role guard
        this.addGuard('role', (router, route) => {
            if (route.meta.roles && !authService.hasRole(route.meta.roles)) {
                router.navigate('/403');
                return false;
            }
            return true;
        });
        
        // Permission guard
        this.addGuard('permission', (router, route) => {
            if (route.meta.permissions) {
                const required = route.meta.permissions;
                const hasAll = required.every(p => authService.hasPermission(p));
                if (!hasAll) {
                    router.navigate('/403');
                    return false;
                }
            }
            return true;
        });
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        window.removeEventListener('popstate', this.handlePopState);
        document.removeEventListener('click', this.handleLinkClick);
        this.routes.clear();
        this.cache.clear();
        this.logger.info('Router destroyed');
    }
}

// Create singleton
const router = new Router();

// Setup default guards
router.setupDefaultGuards();

export default router;
export { Router };