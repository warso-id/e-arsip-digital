// js/performance.js - Performance Monitoring 2026
/**
 * E-Arsip Digital - Performance Monitor
 * Version: 2026.1.0
 * Features: Core Web Vitals, resource timing, navigation timing,
 *           memory monitoring, FPS tracking, long task detection
 */

import { Logger } from './logger.js';

class PerformanceMonitor {
    constructor() {
        this.logger = new Logger('Performance');
        
        this.config = {
            reportInterval: 30000,
            longTaskThreshold: 50,
            fpsThreshold: 30,
            enableMemoryMonitoring: true,
            enableResourceTiming: true,
            enableLongTaskDetection: true,
            sampleRate: 1.0
        };
        
        // Metrics storage
        this.metrics = {
            // Core Web Vitals
            LCP: null, // Largest Contentful Paint
            FID: null, // First Input Delay
            CLS: null, // Cumulative Layout Shift
            FCP: null, // First Contentful Paint
            TTFB: null, // Time to First Byte
            INP: null, // Interaction to Next Paint
            
            // Custom metrics
            pageLoadTime: null,
            domReady: null,
            firstPaint: null,
            
            // Resource timing
            resourceTimings: [],
            
            // Memory
            memorySnapshots: [],
            
            // FPS
            fpsHistory: [],
            currentFPS: 60,
            
            // Long tasks
            longTasks: [],
            
            // Navigation
            navigationType: null,
            redirectCount: 0
        };
        
        // Observers
        this.observers = {};
        
        // FPS tracking
        this.fpsFrames = 0;
        this.fpsLastTime = performance.now();
        this.fpsInterval = null;
        
        this.initialized = false;
        
        this.init();
    }
    
    async init() {
        if (!window.performance) {
            this.logger.warn('Performance API not available');
            return;
        }
        
        this.captureNavigationTiming();
        this.observeCoreWebVitals();
        
        if (this.config.enableResourceTiming) {
            this.observeResourceTiming();
        }
        
        if (this.config.enableLongTaskDetection) {
            this.observeLongTasks();
        }
        
        if (this.config.enableMemoryMonitoring) {
            this.startMemoryMonitoring();
        }
        
        this.startFPSTracking();
        this.setupReporting();
        
        this.initialized = true;
        
        this.logger.info('Performance monitor initialized', {
            navigationType: this.metrics.navigationType
        });
    }
    
    // ============================================
    // NAVIGATION TIMING
    // ============================================
    
    captureNavigationTiming() {
        const timing = performance.timing;
        const navigation = performance.getEntriesByType('navigation')[0];
        
        if (navigation) {
            this.metrics.navigationType = navigation.type;
            this.metrics.redirectCount = navigation.redirectCount;
            this.metrics.TTFB = navigation.responseStart - navigation.requestStart;
            this.metrics.domReady = navigation.domContentLoadedEventEnd - navigation.startTime;
            this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.startTime;
        }
        
        // Paint timing
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach(entry => {
            if (entry.name === 'first-paint') {
                this.metrics.firstPaint = entry.startTime;
            }
            if (entry.name === 'first-contentful-paint') {
                this.metrics.FCP = entry.startTime;
            }
        });
        
        this.logger.info('Navigation timing captured', {
            TTFB: this.metrics.TTFB,
            FCP: this.metrics.FCP,
            pageLoadTime: this.metrics.pageLoadTime
        });
    }
    
    // ============================================
    // CORE WEB VITALS
    // ============================================
    
