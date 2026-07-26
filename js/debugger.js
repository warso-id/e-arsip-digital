// js/debugger.js - Debug Mode 2026 (SAFE & LIGHTWEIGHT)
/**
 * E-Arsip Digital - Debugger
 * Version: 2026.1.0
 * 
 * HANYA UNTUK DEVELOPMENT!
 * Fitur:
 * - Log viewer panel
 * - Network request counter
 * - Keyboard shortcut (Ctrl+Shift+D)
 * - NO console override (aman)
 * - NO storage exposure (privacy)
 */

var Debugger = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: false,              // DISABLED by default
        maxLogs: 200,
        maxNetworkLogs: 100
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _panel = null;
    var _isOpen = false;
    var _logs = [];
    var _networkCount = 0;
    var _networkLogs = [];
    
    // ============================================
    // SANITIZATION
    // ============================================
    
    function sanitizeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    function truncate(str, max) {
        if (!str) return '';
        if (str.length <= max) return sanitizeHTML(str);
        return sanitizeHTML(str.substring(0, max)) + '...';
    }
    
    // ============================================
    // PANEL CREATION
    // ============================================
    
    function createPanel() {
        if (_panel) return;
        
        _panel = document.createElement('div');
        _panel.id = 'debug-panel';
        _panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:250px;background:#1e293b;color:#f1f5f9;z-index:9999;font-family:monospace;font-size:12px;display:none;flex-direction:column;border-top:3px solid #3b82f6;';
        
        _panel.innerHTML = 
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:#0f172a;">' +
                '<span style="font-weight:600;">Debug Panel</span>' +
                '<div style="display:flex;gap:4px;">' +
                    '<button data-tab="logs" class="dbg-tab active" style="background:rgba(59,130,246,0.2);color:#60a5fa;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:11px;">Logs</button>' +
                    '<button data-tab="network" class="dbg-tab" style="background:none;border:none;color:#94a3b8;padding:4px 8px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:11px;">Network</button>' +
                    '<button id="dbg-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0 6px;margin-left:8px;">&times;</button>' +
                '</div>' +
            '</div>' +
            '<div style="flex:1;overflow-y:auto;padding:8px;" id="dbg-log-container"></div>' +
            '<div style="display:flex;gap:6px;padding:6px 10px;background:#334155;align-items:center;">' +
                '<input id="dbg-filter" placeholder="Filter..." style="flex:1;background:#1e293b;border:1px solid #475569;color:#f1f5f9;padding:4px 8px;border-radius:3px;font-size:11px;font-family:inherit;">' +
                '<button id="dbg-clear" style="background:#475569;border:none;color:#f1f5f9;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px;font-family:inherit;">Clear</button>' +
            '</div>';
        
        document.body.appendChild(_panel);
        
        // Events
        _panel.querySelector('#dbg-close').addEventListener('click', togglePanel);
        _panel.querySelector('#dbg-clear').addEventListener('click', clearLogs);
        _panel.querySelector('#dbg-filter').addEventListener('input', function() {
            renderLogs(this.value);
        });
        
        // Tab buttons
        var tabs = _panel.querySelectorAll('.dbg-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function() {
                // Update active tab
                for (var j = 0; j < tabs.length; j++) {
                    tabs[j].classList.remove('active');
                    tabs[j].style.background = 'none';
                    tabs[j].style.color = '#94a3b8';
                }
                this.classList.add('active');
                this.style.background = 'rgba(59,130,246,0.2)';
                this.style.color = '#60a5fa';
                
                renderContent(this.dataset.tab);
            });
        }
    }
    
    // ============================================
    // RENDERING
    // ============================================
    
    function renderContent(tab) {
        if (tab === 'network') {
            renderNetwork();
        } else {
            renderLogs();
        }
    }
    
    function renderLogs(filter) {
        var container = _panel ? _panel.querySelector('#dbg-log-container') : null;
        if (!container) return;
        
        var logs = _logs.slice().reverse();
        
        if (filter) {
            var f = filter.toLowerCase();
            logs = logs.filter(function(l) {
                return l.message.toLowerCase().indexOf(f) !== -1;
            });
        }
        
        if (logs.length === 0) {
            container.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">No logs</div>';
            return;
        }
        
        var html = '';
        for (var i = 0; i < Math.min(logs.length, 50); i++) {
            var l = logs[i];
            var color = l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : l.level === 'info' ? '#60a5fa' : '#94a3b8';
            html += '<div style="padding:3px 0;border-bottom:1px solid #1e293b;display:flex;gap:8px;">' +
                '<span style="color:#64748b;min-width:75px;font-size:10px;">' + sanitizeHTML(l.time) + '</span>' +
                '<span style="color:' + color + ';">' + truncate(l.message, 200) + '</span>' +
            '</div>';
        }
        
        container.innerHTML = html;
    }
    
    function renderNetwork() {
        var container = _panel ? _panel.querySelector('#dbg-log-container') : null;
        if (!container) return;
        
        if (_networkLogs.length === 0) {
            container.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">No network logs</div>';
            return;
        }
        
        var html = '<div style="margin-bottom:8px;color:#94a3b8;">Total requests: ' + _networkCount + '</div>';
        
        var logs = _networkLogs.slice().reverse().slice(0, 30);
        for (var i = 0; i < logs.length; i++) {
            var r = logs[i];
            var methodColor = r.method === 'GET' ? '#16a34a' : r.method === 'POST' ? '#2563eb' : r.method === 'DELETE' ? '#dc2626' : '#d97706';
            var statusColor = r.status < 400 ? '#16a34a' : '#dc2626';
            
            html += '<div style="padding:3px 0;border-bottom:1px solid #1e293b;display:flex;gap:6px;align-items:center;font-size:11px;">' +
                '<span style="color:' + methodColor + ';font-weight:600;min-width:40px;">' + sanitizeHTML(r.method) + '</span>' +
                '<span style="color:' + statusColor + ';min-width:30px;">' + (r.status || 'ERR') + '</span>' +
                '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + sanitizeHTML(r.url) + '">' + truncate(r.url, 60) + '</span>' +
                '<span style="color:#94a3b8;min-width:45px;text-align:right;">' + r.duration + 'ms</span>' +
            '</div>';
        }
        
        container.innerHTML = html;
    }
    
    // ============================================
    // LOGGING (Non-invasive)
    // ============================================
    
    function addLog(level, message) {
        var entry = {
            level: level,
            message: String(message).substring(0, 500),
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now()
        };
        
        _logs.push(entry);
        
        if (_logs.length > config.maxLogs) {
            _logs = _logs.slice(-config.maxLogs);
        }
        
        if (_isOpen) {
            renderLogs();
        }
    }
    
    function addNetworkEntry(method, url, status, duration) {
        _networkCount++;
        
        _networkLogs.push({
            method: method,
            url: url,
            status: status,
            duration: duration,
            timestamp: Date.now()
        });
        
        if (_networkLogs.length > config.maxNetworkLogs) {
            _networkLogs = _networkLogs.slice(-config.maxNetworkLogs);
        }
    }
    
    // ============================================
    // PANEL CONTROL
    // ============================================
    
    function togglePanel() {
        _isOpen = !_isOpen;
        
        if (!_panel) createPanel();
        
        if (_isOpen) {
            _panel.style.display = 'flex';
            renderLogs();
        } else {
            _panel.style.display = 'none';
        }
    }
    
    function clearLogs() {
        _logs = [];
        _networkLogs = [];
        _networkCount = 0;
        
        if (_isOpen) {
            renderLogs();
        }
    }
    
    // ============================================
    // KEYBOARD SHORTCUT
    // ============================================
    
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+D
            if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                togglePanel();
            }
        });
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function init(options) {
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = options[key];
                }
            }
        }
        
        if (!config.enabled) return;
        
        createPanel();
        setupKeyboardShortcut();
        
        console.info('[Debugger] Initialized (Ctrl+Shift+D to toggle)');
    }
    
    // Auto-init jika URL mengandung ?debug=1
    if (window.location.search.indexOf('debug=1') !== -1 || 
        window.location.search.indexOf('debug=true') !== -1) {
        config.enabled = true;
        setTimeout(function() { init(); }, 100);
    }
    
    return {
        init: init,
        toggle: togglePanel,
        clear: clearLogs,
        
        /**
         * Log message ke debug panel
         */
        log: function(level, message) {
            if (!config.enabled) return;
            addLog(level || 'debug', message);
        },
        
        /**
         * Log network request
         */
        logNetwork: function(method, url, status, duration) {
            if (!config.enabled) return;
            addNetworkEntry(method, url, status, duration);
        },
        
        /**
         * Check if panel is open
         */
        isOpen: function() {
            return _isOpen;
        },
        
        enable: function() {
            config.enabled = true;
            if (!_panel) createPanel();
        },
        disable: function() {
            config.enabled = false;
            if (_panel) _panel.style.display = 'none';
        }
    };
})();

// ============================================
// USAGE (Development only):
// ============================================
// Debugger.init({ enabled: true });
// Debugger.log('info', 'User logged in');
// Debugger.logNetwork('GET', '/api/users', 200, 45);
// ============================================