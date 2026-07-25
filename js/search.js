// js/search.js - Advanced Search Module 2026
/**
 * E-Arsip Digital - Advanced Search Engine
 * Version: 2026.1.0
 * Features: Full-text search, fuzzy search, filters, suggestions, recent searches
 */

import { Logger } from './logger.js';
import utils from './utils.js';
import apiService from './api.js';

class SearchEngine {
    constructor(options = {}) {
        this.logger = new Logger('Search');
        
        // Configuration
        this.config = {
            minQueryLength: 2,
            debounceTime: 300,
            maxResults: 10,
            maxSuggestions: 5,
            searchFields: ['title', 'description', 'content', 'tags'],
            fuzzyThreshold: 0.3,
            cacheResults: true,
            cacheTTL: 300000, // 5 minutes
            ...options
        };
        
        // State
        this.query = '';
        this.results = [];
        this.suggestions = [];
        this.recentSearches = this.loadRecentSearches();
        this.filters = {};
        this.isSearching = false;
        this.currentPage = 1;
        this.totalResults = 0;
        this.pageSize = 20;
        
        // Cache
        this.cache = new Map();
        
        // DOM Elements
        this.input = null;
        this.resultsContainer = null;
        this.suggestionsContainer = null;
        
        // Bind methods
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.debouncedSearch = utils.debounce(this.search.bind(this), this.config.debounceTime);
        
        this.initialized = false;
    }
    
    init(inputSelector, resultsSelector, suggestionsSelector = null) {
        this.input = typeof inputSelector === 'string' 
            ? document.querySelector(inputSelector) 
            : inputSelector;
        
        this.resultsContainer = typeof resultsSelector === 'string'
            ? document.querySelector(resultsSelector)
            : resultsSelector;
        
        this.suggestionsContainer = typeof suggestionsSelector === 'string'
            ? document.querySelector(suggestionsSelector)
            : suggestionsSelector;
        
        if (!this.input || !this.resultsContainer) {
            throw new Error('Search input or results container not found');
        }
        
        this.attachEventListeners();
        this.initialized = true;
        
        this.logger.info('Search engine initialized', {
            minQueryLength: this.config.minQueryLength
        });
    }
    
    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    attachEventListeners() {
        this.input.addEventListener('input', this.handleInput);
        this.input.addEventListener('keydown', this.handleKeyDown);
        this.input.addEventListener('focus', this.handleFocus);
        this.input.addEventListener('blur', this.handleBlur);
        
        // Clear search button
        const clearBtn = this.input.parentElement?.querySelector('.search-clear');
        clearBtn?.addEventListener('click', () => this.clear());
    }
    
    handleInput(event) {
        const query = event.target.value.trim();
        this.query = query;
        
        if (query.length >= this.config.minQueryLength) {
            this.debouncedSearch(query);
            this.showSuggestions(query);
        } else {
            this.clearResults();
            this.hideSuggestions();
            if (query.length === 0) {
                this.showRecentSearches();
            }
        }
    }
    
    handleKeyDown(event) {
        switch (event.key) {
            case 'Escape':
                this.clear();
                this.input.blur();
                break;
                
            case 'Enter':
                event.preventDefault();
                if (this.query.length >= this.config.minQueryLength) {
                    this.saveRecentSearch(this.query);
                    this.search(this.query);
                    this.hideSuggestions();
                }
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                this.navigateResults('next');
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.navigateResults('prev');
                break;
        }
    }
    
    handleFocus() {
        if (this.query.length === 0) {
            this.showRecentSearches();
        } else if (this.suggestions.length > 0) {
            this.showSuggestions(this.query);
        }
    }
    
    handleBlur() {
        // Delay hide to allow click on suggestions
        setTimeout(() => {
            this.hideSuggestions();
        }, 200);
    }
    
    // ============================================
    // SEARCH FUNCTIONALITY
    // ============================================
    
    async search(query, options = {}) {
        if (!query || query.length < this.config.minQueryLength) {
            this.clearResults();
            return;
        }
        
        // Check cache
        const cacheKey = this.getCacheKey(query, options);
        if (this.config.cacheResults && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheTTL) {
                this.results = cached.results;
                this.totalResults = cached.total;
                this.renderResults();
                return;
            }
        }
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            const searchParams = {
                q: query,
                fields: this.config.searchFields.join(','),
                page: options.page || this.currentPage,
                limit: options.limit || this.pageSize,
                filters: JSON.stringify(this.filters),
                fuzzy: this.config.fuzzyThreshold
            };
            
