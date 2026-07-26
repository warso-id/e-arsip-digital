// js/notifications.js - Enterprise Notification System 2026
/**
 * E-Arsip Digital - Advanced Notification Manager
 * Version: 2026.1.0
 * Features: Browser notifications, custom toasts, modal dialogs,
 *           notification polling, PWA push, offline queue, sound alerts
 * Security: XSS prevention, input sanitization, secure display
 */

import APP_CONFIG from '../config/config.js';

class NotificationSystem {
    constructor(options = {}) {
        // ✅ FIX: Lazy load logger
        this.logger = null;
        
        // Configuration
        this.config = {
            position: 'top-right',
            duration: 5000,
            maxVisible: 5,
            pauseOnHover: true,
            showProgress: true,
            sound: true,
            enableBrowserNotifications: true,
            enablePushNotifications: false,
            ...APP_CONFIG?.notifications,
            ...options
        };
        
        // State
        this.notifications = [];
        this.visibleToasts = [];
        this.queue = [];
        this.pollingIntervals = new Map();
        
        // Elements
        this.toastContainer = null;
        this.notificationBadge = null;
        
        // PWA support
        this.isPWA = this.detectPWA();
        this.pushSubscription = null;
        
        // Offline support
        this.offlineQueue = [];
        
        // Sound effects
        this.sounds = {};
        
        this.init();
    }
    
    async init() {
        try {
            // Init logger
            await this.initLogger();
            
            // Create UI containers
            this.createContainers();
            
            // Inject styles
            this.injectStyles();
            
            // Preload sounds
            if (this.config.sound) {
                this.preloadSounds();
            }
            
            // Setup PWA push jika didukung
            if (this.isPWA && this.config.enablePushNotifications) {
                await this.setupPushNotifications();
            }
            
            // Request browser notification permission jika diizinkan
            if (this.config.enableBrowserNotifications) {
                await this.requestNotificationPermission();
            }
            
            // Setup online/offline handlers
            this.setupConnectivityHandlers();
            
            this.log('info', 'Notification system initialized', {
                isPWA: this.isPWA,
                pushEnabled: !!this.pushSubscription,
                browserNotifications: this.getNotificationPermission()
            });
            
        } catch (error) {
            console.error('Failed to initialize notification system:', error);
        }
    }
    
