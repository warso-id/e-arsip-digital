// js/code-analyzer.js - Code Quality Analyzer 2026
/**
 * E-Arsip Digital - Code Quality Analyzer
 * Version: 2026.1.0
 * Analyzes code quality metrics for the application
 */

import { Logger } from './logger.js';

class CodeAnalyzer {
    constructor() {
        this.logger = new Logger('CodeAnalyzer');
        
        // Metrics
        this.metrics = {
            totalScripts: 0,
            totalStyles: 0,
            totalModules: 0,
            totalLines: 0,
            loadedModules: new Set(),
            loadTimes: new Map(),
            errors: []
        };
        
        this.init();
    }
    
    init() {
        this.analyzeLoadedResources();
        this.monitorPerformance();
        
        this.logger.info('Code analyzer initialized');
    }
    
    // ============================================
    // RESOURCE ANALYSIS
    // ============================================
    
    analyzeLoadedResources() {
        // Count scripts
        const scripts = document.querySelectorAll('script[src]');
        this.metrics.totalScripts = scripts.length;
        
        // Count styles
        const styles = document.querySelectorAll('link[rel="stylesheet"]');
        this.metrics.totalStyles = styles.length;
        
        // Analyze script types
        scripts.forEach(script => {
            const src = script.src;
            if (src.includes('/js/')) {
                if (script.type === 'module') {
                    this.metrics.totalModules++;
                    this.metrics.loadedModules.add(src);
                }
            }
        });
        
        // Count DOM elements as a complexity metric
        this.metrics.totalDOMElements = document.querySelectorAll('*').length;
        
        this.logger.info('Resource analysis complete', {
            scripts: this.metrics.totalScripts,
            styles: this.metrics.totalStyles,
            modules: this.metrics.totalModules,
            domElements: this.metrics.totalDOMElements
        });
    }
    
    monitorPerformance() {
        // Track module load times via Performance API
        if (window.performance?.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            
            resources.forEach(resource => {
                if (resource.name.includes('/js/') || resource.name.includes('/css/')) {
                    this.metrics.loadTimes.set(resource.name, resource.duration);
                }
            });
        }
        
        // Monitor for console errors
        const originalError = console.error;
        const self = this;
        
        console.error = function(...args) {
            self.metrics.errors.push({
                message: args.map(a => String(a)).join(' '),
                timestamp: Date.now()
            });
            
            if (self.metrics.errors.length > 50) {
                self.metrics.errors = self.metrics.errors.slice(-50);
            }
            
            originalError.apply(console, args);
        };
    }
    
    // ============================================
    // CODE METRICS
    // ============================================
    
    getCodeMetrics() {
        return {
            scripts: this.metrics.totalScripts,
            styles: this.metrics.totalStyles,
            modules: this.metrics.totalModules,
            domElements: this.metrics.totalDOMElements,
            loadedModules: this.metrics.loadedModules.size,
            errors: this.metrics.errors.length,
            averageLoadTime: this.getAverageLoadTime()
        };
    }
    
    getAverageLoadTime() {
        const times = Array.from(this.metrics.loadTimes.values());
        if (times.length === 0) return 0;
        
        const sum = times.reduce((acc, t) => acc + t, 0);
        return Math.round(sum / times.length);
    }
    
    getLoadedModules() {
        return Array.from(this.metrics.loadedModules);
    }
    
    getSlowResources(threshold = 1000) {
        const slow = [];
        
        this.metrics.loadTimes.forEach((duration, name) => {
            if (duration > threshold) {
                slow.push({ name, duration });
            }
        });
        
        return slow.sort((a, b) => b.duration - a.duration);
    }
    
    getErrorCount() {
        return this.metrics.errors.length;
    }
    
    getRecentErrors(limit = 10) {
        return this.metrics.errors.slice(-limit);
    }
    
    // ============================================
    // SIZE ESTIMATION
    // ============================================
    
    estimateTotalSize() {
        let totalSize = 0;
        
        // Estimate from Performance API
        if (window.performance?.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            
            resources.forEach(resource => {
                if (resource.transferSize) {
                    totalSize += resource.transferSize;
                }
            });
        }
        
        // Add localStorage size
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += (key.length + value.length) * 2;
        }
        
        return {
            bytes: totalSize,
            formatted: this.formatBytes(totalSize)
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    // ============================================
    // COMPLEXITY ANALYSIS
    // ============================================
    
    analyzeDOMComplexity() {
        const metrics = {
            totalElements: document.querySelectorAll('*').length,
            depth: this.getMaxDOMDepth(),
            scripts: document.querySelectorAll('script').length,
            styles: document.querySelectorAll('style').length,
            eventListeners: this.estimateEventListenerCount()
        };
        
        return {
            ...metrics,
            complexity: this.getComplexityLevel(metrics)
        };
    }
    
    getMaxDOMDepth() {
        let maxDepth = 0;
        
        function walk(node, depth) {
            if (depth > maxDepth) maxDepth = depth;
            
            for (const child of node.children) {
                walk(child, depth + 1);
            }
        }
        
        walk(document.documentElement, 0);
        
        return maxDepth;
    }
    
    estimateEventListenerCount() {
        // Count elements with event attributes
        const inlineEvents = document.querySelectorAll('[onclick], [onchange], [onsubmit], [onload], [onerror]');
        
        return inlineEvents.length;
    }
    
    getComplexityLevel(metrics) {
        let score = 0;
        
        if (metrics.totalElements > 5000) score += 3;
        else if (metrics.totalElements > 2000) score += 2;
        else if (metrics.totalElements > 1000) score += 1;
        
        if (metrics.depth > 30) score += 2;
        else if (metrics.depth > 20) score += 1;
        
        if (metrics.scripts > 20) score += 2;
        else if (metrics.scripts > 10) score += 1;
        
        if (score >= 5) return 'high';
        if (score >= 3) return 'medium';
        return 'low';
    }
    
    // ============================================
    // REPORTING
    // ============================================
    
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            code: this.getCodeMetrics(),
            size: this.estimateTotalSize(),
            complexity: this.analyzeDOMComplexity(),
            performance: {
                averageLoadTime: this.getAverageLoadTime(),
                slowResources: this.getSlowResources(),
                errors: this.getRecentErrors()
            }
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    refresh() {
        this.analyzeLoadedResources();
    }
    
    destroy() {
        this.metrics.loadedModules.clear();
        this.metrics.loadTimes.clear();
        this.metrics.errors = [];
        this.logger.info('Code analyzer destroyed');
    }
}

// Create singleton
const codeAnalyzer = new CodeAnalyzer();

export default codeAnalyzer;
export { CodeAnalyzer };