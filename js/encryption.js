// js/notifications.js - Advanced Notification System 2026
/**
 * E-Arsip Digital - Notification System
 * Version: 2026.1.0
 * Features: Toast notifications, push notifications, notification center, sounds
 */

import { Logger } from './logger.js';
import utils from './utils.js';

class NotificationSystem {
    constructor(options = {}) {
        this.logger = new Logger('Notifications');
        
        // Configuration
        this.config = {
            position: 'top-right', // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
            duration: 5000, // Auto-dismiss duration (0 = sticky)
            maxVisible: 5, // Maximum visible toasts
            pauseOnHover: true,
            showProgress: true,
            sound: true,
            soundVolume: 0.5,
            animationDuration: 300,
            ...options
        };
        
        // State
        this.notifications = [];
        this.visibleToasts = [];
        this.queue = [];
        this.isPaused = false;
        
        // Containers
        this.toastContainer = null;
        this.notificationCenter = null;
        
        // Sound
        this.sounds = {};
        
        // Initialize
        this.init();
    }
    
    init() {
        this.createContainers();
        this.loadSounds();
        this.setupKeyboardShortcuts();
        
        this.logger.info('Notification system initialized', {
            position: this.config.position
        });
    }
    
    // ============================================
    // CONTAINERS
    // ============================================
    
    createContainers() {
        // Toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = `toast-container toast-${this.config.position}`;
        this.toastContainer.setAttribute('aria-live', 'polite');
        this.toastContainer.setAttribute('aria-atomic', 'false');
        document.body.appendChild(this.toastContainer);
        
        // Notification center (bell icon + dropdown)
        this.createNotificationCenter();
    }
    
    createNotificationCenter() {
        // Check if notification center already exists
        if (document.querySelector('.notification-center')) return;
        
        const center = document.createElement('div');
        center.className = 'notification-center';
        center.innerHTML = `
            <button class="notification-bell" id="notification-bell" aria-label="Notifikasi">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" id="notification-badge" style="display:none;">0</span>
            </button>
            <div class="notification-dropdown" id="notification-dropdown" style="display:none;">
                <div class="notification-dropdown-header">
                    <h4>Notifikasi</h4>
                    <div class="notification-actions">
                        <button id="mark-all-read" class="btn btn-sm btn-ghost">
                            Tandai Semua Dibaca
                        </button>
                        <button id="clear-all-notifications" class="btn btn-sm btn-ghost">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="notification-list" id="notification-list">
                    <div class="notification-empty">
                        <i class="fas fa-bell-slash"></i>
                        <p>Tidak ada notifikasi</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(center);
        
        // Attach event listeners
        this.attachCenterEvents();
    }
    
    attachCenterEvents() {
        const bell = document.getElementById('notification-bell');
        const dropdown = document.getElementById('notification-dropdown');
        
        bell?.addEventListener('click', () => {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });
        
        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-center')) {
                const dropdown = document.getElementById('notification-dropdown');
                if (dropdown) dropdown.style.display = 'none';
            }
        });
        
        // Mark all read
        document.getElementById('mark-all-read')?.addEventListener('click', () => {
            this.markAllAsRead();
        });
        
        // Clear all
        document.getElementById('clear-all-notifications')?.addEventListener('click', () => {
            this.clearAll();
        });
    }
    
    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    
    toast(message, options = {}) {
        const config = {
            type: 'info', // info, success, warning, error
            title: '',
            message: message,
            duration: this.config.duration,
            icon: null,
            action: null,
            ...options
        };
        
        // Generate unique ID
        const id = utils.generateUUID();
        
        const toast = {
            id,
            ...config,
            createdAt: Date.now(),
            timer: null,
            element: null
        };
        
        // Queue or show immediately
        if (this.visibleToasts.length >= this.config.maxVisible) {
            this.queue.push(toast);
        } else {
            this.showToast(toast);
        }
        
        return id;
    }
    
    success(message, options = {}) {
        return this.toast(message, { ...options, type: 'success', icon: 'check-circle' });
    }
    
    error(message, options = {}) {
        return this.toast(message, { ...options, type: 'error', icon: 'exclamation-circle', duration: 0 });
    }
    
    warning(message, options = {}) {
        return this.toast(message, { ...options, type: 'warning', icon: 'exclamation-triangle' });
    }
    
    info(message, options = {}) {
        return this.toast(message, { ...options, type: 'info', icon: 'info-circle' });
    }
    
    showToast(toast) {
        // Create toast element
        const element = this.createToastElement(toast);
        this.toastContainer.appendChild(element);
        
        // Store reference
        toast.element = element;
        this.visibleToasts.push(toast);
        
        // Add to notification center
        this.addToNotificationCenter(toast);
        
        // Play sound
        if (this.config.sound) {
            this.playSound(toast.type);
        }
        
        // Animate in
        requestAnimationFrame(() => {
            element.classList.add('visible');
        });
        
        // Auto-dismiss
        if (toast.duration > 0) {
            toast.timer = setTimeout(() => {
                this.dismissToast(toast.id);
            }, toast.duration);
        }
        
        // Pause on hover
        if (this.config.pauseOnHover) {
            element.addEventListener('mouseenter', () => {
                if (toast.timer) {
                    clearTimeout(toast.timer);
                    toast.timer = null;
                }
            });
            
            element.addEventListener('mouseleave', () => {
                if (!toast.timer && toast.duration > 0) {
                    toast.timer = setTimeout(() => {
                        this.dismissToast(toast.id);
                    }, toast.duration / 2); // Shorter duration after hover
                }
            });
        }
    }
    
    createToastElement(toast) {
        const element = document.createElement('div');
        element.className = `toast toast-${toast.type}`;
        element.setAttribute('role', 'alert');
        element.setAttribute('data-toast-id', toast.id);
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        element.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${toast.icon || icons[toast.type] || 'fa-info-circle'}"></i>
            </div>
            <div class="toast-content">
                ${toast.title ? `<div class="toast-title">${toast.title}</div>` : ''}
                <div class="toast-message">${toast.message}</div>
                ${toast.action ? `
                    <button class="toast-action" onclick="${toast.action.onClick}">
                        ${toast.action.label}
                    </button>
                ` : ''}
            </div>
            <button class="toast-close" aria-label="Tutup notifikasi">
                <i class="fas fa-times"></i>
            </button>
            ${this.config.showProgress ? '<div class="toast-progress"></div>' : ''}
        `;
        
        // Close button
        element.querySelector('.toast-close')?.addEventListener('click', () => {
            this.dismissToast(toast.id);
        });
        
        // Progress bar animation
        if (this.config.showProgress && toast.duration > 0) {
            const progressBar = element.querySelector('.toast-progress');
            if (progressBar) {
                progressBar.style.animationDuration = `${toast.duration}ms`;
            }
        }
        
        return element;
    }
    
