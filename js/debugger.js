// js/debugger.js - Debug Mode & Error Tracking 2026
/**
 * E-Arsip Digital - Debugger
 * Version: 2026.1.0
 * Features: Debug panel, console commands, state inspection,
 *           performance profiling, network monitoring
 */

import { Logger } from './logger.js';
import APP_CONFIG from '../config/config.js';

class Debugger {
    constructor() {
        this.logger = new Logger('Debugger');
        
        this.config = {
            enabled: APP_CONFIG.app?.debug || APP_CONFIG.app?.environment === 'development',
            showPanel: false,
            logLevel: 'debug',
            maxLogEntries: 500,
            ...APP_CONFIG.debug || {}
        };
        
        // Debug state
        this.logs = [];
        this.networkRequests = [];
        this.stateSnapshots = [];
        this.performanceMarks = [];
        
        // Panel
        this.panel = null;
        this.isPanelOpen = false;
        
        if (this.config.enabled) {
            this.init();
        }
    }
    
    init() {
        this.createDebugPanel();
        this.setupConsoleOverride();
        this.setupNetworkMonitor();
        this.setupKeyboardShortcut();
        this.exposeGlobals();
        
        this.logger.info('Debugger initialized');
        
        // Auto-show panel in development
        if (APP_CONFIG.app?.environment === 'development' && 
            localStorage.getItem('debug_panel_open') === 'true') {
            setTimeout(() => this.togglePanel(), 1000);
        }
    }
    
    // ============================================
    // DEBUG PANEL
    // ============================================
    
