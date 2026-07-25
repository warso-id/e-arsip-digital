// js/theme.js - Advanced Theme Switcher 2026
/**
 * E-Arsip Digital - Theme Manager
 * Version: 2026.1.0
 * Features: 8 themes, system preference detection, custom theme builder,
 *           smooth transitions, persistent storage, preview mode
 */

import { Logger } from './logger.js';
import APP_CONFIG from '../config/config.js';

class ThemeManager {
    constructor(config = APP_CONFIG.theme || {}) {
        this.logger = new Logger('ThemeManager');
        
        // Configuration
        this.config = {
            defaultTheme: config.default || 'light',
            available: config.available || [
                'light', 'dark', 'blue', 'green', 'purple', 'orange', 'red', 'custom'
            ],
            customColors: config.customColors || {
                primary: '#2563eb',
                secondary: '#64748b',
                success: '#10b981',
                danger: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            },
            transitionDuration: 300,
            enableSystemDetection: true,
            ...config
        };
        
        // State
        this.currentTheme = null;
        this.previousTheme = null;
        this.isTransitioning = false;
        this.customTheme = this.loadCustomTheme();
        this.previewTheme = null;
        
        // Theme definitions
        this.themes = this.defineThemes();
        
        // Bind methods
        this.handleSystemThemeChange = this.handleSystemThemeChange.bind(this);
        
        this.initialized = false;
        
        this.init();
    }
    
    init() {
        // Load saved theme or detect system preference
        const savedTheme = this.loadSavedTheme();
        
        if (savedTheme && this.isThemeAvailable(savedTheme)) {
            this.applyTheme(savedTheme, false);
        } else if (this.config.enableSystemDetection) {
            this.applyTheme(this.detectSystemTheme(), false);
        } else {
            this.applyTheme(this.config.defaultTheme, false);
        }
        
        // Listen for system theme changes
        if (this.config.enableSystemDetection) {
            this.listenSystemThemeChanges();
        }
        
        // Inject theme toggle UI
        this.injectThemeToggle();
        
        this.initialized = true;
        
        this.logger.info('Theme manager initialized', {
            currentTheme: this.currentTheme,
            available: this.config.available.length
        });
    }
    
    // ============================================
    // THEME DEFINITIONS
    // ============================================
    
