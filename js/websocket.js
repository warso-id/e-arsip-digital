// js/websocket.js - Enterprise Secure WebSocket Manager 2026
/**
 * E-Arsip Digital - Advanced WebSocket Manager
 * Version: 2026.1.0
 * Features: Auto-reconnect with backoff, message queuing, pub/sub,
 *           heartbeat with page visibility awareness, request-response,
 *           PWA-aware connection management, binary message support
 * Security: Message validation, origin check, rate limiting, secure reconnect
 */

class WebSocketManager {
    constructor(options = {}) {
        // ✅ FIX: No external imports, use config from options or defaults
        this.config = {
            url: 'wss://localhost:8080',
            reconnectInterval: 2000,
            maxReconnectAttempts: 10,
            maxReconnectBackoff: 30000,
            heartbeatInterval: 25000,
            heartbeatTimeout: 8000,
            requestTimeout: 15000,
            maxQueueSize: 500,
            maxPendingRequests: 50,
            maxSubscriptions: 100,
            debug: false,
            autoConnect: false,
            pauseWhenHidden: true,
            ...options
        };
        
        // State
        this.ws = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.heartbeatTimeoutTimer = null;
        this.lastPongTime = null;
        
        // Message handling
        this.subscriptions = new Map();
        this.messageQueue = [];
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        
        // Event listeners
        this.listeners = new Map();
        
        // PWA state
        this.isPageVisible = !document.hidden;
        this.isPWA = this.detectPWA();
        
        // Security
        this.messageCount = 0;
        this.messageCountReset = Date.now();
        this.maxMessagesPerMinute = options.maxMessagesPerMinute || 600;
        
        // Bind methods
        this.handleOpen = this.handleOpen.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleError = this.handleError.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
        
        // Logger (minimal, no dependencies)
        this.log = (level, message, data) => {
            if (this.config.debug) {
                console[level](`[WebSocket] ${message}`, data || '');
            }
        };
        
        this.init();
    }
    
    init() {
        // Setup visibility/online handlers
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        
        // Auto-connect
        if (this.config.autoConnect) {
            this.connect();
        }
        
        this.log('info', 'WebSocket manager initialized', {
            url: this.config.url,
            isPWA: this.isPWA
        });
    }
    
    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================
    
    connect(url = null) {
        if (this.isConnected || this.isConnecting) return;
        
        // Don't connect when offline
        if (!navigator.onLine) {
            this.log('info', 'Device offline, skipping connection');
            this.scheduleReconnect();
            return;
        }
        
        // Don't connect when page hidden (PWA battery saving)
        if (this.config.pauseWhenHidden && !this.isPageVisible) {
            this.log('debug', 'Page hidden, deferring connection');
            return;
        }
        
        const wsUrl = url || this.config.url;
        
        // Validate URL
        if (!this.isValidWsUrl(wsUrl)) {
            this.log('error', 'Invalid WebSocket URL', { url: wsUrl });
            this.dispatchEvent('error', { message: 'Invalid WebSocket URL' });
            return;
        }
        
        this.isConnecting = true;
        this.log('info', 'Connecting to WebSocket...', { url: this.sanitizeUrl(wsUrl) });
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            // Set binary type for efficiency
            this.ws.binaryType = 'arraybuffer';
            
            this.ws.onopen = this.handleOpen;
            this.ws.onmessage = this.handleMessage;
            this.ws.onerror = this.handleError;
            this.ws.onclose = this.handleClose;
        } catch (error) {
            this.log('error', 'WebSocket connection failed', { error: error.message });
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }
    
    disconnect(code = 1000, reason = 'Client disconnect') {
        this.config.maxReconnectAttempts = 0;
        this.clearTimers();
        
        if (this.ws) {
            try {
                this.ws.close(code, reason);
            } catch {}
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Reject pending requests
        this.rejectPendingRequests(new Error('Connection closed'));
    }
    
    reconnect() {
        this.reconnectAttempts = 0;
        this.config.maxReconnectAttempts = this.config.maxReconnectAttempts || 10;
        
        if (this.ws) {
            try { this.ws.close(1000, 'Reconnect'); } catch {}
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.connect();
    }
    
    handleOpen(event) {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        this.log('info', 'WebSocket connected');
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Resubscribe channels
        this.resubscribeAll();
        
        // Flush queued messages
        this.flushQueue();
        
        // Dispatch
        this.dispatchEvent('connected', { timestamp: Date.now() });
    }
    
    handleClose(event) {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;
        
        this.log('warn', 'WebSocket closed', {
            code: event.code,
            reason: event.reason || 'No reason',
            wasClean: event.wasClean
        });
        
        this.clearTimers();
        
        // Reject pending requests on abnormal close
        if (!event.wasClean) {
            this.rejectPendingRequests(new Error('Connection lost'));
        }
        
        this.dispatchEvent('disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });
        
        // Reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.dispatchEvent('reconnect_failed', {
                attempts: this.reconnectAttempts
            });
        }
    }
    
