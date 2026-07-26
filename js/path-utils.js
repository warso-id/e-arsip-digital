// js/path-utils.js - Secure Path Resolution Utility 2026
/**
 * E-Arsip Digital - Advanced Path Utilities
 * Version: 2026.1.0
 * Features: Secure path resolution, PWA scope detection,
 *           path validation, cache management, SPA routing support
 * Security: Path traversal prevention, XSS protection, URL sanitization
 */

import APP_CONFIG from '../config/config.js';

// ============================================
// PATH CONFIGURATION
// ============================================

/**
 * Detect application base path dynamically
 * Supports: subfolder deployment, PWA scope, custom base paths
 */
const detectBasePath = () => {
    try {
        // Check config override first
        if (APP_CONFIG?.app?.basePath) {
            return normalizeBasePath(APP_CONFIG.app.basePath);
        }
        
        // Check for base element
        const baseElement = document.querySelector('base[href]');
        if (baseElement) {
            const href = baseElement.getAttribute('href');
            if (href && href !== '/' && href !== window.location.origin + '/') {
                return normalizeBasePath(new URL(href, window.location.origin).pathname);
            }
        }
        
        // Detect from script location (most reliable)
        const scripts = document.getElementsByTagName('script');
        for (const script of scripts) {
            if (script.src && script.src.includes('/path-utils.js')) {
                const scriptUrl = new URL(script.src, window.location.origin);
                const scriptPath = scriptUrl.pathname;
                const basePath = scriptPath.replace(/\/js\/path-utils\.js.*$/, '/');
                
                if (basePath && basePath !== '/') {
                    return normalizeBasePath(basePath);
                }
            }
        }
        
        // Detect from location pathname
        if (typeof window !== 'undefined' && window.location?.pathname) {
            const pathname = window.location.pathname;
            
            // Known application structure patterns
            const appPatterns = [
                'dashboard', 'surat-masuk', 'surat-keluar', 'login',
                'register', 'documents', 'settings', 'admin'
            ];
            
            const segments = pathname.split('/').filter(Boolean);
            
            // Check if first segment is a repository/folder name
            if (segments.length >= 2) {
                const firstSegment = segments[0].toLowerCase();
                
                // Skip if it's an app route
                if (!appPatterns.includes(firstSegment) && 
                    !firstSegment.includes('.') && 
                    firstSegment.length > 1) {
                    
                    // Verify: check if index file exists at that level
                    const potentialBase = `/${firstSegment}/`;
                    
                    // Check if current path has more segments after potential base
                    const afterBase = pathname.substring(potentialBase.length);
                    if (afterBase && appPatterns.some(pattern => 
                        afterBase.startsWith(pattern) || afterBase === '')) {
                        return normalizeBasePath(potentialBase);
                    }
                }
            }
        }
        
        // Check PWA service worker scope
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            if (navigator.serviceWorker.controller?.scriptURL) {
                const swPath = new URL(navigator.serviceWorker.controller.scriptURL).pathname;
                const swScope = swPath.replace(/\/sw\.js.*$/, '/');
                
                if (swScope && swScope !== '/') {
                    return normalizeBasePath(swScope);
                }
            }
        }
        
        return '/';
        
    } catch (error) {
        console.warn('[PathUtils] Failed to detect base path, using "/":', error.message);
        return '/';
    }
};

/**
 * Normalize base path to consistent format
 */
const normalizeBasePath = (path) => {
    if (!path || path === '/') return '/';
    
    // Ensure starts with /
    let normalized = path.startsWith('/') ? path : `/${path}`;
    
    // Ensure ends with /
    if (!normalized.endsWith('/')) {
        normalized += '/';
    }
    
    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');
    
    return normalized;
};

// Initialize base path once
let APP_BASE_PATH = '/';
let basePathInitialized = false;

/**
 * Get or initialize base path
 */
const getBasePath = () => {
    if (!basePathInitialized) {
        APP_BASE_PATH = detectBasePath();
        basePathInitialized = true;
        
        // Store for future reference
        try {
            sessionStorage.setItem('app_base_path', APP_BASE_PATH);
        } catch {}
    }
    
    return APP_BASE_PATH;
};

// ============================================
// PATH VALIDATION & SANITIZATION
// ============================================

/**
 * Known safe application routes (whitelist)
 */
const KNOWN_ROUTES = new Set([
    '/', '/dashboard', '/login', '/register', '/logout',
    '/documents', '/surat-masuk', '/surat-keluar', '/disposisi',
    '/reports', '/settings', '/profile', '/admin',
    '/notifications', '/search', '/help', '/about',
    '/offline', '/403', '/404', '/500'
]);

