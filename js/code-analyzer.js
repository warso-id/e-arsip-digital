// js/code-analyzer.js - Code Quality Analyzer 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Code Quality Analyzer
 * Version: 2026.1.0
 * 
 * HANYA UNTUK DEVELOPMENT!
 * Jangan deploy ke production.
 * 
 * Fitur:
 * - Resource counting (scripts, styles)
 * - Module tracking
 * - Performance monitoring
 * - Lightweight (no DOM traversal)
 */

var CodeAnalyzer = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        enabled: false,              // DISABLED by default
        trackPerformance: true,
        maxErrors: 50,
        slowResourceThreshold: 1000 // 1 detik
    };
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _metrics = {
        totalScripts: 0,
        totalStyles: 0,
        totalModules: 0,
        loadedModules: [],
        loadTimes: {},
        errors: []
    };
    
    var _originalConsoleError = null;
    var _initialized = false;
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    // ============================================
    // RESOURCE ANALYSIS (LIGHTWEIGHT)
    // ============================================
    
    function analyzeResources() {
        // Count scripts (hanya yang punya src)
        var scripts = document.getElementsByTagName('script');
        var scriptCount = 0;
        var moduleCount = 0;
        var modules = [];
        
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src) {
                scriptCount++;
                if (scripts[i].type === 'module') {
                    moduleCount++;
                    modules.push(scripts[i].src);
                }
            }
        }
        
        // Count styles
        var styles = document.getElementsByTagName('link');
        var styleCount = 0;
        
        for (var j = 0; j < styles.length; j++) {
            if (styles[j].rel === 'stylesheet') {
                styleCount++;
            }
        }
        
        _metrics.totalScripts = scriptCount;
        _metrics.totalStyles = styleCount;
        _metrics.totalModules = moduleCount;
        _metrics.loadedModules = modules;
    }
    
    // ============================================
    // PERFORMANCE MONITORING
    // ============================================
    
    function analyzePerformance() {
        if (!window.performance || !window.performance.getEntriesByType) {
            return;
        }
        
        try {
            var resources = window.performance.getEntriesByType('resource');
            var loadTimes = {};
            
            for (var i = 0; i < resources.length; i++) {
                var res = resources[i];
                if (res.name.indexOf('/js/') !== -1 || res.name.indexOf('/css/') !== -1) {
                    loadTimes[res.name] = res.duration;
                }
            }
            
            _metrics.loadTimes = loadTimes;
        } catch(e) {
            // Performance API tidak tersedia
        }
    }
    
    // ============================================
    // ERROR TRACKING (NON-INVASIVE)
    // ============================================
    
    function setupErrorTracking() {
        // Gunakan window.onerror, BUKAN override console.error
        var originalOnError = window.onerror;
        
        window.onerror = function(message, source, lineno, colno, error) {
            // Catat error
            _metrics.errors.push({
                message: String(message).substring(0, 200),
                source: source ? source.substring(0, 100) : '',
                line: lineno,
                timestamp: Date.now()
            });
            
            // Batasi jumlah error
            if (_metrics.errors.length > config.maxErrors) {
                _metrics.errors = _metrics.errors.slice(-config.maxErrors);
            }
            
            // Panggil handler original
            if (originalOnError) {
                return originalOnError.apply(this, arguments);
            }
            
            return false;
        };
    }
    
    function restoreErrorTracking() {
        if (_originalConsoleError) {
            console.error = _originalConsoleError;
            _originalConsoleError = null;
        }
    }
    
    // ============================================
    // METRICS CALCULATION
    // ============================================
    
    function getAverageLoadTime() {
        var total = 0;
        var count = 0;
        
        for (var key in _metrics.loadTimes) {
            if (_metrics.loadTimes.hasOwnProperty(key)) {
                total += _metrics.loadTimes[key];
                count++;
            }
        }
        
        return count > 0 ? Math.round(total / count) : 0;
    }
    
    function getSlowResources() {
        var slow = [];
        var threshold = config.slowResourceThreshold;
        
        for (var name in _metrics.loadTimes) {
            if (_metrics.loadTimes.hasOwnProperty(name)) {
                if (_metrics.loadTimes[name] > threshold) {
                    slow.push({ name: name, duration: _metrics.loadTimes[name] });
                }
            }
        }
        
        // Sort descending
        slow.sort(function(a, b) {
            return b.duration - a.duration;
        });
        
        return slow;
    }
    
    function estimateLocalStorageSize() {
        var totalSize = 0;
        
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key) {
                    var value = localStorage.getItem(key);
                    totalSize += (key.length + (value ? value.length : 0)) * 2;
                }
            }
        } catch(e) {}
        
        return totalSize;
    }
    
    // ============================================
    // REPORT
    // ============================================
    
    function generateReport() {
        analyzeResources();
        analyzePerformance();
        
        return {
            timestamp: new Date().toISOString(),
            resources: {
                scripts: _metrics.totalScripts,
                styles: _metrics.totalStyles,
                modules: _metrics.totalModules,
                loadedModules: _metrics.loadedModules.slice(0, 10)
            },
            performance: {
                averageLoadTime: getAverageLoadTime(),
                slowResources: getSlowResources().slice(0, 5),
                errors: _metrics.errors.length
            },
            storage: {
                localStorageSize: formatBytes(estimateLocalStorageSize())
            }
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    function init(options) {
        if (_initialized) return;
        
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = options[key];
                }
            }
        }
        
        if (!config.enabled) {
            console.info('[CodeAnalyzer] Disabled (development only tool)');
            return;
        }
        
        analyzeResources();
        analyzePerformance();
        setupErrorTracking();
        
        _initialized = true;
        
        console.info('[CodeAnalyzer] Initialized (' + _metrics.totalScripts + ' scripts, ' + 
            _metrics.totalStyles + ' styles, ' + _metrics.totalModules + ' modules)');
    }
    
    function getMetrics() {
        return {
            scripts: _metrics.totalScripts,
            styles: _metrics.totalStyles,
            modules: _metrics.totalModules,
            errors: _metrics.errors.length,
            averageLoadTime: getAverageLoadTime()
        };
    }
    
    function getErrors() {
        return _metrics.errors.slice(-20);
    }
    
    function destroy() {
        restoreErrorTracking();
        _metrics.loadedModules = [];
        _metrics.loadTimes = {};
        _metrics.errors = [];
        _initialized = false;
    }
    
    return {
        init: init,
        generateReport: generateReport,
        getMetrics: getMetrics,
        getErrors: getErrors,
        destroy: destroy,
        
        /**
         * Enable/disable
         */
        enable: function() {
            config.enabled = true;
            if (!_initialized) init();
        },
        disable: function() {
            config.enabled = false;
        }
    };
})();

// ============================================
// AUTO-INIT HANYA JIKA DIPERLUKAN
// ============================================
// CodeAnalyzer.init({ enabled: false }); // Disabled by default

// ============================================
// USAGE (Development only):
// ============================================
// CodeAnalyzer.init({ enabled: true });
// var report = CodeAnalyzer.generateReport();
// console.log(report);
// ============================================