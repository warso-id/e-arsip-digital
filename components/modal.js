// components/modal.js - Advanced Modal Component 2026 (SECURE)
/**
 * E-Arsip Digital - Modal Component
 * Version: 2026.1.0
 * Features: Multiple sizes, animations, keyboard trap, focus management,
 *           XSS prevention, PWA mobile support, z-index management
 * 
 * Usage:
 *   var modal = Modal.create({ title: 'Judul', content: 'Konten' });
 *   modal.open();
 *   
 *   Modal.alert('Perhatian', 'Pesan alert');
 *   Modal.confirm('Konfirmasi', 'Yakin?', function() { ... });
 */

var Modal = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _zIndex = 1000;
    var _openModals = [];
    var _bodyScrollRestore = null;
    
    // ============================================
    // SANITIZATION
    // ============================================
    function sanitizeHTML(str) {
        if (!str) return '';
        if (typeof str !== 'string') return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    function sanitizeText(str) {
        if (!str) return '';
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                  .replace(/'/g, '&#x27;');
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function getNextZIndex() {
        return ++_zIndex;
    }
    
    function lockBodyScroll() {
        if (_openModals.length === 0) {
            _bodyScrollRestore = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = getScrollbarWidth() + 'px';
        }
    }
    
    function unlockBodyScroll() {
        if (_openModals.length === 0) {
            document.body.style.overflow = _bodyScrollRestore || '';
            document.body.style.paddingRight = '';
            _bodyScrollRestore = null;
        }
    }
    
    function getScrollbarWidth() {
        var div = document.createElement('div');
        div.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;';
        document.body.appendChild(div);
        var width = div.offsetWidth - div.clientWidth;
        document.body.removeChild(div);
        return width;
    }
    
    // ============================================
    // FOCUSABLE SELECTORS
    // ============================================
    var FOCUSABLE_SELECTORS = [
        'a[href]:not([disabled])',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"]):not([disabled])',
        'audio[controls]',
        'video[controls]'
    ].join(',');
    
    // ============================================
    // MODAL CLASS
    // ============================================
    function ModalInstance(options) {
        var self = this;
        
        // Default config
        this.config = {
            id: 'modal-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5),
            title: '',
            content: '',
            size: 'md', // sm, md, lg, xl, fullscreen
            closeOnOverlay: true,
            closeOnEsc: true,
            showClose: true,
            footer: null,
            onOpen: null,
            onClose: null,
            onBeforeOpen: null,
            onBeforeClose: null,
            animate: true,
            duration: 250,
            zIndex: getNextZIndex()
        };
        
        // Merge options
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && key !== 'autoCreate') {
                    this.config[key] = options[key];
                }
            }
        }
        
        // State
        this.isOpen = false;
        this.element = null;
        this.overlay = null;
        this.previousFocus = null;
        this._escHandler = null;
        this._focusHandler = null;
        this._touchStartY = 0;
        this._id = Date.now().toString(36);
        
        // Auto-create
        if (options && options.autoCreate !== false) {
            this.create();
        }
    }
    
    // ============================================
    // CREATE
    // ============================================
    ModalInstance.prototype.create = function() {
        // Destroy existing first
        this.destroy();
        
        var cfg = this.config;
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.id = cfg.id + '-overlay';
        this.overlay.style.zIndex = cfg.zIndex;
        this.overlay.setAttribute('role', 'presentation');
        this.overlay.setAttribute('data-modal-id', cfg.id);
        
        // Create dialog
        var dialog = document.createElement('div');
        dialog.className = 'modal-dialog modal-' + sanitizeText(cfg.size);
        dialog.id = cfg.id;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', cfg.id + '-title');
        dialog.setAttribute('data-modal-id', cfg.id);
        
        // Header
        var header = document.createElement('div');
        header.className = 'modal-header';
        
        var titleEl = document.createElement('h3');
        titleEl.id = cfg.id + '-title';
        titleEl.textContent = cfg.title; // SAFE: textContent
        header.appendChild(titleEl);
        
        if (cfg.showClose) {
            var closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.setAttribute('aria-label', 'Tutup modal');
            closeBtn.setAttribute('data-modal-close', '');
            closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
            header.appendChild(closeBtn);
        }
        
        dialog.appendChild(header);
        
        // Body
        var body = document.createElement('div');
        body.className = 'modal-body';
        this.setBodyContent(body, cfg.content);
        dialog.appendChild(body);
        
        // Footer
        if (cfg.footer) {
            var footer = document.createElement('div');
            footer.className = 'modal-footer';
            // Footer bisa berisi HTML untuk tombol
            footer.innerHTML = cfg.footer; // Note: footer should be trusted HTML
            dialog.appendChild(footer);
        }
        
        this.overlay.appendChild(dialog);
        this.element = dialog;
        
        // Setup events
        this._setupEvents();
    };
    
    // ============================================
    // SET BODY CONTENT (SECURE)
    // ============================================
    ModalInstance.prototype.setBodyContent = function(bodyEl, content) {
        if (!bodyEl) return;
        
        // Clear
        bodyEl.innerHTML = '';
        
        if (!content) return;
        
        if (typeof content === 'string') {
            // String content - treat as text (safe)
            bodyEl.textContent = content;
        } else if (content instanceof HTMLElement) {
            // DOM element - append directly
            bodyEl.appendChild(content);
        } else if (typeof content === 'object' && content.nodeType === 1) {
            // Also DOM element
            bodyEl.appendChild(content);
        }
    };
    
    // ============================================
    // SETUP EVENTS
    // ============================================
    ModalInstance.prototype._setupEvents = function() {
        var self = this;
        
        // Close on overlay click
        if (this.config.closeOnOverlay) {
            this.overlay.addEventListener('click', function(e) {
                if (e.target === self.overlay) {
                    self.close();
                }
            });
        }
        
        // Close button
        var closeBtn = this.overlay.querySelector('[data-modal-close]');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.close();
            });
        }
        
        // ESC key handler
        if (this.config.closeOnEsc) {
            this._escHandler = function(e) {
                if (e.key === 'Escape' && self.isOpen) {
                    // Only close if this is the topmost modal
                    if (_openModals.length > 0 && _openModals[_openModals.length - 1] === self) {
                        self.close();
                    }
                }
            };
            document.addEventListener('keydown', this._escHandler);
        }
        
        // Focus trap
        this._focusHandler = function(e) {
            if (e.key === 'Tab' && self.isOpen) {
                self._trapFocus(e);
            }
        };
        document.addEventListener('keydown', this._focusHandler);
        
        // Touch/swipe for mobile
        if (this.overlay) {
            this.overlay.addEventListener('touchstart', function(e) {
                self._touchStartY = e.touches[0].clientY;
            }, { passive: true });
            
            this.overlay.addEventListener('touchmove', function(e) {
                // Prevent background scroll on iOS
                if (self.isOpen) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
    };
    
    // ============================================
    // OPEN
    // ============================================
    ModalInstance.prototype.open = function() {
        if (this.isOpen) return this;
        
        // Before open callback
        if (typeof this.config.onBeforeOpen === 'function') {
            if (this.config.onBeforeOpen(this) === false) {
                return this;
            }
        }
        
        if (!this.element) this.create();
        
        // Store previous focus
        this.previousFocus = document.activeElement;
        
        // Add to DOM
        document.body.appendChild(this.overlay);
        
        // Track open modals
        _openModals.push(this);
        
        // Lock body scroll
        lockBodyScroll();
        
        // Animate in
        if (this.config.animate) {
            this.overlay.style.opacity = '0';
            this.overlay.style.transition = 'opacity ' + this.config.duration + 'ms ease';
            
            // Force reflow
            this.overlay.offsetHeight;
            
            this.overlay.style.opacity = '1';
        }
        
        this.overlay.classList.add('visible');
        this.isOpen = true;
        
        // Focus first element
        var self = this;
        setTimeout(function() {
            self._focusFirst();
        }, this.config.duration + 50);
        
        // On open callback
        if (typeof this.config.onOpen === 'function') {
            this.config.onOpen(this);
        }
        
        return this;
    };
    
    // ============================================
    // CLOSE
    // ============================================
    ModalInstance.prototype.close = function() {
        if (!this.isOpen) return this;
        
        // Before close callback
        if (typeof this.config.onBeforeClose === 'function') {
            if (this.config.onBeforeClose(this) === false) {
                return this;
            }
        }
        
        // Remove from tracking
        var idx = _openModals.indexOf(this);
        if (idx !== -1) {
            _openModals.splice(idx, 1);
        }
        
        // Animate out
        if (this.config.animate) {
            this.overlay.style.opacity = '0';
        }
        
        this.overlay.classList.remove('visible');
        this.isOpen = false;
        
        // Remove from DOM after animation
        var self = this;
        setTimeout(function() {
            if (self.overlay && self.overlay.parentNode) {
                self.overlay.parentNode.removeChild(self.overlay);
            }
            
            // Unlock body scroll
            unlockBodyScroll();
            
            // Restore focus
            if (self.previousFocus && typeof self.previousFocus.focus === 'function') {
                try {
                    self.previousFocus.focus();
                } catch(e) {
                    // Element might be removed
                }
            }
        }, this.config.animate ? this.config.duration : 0);
        
        // On close callback
        if (typeof this.config.onClose === 'function') {
            this.config.onClose(this);
        }
        
        return this;
    };
    
    // ============================================
    // TOGGLE
    // ============================================
    ModalInstance.prototype.toggle = function() {
        return this.isOpen ? this.close() : this.open();
    };
    
    // ============================================
    // SETTERS
    // ============================================
    ModalInstance.prototype.setTitle = function(title) {
        this.config.title = title;
        var titleEl = this.element ? this.element.querySelector('#' + this.config.id + '-title') : null;
        if (titleEl) {
            titleEl.textContent = title; // SAFE: textContent
        }
    };
    
    ModalInstance.prototype.setContent = function(content) {
        this.config.content = content;
        var body = this.element ? this.element.querySelector('.modal-body') : null;
        if (body) {
            this.setBodyContent(body, content);
        }
    };
    
    ModalInstance.prototype.setFooter = function(footer) {
        this.config.footer = footer;
        var footerEl = this.element ? this.element.querySelector('.modal-footer') : null;
        
        if (footer) {
            if (!footerEl) {
                footerEl = document.createElement('div');
                footerEl.className = 'modal-footer';
                this.element.appendChild(footerEl);
            }
            footerEl.innerHTML = footer; // Footer is trusted HTML
        } else if (footerEl) {
            footerEl.parentNode.removeChild(footerEl);
        }
    };
    
    ModalInstance.prototype.getBody = function() {
        return this.element ? this.element.querySelector('.modal-body') : null;
    };
    
    // ============================================
    // FOCUS MANAGEMENT
    // ============================================
    ModalInstance.prototype._focusFirst = function() {
        var focusable = this._getFocusableElements();
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            // Focus the dialog itself
            if (this.element) {
                this.element.focus();
            }
        }
    };
    
    ModalInstance.prototype._getFocusableElements = function() {
        if (!this.element) return [];
        return Array.from(this.element.querySelectorAll(FOCUSABLE_SELECTORS));
    };
    
    ModalInstance.prototype._trapFocus = function(e) {
        var focusable = this._getFocusableElements();
        if (focusable.length === 0) return;
        
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };
    
    // ============================================
    // DESTROY
    // ============================================
    ModalInstance.prototype.destroy = function() {
        if (this.isOpen) {
            this.close();
        }
        
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        
        if (this._focusHandler) {
            document.removeEventListener('keydown', this._focusHandler);
            this._focusHandler = null;
        }
        
        this.element = null;
        this.overlay = null;
        this.previousFocus = null;
        this.isOpen = false;
    };
    
    // ============================================
    // STATIC API
    // ============================================
    return {
        /**
         * Create a new modal instance
         * @param {Object} options
         * @returns {ModalInstance}
         */
        create: function(options) {
            return new ModalInstance(options);
        },
        
        /**
         * Show alert modal
         * @param {string} title
         * @param {string} message
         * @param {Function} onClose
         * @returns {ModalInstance}
         */
        alert: function(title, message, onClose) {
            var modal = new ModalInstance({
                title: title,
                content: message,
                size: 'sm',
                footer: '<button class="btn btn-primary" data-modal-close>OK</button>',
                onClose: onClose || null
            });
            
            modal.open();
            
            // Focus OK button
            setTimeout(function() {
                var okBtn = modal.overlay.querySelector('[data-modal-close]');
                if (okBtn) okBtn.focus();
            }, 300);
            
            return modal;
        },
        
        /**
         * Show confirm modal
         * @param {string} title
         * @param {string} message
         * @param {Function} onConfirm
         * @param {Function} onCancel
         * @returns {ModalInstance}
         */
        confirm: function(title, message, onConfirm, onCancel) {
            var modal = new ModalInstance({
                title: title,
                content: message,
                size: 'sm',
                footer: 
                    '<button class="btn btn-outline" id="modal-cancel-' + Date.now() + '">Batal</button>' +
                    '<button class="btn btn-primary" id="modal-confirm-' + Date.now() + '">Ya</button>'
            });
            
            modal.open();
            
            // Attach events after render
            setTimeout(function() {
                var confirmBtn = modal.overlay.querySelector('[id^="modal-confirm-"]');
                var cancelBtn = modal.overlay.querySelector('[id^="modal-cancel-"]');
                
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', function() {
                        modal.close();
                        if (typeof onConfirm === 'function') onConfirm();
                    });
                }
                
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', function() {
                        modal.close();
                        if (typeof onCancel === 'function') onCancel();
                    });
                }
                
                // Focus confirm button
                if (confirmBtn) confirmBtn.focus();
            }, 300);
            
            return modal;
        },
        
        /**
         * Show prompt modal
         * @param {string} title
         * @param {string} placeholder
         * @param {Function} onSubmit
         * @param {string} defaultValue
         * @returns {ModalInstance}
         */
        prompt: function(title, placeholder, onSubmit, defaultValue) {
            var inputId = 'modal-prompt-' + Date.now();
            var safePlaceholder = sanitizeText(placeholder || '');
            var safeDefault = sanitizeText(defaultValue || '');
            
            var modal = new ModalInstance({
                title: title,
                content: '', // Will set via DOM
                size: 'sm',
                footer:
                    '<button class="btn btn-outline" data-modal-close>Batal</button>' +
                    '<button class="btn btn-primary" id="modal-submit-' + Date.now() + '">OK</button>'
            });
            
            // Create input element safely
            var inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'form-input';
            inputEl.id = inputId;
            inputEl.placeholder = safePlaceholder;
            inputEl.value = safeDefault;
            inputEl.setAttribute('maxlength', '500');
            
            modal.setContent(inputEl);
            modal.open();
            
            // Focus input
            setTimeout(function() {
                var input = document.getElementById(inputId);
                if (input) {
                    input.focus();
                    if (safeDefault) input.select();
                }
                
                var submitBtn = modal.overlay.querySelector('[id^="modal-submit-"]');
                
                if (submitBtn) {
                    submitBtn.addEventListener('click', function() {
                        var val = input ? input.value.trim() : '';
                        modal.close();
                        if (typeof onSubmit === 'function') onSubmit(val);
                    });
                }
                
                // Enter key to submit
                if (input) {
                    input.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') {
                            var val = input.value.trim();
                            modal.close();
                            if (typeof onSubmit === 'function') onSubmit(val);
                        }
                    });
                }
            }, 300);
            
            return modal;
        },
        
        /**
         * Get count of open modals
         * @returns {number}
         */
        getOpenCount: function() {
            return _openModals.length;
        },
        
        /**
         * Close all open modals
         */
        closeAll: function() {
            // Clone array because close() modifies it
            var modals = _openModals.slice();
            modals.forEach(function(m) {
                if (m && typeof m.close === 'function') {
                    m.close();
                }
            });
        }
    };
})();