            const response = await apiService.get('/api/search', searchParams);
            
            this.results = response.data?.results || [];
            this.totalResults = response.data?.total || 0;
            this.currentPage = options.page || 1;
            
            // Cache results
            if (this.config.cacheResults) {
                this.cache.set(cacheKey, {
                    results: this.results,
                    total: this.totalResults,
                    timestamp: Date.now()
                });
            }
            
            // Highlight results
            this.results = this.results.map(result => ({
                ...result,
                highlightedFields: this.highlightResults(result, query)
            }));
            
            this.renderResults();
            
            // Dispatch event
            this.dispatchEvent('search:complete', {
                query,
                results: this.results,
                total: this.totalResults
            });
            
        } catch (error) {
            this.logger.error('Search failed', error);
            this.showError('Gagal melakukan pencarian');
        } finally {
            this.isSearching = false;
            this.hideLoading();
        }
    }
    
    async showSuggestions(query) {
        if (!query || query.length < this.config.minQueryLength) {
            this.hideSuggestions();
            return;
        }
        
        try {
            const response = await apiService.get('/api/search/suggestions', {
                q: query,
                limit: this.config.maxSuggestions
            });
            
            this.suggestions = response.data?.suggestions || [];
            this.renderSuggestions();
            
        } catch (error) {
            this.logger.warn('Suggestions failed', error);
        }
    }
    
    // ============================================
    // SEARCH ALGORITHMS
    // ============================================
    
    /**
     * Perform local search on provided data
     */
    localSearch(query, data, fields = null) {
        const searchFields = fields || this.config.searchFields;
        const normalizedQuery = query.toLowerCase();
        const results = [];
        
        for (const item of data) {
            let score = 0;
            const matches = {};
            
            for (const field of searchFields) {
                const value = this.getFieldValue(item, field);
                if (!value) continue;
                
                const normalizedValue = String(value).toLowerCase();
                
                // Exact match
                if (normalizedValue === normalizedQuery) {
                    score += 100;
                    matches[field] = { type: 'exact', value };
                }
                // Starts with
                else if (normalizedValue.startsWith(normalizedQuery)) {
                    score += 50;
                    matches[field] = { type: 'prefix', value };
                }
                // Contains
                else if (normalizedValue.includes(normalizedQuery)) {
                    score += 25;
                    matches[field] = { type: 'contains', value };
                }
                // Fuzzy match
                else if (this.fuzzyMatch(normalizedQuery, normalizedValue) >= this.config.fuzzyThreshold) {
                    score += 10;
                    matches[field] = { type: 'fuzzy', value };
                }
                
                // Word-by-word match
                const words = normalizedQuery.split(/\s+/);
                const valueWords = normalizedValue.split(/\s+/);
                
                for (const word of words) {
                    if (word.length < 2) continue;
                    
                    for (const valueWord of valueWords) {
                        if (valueWord === word) {
                            score += 15;
                        } else if (valueWord.startsWith(word)) {
                            score += 5;
                        }
                    }
                }
            }
            
            if (score > 0) {
                results.push({ ...item, _score: score, _matches: matches });
            }
        }
        
        // Sort by score
        results.sort((a, b) => b._score - a._score);
        
        return results.slice(0, this.config.maxResults);
    }
    
    /**
     * Fuzzy string matching using Levenshtein distance
     */
    fuzzyMatch(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const maxLen = Math.max(len1, len2);
        
        if (maxLen === 0) return 1;
        
        // Levenshtein distance matrix
        const matrix = [];
        
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
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
        
        const distance = matrix[len1][len2];
        return 1 - distance / maxLen;
    }
    
    /**
     * Highlight search terms in results
     */
    highlightResults(result, query) {
        const highlighted = {};
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        
        for (const field of this.config.searchFields) {
            const value = this.getFieldValue(result, field);
            if (!value) continue;
            
            let highlightedValue = String(value);
            
            for (const term of terms) {
                const regex = new RegExp(`(${utils.escapeRegex(term)})`, 'gi');
                highlightedValue = highlightedValue.replace(regex, '<mark class="search-highlight">$1</mark>');
            }
            
            if (highlightedValue !== String(value)) {
                highlighted[field] = highlightedValue;
            }
        }
        
        return highlighted;
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
    }
    
    removeFilter(key) {
        delete this.filters[key];
        
        if (this.query) {
            this.search(this.query);
        }
    }
    
    clearFilters() {
        this.filters = {};
        
        if (this.query) {
            this.search(this.query);
        }
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
            totalPages: Math.ceil(this.totalResults / this.pageSize),
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
        
        // Remove duplicate
        this.recentSearches = this.recentSearches.filter(s => s !== query);
        
        // Add to front
        this.recentSearches.unshift(query);
        
        // Limit to 10
        if (this.recentSearches.length > 10) {
            this.recentSearches = this.recentSearches.slice(0, 10);
        }
        
        this.saveToStorage();
    }
    
    loadRecentSearches() {
        try {
            const stored = localStorage.getItem('recent_searches');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }
    
    saveToStorage() {
        try {
            localStorage.setItem('recent_searches', JSON.stringify(this.recentSearches));
        } catch (error) {
            this.logger.warn('Failed to save recent searches', error);
        }
    }
    
    clearRecentSearches() {
        this.recentSearches = [];
        localStorage.removeItem('recent_searches');
    }
    
    showRecentSearches() {
        if (this.recentSearches.length === 0 || !this.suggestionsContainer) return;
        
        this.suggestionsContainer.innerHTML = `
            <div class="search-suggestions">
                <div class="suggestions-header">
                    <span>Pencarian Terbaru</span>
                    <button class="btn-clear-recent" onclick="searchEngine.clearRecentSearches()">
                        Hapus
                    </button>
                </div>
                ${this.recentSearches.map(query => `
                    <div class="suggestion-item recent" data-query="${query}">
                        <i class="fas fa-history"></i>
                        <span>${query}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.suggestionsContainer.style.display = 'block';
        
        // Attach click handlers
        this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                const query = item.dataset.query;
                this.input.value = query;
                this.query = query;
                this.search(query);
                this.hideSuggestions();
            });
        });
    }
    
    // ============================================
    // RENDERING
    // ============================================
    
    renderResults() {
        if (!this.resultsContainer) return;
        
        if (this.results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <h4>Tidak ada hasil ditemukan</h4>
                    <p>Coba kata kunci yang berbeda atau kurangi filter</p>
                </div>
            `;
            return;
        }
        
        const pagination = this.getPaginationInfo();
        
        this.resultsContainer.innerHTML = `
            <div class="search-results">
                <div class="search-results-header">
                    <span>Ditemukan ${this.totalResults} hasil untuk "${this.query}"</span>
                    ${this.hasActiveFilters() ? `
                        <button class="btn btn-sm btn-ghost" onclick="searchEngine.clearFilters()">
                            <i class="fas fa-times"></i> Hapus Filter
                        </button>
                    ` : ''}
                </div>
                
                <div class="search-results-list">
                    ${this.results.map((result, index) => this.renderResultItem(result, index)).join('')}
                </div>
                
                ${pagination.totalPages > 1 ? this.renderPagination(pagination) : ''}
            </div>
        `;
        
        // Attach event handlers
        this.attachResultHandlers();
    }
    
    renderResultItem(result, index) {
        const highlightedTitle = result.highlightedFields?.title || result.title || 'Tanpa Judul';
        const highlightedDesc = result.highlightedFields?.description || 
                               result.highlightedFields?.content || 
                               result.description || '';
        
        return `
            <div class="search-result-item" data-index="${index}" data-id="${result.id}">
                <div class="result-type-badge">${result.type || 'Dokumen'}</div>
                <h3 class="result-title">${highlightedTitle}</h3>
                <p class="result-description">${utils.truncate(utils.stripHtml(highlightedDesc), 200)}</p>
                <div class="result-meta">
                    <span><i class="fas fa-calendar"></i> ${utils.formatDate(result.date || result.createdAt, 'medium')}</span>
                    <span><i class="fas fa-user"></i> ${result.author || '-'}</span>
                    ${result.tags ? `
                        <span class="result-tags">
                            ${result.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    renderPagination(pagination) {
        const { currentPage, totalPages } = pagination;
        let pages = '';
        
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages += `<button class="btn-page ${i === currentPage ? 'active' : ''}" 
                    data-page="${i}">${i}</button>`;
            }
        } else {
            pages += `<button class="btn-page ${1 === currentPage ? 'active' : ''}" data-page="1">1</button>`;
            
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);
            
            if (currentPage <= 3) end = Math.min(5, totalPages - 1);
            if (currentPage >= totalPages - 2) start = Math.max(totalPages - 4, 2);
            
            if (start > 2) pages += '<span class="page-ellipsis">...</span>';
            
            for (let i = start; i <= end; i++) {
                pages += `<button class="btn-page ${i === currentPage ? 'active' : ''}" 
                    data-page="${i}">${i}</button>`;
            }
            
            if (end < totalPages - 1) pages += '<span class="page-ellipsis">...</span>';
            
            pages += `<button class="btn-page ${totalPages === currentPage ? 'active' : ''}" 
                data-page="${totalPages}">${totalPages}</button>`;
        }
        
        return `
            <div class="search-pagination">
                <button class="btn-page" data-page="prev" ${!pagination.hasPrev ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                ${pages}
                <button class="btn-page" data-page="next" ${!pagination.hasNext ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }
    
    renderSuggestions() {
        if (!this.suggestionsContainer || this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionsContainer.innerHTML = `
            <div class="search-suggestions">
                ${this.suggestions.map(s => `
                    <div class="suggestion-item" data-query="${s.text || s}">
                        <i class="fas fa-search"></i>
                        <span>${this.highlightSuggestion(s.text || s, this.query)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.suggestionsContainer.style.display = 'block';
        
        // Attach click handlers
        this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                const query = item.dataset.query;
                this.input.value = query;
                this.query = query;
                this.saveRecentSearch(query);
                this.search(query);
                this.hideSuggestions();
            });
        });
    }
    
    highlightSuggestion(text, query) {
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        let result = text;
        
        for (const term of terms) {
            const regex = new RegExp(`(${utils.escapeRegex(term)})`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
        }
        
        return result;
    }
    
    attachResultHandlers() {
        // Result click
        this.resultsContainer?.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.dispatchEvent('search:resultClick', { id, result: this.results[item.dataset.index] });
            });
        });
        
        // Pagination
        this.resultsContainer?.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev') this.prevPage();
                else if (page === 'next') this.nextPage();
                else this.goToPage(parseInt(page));
            });
        });
    }
    
    // ============================================
    // UI HELPERS
    // ============================================
    
    showLoading() {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = `
                <div class="search-loading">
                    <div class="spinner"></div>
                    <p>Mencari...</p>
                </div>
            `;
        }
    }
    
    hideLoading() {
        // Loading state removed when results render
    }
    
    showError(message) {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                    <button class="btn btn-sm btn-outline" onclick="searchEngine.search(searchEngine.query)">
                        Coba Lagi
                    </button>
                </div>
            `;
        }
    }
    
    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
        }
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
        
        if (this.input) {
            this.input.value = '';
            this.input.focus();
        }
        
        this.clearResults();
        this.hideSuggestions();
    }
    
    navigateResults(direction) {
        const items = this.resultsContainer?.querySelectorAll('.search-result-item');
        if (!items || items.length === 0) return;
        
        const current = this.resultsContainer?.querySelector('.search-result-item.focused');
        let nextIndex = 0;
        
        if (current) {
            const currentIndex = Array.from(items).indexOf(current);
            current.classList.remove('focused');
            
            if (direction === 'next') {
                nextIndex = (currentIndex + 1) % items.length;
            } else {
                nextIndex = (currentIndex - 1 + items.length) % items.length;
            }
        }
        
        items[nextIndex].classList.add('focused');
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getFieldValue(obj, field) {
        return field.split('.').reduce((value, key) => 
            value && value[key] !== undefined ? value[key] : null, obj);
    }
    
    getCacheKey(query, options = {}) {
        const parts = [query, JSON.stringify(this.filters), options.page || 1];
        return parts.join('|');
    }
    
    dispatchEvent(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    searchNow(query) {
        this.input.value = query;
        this.query = query;
        this.saveRecentSearch(query);
        this.search(query);
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
    
    destroy() {
        if (this.input) {
            this.input.removeEventListener('input', this.handleInput);
            this.input.removeEventListener('keydown', this.handleKeyDown);
            this.input.removeEventListener('focus', this.handleFocus);
            this.input.removeEventListener('blur', this.handleBlur);
        }
        
        this.cache.clear();
        this.logger.info('Search engine destroyed');
    }
}

// Create singleton
const searchEngine = new SearchEngine();

// Make available globally
window.searchEngine = searchEngine;

export default searchEngine;
export { SearchEngine };