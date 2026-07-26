// js/search.js - Enterprise Secure Search Engine 2026
/**
 * E-Arsip Digital - Advanced Search Engine
 * Version: 2026.1.0
 * Features: Full-text search, fuzzy search, filters, suggestions,
 *           offline search index, PWA-ready, secure rendering
 * Security: XSS prevention, input sanitization, safe HTML rendering
 */

import APP_CONFIG from '../config/config.js';

class SearchEngine {
    constructor(options = {}) {
        // ✅ FIX: Lazy load dependencies
        this.logger = null;
        this.utils = null;
        this.apiService = null;
        
        // Configuration
        this.config = {
            minQueryLength: 2,
            maxQueryLength: 200,
            debounceTime: 300,
            maxResults: 20,
            maxSuggestions: 5,
            maxRecentSearches: 10,
            searchFields: ['title', 'description', 'content', 'tags', 'author'],
            fuzzyThreshold: 0.3,
            cacheResults: true,
            cacheTTL: 300000, // 5 minutes
            maxCacheSize: 100,
            enableLocalSearch: true,
            enableOfflineIndex: true,
            ...APP_CONFIG?.search,
            ...options
        };
        
        // State
        this.query = '';
        this.results = [];
        this.suggestions = [];
        this.recentSearches = [];
        this.filters = {};
        this.isSearching = false;
        this.currentPage = 1;
        this.totalResults = 0;
        this.pageSize = 20;
        this.searchId = 0; // Track latest search
        
        // Cache
        this.cache = new Map();
        this.cacheOrder = []; // LRU
        
        // Local search index (offline)
        this.localIndex = null;
        this.localData = [];
        
        // DOM Elements
        this.input = null;
        this.resultsContainer = null;
        this.suggestionsContainer = null;
        this.clearButton = null;
        
        // Timers
        this.debounceTimer = null;
        this.suggestionsTimer = null;
        
        // Event handlers (for cleanup)
        this.handlers = {};
        
        // State
        this.initialized = false;
        this.isPWA = this.detectPWA();
        
        this.init();
    }
    
    async init() {
        try {
            await this.initDependencies();
            this.recentSearches = this.loadRecentSearches();
            
            if (this.config.enableOfflineIndex) {
                await this.loadLocalIndex();
            }
            
            this.log('info', 'Search engine initialized');
        } catch (error) {
            console.error('[Search] Initialization failed:', error);
        }
    }
    
    async initDependencies() {
        try {
            const loggerModule = await import('./logger.js');
            this.logger = new loggerModule.Logger('Search');
        } catch {
            this.logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
        }
        
        try {
            const utilsModule = await import('./utils.js');
            this.utils = utilsModule.default || utilsModule;
        } catch {
            this.utils = this.createFallbackUtils();
        }
        
        try {
            const apiModule = await import('./api.js');
            this.apiService = apiModule.default || apiModule;
        } catch {
            this.apiService = null;
        }
    }
    
