// js/performance.js - Enterprise Performance Monitor 2026
/**
 * E-Arsip Digital - Advanced Performance Monitor
 * Version: 2026.1.0
 * Features: Core Web Vitals (LCP, FID, CLS, INP, TTFB), resource timing,
 *           memory monitoring, FPS tracking, long task detection,
 *           PWA metrics, network quality, remote reporting
 * Security: Data sanitization, privacy-aware metrics, secure reporting
 */

import APP_CONFIG from '../config/config.js';

class PerformanceMonitor {
    constructor(options = {}) {
        // ✅ FIX: Lazy load dependencies
        this.logger = null;
        
        // Configuration
        this.config = {
            reportInterval: 30000,
            longTaskThreshold: 50,
            fpsThreshold: 30,
            memoryWarningThreshold: 80,
            enableMemoryMonitoring: true,
            enableResourceTiming: true,
            enableLongTaskDetection: true,
            enableFPSTracking: true,
            enableRemoteReporting: false,
            remoteEndpoint: null,
            sampleRate: 1.0,
            maxStoredEntries: 100,
            privacyMode: true, // Sanitize URLs
            ...APP_CONFIG?.performance,
            ...options
        };
        
        // Metrics storage
        this.metrics = {
            // Core Web Vitals
            LCP: null,
            FID: null,
            CLS: null,
            FCP: null,
            TTFB: null,
            INP: null,
            TBT: null, // Total Blocking Time
            
            // Navigation
            pageLoadTime: null,
            domReady: null,
            firstPaint: null,
            navigationType: null,
            redirectCount: 0,
            
            // Resources
            resourceTimings: [],
            resourceErrors: [],
            
            // Memory
            memorySnapshots: [],
            peakMemoryUsage: 0,
            
            // FPS
            fpsHistory: [],
            currentFPS: 60,
            minFPS: 60,
            avgFPS: 60,
            
            // Long tasks
            longTasks: [],
            totalBlockingTime: 0,
            
            // Network
            networkRequests: [],
            
            // Custom
            customMarks: {},
            customMeasures: {},
            
            // PWA
            serviceWorkerTiming: null,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Observers registry
        this.observers = {};
        
        // Timers registry
        this.timers = {};
        
        // FPS tracking
        this.fpsState = {
            frames: 0,
            lastTime: performance.now(),
            isTracking: false,
            rafId: null
        };
        
        // State
        this.initialized = false;
        this.isReporting = false;
        this.lastReportTime = null;
        
        // Privacy filter
        this.sensitiveParams = [
            'token', 'key', 'secret', 'password', 'auth',
            'session', 'credential', 'api_key', 'access_token'
        ];
        
        this.init();
    }
    
    async init() {
        try {
            // Init logger
            await this.initLogger();
            
            // Check if performance API is available
            if (!window.performance) {
                this.log('warn', 'Performance API not available');
                return;
            }
            
            // Apply sample rate
            if (Math.random() > this.config.sampleRate) {
                this.log('info', 'Performance monitoring disabled by sample rate');
                return;
            }
            
            // Capture initial metrics
            this.captureNavigationTiming();
            
            // Setup observers
            await this.setupObservers();
            
            // Start monitoring
            if (this.config.enableFPSTracking) {
                this.startFPSTracking();
            }
            
            if (this.config.enableMemoryMonitoring) {
                this.startMemoryMonitoring();
            }
            
            // Setup reporting
            this.setupReporting();
            
            // Mark as initialized
            this.initialized = true;
            
            this.log('info', 'Performance monitor initialized', {
                navigationType: this.getNavigationTypeName(),
                sampleRate: this.config.sampleRate
            });
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('performance:ready', {
                detail: { monitor: this }
            }));
            
        } catch (error) {
            console.error('Failed to initialize performance monitor:', error);
        }
    }
    
