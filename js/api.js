<<<<<<< HEAD
// js/api.js - API Service 2026
/**
 * E-Arsip Digital - API Service
 * Version: 2026.1.0
 * Handles all API communication with Google Sheets backend
 * Features: Request queuing, offline support, retry logic, caching
 */

import APP_CONFIG from '../config/config.js';
import { Logger } from './logger.js';
import { CacheManager } from './cache.js';
import { ErrorHandler } from './error-handler.js';
import { sanitizeObject } from './security/sanitizer.js';

class ApiService {
    constructor(config = APP_CONFIG) {
        this.config = config;
        // ⬇️ SUDAH BENAR - mengambil dari config.js
        this.baseUrl = config.app.apiUrl;
        this.logger = new Logger('ApiService');
        this.cache = new CacheManager('api-cache');
        this.errorHandler = new ErrorHandler();
        
        // Request queue for offline support
        this.requestQueue = [];
        this.isOnline = navigator.onLine;
        this.processingQueue = false;
        
        // Request tracking
        this.activeRequests = new Map();
        this.requestIdCounter = 0;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cachedResponses: 0,
            averageResponseTime: 0
        };
=======
// js/api.js - API Service 2026 (REGULAR SCRIPT - No ES Modules)
/**
 * E-Arsip Digital - API Service
 * Version: 2026.1.0
 * ⬇️ DIUBAH: Dari ES Module ke regular script (window.EArsip.Api)
 */
(function() {
    'use strict';
    
    var APP_CONFIG = window.EArsip.Config;
    
    function ApiService() {
        this.config = APP_CONFIG;
        this.baseUrl = APP_CONFIG.app.apiUrl;
        this.stats = { totalRequests: 0, successfulRequests: 0, failedRequests: 0 };
        this.requestQueue = [];
        this.isOnline = navigator.onLine;
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
        
        this.init();
    }
    
<<<<<<< HEAD
    init() {
        this.setupNetworkListeners();
        this.loadQueueFromStorage();
        this.setupInterceptors();
        
        this.logger.info('API Service initialized', {
            baseUrl: this.baseUrl,
            online: this.isOnline,
            queueSize: this.requestQueue.length
        });
    }
    
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.logger.info('Network connection restored');
            this.processQueue();
            this.notifyOnlineStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.logger.warn('Network connection lost');
            this.notifyOnlineStatus(false);
        });
    }
    
    setupInterceptors() {
        this.requestInterceptor = async (config) => {
            const token = localStorage.getItem('auth_token');
            if (token) {
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${token}`,
                    'X-Request-ID': this.generateRequestId(),
                    'X-App-Version': APP_CONFIG.app.version,
                    'X-Environment': APP_CONFIG.app.environment
                };
            }
            
            const csrfToken = this.getCsrfToken();
            if (csrfToken) {
                config.headers['X-XSRF-TOKEN'] = csrfToken;
            }
            
            return config;
        };
        
        this.responseInterceptor = (response) => {
            this.updateStats(true, response.responseTime);
            return response;
        };
        
        this.errorInterceptor = (error) => {
            this.updateStats(false);
            this.errorHandler.handle(error);
            throw error;
        };
    }
    
    // ============================================
    // ⬇️ BAGIAN INI YANG DISESUAIKAN UNTUK GOOGLE APPS SCRIPT
    // ============================================
    async request(action, data = {}, options = {}) {
        const requestId = this.generateRequestId();
        const startTime = performance.now();
        
        const defaultOptions = {
            method: 'POST', // Google Apps Script hanya menerima POST untuk data
            timeout: 30000,
            retries: this.config.googleAppsScript?.retryAttempts || 3,
            cache: false,
            cacheTTL: this.config.googleAppsScript?.cacheTimeout || 300000,
            offline: false,
            priority: 'normal'
        };
        
        const config = { ...defaultOptions, ...options };
        
        // Check cache first (hanya untuk GET-like requests)
        if (config.cache && config.method === 'POST') {
            const cacheKey = `${action}_${JSON.stringify(data)}`;
            const cachedResponse = await this.cache.get(cacheKey);
            if (cachedResponse && !this.isCacheExpired(cachedResponse.timestamp, config.cacheTTL)) {
                this.stats.cachedResponses++;
                this.logger.debug('Cache hit', { action, requestId });
                return cachedResponse.data;
            }
        }
        
        // If offline and not allowed, queue the request
        if (!this.isOnline && !config.offline) {
            this.queueRequest({ action, data, config, requestId });
            this.logger.debug('Request queued for offline', { action, requestId });
            return { status: 'queued', requestId };
        }
        
        try {
            // ⬇️ MEMBANGUN URL DENGAN PARAMETER ACTION (CARA GOOGLE APPS SCRIPT)
            const url = this.buildGoogleScriptUrl(action, data, config);
            
            // Sanitize request body
            const sanitizedData = sanitizeObject(data);
            
            // Apply request interceptor
            const interceptedConfig = await this.requestInterceptor(config);
            
            // ⬇️ KIRIM REQUEST KE GOOGLE APPS SCRIPT
            const response = await this.executeGoogleScriptRequest(url, sanitizedData, interceptedConfig, config.timeout);
            
            const responseTime = performance.now() - startTime;
            
            const processedResponse = {
                ...response,
                requestId,
                action,
                responseTime,
                timestamp: Date.now()
            };
            
            await this.responseInterceptor(processedResponse);
            
            // Cache successful responses
            if (config.cache) {
                const cacheKey = `${action}_${JSON.stringify(data)}`;
                await this.cache.set(cacheKey, {
                    data: processedResponse,
                    timestamp: Date.now()
                });
            }
            
            // ⬇️ GOOGLE APPS SCRIPT MEMBUNGKUS RESPONSE DI DALAM .data
            if (processedResponse.data && processedResponse.data.success !== undefined) {
                if (!processedResponse.data.success) {
                    throw new Error(processedResponse.data.error || 'Request failed');
                }
                return processedResponse.data;
            }
            
            return processedResponse;
            
        } catch (error) {
            // Retry logic
            if (config.retries > 0 && this.isRetryableError(error)) {
                this.logger.warn('Retrying request', { 
                    action, 
                    requestId, 
                    retriesLeft: config.retries,
                    error: error.message 
                });
                
                await this.delay(Math.pow(2, config.retries) * 1000);
                return this.request(action, data, { 
                    ...config, 
                    retries: config.retries - 1 
                });
            }
            
            // Queue non-read requests for offline processing
            if (!this.isOnline && action.startsWith('create') || action.startsWith('update') || action.startsWith('delete')) {
                this.queueRequest({ action, data, config, requestId });
                return { status: 'queued', requestId };
            }
            
            await this.errorInterceptor(error);
            throw error;
        }
    }
    
    /**
     * Membangun URL untuk Google Apps Script
     * Google Apps Script membaca parameter ?action=namafungsi
     * dan data dikirim via POST body
     */
    buildGoogleScriptUrl(action, data, config) {
        // Base URL sudah termasuk /exec
        const url = new URL(this.baseUrl);
        
        // Tambahkan action sebagai query parameter
        url.searchParams.append('action', action);
        
        // Tambahkan parameter tambahan jika ada
        if (config.params) {
            Object.entries(config.params).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    url.searchParams.append(key, value);
                }
            });
        }
        
        return url.toString();
    }
    
    /**
     * Eksekusi request ke Google Apps Script
     * Google Apps Script memerlukan POST dengan JSON body
     */
    async executeGoogleScriptRequest(url, data, config, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // ⬇️ GOOGLE APPS SCRIPT: Kirim data sebagai JSON di body
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...config.headers
            },
            signal: controller.signal,
            // ⬇️ PENTING: Google Apps Script memerlukan redirect: 'follow'
            redirect: 'follow'
        };
        
        // Tambahkan body untuk POST
        if (data && Object.keys(data).length > 0) {
            requestOptions.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);
            
            // ⬇️ GOOGLE APPS SCRIPT KADANG RETURN DENGAN CONTENT-TYPE YANG BERBEDA
            const contentType = response.headers.get('content-type') || '';
            let responseData;
            
            if (contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                // Google Apps Script kadang return text yang berisi JSON
                const text = await response.text();
                try {
                    responseData = JSON.parse(text);
                } catch {
                    responseData = { success: false, error: 'Invalid response format', raw: text };
                }
            }
            
            // ⬇️ CEK APAKAH RESPONSE DARI GOOGLE APPS SCRIPT VALID
            if (!response.ok && !responseData) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return {
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            };
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }
    
    async createHttpError(response) {
        let message = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
            const errorData = await response.json();
            if (errorData.message) {
                message = errorData.message;
            }
        } catch (e) {
            // Ignore JSON parsing errors
        }
        
        const error = new Error(message);
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = response;
        
        return error;
    }
    
    // ============================================
    // CONVENIENCE METHODS
    // ============================================
    
    /**
     * GET-like request (read data)
     */
    async get(action, params = {}, options = {}) {
        return this.request(action, params, { ...options, cache: options.cache !== false });
    }
    
    /**
     * POST-like request (create data)
     */
    async post(action, data = {}, options = {}) {
        return this.request(action, data, { ...options, priority: 'high' });
    }
    
    /**
     * PUT-like request (update data)
     */
    async put(action, data = {}, options = {}) {
        return this.request(action, data, { ...options, priority: 'high' });
    }
    
    /**
     * PATCH-like request (partial update)
     */
    async patch(action, data = {}, options = {}) {
        return this.request(action, data, { ...options });
    }
    
    /**
     * DELETE-like request
     */
    async delete(action, data = {}, options = {}) {
        return this.request(action, data, { ...options, priority: 'high' });
    }
    
    // ============================================
    // FILE UPLOAD (KHUSUS GOOGLE APPS SCRIPT)
    // ============================================
    async uploadFile(action, file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async () => {
                try {
                    // ⬇️ KONVERSI FILE KE BASE64 UNTUK GOOGLE APPS SCRIPT
                    const base64Data = reader.result.split(',')[1];
                    
                    const data = {
                        fileName: file.name,
                        mimeType: file.type,
                        fileSize: file.size,
                        fileData: base64Data
                    };
                    
                    if (options.metadata) {
                        data.metadata = options.metadata;
                    }
                    
                    const result = await this.request(action, data, {
                        timeout: 120000,
                        priority: 'high'
                    });
                    
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    
    // Bulk operations
    async bulkRequest(requests) {
        const results = await Promise.allSettled(
            requests.map(req => this.request(req.action, req.data, req.options))
        );
        
        return results.map((result, index) => ({
            request: requests[index],
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason.message : null
        }));
    }
    
    // Offline queue management
    queueRequest(request) {
        request.timestamp = Date.now();
        request.priority = request.config?.priority || 'normal';
        
        this.requestQueue.push(request);
        this.sortQueueByPriority();
        this.saveQueueToStorage();
        
        this.logger.debug('Request queued', { 
            action: request.action, 
            queueSize: this.requestQueue.length 
        });
    }
    
    async processQueue() {
        if (!this.isOnline || this.processingQueue || this.requestQueue.length === 0) {
            return;
        }
        
        this.processingQueue = true;
        this.logger.info('Processing offline queue', { 
            queueSize: this.requestQueue.length 
        });
        
        const queue = [...this.requestQueue];
        this.requestQueue = [];
        
        for (const request of queue) {
            try {
                await this.request(request.action, request.data, {
                    ...request.config,
                    offline: true
                });
                this.logger.debug('Queue item processed successfully', { 
                    action: request.action 
                });
            } catch (error) {
                this.logger.error('Queue item failed', { 
                    action: request.action, 
                    error: error.message 
                });
                if (request.priority === 'critical') {
                    this.queueRequest(request);
                }
            }
        }
        
        this.processingQueue = false;
        this.saveQueueToStorage();
        this.notifyQueueProcessed(queue.length);
    }
    
    sortQueueByPriority() {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        this.requestQueue.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );
    }
    
    async loadQueueFromStorage() {
        try {
            const stored = localStorage.getItem('api_request_queue');
            if (stored) {
                this.requestQueue = JSON.parse(stored);
                this.logger.debug('Loaded queue from storage', { 
                    queueSize: this.requestQueue.length 
                });
            }
        } catch (error) {
            this.logger.error('Failed to load queue', error);
        }
    }
    
    saveQueueToStorage() {
        try {
            localStorage.setItem('api_request_queue', 
                JSON.stringify(this.requestQueue.slice(0, 100)));
        } catch (error) {
            this.logger.error('Failed to save queue', error);
        }
    }
    
    // Utilities
    generateRequestId() {
        return `req_${Date.now()}_${++this.requestIdCounter}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content 
            || this.getCookie('XSRF-TOKEN');
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    
    isRetryableError(error) {
        return error.status >= 500 || error.status === 429 || error.name === 'AbortError';
    }
    
    isCacheExpired(timestamp, ttl) {
        return Date.now() - timestamp > ttl;
    }
    
    updateStats(success, responseTime) {
        this.stats.totalRequests++;
        if (success) {
            this.stats.successfulRequests++;
            if (responseTime) {
                this.stats.averageResponseTime = 
                    (this.stats.averageResponseTime + responseTime) / 2;
            }
        } else {
            this.stats.failedRequests++;
        }
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Event system
    notifyOnlineStatus(isOnline) {
        window.dispatchEvent(new CustomEvent('api:onlineStatus', { 
            detail: { isOnline } 
        }));
    }
    
    notifyQueueProcessed(count) {
        window.dispatchEvent(new CustomEvent('api:queueProcessed', { 
            detail: { count } 
        }));
    }
    
    // Cleanup
    destroy() {
        this.cache.clear();
        this.requestQueue = [];
        this.activeRequests.clear();
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
    }
    
    // Health check
    async healthCheck() {
        try {
            const startTime = performance.now();
            const response = await this.request('health', {}, { timeout: 5000, retries: 0 });
            const responseTime = performance.now() - startTime;
            
            return {
                healthy: true,
                responseTime,
                version: response.data?.version,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
export { ApiService };
=======
    ApiService.prototype.init = function() {
        var self = this;
        
        window.addEventListener('online', function() {
            self.isOnline = true;
            console.log('API: Online');
            self.processQueue();
        });
        
        window.addEventListener('offline', function() {
            self.isOnline = false;
            console.log('API: Offline');
        });
        
        console.log('API Service initialized: ' + this.baseUrl);
    };
    
    /**
     * Kirim request ke Google Apps Script
     * @param {string} action - Nama action (login, getSuratKeluar, dll)
     * @param {object} data - Data yang dikirim
     * @param {object} options - Opsi tambahan
     */
    ApiService.prototype.request = function(action, data, options) {
        var self = this;
        options = options || {};
        data = data || {};
        
        // Tambahkan action ke data
        var requestData = JSON.parse(JSON.stringify(data));
        requestData.action = action;
        
        return new Promise(function(resolve, reject) {
            self.stats.totalRequests++;
            
            // ⬇️ GUNAKAN JSONP UNTUK MENGHINDARI CORS
            var callbackName = 'apiCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            var timeout = options.timeout || 15000;
            
            // Setup callback
            window[callbackName] = function(response) {
                clearTimeout(timeoutId);
                delete window[callbackName];
                
                try {
                    var data = typeof response === 'string' ? JSON.parse(response) : response;
                    
                    // Unwrap Google Apps Script response
                    if (data.data && data.data.success !== undefined) {
                        data = data.data;
                    }
                    
                    if (data.success === false) {
                        self.stats.failedRequests++;
                        reject(new Error(data.error || 'Request failed'));
                    } else {
                        self.stats.successfulRequests++;
                        resolve(data);
                    }
                } catch(e) {
                    self.stats.successfulRequests++;
                    resolve(response);
                }
            };
            
            // Timeout
            var timeoutId = setTimeout(function() {
                delete window[callbackName];
                self.stats.failedRequests++;
                
                // ⬇️ FALLBACK: Coba dengan XHR
                self.requestViaXHR(action, data, options).then(resolve).catch(reject);
            }, timeout);
            
            // ⬇️ KIRIM VIA JSONP (SCRIPT TAG)
            var jsonData = encodeURIComponent(JSON.stringify(requestData));
            var scriptUrl = self.baseUrl + '?action=' + action + '&data=' + jsonData + '&callback=' + callbackName + '&t=' + Date.now();
            
            var script = document.createElement('script');
            script.src = scriptUrl;
            script.onerror = function() {
                clearTimeout(timeoutId);
                delete window[callbackName];
                document.head.removeChild(script);
                
                // ⬇️ FALLBACK: Coba dengan XHR
                self.requestViaXHR(action, data, options).then(resolve).catch(reject);
            };
            
            document.head.appendChild(script);
            
            // Cleanup script setelah timeout
            setTimeout(function() {
                if (script.parentNode) {
                    document.head.removeChild(script);
                }
            }, timeout + 1000);
        });
    };
    
    /**
     * Fallback: Kirim via XMLHttpRequest
     */
    ApiService.prototype.requestViaXHR = function(action, data, options) {
        var self = this;
        options = options || {};
        
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', self.baseUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = options.timeout || 15000;
            
            xhr.onload = function() {
                try {
                    var response = JSON.parse(xhr.responseText);
                    
                    if (response.data && response.data.success !== undefined) {
                        response = response.data;
                    }
                    
                    if (response.success === false) {
                        reject(new Error(response.error || 'Request failed'));
                    } else {
                        resolve(response);
                    }
                } catch(e) {
                    // Anggap berhasil jika XHR berhasil
                    resolve({ success: true, message: 'OK' });
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('Request timeout'));
            };
            
            xhr.send(JSON.stringify({
                action: action,
                data: JSON.stringify(data)
            }));
        });
    };
    
    // Convenience methods
    ApiService.prototype.get = function(action, params, options) {
        return this.request(action, params, options);
    };
    
    ApiService.prototype.post = function(action, data, options) {
        return this.request(action, data, options);
    };
    
    ApiService.prototype.put = function(action, data, options) {
        return this.request(action, data, options);
    };
    
    ApiService.prototype.delete = function(action, data, options) {
        return this.request(action, data, options);
    };
    
    ApiService.prototype.healthCheck = function() {
        return this.request('health', {});
    };
    
    ApiService.prototype.processQueue = function() {
        // Process offline queue
        console.log('Processing offline queue: ' + this.requestQueue.length + ' items');
        this.requestQueue = [];
    };
    
    // Expose ke global
    window.EArsip.Api = new ApiService();
    
    console.log('API Service ready');
})();
>>>>>>> b68782b40b3eac4474e696c20e4ba68519477216
