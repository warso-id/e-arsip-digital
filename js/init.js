// js/init.js - Global Initialization 2026
/**
 * E-Arsip Digital - Global Initialization
 * Version: 2026.1.0
 * Initializes all core modules and sets up the application
 */

import APP_CONFIG from '../config/config.js';
import { Logger } from './logger.js';
import authService from './auth.js';
import apiService from './api.js';
import sessionManager from './session.js';
import themeManager from './theme.js';
import notifications from './notifications.js';
import csrfProtection from './security/csrf.js';
import xssPrevention from './security/xss.js';
import firewall from './security/firewall.js';
import securityOrchestrator from './security/security-orchestrator.js';
import performanceMonitor from './performance.js';

class AppInitializer {
    constructor() {
        this.logger = new Logger('Init');
        this.modules = new Map();
        this.initialized = false;
        this.initStartTime = performance.now();
    }
    
    async init() {
        try {
            this.logger.info('Starting application initialization...');
            this.logger.info(`Environment: ${APP_CONFIG.app.environment}`);
            this.logger.info(`Version: ${APP_CONFIG.app.version}`);
            
            // Show loading screen
            this.showLoading();
            
            // Initialize core modules in order
            await this.initSecurityModules();
            await this.initCoreModules();
            await this.initUIModules();
            await this.initFeatures();
            
            // Setup global error handling
            this.setupGlobalErrorHandling();
            
            // Setup service worker
            await this.setupServiceWorker();
            
            // Setup PWA
            this.setupPWA();
            
            // Mark as initialized
            this.initialized = true;
            
            // Hide loading screen
            this.hideLoading();
            
            const initTime = performance.now() - this.initStartTime;
            this.logger.info(`Application initialized in ${initTime.toFixed(0)}ms`);
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('app:ready', {
                detail: { initTime }
            }));
            
        } catch (error) {
            this.logger.error('Application initialization failed', error);
            this.showInitError(error);
        }
    }
    
    async initSecurityModules() {
        this.logger.info('Initializing security modules...');
        
        try {
            // CSRF Protection (must be first)
            if (csrfProtection.isEnabled()) {
                this.modules.set('csrf', csrfProtection);
            }
            
            // XSS Prevention
            if (xssPrevention.getStats().initialized) {
                this.modules.set('xss', xssPrevention);
            }
            
            // Firewall
            if (firewall.isEnabled()) {
                this.modules.set('firewall', firewall);
            }
            
            // Security Orchestrator
            this.modules.set('securityOrchestrator', securityOrchestrator);
            
            this.logger.info('Security modules initialized');
        } catch (error) {
            this.logger.error('Security initialization failed', error);
        }
    }
    
    async initCoreModules() {
        this.logger.info('Initializing core modules...');
        
        // Session Manager
        if (sessionManager.initialized) {
            this.modules.set('session', sessionManager);
        }
        
        // Auth Service
        if (authService.initialized) {
            this.modules.set('auth', authService);
        }
        
        // API Service
        this.modules.set('api', apiService);
        
        // Performance Monitor
        this.modules.set('performance', performanceMonitor);
        
        this.logger.info('Core modules initialized');
    }
    
    async initUIModules() {
        this.logger.info('Initializing UI modules...');
        
        // Theme Manager
        if (themeManager.initialized) {
            this.modules.set('theme', themeManager);
        }
        
        // Notifications
        this.modules.set('notifications', notifications);
        
        // Setup offline detection
        this.setupOfflineDetection();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        this.logger.info('UI modules initialized');
    }
    
    async initFeatures() {
        this.logger.info('Initializing features...');
        
        // Check if user is authenticated
        if (authService.isAuthenticated) {
            await this.initAuthenticatedFeatures();
        }
        
        // Setup visibility change handler
        this.setupVisibilityHandler();
        
        // Setup before unload handler
        this.setupUnloadHandler();
        
        this.logger.info('Features initialized');
    }
    
    async initAuthenticatedFeatures() {
        // Check session validity
        const isValid = await sessionManager.checkSession();
        if (!isValid) {
            this.logger.warn('Session expired during initialization');
            return;
        }
        
        // Preload common data
        this.preloadData();
        
        // Setup auto-refresh
        this.setupAutoRefresh();
    }
    
    preloadData() {
        // Preload user preferences
        this.loadUserPreferences();
        
        // Preload notifications count
        this.loadNotificationCount();
    }
    
    async loadUserPreferences() {
        try {
            const response = await apiService.get('/api/user/preferences');
            // Apply preferences silently
            if (response.data) {
                localStorage.setItem('user_preferences', JSON.stringify(response.data));
            }
        } catch {
            // Silently fail
        }
    }
    
    async loadNotificationCount() {
        try {
            const response = await apiService.get('/api/notifications/count');
            if (response.data?.count > 0) {
                // Update notification badge
                const badge = document.getElementById('notification-badge');
                if (badge) {
                    badge.textContent = response.data.count;
                    badge.style.display = 'flex';
                }
            }
        } catch {
            // Silently fail
        }
    }
    
    // ============================================
    // SERVICE WORKER
    // ============================================
    
    async setupServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            this.logger.info('Service Worker registered', {
                scope: registration.scope
            });
            
            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateNotification();
                    }
                });
            });
            
        } catch (error) {
            this.logger.warn('Service Worker registration failed', error);
        }
    }
    
    showUpdateNotification() {
        notifications.info('Pembaruan tersedia!', {
            duration: 0,
            action: {
                label: 'Refresh',
                onClick: () => window.location.reload()
            }
        });
    }
    
    // ============================================
    // PWA SETUP
    // ============================================
    
    setupPWA() {
        // Handle PWA install prompt
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install button after a delay
            setTimeout(() => {
                this.showInstallPrompt(deferredPrompt);
            }, 5000);
        });
        
        // Track PWA installation
        window.addEventListener('appinstalled', () => {
            this.logger.info('PWA installed');
            deferredPrompt = null;
        });
    }
    
    showInstallPrompt(prompt) {
        const installBanner = document.createElement('div');
        installBanner.className = 'pwa-install-banner';
        installBanner.innerHTML = `
            <div class="pwa-install-content">
                <div>
                    <strong>Install Aplikasi</strong>
                    <p style="font-size:12px;color:#64748b;">Akses cepat dari homescreen</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-primary" id="install-btn">Install</button>
                    <button class="btn btn-sm btn-ghost" id="dismiss-btn">Nanti</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(installBanner);
        
        document.getElementById('install-btn')?.addEventListener('click', async () => {
            await prompt.prompt();
            installBanner.remove();
        });
        
        document.getElementById('dismiss-btn')?.addEventListener('click', () => {
            installBanner.remove();
        });
    }
    
    // ============================================
    // OFFLINE DETECTION
    // ============================================
    
    setupOfflineDetection() {
        window.addEventListener('online', () => {
            this.logger.info('Connection restored');
            notifications.success('Koneksi internet kembali');
            document.body.classList.remove('offline');
        });
        
        window.addEventListener('offline', () => {
            this.logger.warn('Connection lost');
            notifications.warning('Koneksi internet terputus', {
                duration: 0,
                title: 'Offline'
            });
            document.body.classList.add('offline');
        });
        
        // Initial check
        if (!navigator.onLine) {
            document.body.classList.add('offline');
        }
    }
    
    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('[data-search-input], #search-input, .search-input');
                searchInput?.focus();
            }
            
            // Ctrl/Cmd + /: Show shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.showShortcutsDialog();
            }
            
            // Escape: Close modals/dropdowns
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.visible').forEach(modal => {
                    modal.classList.remove('visible');
                });
            }
        });
    }
    
    showShortcutsDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay visible';
        dialog.innerHTML = `
            <div class="modal-dialog modal-sm">
                <div class="modal-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <table style="width:100%;font-size:14px;">
                        <tr><td style="padding:4px 0;"><kbd>Ctrl+K</kbd></td><td>Search</td></tr>
                        <tr><td style="padding:4px 0;"><kbd>Ctrl+S</kbd></td><td>Save</td></tr>
                        <tr><td style="padding:4px 0;"><kbd>Ctrl+N</kbd></td><td>New document</td></tr>
                        <tr><td style="padding:4px 0;"><kbd>Ctrl+Shift+T</kbd></td><td>Change theme</td></tr>
                        <tr><td style="padding:4px 0;"><kbd>Esc</kbd></td><td>Close modal</td></tr>
                        <tr><td style="padding:4px 0;"><kbd>Ctrl+/</kbd></td><td>Show shortcuts</td></tr>
                    </table>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }
    
    // ============================================
    // VISIBILITY HANDLER
    // ============================================
    
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible again
                this.onPageVisible();
            }
        });
    }
    
    onPageVisible() {
        // Refresh session if needed
        if (authService.isAuthenticated) {
            sessionManager.updateActivity();
        }
        
        // Refresh notification count
        this.loadNotificationCount();
    }
    
    // ============================================
    // UNLOAD HANDLER
    // ============================================
    
    setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            // Save any pending data
            this.savePendingData();
        });
    }
    
    savePendingData() {
        // Save form drafts
        const draftForms = document.querySelectorAll('[data-autosave]');
        draftForms.forEach(form => {
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => data[key] = value);
            
            try {
                sessionStorage.setItem(`draft_${form.id || 'form'}`, JSON.stringify(data));
            } catch (e) {
                // Silently fail
            }
        });
    }
    
    // ============================================
    // AUTO REFRESH
    // ============================================
    
    setupAutoRefresh() {
        // Refresh session token periodically
        setInterval(async () => {
            if (authService.isAuthenticated) {
                await sessionManager.checkSession();
            }
        }, 300000); // Every 5 minutes
    }
    
    // ============================================
    // GLOBAL ERROR HANDLING
    // ============================================
    
    setupGlobalErrorHandling() {
        // Uncaught errors
        window.addEventListener('error', (event) => {
            this.logger.error('Uncaught error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
            
            // Prevent showing error to user in production
            if (APP_CONFIG.app.environment === 'production') {
                event.preventDefault();
            }
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('Unhandled rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack
            });
            
            if (APP_CONFIG.app.environment === 'production') {
                event.preventDefault();
            }
        });
    }
    
    // ============================================
    // UI HELPERS
    // ============================================
    
    showLoading() {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.display = 'flex';
        }
    }
    
    hideLoading() {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 300);
        }
    }
    
    showInitError(error) {
        const errorHtml = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;">
                <div style="text-align:center;max-width:500px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#dc2626;margin-bottom:16px;"></i>
                    <h2>Gagal Memuat Aplikasi</h2>
                    <p style="color:#64748b;">${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="margin-top:16px;">
                        Muat Ulang
                    </button>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHtml;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    isInitialized() {
        return this.initialized;
    }
    
    getModule(name) {
        return this.modules.get(name);
    }
    
    getInitTime() {
        return performance.now() - this.initStartTime;
    }
}

// Create and run initializer
const app = new AppInitializer();

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export for external use
export default app;
export { AppInitializer };