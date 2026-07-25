// js/dependency-checker.js - Dependency Checker 2026
/**
 * E-Arsip Digital - Dependency Checker
 * Version: 2026.1.0
 * Features: Module dependency verification, version checking,
 *           feature detection, polyfill recommendations
 */

import { Logger } from './logger.js';

class DependencyChecker {
    constructor() {
        this.logger = new Logger('DepChecker');
        
        // Required browser APIs
        this.requiredAPIs = [
            { name: 'Fetch API', test: () => typeof fetch !== 'undefined' },
            { name: 'Promise', test: () => typeof Promise !== 'undefined' },
            { name: 'localStorage', test: () => this.testStorage('localStorage') },
            { name: 'sessionStorage', test: () => this.testStorage('sessionStorage') },
            { name: 'IndexedDB', test: () => !!window.indexedDB },
            { name: 'Web Crypto API', test: () => !!window.crypto?.subtle },
            { name: 'Service Worker', test: () => 'serviceWorker' in navigator },
            { name: 'WebSocket', test: () => 'WebSocket' in window },
            { name: 'BroadcastChannel', test: () => 'BroadcastChannel' in window },
            { name: 'Performance API', test: () => !!window.performance },
            { name: 'MutationObserver', test: () => 'MutationObserver' in window },
            { name: 'IntersectionObserver', test: () => 'IntersectionObserver' in window },
            { name: 'requestAnimationFrame', test: () => 'requestAnimationFrame' in window },
            { name: 'Intl', test: () => 'Intl' in window },
            { name: 'URL API', test: () => 'URL' in window },
            { name: 'Blob', test: () => 'Blob' in window },
            { name: 'FileReader', test: () => 'FileReader' in window },
            { name: 'FormData', test: () => 'FormData' in window }
        ];
        
        // Required modules (checked by import)
        this.requiredModules = [
            { name: 'Chart.js', path: 'chart.js/auto' },
            { name: 'QRCode', path: 'qrcode' },
            { name: 'XLSX', path: 'xlsx' }
        ];
        
        // Optional modules
        this.optionalModules = [
            { name: 'DOMPurify', path: 'dompurify' }
        ];
        
        // Check results
        this.results = {
            apis: [],
            modules: [],
            optional: []
        };
        
        this.init();
    }
    
    async init() {
        await this.checkAll();
        
        this.logger.info('Dependency checker initialized', {
            passedAPIs: this.results.apis.filter(r => r.passed).length,
            totalAPIs: this.results.apis.length
        });
    }
    
    // ============================================
    // CHECKS
    // ============================================
    
    async checkAll() {
        this.checkAPIs();
        await this.checkModules();
        await this.checkOptionalModules();
        this.checkFeatures();
        
        return this.results;
    }
    
    checkAPIs() {
        this.results.apis = this.requiredAPIs.map(api => {
            let passed = false;
            let error = null;
            
            try {
                passed = api.test();
            } catch (e) {
                error = e.message;
            }
            
            return {
                name: api.name,
                passed,
                error,
                required: true
            };
        });
    }
    
    async checkModules() {
        this.results.modules = [];
        
        for (const mod of this.requiredModules) {
            try {
                await import(mod.path);
                this.results.modules.push({
                    name: mod.name,
                    available: true
                });
            } catch {
                this.results.modules.push({
                    name: mod.name,
                    available: false
                });
            }
        }
    }
    
    async checkOptionalModules() {
        this.results.optional = [];
        
        for (const mod of this.optionalModules) {
            try {
                await import(mod.path);
                this.results.optional.push({
                    name: mod.name,
                    available: true
                });
            } catch {
                this.results.optional.push({
                    name: mod.name,
                    available: false
                });
            }
        }
    }
    
    checkFeatures() {
        this.results.features = {
            touch: 'ontouchstart' in window,
            geolocation: 'geolocation' in navigator,
            notifications: 'Notification' in window,
            clipboard: 'clipboard' in navigator,
            share: 'share' in navigator,
            vibration: 'vibrate' in navigator,
            fullscreen: 'fullscreenEnabled' in document,
            webp: this.checkWebPSupport(),
            webgl: this.checkWebGLSupport(),
            audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
            speechSynthesis: 'speechSynthesis' in window,
            paymentRequest: 'PaymentRequest' in window,
            credentialManagement: 'PasswordCredential' in window || 'FederatedCredential' in window
        };
    }
    