    dismissToast(id) {
        const index = this.visibleToasts.findIndex(t => t.id === id);
        if (index === -1) return;
        
        const toast = this.visibleToasts[index];
        
        // Clear timer
        if (toast.timer) {
            clearTimeout(toast.timer);
        }
        
        // Animate out
        if (toast.element) {
            toast.element.classList.remove('visible');
            toast.element.classList.add('hiding');
            
            setTimeout(() => {
                toast.element.remove();
            }, this.config.animationDuration);
        }
        
        // Remove from visible list
        this.visibleToasts.splice(index, 1);
        
        // Show next in queue
        if (this.queue.length > 0) {
            const nextToast = this.queue.shift();
            this.showToast(nextToast);
        }
    }
    
    dismissAll() {
        [...this.visibleToasts].forEach(toast => {
            this.dismissToast(toast.id);
        });
        this.queue = [];
    }
    
    // ============================================
    // NOTIFICATION CENTER
    // ============================================
    
    addToNotificationCenter(toast) {
        const notification = {
            id: toast.id,
            type: toast.type,
            title: toast.title || toast.message,
            message: toast.message,
            timestamp: new Date(),
            read: false,
            action: toast.action
        };
        
        this.notifications.unshift(notification);
        
        // Keep only last 100 notifications
        if (this.notifications.length > 100) {
            this.notifications = this.notifications.slice(0, 100);
        }
        
        this.updateNotificationCenter();
        this.updateBadge();
    }
    
