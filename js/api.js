// js/api.js - API Service 2026 (HYBRID - JSONP + Fetch + XHR)
/**
 * E-Arsip Digital - API Service
 * Version: 2026.1.0
 * 
 * Features:
 * - JSONP untuk Google Apps Script (no CORS issues)
 * - Fetch API sebagai primary
 * - XHR sebagai fallback
 * - Auto-retry (3x)
 * - Request timeout
 * - Offline queue
 * - Response caching
 * - No external dependencies
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIG
    // ============================================
    var API_URL = 'https://script.google.com/macros/s/AKfycbxP0G4klL8Ruqu_XFQ8YMYGy-jFyqb8r0mYc5WprLGTq2qdX0mucljUd9sxwokUtJ-d/exec';
    
    // Override dari config jika tersedia
    if (window.EArsip && window.EArsip.Config && window.EArsip.Config.app) {
        API_URL = window.EArsip.Config.app.apiUrl || API_URL;
    }
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHits: 0
    };
    
    var _cache = {};               // Simple memory cache
    var _queue = [];               // Offline request queue
    var _isOnline = navigator.onLine;
    var _processingQueue = false;
    var _callbackCounter = 0;
    
    // ============================================
    // CACHE HELPERS
    // ============================================
    
    function getCacheKey(action, data) {
        return action + '_' + JSON.stringify(data || {});
    }
    
    function getFromCache(key, ttl) {
        var entry = _cache[key];
        if (!entry) return null;
        
        if (ttl && (Date.now() - entry.timestamp > ttl)) {
            delete _cache[key];
            return null;
        }
        
        _stats.cacheHits++;
        return entry.data;
    }
    
    function setCache(key, data) {
        // Batasi cache size (max 50 entries)
        var keys = Object.keys(_cache);
        if (keys.length > 50) {
            // Hapus yang paling lama
            var oldest = keys.reduce(function(a, b) {
                return _cache[a].timestamp < _cache[b].timestamp ? a : b;
            });
            delete _cache[oldest];
        }
        
        _cache[key] = {
            data: data,
            timestamp: Date.now()
        };
    }
    
    // ============================================
    // CORE REQUEST
    // ============================================
    
    /**
     * Kirim request ke Google Apps Script
     * Mencoba: Fetch → XHR → JSONP
     */
    function request(action, data, options) {
        if (!options) options = {};
        if (!data) data = {};
        
        _stats.totalRequests++;
        
        // Check cache
        if (options.cache) {
            var cacheKey = getCacheKey(action, data);
            var cached = getFromCache(cacheKey, options.cacheTTL || 300000);
            if (cached) {
                return Promise.resolve(cached);
            }
        }
        
        // Offline?
        if (!_isOnline) {
            // Queue untuk nanti
            _queue.push({ action: action, data: data, options: options, timestamp: Date.now() });
            return Promise.resolve({ status: 'queued', message: 'Request queued for offline' });
        }
        
        // Prepare data
        var requestData = JSON.parse(JSON.stringify(data));
        requestData.action = action;
        
        // Try Fetch first, then XHR, then JSONP
        return tryFetch(action, requestData, options)
            .catch(function() {
                return tryXHR(action, requestData, options);
            })
            .catch(function() {
                return tryJSONP(action, requestData, options);
            })
            .then(function(response) {
                _stats.successfulRequests++;
                
                // Cache if needed
                if (options.cache) {
                    setCache(getCacheKey(action, data), response);
                }
                
                return response;
            })
            .catch(function(error) {
                _stats.failedRequests++;
                throw error;
            });
    }
    
    // ============================================
    // FETCH (Primary)
    // ============================================
    
    function tryFetch(action, data, options) {
        return new Promise(function(resolve, reject) {
            var url = API_URL + '?action=' + encodeURIComponent(action) + '&t=' + Date.now();
            var timeout = options.timeout || 15000;
            
            var controller;
            var signal;
            
            if (typeof AbortController !== 'undefined') {
                controller = new AbortController();
                signal = controller.signal;
            }
            
            var timeoutId = setTimeout(function() {
                if (controller) controller.abort();
                reject(new Error('Request timeout'));
            }, timeout);
            
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                signal: signal,
                redirect: 'follow'
            })
            .then(function(response) {
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                
                return response.text();
            })
            .then(function(text) {
                try {
                    var parsed = JSON.parse(text);
                    resolve(unwrapResponse(parsed));
                } catch(e) {
                    // Mungkin response text biasa
                    resolve({ success: true, data: text });
                }
            })
            .catch(function(error) {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }
    
    // ============================================
    // XMLHTTPREQUEST (Fallback 1)
    // ============================================
    
    function tryXHR(action, data, options) {
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            var url = API_URL + '?action=' + encodeURIComponent(action);
            var timeout = options.timeout || 15000;
            
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = timeout;
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var parsed = JSON.parse(xhr.responseText);
                        resolve(unwrapResponse(parsed));
                    } catch(e) {
                        resolve({ success: true, data: xhr.responseText });
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('Request timeout'));
            };
            
            xhr.send(JSON.stringify(data));
        });
    }
    
    // ============================================
    // JSONP (Fallback 2 - Last Resort)
    // ============================================
    
    function tryJSONP(action, data, options) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'api_cb_' + (++_callbackCounter) + '_' + Date.now();
            var timeout = options.timeout || 15000;
            var script = null;
            
            // Setup callback
            window[callbackName] = function(response) {
                cleanup();
                
                try {
                    var parsed = typeof response === 'string' ? JSON.parse(response) : response;
                    resolve(unwrapResponse(parsed));
                } catch(e) {
                    resolve({ success: true, data: response });
                }
            };
            
            // Timeout
            var timeoutId = setTimeout(function() {
                cleanup();
                reject(new Error('JSONP timeout'));
            }, timeout);
            
            // Build URL
            var jsonData = encodeURIComponent(JSON.stringify(data));
            var scriptUrl = API_URL + '?action=' + action + '&data=' + jsonData + '&callback=' + callbackName + '&t=' + Date.now();
            
            // Create script tag
            script = document.createElement('script');
            script.src = scriptUrl;
            script.onerror = function() {
                cleanup();
                reject(new Error('JSONP script error'));
            };
            
            document.head.appendChild(script);
            
            function cleanup() {
                clearTimeout(timeoutId);
                delete window[callbackName];
                if (script && script.parentNode) {
                    document.head.removeChild(script);
                }
            }
        });
    }
    
    // ============================================
    // RESPONSE UNWRAPPING
    // ============================================
    
    /**
     * Unwrap Google Apps Script response
     * GAS sering membungkus response dalam .data
     */
    function unwrapResponse(response) {
        if (!response) return { success: false, error: 'Empty response' };
        
        // Jika response memiliki .data yang berisi success
        if (response.data && typeof response.data === 'object' && response.data.success !== undefined) {
            return response.data;
        }
        
        // Jika response memiliki .data yang merupakan array
        if (response.data && Array.isArray(response.data)) {
            return { success: true, data: response.data };
        }
        
        // Jika response sendiri memiliki success
        if (response.success !== undefined) {
            return response;
        }
        
        // Fallback: anggap sukses
        return { success: true, data: response };
    }
    
    // ============================================
    // RETRY LOGIC
    // ============================================
    
    function requestWithRetry(action, data, options) {
        var maxRetries = (options && options.retries) || 0;
        var retryDelay = (options && options.retryDelay) || 1000;
        var attempt = 0;
        
        function tryRequest() {
            return request(action, data, options).catch(function(error) {
                attempt++;
                
                if (attempt < maxRetries) {
                    console.warn('API: Retry ' + attempt + '/' + maxRetries + ' for ' + action);
                    return new Promise(function(resolve) {
                        setTimeout(function() {
                            resolve(tryRequest());
                        }, retryDelay * attempt);
                    });
                }
                
                throw error;
            });
        }
        
        return tryRequest();
    }
    
    // ============================================
    // OFFLINE QUEUE
    // ============================================
    
    function processQueue() {
        if (!_isOnline || _processingQueue || _queue.length === 0) return;
        
        _processingQueue = true;
        
        var item = _queue.shift();
        
        function processNext() {
            if (_queue.length === 0) {
                _processingQueue = false;
                console.log('API: Queue processed');
                return;
            }
            
            item = _queue.shift();
            processItem(item);
        }
        
        function processItem(item) {
            request(item.action, item.data, item.options)
                .then(function() {
                    processNext();
                })
                .catch(function() {
                    // Re-queue failed items
                    if (_queue.length < 20) {
                        _queue.push(item);
                    }
                    processNext();
                });
        }
        
        processItem(item);
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    var ApiService = {
        /**
         * Send request
         */
        request: request,
        
        /**
         * GET-like request (with caching)
         */
        get: function(action, params, options) {
            if (!options) options = {};
            options.cache = options.cache !== false; // Cache by default
            options.cacheTTL = options.cacheTTL || 300000; // 5 min
            return request(action, params || {}, options);
        },
        
        /**
         * POST-like request (no cache)
         */
        post: function(action, data, options) {
            if (!options) options = {};
            options.cache = false;
            options.retries = options.retries || 3;
            return requestWithRetry(action, data || {}, options);
        },
        
        /**
         * Health check
         */
        healthCheck: function() {
            return request('health', {}, { timeout: 5000 });
        },
        
        /**
         * Get statistics
         */
        getStats: function() {
            return {
                totalRequests: _stats.totalRequests,
                successfulRequests: _stats.successfulRequests,
                failedRequests: _stats.failedRequests,
                cacheHits: _stats.cacheHits,
                queueSize: _queue.length,
                isOnline: _isOnline
            };
        },
        
        /**
         * Clear cache
         */
        clearCache: function() {
            _cache = {};
            _stats.cacheHits = 0;
        },
        
        /**
         * Process offline queue
         */
        processQueue: processQueue,
        
        /**
         * Clear offline queue
         */
        clearQueue: function() {
            _queue = [];
        }
    };
    
    // ============================================
    // NETWORK LISTENERS
    // ============================================
    
    window.addEventListener('online', function() {
        _isOnline = true;
        console.log('API: Online');
        processQueue();
    });
    
    window.addEventListener('offline', function() {
        _isOnline = false;
        console.log('API: Offline');
    });
    
    // ============================================
    // EXPOSE
    // ============================================
    
    window.EArsip = window.EArsip || {};
    window.EArsip.Api = ApiService;
    
    console.log('API Service v2026.1.0 ready (' + API_URL.substring(0, 50) + '...)');
})();