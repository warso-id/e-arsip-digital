// js/websocket.js - WebSocket Manager 2026
/**
 * E-Arsip Digital - WebSocket Manager
 * Version: 2026.1.0
 * Features: Auto-reconnect, message queuing, pub/sub pattern, 
 *           connection pooling, heartbeat
 */

import { Logger } from './logger.js';
import APP_CONFIG from '../config/config.js';

class WebSocketManager {
    constructor(options = {}) {
        this.logger = new Logger('WebSocket');
        
        this.config = {
            url: options.url || APP_CONFIG.app.wsUrl || 'wss://echo.websocket.org',
            reconnectInterval: 3000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            debug: APP_CONFIG.app.environment === 'development',
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
        
        // Message handling
        this.subscriptions = new Map();
        this.messageQueue = [];
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Bind methods
        this.handleOpen = this.handleOpen.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleError = this.handleError.bind(this);
        this.handleClose = this.handleClose.bind(this);
        
        // Auto-connect
        if (options.autoConnect !== false) {
            this.connect();
        }
    }
    
    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================
    
    connect(url = null) {
        if (this.isConnected || this.isConnecting) return;
        
        const wsUrl = url || this.config.url;
        
        this.isConnecting = true;
        this.logger.info('Connecting to WebSocket...', { url: wsUrl });
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = this.handleOpen;
            this.ws.onmessage = this.handleMessage;
            this.ws.onerror = this.handleError;
            this.ws.onclose = this.handleClose;
        } catch (error) {
            this.logger.error('WebSocket connection failed', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }
    
    disconnect() {
        this.config.maxReconnectAttempts = 0; // Prevent reconnect
        this.clearTimers();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
    
    handleOpen(event) {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        this.logger.info('WebSocket connected');
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Flush message queue
        this.flushQueue();
        
        // Dispatch event
        this.dispatchEvent('connected', { event });
    }
    
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            if (this.config.debug) {
                this.logger.debug('Message received', { type: message.type });
            }
            
            // Handle heartbeat response
            if (message.type === 'pong') {
                this.handleHeartbeatResponse();
                return;
            }
            
            // Handle request-response pattern
            if (message.requestId && this.pendingRequests.has(message.requestId)) {
                const { resolve } = this.pendingRequests.get(message.requestId);
                this.pendingRequests.delete(message.requestId);
                resolve(message.data);
                return;
            }
            
            // Route to subscribers
            this.routeMessage(message);
            
            // Dispatch general event
            this.dispatchEvent('message', message);
            
        } catch (error) {
            this.logger.warn('Failed to parse message', error);
        }
    }
    
    handleError(event) {
        this.logger.error('WebSocket error', event);
        this.dispatchEvent('error', { event });
    }
    
    handleClose(event) {
        this.isConnected = false;
        this.isConnecting = false;
        
        this.logger.warn('WebSocket closed', {
            code: event.code,
            reason: event.reason
        });
        
        this.clearTimers();
        this.dispatchEvent('disconnected', { code: event.code, reason: event.reason });
        
        // Reconnect if not intentional
        if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.logger.error('Max reconnect attempts reached');
            this.dispatchEvent('reconnect_failed', { attempts: this.reconnectAttempts });
            return;
        }
        
        const delay = Math.min(
            this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts),
            30000
        );
        
        this.logger.info('Scheduling reconnect', { 
            attempt: this.reconnectAttempts + 1,
            delay 
        });
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }
    
    // ============================================
    // HEARTBEAT
    // ============================================
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
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
        
        // Set timeout for pong response
        this.heartbeatTimeoutTimer = setTimeout(() => {
            this.logger.warn('Heartbeat timeout, reconnecting...');
            this.ws?.close(3009, 'Heartbeat timeout');
        }, this.config.heartbeatTimeout);
    }
    
    handleHeartbeatResponse() {
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }
    
    // ============================================
    // MESSAGING
    // ============================================
    
    send(data) {
        if (!this.isConnected) {
            // Queue message for later
            this.messageQueue.push(data);
            
            if (this.config.debug) {
                this.logger.debug('Message queued (not connected)', { data });
            }
            
            return false;
        }
        
        try {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.ws.send(message);
            return true;
        } catch (error) {
            this.logger.error('Failed to send message', error);
            return false;
        }
    }
    
    async request(data, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            
            // Store pending request
            this.pendingRequests.set(requestId, { resolve, reject, timestamp: Date.now() });
            
            // Set timeout
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, timeout);
            
            // Send request
            this.send({
                ...data,
                requestId
            });
        });
    }
    
    flushQueue() {
        if (this.messageQueue.length === 0) return;
        
        this.logger.info('Flushing message queue', { count: this.messageQueue.length });
        
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        
        queue.forEach(data => this.send(data));
    }
    
    // ============================================
    // PUB/SUB PATTERN
    // ============================================
    
    subscribe(channel, callback) {
        if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, new Set());
        }
        
        this.subscriptions.get(channel).add(callback);
        
        // Send subscription to server
        this.send({ type: 'subscribe', channel });
        
        // Return unsubscribe function
        return () => {
            this.subscriptions.get(channel)?.delete(callback);
            
            if (this.subscriptions.get(channel)?.size === 0) {
                this.subscriptions.delete(channel);
                this.send({ type: 'unsubscribe', channel });
            }
        };
    }
    
    unsubscribe(channel) {
        this.subscriptions.delete(channel);
        this.send({ type: 'unsubscribe', channel });
    }
    
    routeMessage(message) {
        // Route to channel subscribers
        if (message.channel && this.subscriptions.has(message.channel)) {
            this.subscriptions.get(message.channel).forEach(callback => {
                try {
                    callback(message.data, message);
                } catch (error) {
                    this.logger.error('Subscriber callback error', error);
                }
            });
        }
        
        // Route to type-based subscribers
        if (message.type && this.subscriptions.has(`type:${message.type}`)) {
            this.subscriptions.get(`type:${message.type}`).forEach(callback => {
                try {
                    callback(message.data, message);
                } catch (error) {
                    this.logger.error('Type subscriber callback error', error);
                }
            });
        }
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        
        this.eventListeners.get(event).add(callback);
        
        return () => {
            this.eventListeners.get(event)?.delete(callback);
        };
    }
    
    dispatchEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.logger.error('Event listener error', error);
                }
            });
        }
        
        // Also dispatch as DOM event
        window.dispatchEvent(new CustomEvent(`ws:${event}`, { detail: data }));
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    generateRequestId() {
        return `req_${++this.requestIdCounter}_${Date.now().toString(36)}`;
    }
    
    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.stopHeartbeat();
    }
    
    getStatus() {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: this.subscriptions.size,
            queueSize: this.messageQueue.length,
            pendingRequests: this.pendingRequests.size
        };
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        this.disconnect();
        this.subscriptions.clear();
        this.messageQueue = [];
        this.pendingRequests.clear();
        this.eventListeners.clear();
        
        this.logger.info('WebSocket manager destroyed');
    }
}

// Create singleton (lazy - only connect when needed)
const websocket = new WebSocketManager({ autoConnect: false });

export default websocket;
export { WebSocketManager };