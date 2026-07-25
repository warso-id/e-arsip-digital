// js/accessibility.js - Accessibility Features 2026
/**
 * E-Arsip Digital - Accessibility Module
 * Version: 2026.1.0
 * Features: Screen reader support, keyboard navigation, focus management,
 *           contrast checking, font size adjustment, reduced motion
 */

import { Logger } from './logger.js';
<<<<<<< HEAD
import { resolveAppPath } from './path-utils.js';
=======
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216

class AccessibilityManager {
    constructor() {
        this.logger = new Logger('Accessibility');
        
        this.config = {
            enableScreenReader: true,
            enableKeyboardNav: true,
            enableFocusTrap: true,
            enableContrastCheck: true,
            enableFontScaling: true,
            enableReducedMotion: true,
            announcePageChanges: true,
            ...this.loadPreferences()
        };
        
        // State
        this.focusHistory = [];
        this.currentFocusTrap = null;
        this.announcements = [];
        this.announcementTimeout = null;
        
        // Font sizes
        this.fontSizes = ['small', 'normal', 'large', 'xlarge'];
        this.currentFontSize = this.config.fontSize || 'normal';
        this.fontSizeValues = {
            small: 14,
            normal: 16,
            large: 18,
            xlarge: 22
        };
        
        this.init();
    }
    
    init() {
        this.applySettings();
        this.setupKeyboardNavigation();
        this.setupScreenReaderAnnouncements();
        this.setupReducedMotion();
        this.injectAccessibilityTools();
        this.announcePageReady();
        
        this.logger.info('Accessibility manager initialized');
    }
    
    // ============================================
    // SETTINGS APPLICATION
    // ============================================
    
    applySettings() {
        // Font size
        if (this.config.enableFontScaling) {
            this.applyFontSize(this.currentFontSize);
        }
        
        // Reduced motion
        if (this.config.enableReducedMotion) {
            this.applyReducedMotion(this.config.reducedMotion);
        }
        
        // High contrast
        if (this.config.highContrast) {
            document.body.classList.add('high-contrast');
        }
        
        // Focus visible
        document.body.classList.add('focus-visible-enabled');
    }
    
    loadPreferences() {
        try {
            const stored = localStorage.getItem('accessibility_preferences');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    }
    
    savePreferences() {
        try {
            localStorage.setItem('accessibility_preferences', JSON.stringify({
                fontSize: this.currentFontSize,
                reducedMotion: this.config.reducedMotion,
                highContrast: this.config.highContrast
            }));
        } catch {
            // Ignore
        }
    }
    
    // ============================================
    // FONT SIZE
    // ============================================
    
    applyFontSize(size) {
        const fontSize = this.fontSizeValues[size] || 16;
        document.documentElement.style.fontSize = `${fontSize}px`;
        this.currentFontSize = size;
        this.savePreferences();
    }
    
    increaseFontSize() {
        const currentIndex = this.fontSizes.indexOf(this.currentFontSize);
        if (currentIndex < this.fontSizes.length - 1) {
            this.applyFontSize(this.fontSizes[currentIndex + 1]);
            this.announce(`Ukuran font diubah ke ${this.currentFontSize}`);
        }
    }
    
    decreaseFontSize() {
        const currentIndex = this.fontSizes.indexOf(this.currentFontSize);
        if (currentIndex > 0) {
            this.applyFontSize(this.fontSizes[currentIndex - 1]);
            this.announce(`Ukuran font diubah ke ${this.currentFontSize}`);
        }
    }
    
    resetFontSize() {
        this.applyFontSize('normal');
        this.announce('Ukuran font direset ke normal');
    }
    
    // ============================================
    // REDUCED MOTION
    // ============================================
    
    setupReducedMotion() {
        // Check system preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        if (prefersReducedMotion.matches) {
            this.config.reducedMotion = true;
            this.applyReducedMotion(true);
        }
        
        prefersReducedMotion.addEventListener('change', (e) => {
            this.config.reducedMotion = e.matches;
            this.applyReducedMotion(e.matches);
        });
    }
    
