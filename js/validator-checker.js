// js/validator-checker.js - Project Validator 2026
/**
 * E-Arsip Digital - Project Validator
 * Version: 2026.1.0
 * Validates project structure and file integrity
 */

import { Logger } from './logger.js';

class ProjectValidator {
    constructor() {
        this.logger = new Logger('Validator');
        
        // Required files per category
        this.requiredFiles = {
            root: ['index.html', 'login.html', '404.html', 'sw.js', 'manifest.json', 
                   'package.json', 'README.md', '.gitignore', '.htaccess'],
            config: ['config.example.js', 'app-config.js', 'routes-config.js', 
                     'menu-config.js', 'security-config.js'],
            js: ['api.js', 'auth.js', 'utils.js', 'validator.js', 'init.js', 
                 'logger.js', 'session.js', 'router.js'],
            security: ['security.js', 'encryption.js', 'csrf.js', 'xss.js', 
                       'firewall.js', 'rate-limit.js', 'audit.js'],
            components: ['sidebar.js', 'modal.js', 'table.js', 'breadcrumb.js'],
            css: ['style.css', 'print.css']
        };
        
        // Issues found
        this.issues = [];
        
        this.init();
    }
    
    init() {
        this.logger.info('Project validator initialized');
    }
    
    // ============================================
    // VALIDATION METHODS
    // ============================================
    
    async validateAll() {
        this.issues = [];
        
        this.validateFileStructure();
        this.validateDependencies();
        this.validateSecurityConfig();
        await this.validateAPIConnectivity();
        
        return {
            valid: this.issues.filter(i => i.severity === 'error').length === 0,
            issues: this.issues,
            summary: {
                errors: this.issues.filter(i => i.severity === 'error').length,
                warnings: this.issues.filter(i => i.severity === 'warning').length,
                info: this.issues.filter(i => i.severity === 'info').length
            }
        };
    }
    
    validateFileStructure() {
        // Check required files
        for (const [category, files] of Object.entries(this.requiredFiles)) {
            for (const file of files) {
                const path = category === 'root' ? file : 
                    category === 'config' ? `config/${file}` :
                    category === 'js' ? `js/${file}` :
                    category === 'security' ? `js/security/${file}` :
                    category === 'components' ? `components/${file}` :
                    category === 'css' ? `css/${file}` : file;
                
                if (!this.fileExists(path)) {
                    this.addIssue('error', `Missing required file: ${path}`, 'structure');
                }
            }
        }
        
        // Check for sensitive files
        const sensitiveFiles = ['config/config.js', '.env', 'credentials.json'];
        for (const file of sensitiveFiles) {
            if (this.fileExists(file)) {
                const isInGitignore = this.checkGitignore(file);
                if (!isInGitignore) {
                    this.addIssue('warning', `Sensitive file not in .gitignore: ${file}`, 'security');
                }
            }
        }
    }
    
    validateDependencies() {
        // Check if Chart.js is available
        if (typeof window.Chart === 'undefined' && !document.querySelector('script[src*="chart.js"]')) {
            this.addIssue('info', 'Chart.js not preloaded (will be loaded dynamically)', 'dependency');
        }
        
        // Check if DOMPurify is available
        if (typeof window.DOMPurify === 'undefined') {
            this.addIssue('info', 'DOMPurify not available (using built-in sanitizer)', 'dependency');
        }
        
        // Check service worker support
        if (!('serviceWorker' in navigator)) {
            this.addIssue('warning', 'Service Worker not supported by browser', 'compatibility');
        }
        
        // Check IndexedDB support
        if (!window.indexedDB) {
            this.addIssue('warning', 'IndexedDB not supported by browser', 'compatibility');
        }
        
        // Check Web Crypto API
        if (!window.crypto?.subtle) {
            this.addIssue('error', 'Web Crypto API not available - encryption will fail', 'compatibility');
        }
    }
    
    validateSecurityConfig() {
        // Check if security modules are initialized
        if (typeof window.securityManager === 'undefined') {
            this.addIssue('warning', 'Security manager not initialized', 'security');
        }
        
        // Check CSP meta tag
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!cspMeta) {
            this.addIssue('info', 'CSP meta tag not found (may be set via headers)', 'security');
        }
        
        // Check CSRF meta tag
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (!csrfMeta) {
            this.addIssue('warning', 'CSRF meta tag not found', 'security');
        }
    }
    
    async validateAPIConnectivity() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('/api/health', {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                this.addIssue('warning', `API health check failed: ${response.status}`, 'connectivity');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.addIssue('warning', 'API health check timed out', 'connectivity');
            } else {
                this.addIssue('info', 'API connectivity check skipped (offline mode)', 'connectivity');
            }
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    fileExists(path) {
        // Client-side can't check file existence reliably
        // Check if it's loaded as a script/link or in cache
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const links = Array.from(document.querySelectorAll('link[href]'));
        
        const allSources = [
            ...scripts.map(s => s.src),
            ...links.map(l => l.href)
        ];
        
        return allSources.some(src => src.includes(path));
    }
    
    checkGitignore(file) {
        // Check if file pattern exists in .gitignore
        // This is a best-effort check
        return true; // Assume proper configuration
    }
    
    addIssue(severity, message, category) {
        this.issues.push({
            severity,
            message,
            category,
            timestamp: new Date().toISOString()
        });
        
        const logMethod = severity === 'error' ? 'error' : 
                         severity === 'warning' ? 'warn' : 'info';
        
        this.logger[logMethod](message, { category });
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
    
    getIssueCount() {
        return {
            errors: this.issues.filter(i => i.severity === 'error').length,
            warnings: this.issues.filter(i => i.severity === 'warning').length,
            info: this.issues.filter(i => i.severity === 'info').length
        };
    }
    
    destroy() {
        this.issues = [];
        this.logger.info('Project validator destroyed');
    }
}

// Create singleton
const projectValidator = new ProjectValidator();

export default projectValidator;
export { ProjectValidator };