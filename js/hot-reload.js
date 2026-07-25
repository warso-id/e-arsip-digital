// js/hot-reload.js - Hot Reload Development Tool 2026
/**
 * E-Arsip Digital - Hot Reload
 * Version: 2026.1.0
 * Features: Live CSS reload, JS module replacement, 
 *           state preservation, WebSocket connection
 */

import { Logger } from './logger.js';
import APP_CONFIG from '../config/config.js';

class HotReload {
    constructor() {
        this.logger = new Logger('HotReload');
        
        this.config = {
            enabled: APP_CONFIG.app?.environment === 'development',
            wsUrl: 'ws://localhost:35729',
            reloadCSS: true,
            reloadJS: true,
            reloadHTML: false,
            preserveState: true,
            ...APP_CONFIG.hotReload || {}
        };
        
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 2000;
        
        this.stateToPreserve = {};
        
        if (this.config.enabled) {
            this.init();
        }
    }
    
    init() {
        this.connect();
        this.setupStatePreservation();
        
        this.logger.info('Hot reload initialized');
        
        // Expose API globally
        window.__hotReload = {
            preserveState: (key, value) => this.preserveState(key, value),
            getState: (key) => this.getState(key),
            reload: () => this.triggerReload()
        };
    }
    
    // ============================================
    // WEBSOCKET CONNECTION
    // ============================================
    
    connect() {
        if (this.ws) {
            this.ws.close();
        }
        
        try {
            this.ws = new WebSocket(this.config.wsUrl);
            
            this.ws.onopen = () => {
                this.logger.info('Hot reload connected');
                this.reconnectAttempts = 0;
                
                // Send client info
                this.ws.send(JSON.stringify({
                    type: 'hello',
                    url: window.location.href,
                    title: document.title
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    this.logger.warn('Failed to parse message', error);
                }
            };
            
            this.ws.onclose = () => {
                this.logger.warn('Hot reload disconnected');
                this.scheduleReconnect();
            };
            
            this.ws.onerror = () => {
                this.logger.warn('Hot reload connection error');
            };
        } catch (error) {
            this.logger.warn('Failed to connect hot reload', error);
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.warn('Max reconnect attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        setTimeout(() => {
            this.logger.info('Reconnecting...', { attempt: this.reconnectAttempts });
            this.connect();
        }, delay);
    }
    
    // ============================================
    // MESSAGE HANDLING
    // ============================================
    
    handleMessage(message) {
        switch (message.type) {
            case 'reload':
                this.fullReload();
                break;
                
            case 'reloadCSS':
                this.reloadCSSFiles(message.files);
                break;
                
            case 'reloadJS':
                this.reloadJSFiles(message.files);
                break;
                
            case 'reloadHTML':
                if (this.config.reloadHTML) {
                    this.fullReload();
                }
                break;
                
            case 'fileChanged':
                this.handleFileChange(message);
                break;
                
            case 'ping':
                this.ws.send(JSON.stringify({ type: 'pong' }));
                break;
                
            default:
                this.logger.debug('Unknown message type', { type: message.type });
        }
    }
    
    handleFileChange(message) {
        const ext = message.file?.split('.').pop()?.toLowerCase();
        
        if (ext === 'css' && this.config.reloadCSS) {
            this.reloadCSSFile(message.file);
        } else if (ext === 'js' && this.config.reloadJS) {
            this.reloadJSFile(message.file);
        } else if (ext === 'html') {
            if (this.config.reloadHTML) {
                this.fullReload();
            }
        }
    }
    
    // ============================================
    // RELOAD STRATEGIES
    // ============================================
    
    fullReload() {
        this.saveState();
        
        this.logger.info('Performing full reload');
        window.location.reload();
    }
    
    triggerReload() {
        this.fullReload();
    }
    
    reloadCSSFiles(files) {
        if (!files || files.length === 0) {
            this.reloadAllCSS();
        } else {
            files.forEach(file => this.reloadCSSFile(file));
        }
    }
    
    reloadCSSFile(file) {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.includes(file) || file === '*')) {
                const newHref = href.replace(/\?.*|$/, `?v=${Date.now()}`);
                link.setAttribute('href', newHref);
                
                this.logger.debug('CSS reloaded', { file });
            }
        });
        
        // Also reload inline styles
        if (file === '*' || file.endsWith('.css')) {
            document.querySelectorAll('style').forEach(style => {
                const text = style.textContent;
                style.textContent = '';
                style.textContent = text;
            });
        }
    }
    
    reloadAllCSS() {
        this.reloadCSSFile('*');
    }
    
    reloadJSFiles(files) {
        if (!files || files.length === 0) {
            this.fullReload();
            return;
        }
        
        // For JS changes, full reload is safer
        this.fullReload();
    }
    
    reloadJSFile(file) {
        // For individual JS file changes, full reload
        this.fullReload();
    }
    
    // ============================================
    // STATE PRESERVATION
    // ============================================
    
    setupStatePreservation() {
        if (!this.config.preserveState) return;
        
        // Save state before unload
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
        
        // Restore state on load
        window.addEventListener('load', () => {
            this.restoreState();
        });
    }
    
    preserveState(key, value) {
        this.stateToPreserve[key] = value;
        
        try {
            sessionStorage.setItem(
                `hotreload_${key}`,
                JSON.stringify(value)
            );
        } catch {
            // Ignore
        }
    }
    
    getState(key) {
        if (this.stateToPreserve[key] !== undefined) {
            return this.stateToPreserve[key];
        }
        
        try {
            const stored = sessionStorage.getItem(`hotreload_${key}`);
            if (stored) {
                const value = JSON.parse(stored);
                this.stateToPreserve[key] = value;
                return value;
            }
        } catch {
            // Ignore
        }
        
        return null;
    }
    
    saveState() {
        // Save scroll position
        this.preserveState('scrollX', window.scrollX);
        this.preserveState('scrollY', window.scrollY);
        
        // Save form data
        document.querySelectorAll('form').forEach((form, index) => {
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });
            this.preserveState(`form_${index}_${form.id || 'unnamed'}`, data);
        });
        
        // Save active tab
        const activeTab = document.querySelector('.profile-tab.active, .tab.active');
        if (activeTab) {
            this.preserveState('activeTab', activeTab.dataset?.tab || activeTab.textContent);
        }
    }
    
    restoreState() {
        // Restore scroll position
        const scrollX = this.getState('scrollX');
        const scrollY = this.getState('scrollY');
        
        if (scrollX !== null && scrollY !== null) {
            setTimeout(() => {
                window.scrollTo(scrollX, scrollY);
            }, 100);
        }
        
        // Restore form data
        document.querySelectorAll('form').forEach((form, index) => {
            const data = this.getState(`form_${index}_${form.id || 'unnamed'}`);
            if (data) {
                Object.entries(data).forEach(([key, value]) => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) {
                        if (input.type === 'checkbox') {
                            input.checked = value === 'on' || value === true;
                        } else {
                            input.value = value;
                        }
                    }
                });
            }
        });
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    isEnabled() {
        return this.config.enabled && this.ws?.readyState === WebSocket.OPEN;
    }
    
    getStatus() {
        return {
            enabled: this.config.enabled,
            connected: this.ws?.readyState === WebSocket.OPEN,
            reconnectAttempts: this.reconnectAttempts
        };
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.logger.info('Hot reload destroyed');
    }
}

// Create singleton
const hotReload = new HotReload();

export default hotReload;
export { HotReload };