    defineThemes() {
        return {
            light: {
                name: 'Light',
                icon: 'fa-sun',
                colors: {
                    '--color-primary-50': '#eff6ff',
                    '--color-primary-100': '#dbeafe',
                    '--color-primary-200': '#bfdbfe',
                    '--color-primary-300': '#93c5fd',
                    '--color-primary-400': '#60a5fa',
                    '--color-primary-500': '#3b82f6',
                    '--color-primary-600': '#2563eb',
                    '--color-primary-700': '#1d4ed8',
                    '--color-primary-800': '#1e40af',
                    '--color-primary-900': '#1e3a8a',
                    '--color-bg-primary': '#ffffff',
                    '--color-bg-secondary': '#f8fafc',
                    '--color-bg-tertiary': '#f1f5f9',
                    '--color-text-primary': '#1e293b',
                    '--color-text-secondary': '#64748b',
                    '--color-text-muted': '#94a3b8',
                    '--color-border': '#e2e8f0',
                    '--color-border-light': '#f1f5f9',
                    '--color-shadow': 'rgba(0, 0, 0, 0.1)',
                    '--color-sidebar-bg': '#ffffff',
                    '--color-sidebar-text': '#64748b',
                    '--color-sidebar-active': '#2563eb',
                    '--color-card-bg': '#ffffff',
                    '--color-input-bg': '#ffffff',
                    '--color-input-border': '#e2e8f0',
                    '--color-table-header': '#f8fafc',
                    '--color-table-hover': '#f1f5f9',
                    '--color-table-stripe': '#fafafa'
                }
            },
            
            dark: {
                name: 'Dark',
                icon: 'fa-moon',
                colors: {
                    '--color-primary-50': '#1e293b',
                    '--color-primary-100': '#1e3a5f',
                    '--color-primary-200': '#1e40af',
                    '--color-primary-300': '#2563eb',
                    '--color-primary-400': '#3b82f6',
                    '--color-primary-500': '#60a5fa',
                    '--color-primary-600': '#93c5fd',
                    '--color-primary-700': '#bfdbfe',
                    '--color-primary-800': '#dbeafe',
                    '--color-primary-900': '#eff6ff',
                    '--color-bg-primary': '#0f172a',
                    '--color-bg-secondary': '#1e293b',
                    '--color-bg-tertiary': '#334155',
                    '--color-text-primary': '#f1f5f9',
                    '--color-text-secondary': '#94a3b8',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#334155',
                    '--color-border-light': '#1e293b',
                    '--color-shadow': 'rgba(0, 0, 0, 0.3)',
                    '--color-sidebar-bg': '#1e293b',
                    '--color-sidebar-text': '#94a3b8',
                    '--color-sidebar-active': '#60a5fa',
                    '--color-card-bg': '#1e293b',
                    '--color-input-bg': '#0f172a',
                    '--color-input-border': '#334155',
                    '--color-table-header': '#1e293b',
                    '--color-table-hover': '#334155',
                    '--color-table-stripe': '#1a2332'
                }
            },
            
            blue: {
                name: 'Ocean Blue',
                icon: 'fa-water',
                colors: {
                    '--color-primary-50': '#eff6ff',
                    '--color-primary-500': '#3b82f6',
                    '--color-primary-600': '#2563eb',
                    '--color-bg-primary': '#f0f9ff',
                    '--color-bg-secondary': '#e0f2fe',
                    '--color-text-primary': '#1e3a5f',
                    '--color-text-secondary': '#64748b',
                    '--color-border': '#bae6fd',
                    '--color-sidebar-bg': '#1e3a5f',
                    '--color-sidebar-text': '#bae6fd',
                    '--color-sidebar-active': '#60a5fa',
                    '--color-card-bg': '#ffffff',
                    '--color-input-bg': '#ffffff',
                    '--color-input-border': '#bae6fd',
                    '--color-table-header': '#f0f9ff',
                    '--color-table-hover': '#e0f2fe'
                }
            },
            
            green: {
                name: 'Forest Green',
                icon: 'fa-leaf',
                colors: {
                    '--color-primary-50': '#f0fdf4',
                    '--color-primary-500': '#22c55e',
                    '--color-primary-600': '#16a34a',
                    '--color-bg-primary': '#f0fdf4',
                    '--color-bg-secondary': '#dcfce7',
                    '--color-text-primary': '#14532d',
                    '--color-text-secondary': '#64748b',
                    '--color-border': '#bbf7d0',
                    '--color-sidebar-bg': '#14532d',
                    '--color-sidebar-text': '#bbf7d0',
                    '--color-sidebar-active': '#4ade80',
                    '--color-card-bg': '#ffffff',
                    '--color-input-bg': '#ffffff',
                    '--color-input-border': '#bbf7d0',
                    '--color-table-header': '#f0fdf4',
                    '--color-table-hover': '#dcfce7'
                }
            },
            
            purple: {
                name: 'Royal Purple',
                icon: 'fa-crown',
                colors: {
                    '--color-primary-50': '#faf5ff',
                    '--color-primary-500': '#a855f7',
                    '--color-primary-600': '#9333ea',
                    '--color-bg-primary': '#faf5ff',
                    '--color-bg-secondary': '#f3e8ff',
                    '--color-text-primary': '#3b0764',
                    '--color-text-secondary': '#64748b',
                    '--color-border': '#e9d5ff',
                    '--color-sidebar-bg': '#3b0764',
                    '--color-sidebar-text': '#e9d5ff',
                    '--color-sidebar-active': '#c084fc',
                    '--color-card-bg': '#ffffff',
                    '--color-input-bg': '#ffffff',
                    '--color-input-border': '#e9d5ff',
                    '--color-table-header': '#faf5ff',
                    '--color-table-hover': '#f3e8ff'
                }
            },
            
            orange: {
                name: 'Sunset Orange',
                icon: 'fa-sun',
                colors: {
                    '--color-primary-50': '#fff7ed',
                    '--color-primary-500': '#f97316',
                    '--color-primary-600': '#ea580c',
                    '--color-bg-primary': '#fff7ed',
                    '--color-bg-secondary': '#ffedd5',
                    '--color-text-primary': '#431407',
                    '--color-text-secondary': '#64748b',
                    '--color-border': '#fed7aa',
                    '--color-sidebar-bg': '#431407',
                    '--color-sidebar-text': '#fed7aa',
                    '--color-sidebar-active': '#fb923c',
                    '--color-card-bg': '#ffffff',
                    '--color-input-bg': '#ffffff',
                    '--color-input-border': '#fed7aa',
                    '--color-table-header': '#fff7ed',
                    '--color-table-hover': '#ffedd5'
                }
            },
            
            red: {
                name: 'Ruby Red',
                icon: 'fa-heart',
                colors: {
                    '--color-primary-50': '#fef2f2',
                    '--color-primary-500': '#ef4444',
                    '--color-primary-600': '#dc2626',
                    '--color-bg-primary': '#fef2f2',
                    '--color-bg-secondary': '#fee2e2',
                    '--color-text-primary': '#450a0a',
                    '--color-text-secondary': '#64748b',
                    '--color-border': '#fecaca',
                    '--color-sidebar-bg': '#450a0a',
                    '--color-sidebar-text': '#fecaca',
                    '--color-sidebar-active': '#f87171',
                    '--color-card-bg': '#ffffff',
                    '--color-input-bg': '#ffffff',
                    '--color-input-border': '#fecaca',
                    '--color-table-header': '#fef2f2',
                    '--color-table-hover': '#fee2e2'
                }
            }
        };
    }
    
