// js/security/token-manager.js - JWT & Token Manager 2026
/**
 * E-Arsip Digital - Token Manager
 * Version: 2026.1.0
 * Features: JWT decode/verify, token refresh, secure storage,
 *           automatic renewal, token rotation
 */

import { Logger } from '../logger.js';
import { EncryptionService } from './encryption.js';

class TokenManager {
    constructor() {
        this.logger = new Logger('TokenManager');
        this.encryption = new EncryptionService();
        
        // Token storage keys
        this.ACCESS_TOKEN_KEY = 'auth_token';
        this.REFRESH_TOKEN_KEY = 'auth_refresh_token';
        this.ID_TOKEN_KEY = 'auth_id_token';
        
        // Token state
        this.accessToken = null;
        this.refreshToken = null;
        this.idToken = null;
        this.tokenExpiry = null;
        this.decodedToken = null;
        
        // Refresh handling
        this.refreshTimeout = null;
        this.refreshBuffer = 300000; // 5 minutes before expiry
        this.isRefreshing = false;
        this.refreshQueue = [];
        
        // Bind methods
        this.handleTokenRefresh = this.handleTokenRefresh.bind(this);
        
        this.init();
    }
    
    async init() {
        await this.loadTokens();
        
        if (this.accessToken) {
            this.decodeToken(this.accessToken);
            this.scheduleRefresh();
        }
        
        this.logger.info('Token manager initialized', {
            hasAccessToken: !!this.accessToken,
            hasRefreshToken: !!this.refreshToken
        });
    }
    
    // ============================================
    // TOKEN STORAGE
    // ============================================
    
    async setTokens(accessToken, refreshToken = null, idToken = null) {
        this.accessToken = accessToken;
        if (refreshToken) this.refreshToken = refreshToken;
        if (idToken) this.idToken = idToken;
        
        // Decode access token
        this.decodeToken(accessToken);
        
        // Store securely
        await this.saveTokens();
        
        // Schedule refresh
        this.scheduleRefresh();
        
        this.logger.info('Tokens set', {
            expiresAt: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'unknown'
        });
    }
    
    async saveTokens() {
        try {
            if (this.accessToken) {
                const encrypted = await this.encryption.encrypt(this.accessToken);
                localStorage.setItem(this.ACCESS_TOKEN_KEY, encrypted);
            }
            
            if (this.refreshToken) {
                const encrypted = await this.encryption.encrypt(this.refreshToken);
                localStorage.setItem(this.REFRESH_TOKEN_KEY, encrypted);
            }
            
            if (this.idToken) {
                localStorage.setItem(this.ID_TOKEN_KEY, this.idToken);
            }
        } catch (error) {
            this.logger.error('Failed to save tokens', error);
        }
    }
    
