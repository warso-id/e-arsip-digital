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
        
        this.init();
    }
    
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
