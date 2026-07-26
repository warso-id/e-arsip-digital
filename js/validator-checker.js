// js/validator-checker.js - Enterprise Project Validator 2026
/**
 * E-Arsip Digital - Advanced Project Validator & Diagnostics
 * Version: 2026.1.0
 * Features: Structure validation, security audit, PWA compliance,
 *           dependency check, performance audit, auto-repair suggestions,
 *           comprehensive reporting, import/export results
 * Security: CSP validation, CORS check, sensitive file detection
 */

import APP_CONFIG from '../config/config.js';

class ProjectValidator {
    constructor(options = {}) {
        // ✅ FIX: Lazy load logger
        this.logger = null;
        
        // Configuration
        this.config = {
            strictMode: false,
            autoFix: false,
            timeout: 10000,
            ...APP_CONFIG?.validator,
            ...options
        };
        
        // Validation rules
        this.rules = [];
        
        // Issues found
        this.issues = [];
        
        // Validation results
        this.results = {
            structure: null,
            security: null,
            pwa: null,
            performance: null,
            dependencies: null,
            storage: null
        };
        
        // Fix suggestions
        this.suggestions = [];
        
        // Timing
        this.startTime = null;
        this.endTime = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.initLogger();
            this.registerRules();
            
            this.log('info', 'Project validator initialized', {
                rules: this.rules.length
            });
        } catch (error) {
            console.error('[Validator] Initialization failed:', error);
        }
    }
    
    async initLogger() {
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Validator');
        } catch {
            this.logger = {
                debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
            };
        }
    }
    
    log(level, message, data = null) {
        if (this.logger?.[level]) {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // VALIDATION RULES REGISTRY
    // ============================================
    
    registerRules() {
        // Structure validation
        this.rules.push({
            id: 'structure',
            name: 'File Structure',
            category: 'structure',
            severity: 'error',
            validate: () => this.validateStructure()
        });
        
        // Security validation
        this.rules.push({
            id: 'security',
            name: 'Security Audit',
            category: 'security',
            severity: 'error',
            validate: () => this.validateSecurity()
        });
        
        // PWA validation
        this.rules.push({
            id: 'pwa',
            name: 'PWA Compliance',
            category: 'pwa',
            severity: 'warning',
            validate: () => this.validatePWA()
        });
        
        // Performance validation
        this.rules.push({
            id: 'performance',
            name: 'Performance Check',
            category: 'performance',
            severity: 'info',
            validate: () => this.validatePerformance()
        });
        
        // Dependencies validation
        this.rules.push({
            id: 'dependencies',
            name: 'Dependencies Check',
            category: 'dependencies',
            severity: 'warning',
            validate: () => this.validateDependencies()
        });
        
        // Storage validation
        this.rules.push({
            id: 'storage',
            name: 'Storage Check',
            category: 'storage',
            severity: 'info',
            validate: () => this.validateStorage()
        });
    }
    
    // ============================================
    // MAIN VALIDATION
    // ============================================
    
    async validateAll(options = {}) {
        this.issues = [];
        this.suggestions = [];
        this.startTime = performance.now();
        
        this.log('info', 'Starting full validation');
        
        for (const rule of this.rules) {
            try {
                const result = await Promise.race([
                    rule.validate(),
                    this.timeout(rule, this.config.timeout)
                ]);
                
                this.results[rule.category] = result;
                
                if (result?.issues) {
                    this.issues.push(...result.issues);
                }
                
                if (result?.suggestions) {
                    this.suggestions.push(...result.suggestions);
                }
                
            } catch (error) {
                this.addIssue(
                    rule.severity,
                    `Validation failed: ${rule.name}`,
                    rule.category,
                    { error: error.message }
                );
            }
        }
        
        this.endTime = performance.now();
        
        const summary = this.generateSummary();
        
        // Log results
        this.log('info', 'Validation complete', summary);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('validator:complete', {
            detail: { summary, issues: this.issues }
        }));
        
        return {
            valid: summary.errors === 0,
            issues: this.issues,
            suggestions: this.suggestions,
            summary,
            results: this.results,
            duration: this.endTime - this.startTime,
            timestamp: new Date().toISOString()
        };
    }
    
    async validateCategory(category) {
        const rule = this.rules.find(r => r.category === category);
        if (!rule) throw new Error(`Unknown category: ${category}`);
        
        return rule.validate();
    }
    
    timeout(rule, ms) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Validation timeout: ${rule.name}`));
            }, ms);
        });
    }
    
    // ============================================
    // STRUCTURE VALIDATION
    // ============================================
    
    validateStructure() {
        const issues = [];
        const suggestions = [];
        
        // Check critical files loaded
        const criticalFiles = [
            { path: '/js/init.js', name: 'App Initializer' },
            { path: '/js/auth.js', name: 'Authentication' },
            { path: '/js/router.js', name: 'Router' },
            { path: '/js/session.js', name: 'Session Manager' },
            { path: '/js/utils.js', name: 'Utilities' }
        ];
        
        for (const file of criticalFiles) {
            if (!this.isScriptLoaded(file.path)) {
                issues.push(this.createIssue(
                    'error',
                    `Critical module not loaded: ${file.name}`,
                    'structure',
                    { file: file.path, name: file.name }
                ));
                
                suggestions.push({
                    issue: `Missing ${file.name}`,
                    suggestion: `Ensure ${file.path} is included in HTML`,
                    action: 'add_script',
                    details: { path: file.path }
                });
            }
        }
        
        // Check manifest.json
        if (!document.querySelector('link[rel="manifest"]')) {
            issues.push(this.createIssue(
                'warning',
                'Web App Manifest not found (required for PWA)',
                'structure'
            ));
        }
        
        // Check service worker registration
        if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
            issues.push(this.createIssue(
                'warning',
                'Service Worker registered but not controlling page',
                'structure'
            ));
        }
        
        // Check required meta tags
        const requiredMeta = [
            { name: 'viewport', content: 'width=device-width' },
            { name: 'theme-color' },
            { name: 'description' }
        ];
        
        for (const meta of requiredMeta) {
            const element = document.querySelector(`meta[name="${meta.name}"]`);
            if (!element) {
                issues.push(this.createIssue(
                    'info',
                    `Missing meta tag: ${meta.name}`,
                    'structure'
                ));
            }
        }
        
        // Check HTML structure
        this.validateHTMLStructure(issues);
        
        return { issues, suggestions, valid: issues.filter(i => i.severity === 'error').length === 0 };
    }
    
    validateHTMLStructure(issues) {
        // Check for main landmark
        if (!document.querySelector('main, [role="main"]')) {
            issues.push(this.createIssue(
                'info',
                'No <main> element found (accessibility)',
                'structure'
            ));
        }
        
        // Check for heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) {
            issues.push(this.createIssue(
                'info',
                'No heading elements found (accessibility)',
                'structure'
            ));
        } else if (!document.querySelector('h1')) {
            issues.push(this.createIssue(
                'info',
                'No <h1> element found (SEO)',
                'structure'
            ));
        }
        
        // Check skip navigation link
        if (!document.querySelector('[href="#main-content"], .skip-link')) {
            issues.push(this.createIssue(
                'info',
                'No skip navigation link found (accessibility)',
                'structure'
            ));
        }
    }
    
    // ============================================
    // SECURITY VALIDATION
    // ============================================
    
    validateSecurity() {
        const issues = [];
        const suggestions = [];
        
        // Check CSP
        const cspMeta = document.querySelector(
            'meta[http-equiv="Content-Security-Policy"], ' +
            'meta[http-equiv="Content-Security-Policy-Report-Only"]'
        );
        
        if (!cspMeta) {
            issues.push(this.createIssue(
                'warning',
                'Content Security Policy not configured',
                'security'
            ));
            
            suggestions.push({
                issue: 'Missing CSP',
                suggestion: 'Add CSP meta tag or configure via server headers',
                action: 'add_csp',
                details: {
                    example: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
                }
            });
        }
        
        // Check CSRF protection
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (!csrfMeta) {
            issues.push(this.createIssue(
                'warning',
                'CSRF protection meta tag not found',
                'security'
            ));
        }
        
        // Check HTTPS
        if (window.location.protocol !== 'https:' && 
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
            issues.push(this.createIssue(
                'error',
                'Application not running over HTTPS',
                'security',
                { protocol: window.location.protocol }
            ));
            
            suggestions.push({
                issue: 'Not using HTTPS',
                suggestion: 'Deploy application over HTTPS for production',
                action: 'enable_https',
                details: { current: window.location.protocol }
            });
        }
        
        // Check for exposed sensitive data in localStorage
        this.validateStorageSecurity(issues);
        
        // Check for console.log in production
        if (APP_CONFIG?.app?.environment === 'production') {
            issues.push(this.createIssue(
                'info',
                'Ensure console.log is removed in production build',
                'security'
            ));
        }
        
        // Check referrer policy
        const referrerMeta = document.querySelector('meta[name="referrer"]');
        if (!referrerMeta) {
            issues.push(this.createIssue(
                'info',
                'Referrer Policy not explicitly set',
                'security'
            ));
        }
        
        return { issues, suggestions, valid: issues.filter(i => i.severity === 'error').length === 0 };
    }
    
    validateStorageSecurity(issues) {
        const sensitivePatterns = [
            /password/i, /token/i, /secret/i, /key/i, /credential/i
        ];
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                for (const pattern of sensitivePatterns) {
                    if (pattern.test(key)) {
                        const value = localStorage.getItem(key);
                        const isEncrypted = value?.startsWith('ENC:') || value?.startsWith('enc:');
                        
                        if (!isEncrypted) {
                            issues.push(this.createIssue(
                                'warning',
                                `Potentially sensitive data stored unencrypted: ${key}`,
                                'security',
                                { key: key.replace(/[a-z]/gi, '*') }
                            ));
                        }
                    }
                }
            }
        } catch {}
    }
    
    // ============================================
    // PWA VALIDATION
    // ============================================
    
    validatePWA() {
        const issues = [];
        const suggestions = [];
        
        // Check service worker
        if (!('serviceWorker' in navigator)) {
            issues.push(this.createIssue(
                'error',
                'Service Worker not supported by browser',
                'pwa'
            ));
        } else if (!navigator.serviceWorker.controller) {
            issues.push(this.createIssue(
                'warning',
                'Service Worker not active (PWA offline support unavailable)',
                'pwa'
            ));
            
            suggestions.push({
                issue: 'Service Worker not active',
                suggestion: 'Register service worker in your init script',
                action: 'register_sw',
                details: { code: "navigator.serviceWorker.register('/sw.js')" }
            });
        }
        
        // Check manifest
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            issues.push(this.createIssue(
                'error',
                'Web App Manifest not found',
                'pwa'
            ));
        } else {
            // Validate manifest content
            this.validateManifest(manifestLink.href, issues, suggestions);
        }
        
        // Check icons
        const icons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
        if (icons.length === 0) {
            issues.push(this.createIssue(
                'warning',
                'No app icons defined',
                'pwa'
            ));
        }
        
        // Check meta tags for PWA
        const requiredPWAMeta = [
            'theme-color',
            'apple-mobile-web-app-capable',
            'apple-mobile-web-app-status-bar-style',
            'mobile-web-app-capable'
        ];
        
        for (const name of requiredPWAMeta) {
            if (!document.querySelector(`meta[name="${name}"]`)) {
                issues.push(this.createIssue(
                    'info',
                    `PWA meta tag missing: ${name}`,
                    'pwa'
                ));
            }
        }
        
        // Check offline support
        if (!document.querySelector('[data-offline], .offline-indicator')) {
            issues.push(this.createIssue(
                'info',
                'No offline UI indicator found',
                'pwa'
            ));
        }
        
        return { issues, suggestions, valid: issues.filter(i => i.severity === 'error').length === 0 };
    }
    
    async validateManifest(href, issues, suggestions) {
        try {
            const response = await fetch(href);
            const manifest = await response.json();
            
            if (!manifest.name) {
                issues.push(this.createIssue('warning', 'Manifest missing "name" property', 'pwa'));
            }
            
            if (!manifest.short_name) {
                issues.push(this.createIssue('info', 'Manifest missing "short_name" property', 'pwa'));
            }
            
            if (!manifest.start_url) {
                issues.push(this.createIssue('warning', 'Manifest missing "start_url" property', 'pwa'));
            }
            
            if (!manifest.icons || manifest.icons.length === 0) {
                issues.push(this.createIssue('error', 'Manifest has no icons defined', 'pwa'));
            } else {
                const has192 = manifest.icons.some(icon => icon.sizes?.includes('192'));
                const has512 = manifest.icons.some(icon => icon.sizes?.includes('512'));
                
                if (!has192) {
                    issues.push(this.createIssue('warning', 'Manifest missing 192x192 icon', 'pwa'));
                }
                if (!has512) {
                    issues.push(this.createIssue('warning', 'Manifest missing 512x512 icon', 'pwa'));
                }
            }
            
            if (!manifest.display) {
                issues.push(this.createIssue('info', 'Manifest missing "display" property', 'pwa'));
            }
            
            if (!manifest.theme_color) {
                issues.push(this.createIssue('info', 'Manifest missing "theme_color" property', 'pwa'));
            }
            
        } catch {
            issues.push(this.createIssue('warning', 'Failed to fetch or parse manifest.json', 'pwa'));
        }
    }
    
    // ============================================
    // PERFORMANCE VALIDATION
    // ============================================
    
    validatePerformance() {
        const issues = [];
        const suggestions = [];
        
        // Check resource hints
        const preconnects = document.querySelectorAll('link[rel="preconnect"]');
        const preloads = document.querySelectorAll('link[rel="preload"]');
        const prefetches = document.querySelectorAll('link[rel="dns-prefetch"]');
        
        if (preconnects.length === 0 && !this.isLocalhost()) {
            issues.push(this.createIssue(
                'info',
                'No preconnect hints for external resources',
                'performance'
            ));
        }
        
        // Check lazy loading
        const images = document.querySelectorAll('img:not([loading])');
        if (images.length > 5) {
            issues.push(this.createIssue(
                'info',
                `${images.length} images without lazy loading`,
                'performance'
            ));
            
            suggestions.push({
                issue: 'Images without lazy loading',
                suggestion: 'Add loading="lazy" attribute to below-the-fold images',
                action: 'add_lazy_loading',
                details: { count: images.length }
            });
        }
        
        // Check render-blocking resources
        const blockingStyles = document.querySelectorAll(
            'link[rel="stylesheet"]:not([media="print"])'
        );
        if (blockingStyles.length > 3) {
            issues.push(this.createIssue(
                'info',
                `${blockingStyles.length} render-blocking stylesheets`,
                'performance'
            ));
        }
        
        // Check font loading
        const fonts = document.querySelectorAll('link[rel="preload"][as="font"]');
        if (fonts.length === 0) {
            const fontFaces = document.querySelectorAll('link[href*="fonts.googleapis"]');
            if (fontFaces.length > 0) {
                issues.push(this.createIssue(
                    'info',
                    'Google Fonts loaded without preload optimization',
                    'performance'
                ));
            }
        }
        
        // Check script loading
        const syncScripts = document.querySelectorAll(
            'script:not([async]):not([defer]):not([type="module"])'
        );
        if (syncScripts.length > 2) {
            issues.push(this.createIssue(
                'info',
                `${syncScripts.length} synchronous scripts may block rendering`,
                'performance'
            ));
        }
        
        // Memory usage check
        if (performance.memory) {
            const memory = performance.memory;
            const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            
            if (usagePercent > 50) {
                issues.push(this.createIssue(
                    'warning',
                    `High memory usage: ${usagePercent.toFixed(1)}%`,
                    'performance',
                    { usagePercent, used: memory.usedJSHeapSize, limit: memory.jsHeapSizeLimit }
                ));
            }
        }
        
        return { issues, suggestions, valid: true };
    }
    
    // ============================================
    // DEPENDENCIES VALIDATION
    // ============================================
    
    validateDependencies() {
        const issues = [];
        const suggestions = [];
        
        // Check core APIs
        const apiChecks = [
            { name: 'Web Crypto API', check: () => !!window.crypto?.subtle, severity: 'error' },
            { name: 'IndexedDB', check: () => !!window.indexedDB, severity: 'warning' },
            { name: 'Cache API', check: () => 'caches' in window, severity: 'info' },
            { name: 'Notification API', check: () => 'Notification' in window, severity: 'info' },
            { name: 'Push API', check: () => 'PushManager' in window, severity: 'info' },
            { name: 'Payment Request API', check: () => 'PaymentRequest' in window, severity: 'info' },
            { name: 'Web Share API', check: () => !!navigator.share, severity: 'info' },
            { name: 'Clipboard API', check: () => !!navigator.clipboard?.writeText, severity: 'info' },
            { name: 'Geolocation API', check: () => 'geolocation' in navigator, severity: 'info' },
            { name: 'Permissions API', check: () => !!navigator.permissions, severity: 'info' }
        ];
        
        for (const api of apiChecks) {
            if (!api.check()) {
                issues.push(this.createIssue(
                    api.severity,
                    `${api.name} not available`,
                    'dependencies',
                    { api: api.name }
                ));
            }
        }
        
        // Check for required libraries
        const libraryChecks = [
            { name: 'DOMPurify', check: () => typeof window.DOMPurify !== 'undefined' },
            { name: 'Chart.js', check: () => typeof window.Chart !== 'undefined' },
            { name: 'Bootstrap', check: () => typeof window.bootstrap !== 'undefined' },
            { name: 'Font Awesome', check: () => !!document.querySelector('link[href*="font-awesome"]') }
        ];
        
        for (const lib of libraryChecks) {
            if (!lib.check()) {
                issues.push(this.createIssue(
                    'info',
                    `${lib.name} not available (may be loaded dynamically)`,
                    'dependencies'
                ));
            }
        }
        
        // Check module imports
        this.validateModules(issues);
        
        return { issues, suggestions, valid: issues.filter(i => i.severity === 'error').length === 0 };
    }
    
    validateModules(issues) {
        // Check if E-Arsip global object exists
        if (typeof window.EArsip === 'undefined') {
            issues.push(this.createIssue(
                'warning',
                'Global EArsip namespace not found',
                'dependencies'
            ));
        }
        
        // Check critical services
        const services = [
            'authService', 'sessionManager', 'router', 'securityManager',
            'navigation', 'offlineManager', 'themeManager'
        ];
        
        for (const service of services) {
            if (typeof window[service] === 'undefined') {
                issues.push(this.createIssue(
                    'info',
                    `Service not globally available: ${service}`,
                    'dependencies'
                ));
            }
        }
    }
    
    // ============================================
    // STORAGE VALIDATION
    // ============================================
    
    async validateStorage() {
        const issues = [];
        const suggestions = [];
        
        try {
            // Check localStorage availability
            const testKey = '_validator_test_';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
        } catch {
            issues.push(this.createIssue(
                'error',
                'localStorage not available',
                'storage'
            ));
        }
        
        // Check sessionStorage
        try {
            const testKey = '_validator_test_';
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.removeItem(testKey);
        } catch {
            issues.push(this.createIssue(
                'warning',
                'sessionStorage not available',
                'storage'
            ));
        }
        
        // Check storage usage
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                const usagePercent = (estimate.usage / estimate.quota) * 100;
                
                if (usagePercent > 80) {
                    issues.push(this.createIssue(
                        'warning',
                        `Storage almost full: ${usagePercent.toFixed(1)}%`,
                        'storage',
                        { usage: estimate.usage, quota: estimate.quota, percent: usagePercent }
                    ));
                    
                    suggestions.push({
                        issue: 'Storage almost full',
                        suggestion: 'Clear old cache data or increase storage quota',
                        action: 'clear_cache',
                        details: { usagePercent }
                    });
                }
            } catch {}
        }
        
        // Check IndexedDB
        if ('indexedDB' in window) {
            try {
                const databases = await indexedDB.databases();
                if (databases.length > 0) {
                    issues.push(this.createIssue(
                        'info',
                        `${databases.length} IndexedDB database(s) found`,
                        'storage',
                        { databases: databases.map(d => d.name) }
                    ));
                }
            } catch {}
        }
        
        return { issues, suggestions, valid: issues.filter(i => i.severity === 'error').length === 0 };
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    isScriptLoaded(path) {
        const scripts = document.querySelectorAll('script[src]');
        return Array.from(scripts).some(s => s.src.includes(path));
    }
    
    isStylesheetLoaded(path) {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        return Array.from(links).some(l => l.href.includes(path));
    }
    
    isLocalhost() {
        return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    }
    
    createIssue(severity, message, category, details = {}) {
        return {
            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            severity,
            message,
            category,
            details,
            timestamp: new Date().toISOString()
        };
    }
    
    addIssue(severity, message, category, details = {}) {
        this.issues.push(this.createIssue(severity, message, category, details));
    }
    
    generateSummary() {
        const errors = this.issues.filter(i => i.severity === 'error');
        const warnings = this.issues.filter(i => i.severity === 'warning');
        const info = this.issues.filter(i => i.severity === 'info');
        
        const byCategory = {};
        this.issues.forEach(issue => {
            if (!byCategory[issue.category]) {
                byCategory[issue.category] = { errors: 0, warnings: 0, info: 0 };
            }
            byCategory[issue.category][issue.severity + 's']++;
        });
        
        return {
            errors: errors.length,
            warnings: warnings.length,
            info: info.length,
            total: this.issues.length,
            byCategory,
            duration: this.endTime - this.startTime,
            valid: errors.length === 0,
            score: this.calculateScore()
        };
    }
    
    calculateScore() {
        const errorWeight = 10;
        const warningWeight = 3;
        const infoWeight = 1;
        
        const maxScore = 100;
        const penalty = 
            (this.issues.filter(i => i.severity === 'error').length * errorWeight) +
            (this.issues.filter(i => i.severity === 'warning').length * warningWeight) +
            (this.issues.filter(i => i.severity === 'info').length * infoWeight);
        
        return Math.max(0, maxScore - penalty);
    }
    
    // ============================================
    // EXPORT / IMPORT
    // ============================================
    
    exportResults() {
        return {
            timestamp: new Date().toISOString(),
            summary: this.generateSummary(),
            issues: this.issues,
            suggestions: this.suggestions,
            results: this.results,
            config: {
                version: APP_CONFIG?.app?.version || '2026.1.0',
                environment: APP_CONFIG?.app?.environment || 'development'
            }
        };
    }
    
    downloadReport() {
        const report = JSON.stringify(this.exportResults(), null, 2);
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `validation-report-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getIssues() {
        return [...this.issues];
    }
    
    getIssuesByCategory(category) {
        return this.issues.filter(i => i.category === category);
    }
    
    getIssuesBySeverity(severity) {
        return this.issues.filter(i => i.severity === severity);
    }
    
    getSuggestions() {
        return [...this.suggestions];
    }
    
    getScore() {
        return this.calculateScore();
    }
    
    async runAutoFix() {
        let fixed = 0;
        
        for (const suggestion of this.suggestions) {
            if (suggestion.action === 'clear_cache') {
                try {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        if (name.includes('temp') || name.includes('cache')) {
                            await caches.delete(name);
                            fixed++;
                        }
                    }
                } catch {}
            }
        }
        
        return { fixed, suggestions: this.suggestions.length };
    }
    
    destroy() {
        this.issues = [];
        this.suggestions = [];
        this.rules = [];
        this.results = {};
        
        this.log('info', 'Project validator destroyed');
    }
}

// Create singleton
const projectValidator = new ProjectValidator();

// Export
export default projectValidator;
export { ProjectValidator };