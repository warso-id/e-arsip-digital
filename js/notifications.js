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
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationHelper;
}