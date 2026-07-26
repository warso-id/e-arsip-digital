// js/accessibility.js - Accessibility Features 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Accessibility Module
 * Version: 2026.1.0
 * 
 * Features:
 * - Reduced motion support
 * - Font size adjustment
 * - High contrast mode
 * - Screen reader announcements
 * - Focus visible enhancement
 * - Keyboard navigation helpers
 */

var Accessibility = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enableFontScaling: true,
        enableReducedMotion: true,
        enableHighContrast: false,
        enableScreenReader: true,
        enableFocusVisible: true,
        announcePageChanges: true,
        storageKey: 'earsip_a11y_prefs'
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _fontSizes = ['small', 'normal', 'large', 'xlarge'];
    var _fontSizeValues = {
        small: '14px',
        normal: '16px',
        large: '20px',
        xlarge: '24px'
    };
    var _currentFontSize = 'normal';
    var _reducedMotion = false;
    var _highContrast = false;
    var _announceRegion = null;
    var _announceTimer = null;
    
    // ============================================
    // PREFERENCE STORAGE
    // ============================================
    
    function loadPreferences() {
        try {
            var stored = localStorage.getItem(config.storageKey);
            if (stored) {
                var prefs = JSON.parse(stored);
                _currentFontSize = prefs.fontSize || 'normal';
                _reducedMotion = prefs.reducedMotion || false;
                _highContrast = prefs.highContrast || false;
            }
        } catch(e) {
            // Invalid data
        }
        
        // Check system preference for reduced motion
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            _reducedMotion = true;
        }
        
        // Check system preference for contrast
        if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
            _highContrast = true;
        }
    }
    
    function savePreferences() {
        try {
            localStorage.setItem(config.storageKey, JSON.stringify({
                fontSize: _currentFontSize,
                reducedMotion: _reducedMotion,
                highContrast: _highContrast
            }));
        } catch(e) {
            // Storage full
        }
    }
    
    // ============================================
    // FONT SIZE
    // ============================================
    
    function applyFontSize(size) {
        var value = _fontSizeValues[size] || _fontSizeValues['normal'];
        document.documentElement.style.setProperty('--font-size-base', value);
        document.documentElement.setAttribute('data-font-size', size);
        _currentFontSize = size;
        savePreferences();
    }
    
    function increaseFontSize() {
        var idx = _fontSizes.indexOf(_currentFontSize);
        if (idx < _fontSizes.length - 1) {
            applyFontSize(_fontSizes[idx + 1]);
            announce('Font size: ' + _currentFontSize);
        }
    }
    
    function decreaseFontSize() {
        var idx = _fontSizes.indexOf(_currentFontSize);
        if (idx > 0) {
            applyFontSize(_fontSizes[idx - 1]);
            announce('Font size: ' + _currentFontSize);
        }
    }
    
    function resetFontSize() {
        applyFontSize('normal');
        announce('Font size reset');
    }
    
    function getFontSize() {
        return _currentFontSize;
    }
    
    function getFontSizeValue() {
        return _fontSizeValues[_currentFontSize] || '16px';
    }
    
    // ============================================
    // REDUCED MOTION
    // ============================================
    
    function applyReducedMotion(enabled) {
        _reducedMotion = !!enabled;
        
        if (_reducedMotion) {
            document.documentElement.classList.add('reduced-motion');
            document.documentElement.setAttribute('data-reduced-motion', 'true');
        } else {
            document.documentElement.classList.remove('reduced-motion');
            document.documentElement.removeAttribute('data-reduced-motion');
        }
        
        savePreferences();
    }
    
    function toggleReducedMotion() {
        applyReducedMotion(!_reducedMotion);
        announce(_reducedMotion ? 'Reduced motion enabled' : 'Reduced motion disabled');
    }
    
    function isReducedMotion() {
        return _reducedMotion;
    }
    
    // ============================================
    // HIGH CONTRAST
    // ============================================
    
    function applyHighContrast(enabled) {
        _highContrast = !!enabled;
        
        if (_highContrast) {
            document.documentElement.classList.add('high-contrast');
            document.documentElement.setAttribute('data-high-contrast', 'true');
        } else {
            document.documentElement.classList.remove('high-contrast');
            document.documentElement.removeAttribute('data-high-contrast');
        }
        
        savePreferences();
    }
    
    function toggleHighContrast() {
        applyHighContrast(!_highContrast);
        announce(_highContrast ? 'High contrast enabled' : 'High contrast disabled');
    }
    
    function isHighContrast() {
        return _highContrast;
    }
    
    // ============================================
    // FOCUS VISIBLE
    // ============================================
    
    function enableFocusVisible() {
        // Tambahkan class untuk keyboard users
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-user');
            }
        });
        
        // Hapus class untuk mouse users
        document.addEventListener('mousedown', function() {
            document.body.classList.remove('keyboard-user');
        });
    }
    
    // ============================================
    // SCREEN READER ANNOUNCEMENTS
    // ============================================
    
    function createAnnounceRegion() {
        if (_announceRegion) return;
        
        _announceRegion = document.createElement('div');
        _announceRegion.id = 'sr-announcements';
        _announceRegion.setAttribute('aria-live', 'polite');
        _announceRegion.setAttribute('aria-atomic', 'true');
        _announceRegion.className = 'sr-only';
        _announceRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
        document.body.appendChild(_announceRegion);
    }
    
    function announce(message) {
        if (!_announceRegion) createAnnounceRegion();
        if (!_announceRegion) return;
        
        // Clear previous
        if (_announceTimer) clearTimeout(_announceTimer);
        
        // Set new message (use textContent for safety)
        _announceRegion.textContent = '';
        
        // Small delay untuk memastikan screen reader membaca
        setTimeout(function() {
            if (_announceRegion) {
                _announceRegion.textContent = message || '';
            }
        }, 100);
        
        // Clear after some time
        _announceTimer = setTimeout(function() {
            if (_announceRegion) {
                _announceRegion.textContent = '';
            }
        }, 5000);
    }
    
    function announcePageReady() {
        if (config.announcePageChanges) {
            setTimeout(function() {
                var title = document.title || 'Halaman';
                announce(title + ' telah dimuat');
            }, 800);
        }
    }
    
    // ============================================
    // KEYBOARD HELPERS
    // ============================================
    
    /**
     * Trap focus dalam container (untuk modal)
     */
    function trapFocus(container) {
        if (!container) return function() {};
        
        var focusable = container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"])'
        );
        
        if (focusable.length === 0) return function() {};
        
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        
        // Focus first element
        if (first.focus) first.focus();
        
        var handler = function(e) {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    if (last.focus) last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    if (first.focus) first.focus();
                }
            }
        };
        
        container.addEventListener('keydown', handler);
        
        // Return cleanup function
        return function() {
            container.removeEventListener('keydown', handler);
        };
    }
    
    /**
     * Get all focusable elements dalam container
     */
    function getFocusableElements(container) {
        if (!container) container = document;
        
        return container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"])'
        );
    }
    
    // ============================================
    // RESET ALL
    // ============================================
    
    function resetAll() {
        applyFontSize('normal');
        applyReducedMotion(false);
        applyHighContrast(false);
        announce('All accessibility settings reset');
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
        
        // Load preferences
        loadPreferences();
        
        // Apply settings
        applyFontSize(_currentFontSize);
        applyReducedMotion(_reducedMotion);
        applyHighContrast(_highContrast);
        
        // Setup
        if (config.enableFocusVisible) {
            enableFocusVisible();
        }
        
        if (config.enableScreenReader) {
            createAnnounceRegion();
        }
        
        // Announce page
        announcePageReady();
        
        // Listen for system preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function(e) {
                if (!localStorage.getItem(config.storageKey)) {
                    applyReducedMotion(e.matches);
                }
            });
            
            window.matchMedia('(prefers-contrast: high)').addEventListener('change', function(e) {
                if (!localStorage.getItem(config.storageKey)) {
                    applyHighContrast(e.matches);
                }
            });
        }
        
        console.info('[Accessibility] Initialized (font: ' + _currentFontSize + 
            ', motion: ' + _reducedMotion + ', contrast: ' + _highContrast + ')');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Initialization
        init: init,
        
        // Font size
        increaseFontSize: increaseFontSize,
        decreaseFontSize: decreaseFontSize,
        resetFontSize: resetFontSize,
        getFontSize: getFontSize,
        getFontSizeValue: getFontSizeValue,
        applyFontSize: applyFontSize,
        
        // Reduced motion
        toggleReducedMotion: toggleReducedMotion,
        isReducedMotion: isReducedMotion,
        applyReducedMotion: applyReducedMotion,
        
        // High contrast
        toggleHighContrast: toggleHighContrast,
        isHighContrast: isHighContrast,
        applyHighContrast: applyHighContrast,
        
        // Announcements
        announce: announce,
        
        // Focus
        trapFocus: trapFocus,
        getFocusableElements: getFocusableElements,
        
        // Reset
        resetAll: resetAll,
        
        // Config
        getConfig: function() {
            return {
                fontSize: _currentFontSize,
                reducedMotion: _reducedMotion,
                highContrast: _highContrast
            };
        }
    };
})();

// ============================================
// AUTO-INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    Accessibility.init();
});

// ============================================
// USAGE:
// ============================================
// Accessibility.increaseFontSize();
// Accessibility.toggleHighContrast();
// Accessibility.announce('Pesan untuk screen reader');
// 
// // Trap focus in modal
// var untrap = Accessibility.trapFocus(modalElement);
// // ... when modal closes:
// untrap();
// ============================================