    updateNotificationCenter() {
        const list = document.getElementById('notification-list');
        if (!list) return;
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notification-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>Tidak ada notifikasi</p>
                </div>
            `;
        } else {
            list.innerHTML = this.notifications.map(notif => `
                <div class="notification-item ${notif.read ? 'read' : 'unread'}" 
                     data-notification-id="${notif.id}">
                    <div class="notification-item-icon ${notif.type}">
                        <i class="fas fa-${this.getNotificationIcon(notif.type)}"></i>
                    </div>
                    <div class="notification-item-content">
                        <div class="notification-item-title">${notif.title}</div>
                        <div class="notification-item-message">${notif.message}</div>
                        <div class="notification-item-time">${utils.timeAgo(notif.timestamp)}</div>
                    </div>
                    ${!notif.read ? '<span class="notification-dot"></span>' : ''}
                </div>
            `).join('');
            
            // Attach click handlers
            list.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', () => {
                    const notifId = item.dataset.notificationId;
                    this.markAsRead(notifId);
                });
            });
        }
    }
    
    updateBadge() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    
    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.updateNotificationCenter();
            this.updateBadge();
        }
    }
    
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.updateNotificationCenter();
        this.updateBadge();
    }
    
    clearAll() {
        this.notifications = [];
        this.updateNotificationCenter();
        this.updateBadge();
    }
    
    // ============================================
    // PUSH NOTIFICATIONS
    // ============================================
    
    async requestPushPermission() {
        if (!('Notification' in window)) {
            this.logger.warn('Push notifications not supported');
            return 'denied';
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.logger.info('Push notification permission:', permission);
            return permission;
        } catch (error) {
            this.logger.error('Push permission request failed', error);
            return 'denied';
        }
    }
    
    async sendPushNotification(title, options = {}) {
        if (Notification.permission !== 'granted') {
            const permission = await this.requestPushPermission();
            if (permission !== 'granted') return false;
        }
        
        try {
            const registration = await navigator.serviceWorker?.ready;
            if (!registration) return false;
            
            await registration.showNotification(title, {
                body: options.body || '',
                icon: options.icon || '/icons/icon-192x192.png',
                badge: '/icons/badge-72x72.png',
                vibrate: options.vibrate || [200, 100, 200],
                data: options.data || {},
                actions: options.actions || [],
                tag: options.tag || 'default',
                requireInteraction: options.requireInteraction || false,
                renotify: options.renotify || false,
                silent: options.silent || false,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            this.logger.error('Push notification failed', error);
            return false;
        }
    }
    
    // ============================================
    // SOUND
    // ============================================
    
    loadSounds() {
        // Use AudioContext for better control
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.logger.warn('AudioContext not available');
        }
    }
    
    async playSound(type) {
        if (!this.audioContext || !this.config.sound) return;
        
        // Resume context if suspended (autoplay policy)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        const frequencies = {
            success: [523.25, 659.25, 783.99], // C5, E5, G5
            error: [200, 150, 100],
            warning: [440, 350, 440],
            info: [440, 554.37]
        };
        
        const notes = frequencies[type] || [440];
        
        try {
            notes.forEach((freq, i) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = freq;
                oscillator.type = 'sine';
                
                gainNode.gain.value = this.config.soundVolume;
                gainNode.gain.exponentialRampToValueAtTime(
                    0.01,
                    this.audioContext.currentTime + 0.15 * (i + 1)
                );
                
                oscillator.start(this.audioContext.currentTime + 0.1 * i);
                oscillator.stop(this.audioContext.currentTime + 0.15 * (i + 1));
            });
        } catch (error) {
            this.logger.warn('Sound playback failed', error);
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'bell';
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N to toggle notification center
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                document.getElementById('notification-bell')?.click();
            }
            
            // Escape to dismiss all toasts
            if (e.key === 'Escape') {
                this.dismissAll();
            }
        });
    }
    
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }
    
    getNotifications() {
        return [...this.notifications];
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    // Quick notification helper
    notify(type, message, options = {}) {
        switch (type) {
            case 'success': return this.success(message, options);
            case 'error': return this.error(message, options);
            case 'warning': return this.warning(message, options);
            default: return this.info(message, options);
        }
    }
    
    // Confirmation notification
    confirm(message, onConfirm, onCancel) {
        return this.toast(message, {
            type: 'warning',
            duration: 0,
            title: 'Konfirmasi',
            action: {
                label: 'Ya',
                onClick: () => {
                    this.dismissAll();
                    onConfirm?.();
                }
            },
            icon: 'question-circle'
        });
    }
    
    // Persistent notification for important messages
    alert(title, message, type = 'info') {
        return this.toast(message, {
            type,
            title,
            duration: 0,
            icon: 'bell'
        });
    }
    
    destroy() {
        this.dismissAll();
        this.toastContainer?.remove();
        document.querySelector('.notification-center')?.remove();
        this.audioContext?.close();
        this.logger.info('Notification system destroyed');
    }
}

// Create singleton
const notifications = new NotificationSystem();

export default notifications;
export { NotificationSystem };