    createDebugPanel() {
        if (document.getElementById('debug-panel')) return;
        
        this.panel = document.createElement('div');
        this.panel.id = 'debug-panel';
        this.panel.innerHTML = `
            <div class="debug-header">
                <span>🐛 Debug Panel</span>
                <div>
                    <button class="debug-tab-btn active" data-tab="logs">Logs</button>
                    <button class="debug-tab-btn" data-tab="network">Network</button>
                    <button class="debug-tab-btn" data-tab="state">State</button>
                    <button class="debug-tab-btn" data-tab="perf">Perf</button>
                    <button class="debug-close" id="debug-close">×</button>
                </div>
            </div>
            <div class="debug-body">
                <div class="debug-tab active" data-content="logs">
                    <div class="debug-toolbar">
                        <input type="text" class="debug-filter" id="debug-filter-logs" placeholder="Filter logs...">
                        <button class="debug-btn" id="debug-clear-logs">Clear</button>
                    </div>
                    <div class="debug-log-list" id="debug-log-list"></div>
                </div>
                <div class="debug-tab" data-content="network">
                    <div class="debug-toolbar">
                        <span id="debug-network-count">0 requests</span>
                        <button class="debug-btn" id="debug-clear-network">Clear</button>
                    </div>
                    <div class="debug-network-list" id="debug-network-list"></div>
                </div>
                <div class="debug-tab" data-content="state">
                    <div class="debug-toolbar">
                        <button class="debug-btn" id="debug-snapshot-state">Take Snapshot</button>
                        <button class="debug-btn" id="debug-clear-state">Clear</button>
                    </div>
                    <div class="debug-state-view" id="debug-state-view"></div>
                </div>
                <div class="debug-tab" data-content="perf">
                    <div class="debug-toolbar">
                        <span id="debug-fps">FPS: --</span>
                        <span id="debug-memory">Memory: --</span>
                        <button class="debug-btn" id="debug-clear-perf">Clear</button>
                    </div>
                    <div class="debug-perf-view" id="debug-perf-view"></div>
                </div>
            </div>
        `;
        
        // Styles
        const style = document.createElement('style');
        style.textContent = `
            #debug-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 300px;
                background: #1e293b;
                color: #f1f5f9;
                z-index: 9999;
                font-family: 'SF Mono', monospace;
                font-size: 12px;
                display: none;
                border-top: 3px solid #3b82f6;
            }
            #debug-panel.open { display: flex; flex-direction: column; }
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 12px;
                background: #0f172a;
                font-size: 13px;
                font-weight: 600;
            }
            .debug-tab-btn {
                background: none;
                border: none;
                color: #94a3b8;
                padding: 4px 10px;
                cursor: pointer;
                font-size: 11px;
                font-family: inherit;
            }
            .debug-tab-btn.active { color: #60a5fa; background: rgba(59,130,246,0.1); border-radius: 4px; }
            .debug-close {
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 18px;
                padding: 0 8px;
                margin-left: 12px;
            }
            .debug-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
            .debug-tab { display: none; flex-direction: column; height: 100%; }
            .debug-tab.active { display: flex; }
            .debug-toolbar {
                display: flex;
                gap: 8px;
                padding: 6px 12px;
                background: #334155;
                align-items: center;
            }
            .debug-filter {
                flex: 1;
                background: #1e293b;
                border: 1px solid #475569;
                color: #f1f5f9;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-family: inherit;
            }
            .debug-btn {
                background: #475569;
                border: none;
                color: #f1f5f9;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-family: inherit;
            }
            .debug-log-list, .debug-network-list {
                flex: 1;
                overflow-y: auto;
                padding: 4px 0;
            }
            .debug-log-entry {
                padding: 3px 12px;
                border-bottom: 1px solid #1e293b;
                display: flex;
                gap: 8px;
            }
            .debug-log-entry.debug { color: #94a3b8; }
            .debug-log-entry.info { color: #60a5fa; }
            .debug-log-entry.warn { color: #fbbf24; }
            .debug-log-entry.error { color: #f87171; }
            .debug-log-time { color: #64748b; min-width: 80px; }
            .debug-network-entry {
                padding: 3px 12px;
                border-bottom: 1px solid #1e293b;
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .debug-network-method {
                min-width: 45px;
                font-weight: 600;
                font-size: 10px;
                padding: 1px 4px;
                border-radius: 3px;
            }
            .debug-network-method.GET { background: #16a34a; color: white; }
            .debug-network-method.POST { background: #2563eb; color: white; }
            .debug-network-method.PUT { background: #d97706; color: white; }
            .debug-network-method.DELETE { background: #dc2626; color: white; }
            .debug-network-status { min-width: 35px; text-align: center; }
            .debug-network-status.success { color: #16a34a; }
            .debug-network-status.error { color: #dc2626; }
            .debug-network-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .debug-network-duration { min-width: 50px; text-align: right; color: #94a3b8; }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(this.panel);
        
        // Event handlers
        this.panel.querySelector('#debug-close')?.addEventListener('click', () => this.togglePanel());
        
        this.panel.querySelectorAll('.debug-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.panel.querySelectorAll('.debug-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.panel.querySelectorAll('.debug-tab').forEach(t => t.classList.remove('active'));
                const content = this.panel.querySelector(`[data-content="${btn.dataset.tab}"]`);
                content?.classList.add('active');
            });
        });
        
        this.panel.querySelector('#debug-clear-logs')?.addEventListener('click', () => {
            this.logs = [];
            this.renderLogs();
        });
        
        this.panel.querySelector('#debug-clear-network')?.addEventListener('click', () => {
            this.networkRequests = [];
            this.renderNetwork();
        });
        
        this.panel.querySelector('#debug-snapshot-state')?.addEventListener('click', () => {
            this.takeStateSnapshot();
        });
        
        this.panel.querySelector('#debug-filter-logs')?.addEventListener('input', (e) => {
            this.renderLogs(e.target.value);
        });
    }
    
    togglePanel() {
        this.isPanelOpen = !this.isPanelOpen;
        
        if (this.isPanelOpen) {
            this.panel.classList.add('open');
            localStorage.setItem('debug_panel_open', 'true');
        } else {
            this.panel.classList.remove('open');
            localStorage.setItem('debug_panel_open', 'false');
        }
    }
    
    // ============================================
    // CONSOLE OVERRIDE
    // ============================================
    
    setupConsoleOverride() {
        const methods = ['log', 'info', 'warn', 'error', 'debug'];
        const self = this;
        
        methods.forEach(method => {
            const original = console[method];
            
            console[method] = function(...args) {
                // Call original
                original.apply(console, args);
                
                // Add to debug panel
                self.addLog(method, args);
            };
        });
    }
    
    addLog(level, args) {
        const entry = {
            level,
            message: args.map(a => {
                if (typeof a === 'object') {
                    try { return JSON.stringify(a, null, 0).substring(0, 200); }
                    catch { return String(a); }
                }
                return String(a);
            }).join(' '),
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString()
        };
        
        this.logs.push(entry);
        
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }
        
        if (this.isPanelOpen) {
            this.renderLogs();
        }
    }
    
    renderLogs(filter = '') {
        const container = this.panel?.querySelector('#debug-log-list');
        if (!container) return;
        
        let logs = [...this.logs].reverse();
        
        if (filter) {
            const f = filter.toLowerCase();
            logs = logs.filter(l => l.message.toLowerCase().includes(f));
        }
        
        container.innerHTML = logs.slice(0, 100).map(l => `
            <div class="debug-log-entry ${l.level}">
                <span class="debug-log-time">${l.time}</span>
                <span>${l.message}</span>
            </div>
        `).join('');
    }
    
    // ============================================
    // NETWORK MONITOR
    // ============================================
    
    setupNetworkMonitor() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(...args) {
            const startTime = performance.now();
            const [url, options = {}] = args;
            const method = (options.method || 'GET').toUpperCase();
            
            return originalFetch.apply(this, args).then(response => {
                const duration = Math.round(performance.now() - startTime);
                
                self.addNetworkRequest({
                    method,
                    url: typeof url === 'string' ? url : url.url,
                    status: response.status,
                    duration,
                    timestamp: Date.now()
                });
                
                return response;
            }).catch(error => {
                const duration = Math.round(performance.now() - startTime);
                
                self.addNetworkRequest({
                    method,
                    url: typeof url === 'string' ? url : url.url,
                    status: 0,
                    duration,
                    error: error.message,
                    timestamp: Date.now()
                });
                
                throw error;
            });
        };
    }
    
    addNetworkRequest(request) {
        this.networkRequests.push(request);
        
        if (this.networkRequests.length > 200) {
            this.networkRequests = this.networkRequests.slice(-200);
        }
        
        if (this.isPanelOpen) {
            this.renderNetwork();
        }
        
        // Update count
        const countEl = this.panel?.querySelector('#debug-network-count');
        if (countEl) {
            countEl.textContent = `${this.networkRequests.length} requests`;
        }
    }
    
    renderNetwork() {
        const container = this.panel?.querySelector('#debug-network-list');
        if (!container) return;
        
        container.innerHTML = [...this.networkRequests].reverse().slice(0, 50).map(r => `
            <div class="debug-network-entry">
                <span class="debug-network-method ${r.method}">${r.method}</span>
                <span class="debug-network-status ${r.status < 400 ? 'success' : 'error'}">${r.status || 'ERR'}</span>
                <span class="debug-network-url" title="${r.url}">${r.url}</span>
                <span class="debug-network-duration">${r.duration}ms</span>
            </div>
        `).join('');
    }
    
    // ============================================
    // STATE INSPECTION
    // ============================================
    
    takeStateSnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            time: new Date().toISOString(),
            url: window.location.href,
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage },
            cookies: document.cookie,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize
            } : null,
            domNodes: document.querySelectorAll('*').length
        };
        
        this.stateSnapshots.push(snapshot);
        
        if (this.stateSnapshots.length > 20) {
            this.stateSnapshots = this.stateSnapshots.slice(-20);
        }
        
        this.renderState();
    }
    
    renderState() {
        const container = this.panel?.querySelector('#debug-state-view');
        if (!container) return;
        
        if (this.stateSnapshots.length === 0) {
            container.innerHTML = '<p style="padding:12px;color:#94a3b8;">No snapshots taken. Click "Take Snapshot" to capture state.</p>';
            return;
        }
        
        const latest = this.stateSnapshots[this.stateSnapshots.length - 1];
        
        container.innerHTML = `
            <div style="padding:12px;">
                <p><strong>Latest Snapshot:</strong> ${latest.time}</p>
                <p><strong>URL:</strong> ${latest.url}</p>
                <p><strong>DOM Nodes:</strong> ${latest.domNodes}</p>
                ${latest.memory ? `<p><strong>Memory:</strong> ${(latest.memory.used / 1048576).toFixed(1)}MB / ${(latest.memory.total / 1048576).toFixed(1)}MB</p>` : ''}
                <p><strong>localStorage Keys:</strong> ${Object.keys(latest.localStorage).length}</p>
                <p><strong>Snapshots:</strong> ${this.stateSnapshots.length}</p>
            </div>
        `;
    }
    
    // ============================================
    // PERFORMANCE
    // ============================================
    
    markPerformance(label) {
        const mark = {
            label,
            timestamp: performance.now(),
            memory: performance.memory?.usedJSHeapSize || 0
        };
        
        this.performanceMarks.push(mark);
        
        if (this.performanceMarks.length > 100) {
            this.performanceMarks = this.performanceMarks.slice(-100);
        }
        
        this.updatePerfDisplay();
    }
    
    updatePerfDisplay() {
        if (!this.isPanelOpen) return;
        
        const fpsEl = this.panel?.querySelector('#debug-fps');
        const memEl = this.panel?.querySelector('#debug-memory');
        
        if (fpsEl && window.performanceMonitor) {
            const report = window.performanceMonitor.getReport();
            fpsEl.textContent = `FPS: ${report.fps || '--'}`;
            
            if (memEl && report.memory) {
                memEl.textContent = `Memory: ${report.memory.percent || '--'}`;
            }
        }
    }
    
    // ============================================
    // KEYBOARD SHORTCUT
    // ============================================
    
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D to toggle debug panel
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.togglePanel();
            }
        });
    }
    
    // ============================================
    // GLOBAL EXPOSURE
    // ============================================
    
    exposeGlobals() {
        // Expose useful debugging functions
        window.__debug = {
            panel: () => this.togglePanel(),
            state: () => {
                this.takeStateSnapshot();
                console.log('State Snapshot:', this.stateSnapshots[this.stateSnapshots.length - 1]);
            },
            logs: () => console.table(this.logs.slice(-20)),
            network: () => console.table(this.networkRequests.slice(-20)),
            perf: () => console.table(this.performanceMarks.slice(-20)),
            clear: () => {
                this.logs = [];
                this.networkRequests = [];
                this.stateSnapshots = [];
                this.performanceMarks = [];
                this.renderLogs();
                this.renderNetwork();
            }
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    isEnabled() {
        return this.config.enabled;
    }
    
    log(message, data = null) {
        this.addLog('debug', [message, data]);
    }
    
    destroy() {
        this.panel?.remove();
        this.logger.info('Debugger destroyed');
    }
}

// Create singleton
const debuggerInstance = new Debugger();

// Expose globally
window.debugger = debuggerInstance;

export default debuggerInstance;
export { Debugger };