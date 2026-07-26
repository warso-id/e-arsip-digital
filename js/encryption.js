// js/notifications.js - Notification System 2026 (SAFE & LIGHTWEIGHT)
/**
 * E-Arsip Digital - Notification System
 * Version: 2026.1.0
 * 
 * Features:
 * - Toast notifications (success, error, warning, info)
 * - Auto-dismiss with progress bar
 * - Queue system (max visible)
 * - Pause on hover
 * - Sound (optional)
 * - No dependencies
 */

var NotificationSystem = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        position: 'top-right',
        duration: 4000,
        maxVisible: 5,
        pauseOnHover: true,
        showProgress: true,
        sound: false,              // DISABLED by default
        soundVolume: 0.3
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _container = null;
    var _queue = [];
    var _visibleToasts = [];
    var _idCounter = 0;
    
    // ============================================
    // SANITIZATION
    // ============================================
    
    function sanitizeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    function sanitizeText(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    }
    
    // ============================================
    // CONTAINER
    // ============================================
    
    function getContainer() {
        if (_container) return _container;
        
        _container = document.createElement('div');
        _container.className = 'toast-container toast-' + config.position;
        _container.setAttribute('aria-live', 'polite');
        _container.setAttribute('aria-atomic', 'false');
        _container.style.cssText = 'position:fixed;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:380px;width:calc(100% - 32px);pointer-events:none;';
        
        // Position
        if (config.position.indexOf('top') === 0) {
            _container.style.top = '16px';
        } else {
            _container.style.bottom = '16px';
        }
        if (config.position.indexOf('right') !== -1) {
            _container.style.right = '16px';
        } else if (config.position.indexOf('left') !== -1) {
            _container.style.left = '16px';
        } else {
            _container.style.left = '50%';
            _container.style.transform = 'translateX(-50%)';
        }
        
        document.body.appendChild(_container);
        return _container;
    }
    
    // ============================================
    // SOUND (Optional, lightweight)
    // ============================================
    
    function playBeep(type) {
        if (!config.sound) return;
        
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            var freq = type === 'success' ? 800 : type === 'error' ? 300 : type === 'warning' ? 500 : 600;
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.value = config.soundVolume;
            
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            
            setTimeout(function() {
                osc.stop();
                ctx.close();
            }, 250);
        } catch(e) {
            // Audio not supported
        }
    }
    
    // ============================================
    // TOAST CREATION
    // ============================================
    
    function createToastElement(toast) {
        var element = document.createElement('div');
        element.className = 'toast toast-' + (toast.type || 'info');
        element.setAttribute('role', 'alert');
        element.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:12px 16px;background:#1e293b;color:white;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-size:13px;pointer-events:auto;animation:slideInRight 0.3s ease;min-width:280px;';
        
        // Icon
        var icons = {
            success: 'check-circle',
            error: 'times-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        var iconName = icons[toast.type] || 'info-circle';
        var iconColor = toast.type === 'success' ? '#16a34a' : toast.type === 'error' ? '#dc2626' : toast.type === 'warning' ? '#d97706' : '#3b82f6';
        
        var icon = document.createElement('div');
        icon.style.cssText = 'font-size:18px;color:' + iconColor + ';flex-shrink:0;margin-top:1px;';
        icon.innerHTML = '<i class="fas fa-' + iconName + '"></i>';
        element.appendChild(icon);
        
        // Content
        var content = document.createElement('div');
        content.style.cssText = 'flex:1;min-width:0;';
        
        if (toast.title) {
            var title = document.createElement('div');
            title.style.cssText = 'font-weight:600;margin-bottom:2px;font-size:14px;';
            title.textContent = toast.title;
            content.appendChild(title);
        }
        
        var message = document.createElement('div');
        message.style.cssText = 'opacity:0.9;line-height:1.4;';
        message.textContent = toast.message || '';
        content.appendChild(message);
        
        element.appendChild(content);
        
        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;padding:0;font-size:16px;flex-shrink:0;margin-top:1px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = function() {
            dismissToast(toast.id);
        };
        element.appendChild(closeBtn);
        
        // Progress bar
        if (config.showProgress && toast.duration > 0) {
            var progress = document.createElement('div');
            progress.style.cssText = 'position:absolute;bottom:0;left:0;height:3px;background:' + iconColor + ';border-radius:0 0 0 10px;animation:progressShrink ' + toast.duration + 'ms linear forwards;';
            
            // Style untuk animasi
            var styleEl = document.createElement('style');
            styleEl.textContent = '@keyframes progressShrink { from { width: 100%; } to { width: 0%; } }';
            document.head.appendChild(styleEl);
            
            element.style.position = 'relative';
            element.style.overflow = 'hidden';
            element.appendChild(progress);
        }
        
        // Hover pause
        if (config.pauseOnHover && toast.duration > 0) {
            element.addEventListener('mouseenter', function() {
                if (toast._timer) {
                    clearTimeout(toast._timer);
                    toast._timer = null;
                }
            });
            element.addEventListener('mouseleave', function() {
                if (!toast._timer) {
                    toast._timer = setTimeout(function() {
                        dismissToast(toast.id);
                    }, toast.duration / 2);
                }
            });
        }
        
        return element;
    }
    
    // ============================================
    // SHOW / DISMISS
    // ============================================
    
    function showToast(toast) {
        var container = getContainer();
        var element = createToastElement(toast);
        
        container.appendChild(element);
        toast.element = element;
        _visibleToasts.push(toast);
        
        // Auto-dismiss
        if (toast.duration > 0) {
            toast._timer = setTimeout(function() {
                dismissToast(toast.id);
            }, toast.duration);
        }
        
        // Sound
        playBeep(toast.type);
    }
    
    function dismissToast(id) {
        var index = -1;
        for (var i = 0; i < _visibleToasts.length; i++) {
            if (_visibleToasts[i].id === id) {
                index = i;
                break;
            }
        }
        
        if (index === -1) return;
        
        var toast = _visibleToasts[index];
        
        // Clear timer
        if (toast._timer) {
            clearTimeout(toast._timer);
            toast._timer = null;
        }
        
        // Animate out
        if (toast.element) {
            toast.element.style.opacity = '0';
            toast.element.style.transform = 'translateX(100px)';
            toast.element.style.transition = 'all 0.3s ease';
            
            setTimeout(function() {
                if (toast.element && toast.element.parentNode) {
                    toast.element.parentNode.removeChild(toast.element);
                }
            }, 300);
        }
        
        // Remove
        _visibleToasts.splice(index, 1);
        
        // Show next from queue
        if (_queue.length > 0) {
            var next = _queue.shift();
            showToast(next);
        }
    }
    
    function dismissAll() {
        var toasts = _visibleToasts.slice();
        for (var i = 0; i < toasts.length; i++) {
            dismissToast(toasts[i].id);
        }
        _queue = [];
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function toast(message, options) {
        if (!options) options = {};
        
        // Batasi queue
        if (_visibleToasts.length >= config.maxVisible) {
            var toastObj = {
                id: 'toast_' + (++_idCounter),
                type: options.type || 'info',
                title: options.title || '',
                message: String(message || ''),
                duration: options.duration || config.duration,
                timestamp: Date.now()
            };
            _queue.push(toastObj);
            return toastObj.id;
        }
        
        var toastObj = {
            id: 'toast_' + (++_idCounter),
            type: options.type || 'info',
            title: options.title || '',
            message: String(message || ''),
            duration: options.duration || config.duration,
            timestamp: Date.now()
        };
        
        showToast(toastObj);
        return toastObj.id;
    }
    
    function success(message, options) {
        if (!options) options = {};
        options.type = 'success';
        return toast(message, options);
    }
    
    function error(message, options) {
        if (!options) options = {};
        options.type = 'error';
        options.duration = options.duration || 0; // Sticky by default
        return toast(message, options);
    }
    
    function warning(message, options) {
        if (!options) options = {};
        options.type = 'warning';
        return toast(message, options);
    }
    
    function info(message, options) {
        if (!options) options = {};
        options.type = 'info';
        return toast(message, options);
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init(options) {
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = options[key];
                }
            }
        }
        
        // Pastikan container dibuat
        getContainer();
        
        // Inject CSS animasi
        if (!document.getElementById('toast-animations')) {
            var style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = '@keyframes slideInRight { from { opacity:0; transform:translateX(100px); } to { opacity:1; transform:translateX(0); } }';
            document.head.appendChild(style);
        }
    }
    
    // Auto-init
    setTimeout(init, 100);
    
    return {
        init: init,
        toast: toast,
        success: success,
        error: error,
        warning: warning,
        info: info,
        dismiss: dismissToast,
        dismissAll: dismissAll,
        
        /**
         * Get visible toast count
         */
        getVisibleCount: function() {
            return _visibleToasts.length;
        },
        
        /**
         * Get queue count
         */
        getQueueCount: function() {
            return _queue.length;
        },
        
        /**
         * Configure
         */
        configure: function(newConfig) {
            if (newConfig) {
                for (var key in newConfig) {
                    if (newConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = newConfig[key];
                    }
                }
            }
        },
        
        /**
         * Enable/disable sound
         */
        enableSound: function() { config.sound = true; },
        disableSound: function() { config.sound = false; }
    };
})();

// ============================================
// USAGE:
// ============================================
// NotificationSystem.success('Data berhasil disimpan!');
// NotificationSystem.error('Gagal memuat data');
// NotificationSystem.warning('Session akan berakhir');
// NotificationSystem.info('3 surat baru masuk');
// 
// // Custom
// NotificationSystem.toast('Pesan kustom', { type: 'success', duration: 3000, title: 'Judul' });
// 
// // Dismiss
// var id = NotificationSystem.success('Loading...', { duration: 0 });
// NotificationSystem.dismiss(id);
// ============================================