    async loadTokens() {
        try {
            const encryptedAccess = localStorage.getItem(this.ACCESS_TOKEN_KEY);
            if (encryptedAccess) {
                this.accessToken = await this.encryption.decrypt(encryptedAccess);
            }
            
            const encryptedRefresh = localStorage.getItem(this.REFRESH_TOKEN_KEY);
            if (encryptedRefresh) {
                this.refreshToken = await this.encryption.decrypt(encryptedRefresh);
            }
            
            this.idToken = localStorage.getItem(this.ID_TOKEN_KEY);
        } catch (error) {
            this.logger.warn('Failed to load tokens', error);
            this.clearTokens();
        }
    }
    
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.idToken = null;
        this.tokenExpiry = null;
        this.decodedToken = null;
        
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        localStorage.removeItem(this.ID_TOKEN_KEY);
        
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        
        this.logger.info('Tokens cleared');
    }
    
    // ============================================
    // TOKEN DECODING & VALIDATION
    // ============================================
    
    decodeToken(token) {
        if (!token) {
            this.decodedToken = null;
            this.tokenExpiry = null;
            return null;
        }
        
        try {
            // JWT structure: header.payload.signature
            const parts = token.split('.');
            
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }
            
            // Decode payload (base64url)
            const payload = parts[1];
            const decoded = this.base64UrlDecode(payload);
            const parsed = JSON.parse(decoded);
            
            this.decodedToken = parsed;
            
            // Set expiry
            if (parsed.exp) {
                this.tokenExpiry = parsed.exp * 1000; // Convert to milliseconds
            }
            
            return parsed;
        } catch (error) {
            this.logger.warn('Failed to decode token', error);
            this.decodedToken = null;
            this.tokenExpiry = null;
            return null;
        }
    }
    
    isTokenExpired() {
        if (!this.tokenExpiry) return true;
        
        // Add buffer (30 seconds)
        return Date.now() >= (this.tokenExpiry - 30000);
    }
    
    isTokenValid() {
        if (!this.accessToken) return false;
        if (this.isTokenExpired()) return false;
        if (!this.decodedToken) return false;
        
        // Check if token has required claims
        if (!this.decodedToken.sub && !this.decodedToken.userId) return false;
        
        return true;
    }
    
    getTokenRemainingTime() {
        if (!this.tokenExpiry) return 0;
        return Math.max(0, this.tokenExpiry - Date.now());
    }
    
    // ============================================
    // TOKEN REFRESH
    // ============================================
    
    scheduleRefresh() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        if (!this.tokenExpiry || !this.refreshToken) return;
        
        const delay = Math.max(0, this.tokenExpiry - Date.now() - this.refreshBuffer);
        
        if (delay <= 0) {
            // Token already expired or about to expire
            this.handleTokenRefresh();
        } else {
            this.refreshTimeout = setTimeout(() => {
                this.handleTokenRefresh();
            }, delay);
            
            this.logger.debug('Token refresh scheduled', {
                delay: `${Math.round(delay / 1000)}s`
            });
        }
    }
    
    async handleTokenRefresh() {
        if (this.isRefreshing) {
            // Queue refresh requests
            return new Promise((resolve) => {
                this.refreshQueue.push(resolve);
            });
        }
        
        if (!this.refreshToken) {
            this.logger.warn('No refresh token available');
            this.clearTokens();
            this.dispatchTokenExpired();
            return null;
        }
        
        this.isRefreshing = true;
        
        try {
            const { apiService } = await import('../api.js');
            
            const response = await apiService.post('/api/auth/refresh', {
                refreshToken: this.refreshToken
            });
            
            if (response.data?.token) {
                await this.setTokens(
                    response.data.token,
                    response.data.refreshToken || this.refreshToken
                );
                
                this.logger.info('Token refreshed successfully');
                
                // Resolve queued requests
                this.refreshQueue.forEach(resolve => resolve(response.data.token));
                this.refreshQueue = [];
                
                return response.data.token;
            }
            
            throw new Error('No token in refresh response');
        } catch (error) {
            this.logger.error('Token refresh failed', error);
            this.clearTokens();
            this.dispatchTokenExpired();
            
            // Reject queued requests
            this.refreshQueue.forEach(resolve => resolve(null));
            this.refreshQueue = [];
            
            return null;
        } finally {
            this.isRefreshing = false;
        }
    }
    
    async getValidToken() {
        if (this.isTokenValid()) {
            return this.accessToken;
        }
        
        if (this.refreshToken) {
            return this.handleTokenRefresh();
        }
        
        return null;
    }
    
    // ============================================
    // TOKEN CLAIMS
    // ============================================
    
    getClaim(claim) {
        return this.decodedToken?.[claim] || null;
    }
    
    getUserId() {
        return this.decodedToken?.sub || this.decodedToken?.userId || null;
    }
    
    getUserRole() {
        return this.decodedToken?.role || null;
    }
    
    getPermissions() {
        return this.decodedToken?.permissions || [];
    }
    
    hasPermission(permission) {
        const permissions = this.getPermissions();
        return permissions.includes(permission) || permissions.includes('*');
    }
    
    getTokenHeader() {
        if (!this.accessToken) return {};
        
        return {
            'Authorization': `Bearer ${this.accessToken}`
        };
    }
    
    // ============================================
    // TOKEN ROTATION
    // ============================================
    
    async rotateTokens() {
        if (!this.refreshToken) return false;
        
        try {
            const { apiService } = await import('../api.js');
            
            const response = await apiService.post('/api/auth/rotate', {
                refreshToken: this.refreshToken
            });
            
            if (response.data?.token && response.data?.refreshToken) {
                await this.setTokens(
                    response.data.token,
                    response.data.refreshToken
                );
                
                this.logger.info('Tokens rotated successfully');
                return true;
            }
            
            return false;
        } catch (error) {
            this.logger.error('Token rotation failed', error);
            return false;
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    base64UrlDecode(str) {
        // Add padding
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        
        switch (str.length % 4) {
            case 0: break;
            case 2: str += '=='; break;
            case 3: str += '='; break;
        }
        
        // Decode
        return decodeURIComponent(
            atob(str).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')
        );
    }
    
    base64UrlEncode(str) {
        return btoa(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
    
    dispatchTokenExpired() {
        window.dispatchEvent(new CustomEvent('token:expired', {
            detail: { timestamp: Date.now() }
        }));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getAccessToken() {
        return this.accessToken;
    }
    
    getRefreshToken() {
        return this.refreshToken;
    }
    
    getDecodedToken() {
        return this.decodedToken ? { ...this.decodedToken } : null;
    }
    
    getTokenExpiry() {
        return this.tokenExpiry;
    }
    
    async forceRefresh() {
        return this.handleTokenRefresh();
    }
    
    destroy() {
        this.clearTokens();
        this.logger.info('Token manager destroyed');
    }
}

// Create singleton
const tokenManager = new TokenManager();

export default tokenManager;
export { TokenManager };