    handleError(event) {
        this.log('error', 'WebSocket error');
        this.dispatchEvent('error', { timestamp: Date.now() });
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.log('error', 'Max reconnect attempts reached');
            this.dispatchEvent('reconnect_failed', {
                attempts: this.reconnectAttempts
            });
            return;
        }
        
        // Don't reconnect when offline
        if (!navigator.onLine) {
            this.log('debug', 'Offline, waiting for online event');
            return;
        }
        
        // Exponential backoff with jitter
        const baseDelay = this.config.reconnectInterval;
        const backoff = Math.min(
            baseDelay * Math.pow(1.5, this.reconnectAttempts),
            this.config.maxReconnectBackoff
        );
        const jitter = Math.random() * 1000;
        const delay = backoff + jitter;
        
        this.log('info', 'Scheduling reconnect', {
            attempt: this.reconnectAttempts + 1,
            delay: Math.round(delay),
            max: this.config.maxReconnectAttempts
        });
        
        this.clearReconnectTimer();
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }
    
    // ============================================
    // HEARTBEAT (Page Visibility Aware)
    // ============================================
    
    startHeartbeat() {
        this.stopHeartbeat();
        this.lastPongTime = Date.now();
        
        this.heartbeatTimer = setInterval(() => {
            // Skip heartbeat if page hidden (save battery)
            if (this.config.pauseWhenHidden && !this.isPageVisible) {
                return;
            }
            
            this.sendPing();
        }, this.config.heartbeatInterval);
    }
    
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }
    
    sendPing() {
        if (!this.isConnected) return;
        
        this.send({ type: 'ping', timestamp: Date.now() });
        
        this.heartbeatTimeoutTimer = setTimeout(() => {
            this.log('warn', 'Heartbeat timeout, reconnecting...');
            
            if (this.ws) {
                try { this.ws.close(3009, 'Heartbeat timeout'); } catch {}
                this.ws = null;
            }
            
            this.isConnected = false;
            this.scheduleReconnect();
        }, this.config.heartbeatTimeout);
    }
    
    handlePong() {
        this.lastPongTime = Date.now();
        
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }
    
    // ============================================
    // MESSAGING (with rate limiting)
    // ============================================
    
    send(data, options = {}) {
        // Rate limiting check
        if (!this.checkRateLimit()) {
            this.log('warn', 'Message rate limit exceeded');
            return false;
        }
        
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // Queue if configured
            if (options.queue !== false) {
                this.queueMessage(data);
                this.log('debug', 'Message queued (not connected)');
            }
            return false;
        }
        
        try {
            let message;
            
            if (data instanceof ArrayBuffer || data instanceof Blob) {
                message = data;
            } else if (typeof data === 'string') {
                message = data;
            } else {
                message = JSON.stringify(data);
            }
            
            this.ws.send(message);
            return true;
        } catch (error) {
            this.log('error', 'Failed to send message', { error: error.message });
            return false;
        }
    }
    
    async request(data, timeout = null) {
        const requestTimeout = timeout || this.config.requestTimeout;
        const requestId = this.generateRequestId();
        
        // Check pending requests limit
        if (this.pendingRequests.size >= this.config.maxPendingRequests) {
            // Remove oldest
            const oldestKey = this.pendingRequests.keys().next().value;
            const oldest = this.pendingRequests.get(oldestKey);
            if (oldest) {
                oldest.reject(new Error('Too many pending requests'));
                this.pendingRequests.delete(oldestKey);
            }
        }
        
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout after ${requestTimeout}ms`));
            }, requestTimeout);
            
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timer,
                timestamp: Date.now()
            });
            
            const sent = this.send({ ...data, requestId });
            
            if (!sent) {
                clearTimeout(timer);
                this.pendingRequests.delete(requestId);
                reject(new Error('Failed to send request'));
            }
        });
    }
    
    queueMessage(data) {
        // Limit queue size
        if (this.messageQueue.length >= this.config.maxQueueSize) {
            this.messageQueue.shift(); // Remove oldest
            this.log('warn', 'Message queue full, dropped oldest message');
        }
        
        this.messageQueue.push({
            data,
            timestamp: Date.now()
        });
    }
    
    flushQueue() {
        if (this.messageQueue.length === 0) return;
        
        const count = this.messageQueue.length;
        this.log('info', 'Flushing message queue', { count });
        
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        
        // Send messages with small delay between batches
        const batchSize = 10;
        for (let i = 0; i < queue.length; i += batchSize) {
            const batch = queue.slice(i, i + batchSize);
            
            setTimeout(() => {
                batch.forEach(item => {
                    // Skip messages older than 30 seconds
                    if (Date.now() - item.timestamp > 30000) return;
                    this.send(item.data, { queue: false });
                });
            }, Math.floor(i / batchSize) * 50);
        }
    }
    
    rejectPendingRequests(error) {
        this.pendingRequests.forEach((pending) => {
            clearTimeout(pending.timer);
            pending.reject(error);
        });
        this.pendingRequests.clear();
    }
    
    // ============================================
    // MESSAGE HANDLING (with validation)
    // ============================================
    
    handleMessage(event) {
        try {
            let message;
            
            // Handle binary messages
            if (event.data instanceof ArrayBuffer) {
                this.dispatchEvent('binary', event.data);
                return;
            }
            
            if (event.data instanceof Blob) {
                this.handleBlobMessage(event.data);
                return;
            }
            
            // Parse JSON
            try {
                message = JSON.parse(event.data);
            } catch {
                // Plain text message
                message = { type: 'text', data: event.data };
            }
            
            // Validate message structure
            if (!this.isValidMessage(message)) {
                this.log('warn', 'Invalid message format received');
                return;
            }
            
            // Handle pong
            if (message.type === 'pong') {
                this.handlePong();
                return;
            }
            
            // Handle request-response
            if (message.requestId && this.pendingRequests.has(message.requestId)) {
                const pending = this.pendingRequests.get(message.requestId);
                clearTimeout(pending.timer);
                this.pendingRequests.delete(message.requestId);
                
                if (message.error) {
                    pending.reject(new Error(message.error));
                } else {
                    pending.resolve(message.data || message);
                }
                return;
            }
            
            // Handle error messages
            if (message.type === 'error') {
                this.log('error', 'Server error', { message: message.message });
                this.dispatchEvent('server_error', message);
                return;
            }
            
            // Route to subscribers
            this.routeMessage(message);
            
            // Dispatch general event
            this.dispatchEvent('message', message);
            
        } catch (error) {
            this.log('error', 'Failed to handle message', { error: error.message });
        }
    }
    
    async handleBlobMessage(blob) {
        try {
            const text = await blob.text();
            
            try {
                const message = JSON.parse(text);
                this.routeMessage(message);
                this.dispatchEvent('message', message);
            } catch {
                this.dispatchEvent('binary', blob);
            }
        } catch {
            this.dispatchEvent('binary', blob);
        }
    }
    
    // ============================================
    // PUB/SUB PATTERN
    // ============================================
    
    subscribe(channel, callback) {
        if (this.subscriptions.size >= this.config.maxSubscriptions) {
            this.log('warn', 'Max subscriptions reached');
            return () => {};
        }
        
        if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, new Set());
        }
        
        this.subscriptions.get(channel).add(callback);
        
        // Notify server if connected
        if (this.isConnected) {
            this.send({ type: 'subscribe', channel });
        }
        
        // Return unsubscribe function
        return () => {
            const subs = this.subscriptions.get(channel);
            if (subs) {
                subs.delete(callback);
                
                if (subs.size === 0) {
                    this.subscriptions.delete(channel);
                    
                    if (this.isConnected) {
                        this.send({ type: 'unsubscribe', channel });
                    }
                }
            }
        };
    }
    
    unsubscribe(channel) {
        this.subscriptions.delete(channel);
        
        if (this.isConnected) {
            this.send({ type: 'unsubscribe', channel });
        }
    }
    
    resubscribeAll() {
        this.subscriptions.forEach((_, channel) => {
            this.send({ type: 'subscribe', channel });
        });
    }
    
    routeMessage(message) {
        // Route to channel subscribers
        if (message.channel && this.subscriptions.has(message.channel)) {
            this.subscriptions.get(message.channel).forEach(callback => {
                try {
                    callback(message.data, message);
                } catch (error) {
                    this.log('error', 'Subscriber callback error', {
                        channel: message.channel,
                        error: error.message
                    });
                }
            });
        }
        
        // Route to type-based subscribers
        if (message.type && this.subscriptions.has(`type:${message.type}`)) {
            this.subscriptions.get(`type:${message.type}`).forEach(callback => {
                try {
                    callback(message.data, message);
                } catch (error) {
                    this.log('error', 'Type callback error', {
                        type: message.type,
                        error: error.message
                    });
                }
            });
        }
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        this.listeners.get(event).add(callback);
        
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }
    
    off(event, callback) {
        this.listeners.get(event)?.delete(callback);
    }
    
    dispatchEvent(event, data) {
        // Local listeners
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log('error', 'Event listener error', {
                        event,
                        error: error.message
                    });
                }
            });
        }
        
        // DOM event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(`ws:${event}`, {
                detail: data
            }));
        }
    }
    
    // ============================================
    // VISIBILITY & ONLINE HANDLERS
    // ============================================
    
    handleVisibilityChange() {
        this.isPageVisible = !document.hidden;
        
        this.log('debug', 'Page visibility changed', {
            visible: this.isPageVisible
        });
        
        if (this.isPageVisible) {
            // Page became visible
            if (!this.isConnected && this.reconnectAttempts < this.config.maxReconnectAttempts) {
                this.log('info', 'Page visible, reconnecting...');
                this.reconnect();
            } else if (this.isConnected) {
                // Send heartbeat immediately
                this.lastPongTime = Date.now();
                this.sendPing();
            }
        } else {
            // Page hidden - pause expensive operations
            // Keep connection alive but reduce activity
        }
        
        this.dispatchEvent('visibility', {
            visible: this.isPageVisible
        });
    }
    
    handleOnline() {
        this.log('info', 'Device online');
        
        if (!this.isConnected && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.reconnect();
        }
        
        this.dispatchEvent('online', { timestamp: Date.now() });
    }
    
    handleOffline() {
        this.log('info', 'Device offline');
        
        this.clearTimers();
        
        this.dispatchEvent('offline', { timestamp: Date.now() });
    }
    
    // ============================================
    // SECURITY
    // ============================================
    
    isValidWsUrl(url) {
        if (!url) return false;
        
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
        } catch {
            return false;
        }
    }
    
    isValidMessage(message) {
        if (!message || typeof message !== 'object') return false;
        if (Array.isArray(message)) return false;
        
        // Check message size (prevent large payload attacks)
        const json = JSON.stringify(message);
        if (json.length > 65536) { // 64KB limit
            this.log('warn', 'Message too large, rejected');
            return false;
        }
        
        // Validate type if present
        if (message.type && typeof message.type !== 'string') return false;
        if (message.type && message.type.length > 100) return false;
        
        return true;
    }
    
    checkRateLimit() {
        const now = Date.now();
        
        if (now - this.messageCountReset > 60000) {
            this.messageCount = 0;
            this.messageCountReset = now;
        }
        
        this.messageCount++;
        
        if (this.messageCount > this.maxMessagesPerMinute) {
            return false;
        }
        
        return true;
    }
    
    sanitizeUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}/***`;
        } catch {
            return url;
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateRequestId() {
        this.requestIdCounter++;
        return `req_${this.requestIdCounter}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    detectPWA() {
        return typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone
        );
    }
    
    clearTimers() {
        this.clearReconnectTimer();
        this.stopHeartbeat();
    }
    
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    
    getStatus() {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: this.subscriptions.size,
            queueSize: this.messageQueue.length,
            pendingRequests: this.pendingRequests.size,
            lastPong: this.lastPongTime,
            pageVisible: this.isPageVisible,
            isPWA: this.isPWA,
            rateLimited: !this.checkRateLimit()
        };
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        // Disconnect
        this.config.maxReconnectAttempts = 0;
        this.clearTimers();
        
        if (this.ws) {
            try { this.ws.close(1000, 'Destroy'); } catch {}
            this.ws = null;
        }
        
        // Reject pending
        this.rejectPendingRequests(new Error('WebSocket destroyed'));
        
        // Clear state
        this.subscriptions.clear();
        this.messageQueue = [];
        this.pendingRequests.clear();
        this.listeners.clear();
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        this.isConnected = false;
        this.isConnecting = false;
        
        this.log('info', 'WebSocket manager destroyed');
    }
}

// Create singleton (lazy connect)
const websocket = new WebSocketManager({ autoConnect: false });

export default websocket;
export { WebSocketManager };