    // ============================================
    // THEME APPLICATION
    // ============================================
    
    async applyTheme(themeName, animate = true) {
        if (this.isTransitioning) return;
        
        if (!this.isThemeAvailable(themeName)) {
            this.logger.warn('Theme not available, falling back to default', { themeName });
            themeName = this.config.defaultTheme;
        }
        
        // Handle custom theme
        if (themeName === 'custom' && this.customTheme) {
            this.applyCustomTheme(this.customTheme, animate);
            return;
        }
        
        this.isTransitioning = true;
        this.previousTheme = this.currentTheme;
        
        const theme = this.themes[themeName];
        if (!theme) {
            this.isTransitioning = false;
            return;
        }
        
        const root = document.documentElement;
        
        if (animate) {
            // Add transition class
            root.classList.add('theme-transitioning');
            
            // Apply theme colors
            this.setCSSVariables(theme.colors);
            
            // Remove transition class after animation
            await this.sleep(this.config.transitionDuration);
            root.classList.remove('theme-transitioning');
        } else {
            this.setCSSVariables(theme.colors);
        }
        
        // Update state
        this.currentTheme = themeName;
        this.isTransitioning = false;
        
        // Update UI
        this.updateThemeToggle();
        this.updateMetaThemeColor(theme.colors['--color-primary-600']);
        
        // Save preference
        this.saveTheme(themeName);
        
        // Dispatch event
        this.dispatchThemeChange(themeName);
        
        // Apply theme class to body
        document.body.setAttribute('data-theme', themeName);
        
        this.logger.info('Theme applied', { theme: themeName });
    }
    
    applyCustomTheme(colors, animate = true) {
        this.isTransitioning = true;
        this.previousTheme = this.currentTheme;
        
        const root = document.documentElement;
        
        if (animate) {
            root.classList.add('theme-transitioning');
            this.setCSSVariables(colors);
            setTimeout(() => {
                root.classList.remove('theme-transitioning');
            }, this.config.transitionDuration);
        } else {
            this.setCSSVariables(colors);
        }
        
        this.currentTheme = 'custom';
        this.customTheme = colors;
        this.isTransitioning = false;
        
        this.updateThemeToggle();
        this.saveCustomTheme(colors);
        this.saveTheme('custom');
        this.dispatchThemeChange('custom');
        document.body.setAttribute('data-theme', 'custom');
        
        this.logger.info('Custom theme applied');
    }
    
    setCSSVariables(colors) {
        const root = document.documentElement;
        
        Object.entries(colors).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
    }
    
    previewTheme(themeName) {
        if (themeName === this.currentTheme) return;
        
        this.previewTheme = themeName;
        
        if (themeName === 'custom' && this.customTheme) {
            this.setCSSVariables(this.customTheme);
        } else if (this.themes[themeName]) {
            this.setCSSVariables(this.themes[themeName].colors);
        }
    }
    
