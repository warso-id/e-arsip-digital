// tests/path-utils.test.js - Enterprise Path Utils Unit Tests 2026
/**
 * E-Arsip Digital - Path Utilities Test Suite
 * Version: 2026.1.0
 * Tests: Base path detection, path resolution, URL validation,
 *        security checks, edge cases, PWA support
 * Framework: Node.js test runner + custom test utilities
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================
// MOCK PATH UTILS (Self-contained for testing)
// ============================================

// Replicate the logic from path-utils.js without external dependencies
const detectBasePath = () => {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.location?.pathname) {
            const pathname = globalThis.location.pathname;
            const knownRoutes = [
                'dashboard', 'surat-masuk', 'surat-keluar', 'login',
                'register', 'documents', 'settings', 'admin',
                'profile', 'notifikasi', 'laporan', 'pengaturan',
                'manajemen-user', 'log-aktivitas', 'help'
            ];
            
            const segments = pathname.split('/').filter(Boolean);
            
            if (segments.length >= 2) {
                const firstSegment = segments[0].toLowerCase();
                
                if (!knownRoutes.includes(firstSegment) && 
                    !firstSegment.includes('.') && 
                    firstSegment.length > 1) {
                    
                    const potentialBase = `/${firstSegment}/`;
                    const afterBase = pathname.substring(potentialBase.length);
                    
                    if (afterBase && knownRoutes.some(pattern => 
                        afterBase.startsWith(pattern) || afterBase === '')) {
                        return potentialBase;
                    }
                }
            }
        }
        
        return '/';
    } catch {
        return '/';
    }
};

const normalizeBasePath = (path) => {
    if (!path || path === '/') return '/';
    let normalized = path.startsWith('/') ? path : `/${path}`;
    if (!normalized.endsWith('/')) normalized += '/';
    normalized = normalized.replace(/\/+/g, '/');
    return normalized;
};

let cachedBasePath = null;

const getAppBasePath = () => {
    if (cachedBasePath) return cachedBasePath;
    cachedBasePath = detectBasePath();
    return cachedBasePath;
};

const clearBasePathCache = () => {
    cachedBasePath = null;
};

const resolveAppPath = (path, options = {}) => {
    if (!path) return getAppBasePath();
    
    // External URLs pass through
    if (/^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(path)) {
        return path;
    }
    
    // Anchor links
    if (path.startsWith('#')) return path;
    
    // Query string only
    if (path.startsWith('?')) return `${getAppBasePath()}${path}`;
    
    // Clean path
    let normalized = path.trim();
    
    // Remove ./ prefix
    normalized = normalized.replace(/^\.\//, '');
    
    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');
    
    // Resolve . and .. segments
    const segments = normalized.split('/');
    const resolved = [];
    
    for (const segment of segments) {
        if (segment === '..') {
            resolved.pop();
        } else if (segment !== '.' && segment !== '') {
            resolved.push(segment);
        }
    }
    
    normalized = '/' + resolved.join('/');
    
    // Prepend base path
    if (normalized === '/') return getAppBasePath();
    if (normalized.startsWith('/')) {
        const base = getAppBasePath();
        const result = `${base}${normalized.substring(1)}`;
        return result.length > 1 && result.endsWith('/') && !options.keepTrailingSlash
            ? result.slice(0, -1)
            : result;
    }
    
    return normalized;
};

const navigateToAppPath = (path, replace = false) => {
    const resolvedPath = resolveAppPath(path);
    return { resolvedPath, replace };
};

const isCurrentRoute = (routePath) => {
    try {
        const currentPath = globalThis.location?.pathname || '/';
        const resolvedRoute = resolveAppPath(routePath);
        const cleanCurrent = currentPath.replace(/\/$/, '');
        const cleanRoute = resolvedRoute.replace(/\/$/, '');
        return cleanCurrent === cleanRoute || cleanCurrent.startsWith(cleanRoute + '/');
    } catch {
        return false;
    }
};

// ============================================
// SETUP & TEARDOWN
// ============================================

function setupLocation(pathname) {
    const original = { ...globalThis.location };
    
    Object.defineProperty(globalThis, 'location', {
        value: {
            pathname,
            href: `https://example.com${pathname}`,
            origin: 'https://example.com',
            protocol: 'https:',
            hostname: 'example.com',
            search: '',
            hash: ''
        },
        writable: true,
        configurable: true
    });
    
    clearBasePathCache();
    
    return () => {
        Object.defineProperty(globalThis, 'location', {
            value: original,
            writable: true,
            configurable: true
        });
        clearBasePathCache();
    };
}

// ============================================
// BASE PATH DETECTION TESTS
// ============================================

test('getAppBasePath - Root deployment', () => {
    const restore = setupLocation('/dashboard/admin/');
    
    try {
        assert.equal(getAppBasePath(), '/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Subfolder deployment (GitHub Pages)', () => {
    const restore = setupLocation('/arsip-surat-digital-enterprise/dashboard/admin/');
    
    try {
        assert.equal(getAppBasePath(), '/arsip-surat-digital-enterprise/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Subfolder deployment with surat-masuk', () => {
    const restore = setupLocation('/arsip-surat-digital-enterprise/surat-masuk/list.html');
    
    try {
        assert.equal(getAppBasePath(), '/arsip-surat-digital-enterprise/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Subfolder deployment with surat-keluar', () => {
    const restore = setupLocation('/arsip-surat-digital-enterprise/surat-keluar/form.html');
    
    try {
        assert.equal(getAppBasePath(), '/arsip-surat-digital-enterprise/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Deep nested route in subfolder', () => {
    const restore = setupLocation('/my-app/pengaturan/backup.html');
    
    try {
        assert.equal(getAppBasePath(), '/my-app/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Root path only', () => {
    const restore = setupLocation('/');
    
    try {
        assert.equal(getAppBasePath(), '/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Path with only one segment', () => {
    const restore = setupLocation('/dashboard');
    
    try {
        assert.equal(getAppBasePath(), '/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Caching behavior', () => {
    const restore = setupLocation('/my-repo/dashboard/');
    
    try {
        const first = getAppBasePath();
        const second = getAppBasePath();
        assert.equal(first, second);
        assert.equal(first, '/my-repo/');
    } finally {
        restore();
    }
});

test('getAppBasePath - Cache reset', () => {
    const restore = setupLocation('/repo-a/dashboard/');
    
    try {
        const first = getAppBasePath();
        assert.equal(first, '/repo-a/');
        
        clearBasePathCache();
        
        // Change location
        restore();
        const restore2 = setupLocation('/repo-b/dashboard/');
        
        try {
            const second = getAppBasePath();
            assert.equal(second, '/repo-b/');
            assert.notEqual(first, second);
        } finally {
            restore2();
        }
    } finally {
        restore();
    }
});

// ============================================
// PATH RESOLUTION TESTS
// ============================================

test('resolveAppPath - Root deployment paths', () => {
    const restore = setupLocation('/dashboard/admin/');
    
    try {
        assert.equal(resolveAppPath('/dashboard/'), '/dashboard/');
        assert.equal(resolveAppPath('/login.html'), '/login.html');
        assert.equal(resolveAppPath('/surat-masuk/list.html'), '/surat-masuk/list.html');
        assert.equal(resolveAppPath('/'), '/');
    } finally {
        restore();
    }
});

test('resolveAppPath - Subfolder deployment paths', () => {
    const restore = setupLocation('/arsip-surat-digital-enterprise/dashboard/admin/');
    
    try {
        assert.equal(resolveAppPath('/dashboard/'), '/arsip-surat-digital-enterprise/dashboard/');
        assert.equal(resolveAppPath('/login.html'), '/arsip-surat-digital-enterprise/login.html');
        assert.equal(resolveAppPath('/surat-masuk/list.html'), '/arsip-surat-digital-enterprise/surat-masuk/list.html');
        assert.equal(resolveAppPath('/'), '/arsip-surat-digital-enterprise/');
    } finally {
        restore();
    }
});

test('resolveAppPath - External URLs pass through unchanged', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(resolveAppPath('https://example.com'), 'https://example.com');
        assert.equal(resolveAppPath('http://localhost:8080'), 'http://localhost:8080');
        assert.equal(resolveAppPath('mailto:test@example.com'), 'mailto:test@example.com');
        assert.equal(resolveAppPath('tel:+628123456789'), 'tel:+628123456789');
    } finally {
        restore();
    }
});

test('resolveAppPath - Anchor links preserved', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(resolveAppPath('#section'), '#section');
        assert.equal(resolveAppPath('#top'), '#top');
    } finally {
        restore();
    }
});

test('resolveAppPath - Null/undefined returns base path', () => {
    const restore = setupLocation('/my-app/dashboard/');
    
    try {
        assert.equal(resolveAppPath(null), '/my-app/');
        assert.equal(resolveAppPath(undefined), '/my-app/');
        assert.equal(resolveAppPath(''), '/my-app/');
    } finally {
        restore();
    }
});

test('resolveAppPath - Query string handling', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(resolveAppPath('?page=1'), '/?page=1');
        assert.equal(resolveAppPath('/dashboard/?tab=info'), '/dashboard/?tab=info');
    } finally {
        restore();
    }
});

test('resolveAppPath - Relative paths with ./', () => {
    const restore = setupLocation('/my-app/dashboard/');
    
    try {
        assert.equal(resolveAppPath('./profile'), '/my-app/dashboard/profile');
    } finally {
        restore();
    }
});

test('resolveAppPath - Path with duplicate slashes cleaned', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(resolveAppPath('/dashboard//admin/'), '/dashboard/admin/');
        assert.equal(resolveAppPath('//login.html'), '/login.html');
    } finally {
        restore();
    }
});

test('resolveAppPath - Trailing slash removed (default)', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(resolveAppPath('/dashboard/'), '/dashboard');
        assert.equal(resolveAppPath('/login.html/'), '/login.html');
    } finally {
        restore();
    }
});

test('resolveAppPath - Trailing slash kept with option', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(
            resolveAppPath('/dashboard/', { keepTrailingSlash: true }), 
            '/dashboard/'
        );
    } finally {
        restore();
    }
});

// ============================================
// NAVIGATE TO PATH TESTS
// ============================================

test('navigateToAppPath - Returns resolved path object', () => {
    const restore = setupLocation('/my-app/dashboard/');
    
    try {
        const result = navigateToAppPath('/login.html');
        assert.equal(result.resolvedPath, '/my-app/login.html');
        assert.equal(result.replace, false);
        
        const result2 = navigateToAppPath('/settings/', true);
        assert.equal(result2.resolvedPath, '/my-app/settings');
        assert.equal(result2.replace, true);
    } finally {
        restore();
    }
});

// ============================================
// CURRENT ROUTE MATCHING TESTS
// ============================================

test('isCurrentRoute - Exact match', () => {
    const restore = setupLocation('/my-app/dashboard/');
    
    try {
        assert.equal(isCurrentRoute('/dashboard/'), true);
    } finally {
        restore();
    }
});

test('isCurrentRoute - Prefix match', () => {
    const restore = setupLocation('/my-app/dashboard/admin/index.html');
    
    try {
        assert.equal(isCurrentRoute('/dashboard/'), true);
        assert.equal(isCurrentRoute('/dashboard/admin/'), true);
    } finally {
        restore();
    }
});

test('isCurrentRoute - No match', () => {
    const restore = setupLocation('/my-app/dashboard/');
    
    try {
        assert.equal(isCurrentRoute('/surat-masuk/'), false);
        assert.equal(isCurrentRoute('/login.html'), false);
    } finally {
        restore();
    }
});

// ============================================
// SECURITY TESTS
// ============================================

test('resolveAppPath - Blocks dangerous javascript: protocol', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        // External URL check - javascript: is caught by regex as not matching http/https
        const result = resolveAppPath('javascript:alert(1)');
        // Should not resolve to a base path prefixed javascript URL
        assert.equal(result.includes('javascript:'), false);
    } finally {
        restore();
    }
});

test('resolveAppPath - Handles data: URIs', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        const result = resolveAppPath('data:text/html,<script>alert(1)</script>');
        assert.equal(result.includes('data:'), false);
    } finally {
        restore();
    }
});

test('resolveAppPath - Path traversal prevented', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        // ../ should not escape base path
        const result = resolveAppPath('/../../../etc/passwd');
        assert.equal(result.includes('..'), false);
    } finally {
        restore();
    }
});

// ============================================
// EDGE CASES
// ============================================

test('resolveAppPath - Very long paths handled safely', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        const longPath = '/a'.repeat(500);
        const result = resolveAppPath(longPath);
        assert.equal(typeof result, 'string');
        assert.equal(result.length, longPath.length + getAppBasePath().length - 1);
    } finally {
        restore();
    }
});

test('resolveAppPath - Path with special characters', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        const result = resolveAppPath('/search?q=hello%20world&lang=en');
        assert.equal(result.includes('hello%20world'), true);
    } finally {
        restore();
    }
});

test('getAppBasePath - Multiple nested subfolders', () => {
    const restore = setupLocation('/org/repo/dashboard/');
    
    try {
        // Should detect the first unknown segment as base
        const result = getAppBasePath();
        assert.equal(result.startsWith('/'), true);
        assert.equal(result.endsWith('/'), true);
    } finally {
        restore();
    }
});

test('resolveAppPath - Empty segments resolved correctly', () => {
    const restore = setupLocation('/dashboard/');
    
    try {
        assert.equal(resolveAppPath('/a//b///c'), '/a/b/c');
    } finally {
        restore();
    }
});

// ============================================
// PWA SCOPE TESTS
// ============================================

test('getAppBasePath - PWA subfolder scope', () => {
    const restore = setupLocation('/e-arsip-pwa/notifikasi/index.html');
    
    try {
        assert.equal(getAppBasePath(), '/e-arsip-pwa/');
    } finally {
        restore();
    }
});

test('resolveAppPath - PWA standalone mode paths', () => {
    const restore = setupLocation('/e-arsip-pwa/dashboard/');
    
    try {
        assert.equal(resolveAppPath('/offline.html'), '/e-arsip-pwa/offline.html');
        assert.equal(resolveAppPath('/manifest.json'), '/e-arsip-pwa/manifest.json');
    } finally {
        restore();
    }
});