    applyReducedMotion(enabled) {
        if (enabled) {
            document.documentElement.classList.add('reduced-motion');
        } else {
            document.documentElement.classList.remove('reduced-motion');
        }
    }
    
    toggleReducedMotion() {
        this.config.reducedMotion = !this.config.reducedMotion;
        this.applyReducedMotion(this.config.reducedMotion);
        this.savePreferences();
        this.announce(this.config.reducedMotion ? 'Reduced motion diaktifkan' : 'Reduced motion dinonaktifkan');
    }
    
    // ============================================
    // KEYBOARD NAVIGATION
    // ============================================
    
    setupKeyboardNavigation() {
        if (!this.config.enableKeyboardNav) return;
        
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });
        
        // Track focus
        document.addEventListener('focusin', (e) => {
            this.focusHistory.push(e.target);
            if (this.focusHistory.length > 50) {
                this.focusHistory.shift();
            }
        });
    }
    
    handleKeyboardShortcut(event) {
        // Alt + 1-9 for navigation
        if (event.altKey && !event.ctrlKey && !event.metaKey) {
            const key = parseInt(event.key);
            if (key >= 1 && key <= 9) {
                event.preventDefault();
                
                const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
                if (navItems[key - 1]) {
                    navItems[key - 1].click();
                }
            }
            
            // Alt + 0: Skip to main content
            if (event.key === '0') {
                event.preventDefault();
                const mainContent = document.querySelector('.main-content') || 
                                   document.querySelector('main') ||
                                   document.querySelector('#main-content');
                mainContent?.focus();
            }
            
            // Alt + F: Focus search
            if (event.key === 'f' || event.key === 'F') {
                event.preventDefault();
                const searchInput = document.querySelector('[data-search-input], #search-input, .search-input, [type="search"]');
                searchInput?.focus();
            }
            
            // Alt + H: Go home
            if (event.key === 'h' || event.key === 'H') {
                event.preventDefault();
<<<<<<< HEAD
                window.location.href = resolveAppPath('/dashboard/');
=======
                window.location.href = '/dashboard/';
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
            }
            
            // Alt + A: Accessibility menu
            if (event.key === 'a' || event.key === 'A') {
                event.preventDefault();
                this.toggleAccessibilityPanel();
            }
        }
        
        // Escape: Close modals/dropdowns
        if (event.key === 'Escape') {
            this.closeOpenElements();
        }
    }
    
    closeOpenElements() {
        document.querySelectorAll('.modal-overlay.visible').forEach(modal => {
            modal.classList.remove('visible');
        });
        
        document.querySelectorAll('.dropdown.open, .dropdown-menu.show').forEach(dropdown => {
            dropdown.classList.remove('open', 'show');
        });
    }
    
    // ============================================
    // FOCUS TRAPPING
    // ============================================
    
    trapFocus(container) {
        if (!this.config.enableFocusTrap) return;
        
        this.currentFocusTrap = container;
        
        const focusableElements = container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        firstFocusable.focus();
        
        const handleTab = (e) => {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };
        
        container.addEventListener('keydown', handleTab);
        
        // Store cleanup function
        container._untrapFocus = () => {
            container.removeEventListener('keydown', handleTab);
        };
    }
    
    releaseFocusTrap(container) {
        if (container._untrapFocus) {
            container._untrapFocus();
            delete container._untrapFocus;
        }
        
        this.currentFocusTrap = null;
    }
    
    // ============================================
    // SCREEN READER ANNOUNCEMENTS
    // ============================================
    
    setupScreenReaderAnnouncements() {
        if (!this.config.enableScreenReader) return;
        
        // Create aria-live region
        if (!document.getElementById('sr-announcements')) {
            const region = document.createElement('div');
            region.id = 'sr-announcements';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-atomic', 'true');
            region.className = 'sr-only';
            document.body.appendChild(region);
        }
        
        // Create assertive region for urgent messages
        if (!document.getElementById('sr-assertive')) {
            const region = document.createElement('div');
            region.id = 'sr-assertive';
            region.setAttribute('aria-live', 'assertive');
            region.setAttribute('aria-atomic', 'true');
            region.className = 'sr-only';
            document.body.appendChild(region);
        }
    }
    
    announce(message, assertive = false) {
        const regionId = assertive ? 'sr-assertive' : 'sr-announcements';
        const region = document.getElementById(regionId);
        
        if (!region) return;
        
        // Clear previous announcement
        region.textContent = '';
        
        // Set new announcement
        setTimeout(() => {
            region.textContent = message;
        }, 50);
        
        // Clear after delay
        if (this.announcementTimeout) {
            clearTimeout(this.announcementTimeout);
        }
        
        this.announcementTimeout = setTimeout(() => {
            region.textContent = '';
        }, 5000);
    }
    
    announcePageReady() {
        if (this.config.announcePageChanges) {
            setTimeout(() => {
                const pageTitle = document.title || 'Halaman';
                this.announce(`${pageTitle} telah dimuat`);
            }, 500);
        }
    }
    
    // ============================================
    // ACCESSIBILITY TOOLS PANEL
    // ============================================
    
    injectAccessibilityTools() {
        if (document.querySelector('.a11y-tools')) return;
        
        const tools = document.createElement('div');
        tools.className = 'a11y-tools';
        tools.setAttribute('role', 'toolbar');
        tools.setAttribute('aria-label', 'Alat aksesibilitas');
        tools.innerHTML = `
            <button class="a11y-tool-btn" data-action="font-increase" title="Perbesar font" aria-label="Perbesar ukuran font">
                <i class="fas fa-text-height"></i>
            </button>
            <button class="a11y-tool-btn" data-action="font-decrease" title="Perkecil font" aria-label="Perkecil ukuran font">
                <i class="fas fa-text-width"></i>
            </button>
            <button class="a11y-tool-btn" data-action="contrast" title="High contrast" aria-label="Toggle high contrast mode">
                <i class="fas fa-adjust"></i>
            </button>
            <button class="a11y-tool-btn" data-action="motion" title="Reduced motion" aria-label="Toggle reduced motion">
                <i class="fas fa-running"></i>
            </button>
            <button class="a11y-tool-btn" data-action="reset" title="Reset" aria-label="Reset pengaturan aksesibilitas">
                <i class="fas fa-undo"></i>
            </button>
        `;
        
        document.body.appendChild(tools);
        
        // Event handlers
        tools.querySelector('[data-action="font-increase"]')?.addEventListener('click', () => this.increaseFontSize());
        tools.querySelector('[data-action="font-decrease"]')?.addEventListener('click', () => this.decreaseFontSize());
        tools.querySelector('[data-action="contrast"]')?.addEventListener('click', () => this.toggleHighContrast());
        tools.querySelector('[data-action="motion"]')?.addEventListener('click', () => this.toggleReducedMotion());
        tools.querySelector('[data-action="reset"]')?.addEventListener('click', () => this.resetAll());
    }
    
    toggleAccessibilityPanel() {
        const tools = document.querySelector('.a11y-tools');
        if (tools) {
            tools.classList.toggle('visible');
        }
    }
    
    toggleHighContrast() {
        this.config.highContrast = !this.config.highContrast;
        document.body.classList.toggle('high-contrast');
        this.savePreferences();
        this.announce(this.config.highContrast ? 'High contrast diaktifkan' : 'High contrast dinonaktifkan');
    }
    
    resetAll() {
        this.resetFontSize();
        this.config.highContrast = false;
        document.body.classList.remove('high-contrast');
        this.config.reducedMotion = false;
        document.documentElement.classList.remove('reduced-motion');
        this.savePreferences();
        this.announce('Pengaturan aksesibilitas direset');
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    isScreenReaderActive() {
        // Detect if screen reader is likely active
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
               document.querySelector('[aria-live]') !== null;
    }
    
    getFocusableElements(container = document) {
        return container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
    }
    
    getLastFocused() {
        return this.focusHistory[this.focusHistory.length - 1] || null;
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        const tools = document.querySelector('.a11y-tools');
        tools?.remove();
        
        this.logger.info('Accessibility manager destroyed');
    }
}

// Create singleton
const accessibility = new AccessibilityManager();

export default accessibility;
export { AccessibilityManager };