    async initLogger() {
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Performance');
        } catch {
            this.logger = {
                debug: console.debug.bind(console, '[Performance]'),
                info: console.info.bind(console, '[Performance]'),
                warn: console.warn.bind(console, '[Performance]'),
                error: console.error.bind(console, '[Performance]')
            };
        }
    }
    
    log(level, message, data = null) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // OBSERVER SETUP
    // ============================================
    
    async setupObservers() {
        // Wait for page to be interactive
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        
        this.observeCoreWebVitals();
        
        if (this.config.enableResourceTiming) {
            this.observeResourceTiming();
        }
        
        if (this.config.enableLongTaskDetection) {
            this.observeLongTasks();
        }
        
        this.observePaintTiming();
        this.observeNavigationTiming();
    }
    
    // ============================================
    // NAVIGATION TIMING
    // ============================================
    
    captureNavigationTiming() {
        try {
            // Use Navigation Timing API v2
            const navigation = performance.getEntriesByType('navigation')[0];
            
            if (navigation) {
                this.metrics.navigationType = navigation.type;
                this.metrics.redirectCount = navigation.redirectCount || 0;
                this.metrics.TTFB = navigation.responseStart - navigation.requestStart;
                this.metrics.domReady = navigation.domContentLoadedEventEnd - navigation.startTime;
                this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.startTime;
                
                // Additional timing
                this.metrics.dnsTime = navigation.domainLookupEnd - navigation.domainLookupStart;
                this.metrics.tcpTime = navigation.connectEnd - navigation.connectStart;
                this.metrics.sslTime = navigation.connectEnd - navigation.secureConnectionStart;
                this.metrics.requestTime = navigation.responseStart - navigation.requestStart;
                this.metrics.responseTime = navigation.responseEnd - navigation.responseStart;
                this.metrics.domProcessingTime = navigation.domComplete - navigation.domInteractive;
            }
            
            // Fallback to Performance Timing API v1
            if (!navigation && performance.timing) {
                const timing = performance.timing;
                this.metrics.TTFB = timing.responseStart - timing.requestStart;
                this.metrics.domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
                this.metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
            }
            
            this.log('debug', 'Navigation timing captured', {
                TTFB: `${this.metrics.TTFB?.toFixed(0)}ms`,
                FCP: `${this.metrics.FCP?.toFixed(0)}ms`,
                pageLoadTime: `${this.metrics.pageLoadTime?.toFixed(0)}ms`
            });
            
        } catch (error) {
            this.log('warn', 'Failed to capture navigation timing', {
                error: error.message
            });
        }
    }
    
    observeNavigationTiming() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('navigation')) {
                this.observers.navigation = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length > 0) {
                        this.captureNavigationTiming();
                    }
                });
                
                this.observers.navigation.observe({ 
                    type: 'navigation', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'Navigation observer not supported');
        }
    }
    
    observePaintTiming() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
                this.observers.paint = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        if (entry.name === 'first-paint') {
                            this.metrics.firstPaint = entry.startTime;
                        }
                        if (entry.name === 'first-contentful-paint') {
                            this.metrics.FCP = entry.startTime;
                        }
                    });
                });
                
                this.observers.paint.observe({ 
                    type: 'paint', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'Paint observer not supported');
        }
    }
    
    // ============================================
    // CORE WEB VITALS (dengan error handling)
    // ============================================
    
    observeCoreWebVitals() {
        // LCP - Largest Contentful Paint
        this.observeLCP();
        
        // FID - First Input Delay
        this.observeFID();
        
        // CLS - Cumulative Layout Shift
        this.observeCLS();
        
        // INP - Interaction to Next Paint
        this.observeINP();
    }
    
    observeLCP() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
                this.observers.lcp = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    
                    if (lastEntry) {
                        this.metrics.LCP = lastEntry.startTime;
                        this.metrics.LCPElement = this.sanitizeElement(lastEntry.element);
                        
                        this.log('debug', 'LCP updated', {
                            LCP: `${lastEntry.startTime.toFixed(0)}ms`,
                            element: this.metrics.LCPElement
                        });
                    }
                });
                
                this.observers.lcp.observe({ 
                    type: 'largest-contentful-paint', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'LCP observer not supported');
        }
    }
    
    observeFID() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('first-input')) {
                this.observers.fid = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.metrics.FID = entry.processingStart - entry.startTime;
                        this.metrics.FIDTarget = this.sanitizeElement(entry.target);
                        this.metrics.FIDName = entry.name;
                    });
                });
                
                this.observers.fid.observe({ 
                    type: 'first-input', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'FID observer not supported');
        }
    }
    
    observeCLS() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
                let clsValue = 0;
                let clsEntries = 0;
                
                this.observers.cls = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        // Only count layout shifts without recent input
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                            clsEntries++;
                        }
                    });
                    
                    this.metrics.CLS = clsValue;
                    this.metrics.CLSEntries = clsEntries;
                });
                
                this.observers.cls.observe({ 
                    type: 'layout-shift', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'CLS observer not supported');
        }
    }
    
    observeINP() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('event')) {
                let interactions = [];
                
                this.observers.inp = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        const duration = entry.processingEnd - entry.startTime;
                        interactions.push({
                            duration,
                            type: entry.name,
                            target: this.sanitizeElement(entry.target),
                            timestamp: entry.startTime
                        });
                        
                        // Keep last 20 interactions
                        if (interactions.length > 20) {
                            interactions = interactions.slice(-20);
                        }
                    });
                    
                    // INP is the maximum interaction duration
                    if (interactions.length > 0) {
                        this.metrics.INP = Math.max(...interactions.map(i => i.duration));
                        this.metrics.interactions = interactions;
                    }
                });
                
                this.observers.inp.observe({ 
                    type: 'event', 
                    buffered: true, 
                    durationThreshold: 16 
                });
            }
        } catch (error) {
            this.log('debug', 'INP observer not supported');
        }
    }
    
    // ============================================
    // RESOURCE TIMING (dengan privacy filter)
    // ============================================
    
    observeResourceTiming() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('resource')) {
                this.observers.resource = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    
                    entries.forEach(entry => {
                        const timing = {
                            name: this.config.privacyMode ? 
                                this.sanitizeURL(entry.name) : entry.name,
                            type: entry.initiatorType,
                            duration: Math.round(entry.duration * 100) / 100,
                            size: entry.transferSize || 0,
                            encodedSize: entry.encodedBodySize || 0,
                            decodedSize: entry.decodedBodySize || 0,
                            timestamp: Date.now(),
                            isCache: entry.transferSize === 0 && entry.decodedBodySize > 0
                        };
                        
                        this.metrics.resourceTimings.push(timing);
                        
                        // Track cache hits/misses
                        if (timing.isCache) {
                            this.metrics.cacheHits++;
                        } else if (entry.transferSize > 0) {
                            this.metrics.cacheMisses++;
                        }
                        
                        // Track errors
                        if (entry.transferSize === 0 && entry.decodedBodySize === 0 && 
                            entry.duration > 0 && entry.initiatorType !== 'fetch') {
                            this.metrics.resourceErrors.push({
                                name: timing.name,
                                type: timing.type,
                                timestamp: timing.timestamp
                            });
                        }
                    });
                    
                    // Trim to max stored
                    if (this.metrics.resourceTimings.length > this.config.maxStoredEntries) {
                        this.metrics.resourceTimings = 
                            this.metrics.resourceTimings.slice(-this.config.maxStoredEntries);
                    }
                    
                    // Check for slow resources
                    const slowResources = entries.filter(e => e.duration > 1000);
                    if (slowResources.length > 0) {
                        this.log('warn', 'Slow resources detected', {
                            count: slowResources.length,
                            slowest: Math.max(...slowResources.map(r => r.duration)).toFixed(0) + 'ms'
                        });
                    }
                });
                
                this.observers.resource.observe({ 
                    type: 'resource', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'Resource observer not supported');
        }
    }
    
    // ============================================
    // LONG TASK DETECTION (dengan TBT calculation)
    // ============================================
    
    observeLongTasks() {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
                this.observers.longtask = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    
                    entries.forEach(entry => {
                        const blockingTime = entry.duration - 50; // Time above 50ms
                        
                        const task = {
                            duration: entry.duration,
                            blockingTime: Math.max(0, blockingTime),
                            startTime: entry.startTime,
                            timestamp: Date.now(),
                            attribution: entry.attribution?.[0] ? {
                                name: entry.attribution[0].name,
                                containerType: entry.attribution[0].containerType,
                                containerName: this.sanitizeElement(
                                    entry.attribution[0].containerName
                                )
                            } : null
                        };
                        
                        this.metrics.longTasks.push(task);
                        this.metrics.totalBlockingTime += task.blockingTime;
                        
                        // Alert for very long tasks
                        if (entry.duration > this.config.longTaskThreshold * 4) {
                            this.log('warn', 'Very long task detected', {
                                duration: `${entry.duration.toFixed(0)}ms`,
                                attribution: task.attribution?.name || 'unknown'
                            });
                        }
                    });
                    
                    // Trim
                    if (this.metrics.longTasks.length > this.config.maxStoredEntries) {
                        this.metrics.longTasks = 
                            this.metrics.longTasks.slice(-this.config.maxStoredEntries);
                    }
                    
                    // Update TBT
                    this.metrics.TBT = this.metrics.totalBlockingTime;
                });
                
                this.observers.longtask.observe({ 
                    type: 'longtask', 
                    buffered: true 
                });
            }
        } catch (error) {
            this.log('debug', 'Long task observer not supported');
        }
    }
    
    // ============================================
    // MEMORY MONITORING (dengan peak tracking)
    // ============================================
    
    startMemoryMonitoring() {
        if (!performance.memory) {
            this.log('info', 'Memory API not available (requires Chrome)');
            return;
        }
        
        this.timers.memory = setInterval(() => {
            try {
                const memory = performance.memory;
                
                const snapshot = {
                    timestamp: Date.now(),
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit,
                    usagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
                };
                
                this.metrics.memorySnapshots.push(snapshot);
                
                // Track peak
                if (snapshot.usedJSHeapSize > this.metrics.peakMemoryUsage) {
                    this.metrics.peakMemoryUsage = snapshot.usedJSHeapSize;
                }
                
                // Trim
                if (this.metrics.memorySnapshots.length > this.config.maxStoredEntries) {
                    this.metrics.memorySnapshots = 
                        this.metrics.memorySnapshots.slice(-this.config.maxStoredEntries);
                }
                
                // Warn if memory usage is high
                if (snapshot.usagePercent > this.config.memoryWarningThreshold) {
                    this.log('warn', 'High memory usage', {
                        used: this.formatBytes(snapshot.usedJSHeapSize),
                        total: this.formatBytes(snapshot.totalJSHeapSize),
                        percent: snapshot.usagePercent.toFixed(1) + '%',
                        peak: this.formatBytes(this.metrics.peakMemoryUsage)
                    });
                }
            } catch (error) {
                // Memory API might throw in some contexts
            }
        }, 10000);
    }
    
    // ============================================
    // FPS TRACKING (optimized)
    // ============================================
    
    startFPSTracking() {
        if (this.fpsState.isTracking) return;
        
        this.fpsState.isTracking = true;
        this.fpsState.frames = 0;
        this.fpsState.lastTime = performance.now();
        
        // FPS calculation interval
        this.timers.fps = setInterval(() => {
            const now = performance.now();
            const elapsed = now - this.fpsState.lastTime;
            
            if (elapsed >= 1000) {
                const fps = Math.round((this.fpsState.frames * 1000) / elapsed);
                this.metrics.currentFPS = fps;
                
                // Update min/avg
                if (fps < this.metrics.minFPS) {
                    this.metrics.minFPS = fps;
                }
                
                // Calculate rolling average
                this.metrics.fpsHistory.push({ timestamp: now, fps });
                
                if (this.metrics.fpsHistory.length > 60) {
                    this.metrics.fpsHistory.shift();
                }
                
                const avgFPS = this.metrics.fpsHistory.reduce((sum, f) => sum + f.fps, 0) / 
                              this.metrics.fpsHistory.length;
                this.metrics.avgFPS = Math.round(avgFPS);
                
                // Alert for low FPS
                if (fps < this.config.fpsThreshold) {
                    this.log('warn', 'Low FPS detected', { 
                        fps,
                        avg: this.metrics.avgFPS,
                        min: this.metrics.minFPS
                    });
                }
                
                this.fpsState.frames = 0;
                this.fpsState.lastTime = now;
            }
        }, 1000);
        
        // Frame counter
        const countFrame = () => {
            if (!this.fpsState.isTracking) return;
            this.fpsState.frames++;
            this.fpsState.rafId = requestAnimationFrame(countFrame);
        };
        
        this.fpsState.rafId = requestAnimationFrame(countFrame);
    }
    
    stopFPSTracking() {
        this.fpsState.isTracking = false;
        
        if (this.fpsState.rafId) {
            cancelAnimationFrame(this.fpsState.rafId);
            this.fpsState.rafId = null;
        }
        
        if (this.timers.fps) {
            clearInterval(this.timers.fps);
            this.timers.fps = null;
        }
    }
    
    // ============================================
    // REPORTING (dengan remote support)
    // ============================================
    
    setupReporting() {
        // Periodic report
        this.timers.report = setInterval(() => {
            this.generateReport();
        }, this.config.reportInterval);
        
        // Report on page hide (more reliable than beforeunload)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.generateReport();
            }
        });
        
        // Report on page unload
        window.addEventListener('pagehide', () => {
            this.generateReport(true); // Use keepalive
        });
        
        // Report on PWA background
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.addEventListener('updatefound', () => {
                    this.log('info', 'Service Worker update found, reporting current metrics');
                    this.generateReport();
                });
            });
        }
    }
    
    async generateReport(useKeepalive = false) {
        if (this.isReporting) return;
        
        this.isReporting = true;
        
        try {
            const report = this.getReport();
            
            // Log local report
            this.log('info', 'Performance report', {
                FCP: report.coreWebVitals.FCP?.toFixed(0) + 'ms',
                LCP: report.coreWebVitals.LCP?.toFixed(0) + 'ms',
                TTFB: report.navigation.TTFB?.toFixed(0) + 'ms',
                FPS: report.fps.current,
                memory: report.memory?.percent || 'N/A',
                rating: Object.entries(report.rating)
                    .map(([metric, rating]) => `${metric}:${rating}`)
                    .join(', ')
            });
            
            // Remote reporting
            if (this.config.enableRemoteReporting && this.config.remoteEndpoint) {
                await this.sendRemoteReport(report, useKeepalive);
            }
            
            // Store last report
            this.lastReportTime = Date.now();
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('performance:report', {
                detail: { report }
            }));
            
        } catch (error) {
            this.log('error', 'Failed to generate report', {
                error: error.message
            });
        } finally {
            this.isReporting = false;
        }
    }
    
    async sendRemoteReport(report, useKeepalive = false) {
        try {
            const response = await fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Report-Type': 'performance'
                },
                body: JSON.stringify({
                    report,
                    timestamp: Date.now(),
                    version: APP_CONFIG.app?.version || '2026.1.0',
                    userAgent: navigator.userAgent.substring(0, 200),
                    isPWA: this.isPWA()
                }),
                keepalive: useKeepalive
            });
            
            if (!response.ok) {
                this.log('warn', 'Failed to send remote report', {
                    status: response.status
                });
            }
        } catch (error) {
            this.log('debug', 'Remote reporting failed', {
                error: error.message
            });
        }
    }
    
    // ============================================
    // METRICS RATING
    // ============================================
    
    rateMetric(metric, value) {
        if (value === null || value === undefined) return 'unknown';
        
        const thresholds = {
            LCP: { good: 2500, poor: 4000 },
            FID: { good: 100, poor: 300 },
            CLS: { good: 0.1, poor: 0.25 },
            FCP: { good: 1800, poor: 3000 },
            TTFB: { good: 800, poor: 1800 },
            INP: { good: 200, poor: 500 },
            TBT: { good: 200, poor: 600 }
        };
        
        const threshold = thresholds[metric];
        if (!threshold) return 'unknown';
        
        if (value <= threshold.good) return 'good';
        if (value <= threshold.poor) return 'needs-improvement';
        return 'poor';
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getReport() {
        const cvw = this.getCoreWebVitals();
        
        return {
            timestamp: Date.now(),
            
            navigation: {
                type: this.getNavigationTypeName(),
                pageLoadTime: this.metrics.pageLoadTime,
                domReady: this.metrics.domReady,
                TTFB: this.metrics.TTFB,
                redirectCount: this.metrics.redirectCount,
                dnsTime: this.metrics.dnsTime,
                tcpTime: this.metrics.tcpTime,
                sslTime: this.metrics.sslTime
            },
            
            coreWebVitals: {
                LCP: this.metrics.LCP,
                FID: this.metrics.FID,
                CLS: this.metrics.CLS,
                FCP: this.metrics.FCP,
                INP: this.metrics.INP,
                TBT: this.metrics.TBT
            },
            
            rating: {
                LCP: this.rateMetric('LCP', this.metrics.LCP),
                FID: this.rateMetric('FID', this.metrics.FID),
                CLS: this.rateMetric('CLS', this.metrics.CLS),
                FCP: this.rateMetric('FCP', this.metrics.FCP),
                TTFB: this.rateMetric('TTFB', this.metrics.TTFB),
                INP: this.rateMetric('INP', this.metrics.INP)
            },
            
            fps: {
                current: this.metrics.currentFPS,
                average: this.metrics.avgFPS,
                minimum: this.metrics.minFPS,
                history: this.metrics.fpsHistory.slice(-10)
            },
            
            memory: this.getMemoryInfo(),
            
            longTasks: {
                count: this.metrics.longTasks.length,
                average: this.getAverageLongTaskDuration(),
                max: Math.max(...this.metrics.longTasks.map(t => t.duration), 0),
                totalBlockingTime: this.metrics.TBT,
                recent: this.metrics.longTasks.slice(-5)
            },
            
            resources: {
                totalCount: this.metrics.resourceTimings.length,
                totalSize: this.getTotalResourceSize(),
                totalSizeFormatted: this.formatBytes(this.getTotalResourceSize()),
                slowCount: this.metrics.resourceTimings.filter(r => r.duration > 1000).length,
                errors: this.metrics.resourceErrors.length,
                cacheHits: this.metrics.cacheHits,
                cacheMisses: this.metrics.cacheMisses,
                cacheHitRate: this.getCacheHitRate()
            },
            
            pwa: this.getPWAMetrics(),
            
            custom: {
                marks: Object.keys(this.metrics.customMarks).length,
                measures: Object.keys(this.metrics.customMeasures).length
            }
        };
    }
    
    getCoreWebVitals() {
        return {
            LCP: this.metrics.LCP,
            FID: this.metrics.FID,
            CLS: this.metrics.CLS,
            FCP: this.metrics.FCP,
            TTFB: this.metrics.TTFB,
            INP: this.metrics.INP,
            TBT: this.metrics.TBT
        };
    }
    
    getMemoryInfo() {
        if (this.metrics.memorySnapshots.length === 0) return null;
        
        const latest = this.metrics.memorySnapshots[
            this.metrics.memorySnapshots.length - 1
        ];
        
        return {
            used: this.formatBytes(latest.usedJSHeapSize),
            total: this.formatBytes(latest.totalJSHeapSize),
            limit: this.formatBytes(latest.jsHeapSizeLimit),
            percent: latest.usagePercent.toFixed(1) + '%',
            peak: this.formatBytes(this.metrics.peakMemoryUsage),
            trend: this.calculateMemoryTrend()
        };
    }
    
    getPWAMetrics() {
        return {
            isPWA: this.isPWA(),
            serviceWorker: !!navigator.serviceWorker?.controller,
            cacheHitRate: this.getCacheHitRate(),
            networkType: this.getConnectionType()
        };
    }
    
    getCacheHitRate() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        if (total === 0) return 'N/A';
        return ((this.metrics.cacheHits / total) * 100).toFixed(1) + '%';
    }
    
    getAverageLongTaskDuration() {
        if (this.metrics.longTasks.length === 0) return 0;
        const sum = this.metrics.longTasks.reduce((acc, t) => acc + t.duration, 0);
        return Math.round(sum / this.metrics.longTasks.length);
    }
    
    getTotalResourceSize() {
        return this.metrics.resourceTimings.reduce((acc, r) => acc + r.size, 0);
    }
    
    calculateMemoryTrend() {
        const snapshots = this.metrics.memorySnapshots;
        if (snapshots.length < 2) return 'stable';
        
        const recent = snapshots.slice(-5);
        const first = recent[0].usedJSHeapSize;
        const last = recent[recent.length - 1].usedJSHeapSize;
        
        const change = ((last - first) / first) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }
    
    getNavigationTypeName() {
        const types = ['navigate', 'reload', 'back_forward', 'prerender'];
        return types[this.metrics.navigationType] || 'unknown';
    }
    
    getConnectionType() {
        if ('connection' in navigator) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return { effectiveType: 'unknown' };
    }
    
    // Custom timing
    mark(name) {
        try {
            performance.mark(name);
            this.metrics.customMarks[name] = performance.now();
        } catch (error) {
            this.log('warn', 'Failed to create mark', { name, error: error.message });
        }
    }
    
    measure(name, startMark, endMark) {
        try {
            performance.measure(name, startMark, endMark);
            const entries = performance.getEntriesByName(name, 'measure');
            const duration = entries[entries.length - 1]?.duration || 0;
            this.metrics.customMeasures[name] = duration;
            return duration;
        } catch (error) {
            this.log('warn', 'Failed to create measure', { name, error: error.message });
            return 0;
        }
    }
    
    // ============================================
    // SANITIZATION & PRIVACY
    // ============================================
    
    sanitizeURL(url) {
        if (!url) return '';
        
        try {
            const urlObj = new URL(url);
            
            // Remove sensitive query parameters
            this.sensitiveParams.forEach(param => {
                if (urlObj.searchParams.has(param)) {
                    urlObj.searchParams.set(param, '[REDACTED]');
                }
            });
            
            // Shorten long paths
            if (urlObj.pathname.length > 100) {
                urlObj.pathname = urlObj.pathname.substring(0, 97) + '...';
            }
            
            return urlObj.toString();
        } catch {
            // If not a valid URL, return as-is (already sanitized by path-utils)
            return url;
        }
    }
    
    sanitizeElement(element) {
        if (!element) return null;
        
        try {
            const tag = element.tagName?.toLowerCase() || 'unknown';
            const id = element.id ? `#${element.id}` : '';
            const className = element.className && typeof element.className === 'string' 
                ? `.${element.className.split(' ')[0]}` : '';
            
            return `${tag}${id}${className}`;
        } catch {
            return 'unknown';
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        // Disconnect observers
        Object.values(this.observers).forEach(observer => {
            try {
                observer.disconnect();
            } catch {}
        });
        
        // Clear timers
        Object.values(this.timers).forEach(timer => {
            try {
                clearInterval(timer);
            } catch {}
        });
        
        // Stop FPS tracking
        this.stopFPSTracking();
        
        // Clear state
        this.observers = {};
        this.timers = {};
        this.initialized = false;
        
        this.log('info', 'Performance monitor destroyed');
    }
}

// Create singleton
let performanceMonitor;

try {
    performanceMonitor = new PerformanceMonitor();
} catch (error) {
    console.error('Failed to create performance monitor:', error);
    
    // Create minimal fallback
    performanceMonitor = {
        getReport: () => ({ error: 'Performance monitor failed to initialize' }),
        mark: () => {},
        measure: () => 0,
        destroy: () => {}
    };
}

export default performanceMonitor;
export { PerformanceMonitor };