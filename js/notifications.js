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
        }
    }
}

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
