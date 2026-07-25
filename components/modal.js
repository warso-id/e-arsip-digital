// components/modal.js - Advanced Modal Component 2026
/**
 * E-Arsip Digital - Modal Component
 * Version: 2026.1.0
 * Features: Multiple sizes, animations, keyboard trap, focus management
 */

import { Logger } from '../js/logger.js';

class Modal {
    constructor(options = {}) {
        this.logger = new Logger('Modal');
        
        this.config = {
            id: options.id || `modal-${Date.now()}`,
            title: options.title || '',
            content: options.content || '',
            size: options.size || 'md', // sm, md, lg, xl, fullscreen
            closeOnOverlay: options.closeOnOverlay !== false,
            closeOnEsc: options.closeOnEsc !== false,
            showClose: options.showClose !== false,
            footer: options.footer || null,
            onOpen: options.onOpen || (() => {}),
            onClose: options.onClose || (() => {}),
            ...options
        };
        
        this.isOpen = false;
        this.element = null;
        this.overlay = null;
        this.previousFocus = null;
        
        if (options.autoCreate !== false) {
            this.create();
        }
    }
    
    create() {
        // Remove existing
        this.destroy();
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.id = `${this.config.id}-overlay`;
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = `modal-dialog modal-${this.config.size}`;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', `${this.config.id}-title`);
        
        dialog.innerHTML = `
            <div class="modal-header">
                <h3 id="${this.config.id}-title">${this.config.title}</h3>
                ${this.config.showClose ? `
                    <button class="modal-close" aria-label="Tutup" data-modal-close>
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
            <div class="modal-body">
                ${typeof this.config.content === 'string' ? this.config.content : ''}
            </div>
            ${this.config.footer ? `<div class="modal-footer">${this.config.footer}</div>` : ''}
        `;
        
        this.overlay.appendChild(dialog);
        this.element = dialog;
        
        // Insert content if it's a DOM element
        if (this.config.content instanceof HTMLElement) {
            dialog.querySelector('.modal-body').appendChild(this.config.content);
        }
        
        // Event listeners
        this.setupEvents();
        
        this.logger.info('Modal created', { id: this.config.id });
    }
    
    setupEvents() {
        // Close on overlay click
        if (this.config.closeOnOverlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }
        
        // Close button
        this.overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => {
            this.close();
        });
        
        // ESC key
        if (this.config.closeOnEsc) {
            this.escHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            };
            document.addEventListener('keydown', this.escHandler);
        }
        
        // Focus trap
        this.focusHandler = (e) => {
            if (e.key === 'Tab' && this.isOpen) {
                this.trapFocus(e);
            }
        };
        document.addEventListener('keydown', this.focusHandler);
    }
    
    open() {
        if (this.isOpen) return;
        
        if (!this.element) this.create();
        
        // Store previous focus
        this.previousFocus = document.activeElement;
        
        // Add to DOM
        document.body.appendChild(this.overlay);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Animate in
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
        });
        
        this.isOpen = true;
        
        // Focus first focusable element
        setTimeout(() => {
            this.focusFirst();
        }, 300);
        
        this.config.onOpen(this);
        
        this.logger.info('Modal opened', { id: this.config.id });
        
        return this;
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.overlay.classList.remove('visible');
        
        // Animate out
        setTimeout(() => {
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            
            // Restore body scroll
            document.body.style.overflow = '';
            
            // Restore focus
            if (this.previousFocus) {
                this.previousFocus.focus();
            }
        }, 300);
        
        this.isOpen = false;
        
        this.config.onClose(this);
        
        this.logger.info('Modal closed', { id: this.config.id });
        
        return this;
    }
    
    toggle() {
        return this.isOpen ? this.close() : this.open();
    }
    
    setTitle(title) {
        this.config.title = title;
        const titleEl = this.element?.querySelector('.modal-header h3');
        if (titleEl) titleEl.textContent = title;
    }
    
    setContent(content) {
        this.config.content = content;
        const body = this.element?.querySelector('.modal-body');
        if (!body) return;
        
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.innerHTML = '';
            body.appendChild(content);
        }
    }
    
    setFooter(footer) {
        this.config.footer = footer;
        let footerEl = this.element?.querySelector('.modal-footer');
        
        if (footer) {
            if (!footerEl) {
                footerEl = document.createElement('div');
                footerEl.className = 'modal-footer';
                this.element?.appendChild(footerEl);
            }
            footerEl.innerHTML = footer;
        } else if (footerEl) {
            footerEl.remove();
        }
    }
    
    getBody() {
        return this.element?.querySelector('.modal-body');
    }
    
    // ============================================
    // FOCUS MANAGEMENT
    // ============================================
    
    focusFirst() {
        const focusable = this.getFocusableElements();
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }
    
    getFocusableElements() {
        if (!this.element) return [];
        
        const selectors = [
            'a[href]', 'button:not([disabled])', 'input:not([disabled])',
            'select:not([disabled])', 'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ];
        
        return this.element.querySelectorAll(selectors.join(','));
    }
    
    trapFocus(e) {
        const focusable = this.getFocusableElements();
        if (focusable.length === 0) return;
        
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
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
    }
    
    // ============================================
    // STATIC METHODS
    // ============================================
    
    static alert(title, message) {
        const modal = new Modal({
            title,
            content: `<p>${message}</p>`,
            size: 'sm',
            footer: '<button class="btn btn-primary" data-modal-close>OK</button>'
        });
        
        return modal.open();
    }
    
    static confirm(title, message, onConfirm, onCancel) {
        const modal = new Modal({
            title,
            content: `<p>${message}</p>`,
            size: 'sm',
            footer: `
                <button class="btn btn-outline" id="modal-cancel-btn">Batal</button>
                <button class="btn btn-primary" id="modal-confirm-btn">Ya</button>
            `
        });
        
        modal.open();
        
        setTimeout(() => {
            document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
                modal.close();
                onConfirm?.();
            });
            
            document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
                modal.close();
                onCancel?.();
            });
        }, 100);
        
        return modal;
    }
    
    static prompt(title, placeholder, onSubmit) {
        const modal = new Modal({
            title,
            content: `<input type="text" class="form-input" id="modal-prompt-input" placeholder="${placeholder || ''}">`,
            size: 'sm',
            footer: `
                <button class="btn btn-outline" data-modal-close>Batal</button>
                <button class="btn btn-primary" id="modal-submit-btn">OK</button>
            `
        });
        
        modal.open();
        
        setTimeout(() => {
            const input = document.getElementById('modal-prompt-input');
            input?.focus();
            
            document.getElementById('modal-submit-btn')?.addEventListener('click', () => {
                modal.close();
                onSubmit?.(input?.value || '');
            });
            
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    modal.close();
                    onSubmit?.(input.value);
                }
            });
        }, 100);
        
        return modal;
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        if (this.overlay?.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
        
        if (this.focusHandler) {
            document.removeEventListener('keydown', this.focusHandler);
        }
        
        this.element = null;
        this.overlay = null;
        this.isOpen = false;
        
        document.body.style.overflow = '';
        
        this.logger.info('Modal destroyed', { id: this.config.id });
    }
}

export default Modal;
<<<<<<< HEAD
export { Modal };
=======
export { Modal };
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
