// js/hot-reload.js - Hot Reload Development Tool 2026 (DISABLED BY DEFAULT)
/**
 * E-Arsip Digital - Hot Reload (DEVELOPMENT ONLY)
 * Version: 2026.1.0
 * 
 * ⚠️  HANYA UNTUK DEVELOPMENT!
 * ⚠️  JANGAN deploy ke production!
 * ⚠️  Matikan dengan config.enabled = false
 * 
 * Fitur:
 * - WebSocket connection ke dev server
 * - CSS hot reload (tanpa full refresh)
 * - State preservation (scroll, form data)
 * - Auto-reconnect
 */

var HotReload = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: false,              // DISABLED by default!
        wsUrl: 'ws://localhost:35729',
        reloadCSS: true,
        reloadJS: true,
        reloadHTML: false,
        preserveState: true,
        maxReconnectAttempts: 10,
        reconnectDelay: 2000
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _ws = null;
    var _reconnectAttempts = 0;
    var _reconnectTimer = null;
    var _preservedState = {};
    
    // ============================================
    // WEBSOCKET CONNECTION
    // ============================================
    
    function connect() {
        if (!config.enabled) return;
        
        // Close existing connection
        if (_ws) {
            try { _ws.close(); } catch(e) {}
            _ws = null;
        }
        
        try {
            _ws = new WebSocket(config.wsUrl);
            
            _ws.onopen = function() {
                console.info('[HotReload] Connected');
                _reconnectAttempts = 0;
                
                // Send hello
                try {
                    _ws.send(JSON.stringify({
                        type: 'hello',
                        url: window.location.pathname
                    }));
                } catch(e) {}
            };
            
            _ws.onmessage = function(event) {
                try {
                    var message = JSON.parse(event.data);
                    handleMessage(message);
                } catch(e) {
                    console.warn('[HotReload] Invalid message');
                }
            };
            
            _ws.onclose = function() {
                console.warn('[HotReload] Disconnected');
                scheduleReconnect();
            };
            
            _ws.onerror = function() {
                // Error handling di onclose
            };
        } catch(e) {
            console.warn('[HotReload] Connection failed');
            scheduleReconnect();
        }
    }
    
    function scheduleReconnect() {
        if (_reconnectAttempts >= config.maxReconnectAttempts) {
            console.warn('[HotReload] Max reconnect attempts reached');
            return;
        }
        
        _reconnectAttempts++;
        
        // Exponential backoff: 2s, 3s, 4.5s, 6.75s, ...
        var delay = config.reconnectDelay * Math.pow(1.5, _reconnectAttempts - 1);
        
        if (_reconnectTimer) clearTimeout(_reconnectTimer);
        
        _reconnectTimer = setTimeout(function() {
            console.info('[HotReload] Reconnecting (attempt ' + _reconnectAttempts + '/' + config.maxReconnectAttempts + ')');
            connect();
        }, delay);
    }
    
    // ============================================
    // MESSAGE HANDLING
    // ============================================
    
    function handleMessage(message) {
        switch (message.type) {
            case 'reload':
                fullReload();
                break;
                
            case 'reloadCSS':
                reloadCSSFiles(message.files);
                break;
                
            case 'reloadJS':
                // Full reload untuk JS changes
                if (config.reloadJS) fullReload();
                break;
                
            case 'reloadHTML':
                if (config.reloadHTML) fullReload();
                break;
                
            case 'fileChanged':
                handleFileChange(message);
                break;
                
            case 'ping':
                try {
                    if (_ws && _ws.readyState === WebSocket.OPEN) {
                        _ws.send(JSON.stringify({ type: 'pong' }));
                    }
                } catch(e) {}
                break;
        }
    }
    
    function handleFileChange(message) {
        var file = message.file || '';
        var ext = '';
        
        // Get extension
        var dotIndex = file.lastIndexOf('.');
        if (dotIndex !== -1) {
            ext = file.substring(dotIndex + 1).toLowerCase();
        }
        
        if (ext === 'css' && config.reloadCSS) {
            reloadCSSFile(file);
        } else if (ext === 'js' && config.reloadJS) {
            fullReload();
        } else if (ext === 'html' && config.reloadHTML) {
            fullReload();
        }
    }
    
    // ============================================
    // RELOAD STRATEGIES
    // ============================================
    
    function fullReload() {
        saveState();
        console.info('[HotReload] Full reload');
        window.location.reload();
    }
    
    function reloadCSSFiles(files) {
        if (!files || files.length === 0) {
            reloadAllCSS();
            return;
        }
        
        for (var i = 0; i < files.length; i++) {
            reloadCSSFile(files[i]);
        }
    }
    
    function reloadCSSFile(file) {
        var links = document.getElementsByTagName('link');
        
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href');
            
            if (href && link.getAttribute('rel') === 'stylesheet') {
                if (file === '*' || href.indexOf(file) !== -1) {
                    // Cache bust
                    var separator = href.indexOf('?') !== -1 ? '&' : '?';
                    var newHref = href.replace(/(\?|&)v=\d+/, '') + separator + 'v=' + Date.now();
                    link.setAttribute('href', newHref);
                    
                    console.debug('[HotReload] CSS reloaded: ' + file);
                }
            }
        }
        
        // Reload inline styles
        if (file === '*') {
            var styles = document.getElementsByTagName('style');
            for (var j = 0; j < styles.length; j++) {
                var text = styles[j].textContent;
                styles[j].textContent = '';
                // Force reflow
                styles[j].offsetHeight;
                styles[j].textContent = text;
            }
        }
    }
    
    function reloadAllCSS() {
        reloadCSSFile('*');
    }
    
    // ============================================
    // STATE PRESERVATION
    // ============================================
    
    function saveState() {
        if (!config.preserveState) return;
        
        // Scroll position
        _preservedState.scrollX = window.scrollX || window.pageXOffset;
        _preservedState.scrollY = window.scrollY || window.pageYOffset;
        
        // Save to sessionStorage
        try {
            sessionStorage.setItem('hotreload_state', JSON.stringify(_preservedState));
        } catch(e) {}
        
        // Save form data
        var forms = document.getElementsByTagName('form');
        for (var i = 0; i < forms.length; i++) {
            var form = forms[i];
            var formData = {};
            var inputs = form.querySelectorAll('input, select, textarea');
            
            for (var j = 0; j < inputs.length; j++) {
                var input = inputs[j];
                if (input.name) {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        formData[input.name] = input.checked;
                    } else {
                        formData[input.name] = input.value;
                    }
                }
            }
            
            var formKey = 'form_' + (form.id || form.name || i);
            _preservedState[formKey] = formData;
        }
    }
    
    function restoreState() {
        if (!config.preserveState) return;
        
        // Load from sessionStorage
        try {
            var stored = sessionStorage.getItem('hotreload_state');
            if (stored) {
                var parsed = JSON.parse(stored);
                for (var key in parsed) {
                    if (parsed.hasOwnProperty(key)) {
                        _preservedState[key] = parsed[key];
                    }
                }
            }
        } catch(e) {}
        
        // Restore scroll
        if (_preservedState.scrollX !== undefined && _preservedState.scrollY !== undefined) {
            setTimeout(function() {
                window.scrollTo(_preservedState.scrollX, _preservedState.scrollY);
            }, 200);
        }
        
        // Restore form data
        var forms = document.getElementsByTagName('form');
        for (var i = 0; i < forms.length; i++) {
            var form = forms[i];
            var formKey = 'form_' + (form.id || form.name || i);
            var formData = _preservedState[formKey];
            
            if (formData) {
                var inputs = form.querySelectorAll('input, select, textarea');
                for (var j = 0; j < inputs.length; j++) {
                    var input = inputs[j];
                    if (input.name && formData[input.name] !== undefined) {
                        if (input.type === 'checkbox' || input.type === 'radio') {
                            input.checked = formData[input.name];
                        } else {
                            input.value = formData[input.name];
                        }
                    }
                }
            }
        }
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function init(customConfig) {
        if (customConfig) {
            for (var key in customConfig) {
                if (customConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = customConfig[key];
                }
            }
        }
        
        if (!config.enabled) {
            console.info('[HotReload] Disabled');
            return;
        }
        
        // Setup state preservation
        if (config.preserveState) {
            window.addEventListener('beforeunload', saveState);
            window.addEventListener('load', restoreState);
        }
        
        // Connect
        connect();
        
        console.info('[HotReload] Initialized');
    }
    
    // Auto-init hanya jika URL mengandung ?hotreload=1
    if (window.location.search.indexOf('hotreload=1') !== -1) {
        config.enabled = true;
        setTimeout(function() { init(); }, 500);
    }
    
    return {
        init: init,
        
        /**
         * Check if connected
         */
        isConnected: function() {
            return _ws && _ws.readyState === WebSocket.OPEN;
        },
        
        /**
         * Get status
         */
        getStatus: function() {
            return {
                enabled: config.enabled,
                connected: _ws ? _ws.readyState === WebSocket.OPEN : false,
                reconnectAttempts: _reconnectAttempts
            };
        },
        
        /**
         * Manual reload
         */
        reload: function() {
            fullReload();
        },
        
        /**
         * Enable
         */
        enable: function() {
            config.enabled = true;
            connect();
        },
        
        /**
         * Disable
         */
        disable: function() {
            config.enabled = false;
            if (_ws) {
                try { _ws.close(); } catch(e) {}
                _ws = null;
            }
            if (_reconnectTimer) {
                clearTimeout(_reconnectTimer);
                _reconnectTimer = null;
            }
        }
    };
})();

// ============================================
// USAGE (Development only):
// ============================================
// // Enable via URL: ?hotreload=1
// // Or programmatically:
// HotReload.init({ enabled: true, wsUrl: 'ws://localhost:35729' });
// 
// // Check status
// HotReload.getStatus();
// 
// // Manual reload
// HotReload.reload();
// ============================================