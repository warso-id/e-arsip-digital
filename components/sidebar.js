// components/sidebar.js - Advanced Sidebar Component 2026 (SECURE)
/**
 * E-Arsip Digital - Sidebar Component
 * Version: 2026.1.0
 * Features: Collapsible, responsive, mobile-friendly, role-based menu,
 *           XSS safe, PWA mobile gestures, no dependencies
 * 
 * Usage:
 *   var sidebar = Sidebar.init({ container: '#sidebar' });
 *   sidebar.toggle();
 *   sidebar.buildMenu([...]);
 */

var Sidebar = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _instances = {};
    var _instanceId = 0;
    
    // ============================================
    // ROLE CHECK (Standalone - no authService dependency)
    // ============================================
    function checkRole(roles) {
        if (!roles || !roles.length) return true;
        
        try {
            var sessionStr = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
            if (sessionStr) {
                var session = JSON.parse(sessionStr);
                if (session.user && session.user.role) {
                    if (session.expiresAt && Date.now() >= session.expiresAt) return false;
                    var roleList = Array.isArray(roles) ? roles : [roles];
                    return roleList.indexOf(session.user.role) !== -1;
                }
            }
        } catch(e) {
            // Invalid session
        }
        
        return false;
    }
    
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
    
    function sanitizeURL(url) {
        if (!url) return '#';
        // Hanya izinkan path relatif
        if (/^\.\.?\//.test(url)) return url;
        if (/^\//.test(url)) return url;
        if (/^[a-zA-Z0-9_\-\.\/]+\.(html|php)$/.test(url)) return url;
        return '#';
    }
    
    // ============================================
    // DEBOUNCE
    // ============================================
    function debounce(fn, ms) {
        var timer;
        return function() {
            clearTimeout(timer);
            timer = setTimeout(fn, ms);
        };
    }
    
    // ============================================
    // SIDEBAR CLASS
    // ============================================
    function SidebarInstance(options) {
        var self = this;
        var id = ++_instanceId;
        _instances[id] = this;
        
        // Default config
        this.config = {
            container: '#sidebar',
            toggleButton: '#sidebar-toggle',
            mobileBreakpoint: 768,
            collapsed: false,
            saveState: true,
            animate: true,
            animationDuration: 300,
            overlayZIndex: 998,
            sidebarZIndex: 100
        };
        
        // Merge options
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    this.config[key] = options[key];
                }
            }
        }
        
        // State
        this.state = {
            collapsed: this.config.collapsed,
            mobileOpen: false,
            activeItem: null,
            isMobile: false
        };
        
        // DOM refs
        this.container = null;
        this.toggleButton = null;
        this.overlay = null;
        this.mainContent = null;
        
        // Touch state
        this._touchStartX = 0;
        this._touchStartY = 0;
        
        // Event cleanup
        this._cleanupFns = [];
        
        // Initialize
        this._init();
        
        // Public API
        return {
            toggle: function() { self.toggle(); },
            openMobile: function() { self.openMobile(); },
            closeMobile: function() { self.closeMobile(); },
            collapse: function() { self.collapse(); },
            expand: function() { self.expand(); },
            buildMenu: function(menu) { self.buildMenu(menu); },
            setActiveItem: function(item) { self.setActiveItem(item); },
            isCollapsed: function() { return self.state.collapsed; },
            isMobileOpen: function() { return self.state.mobileOpen; },
            destroy: function() { self.destroy(); },
            on: function(event, cb) { self._on(event, cb); }
        };
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    SidebarInstance.prototype._init = function() {
        this.container = document.querySelector(this.config.container);
        this.toggleButton = document.querySelector(this.config.toggleButton);
        this.mainContent = document.querySelector('.main-content');
        
        if (!this.container) {
            console.warn('Sidebar: Container not found:', this.config.container);
            return;
        }
        
        // Load saved state
        this._loadState();
        
        // Setup overlay
        this._setupOverlay();
        
        // Setup events
        this._setupEvents();
        
        // Setup responsive
        this._setupResponsive();
        
        // Highlight active item
        this._highlightActiveItem();
        
        // Update UI
        this._updateUI();
    };
    
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    SidebarInstance.prototype._loadState = function() {
        if (this.config.saveState) {
            try {
                var saved = localStorage.getItem('sidebar_collapsed');
                if (saved !== null) {
                    this.state.collapsed = saved === 'true';
                }
            } catch(e) {
                // Ignore
            }
        }
    };
    
    SidebarInstance.prototype._saveState = function() {
        if (this.config.saveState) {
            try {
                localStorage.setItem('sidebar_collapsed', this.state.collapsed.toString());
            } catch(e) {
                // Ignore
            }
        }
    };
    
    // ============================================
    // OVERLAY SETUP
    // ============================================
    SidebarInstance.prototype._setupOverlay = function() {
        // Remove existing overlay if any
        var existing = document.querySelector('.sidebar-overlay[data-sidebar-id]');
        if (existing) existing.remove();
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay';
        this.overlay.setAttribute('data-sidebar-id', this._instanceId || '');
        this.overlay.style.zIndex = this.config.overlayZIndex;
        this.overlay.setAttribute('aria-hidden', 'true');
        
        document.body.appendChild(this.overlay);
        
        // Click to close
        var self = this;
        var overlayClick = function() { self.closeMobile(); };
        this.overlay.addEventListener('click', overlayClick);
        this._cleanupFns.push(function() {
            self.overlay.removeEventListener('click', overlayClick);
        });
    };
    
    // ============================================
    // EVENT SETUP
    // ============================================
    SidebarInstance.prototype._setupEvents = function() {
        var self = this;
        
        // Toggle button
        if (this.toggleButton) {
            var toggleClick = function(e) {
                e.preventDefault();
                self.toggle();
            };
            this.toggleButton.addEventListener('click', toggleClick);
            this._cleanupFns.push(function() {
                self.toggleButton.removeEventListener('click', toggleClick);
            });
        }
        
        // Sidebar nav links - close mobile on click
        if (this.container) {
            var navClick = function(e) {
                var link = e.target.closest('.nav-item');
                if (link) {
                    self.setActiveItem(link);
                    if (self.state.isMobile) {
                        setTimeout(function() { self.closeMobile(); }, 150);
                    }
                }
                
                // Collapsible sections
                var header = e.target.closest('.nav-section-header');
                if (header) {
                    var section = header.parentElement;
                    section.classList.toggle('collapsed');
                }
            };
            this.container.addEventListener('click', navClick);
            this._cleanupFns.push(function() {
                self.container.removeEventListener('click', navClick);
            });
        }
        
        // Keyboard shortcut (Ctrl+Shift+B - less conflict)
        var keyHandler = function(e) {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                self.toggle();
            }
        };
        document.addEventListener('keydown', keyHandler);
        this._cleanupFns.push(function() {
            document.removeEventListener('keydown', keyHandler);
        });
        
        // Window resize (debounced)
        var resizeHandler = debounce(function() {
            self._setupResponsive();
        }, 150);
        window.addEventListener('resize', resizeHandler);
        this._cleanupFns.push(function() {
            window.removeEventListener('resize', resizeHandler);
        });
        
        // Touch/swipe gesture for mobile
        if (this.container) {
            var touchStart = function(e) {
                self._touchStartX = e.touches[0].clientX;
                self._touchStartY = e.touches[0].clientY;
            };
            document.addEventListener('touchstart', touchStart, { passive: true });
            this._cleanupFns.push(function() {
                document.removeEventListener('touchstart', touchStart);
            });
            
            var touchEnd = function(e) {
                var diffX = e.changedTouches[0].clientX - self._touchStartX;
                var diffY = e.changedTouches[0].clientY - self._touchStartY;
                
                // Only horizontal swipe
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
                    if (diffX > 0 && self.state.isMobile && !self.state.mobileOpen) {
                        // Swipe right - open
                        self.openMobile();
                    } else if (diffX < 0 && self.state.mobileOpen) {
                        // Swipe left - close
                        self.closeMobile();
                    }
                }
            };
            document.addEventListener('touchend', touchEnd);
            this._cleanupFns.push(function() {
                document.removeEventListener('touchend', touchEnd);
            });
        }
    };
    
    // ============================================
    // RESPONSIVE
    // ============================================
    SidebarInstance.prototype._setupResponsive = function() {
        var isMobile = window.innerWidth <= this.config.mobileBreakpoint;
        
        if (isMobile !== this.state.isMobile) {
            this.state.isMobile = isMobile;
            
            if (isMobile) {
                this.container.classList.add('mobile');
                this.container.classList.add('closed');
                this.state.mobileOpen = false;
                this._hideOverlay();
            } else {
                this.container.classList.remove('mobile', 'closed');
                this.state.mobileOpen = false;
                this._hideOverlay();
            }
            
            this._updateUI();
        }
    };
    
    // ============================================
    // TOGGLE / OPEN / CLOSE
    // ============================================
    SidebarInstance.prototype.toggle = function() {
        if (this.state.isMobile) {
            if (this.state.mobileOpen) {
                this.closeMobile();
            } else {
                this.openMobile();
            }
        } else {
            this.state.collapsed = !this.state.collapsed;
            this._updateUI();
            this._saveState();
        }
        
        this._dispatchEvent('toggle', {
            collapsed: this.state.collapsed,
            mobileOpen: this.state.mobileOpen
        });
    };
    
    SidebarInstance.prototype.openMobile = function() {
        if (!this.state.isMobile) return;
        
        this.state.mobileOpen = true;
        this.container.classList.remove('closed');
        this.container.classList.add('open');
        this._showOverlay();
        document.body.style.overflow = 'hidden';
    };
    
    SidebarInstance.prototype.closeMobile = function() {
        if (!this.state.isMobile) return;
        
        this.state.mobileOpen = false;
        this.container.classList.add('closed');
        this.container.classList.remove('open');
        this._hideOverlay();
        document.body.style.overflow = '';
    };
    
    SidebarInstance.prototype.collapse = function() {
        if (this.state.isMobile) return;
        this.state.collapsed = true;
        this._updateUI();
        this._saveState();
    };
    
    SidebarInstance.prototype.expand = function() {
        if (this.state.isMobile) return;
        this.state.collapsed = false;
        this._updateUI();
        this._saveState();
    };
    
    // ============================================
    // UI UPDATES
    // ============================================
    SidebarInstance.prototype._updateUI = function() {
        if (!this.container) return;
        
        // Update container class
        if (this.state.collapsed) {
            this.container.classList.add('collapsed');
        } else {
            this.container.classList.remove('collapsed');
        }
        
        // Update toggle button icon
        if (this.toggleButton) {
            var icon = this.toggleButton.querySelector('i');
            if (icon) {
                icon.className = this.state.collapsed 
                    ? 'fas fa-chevron-right' 
                    : 'fas fa-chevron-left';
            }
        }
        
        // Update main content margin
        if (this.mainContent) {
            if (this.state.collapsed) {
                this.mainContent.classList.add('sidebar-collapsed');
            } else {
                this.mainContent.classList.remove('sidebar-collapsed');
            }
        }
    };
    
    SidebarInstance.prototype._showOverlay = function() {
        if (!this.overlay) return;
        this.overlay.classList.add('active');
        this.overlay.setAttribute('aria-hidden', 'false');
    };
    
    SidebarInstance.prototype._hideOverlay = function() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        this.overlay.setAttribute('aria-hidden', 'true');
    };
    
    // ============================================
    // ACTIVE ITEM
    // ============================================
    SidebarInstance.prototype.setActiveItem = function(item) {
        if (!this.container || !item) return;
        
        this.container.querySelectorAll('.nav-item').forEach(function(i) {
            i.classList.remove('active');
        });
        
        item.classList.add('active');
        this.state.activeItem = item;
    };
    
    SidebarInstance.prototype._highlightActiveItem = function() {
        if (!this.container) return;
        
        var currentPath = window.location.pathname;
        var bestMatch = null;
        var bestLength = 0;
        
        this.container.querySelectorAll('.nav-item').forEach(function(item) {
            var href = item.getAttribute('href');
            if (href && href !== '#') {
                // Exact match is best
                if (currentPath === href || currentPath.endsWith(href)) {
                    if (href.length > bestLength) {
                        bestMatch = item;
                        bestLength = href.length;
                    }
                }
            }
        });
        
        if (bestMatch) {
            this.setActiveItem(bestMatch);
        }
    };
    
    // ============================================
    // MENU BUILDER (SECURE)
    // ============================================
    SidebarInstance.prototype.buildMenu = function(menuConfig) {
        var nav = this.container ? this.container.querySelector('.sidebar-nav') : null;
        if (!nav || !menuConfig) return;
        
        // Clear
        nav.innerHTML = '';
        
        // Build
        var self = this;
        menuConfig.forEach(function(item) {
            var el;
            if (item.divider) {
                el = self._createDivider(item.label);
            } else if (item.children) {
                el = self._createSection(item);
            } else {
                el = self._createItem(item);
            }
            if (el) nav.appendChild(el);
        });
        
        this._highlightActiveItem();
    };
    
    SidebarInstance.prototype._createItem = function(config) {
        // Check role access
        if (config.roles && config.roles.length > 0) {
            if (!checkRole(config.roles)) return null;
        }
        
        var link = document.createElement('a');
        link.href = sanitizeURL(config.path || '#');
        link.className = 'nav-item';
        link.setAttribute('data-page', config.id || '');
        
        // Icon
        if (config.icon) {
            var icon = document.createElement('i');
            icon.className = 'fas fa-' + sanitizeText(config.icon);
            icon.setAttribute('aria-hidden', 'true');
            link.appendChild(icon);
        }
        
        // Label
        var label = document.createElement('span');
        label.textContent = config.label || ''; // SAFE: textContent
        link.appendChild(label);
        
        // Badge
        if (config.badge) {
            var badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = config.badge; // SAFE: textContent
            link.appendChild(badge);
        }
        
        // External link
        if (config.external) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }
        
        return link;
    };
    
    SidebarInstance.prototype._createSection = function(config) {
        var section = document.createElement('div');
        section.className = 'nav-section';
        
        // Header
        var header = document.createElement('div');
        header.className = 'nav-section-header';
        header.setAttribute('tabindex', '0');
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', 'true');
        
        // Icon
        if (config.icon) {
            var icon = document.createElement('i');
            icon.className = 'fas fa-' + sanitizeText(config.icon);
            icon.setAttribute('aria-hidden', 'true');
            header.appendChild(icon);
        }
        
        // Label
        var label = document.createElement('span');
        label.textContent = config.label || ''; // SAFE: textContent
        header.appendChild(label);
        
        // Arrow
        var arrow = document.createElement('i');
        arrow.className = 'fas fa-chevron-down section-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        header.appendChild(arrow);
        
        // Body
        var body = document.createElement('div');
        body.className = 'nav-section-body';
        
        if (config.children) {
            var self = this;
            config.children.forEach(function(child) {
                var item = self._createItem(child);
                if (item) body.appendChild(item);
            });
        }
        
        section.appendChild(header);
        section.appendChild(body);
        
        return section;
    };
    
    SidebarInstance.prototype._createDivider = function(label) {
        var divider = document.createElement('div');
        divider.className = 'nav-divider';
        divider.setAttribute('role', 'separator');
        if (label) {
            divider.textContent = label; // SAFE: textContent
        }
        return divider;
    };
    
    // ============================================
    // CUSTOM EVENTS
    // ============================================
    SidebarInstance.prototype._dispatchEvent = function(name, detail) {
        var event = new CustomEvent('sidebar:' + name, {
            detail: detail,
            bubbles: true
        });
        window.dispatchEvent(event);
    };
    
    SidebarInstance.prototype._on = function(event, callback) {
        var handler = function(e) {
            callback(e.detail);
        };
        window.addEventListener('sidebar:' + event, handler);
        
        // Return cleanup function
        return function() {
            window.removeEventListener('sidebar:' + event, handler);
        };
    };
    
    // ============================================
    // DESTROY
    // ============================================
    SidebarInstance.prototype.destroy = function() {
        // Run cleanup functions
        this._cleanupFns.forEach(function(fn) {
            if (typeof fn === 'function') fn();
        });
        this._cleanupFns = [];
        
        // Remove overlay
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        // Reset body
        document.body.style.overflow = '';
        
        // Reset main content
        if (this.mainContent) {
            this.mainContent.classList.remove('sidebar-collapsed');
        }
        
        // Reset container
        if (this.container) {
            this.container.classList.remove('collapsed', 'mobile', 'closed', 'open');
        }
        
        this.container = null;
        this.toggleButton = null;
        this.overlay = null;
    };
    
    // ============================================
    // STATIC API
    // ============================================
    return {
        /**
         * Initialize sidebar
         * @param {Object} options
         * @returns {Object} Sidebar instance API
         */
        init: function(options) {
            return new SidebarInstance(options);
        },
        
        /**
         * Check if user has role (standalone)
         * @param {string|string[]} roles
         * @returns {boolean}
         */
        checkRole: checkRole
    };
})();