    checkWebPSupport() {
        const canvas = document.createElement('canvas');
        if (canvas.toDataURL) {
            return canvas.toDataURL('image/webp').startsWith('data:image/webp');
        }
        return false;
    }
    
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(
                window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
            );
        } catch {
            return false;
        }
    }
    
    testStorage(type) {
        try {
            const storage = window[type];
            const testKey = '__storage_test__';
            storage.setItem(testKey, '1');
            storage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }
    
    // ============================================
    // BROWSER INFO
    // ============================================
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        let engine = 'Unknown';
        
        // Browser detection
        if (ua.includes('Firefox')) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
            engine = 'Gecko';
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
            version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
            engine = 'Blink';
        } else if (ua.includes('Chrome')) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
            engine = 'Blink';
        } else if (ua.includes('Safari')) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
            engine = 'WebKit';
        } else if (ua.includes('Opera') || ua.includes('OPR')) {
            browser = 'Opera';
            version = ua.match(/(?:Opera|OPR)\/(\d+)/)?.[1] || 'Unknown';
            engine = 'Blink';
        }
        
        return {
            browser,
            version,
            engine,
            userAgent: ua,
            platform: navigator.platform,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            online: navigator.onLine,
            deviceMemory: navigator.deviceMemory || 'Unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
            maxTouchPoints: navigator.maxTouchPoints || 0,
            vendor: navigator.vendor || 'Unknown'
        };
    }
    
    // ============================================
    // COMPATIBILITY REPORT
    // ============================================
    
    generateReport() {
        const apiPassed = this.results.apis.filter(r => r.passed).length;
        const apiTotal = this.results.apis.length;
        const modulesAvailable = this.results.modules.filter(r => r.available).length;
        const modulesTotal = this.results.modules.length;
        
        const failedAPIs = this.results.apis.filter(r => !r.passed);
        const failedModules = this.results.modules.filter(r => !r.available);
        
        return {
            timestamp: new Date().toISOString(),
            browser: this.getBrowserInfo(),
            compatibility: {
                score: Math.round((apiPassed / apiTotal) * 100),
                apiPassed,
                apiTotal,
                modulesAvailable,
                modulesTotal,
                failedAPIs: failedAPIs.map(r => r.name),
                failedModules: failedModules.map(r => r.name)
            },
            features: this.results.features,
            recommendations: this.generateRecommendations(failedAPIs, failedModules)
        };
    }
    
    generateRecommendations(failedAPIs, failedModules) {
        const recommendations = [];
        
        if (failedAPIs.length > 0) {
            recommendations.push({
                type: 'browser_update',
                message: 'Beberapa API browser tidak tersedia. Pertimbangkan untuk memperbarui browser Anda.',
                missingAPIs: failedAPIs.map(r => r.name)
            });
        }
        
        if (failedModules.length > 0) {
            recommendations.push({
                type: 'install_modules',
                message: 'Beberapa modul JavaScript tidak tersedia. Jalankan npm install.',
                missingModules: failedModules.map(r => r.name)
            });
        }
        
        if (!this.results.features.webp) {
            recommendations.push({
                type: 'format_fallback',
                message: 'WebP tidak didukung. Gunakan format gambar alternatif (PNG, JPEG).'
            });
        }
        
        return recommendations;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getResults() {
        return this.results;
    }
    
    isCompatible() {
        return this.results.apis.every(r => r.passed);
    }
    
    getMissingAPIs() {
        return this.results.apis.filter(r => !r.passed).map(r => r.name);
    }
    
    refresh() {
        return this.checkAll();
    }
    
    destroy() {
        this.results = { apis: [], modules: [], optional: [] };
        this.logger.info('Dependency checker destroyed');
    }
}

// Create singleton
const dependencyChecker = new DependencyChecker();

// Expose globally
window.dependencyChecker = dependencyChecker;

export default dependencyChecker;
export { DependencyChecker };