    async initLogger() {
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Notifications');
        } catch {
            this.logger = {
                debug: console.debug.bind(console, '[Notifications]'),
                info: console.info.bind(console, '[Notifications]'),
                warn: console.warn.bind(console, '[Notifications]'),
                error: console.error.bind(console, '[Notifications]')
            };
        }
    }
    
    log(level, message, data = null) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    detectPWA() {
        return typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone
        );
    }
    
    createContainers() {
        // Toast container
        if (!document.querySelector('.toast-container')) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container';
            this.toastContainer.setAttribute('aria-live', 'polite');
            this.toastContainer.setAttribute('aria-atomic', 'false');
            this.toastContainer.setAttribute('role', 'status');
            document.body.appendChild(this.toastContainer);
        } else {
            this.toastContainer = document.querySelector('.toast-container');
        }
        
        // Set position
        this.setPosition(this.config.position);
    }
    
    setPosition(position) {
        const positions = {
            'top-right': 'top: 20px; right: 20px; align-items: flex-end;',
            'top-left': 'top: 20px; left: 20px; align-items: flex-start;',
            'top-center': 'top: 20px; left: 50%; transform: translateX(-50%); align-items: center;',
            'bottom-right': 'bottom: 20px; right: 20px; align-items: flex-end;',
            'bottom-left': 'bottom: 20px; left: 20px; align-items: flex-start;',
            'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%); align-items: center;'
        };
        
        if (this.toastContainer && positions[position]) {
            this.toastContainer.style.cssText += positions[position];
        }
    }
    
    injectStyles() {
        if (document.getElementById('notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
                max-width: 420px;
                width: 100%;
            }
            
            .toast-item {
                pointer-events: auto;
                padding: 14px 18px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                font-size: 14px;
                line-height: 1.5;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(0, 0, 0, 0.05);
            }
            
            .toast-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
            }
            
            .toast-item.success {
                background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                border-left: 4px solid #22c55e;
                color: #166534;
            }
            
            .toast-item.error {
                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
                border-left: 4px solid #ef4444;
                color: #991b1b;
            }
            
            .toast-item.warning {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                border-left: 4px solid #f59e0b;
                color: #92400e;
            }
            
            .toast-item.info {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                border-left: 4px solid #3b82f6;
                color: #1e40af;
            }
            
            .toast-icon {
                font-size: 20px;
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .toast-content {
                flex: 1;
                min-width: 0;
            }
            
            .toast-title {
                font-weight: 600;
                margin-bottom: 2px;
                font-size: 14px;
            }
            
            .toast-message {
                font-size: 13px;
                opacity: 0.9;
                word-break: break-word;
            }
            
            .toast-close {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                border: none;
                background: rgba(0, 0, 0, 0.05);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                opacity: 0.5;
                transition: all 0.2s;
                color: inherit;
            }
            
            .toast-close:hover {
                opacity: 1;
                background: rgba(0, 0, 0, 0.1);
            }
            
            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: currentColor;
                opacity: 0.3;
                transition: width 0.1s linear;
            }
            
            @keyframes toastSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
            }
            
            @keyframes toastSlideOut {
                from {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%) scale(0.95);
                }
            }
            
            @keyframes toastSlideInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-100%) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
            }
            
            @keyframes toastSlideOutLeft {
                from {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateX(-100%) scale(0.95);
                }
            }
            
            @keyframes toastSlideInBottom {
                from {
                    opacity: 0;
                    transform: translateY(100%) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes toastSlideOutBottom {
                from {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateY(100%) scale(0.95);
                }
            }
            
            /* Modal styles */
            .notification-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                backdrop-filter: blur(4px);
                animation: modalFadeIn 0.2s ease;
            }
            
            .notification-modal {
                background: white;
                border-radius: 16px;
                padding: 24px;
                max-width: 440px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .notification-modal-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .notification-modal-title {
                font-size: 18px;
                font-weight: 600;
                flex: 1;
            }
            
            .notification-modal-body {
                margin-bottom: 20px;
                color: #4b5563;
                line-height: 1.6;
            }
            
            .notification-modal-footer {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            
            .notification-modal-btn {
                padding: 10px 20px;
                border-radius: 8px;
                border: none;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
            }
            
            .notification-modal-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .notification-modal-btn.primary {
                background: #3b82f6;
                color: white;
            }
            
            .notification-modal-btn.secondary {
                background: #f3f4f6;
                color: #374151;
            }
            
            .notification-modal-btn.danger {
                background: #ef4444;
                color: white;
            }
            
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            /* Badge */
            .notification-badge {
                position: relative;
            }
            
            .notification-badge::after {
                content: attr(data-count);
                position: absolute;
                top: -8px;
                right: -8px;
                background: #ef4444;
                color: white;
                font-size: 11px;
                font-weight: 600;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 5px;
                box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .toast-container {
                    max-width: calc(100% - 32px);
                    left: 16px !important;
                    right: 16px !important;
                    transform: none !important;
                }
                
                .toast-item {
                    font-size: 13px;
                    padding: 12px 14px;
                }
                
                .notification-modal {
                    width: 95%;
                    padding: 20px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    setupConnectivityHandlers() {
        window.addEventListener('online', () => {
            this.processOfflineQueue();
            this.showToast('Koneksi internet kembali tersedia', {
                type: 'success',
                duration: 3000,
                title: '🟢 Online'
            });
        });
        
        window.addEventListener('offline', () => {
            this.showToast('Anda sedang offline. Notifikasi akan dikirim saat online.', {
                type: 'warning',
                duration: 5000,
                title: '🔴 Offline'
            });
        });
    }
    
    // ============================================
    // BROWSER NOTIFICATIONS
    // ============================================
    
    getNotificationPermission() {
        return 'Notification' in window ? Notification.permission : 'unsupported';
    }
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            this.log('warn', 'Browser notifications not supported');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission === 'denied') {
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            this.log('error', 'Failed to request notification permission', {
                error: error.message
            });
            return false;
        }
    }
    
    async showBrowserNotification(title, options = {}) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission !== 'granted') {
            const granted = await this.requestNotificationPermission();
            if (!granted) return;
        }
        
        const notificationOptions = {
            body: this.sanitize(options.body || ''),
            icon: options.icon || '/icons/icon-192x192.png',
            badge: options.badge || '/icons/badge-72x72.png',
            tag: options.tag || 'default',
            requireInteraction: options.requireInteraction || false,
            data: options.data || {},
            vibrate: options.vibrate || [200, 100, 200],
            silent: options.silent || false,
            ...options
        };
        
        try {
            const notification = new Notification(
                this.sanitize(title),
                notificationOptions
            );
            
            if (options.onClick) {
                notification.addEventListener('click', options.onClick);
            }
            
            notification.addEventListener('error', (error) => {
                this.log('error', 'Browser notification error', {
                    error: error.message
                });
            });
            
            return notification;
        } catch (error) {
            this.log('error', 'Failed to show browser notification', {
                error: error.message
            });
            return null;
        }
    }
    
    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    
    showToast(message, options = {}) {
        // Sanitasi input
        const sanitizedMessage = this.sanitize(message);
        
        const config = {
            id: this.generateId(),
            type: 'info',
            title: '',
            message: sanitizedMessage,
            duration: this.config.duration,
            showProgress: this.config.showProgress,
            onClick: null,
            onClose: null,
            createdAt: Date.now(),
            ...options
        };
        
        // Play sound
        if (this.config.sound) {
            this.playSound(config.type);
        }
        
        // Check queue
        if (this.visibleToasts.length >= this.config.maxVisible) {
            this.queue.push(config);
            return config.id;
        }
        
        this.renderToast(config);
        return config.id;
    }
    
    success(message, options = {}) {
        return this.showToast(message, { ...options, type: 'success' });
    }
    
    error(message, options = {}) {
        return this.showToast(message, { 
            ...options, 
            type: 'error',
            duration: options.duration || 0 // Default: don't auto-dismiss errors
        });
    }
    
    warning(message, options = {}) {
        return this.showToast(message, { ...options, type: 'warning' });
    }
    
    info(message, options = {}) {
        return this.showToast(message, { ...options, type: 'info' });
    }
    
    renderToast(config) {
        if (!this.toastContainer) return;
        
        const element = document.createElement('div');
        element.className = `toast-item ${config.type}`;
        element.setAttribute('role', 'alert');
        element.setAttribute('data-toast-id', config.id);
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        element.innerHTML = `
            <div class="toast-icon">${icons[config.type] || '📢'}</div>
            <div class="toast-content">
                ${config.title ? `<div class="toast-title">${this.escapeHtml(config.title)}</div>` : ''}
                <div class="toast-message">${this.escapeHtml(config.message)}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">✕</button>
            ${config.showProgress ? '<div class="toast-progress" style="width:100%"></div>' : ''}
        `;
        
        // Determine animation based on position
        const isLeft = this.config.position?.includes('left');
        const isBottom = this.config.position?.includes('bottom');
        
        let animIn = 'toastSlideIn';
        let animOut = 'toastSlideOut';
        
        if (isLeft) {
            animIn = 'toastSlideInLeft';
            animOut = 'toastSlideOutLeft';
        } else if (isBottom) {
            animIn = 'toastSlideInBottom';
            animOut = 'toastSlideOutBottom';
        }
        
        element.style.animation = `${animIn} 0.3s cubic-bezier(0.4, 0, 0.2, 1)`;
        
        // Event handlers
        const closeToast = () => {
            element.style.animation = `${animOut} 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
            
            setTimeout(() => {
                element.remove();
                this.visibleToasts = this.visibleToasts.filter(t => t.id !== config.id);
                
                // Call onClose callback
                if (config.onClose) {
                    config.onClose();
                }
                
                // Show next in queue
                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    this.renderToast(next);
                }
            }, 300);
        };
        
        // Close button
        element.querySelector('.toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            closeToast();
        });
        
        // Click to dismiss
        element.addEventListener('click', () => {
            if (config.onClick) {
                config.onClick();
            }
            closeToast();
        });
        
        // Pause on hover
        if (this.config.pauseOnHover) {
            element.addEventListener('mouseenter', () => {
                element.style.animationPlayState = 'paused';
                const progress = element.querySelector('.toast-progress');
                if (progress) {
                    progress.style.animationPlayState = 'paused';
                }
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.animationPlayState = 'running';
                const progress = element.querySelector('.toast-progress');
                if (progress) {
                    progress.style.animationPlayState = 'running';
                }
            });
        }
        
        this.toastContainer.appendChild(element);
        this.visibleToasts.push(config);
        
        // Progress bar animation
        if (config.showProgress && config.duration > 0) {
            const progressBar = element.querySelector('.toast-progress');
            if (progressBar) {
                requestAnimationFrame(() => {
                    progressBar.style.transition = `width ${config.duration}ms linear`;
                    progressBar.style.width = '0%';
                });
            }
        }
        
        // Auto dismiss
        if (config.duration > 0) {
            setTimeout(closeToast, config.duration);
        }
        
        return element;
    }
    
    dismissToast(id) {
        const element = document.querySelector(`[data-toast-id="${id}"]`);
        if (element) {
            const closeBtn = element.querySelector('.toast-close');
            if (closeBtn) {
                closeBtn.click();
            }
        }
    }
    
    dismissAll() {
        if (this.toastContainer) {
            const toasts = this.toastContainer.querySelectorAll('.toast-item');
            toasts.forEach(toast => {
                toast.querySelector('.toast-close')?.click();
            });
        }
        
        this.visibleToasts = [];
        this.queue = [];
    }
    
    // ============================================
    // MODAL DIALOGS
    // ============================================
    
    async showModal(title, message, options = {}) {
        return new Promise((resolve) => {
            const config = {
                confirmText: 'OK',
                cancelText: 'Batal',
                showCancel: true,
                type: 'primary',
                ...options
            };
            
            const overlay = document.createElement('div');
            overlay.className = 'notification-modal-overlay';
            
            const iconMap = {
                info: 'ℹ️',
                warning: '⚠️',
                error: '❌',
                confirm: '❓',
                delete: '🗑️'
            };
            
            const icon = iconMap[config.type] || '📢';
            
            overlay.innerHTML = `
                <div class="notification-modal" role="dialog" aria-modal="true">
                    <div class="notification-modal-header">
                        <span style="font-size:24px;">${icon}</span>
                        <div class="notification-modal-title">${this.escapeHtml(title)}</div>
                    </div>
                    <div class="notification-modal-body">
                        ${this.escapeHtml(message)}
                    </div>
                    <div class="notification-modal-footer">
                        ${config.showCancel ? `
                            <button class="notification-modal-btn secondary cancel-btn">
                                ${this.escapeHtml(config.cancelText)}
                            </button>
                        ` : ''}
                        <button class="notification-modal-btn ${config.type} confirm-btn">
                            ${this.escapeHtml(config.confirmText)}
                        </button>
                    </div>
                </div>
            `;
            
            const closeModal = (result) => {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 200);
            };
            
            overlay.querySelector('.confirm-btn').addEventListener('click', () => {
                closeModal(true);
            });
            
            overlay.querySelector('.cancel-btn')?.addEventListener('click', () => {
                closeModal(false);
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal(false);
                }
            });
            
            // Keyboard support
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    closeModal(false);
                    document.removeEventListener('keydown', handleKeydown);
                } else if (e.key === 'Enter') {
                    closeModal(true);
                    document.removeEventListener('keydown', handleKeydown);
                }
            };
            document.addEventListener('keydown', handleKeydown);
            
            document.body.appendChild(overlay);
        });
    }
    
    async confirm(message, title = 'Konfirmasi', options = {}) {
        return this.showModal(title, message, {
            type: 'confirm',
            confirmText: 'Ya',
            cancelText: 'Tidak',
            ...options
        });
    }
    
    async alert(message, title = 'Informasi', options = {}) {
        return this.showModal(title, message, {
            type: 'info',
            showCancel: false,
            confirmText: 'OK',
            ...options
        });
    }
    
    async prompt(title, message, defaultValue = '', options = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'notification-modal-overlay';
            
            overlay.innerHTML = `
                <div class="notification-modal">
                    <div class="notification-modal-header">
                        <span style="font-size:24px;">✏️</span>
                        <div class="notification-modal-title">${this.escapeHtml(title)}</div>
                    </div>
                    <div class="notification-modal-body">
                        <p style="margin-bottom:12px;">${this.escapeHtml(message)}</p>
                        <input type="text" class="prompt-input" value="${this.escapeHtml(defaultValue)}" 
                               style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;">
                    </div>
                    <div class="notification-modal-footer">
                        <button class="notification-modal-btn secondary cancel-btn">Batal</button>
                        <button class="notification-modal-btn primary confirm-btn">OK</button>
                    </div>
                </div>
            `;
            
            const input = overlay.querySelector('.prompt-input');
            
            const closeModal = (result) => {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 200);
            };
            
            overlay.querySelector('.confirm-btn').addEventListener('click', () => {
                closeModal(input.value);
            });
            
            overlay.querySelector('.cancel-btn').addEventListener('click', () => {
                closeModal(null);
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    closeModal(input.value);
                } else if (e.key === 'Escape') {
                    closeModal(null);
                }
            });
            
            document.body.appendChild(overlay);
            
            // Focus input
            setTimeout(() => input.focus(), 100);
        });
    }
    
    // ============================================
    // NOTIFICATION POLLING
    // ============================================
    
    async checkNewNotifications(userId, apiEndpoint) {
        try {
            let response;
            
            if (apiEndpoint) {
                response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCsrfToken()
                    },
                    body: JSON.stringify({
                        action: 'getNotifications',
                        userId: userId,
                        filter: 'unread',
                        limit: 1
                    })
                });
                
                if (!response.ok) throw new Error('API request failed');
                response = await response.json();
            } else {
                // Fallback: check localStorage
                const stored = localStorage.getItem(`notifications_${userId}`);
                response = {
                    success: true,
                    total: stored ? JSON.parse(stored).filter(n => !n.read).length : 0
                };
            }
            
            if (response?.success && response.total > 0) {
                this.updateBadge(response.total);
                
                // Show browser notification for new items
                if (response.total > (this.lastNotificationCount || 0)) {
                    await this.showBrowserNotification('Notifikasi Baru', {
                        body: `Anda memiliki ${response.total} notifikasi belum dibaca`,
                        tag: 'new-notifications'
                    });
                }
                
                this.lastNotificationCount = response.total;
                return response.total;
            }
            
            this.updateBadge(0);
            return 0;
            
        } catch (error) {
            this.log('error', 'Failed to check notifications', {
                error: error.message,
                userId
            });
            return 0;
        }
    }
    
    startPolling(userId, apiEndpoint, interval = 30000) {
        // Stop existing polling untuk user ini
        this.stopPolling(userId);
        
        // Check immediately
        this.checkNewNotifications(userId, apiEndpoint);
        
        // Start interval
        const intervalId = setInterval(() => {
            this.checkNewNotifications(userId, apiEndpoint);
        }, interval);
        
        this.pollingIntervals.set(userId, intervalId);
        
        this.log('debug', 'Notification polling started', {
            userId,
            interval
        });
        
        return intervalId;
    }
    
    stopPolling(userId) {
        if (this.pollingIntervals.has(userId)) {
            clearInterval(this.pollingIntervals.get(userId));
            this.pollingIntervals.delete(userId);
        }
    }
    
    stopAllPolling() {
        this.pollingIntervals.forEach((intervalId, userId) => {
            clearInterval(intervalId);
        });
        this.pollingIntervals.clear();
    }
    
    // ============================================
    // NOTIFICATION BADGE
    // ============================================
    
    updateBadge(count) {
        const badge = document.getElementById('notificationBadge');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-flex';
                badge.setAttribute('data-count', count);
            } else {
                badge.style.display = 'none';
                badge.removeAttribute('data-count');
            }
        }
        
        // Update PWA app badge jika didukung
        if ('setAppBadge' in navigator) {
            if (count > 0) {
                navigator.setAppBadge(count).catch(() => {});
            } else {
                navigator.clearAppBadge().catch(() => {});
            }
        }
    }
    
    // ============================================
    // PWA PUSH NOTIFICATIONS
    // ============================================
    
    async setupPushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            this.log('warn', 'Push notifications not supported');
            return;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                this.pushSubscription = subscription;
                this.log('info', 'Push subscription exists');
            }
        } catch (error) {
            this.log('error', 'Failed to setup push notifications', {
                error: error.message
            });
        }
    }
    
    async subscribeToPush(publicKey) {
        if (!('serviceWorker' in navigator)) return null;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicKey)
            });
            
            this.pushSubscription = subscription;
            
            this.log('info', 'Push notification subscribed');
            
            return subscription;
        } catch (error) {
            this.log('error', 'Failed to subscribe to push', {
                error: error.message
            });
            return null;
        }
    }
    
    async unsubscribeFromPush() {
        if (this.pushSubscription) {
            await this.pushSubscription.unsubscribe();
            this.pushSubscription = null;
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }
    
    // ============================================
    // OFFLINE QUEUE
    // ============================================
    
    addToOfflineQueue(notification) {
        this.offlineQueue.push({
            ...notification,
            queuedAt: Date.now()
        });
        
        // Simpan ke localStorage untuk persistence
        try {
            const stored = JSON.parse(localStorage.getItem('offline_notifications') || '[]');
            stored.push(notification);
            if (stored.length > 100) stored.shift();
            localStorage.setItem('offline_notifications', JSON.stringify(stored));
        } catch {}
    }
    
    processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        this.log('info', 'Processing offline notification queue', {
            count: this.offlineQueue.length
        });
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        
        queue.forEach(notification => {
            this.showToast(notification.message, notification);
        });
        
        // Clear stored queue
        try {
            localStorage.removeItem('offline_notifications');
        } catch {}
    }
    
    // ============================================
    // SOUND EFFECTS
    // ============================================
    
    preloadSounds() {
        const soundTypes = ['success', 'error', 'warning', 'info'];
        
        soundTypes.forEach(type => {
            try {
                const audio = new Audio();
                audio.preload = 'auto';
                
                // Gunakan Web Audio API untuk generate simple sounds
                this.sounds[type] = () => this.generateTone(type);
            } catch {
                // Sound not supported
            }
        });
    }
    
    generateTone(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            const tones = {
                success: { frequency: 800, duration: 0.15 },
                error: { frequency: 300, duration: 0.3 },
                warning: { frequency: 500, duration: 0.2 },
                info: { frequency: 600, duration: 0.1 }
            };
            
            const tone = tones[type] || tones.info;
            
            oscillator.frequency.value = tone.frequency;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + tone.duration);
            
            setTimeout(() => audioContext.close(), tone.duration + 0.1);
        } catch {
            // Web Audio API not supported
        }
    }
    
    playSound(type) {
        if (this.sounds[type]) {
            this.sounds[type]();
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateId() {
        return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    sanitize(str) {
        if (!str) return '';
        if (typeof str !== 'string') return String(str);
        
        // Remove HTML tags
        return str.replace(/<[^>]*>/g, '');
    }
    
    escapeHtml(str) {
        if (!str) return '';
        if (typeof str !== 'string') return String(str);
        
        const htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
        return str.replace(/[&<>"'\/]/g, char => htmlEntities[char]);
    }
    
    getCsrfToken() {
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
    // PUBLIC API
    // ============================================
    
    getVisibleToasts() {
        return [...this.visibleToasts];
    }
    
    getQueueLength() {
        return this.queue.length;
    }
    
    getOfflineQueueLength() {
        return this.offlineQueue.length;
    }
    
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.setPosition(this.config.position);
    }
    
    destroy() {
        this.dismissAll();
        this.stopAllPolling();
        
        if (this.toastContainer) {
            this.toastContainer.remove();
        }
        
        // Cleanup event listeners
        window.removeEventListener('online', this.processOfflineQueue);
        window.removeEventListener('offline', this.processOfflineQueue);
        
        this.log('info', 'Notification system destroyed');
    }
}

// Create singleton
const notifications = new NotificationSystem();

// Export
export default notifications;
export { NotificationSystem };