    cancelPreview() {
        if (!this.previewTheme) return;
        
        // Restore current theme
        if (this.currentTheme === 'custom' && this.customTheme) {
            this.setCSSVariables(this.customTheme);
        } else if (this.themes[this.currentTheme]) {
            this.setCSSVariables(this.themes[this.currentTheme].colors);
        }
        
        this.previewTheme = null;
    }
    
    applyPreview() {
        if (this.previewTheme) {
            this.applyTheme(this.previewTheme);
            this.previewTheme = null;
        }
    }
    
    // ============================================
    // THEME DETECTION
    // ============================================
    
    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
    
    listenSystemThemeChanges() {
        if (!window.matchMedia) return;
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Modern browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', this.handleSystemThemeChange);
        }
        // Legacy support
        else if (mediaQuery.addListener) {
            mediaQuery.addListener(this.handleSystemThemeChange);
        }
    }
    
    handleSystemThemeChange(event) {
        // Only auto-switch if user hasn't manually set a theme
        const savedTheme = this.loadSavedTheme();
        if (!savedTheme) {
            const newTheme = event.matches ? 'dark' : 'light';
            this.applyTheme(newTheme);
            this.logger.info('System theme changed', { newTheme });
        }
    }
    
    // ============================================
    // THEME UI
    // ============================================
    
    injectThemeToggle() {
        // Check if toggle already exists
        if (document.querySelector('.theme-toggle-container')) return;
        
        const toggleHTML = `
            <div class="theme-toggle-container">
                <button class="theme-toggle-btn" id="theme-toggle-btn" aria-label="Ganti tema">
                    <i class="fas fa-palette"></i>
                </button>
                <div class="theme-dropdown" id="theme-dropdown" style="display:none;">
                    <div class="theme-dropdown-header">
                        <h4>Pilih Tema</h4>
                        <button class="btn-close-theme" id="close-theme-dropdown">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="theme-options">
                        ${this.config.available.map(theme => {
                            const themeData = this.themes[theme];
                            if (!themeData && theme !== 'custom') return '';
                            
                            return `
                                <button class="theme-option ${this.currentTheme === theme ? 'active' : ''}"
                                    data-theme="${theme}"
                                    data-preview="${theme}"
                                    title="${themeData?.name || 'Custom'}">
                                    <div class="theme-preview-colors">
                                        <span class="theme-color" style="background:${this.getThemePrimaryColor(theme)}"></span>
                                        <span class="theme-color" style="background:${this.getThemeBgColor(theme)}"></span>
                                        <span class="theme-color" style="background:${this.getThemeSidebarColor(theme)}"></span>
                                    </div>
                                    <span>${themeData?.name || 'Custom'}</span>
                                    ${this.currentTheme === theme ? '<i class="fas fa-check"></i>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Insert into sidebar or header
        const target = document.querySelector('.sidebar-brand') || document.body;
        target.insertAdjacentHTML('afterend', toggleHTML);
        
        // Attach event listeners
        this.attachThemeUIEvents();
    }
    
    attachThemeUIEvents() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        const dropdown = document.getElementById('theme-dropdown');
        const closeBtn = document.getElementById('close-theme-dropdown');
        
        toggleBtn?.addEventListener('click', () => {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });
        
        closeBtn?.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.theme-toggle-container')) {
                dropdown.style.display = 'none';
            }
        });
        
        // Theme option hover - preview
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('mouseenter', () => {
                const theme = option.dataset.preview;
                if (theme) this.previewTheme(theme);
            });
            
            option.addEventListener('mouseleave', () => {
                this.cancelPreview();
            });
            
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                if (theme) {
                    this.applyTheme(theme);
                    dropdown.style.display = 'none';
                }
            });
        });
        
        // Keyboard shortcut: Ctrl+Shift+T
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.cycleTheme();
            }
        });
    }
    
    updateThemeToggle() {
        // Update active state in dropdown
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === this.currentTheme) {
                option.classList.add('active');
                // Add check icon if not present
                if (!option.querySelector('.fa-check')) {
                    option.insertAdjacentHTML('beforeend', '<i class="fas fa-check"></i>');
                }
            } else {
                // Remove check icon
                option.querySelector('.fa-check')?.remove();
            }
        });
    }
    
    updateMetaThemeColor(color) {
        const metaTag = document.querySelector('meta[name="theme-color"]');
        if (metaTag) {
            metaTag.content = color;
        }
    }
    
    // ============================================
    // THEME STORAGE
    // ============================================
    
    saveTheme(themeName) {
        try {
            localStorage.setItem('app_theme', themeName);
        } catch (error) {
            this.logger.warn('Failed to save theme', error);
        }
    }
    
    loadSavedTheme() {
        try {
            return localStorage.getItem('app_theme');
        } catch {
            return null;
        }
    }
    
    saveCustomTheme(colors) {
        try {
            localStorage.setItem('custom_theme', JSON.stringify(colors));
        } catch (error) {
            this.logger.warn('Failed to save custom theme', error);
        }
    }
    
    loadCustomTheme() {
        try {
            const stored = localStorage.getItem('custom_theme');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    isThemeAvailable(themeName) {
        return themeName === 'custom' || this.config.available.includes(themeName);
    }
    
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    getCurrentThemeData() {
        if (this.currentTheme === 'custom') return this.customTheme;
        return this.themes[this.currentTheme] || null;
    }
    
    getThemePrimaryColor(themeName) {
        if (themeName === 'custom' && this.customTheme) {
            return this.customTheme['--color-primary-600'] || '#2563eb';
        }
        return this.themes[themeName]?.colors?.['--color-primary-600'] || '#2563eb';
    }
    
    getThemeBgColor(themeName) {
        if (themeName === 'custom' && this.customTheme) {
            return this.customTheme['--color-bg-primary'] || '#ffffff';
        }
        return this.themes[themeName]?.colors?.['--color-bg-primary'] || '#ffffff';
    }
    
    getThemeSidebarColor(themeName) {
        if (themeName === 'custom' && this.customTheme) {
            return this.customTheme['--color-sidebar-bg'] || '#ffffff';
        }
        return this.themes[themeName]?.colors?.['--color-sidebar-bg'] || '#ffffff';
    }
    
    cycleTheme() {
        const currentIndex = this.config.available.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.config.available.length;
        this.applyTheme(this.config.available[nextIndex]);
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    dispatchThemeChange(themeName) {
        window.dispatchEvent(new CustomEvent('theme:changed', {
            detail: {
                theme: themeName,
                previous: this.previousTheme
            }
        }));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    setTheme(themeName) {
        return this.applyTheme(themeName);
    }
    
    getThemeList() {
        return this.config.available.map(name => ({
            name,
            label: this.themes[name]?.name || 'Custom',
            icon: this.themes[name]?.icon || 'fa-palette',
            isActive: this.currentTheme === name
        }));
    }
    
    toggleDarkMode() {
        if (this.currentTheme === 'dark') {
            this.applyTheme(this.previousTheme || 'light');
        } else {
            this.applyTheme('dark');
        }
    }
    
    buildCustomTheme(colors) {
        // Merge with defaults
        const merged = { ...this.config.customColors, ...colors };
        this.applyCustomTheme(merged);
    }
    
    exportTheme() {
        if (this.currentTheme === 'custom') {
            return JSON.stringify(this.customTheme, null, 2);
        }
        return JSON.stringify(this.themes[this.currentTheme]?.colors || {}, null, 2);
    }
    
    importTheme(json) {
        try {
            const colors = JSON.parse(json);
            this.buildCustomTheme(colors);
            return true;
        } catch (error) {
            this.logger.error('Failed to import theme', error);
            return false;
        }
    }
    
    resetToDefault() {
        this.applyTheme(this.config.defaultTheme);
    }
    
    destroy() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.removeEventListener?.('change', this.handleSystemThemeChange);
            mediaQuery.removeListener?.(this.handleSystemThemeChange);
        }
        
        this.initialized = false;
        this.logger.info('Theme manager destroyed');
    }
}

// Create singleton
const themeManager = new ThemeManager();

// Export for global access
window.themeManager = themeManager;

export default themeManager;
export { ThemeManager };