    log(level, message, data = null) {
        if (this.logger?.[level]) {
            this.logger[level](message, data);
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    init(inputSelector, resultsSelector, suggestionsSelector = null) {
        this.input = this.resolveElement(inputSelector);
        this.resultsContainer = this.resolveElement(resultsSelector);
        this.suggestionsContainer = this.resolveElement(suggestionsSelector);
        
        if (!this.input || !this.resultsContainer) {
            throw new Error('Search input or results container not found');
        }
        
        // Set ARIA attributes
        this.input.setAttribute('role', 'combobox');
        this.input.setAttribute('aria-expanded', 'false');
        this.input.setAttribute('aria-autocomplete', 'list');
        this.input.setAttribute('aria-controls', 'search-suggestions');
        this.input.setAttribute('autocomplete', 'off');
        this.input.setAttribute('spellcheck', 'false');
        
        if (this.suggestionsContainer) {
            this.suggestionsContainer.id = 'search-suggestions';
            this.suggestionsContainer.setAttribute('role', 'listbox');
        }
        
        if (this.resultsContainer) {
            this.resultsContainer.setAttribute('role', 'region');
            this.resultsContainer.setAttribute('aria-label', 'Search Results');
            this.resultsContainer.setAttribute('aria-live', 'polite');
        }
        
        // Find clear button
        this.clearButton = this.input.parentElement?.querySelector('.search-clear');
        
        this.attachEventListeners();
        this.initialized = true;
        
        this.log('info', 'Search engine UI initialized');
    }
    
    resolveElement(selector) {
        if (!selector) return null;
        if (selector instanceof HTMLElement) return selector;
        return document.querySelector(selector);
    }
    
    attachEventListeners() {
        // Input handler
        this.handlers.input = this.handleInput.bind(this);
        this.input.addEventListener('input', this.handlers.input);
        
        // Keyboard navigation
        this.handlers.keydown = this.handleKeyDown.bind(this);
        this.input.addEventListener('keydown', this.handlers.keydown);
        
        // Focus/Blur
        this.handlers.focus = this.handleFocus.bind(this);
        this.input.addEventListener('focus', this.handlers.focus);
        
        this.handlers.blur = this.handleBlur.bind(this);
        this.input.addEventListener('blur', this.handlers.blur);
        
        // Clear button
        if (this.clearButton) {
            this.handlers.clear = () => this.clear();
            this.clearButton.addEventListener('click', this.handlers.clear);
        }
        
        // Click outside to close suggestions
        this.handlers.clickOutside = (event) => {
            if (!this.input?.contains(event.target) && 
                !this.suggestionsContainer?.contains(event.target)) {
                this.hideSuggestions();
            }
        };
        document.addEventListener('click', this.handlers.clickOutside);
    }
    
    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    handleInput(event) {
        const query = this.sanitizeInput(event.target.value);
        this.query = query;
        
        // Show clear button
        if (this.clearButton) {
            this.clearButton.style.display = query.length > 0 ? 'flex' : 'none';
        }
        
        if (query.length >= this.config.minQueryLength) {
            this.debouncedSearch(query);
            this.debouncedSuggestions(query);
        } else {
            this.clearResults();
            this.hideSuggestions();
            if (query.length === 0) {
                this.showRecentSearches();
            }
        }
    }
    
    handleKeyDown(event) {
        const suggestionsVisible = this.suggestionsContainer?.style.display !== 'none';
        
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                this.clear();
                this.input?.blur();
                break;
                
            case 'Enter':
                event.preventDefault();
                if (suggestionsVisible && this.highlightedSuggestionIndex >= 0) {
                    this.selectSuggestion(this.suggestions[this.highlightedSuggestionIndex]);
                } else if (this.query.length >= this.config.minQueryLength) {
                    this.saveRecentSearch(this.query);
                    this.search(this.query);
                    this.hideSuggestions();
                }
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                if (suggestionsVisible) {
                    this.navigateSuggestions(1);
                }
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                if (suggestionsVisible) {
                    this.navigateSuggestions(-1);
                }
                break;
                
            case 'Tab':
                if (suggestionsVisible && this.highlightedSuggestionIndex >= 0) {
                    event.preventDefault();
                    this.selectSuggestion(this.suggestions[this.highlightedSuggestionIndex]);
                }
                break;
        }
    }
    
    handleFocus() {
        if (this.query.length === 0) {
            this.showRecentSearches();
        } else if (this.suggestions.length > 0) {
            this.renderSuggestions();
        }
        
        this.input?.setAttribute('aria-expanded', 'true');
    }
    
    handleBlur() {
        setTimeout(() => {
            this.hideSuggestions();
            this.input?.setAttribute('aria-expanded', 'false');
        }, 200);
    }
    
    // ============================================
    // DEBOUNCED METHODS
    // ============================================
    
    debouncedSearch(query) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        
        this.debounceTimer = setTimeout(() => {
            this.search(query);
        }, this.config.debounceTime);
    }
    
    debouncedSuggestions(query) {
        if (this.suggestionsTimer) clearTimeout(this.suggestionsTimer);
        
        this.suggestionsTimer = setTimeout(() => {
            this.fetchSuggestions(query);
        }, 150);
    }
    
    // ============================================
    // SEARCH FUNCTIONALITY
    // ============================================
    
