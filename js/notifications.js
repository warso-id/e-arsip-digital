<<<<<<< HEAD
// FILE: js/notifications.js
// ============================================
// NOTIFICATION HELPER - E-ARSIP DIGITAL
// ============================================

class NotificationHelper {
    /**
     * Show browser notification
     */
    static async showBrowserNotification(title, body, icon = '/favicon.ico') {
        if (!('Notification' in window)) {
            console.warn('Browser tidak mendukung notifikasi');
            return;
        }
        
        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon });
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification(title, { body, icon });
            }
        }
    }
    
    /**
     * Show toast notification
     */
    static showToast(message, type = 'info', duration = 3000) {
        const toastContainer = this.getToastContainer();
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const colors = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };
        
        const toastId = 'toast-' + Date.now();
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-white ${colors[type]} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${icons[type]} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: duration
        });
        
        bsToast.show();
        
        // Remove after hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
        
        return toastId;
    }
    
    /**
     * Get or create toast container
     */
    static getToastContainer() {
        let container = document.getElementById('toastContainer');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * Show success toast
     */
    static success(message, duration) {
        return this.showToast(message, 'success', duration);
    }
    
    /**
     * Show error toast
     */
    static error(message, duration) {
        return this.showToast(message, 'error', duration);
    }
    
    /**
     * Show warning toast
     */
    static warning(message, duration) {
        return this.showToast(message, 'warning', duration);
    }
    
    /**
     * Show info toast
     */
    static info(message, duration) {
        return this.showToast(message, 'info', duration);
    }
    
    /**
     * Show confirmation dialog
     */
    static confirm(message, title = 'Konfirmasi') {
        return new Promise((resolve) => {
            const result = confirm(message);
            resolve(result);
        });
    }
    
    /**
     * Show alert
     */
    static alert(message, title = 'Informasi') {
        alert(message);
    }
    
    /**
     * Show modal confirmation
     */
    static async showModalConfirm(title, message, confirmText = 'Ya', cancelText = 'Tidak') {
        const modalId = 'confirmModal-' + Date.now();
        
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                ${cancelText}
                            </button>
                            <button type="button" class="btn btn-primary" id="${modalId}-confirm">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        
        return new Promise((resolve) => {
            document.getElementById(`${modalId}-confirm`).addEventListener('click', () => {
                modal.hide();
                resolve(true);
            });
            
            document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
                document.getElementById(modalId).remove();
                resolve(false);
            });
        });
    }
    
    /**
     * Check for new notifications
     */
    static async checkNewNotifications(userId) {
        try {
            const data = await api.sendRequest({
                action: 'getNotifications',
                userId: userId,
                filter: 'unread',
                limit: 1
            });
            
            if (data && data.success && data.total > 0) {
                // Update badge
                const badge = document.getElementById('notificationBadge');
                if (badge) {
                    badge.textContent = data.total;
                    badge.style.display = data.total > 0 ? 'inline' : 'none';
                }
                
                return data.total;
            }
        } catch (error) {
            console.error('Error checking notifications:', error);
        }
        
        return 0;
    }
    
    /**
     * Start notification polling
     */
    static startPolling(userId, interval = 30000) {
        // Check immediately
        this.checkNewNotifications(userId);
        
        // Start interval
        return setInterval(() => {
            this.checkNewNotifications(userId);
        }, interval);
    }
    
    /**
     * Stop notification polling
     */
    static stopPolling(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
=======
// js/notifications.js - Notification System 2026 (FIXED EXPORT)
/**
 * E-Arsip Digital - Notification System
 * Version: 2026.1.0
 */

import { Logger } from './logger.js';

class NotificationSystem {
    constructor(options = {}) {
        this.logger = new Logger('Notifications');
        
        this.config = {
            position: 'top-right',
            duration: 5000,
            maxVisible: 5,
            pauseOnHover: true,
            showProgress: true,
            sound: true,
            ...options
        };
        
        this.notifications = [];
        this.visibleToasts = [];
        this.queue = [];
        
        this.toastContainer = null;
        
        this.init();
    }
    
    init() {
        this.createContainers();
        this.logger.info('Notification system initialized');
    }
    
    createContainers() {
        if (document.querySelector('.toast-container')) return;
        
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container toast-top-right';
        this.toastContainer.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.toastContainer);
    }
    
    toast(message, options = {}) {
        const config = {
            type: 'info',
            title: '',
            message: message,
            duration: this.config.duration,
            ...options
        };
        
        const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        
        const toast = { id, ...config, createdAt: Date.now() };
        
        if (this.visibleToasts.length >= this.config.maxVisible) {
            this.queue.push(toast);
        } else {
            this.showToast(toast);
        }
        
        return id;
    }
    
    success(message, options = {}) {
        return this.toast(message, { ...options, type: 'success' });
    }
    
    error(message, options = {}) {
        return this.toast(message, { ...options, type: 'error', duration: options.duration || 0 });
    }
    
    warning(message, options = {}) {
        return this.toast(message, { ...options, type: 'warning' });
    }
    
    info(message, options = {}) {
        return this.toast(message, { ...options, type: 'info' });
    }
    
    showToast(toast) {
        if (!this.toastContainer) return;
        
        const element = document.createElement('div');
        element.className = 'toast toast-' + toast.type;
        element.setAttribute('role', 'alert');
        
        const bgColors = {
            success: '#f0fdf4',
            error: '#fef2f2',
            warning: '#fffbeb',
            info: '#eff6ff'
        };
        
        const textColors = {
            success: '#16a34a',
            error: '#dc2626',
            warning: '#d97706',
            info: '#2563eb'
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        element.style.cssText = `
            background: ${bgColors[toast.type] || '#fff'};
            color: ${textColors[toast.type] || '#333'};
            padding: 14px 18px;
            margin-bottom: 8px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 14px;
            animation: toastIn 0.3s ease;
            cursor: pointer;
            max-width: 380px;
            border-left: 4px solid ${textColors[toast.type] || '#333'};
        `;
        
        element.innerHTML = `
            <span style="font-size:18px;">${icons[toast.type] || '📢'}</span>
            <div style="flex:1;">
                ${toast.title ? '<strong>' + toast.title + '</strong><br>' : ''}
                ${toast.message}
            </div>
            <button style="background:none;border:none;cursor:pointer;font-size:16px;opacity:0.6;" 
                onclick="this.parentElement.remove()">×</button>
        `;
        
        // Click to dismiss
        element.addEventListener('click', function() {
            element.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(function() { element.remove(); }, 300);
        });
        
        this.toastContainer.appendChild(element);
        this.visibleToasts.push(toast);
        
        // Auto dismiss
        if (toast.duration > 0) {
            setTimeout(() => {
                element.style.animation = 'toastOut 0.3s ease forwards';
                setTimeout(() => {
                    element.remove();
                    this.visibleToasts = this.visibleToasts.filter(t => t.id !== toast.id);
                    
                    // Show next in queue
                    if (this.queue.length > 0) {
                        this.showToast(this.queue.shift());
                    }
                }, 300);
            }, toast.duration);
        }
    }
    
    dismissAll() {
        if (this.toastContainer) {
            this.toastContainer.innerHTML = '';
        }
        this.visibleToasts = [];
        this.queue = [];
    }
    
    destroy() {
        this.dismissAll();
        if (this.toastContainer) {
            this.toastContainer.remove();
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        }
    }
}

<<<<<<< HEAD
// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationHelper;
}
=======
// ⬇️ FIX: Pastikan default export
const notifications = new NotificationSystem();

// Tambahkan CSS animasi
const style = document.createElement('style');
style.textContent = `
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes toastOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
    .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }
`;
document.head.appendChild(style);

export default notifications;
export { NotificationSystem };
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
