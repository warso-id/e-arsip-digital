// js/theme.js - Enterprise Theme Manager 2026
/**
 * E-Arsip Digital - Advanced Theme System
 * Version: 2026.1.0
 * Features: 8+ themes, system detection, custom builder, PWA-aware,
 *           accessibility (reduced motion, high contrast), smooth transitions,
 *           persistent storage, import/export, mobile gestures
 * Security: Theme validation, safe import, XSS prevention
 */

import APP_CONFIG from '../config/config.js';

class ThemeManager {
    constructor(config = {}) {
        // ✅ FIX: Lazy load logger
        this.logger = null;
        
        // Configuration
        this.config = {
            defaultTheme: 'light',
            available: ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red'],
            transitionDuration: 300,
            enableSystemDetection: true,
            enableReducedMotion: true,
            enableHighContrast: false,
            persistTheme: true,
            ...APP_CONFIG?.theme,
            ...config
        };
        
        // State
        this.currentTheme = null;
        this.previousTheme = null;
        this.isTransitioning = false;
        this.customTheme = null;
        this.previewTheme = null;
        this.transitionFrame = null;
        
        // Theme definitions (optimized - only essential variables)
        this.themes = this.defineThemes();
        
        // Bind methods
        this.handleSystemThemeChange = this.handleSystemThemeChange.bind(this);
        
        // PWA
        this.isPWA = this.detectPWA();
        
        this.init();
    }
    
    async init() {
        try {
            // Init logger
            await this.initLogger();
            
            // Load custom theme
            this.customTheme = this.loadCustomTheme();
            
            // Determine initial theme
            const initialTheme = this.determineInitialTheme();
            
            // Apply theme
            await this.applyTheme(initialTheme, false);
            
            // Listen for system changes
            if (this.config.enableSystemDetection) {
                this.listenSystemThemeChanges();
            }
            
            // Setup accessibility
            this.setupAccessibility();
            
            // Inject UI
            this.injectThemeToggle();
            
            // Setup PWA
            if (this.isPWA) {
                this.setupPWAMeta();
            }
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            this.log('info', 'Theme manager initialized', {
                currentTheme: this.currentTheme,
                isPWA: this.isPWA,
                systemDark: this.isSystemDark()
            });
            
            // Dispatch ready
            window.dispatchEvent(new CustomEvent('theme:ready', {
                detail: { theme: this.currentTheme }
            }));
            
        } catch (error) {
            console.error('[Theme] Initialization failed:', error);
        }
    }
    