    async search(query, options = {}) {
        if (!query || query.length < this.config.minQueryLength) {
            this.clearResults();
            return;
        }
        
        // Increment search ID
        this.searchId++;
        const currentSearchId = this.searchId;
        
        // Check cache
        const cacheKey = this.getCacheKey(query, options);
        if (this.config.cacheResults && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheTTL) {
                this.updateCacheOrder(cacheKey);
                this.results = cached.results;
                this.totalResults = cached.total;
                this.renderResults();
                return;
            }
        }
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            let results = [];
            let total = 0;
            
            // Try remote search first
            if (this.apiService && navigator.onLine) {
                try {
                    const response = await this.remoteSearch(query, options);
                    results = response.results || [];
                    total = response.total || 0;
                } catch (error) {
                    this.log('warn', 'Remote search failed, trying local', {
                        error: error.message
                    });
                }
            }
            
            // Fallback to local search
            if (results.length === 0 && this.config.enableLocalSearch) {
                const localResult = this.localSearch(query);
                results = localResult;
                total = localResult.length;
            }
            
            // Check if this search was superseded
            if (currentSearchId !== this.searchId) return;
            
            // Process results
            this.results = results.map(result => ({
                ...result,
                highlightedFields: this.highlightResults(result, query)
            }));
            
            this.totalResults = total;
            this.currentPage = options.page || 1;
            
            // Cache results
            if (this.config.cacheResults) {
                this.addToCache(cacheKey, {
                    results: this.results,
                    total: this.totalResults
                });
            }
            
            this.renderResults();
            