/**
 * Known safe file extensions
 */
const SAFE_EXTENSIONS = new Set([
    '.html', '.htm', '.css', '.js', '.json', '.xml',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.woff', '.woff2', '.ttf', '.eot'
]);

/**
 * Validate path for security
 */
const validatePath = (path) => {
    if (!path || typeof path !== 'string') {
        return { valid: false, reason: 'Invalid path type' };
    }
    
    // Check length
    if (path.length > 2048) {
        return { valid: false, reason: 'Path too long' };
    }
    
    // Check for null bytes (null byte injection)
    if (path.includes('\0') || path.includes('%00')) {
        return { valid: false, reason: 'Null byte detected' };
    }
    
    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerPath = path.toLowerCase().trim();
    
    for (const protocol of dangerousProtocols) {
        if (lowerPath.startsWith(protocol)) {
            return { valid: false, reason: `Dangerous protocol: ${protocol}` };
        }
    }
    
    // Check for path traversal attempts
    if (path.includes('..') || path.includes('./') || path.includes('%2e%2e')) {
        return { valid: false, reason: 'Path traversal detected' };
    }
    
    // Check for encoded characters (potential XSS)
    const decoded = decodeURIComponent(path);
    if (/[<>"'`]/.test(decoded)) {
        return { valid: false, reason: 'Invalid characters in path' };
    }
    
    return { valid: true };
};

/**
 * Sanitize path components
 */
const sanitizePathComponent = (component) => {
    if (!component) return '';
    
    return component
        .replace(/[<>"'`|\\{}()[\]^#%&*+~]/g, '') // Remove dangerous chars
        .replace(/\.\./g, '') // Remove parent references
        .replace(/\/+/g, '-') // Replace slashes
        .trim()
        .substring(0, 100); // Limit length
};

// ============================================
// PATH RESOLUTION
// ============================================

/**
 * Path cache untuk performance
 */
const pathCache = new Map();
const MAX_CACHE_SIZE = 200;

/**
 * Get cached or compute resolved path
 */
const getCachedPath = (path, resolver) => {
    if (pathCache.has(path)) {
        return pathCache.get(path);
    }
    
    const resolved = resolver();
    
    // Cache management
    if (pathCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (first 20%)
        const keys = [...pathCache.keys()];
        keys.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2)).forEach(key => {
            pathCache.delete(key);
        });
    }
    
    pathCache.set(path, resolved);
    return resolved;
};

/**
 * Get application base path
 */
export function getAppBasePath() {
    return getBasePath();
}

/**
 * Set application base path (override)
 */
export function setAppBasePath(path) {
    if (path) {
        APP_BASE_PATH = normalizeBasePath(path);
        basePathInitialized = true;
        
        // Clear cache when base path changes
        pathCache.clear();
        
        // Update session storage
        try {
            sessionStorage.setItem('app_base_path', APP_BASE_PATH);
        } catch {}
    }
}

/**
 * Reset base path detection
 */
export function resetBasePath() {
    APP_BASE_PATH = '/';
    basePathInitialized = false;
    pathCache.clear();
}

/**
 * Resolve application path dengan security checks
 */
export function resolveAppPath(path, options = {}) {
    // Handle null/undefined
    if (!path) return getBasePath();
    
    // Use cache for performance
    const cacheKey = `resolve:${path}`;
    if (!options.skipCache && pathCache.has(cacheKey)) {
        return pathCache.get(cacheKey);
    }
    
    try {
        // Handle external URLs (pass through with security check)
        if (/^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(path)) {
            // Validate external URL
            try {
                const url = new URL(path);
                
                // Block dangerous protocols
                if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(url.protocol)) {
                    console.warn('[PathUtils] Blocked dangerous protocol:', url.protocol);
                    return '#blocked';
                }
                
                // Add rel attributes for external links
                if (url.origin !== window.location.origin) {
                    return path; // Keep as-is for external
                }
            } catch {
                return '#invalid';
            }
        }
        
        // Handle anchor links
        if (path.startsWith('#')) {
            return path;
        }
        
        // Handle query string only
        if (path.startsWith('?')) {
            return `${getBasePath()}${path}`;
        }
        
        // Validate path security
        const validation = validatePath(path);
        if (!validation.valid) {
            console.warn('[PathUtils] Path validation failed:', validation.reason, path);
            return '#invalid';
        }
        
        // Clean and normalize path
        let normalized = path.trim();
        
        // Handle relative paths
        if (normalized.startsWith('./') || normalized.startsWith('../')) {
            // Resolve relative paths (with security check)
            normalized = resolveRelativePath(normalized, options.currentPath);
        }
        
        // Remove leading ./ 
        normalized = normalized.replace(/^\.\//, '');
        
        // Normalize separators
        normalized = normalized.replace(/\\/g, '/');
        
        // Remove duplicate slashes
        normalized = normalized.replace(/\/+/g, '/');
        
        // Resolve . and .. segments
        const segments = normalized.split('/');
        const resolved = [];
        
        for (const segment of segments) {
            if (segment === '..') {
                resolved.pop(); // Go up one level
            } else if (segment !== '.' && segment !== '') {
                resolved.push(segment);
            }
        }
        
        normalized = '/' + resolved.join('/');
        
        // Add trailing slash for index routes if configured
        if (options.trailingSlash && !normalized.includes('.') && !normalized.endsWith('/')) {
            normalized += '/';
        }
        
        // Prepend base path jika bukan absolute URL
        let result;
        if (normalized === '/') {
            result = getBasePath();
        } else if (normalized.startsWith('/')) {
            result = `${getBasePath()}${normalized.substring(1)}`;
        } else {
            result = normalized;
        }
        
        // Remove trailing slash unless it's root
        if (result.length > 1 && result.endsWith('/') && !options.keepTrailingSlash) {
            result = result.slice(0, -1);
        }
        
        // Cache result
        if (!options.skipCache) {
            pathCache.set(cacheKey, result);
        }
        
        return result;
        
    } catch (error) {
        console.error('[PathUtils] Failed to resolve path:', error.message, path);
        return '#error';
    }
}

/**
 * Resolve relative path from current location
 */
const resolveRelativePath = (relativePath, currentPath = null) => {
    try {
        const base = currentPath || window.location.pathname;
        const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
        
        // Remove ./ prefix
        let resolved = relativePath.replace(/^\.\//, '');
        
        // Handle ../ 
        while (resolved.startsWith('../')) {
            // Go up one directory
            const parentDir = baseDir.substring(0, baseDir.lastIndexOf('/', baseDir.length - 2) + 1);
            
            if (!parentDir || parentDir === '/') {
                // Can't go above root
                resolved = resolved.substring(3);
                break;
            }
            
            baseDir.substring(0, baseDir.lastIndexOf('/', baseDir.length - 2) + 1);
            resolved = resolved.substring(3);
            
            if (!resolved.startsWith('../')) {
                return `${baseDir}${resolved}`;
            }
        }
        
        return `${baseDir}${resolved}`;
        
    } catch {
        return relativePath;
    }
};

/**
 * Navigate to application path
 */
export function navigateToAppPath(path, options = {}) {
    const {
        replace = false,
        newTab = false,
        skipValidation = false,
        state = null
    } = options;
    
    try {
        const resolvedPath = resolveAppPath(path);
        
        // Don't navigate to invalid/blocked paths
        if (resolvedPath === '#invalid' || resolvedPath === '#blocked' || resolvedPath === '#error') {
            console.warn('[PathUtils] Navigation blocked:', path);
            return false;
        }
        
        // New tab
        if (newTab) {
            window.open(resolvedPath, '_blank', 'noopener,noreferrer');
            return true;
        }
        
        // Use History API for SPA
        if (options.useHistory && window.history) {
            if (replace) {
                window.history.replaceState(state || {}, '', resolvedPath);
            } else {
                window.history.pushState(state || {}, '', resolvedPath);
            }
            
            // Dispatch navigation event
            window.dispatchEvent(new CustomEvent('path:navigate', {
                detail: { path: resolvedPath, state }
            }));
            
            return true;
        }
        
        // Traditional navigation
        if (replace) {
            window.location.replace(resolvedPath);
        } else {
            window.location.href = resolvedPath;
        }
        
        return true;
        
    } catch (error) {
        console.error('[PathUtils] Navigation failed:', error.message, path);
        return false;
    }
}

// ============================================
// PATH UTILITIES
// ============================================

/**
 * Check if current page matches a route
 */
export function isCurrentRoute(routePath) {
    try {
        const currentPath = window.location.pathname;
        const resolvedRoute = resolveAppPath(routePath);
        
        // Remove trailing slashes for comparison
        const cleanCurrent = currentPath.replace(/\/$/, '');
        const cleanRoute = resolvedRoute.replace(/\/$/, '');
        
        return cleanCurrent === cleanRoute || 
               cleanCurrent.startsWith(cleanRoute + '/');
    } catch {
        return false;
    }
}

/**
 * Get current route information
 */
export function getCurrentRoute() {
    try {
        const pathname = window.location.pathname;
        const basePath = getBasePath();
        
        // Remove base path to get relative route
        let route = pathname;
        if (basePath !== '/' && pathname.startsWith(basePath)) {
            route = '/' + pathname.substring(basePath.length);
        }
        
        // Parse segments
        const segments = route.split('/').filter(Boolean);
        
        // Parse query parameters
        const params = new URLSearchParams(window.location.search);
        const query = {};
        for (const [key, value] of params) {
            query[key] = sanitizePathComponent(value);
        }
        
        return {
            route,
            segments,
            query,
            fullPath: pathname + window.location.search,
            basePath
        };
    } catch {
        return {
            route: '/',
            segments: [],
            query: {},
            fullPath: '/',
            basePath: '/'
        };
    }
}

/**
 * Build query string from object
 */
export function buildQueryString(params) {
    if (!params || typeof params !== 'object') return '';
    
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            searchParams.append(
                sanitizePathComponent(key),
                encodeURIComponent(value)
            );
        }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString) {
    if (!queryString) return {};
    
    try {
        const params = new URLSearchParams(
            queryString.startsWith('?') ? queryString.substring(1) : queryString
        );
        const result = {};
        
        for (const [key, value] of params) {
            result[sanitizePathComponent(key)] = sanitizePathComponent(value);
        }
        
        return result;
    } catch {
        return {};
    }
}

/**
 * Extract filename from path
 */
export function getFilename(path) {
    if (!path) return '';
    
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}

/**
 * Extract extension from path
 */
export function getExtension(path) {
    const filename = getFilename(path);
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex !== -1 ? filename.substring(dotIndex).toLowerCase() : '';
}

/**
 * Check if path is external
 */
export function isExternalPath(path) {
    if (!path) return false;
    
    return /^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(path) &&
           !path.startsWith(window.location.origin);
}

/**
 * Check if path is safe file download
 */
export function isSafeFile(path) {
    const ext = getExtension(path);
    return SAFE_EXTENSIONS.has(ext) || ext === '';
}

/**
 * Get breadcrumb segments from path
 */
export function getBreadcrumbs(path) {
    if (!path || path === '/') return [];
    
    const segments = path.split('/').filter(Boolean);
    const breadcrumbs = [];
    let accumulatedPath = '';
    
    segments.forEach((segment, index) => {
        accumulatedPath += '/' + segment;
        
        // Skip if it looks like a file
        if (index === segments.length - 1 && segment.includes('.')) {
            return;
        }
        
        breadcrumbs.push({
            label: segment
                .replace(/-/g, ' ')
                .replace(/\.\w+$/, '') // Remove extension
                .replace(/\b\w/g, l => l.toUpperCase()),
            path: accumulatedPath,
            active: index === segments.length - 1
        });
    });
    
    return breadcrumbs;
}

// ============================================
// PWA PATH UTILITIES
// ============================================

/**
 * Get PWA scope
 */
export function getPWAScope() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            const swUrl = new URL(navigator.serviceWorker.controller.scriptURL);
            return swUrl.pathname.replace(/\/[^/]*$/, '/');
        } catch {}
    }
    
    return getBasePath();
}