    async initLogger() {
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Theme');
        } catch {
            this.logger = {
                debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
            };
        }
    }
    
    log(level, message, data = null) {
        if (this.logger?.[level]) {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // THEME DEFINITIONS (Optimized)
    // ============================================
    
    defineThemes() {
        return {
            light: {
                name: 'Light',
                icon: 'sun',
                type: 'light',
                colors: {
                    '--color-primary': '#2563eb',
                    '--color-primary-hover': '#1d4ed8',
                    '--color-primary-light': '#dbeafe',
                    '--color-bg': '#ffffff',
                    '--color-bg-secondary': '#f8fafc',
                    '--color-bg-tertiary': '#f1f5f9',
                    '--color-text': '#1e293b',
                    '--color-text-secondary': '#64748b',
                    '--color-text-muted': '#94a3b8',
                    '--color-border': '#e2e8f0',
                    '--color-sidebar': '#ffffff',
                    '--color-sidebar-hover': '#f1f5f9',
                    '--color-sidebar-active': '#eff6ff',
                    '--color-card': '#ffffff',
                    '--color-input': '#ffffff',
                    '--color-input-border': '#e2e8f0',
                    '--color-table-header': '#f8fafc',
                    '--color-table-hover': '#f1f5f9',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#10b981',
                    '--color-warning': '#f59e0b',
                    '--color-danger': '#ef4444',
                    '--color-info': '#3b82f6'
                }
            },
            
            dark: {
                name: 'Dark',
                icon: 'moon',
                type: 'dark',
                colors: {
                    '--color-primary': '#60a5fa',
                    '--color-primary-hover': '#93c5fd',
                    '--color-primary-light': '#1e3a5f',
                    '--color-bg': '#0f172a',
                    '--color-bg-secondary': '#1e293b',
                    '--color-bg-tertiary': '#334155',
                    '--color-text': '#f1f5f9',
                    '--color-text-secondary': '#94a3b8',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#334155',
                    '--color-sidebar': '#1e293b',
                    '--color-sidebar-hover': '#334155',
                    '--color-sidebar-active': '#1e3a5f',
                    '--color-card': '#1e293b',
                    '--color-input': '#0f172a',
                    '--color-input-border': '#334155',
                    '--color-table-header': '#1e293b',
                    '--color-table-hover': '#334155',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#34d399',
                    '--color-warning': '#fbbf24',
                    '--color-danger': '#f87171',
                    '--color-info': '#60a5fa'
                }
            },
            
            blue: {
                name: 'Ocean Blue',
                icon: 'water',
                type: 'light',
                colors: {
                    '--color-primary': '#3b82f6',
                    '--color-primary-hover': '#2563eb',
                    '--color-primary-light': '#dbeafe',
                    '--color-bg': '#f0f9ff',
                    '--color-bg-secondary': '#e0f2fe',
                    '--color-bg-tertiary': '#bae6fd',
                    '--color-text': '#1e3a5f',
                    '--color-text-secondary': '#475569',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#bae6fd',
                    '--color-sidebar': '#1e3a5f',
                    '--color-sidebar-hover': '#1e4a7f',
                    '--color-sidebar-active': '#2563eb',
                    '--color-card': '#ffffff',
                    '--color-input': '#ffffff',
                    '--color-input-border': '#bae6fd',
                    '--color-table-header': '#f0f9ff',
                    '--color-table-hover': '#e0f2fe',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#10b981',
                    '--color-warning': '#f59e0b',
                    '--color-danger': '#ef4444',
                    '--color-info': '#3b82f6'
                }
            },
            
            green: {
                name: 'Forest',
                icon: 'leaf',
                type: 'light',
                colors: {
                    '--color-primary': '#22c55e',
                    '--color-primary-hover': '#16a34a',
                    '--color-primary-light': '#dcfce7',
                    '--color-bg': '#f0fdf4',
                    '--color-bg-secondary': '#dcfce7',
                    '--color-bg-tertiary': '#bbf7d0',
                    '--color-text': '#14532d',
                    '--color-text-secondary': '#475569',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#bbf7d0',
                    '--color-sidebar': '#14532d',
                    '--color-sidebar-hover': '#166534',
                    '--color-sidebar-active': '#22c55e',
                    '--color-card': '#ffffff',
                    '--color-input': '#ffffff',
                    '--color-input-border': '#bbf7d0',
                    '--color-table-header': '#f0fdf4',
                    '--color-table-hover': '#dcfce7',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#22c55e',
                    '--color-warning': '#f59e0b',
                    '--color-danger': '#ef4444',
                    '--color-info': '#3b82f6'
                }
            },
            
            purple: {
                name: 'Royal',
                icon: 'crown',
                type: 'light',
                colors: {
                    '--color-primary': '#a855f7',
                    '--color-primary-hover': '#9333ea',
                    '--color-primary-light': '#f3e8ff',
                    '--color-bg': '#faf5ff',
                    '--color-bg-secondary': '#f3e8ff',
                    '--color-bg-tertiary': '#e9d5ff',
                    '--color-text': '#3b0764',
                    '--color-text-secondary': '#475569',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#e9d5ff',
                    '--color-sidebar': '#3b0764',
                    '--color-sidebar-hover': '#4c0a8f',
                    '--color-sidebar-active': '#a855f7',
                    '--color-card': '#ffffff',
                    '--color-input': '#ffffff',
                    '--color-input-border': '#e9d5ff',
                    '--color-table-header': '#faf5ff',
                    '--color-table-hover': '#f3e8ff',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#10b981',
                    '--color-warning': '#f59e0b',
                    '--color-danger': '#ef4444',
                    '--color-info': '#a855f7'
                }
            },
            
            orange: {
                name: 'Sunset',
                icon: 'sun',
                type: 'light',
                colors: {
                    '--color-primary': '#f97316',
                    '--color-primary-hover': '#ea580c',
                    '--color-primary-light': '#ffedd5',
                    '--color-bg': '#fff7ed',
                    '--color-bg-secondary': '#ffedd5',
                    '--color-bg-tertiary': '#fed7aa',
                    '--color-text': '#431407',
                    '--color-text-secondary': '#475569',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#fed7aa',
                    '--color-sidebar': '#431407',
                    '--color-sidebar-hover': '#5c1a0a',
                    '--color-sidebar-active': '#f97316',
                    '--color-card': '#ffffff',
                    '--color-input': '#ffffff',
                    '--color-input-border': '#fed7aa',
                    '--color-table-header': '#fff7ed',
                    '--color-table-hover': '#ffedd5',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#10b981',
                    '--color-warning': '#f59e0b',
                    '--color-danger': '#ef4444',
                    '--color-info': '#3b82f6'
                }
            },
            
            red: {
                name: 'Ruby',
                icon: 'heart',
                type: 'light',
                colors: {
                    '--color-primary': '#ef4444',
                    '--color-primary-hover': '#dc2626',
                    '--color-primary-light': '#fee2e2',
                    '--color-bg': '#fef2f2',
                    '--color-bg-secondary': '#fee2e2',
                    '--color-bg-tertiary': '#fecaca',
                    '--color-text': '#450a0a',
                    '--color-text-secondary': '#475569',
                    '--color-text-muted': '#64748b',
                    '--color-border': '#fecaca',
                    '--color-sidebar': '#450a0a',
                    '--color-sidebar-hover': '#5c1010',
                    '--color-sidebar-active': '#ef4444',
                    '--color-card': '#ffffff',
                    '--color-input': '#ffffff',
                    '--color-input-border': '#fecaca',
                    '--color-table-header': '#fef2f2',
                    '--color-table-hover': '#fee2e2',
                    '--color-shadow': '0, 0, 0',
                    '--color-success': '#10b981',
                    '--color-warning': '#f59e0b',
                    '--color-danger': '#ef4444',
                    '--color-info': '#3b82f6'
                }
            }
        };
    }
    
    // ============================================
    // THEME APPLICATION (Optimized)
    // ============================================
    
    async applyTheme(themeName, animate = true) {
        if (this.isTransitioning) return;
        
        // Validate theme
        if (!this.isThemeAvailable(themeName)) {
            this.log('warn', 'Theme not available', { themeName });
            themeName = this.config.defaultTheme;
        }
        
        // Handle custom
        if (themeName === 'custom' && this.customTheme) {
            return this.applyCustomTheme(this.customTheme, animate);
        }
        
        const theme = this.themes[themeName];
        if (!theme) return;
        
        this.isTransitioning = true;
        this.previousTheme = this.currentTheme;
        
        const root = document.documentElement;
        
        // Use requestAnimationFrame for smooth transitions
        if (animate && this.config.transitionDuration > 0) {
            // Check reduced motion preference
            const reduceMotion = this.config.enableReducedMotion && 
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            
            if (!reduceMotion) {
                root.style.setProperty('--theme-transition', 
                    `all ${this.config.transitionDuration}ms ease`);
            }
            
            this.setCSSVariables(theme.colors);
            
            // Clean up transition
            if (this.transitionFrame) cancelAnimationFrame(this.transitionFrame);
            this.transitionFrame = requestAnimationFrame(() => {
                setTimeout(() => {
                    root.style.removeProperty('--theme-transition');
                    this.transitionFrame = null;
                }, this.config.transitionDuration);
            });
        } else {
            this.setCSSVariables(theme.colors);
        }
        
        // Update state
        this.currentTheme = themeName;
        this.isTransitioning = false;
        
        // Update UI
        this.updateThemeToggle();
        this.updateMetaThemeColor(theme);
        this.updatePWAManifest(theme);
        
        // Update body attributes
        document.body.setAttribute('data-theme', themeName);
        document.body.classList.toggle('dark-mode', theme.type === 'dark');
        
        // Save
        this.saveTheme(themeName);
        
        // Dispatch event
        this.dispatchEvent('changed', {
            theme: themeName,
            previous: this.previousTheme,
            type: theme.type
        });
        
        this.log('info', 'Theme applied', { theme: themeName, type: theme.type });
    }
    
    applyCustomTheme(colors, animate = true) {
        // Validate custom colors
        const validated = this.validateCustomColors(colors);
        
        this.isTransitioning = true;
        this.previousTheme = this.currentTheme;
        
        this.setCSSVariables(validated);
        
        this.currentTheme = 'custom';
        this.customTheme = validated;
        this.isTransitioning = false;
        
        this.updateThemeToggle();
        this.saveCustomTheme(validated);
        this.saveTheme('custom');
        
        document.body.setAttribute('data-theme', 'custom');
        
        this.dispatchEvent('changed', {
            theme: 'custom',
            previous: this.previousTheme
        });
    }
    
    setCSSVariables(colors) {
        const root = document.documentElement;
        
        // Batch updates for performance
        const fragment = document.createDocumentFragment();
        
        Object.entries(colors).forEach(([property, value]) => {
            if (property.startsWith('--color-')) {
                root.style.setProperty(property, value);
            }
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
        
        // Restore current
        if (this.currentTheme === 'custom' && this.customTheme) {
            this.setCSSVariables(this.customTheme);
        } else if (this.themes[this.currentTheme]) {
            this.setCSSVariables(this.themes[this.currentTheme].colors);
        }
        
        this.previewTheme = null;
    }
    
    // ============================================
    // THEME DETECTION
    // ============================================
    
    determineInitialTheme() {
        // Check saved theme
        const saved = this.loadSavedTheme();
        if (saved && this.isThemeAvailable(saved)) {
            return saved;
        }
        
        // Check system preference
        if (this.config.enableSystemDetection) {
            return this.isSystemDark() ? 'dark' : 'light';
        }
        
        return this.config.defaultTheme;
    }
    
    isSystemDark() {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
    }
    
    listenSystemThemeChanges() {
        if (!window.matchMedia) return;
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        try {
            mediaQuery.addEventListener('change', this.handleSystemThemeChange);
        } catch {
            // Fallback for older browsers
            mediaQuery.addListener?.(this.handleSystemThemeChange);
        }
    }
    
    handleSystemThemeChange(event) {
        const savedTheme = this.loadSavedTheme();
        
        // Only auto-switch if user hasn't manually set a theme
        if (!savedTheme) {
            const newTheme = event.matches ? 'dark' : 'light';
            this.applyTheme(newTheme);
            this.log('info', 'System theme changed', { newTheme });
        }
    }
    
    // ============================================
    // ACCESSIBILITY
    // ============================================
    
    setupAccessibility() {
        // Listen for reduced motion
        if (this.config.enableReducedMotion) {
            const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            
            const handleMotionChange = (e) => {
                if (e.matches) {
                    document.documentElement.style.setProperty('--theme-transition', 'none');
                } else {
                    document.documentElement.style.removeProperty('--theme-transition');
                }
            };
            
            motionQuery.addEventListener('change', handleMotionChange);
            handleMotionChange(motionQuery); // Initial check
        }
        
        // High contrast support
        if (this.config.enableHighContrast) {
            const contrastQuery = window.matchMedia('(prefers-contrast: high)');
            
            const handleContrastChange = (e) => {
                document.body.classList.toggle('high-contrast', e.matches);
            };
            
            contrastQuery.addEventListener('change', handleContrastChange);
            handleContrastChange(contrastQuery);
        }
    }
    
    // ============================================
    // THEME UI
    // ============================================
    
    injectThemeToggle() {
        if (document.querySelector('.theme-toggle')) return;
        
        const currentTheme = this.themes[this.currentTheme];
        
        const toggleHTML = `
            <button class="theme-toggle" id="themeToggle" 
                aria-label="Toggle theme" 
                title="${currentTheme?.name || 'Theme'}"
                type="button">
                <i class="fas fa-${currentTheme?.icon || 'palette'}"></i>
                <span class="theme-toggle-label">${currentTheme?.name || 'Theme'}</span>
            </button>
        `;
        
        // Insert into header
        const target = document.querySelector('.header-actions') || 
                      document.querySelector('.navbar-nav') ||
                      document.body;
        
        target.insertAdjacentHTML('beforeend', toggleHTML);
        
        // Attach events
        this.attachThemeUIEvents();
    }
    
    attachThemeUIEvents() {
        const toggleBtn = document.getElementById('themeToggle');
        
        if (!toggleBtn) return;
        
        toggleBtn.addEventListener('click', () => {
            this.cycleTheme();
        });
        
        // Long press for theme menu
        let pressTimer;
        toggleBtn.addEventListener('mousedown', () => {
            pressTimer = setTimeout(() => {
                this.showThemeMenu();
            }, 500);
        });
        toggleBtn.addEventListener('mouseup', () => clearTimeout(pressTimer));
        toggleBtn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
        
        // Touch support
        toggleBtn.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => {
                this.showThemeMenu();
            }, 500);
        }, { passive: true });
        toggleBtn.addEventListener('touchend', () => clearTimeout(pressTimer));
    }
    
    updateThemeToggle() {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;
        
        const theme = this.themes[this.currentTheme];
        
        const icon = toggleBtn.querySelector('i');
        const label = toggleBtn.querySelector('.theme-toggle-label');
        
        if (icon) {
            icon.className = `fas fa-${theme?.icon || 'palette'}`;
        }
        
        if (label) {
            label.textContent = theme?.name || 'Custom';
        }
        
        toggleBtn.title = theme?.name || 'Theme';
        toggleBtn.setAttribute('aria-label', `Current theme: ${theme?.name || 'Custom'}`);
    }
    
    showThemeMenu() {
        // Create quick theme switcher
        const menu = document.createElement('div');
        menu.className = 'theme-quick-menu';
        menu.setAttribute('role', 'menu');
        
        this.config.available.forEach(themeName => {
            const theme = this.themes[themeName];
            if (!theme) return;
            
            const item = document.createElement('button');
            item.className = `theme-quick-item ${this.currentTheme === themeName ? 'active' : ''}`;
            item.setAttribute('role', 'menuitem');
            item.innerHTML = `
                <span class="theme-dot" style="background:${theme.colors['--color-primary']}"></span>
                <span>${theme.name}</span>
                ${this.currentTheme === themeName ? '<i class="fas fa-check"></i>' : ''}
            `;
            
            item.addEventListener('click', () => {
                this.applyTheme(themeName);
                menu.remove();
            });
            
            menu.appendChild(item);
        });
        
        // Position near toggle button
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            const rect = toggleBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 8}px`;
            menu.style.right = `${window.innerWidth - rect.right}px`;
        }
        
        document.body.appendChild(menu);
        
        // Close on outside click
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
        
        // Auto close after 5 seconds
        setTimeout(() => {
            if (document.body.contains(menu)) {
                menu.remove();
            }
        }, 5000);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+T - Cycle theme
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.cycleTheme();
            }
            
            // Ctrl+Shift+D - Toggle dark mode
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggleDarkMode();
            }
        });
    }
    
    updateMetaThemeColor(theme) {
        const primaryColor = theme.colors['--color-primary'];
        const bgColor = theme.colors['--color-bg'];
        
        // Update theme-color meta tag
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }
        metaTheme.content = bgColor;
        
        // Update for PWA maskable
        let metaThemeDark = document.querySelector('meta[name="theme-color-dark"]');
        if (theme.type === 'dark') {
            if (!metaThemeDark) {
                metaThemeDark = document.createElement('meta');
                metaThemeDark.name = 'theme-color';
                metaThemeDark.media = '(prefers-color-scheme: dark)';
                document.head.appendChild(metaThemeDark);
            }
            metaThemeDark.content = bgColor;
        }
        
        // Update apple-mobile-web-app-status-bar-style
        let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (!appleMeta) {
            appleMeta = document.createElement('meta');
            appleMeta.name = 'apple-mobile-web-app-status-bar-style';
            document.head.appendChild(appleMeta);
        }
        appleMeta.content = theme.type === 'dark' ? 'black-translucent' : 'default';
    }
    
    setupPWAMeta() {
        const theme = this.themes[this.currentTheme];
        if (theme) {
            this.updateMetaThemeColor(theme);
        }
    }
    
    async updatePWAManifest(theme) {
        if (!this.isPWA) return;
        
        try {
            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (!manifestLink) return;
            
            const response = await fetch(manifestLink.href);
            const manifest = await response.json();
            
            manifest.theme_color = theme.colors['--color-bg'];
            manifest.background_color = theme.colors['--color-bg'];
            
            // Update manifest via blob URL
            const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            manifestLink.href = url;
        } catch {
            // Silent fail
        }
    }
    
    // ============================================
    // STORAGE
    // ============================================
    
    saveTheme(themeName) {
        if (!this.config.persistTheme) return;
        
        try {
            localStorage.setItem('app_theme', themeName);
        } catch (error) {
            this.log('warn', 'Failed to save theme', { error: error.message });
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
            this.log('warn', 'Failed to save custom theme');
        }
    }
    
    loadCustomTheme() {
        try {
            const stored = localStorage.getItem('custom_theme');
            if (!stored) return null;
            
            const parsed = JSON.parse(stored);
            return this.validateCustomColors(parsed);
        } catch {
            return null;
        }
    }
    
    validateCustomColors(colors) {
        const validated = {};
        
        // Required color variables
        const requiredVars = [
            '--color-primary', '--color-bg', '--color-text',
            '--color-border', '--color-sidebar', '--color-card'
        ];
        
        // Validate and sanitize each color
        Object.entries(colors).forEach(([key, value]) => {
            if (key.startsWith('--color-') && typeof value === 'string') {
                // Basic color validation
                const sanitized = this.sanitizeColor(value);
                if (sanitized) {
                    validated[key] = sanitized;
                }
            }
        });
        
        // Ensure required vars exist
        requiredVars.forEach(varName => {
            if (!validated[varName]) {
                validated[varName] = this.themes.light.colors[varName] || '#000000';
            }
        });
        
        return validated;
    }
    
    sanitizeColor(color) {
        if (!color) return null;
        
        // Allow: hex colors, rgb(), rgba(), var(), transparent
        const validColor = /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|var\(--|transparent|currentColor|inherit)/;
        
        if (validColor.test(color.trim())) {
            return color.trim().substring(0, 100); // Limit length
        }
        
        return null;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    setTheme(themeName) {
        return this.applyTheme(themeName);
    }
    
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    getThemeList() {
        return this.config.available.map(name => ({
            name,
            label: this.themes[name]?.name || 'Custom',
            icon: this.themes[name]?.icon || 'palette',
            type: this.themes[name]?.type || 'light',
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
    
    cycleTheme() {
        const available = this.config.available;
        const currentIndex = available.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % available.length;
        this.applyTheme(available[nextIndex]);
    }
    
    buildCustomTheme(colors) {
        const validated = this.validateCustomColors(colors);
        this.customTheme = validated;
        this.applyCustomTheme(validated);
    }
    
    exportTheme() {
        const theme = this.currentTheme === 'custom' ? 
            this.customTheme : 
            this.themes[this.currentTheme]?.colors;
        
        return JSON.stringify(theme, null, 2);
    }
    
    importTheme(json) {
        try {
            const colors = JSON.parse(json);
            
            // Validate structure
            if (typeof colors !== 'object' || Array.isArray(colors)) {
                throw new Error('Invalid theme format');
            }
            
            this.buildCustomTheme(colors);
            return true;
        } catch (error) {
            this.log('error', 'Failed to import theme', { error: error.message });
            return false;
        }
    }
    
    resetToDefault() {
        this.customTheme = null;
        localStorage.removeItem('custom_theme');
        this.applyTheme(this.config.defaultTheme);
    }
    
    isThemeAvailable(themeName) {
        return themeName === 'custom' || this.config.available.includes(themeName);
    }
    
    detectPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    dispatchEvent(type, detail) {
        window.dispatchEvent(new CustomEvent(`theme:${type}`, {
            detail: { ...detail, timestamp: Date.now() }
        }));
    }
    
    destroy() {
        // Remove system theme listener
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.removeEventListener?.('change', this.handleSystemThemeChange);
            mediaQuery.removeListener?.(this.handleSystemThemeChange);
        }
        
        // Cancel pending animation
        if (this.transitionFrame) {
            cancelAnimationFrame(this.transitionFrame);
        }
        
        this.log('info', 'Theme manager destroyed');
    }
}

// Create singleton
const themeManager = new ThemeManager();

// Make available globally
if (typeof window !== 'undefined') {
    window.themeManager = themeManager;
}

export default themeManager;
export { ThemeManager };