            this.dispatchEvent('complete', {
                query,
                results: this.results,
                total: this.totalResults
            });
            
        } catch (error) {
            this.log('error', 'Search failed', { error: error.message });
            
            if (currentSearchId === this.searchId) {
                this.showError('Gagal melakukan pencarian. Silakan coba lagi.');
            }
        } finally {
            this.isSearching = false;
            this.hideLoading();
        }
    }
    
    async remoteSearch(query, options = {}) {
        if (!this.apiService) throw new Error('API service not available');
        
        const params = {
            q: query,
            fields: this.config.searchFields.join(','),
            page: options.page || this.currentPage,
            limit: options.limit || this.pageSize,
            filters: Object.keys(this.filters).length > 0 ? 
                encodeURIComponent(JSON.stringify(this.filters)) : undefined,
            fuzzy: this.config.fuzzyThreshold
        };
        
        // Remove undefined params
        Object.keys(params).forEach(key => {
            if (params[key] === undefined) delete params[key];
        });
        
        const response = await this.apiService.get('/api/search', params);
        return response.data || response;
    }
    
    async fetchSuggestions(query) {
        if (!query || query.length < this.config.minQueryLength) {
            this.hideSuggestions();
            return;
        }
        
        try {
            // Try remote suggestions
            if (this.apiService && navigator.onLine) {
                try {
                    const response = await this.apiService.get('/api/search/suggestions', {
                        q: query,
                        limit: this.config.maxSuggestions
                    });
                    
                    this.suggestions = response.data?.suggestions || [];
                } catch {
                    // Fallback to local
                    this.suggestions = this.localSuggestions(query);
                }
            } else {
                this.suggestions = this.localSuggestions(query);
            }
            
            this.highlightedSuggestionIndex = -1;
            this.renderSuggestions();
            
        } catch (error) {
            this.log('warn', 'Suggestions failed', { error: error.message });
        }
    }
    
    // ============================================
    // LOCAL SEARCH
    // ============================================
    
    localSearch(query, data = null) {
        const searchData = data || this.localData;
        const normalizedQuery = this.sanitizeInput(query).toLowerCase();
        const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 1);
        
        if (terms.length === 0) return [];
        
        const results = [];
        
        for (const item of searchData) {
            let score = 0;
            const matches = {};
            
            for (const field of this.config.searchFields) {
                const value = this.getFieldValue(item, field);
                if (!value) continue;
                
                const normalizedValue = String(value).toLowerCase();
                
                // Exact match
                if (normalizedValue === normalizedQuery) {
                    score += 100;
                    matches[field] = { type: 'exact' };
                }
                // Prefix match
                else if (normalizedValue.startsWith(normalizedQuery)) {
                    score += 50;
                    matches[field] = { type: 'prefix' };
                }
                // Contains
                else if (normalizedValue.includes(normalizedQuery)) {
                    score += 25;
                    matches[field] = { type: 'contains' };
                }
                // Fuzzy match
                else if (this.fuzzyMatch(normalizedQuery, normalizedValue) >= this.config.fuzzyThreshold) {
                    score += 10;
                    matches[field] = { type: 'fuzzy' };
                }
                
                // Word-by-word match
                for (const term of terms) {
                    if (normalizedValue.includes(term)) {
                        score += 5;
                    }
                }
                
                // Title field boost
                if (field === 'title') {
                    score *= 1.5;
                }
            }
            
            if (score > 0) {
                results.push({ ...item, _score: score, _matches: matches });
            }
        }
        
        // Sort by score descending
        results.sort((a, b) => b._score - a._score);
        
        return results.slice(0, this.config.maxResults);
    }
    
    localSuggestions(query) {
        const normalizedQuery = this.sanitizeInput(query).toLowerCase();
        const suggestions = new Set();
        
        // Get suggestions from local data
        for (const item of this.localData.slice(0, 100)) {
            for (const field of this.config.searchFields.slice(0, 2)) {
                const value = this.getFieldValue(item, field);
                if (!value) continue;
                
                const words = String(value).toLowerCase().split(/\s+/);
                for (const word of words) {
                    if (word.startsWith(normalizedQuery) && word.length > 2) {
                        suggestions.add(word);
                    }
                }
            }
        }
        
        // Add from recent searches
        this.recentSearches.forEach(search => {
            if (search.toLowerCase().startsWith(normalizedQuery)) {
                suggestions.add(search);
            }
        });
        
        return [...suggestions]
            .slice(0, this.config.maxSuggestions)
            .map(text => ({ text }));
    }
    
    fuzzyMatch(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const maxLen = Math.max(len1, len2);
        
        if (maxLen === 0) return 1;
        if (Math.abs(len1 - len2) > maxLen * 0.5) return 0;
        
        // Levenshtein distance
        const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        
        return 1 - matrix[len1][len2] / maxLen;
    }
    
    highlightResults(result, query) {
        const highlighted = {};
        const terms = this.sanitizeInput(query)
            .toLowerCase()
            .split(/\s+/)
            .filter(t => t.length > 1);
        
        for (const field of this.config.searchFields) {
            const value = this.getFieldValue(result, field);
            if (!value) continue;
            
            let highlightedValue = this.escapeHtml(String(value));
            
            for (const term of terms) {
                const escapedTerm = this.escapeRegex(term);
                const regex = new RegExp(`(${escapedTerm})`, 'gi');
                highlightedValue = highlightedValue.replace(
                    regex,
                    '<mark class="search-highlight">$1</mark>'
                );
            }
            
            if (highlightedValue !== this.escapeHtml(String(value))) {
                highlighted[field] = highlightedValue;
            }
        }
        
        return highlighted;
    }
    
    // ============================================
    // OFFLINE INDEX
    // ============================================
    
    async loadLocalIndex() {
        try {
            const stored = localStorage.getItem('search_index');
            if (stored) {
                const index = JSON.parse(stored);
                if (index.version === APP_CONFIG.app?.version) {
                    this.localData = index.data || [];
                    this.log('info', 'Local search index loaded', {
                        items: this.localData.length
                    });
                    return;
                }
            }
        } catch (error) {
            this.log('warn', 'Failed to load local index', { error: error.message });
        }
        
        this.localData = [];
    }
    
    async buildLocalIndex(data) {
        if (!Array.isArray(data)) return;
        
        this.localData = data.map(item => {
            const indexed = { ...item };
            // Ensure searchable fields exist
            this.config.searchFields.forEach(field => {
                if (!(field in indexed)) {
                    indexed[field] = '';
                }
            });
            return indexed;
        });
        
        // Store in localStorage (compressed)
        try {
            const index = {
                version: APP_CONFIG.app?.version || '2026.1.0',
                data: this.localData.slice(0, 1000), // Max 1000 items
                updatedAt: Date.now()
            };
            
            const json = JSON.stringify(index);
            if (json.length < 5000000) { // 5MB limit
                localStorage.setItem('search_index', json);
            }
        } catch {
            this.log('warn', 'Failed to store local index');
        }
        
        this.log('info', 'Local search index built', {
            items: this.localData.length
        });
    }
    
    // ============================================
    // FILTER MANAGEMENT
    // ============================================
    
    setFilter(key, value) {
        this.filters[key] = value;
        this.currentPage = 1;
        
        if (this.query) {
            this.search(this.query);
        }
        
        this.dispatchEvent('filterChange', { filters: this.filters });
    }
    
    removeFilter(key) {
        delete this.filters[key];
        
        if (this.query) {
            this.search(this.query);
        }
        
        this.dispatchEvent('filterChange', { filters: this.filters });
    }
    
    clearFilters() {
        this.filters = {};
        
        if (this.query) {
            this.search(this.query);
        }
        
        this.dispatchEvent('filterChange', { filters: {} });
    }
    
    getActiveFilters() {
        return { ...this.filters };
    }
    
    hasActiveFilters() {
        return Object.keys(this.filters).length > 0;
    }
    
    // ============================================
    // PAGINATION
    // ============================================
    
    nextPage() {
        if (this.currentPage * this.pageSize < this.totalResults) {
            this.currentPage++;
            this.search(this.query, { page: this.currentPage });
        }
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.search(this.query, { page: this.currentPage });
        }
    }
    
    goToPage(page) {
        if (page >= 1 && (page - 1) * this.pageSize < this.totalResults) {
            this.currentPage = page;
            this.search(this.query, { page });
        }
    }
    
    getPaginationInfo() {
        return {
            currentPage: this.currentPage,
            totalPages: Math.max(1, Math.ceil(this.totalResults / this.pageSize)),
            totalResults: this.totalResults,
            pageSize: this.pageSize,
            hasNext: this.currentPage * this.pageSize < this.totalResults,
            hasPrev: this.currentPage > 1
        };
    }
    
    // ============================================
    // RECENT SEARCHES
    // ============================================
    
    saveRecentSearch(query) {
        if (!query || query.length < 2) return;
        
        const sanitized = this.sanitizeInput(query);
        
        this.recentSearches = this.recentSearches.filter(
            s => s.toLowerCase() !== sanitized.toLowerCase()
        );
        
        this.recentSearches.unshift(sanitized);
        
        if (this.recentSearches.length > this.config.maxRecentSearches) {
            this.recentSearches = this.recentSearches.slice(0, this.config.maxRecentSearches);
        }
        
        this.persistRecentSearches();
    }
    
    loadRecentSearches() {
        try {
            const stored = localStorage.getItem('recent_searches');
            return stored ? JSON.parse(stored).slice(0, this.config.maxRecentSearches) : [];
        } catch {
            return [];
        }
    }
    
    persistRecentSearches() {
        try {
            localStorage.setItem('recent_searches', JSON.stringify(this.recentSearches));
        } catch {
            // Storage full
        }
    }
    
    clearRecentSearches() {
        this.recentSearches = [];
        localStorage.removeItem('recent_searches');
        this.hideSuggestions();
    }
    
    showRecentSearches() {
        if (this.recentSearches.length === 0 || !this.suggestionsContainer) return;
        
        const html = `
            <div class="search-suggestions">
                <div class="suggestions-header">
                    <span>Pencarian Terbaru</span>
                    <button class="btn-clear-recent" type="button" aria-label="Clear recent searches">
                        Hapus
                    </button>
                </div>
                ${this.recentSearches.map(query => `
                    <div class="suggestion-item recent" role="option" 
                         data-query="${this.escapeHtml(query)}" tabindex="-1">
                        <i class="fas fa-history" aria-hidden="true"></i>
                        <span>${this.escapeHtml(query)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.safeSetHTML(this.suggestionsContainer, html);
        this.suggestionsContainer.style.display = 'block';
        this.input?.setAttribute('aria-expanded', 'true');
        
        this.attachSuggestionHandlers();
        this.attachClearRecentHandler();
    }
    
    // ============================================
    // RENDERING (Security-focused)
    // ============================================
    
    renderResults() {
        if (!this.resultsContainer) return;
        
        if (this.results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty" role="status">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <h4>Tidak ada hasil ditemukan</h4>
                    <p>Coba kata kunci yang berbeda atau kurangi filter</p>
                </div>
            `;
            return;
        }
        
        const pagination = this.getPaginationInfo();
        
        const html = `
            <div class="search-results">
                <div class="search-results-header">
                    <span>Ditemukan <strong>${this.totalResults}</strong> hasil untuk "${this.escapeHtml(this.query)}"</span>
                    ${this.hasActiveFilters() ? `
                        <button class="btn btn-sm btn-ghost clear-filters-btn" type="button">
                            <i class="fas fa-times" aria-hidden="true"></i> Hapus Filter
                        </button>
                    ` : ''}
                </div>
                
                <div class="search-results-list" role="list">
                    ${this.results.map((result, index) => this.renderResultItem(result, index)).join('')}
                </div>
                
                ${pagination.totalPages > 1 ? this.renderPagination(pagination) : ''}
            </div>
        `;
        
        this.safeSetHTML(this.resultsContainer, html);
        this.attachResultHandlers();
        this.attachFilterHandlers();
        
        // Scroll to top of results
        this.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    renderResultItem(result, index) {
        const title = result.highlightedFields?.title || this.escapeHtml(result.title || 'Tanpa Judul');
        const description = result.highlightedFields?.description || 
                          result.highlightedFields?.content || 
                          this.truncateText(this.stripHtml(String(result.description || '')), 200);
        
        return `
            <div class="search-result-item" role="listitem" 
                 data-index="${index}" data-id="${this.escapeHtml(String(result.id || ''))}" tabindex="0">
                <div class="result-type-badge">${this.escapeHtml(String(result.type || 'Dokumen'))}</div>
                <h3 class="result-title">${title}</h3>
                <p class="result-description">${description}</p>
                <div class="result-meta">
                    ${result.date || result.createdAt ? `
                        <span><i class="fas fa-calendar" aria-hidden="true"></i> 
                            ${this.formatDate(result.date || result.createdAt)}
                        </span>
                    ` : ''}
                    ${result.author ? `
                        <span><i class="fas fa-user" aria-hidden="true"></i> 
                            ${this.escapeHtml(String(result.author))}
                        </span>
                    ` : ''}
                    ${result.tags?.length > 0 ? `
                        <span class="result-tags">
                            ${result.tags.map(tag => 
                                `<span class="tag">${this.escapeHtml(String(tag))}</span>`
                            ).join('')}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    renderPagination(pagination) {
        const { currentPage, totalPages } = pagination;
        let pagesHTML = '';
        
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pagesHTML += this.renderPageButton(i, i === currentPage);
            }
        } else {
            pagesHTML += this.renderPageButton(1, 1 === currentPage);
            
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);
            
            if (currentPage <= 3) end = Math.min(5, totalPages - 1);
            if (currentPage >= totalPages - 2) start = Math.max(totalPages - 4, 2);
            
            if (start > 2) pagesHTML += '<span class="page-ellipsis" aria-hidden="true">...</span>';
            
            for (let i = start; i <= end; i++) {
                pagesHTML += this.renderPageButton(i, i === currentPage);
            }
            
            if (end < totalPages - 1) pagesHTML += '<span class="page-ellipsis" aria-hidden="true">...</span>';
            
            pagesHTML += this.renderPageButton(totalPages, totalPages === currentPage);
        }
        
        return `
            <nav class="search-pagination" aria-label="Search results pagination">
                <button class="btn-page" data-page="prev" 
                    ${!pagination.hasPrev ? 'disabled' : ''} 
                    aria-label="Previous page">
                    <i class="fas fa-chevron-left" aria-hidden="true"></i>
                </button>
                ${pagesHTML}
                <button class="btn-page" data-page="next" 
                    ${!pagination.hasNext ? 'disabled' : ''} 
                    aria-label="Next page">
                    <i class="fas fa-chevron-right" aria-hidden="true"></i>
                </button>
            </nav>
        `;
    }
    
    renderPageButton(page, isActive) {
        return `
            <button class="btn-page ${isActive ? 'active' : ''}" 
                data-page="${page}" 
                ${isActive ? 'aria-current="page"' : ''}
                aria-label="Page ${page}">
                ${page}
            </button>
        `;
    }
    
    renderSuggestions() {
        if (!this.suggestionsContainer || this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        const html = `
            <div class="search-suggestions" role="listbox" id="search-suggestions-list">
                ${this.suggestions.map((s, i) => {
                    const text = s.text || s;
                    return `
                        <div class="suggestion-item ${i === this.highlightedSuggestionIndex ? 'highlighted' : ''}" 
                             role="option" 
                             data-query="${this.escapeHtml(text)}" 
                             data-index="${i}"
                             aria-selected="${i === this.highlightedSuggestionIndex}"
                             tabindex="-1">
                            <i class="fas fa-search" aria-hidden="true"></i>
                            <span>${this.highlightSuggestion(text, this.query)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        this.safeSetHTML(this.suggestionsContainer, html);
        this.suggestionsContainer.style.display = 'block';
        this.input?.setAttribute('aria-expanded', 'true');
        
        this.attachSuggestionHandlers();
    }
    
    highlightSuggestion(text, query) {
        const safeText = this.escapeHtml(String(text));
        const safeQuery = this.escapeHtml(this.sanitizeInput(query));
        const terms = safeQuery.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        
        let result = safeText;
        
        for (const term of terms) {
            const escapedTerm = this.escapeRegex(term);
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
        }
        
        return result;
    }
    
    attachSuggestionHandlers() {
        this.suggestionsContainer?.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const query = item.dataset.query;
                this.selectSuggestion({ text: query });
            });
        });
    }
    
    attachClearRecentHandler() {
        const clearBtn = this.suggestionsContainer?.querySelector('.btn-clear-recent');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearRecentSearches());
        }
    }
    
    attachResultHandlers() {
        this.resultsContainer?.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const index = parseInt(item.dataset.index);
                this.dispatchEvent('resultClick', {
                    id,
                    result: this.results[index]
                });
            });
            
            // Keyboard accessibility
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });
        
        this.resultsContainer?.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev') this.prevPage();
                else if (page === 'next') this.nextPage();
                else this.goToPage(parseInt(page));
            });
        });
    }
    
    attachFilterHandlers() {
        const clearBtn = this.resultsContainer?.querySelector('.clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilters());
        }
    }
    
    navigateSuggestions(direction) {
        const maxIndex = this.suggestions.length - 1;
        if (maxIndex < 0) return;
        
        this.highlightedSuggestionIndex += direction;
        
        if (this.highlightedSuggestionIndex < 0) {
            this.highlightedSuggestionIndex = maxIndex;
        } else if (this.highlightedSuggestionIndex > maxIndex) {
            this.highlightedSuggestionIndex = 0;
        }
        
        this.renderSuggestions();
    }
    
    selectSuggestion(suggestion) {
        const query = suggestion.text || suggestion;
        if (this.input) {
            this.input.value = query;
        }
        this.query = query;
        this.saveRecentSearch(query);
        this.search(query);
        this.hideSuggestions();
    }
    
    // ============================================
    // UI HELPERS
    // ============================================
    
    showLoading() {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = `
                <div class="search-loading" role="status" aria-label="Searching">
                    <div class="spinner" aria-hidden="true"></div>
                    <p>Mencari...</p>
                </div>
            `;
        }
    }
    
    hideLoading() {}
    
    showError(message) {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = `
                <div class="search-error" role="alert">
                    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                    <p>${this.escapeHtml(message)}</p>
                    <button class="btn btn-sm btn-outline retry-search" type="button">
                        Coba Lagi
                    </button>
                </div>
            `;
            
            this.resultsContainer.querySelector('.retry-search')?.addEventListener('click', () => {
                this.search(this.query);
            });
        }
    }
    
    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
            this.input?.setAttribute('aria-expanded', 'false');
        }
        this.highlightedSuggestionIndex = -1;
    }
    
    clearResults() {
        this.results = [];
        this.totalResults = 0;
        this.currentPage = 1;
        
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = '';
        }
    }
    
    clear() {
        this.query = '';
        this.results = [];
        this.suggestions = [];
        this.currentPage = 1;
        this.highlightedSuggestionIndex = -1;
        
        if (this.input) {
            this.input.value = '';
            this.input.focus();
        }
        
        if (this.clearButton) {
            this.clearButton.style.display = 'none';
        }
        
        this.clearResults();
        this.hideSuggestions();
    }
    
    safeSetHTML(element, html) {
        if (window.trustedTypes?.createPolicy) {
            try {
                const policy = window.trustedTypes.createPolicy('search', {
                    createHTML: (input) => input
                });
                element.innerHTML = policy.createHTML(html);
                return;
            } catch {}
        }
        
        element.innerHTML = this.sanitizeHTML(html);
    }
    
    sanitizeHTML(html) {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/on\w+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript\s*:/gi, 'blocked:');
    }
    
    // ============================================
    // SANITIZATION & SECURITY
    // ============================================
    
    sanitizeInput(input) {
        if (!input) return '';
        
        return String(input)
            .replace(/[<>"'`]/g, '') // Remove dangerous characters
            .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
            .trim()
            .substring(0, this.config.maxQueryLength);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        const entities = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
        };
        return String(str).replace(/[&<>"'\/]/g, char => entities[char]);
    }
    
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    stripHtml(html) {
        return String(html).replace(/<[^>]*>/g, '');
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getFieldValue(obj, field) {
        return field.split('.').reduce((value, key) => 
            value && value[key] !== undefined ? value[key] : null, obj);
    }
    
    getCacheKey(query, options = {}) {
        return [query, JSON.stringify(this.filters), options.page || 1].join('|');
    }
    
    addToCache(key, value) {
        // LRU eviction
        if (this.cache.size >= this.config.maxCacheSize) {
            const oldest = this.cacheOrder.shift();
            this.cache.delete(oldest);
        }
        
        this.cache.set(key, { ...value, timestamp: Date.now() });
        this.cacheOrder.push(key);
    }
    
    updateCacheOrder(key) {
        this.cacheOrder = this.cacheOrder.filter(k => k !== key);
        this.cacheOrder.push(key);
    }
    
    detectPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone;
    }
    
    dispatchEvent(type, detail) {
        window.dispatchEvent(new CustomEvent(`search:${type}`, {
            detail: { ...detail, timestamp: Date.now() }
        }));
    }
    
    createFallbackUtils() {
        return {
            debounce: (fn, delay) => {
                let timer;
                return (...args) => {
                    clearTimeout(timer);
                    timer = setTimeout(() => fn(...args), delay);
                };
            },
            escapeRegex: (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            truncate: (str, len) => str?.length > len ? str.substring(0, len) + '...' : str,
            stripHtml: (str) => String(str).replace(/<[^>]*>/g, ''),
            formatDate: (date) => date
        };
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    searchNow(query) {
        const sanitized = this.sanitizeInput(query);
        if (this.input) this.input.value = sanitized;
        this.query = sanitized;
        this.saveRecentSearch(sanitized);
        this.search(sanitized);
    }
    
    setConfig(key, value) {
        this.config[key] = value;
    }
    
    getResults() {
        return [...this.results];
    }
    
    getQuery() {
        return this.query;
    }
    
    async buildIndex(data) {
        await this.buildLocalIndex(data);
    }
    
    destroy() {
        // Remove event listeners
        if (this.input) {
            ['input', 'keydown', 'focus', 'blur'].forEach(event => {
                if (this.handlers[event]) {
                    this.input.removeEventListener(event, this.handlers[event]);
                }
            });
        }
        
        if (this.clearButton && this.handlers.clear) {
            this.clearButton.removeEventListener('click', this.handlers.clear);
        }
        
        if (this.handlers.clickOutside) {
            document.removeEventListener('click', this.handlers.clickOutside);
        }
        
        // Clear timers
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.suggestionsTimer) clearTimeout(this.suggestionsTimer);
        
        // Clear cache
        this.cache.clear();
        this.cacheOrder = [];
        
        this.log('info', 'Search engine destroyed');
    }
}

// Create singleton
const searchEngine = new SearchEngine();

// Make available globally
if (typeof window !== 'undefined') {
    window.searchEngine = searchEngine;
}

export default searchEngine;
export { SearchEngine };