    observeCoreWebVitals() {
        // LCP - Largest Contentful Paint
        if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
            this.observers.lcp = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.LCP = lastEntry.startTime;
                
                this.logger.debug('LCP updated', { LCP: lastEntry.startTime });
            });
            
            this.observers.lcp.observe({ type: 'largest-contentful-paint', buffered: true });
        }
        
        // FID - First Input Delay
        if (PerformanceObserver.supportedEntryTypes.includes('first-input')) {
            this.observers.fid = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    this.metrics.FID = entry.processingStart - entry.startTime;
                });
            });
            
            this.observers.fid.observe({ type: 'first-input', buffered: true });
        }
        
        // CLS - Cumulative Layout Shift
        if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
            let clsValue = 0;
            
            this.observers.cls = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                
                this.metrics.CLS = clsValue;
            });
            
            this.observers.cls.observe({ type: 'layout-shift', buffered: true });
        }
        
        // INP - Interaction to Next Paint
        if (PerformanceObserver.supportedEntryTypes.includes('event')) {
            this.observers.inp = new PerformanceObserver((list) => {
                let maxINP = 0;
                
                list.getEntries().forEach(entry => {
                    const duration = entry.processingEnd - entry.startTime;
                    if (duration > maxINP) maxINP = duration;
                });
                
                this.metrics.INP = maxINP;
            });
            
            this.observers.inp.observe({ type: 'event', buffered: true, durationThreshold: 16 });
        }
    }
    
    // ============================================
    // RESOURCE TIMING
    // ============================================
    
    observeResourceTiming() {
        if (!PerformanceObserver.supportedEntryTypes.includes('resource')) return;
        
        this.observers.resource = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            
            entries.forEach(entry => {
                this.metrics.resourceTimings.push({
                    name: entry.name,
                    type: entry.initiatorType,
                    duration: entry.duration,
                    size: entry.transferSize || 0,
                    timestamp: Date.now()
                });
            });
            
            // Keep only last 100 entries
            if (this.metrics.resourceTimings.length > 100) {
                this.metrics.resourceTimings = this.metrics.resourceTimings.slice(-100);
            }
            
            // Check for slow resources
            const slowResources = entries.filter(e => e.duration > 1000);
            if (slowResources.length > 0) {
                this.logger.warn('Slow resources detected', {
                    count: slowResources.length,
                    resources: slowResources.map(r => ({ name: r.name, duration: r.duration }))
                });
            }
        });
        
        this.observers.resource.observe({ type: 'resource', buffered: true });
    }
    
    // ============================================
    // LONG TASK DETECTION
    // ============================================
    
    observeLongTasks() {
        if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) {
            this.logger.info('Long task API not supported');
            return;
        }
        
        this.observers.longtask = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            
            entries.forEach(entry => {
                this.metrics.longTasks.push({
                    duration: entry.duration,
                    startTime: entry.startTime,
                    timestamp: Date.now(),
                    attribution: entry.attribution?.[0]
                });
                
                if (entry.duration > this.config.longTaskThreshold * 2) {
                    this.logger.warn('Very long task detected', {
                        duration: entry.duration,
                        attribution: entry.attribution?.[0]?.name
                    });
                }
            });
            
            // Keep only last 50 entries
            if (this.metrics.longTasks.length > 50) {
                this.metrics.longTasks = this.metrics.longTasks.slice(-50);
            }
        });
        
        this.observers.longtask.observe({ type: 'longtask', buffered: true });
    }
    
    // ============================================
    // MEMORY MONITORING
    // ============================================
    
    startMemoryMonitoring() {
        if (!performance.memory) {
            this.logger.info('Memory API not available');
            return;
        }
        
        this.memoryInterval = setInterval(() => {
            const memory = performance.memory;
            
            const snapshot = {
                timestamp: Date.now(),
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit,
                usagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
            };
            
            this.metrics.memorySnapshots.push(snapshot);
            
            // Keep only last 100 snapshots
            if (this.metrics.memorySnapshots.length > 100) {
                this.metrics.memorySnapshots = this.metrics.memorySnapshots.slice(-100);
            }
            
            // Warn if memory usage is high
            if (snapshot.usagePercent > 80) {
                this.logger.warn('High memory usage', {
                    used: this.formatBytes(snapshot.usedJSHeapSize),
                    total: this.formatBytes(snapshot.totalJSHeapSize),
                    percent: snapshot.usagePercent.toFixed(1) + '%'
                });
            }
        }, 10000);
    }
    
    // ============================================
    // FPS TRACKING
    // ============================================
    
    startFPSTracking() {
        this.fpsInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = now - this.fpsLastTime;
            
            if (elapsed >= 1000) {
                const fps = Math.round((this.fpsFrames * 1000) / elapsed);
                this.metrics.currentFPS = fps;
                this.metrics.fpsHistory.push({ timestamp: now, fps });
                
                // Keep only last 60 entries (1 minute)
                if (this.metrics.fpsHistory.length > 60) {
                    this.metrics.fpsHistory.shift();
                }
                
                if (fps < this.config.fpsThreshold) {
                    this.logger.warn('Low FPS detected', { fps });
                }
                
                this.fpsFrames = 0;
                this.fpsLastTime = now;
            }
        }, 1000);
        
        // Track frames
        const trackFrame = () => {
            this.fpsFrames++;
            requestAnimationFrame(trackFrame);
        };
        
        requestAnimationFrame(trackFrame);
    }
    
    // ============================================
    // REPORTING
    // ============================================
    
    setupReporting() {
        // Periodic report
        this.reportInterval = setInterval(() => {
            this.logPerformanceReport();
        }, this.config.reportInterval);
        
        // Report on page unload
        window.addEventListener('beforeunload', () => {
            this.logPerformanceReport();
        });
        
        // Report on visibility change (user returns)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.logPerformanceReport();
            }
        });
    }
    
    logPerformanceReport() {
        const report = this.getReport();
        
        this.logger.info('Performance report', {
            FCP: report.coreWebVitals.FCP,
            LCP: report.coreWebVitals.LCP,
            FID: report.coreWebVitals.FID,
            CLS: report.coreWebVitals.CLS,
            FPS: report.fps,
            memory: report.memory
        });
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getReport() {
        const cvw = this.getCoreWebVitals();
        
        return {
            timestamp: Date.now(),
            navigation: {
                type: this.metrics.navigationType,
                pageLoadTime: this.metrics.pageLoadTime,
                domReady: this.metrics.domReady,
                TTFB: this.metrics.TTFB,
                redirectCount: this.metrics.redirectCount
            },
            coreWebVitals: {
                LCP: this.metrics.LCP,
                FID: this.metrics.FID,
                CLS: this.metrics.CLS,
                FCP: this.metrics.FCP,
                INP: this.metrics.INP
            },
            rating: cvw,
            fps: this.metrics.currentFPS,
            memory: this.getMemoryInfo(),
            longTasks: {
                count: this.metrics.longTasks.length,
                average: this.getAverageLongTaskDuration(),
                recent: this.metrics.longTasks.slice(-5)
            },
            resources: {
                totalCount: this.metrics.resourceTimings.length,
                totalSize: this.getTotalResourceSize(),
                slowCount: this.metrics.resourceTimings.filter(r => r.duration > 1000).length
            }
        };
    }
    
    getCoreWebVitals() {
        const ratings = {};
        
        // LCP rating
        if (this.metrics.LCP !== null) {
            if (this.metrics.LCP <= 2500) ratings.LCP = 'good';
            else if (this.metrics.LCP <= 4000) ratings.LCP = 'needs-improvement';
            else ratings.LCP = 'poor';
        }
        
        // FID rating
        if (this.metrics.FID !== null) {
            if (this.metrics.FID <= 100) ratings.FID = 'good';
            else if (this.metrics.FID <= 300) ratings.FID = 'needs-improvement';
            else ratings.FID = 'poor';
        }
        
        // CLS rating
        if (this.metrics.CLS !== null) {
            if (this.metrics.CLS <= 0.1) ratings.CLS = 'good';
            else if (this.metrics.CLS <= 0.25) ratings.CLS = 'needs-improvement';
            else ratings.CLS = 'poor';
        }
        
        return ratings;
    }
    
    getMemoryInfo() {
        if (this.metrics.memorySnapshots.length === 0) return null;
        
        const latest = this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1];
        
        return {
            used: this.formatBytes(latest.usedJSHeapSize),
            total: this.formatBytes(latest.totalJSHeapSize),
            limit: this.formatBytes(latest.jsHeapSizeLimit),
            percent: latest.usagePercent.toFixed(1) + '%'
        };
    }
    
    getAverageLongTaskDuration() {
        if (this.metrics.longTasks.length === 0) return 0;
        
        const sum = this.metrics.longTasks.reduce((acc, t) => acc + t.duration, 0);
        return Math.round(sum / this.metrics.longTasks.length);
    }
    
    getTotalResourceSize() {
        return this.metrics.resourceTimings.reduce((acc, r) => acc + r.size, 0);
    }
    
    mark(name) {
        performance.mark(name);
    }
    
    measure(name, startMark, endMark) {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name, 'measure');
        return entries[entries.length - 1]?.duration || 0;
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    // ============================================
    // CLEANUP
    // ============================================
    
    destroy() {
        // Disconnect observers
        Object.values(this.observers).forEach(observer => observer.disconnect());
        
        // Clear intervals
        if (this.fpsInterval) clearInterval(this.fpsInterval);
        if (this.memoryInterval) clearInterval(this.memoryInterval);
        if (this.reportInterval) clearInterval(this.reportInterval);
        
        this.initialized = false;
        this.logger.info('Performance monitor destroyed');
    }
}

// Create singleton
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export { PerformanceMonitor };