/**
 * Check if path is within PWA scope
 */
export function isInPWAScope(path) {
    const scope = getPWAScope();
    const resolved = resolveAppPath(path);
    return resolved.startsWith(scope);
}

/**
 * Get offline fallback path
 */
export function getOfflinePath() {
    return resolveAppPath('/offline.html');
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear path cache
 */
export function clearPathCache() {
    pathCache.clear();
}

/**
 * Get cache stats
 */
export function getPathCacheStats() {
    return {
        size: pathCache.size,
        maxSize: MAX_CACHE_SIZE
    };
}

/**
 * Warm up cache with common paths
 */
export function warmupPathCache() {
    const commonPaths = [
        '/', '/dashboard', '/login', '/documents',
        '/surat-masuk', '/surat-keluar', '/settings',
        '/profile', '/notifications', '/search'
    ];
    
    commonPaths.forEach(path => {
        resolveAppPath(path);
    });
}

// ============================================
// EXPORTS
// ============================================

// Initialize base path immediately
getBasePath();

// Warm up cache setelah DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'complete') {
        warmupPathCache();
    } else {
        document.addEventListener('DOMContentLoaded', warmupPathCache);
    }
}

export default {
    getAppBasePath,
    setAppBasePath,
    resetBasePath,
    resolveAppPath,
    navigateToAppPath,
    isCurrentRoute,
    getCurrentRoute,
    buildQueryString,
    parseQueryString,
    getFilename,
    getExtension,
    isExternalPath,
    isSafeFile,
    getBreadcrumbs,
    getPWAScope,
    isInPWAScope,
    getOfflinePath,
    clearPathCache,
    getPathCacheStats,
    warmupPathCache
};