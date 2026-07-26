// components/table.js - Advanced Table Component 2026 (SECURE)
/**
 * E-Arsip Digital - Table Component
 * Version: 2026.1.0
 * Advanced data table with sorting, filtering, pagination, export
 * XSS-safe, PWA mobile support, no external dependencies
 */

var TableComponent = (function() {
    'use strict';
    
    // ============================================
    // SANITIZATION (CRITICAL)
    // ============================================
    function sanitizeHTML(str) {
        if (!str && str !== 0) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
    
    function sanitizeText(str) {
        if (!str && str !== 0) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    }
    
    // ============================================
    // UTILITY FUNCTIONS (No external dependencies)
    // ============================================
    function formatDate(value, format) {
        if (!value) return '-';
        try {
            var d = new Date(value);
            if (isNaN(d.getTime())) return sanitizeHTML(String(value));
            if (format === 'datetime') {
                return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) + 
                    ' ' + d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
            }
            return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
        } catch(e) {
            return sanitizeHTML(String(value));
        }
    }
    
    function formatCurrency(value) {
        if (value === null || value === undefined) return '-';
        var num = parseFloat(value);
        if (isNaN(num)) return sanitizeHTML(String(value));
        return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    
    function formatNumber(value) {
        if (value === null || value === undefined) return '-';
        var num = parseFloat(value);
        if (isNaN(num)) return sanitizeHTML(String(value));
        return num.toLocaleString('id-ID');
    }
    
    function sortBy(data, key, direction) {
        return data.slice().sort(function(a, b) {
            var valA = a[key];
            var valB = b[key];
            
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            
            if (typeof valA === 'number' && typeof valB === 'number') {
                return direction === 'asc' ? valA - valB : valB - valA;
            }
            
            var strA = String(valA).toLowerCase();
            var strB = String(valB).toLowerCase();
            
            if (direction === 'asc') return strA.localeCompare(strB);
            return strB.localeCompare(strA);
        });
    }
    
    function debounce(fn, ms) {
        var timer;
        return function() {
            var args = arguments;
            var ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
        };
    }
    
    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 100);
    }
    
    // ============================================
    // STATUS BADGE CONFIG
    // ============================================
    var STATUS_CONFIG = {
        active: { class: 'badge-success', label: 'Aktif' },
        inactive: { class: 'badge-secondary', label: 'Nonaktif' },
        pending: { class: 'badge-warning', label: 'Pending' },
        approved: { class: 'badge-info', label: 'Disetujui' },
        rejected: { class: 'badge-danger', label: 'Ditolak' },
        draft: { class: 'badge-light', label: 'Draft' },
        completed: { class: 'badge-success', label: 'Selesai' },
        proses: { class: 'badge-warning', label: 'Proses' }
    };
    
    // ============================================
    // TABLE CLASS
    // ============================================
    function TableInstance(options) {
        var self = this;
        
        // Config
        this.config = {
            container: null,
            columns: [],
            data: [],
            pageSize: 10,
            pageSizeOptions: [10, 25, 50, 100],
            currentPage: 1,
            sortColumn: null,
            sortDirection: 'asc',
            searchQuery: '',
            searchable: true,
            sortable: true,
            pagination: true,
            selectable: false,
            exportable: false,
            emptyMessage: 'Tidak ada data',
            loadingMessage: 'Memuat data...',
            errorMessage: 'Gagal memuat data',
            id: 'tbl-' + Date.now().toString(36)
        };
        
        // Merge options
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    this.config[key] = options[key];
                }
            }
        }
        
        // State
        this.state = {
            filteredData: [],
            selectedRows: {},
            isLoading: false,
            error: null,
            sortColumn: this.config.sortColumn,
            sortDirection: this.config.sortDirection,
            currentPage: this.config.currentPage,
            searchQuery: this.config.searchQuery
        };
        
        // Events
        this._listeners = {};
        
        // Container
        this.container = null;
        if (typeof this.config.container === 'string') {
            this.container = document.querySelector(this.config.container);
        } else {
            this.container = this.config.container;
        }
        
        // Initialize
        if (this.container) {
            this._init();
        }
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    TableInstance.prototype._init = function() {
        this._render();
        this._attachEvents();
        
        if (this.config.data.length > 0) {
            this.loadData(this.config.data);
        }
    };
    
    // ============================================
    // RENDER (XSS-SAFE DOM CREATION)
    // ============================================
    TableInstance.prototype._render = function() {
        if (!this.container) return;
        
        // Clear
        this.container.innerHTML = '';
        this.container.className = 'table-component-wrapper';
        
        var cfg = this.config;
        var state = this.state;
        
        // Build DOM tree safely
        var wrapper = document.createElement('div');
        wrapper.className = 'table-container';
        
        // Toolbar
        if (cfg.searchable || cfg.exportable || cfg.selectable) {
            wrapper.appendChild(this._createToolbar());
        }
        
        // Table content
        var content = document.createElement('div');
        content.className = 'table-content';
        
        var scroll = document.createElement('div');
        scroll.className = 'table-scroll';
        
        var table = document.createElement('table');
        table.className = 'data-table';
        table.setAttribute('role', 'grid');
        
        // Header
        table.appendChild(this._createHeader());
        
        // Body
        var tbody = document.createElement('tbody');
        tbody.id = cfg.id + '-tbody';
        this._renderBodyContent(tbody);
        table.appendChild(tbody);
        
        scroll.appendChild(table);
        content.appendChild(scroll);
        
        // Loading overlay
        var overlay = document.createElement('div');
        overlay.className = 'table-loading-overlay';
        overlay.id = cfg.id + '-overlay';
        overlay.style.display = 'none';
        var spinner = document.createElement('div');
        spinner.className = 'spinner';
        overlay.appendChild(spinner);
        content.appendChild(overlay);
        
        wrapper.appendChild(content);
        
        // Footer
        if (cfg.pagination) {
            wrapper.appendChild(this._createFooter());
        }
        
        this.container.appendChild(wrapper);
    };
    
    // ============================================
    // CREATE TOOLBAR
    // ============================================
    TableInstance.prototype._createToolbar = function() {
        var cfg = this.config;
        var toolbar = document.createElement('div');
        toolbar.className = 'table-toolbar';
        
        var left = document.createElement('div');
        left.className = 'toolbar-left';
        
        // Search
        if (cfg.searchable) {
            var searchDiv = document.createElement('div');
            searchDiv.className = 'table-search';
            
            var searchIcon = document.createElement('i');
            searchIcon.className = 'fas fa-search';
            searchDiv.appendChild(searchIcon);
            
            var searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Cari data...';
            searchInput.id = cfg.id + '-search';
            searchInput.value = this.state.searchQuery;
            searchInput.setAttribute('maxlength', '100');
            searchDiv.appendChild(searchInput);
            
            // Clear button
            if (this.state.searchQuery) {
                var clearBtn = document.createElement('button');
                clearBtn.className = 'search-clear';
                clearBtn.id = cfg.id + '-search-clear';
                clearBtn.innerHTML = '<i class="fas fa-times"></i>';
                searchDiv.appendChild(clearBtn);
            }
            
            left.appendChild(searchDiv);
        }
        
        toolbar.appendChild(left);
        
        var right = document.createElement('div');
        right.className = 'toolbar-right';
        
        // Export button
        if (cfg.exportable) {
            var exportBtn = document.createElement('button');
            exportBtn.className = 'btn btn-sm btn-outline';
            exportBtn.id = cfg.id + '-export-btn';
            exportBtn.innerHTML = '<i class="fas fa-download"></i> Export';
            right.appendChild(exportBtn);
        }
        
        // Page size
        if (cfg.pagination) {
            var psDiv = document.createElement('div');
            psDiv.className = 'page-size-selector';
            
            var psLabel1 = document.createElement('label');
            psLabel1.textContent = 'Tampilkan';
            psDiv.appendChild(psLabel1);
            
            var psSelect = document.createElement('select');
            psSelect.id = cfg.id + '-page-size';
            cfg.pageSizeOptions.forEach(function(size) {
                var opt = document.createElement('option');
                opt.value = size;
                opt.textContent = size;
                if (size === cfg.pageSize) opt.selected = true;
                psSelect.appendChild(opt);
            });
            psDiv.appendChild(psSelect);
            
            var psLabel2 = document.createElement('label');
            psLabel2.textContent = 'data';
            psDiv.appendChild(psLabel2);
            
            right.appendChild(psDiv);
        }
        
        toolbar.appendChild(right);
        
        return toolbar;
    };
    
    // ============================================
    // CREATE HEADER
    // ============================================
    TableInstance.prototype._createHeader = function() {
        var cfg = this.config;
        var state = this.state;
        var thead = document.createElement('thead');
        var tr = document.createElement('tr');
        
        // Select all checkbox
        if (cfg.selectable) {
            var thCheck = document.createElement('th');
            thCheck.className = 'col-checkbox';
            thCheck.style.width = '40px';
            
            var cbAll = document.createElement('input');
            cbAll.type = 'checkbox';
            cbAll.id = cfg.id + '-select-all';
            if (this._isAllSelected()) cbAll.checked = true;
            thCheck.appendChild(cbAll);
            tr.appendChild(thCheck);
        }
        
        // Column headers
        cfg.columns.forEach(function(col) {
            var th = document.createElement('th');
            if (col.width) th.style.width = col.width;
            
            if (col.sortable !== false && cfg.sortable) {
                th.className = 'sortable';
                th.setAttribute('data-column', col.key);
                th.style.cursor = 'pointer';
                
                if (state.sortColumn === col.key) {
                    th.classList.add('sorted');
                    th.setAttribute('aria-sort', state.sortDirection === 'asc' ? 'ascending' : 'descending');
                }
            }
            
            var thContent = document.createElement('div');
            thContent.className = 'th-content';
            
            var span = document.createElement('span');
            span.textContent = col.label || col.key; // SAFE: textContent
            thContent.appendChild(span);
            
            if (col.sortable !== false && cfg.sortable) {
                var sortIcons = document.createElement('span');
                sortIcons.className = 'sort-icons';
                
                var upIcon = document.createElement('i');
                upIcon.className = 'fas fa-sort-up';
                if (state.sortColumn === col.key && state.sortDirection === 'asc') {
                    upIcon.classList.add('active');
                }
                sortIcons.appendChild(upIcon);
                
                var downIcon = document.createElement('i');
                downIcon.className = 'fas fa-sort-down';
                if (state.sortColumn === col.key && state.sortDirection === 'desc') {
                    downIcon.classList.add('active');
                }
                sortIcons.appendChild(downIcon);
                
                thContent.appendChild(sortIcons);
            }
            
            th.appendChild(thContent);
            tr.appendChild(th);
        });
        
        // Actions column
        if (this._hasActions()) {
            var thAction = document.createElement('th');
            thAction.className = 'col-actions';
            thAction.style.width = '100px';
            thAction.textContent = 'Aksi';
            tr.appendChild(thAction);
        }
        
        thead.appendChild(tr);
        return thead;
    };
    
    // ============================================
    // RENDER BODY (XSS-SAFE)
    // ============================================
    TableInstance.prototype._renderBodyContent = function(tbody) {
        if (!tbody) return;
        
        // Clear
        tbody.innerHTML = '';
        
        var cfg = this.config;
        var state = this.state;
        
        // Loading state
        if (state.isLoading) {
            tbody.appendChild(this._createMessageRow('loading', cfg.loadingMessage));
            return;
        }
        
        // Error state
        if (state.error) {
            tbody.appendChild(this._createMessageRow('error', cfg.errorMessage, true));
            return;
        }
        
        // Empty state
        if (!state.filteredData || state.filteredData.length === 0) {
            tbody.appendChild(this._createMessageRow('empty', cfg.emptyMessage));
            return;
        }
        
        // Data rows
        var startIdx = (state.currentPage - 1) * cfg.pageSize;
        var endIdx = startIdx + cfg.pageSize;
        var pageData = state.filteredData.slice(startIdx, endIdx);
        var self = this;
        
        pageData.forEach(function(row, index) {
            var tr = document.createElement('tr');
            var rowId = row.id || (startIdx + index);
            tr.setAttribute('data-id', rowId);
            
            if (cfg.selectable && state.selectedRows[rowId]) {
                tr.classList.add('selected');
            }
            
            // Checkbox
            if (cfg.selectable) {
                var tdCheck = document.createElement('td');
                tdCheck.className = 'col-checkbox';
                
                var cbRow = document.createElement('input');
                cbRow.type = 'checkbox';
                cbRow.id = cfg.id + '-row-' + rowId;
                cbRow.setAttribute('data-row-id', rowId);
                if (state.selectedRows[rowId]) cbRow.checked = true;
                tdCheck.appendChild(cbRow);
                tr.appendChild(tdCheck);
            }
            
            // Data cells
            cfg.columns.forEach(function(col) {
                var td = document.createElement('td');
                if (col.className) td.className = col.className;
                if (col.align) td.style.textAlign = col.align;
                td.setAttribute('data-label', col.label || col.key);
                
                // Render cell content safely
                self._renderCellContent(td, row, col);
                tr.appendChild(td);
            });
            
            // Actions
            if (self._hasActions()) {
                var tdAction = document.createElement('td');
                tdAction.className = 'col-actions';
                
                var actionDiv = document.createElement('div');
                actionDiv.className = 'action-buttons';
                
                (cfg.actions || []).forEach(function(action) {
                    var btn = document.createElement('button');
                    btn.className = 'btn-action ' + (action.class || '');
                    btn.setAttribute('data-action', action.key);
                    btn.setAttribute('data-id', rowId);
                    btn.title = action.label || '';
                    if (action.disabled) btn.disabled = true;
                    btn.innerHTML = '<i class="' + action.icon + '"></i>';
                    actionDiv.appendChild(btn);
                });
                
                tdAction.appendChild(actionDiv);
                tr.appendChild(tdAction);
            }
            
            tbody.appendChild(tr);
        });
    };
    
    TableInstance.prototype._renderCellContent = function(td, row, col) {
        var value = row[col.key];
        
        // Custom formatter
        if (typeof col.formatter === 'function') {
            var formatted = col.formatter(value, row);
            if (typeof formatted === 'string') {
                // Trust the formatter to return safe HTML
                td.innerHTML = formatted;
            } else if (formatted instanceof HTMLElement) {
                td.appendChild(formatted);
            } else {
                td.textContent = sanitizeText(String(formatted || ''));
            }
            return;
        }
        
        // Custom renderer
        if (typeof col.render === 'function') {
            var rendered = col.render(value, row);
            if (typeof rendered === 'string') {
                td.innerHTML = rendered;
            } else if (rendered instanceof HTMLElement) {
                td.appendChild(rendered);
            } else {
                td.textContent = sanitizeText(String(rendered || ''));
            }
            return;
        }
        
        // Null/undefined
        if (value === null || value === undefined) {
            td.innerHTML = '<span class="text-muted">-</span>';
            return;
        }
        
        // Type-based rendering
        switch (col.type) {
            case 'date':
                td.textContent = formatDate(value, 'short');
                break;
            case 'datetime':
                td.textContent = formatDate(value, 'datetime');
                break;
            case 'currency':
                td.textContent = formatCurrency(value);
                break;
            case 'number':
                td.textContent = formatNumber(value);
                break;
            case 'boolean':
                td.innerHTML = value 
                    ? '<span class="badge badge-success">Ya</span>' 
                    : '<span class="badge badge-danger">Tidak</span>';
                break;
            case 'status':
                td.innerHTML = this._getStatusBadge(value);
                break;
            default:
                td.textContent = sanitizeText(String(value)); // SAFE: textContent
        }
    };
    
    TableInstance.prototype._getStatusBadge = function(status) {
        var config = STATUS_CONFIG[status] || { class: 'badge-secondary', label: status };
        return '<span class="badge ' + config.class + '">' + sanitizeHTML(config.label) + '</span>';
    };
    
    // ============================================
    // MESSAGE ROWS
    // ============================================
    TableInstance.prototype._createMessageRow = function(type, message, showRetry) {
        var tr = document.createElement('tr');
        tr.className = 'table-message-row';
        
        var td = document.createElement('td');
        td.colSpan = this._getColSpan();
        
        var div = document.createElement('div');
        div.className = 'table-message ' + type;
        
        if (type === 'loading') {
            var spinner = document.createElement('div');
            spinner.className = 'spinner';
            div.appendChild(spinner);
        } else {
            var icon = document.createElement('i');
            icon.className = 'fas ' + (type === 'empty' ? 'fa-inbox' : 'fa-exclamation-circle');
            div.appendChild(icon);
        }
        
        var span = document.createElement('span');
        span.textContent = message; // SAFE: textContent
        div.appendChild(span);
        
        if (showRetry) {
            var retryBtn = document.createElement('button');
            retryBtn.className = 'btn btn-sm btn-outline';
            retryBtn.id = this.config.id + '-retry';
            retryBtn.textContent = 'Coba Lagi';
            div.appendChild(retryBtn);
        }
        
        td.appendChild(div);
        tr.appendChild(td);
        
        return tr;
    };
    
    // ============================================
    // FOOTER
    // ============================================
    TableInstance.prototype._createFooter = function() {
        var cfg = this.config;
        var state = this.state;
        var footer = document.createElement('div');
        footer.className = 'table-footer';
        
        // Info
        var info = document.createElement('div');
        info.className = 'table-info';
        info.id = cfg.id + '-info';
        info.textContent = this._getShowingInfo();
        footer.appendChild(info);
        
        // Pagination
        var pagination = document.createElement('div');
        pagination.className = 'table-pagination';
        pagination.id = cfg.id + '-pagination';
        this._renderPaginationContent(pagination);
        footer.appendChild(pagination);
        
        return footer;
    };
    
    TableInstance.prototype._renderPaginationContent = function(container) {
        if (!container) return;
        container.innerHTML = '';
        
        var cfg = this.config;
        var state = this.state;
        var totalPages = Math.ceil((state.filteredData || []).length / cfg.pageSize);
        
        if (totalPages <= 1) return;
        
        // Previous
        var prevBtn = document.createElement('button');
        prevBtn.className = 'btn-page';
        prevBtn.setAttribute('data-page', 'prev');
        if (state.currentPage === 1) prevBtn.disabled = true;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        container.appendChild(prevBtn);
        
        // Pages
        var pages = this._getPageNumbers(state.currentPage, totalPages);
        var self = this;
        pages.forEach(function(p) {
            if (p === '...') {
                var ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                container.appendChild(ellipsis);
            } else {
                var pageBtn = document.createElement('button');
                pageBtn.className = 'btn-page';
                if (p === state.currentPage) pageBtn.classList.add('active');
                pageBtn.setAttribute('data-page', p);
                pageBtn.textContent = p;
                container.appendChild(pageBtn);
            }
        });
        
        // Next
        var nextBtn = document.createElement('button');
        nextBtn.className = 'btn-page';
        nextBtn.setAttribute('data-page', 'next');
        if (state.currentPage === totalPages) nextBtn.disabled = true;
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        container.appendChild(nextBtn);
    };
    
    TableInstance.prototype._getPageNumbers = function(current, total) {
        if (total <= 7) {
            var arr = [];
            for (var i = 1; i <= total; i++) arr.push(i);
            return arr;
        }
        
        var pages = [1];
        var start = Math.max(2, current - 1);
        var end = Math.min(total - 1, current + 1);
        
        if (current <= 3) end = Math.min(5, total - 1);
        if (current >= total - 2) start = Math.max(total - 4, 2);
        
        if (start > 2) pages.push('...');
        for (var j = start; j <= end; j++) pages.push(j);
        if (end < total - 1) pages.push('...');
        if (total > 1) pages.push(total);
        
        return pages;
    };
    
    // ============================================
    // EVENT HANDLING
    // ============================================
    TableInstance.prototype._attachEvents = function() {
        if (!this.container) return;
        
        var self = this;
        var cfg = this.config;
        
        // Delegated event handler
        this.container.addEventListener('click', function(e) {
            var target = e.target;
            
            // Sort header
            var th = target.closest('.sortable');
            if (th) {
                self.handleSort(th.dataset.column);
                return;
            }
            
            // Page button
            var pageBtn = target.closest('[data-page]');
            if (pageBtn && pageBtn.closest('.table-pagination')) {
                var page = pageBtn.dataset.page;
                self.handlePageChange(isNaN(page) ? page : parseInt(page));
                return;
            }
            
            // Select all
            if (target.id === cfg.id + '-select-all') {
                self.handleSelectAll(target.checked);
                return;
            }
            
            // Row checkbox
            if (target.dataset.rowId) {
                self.handleRowSelect(target.dataset.rowId, target.checked);
                return;
            }
            
            // Action button
            var actionBtn = target.closest('.btn-action');
            if (actionBtn) {
                var action = actionBtn.dataset.action;
                var rowId = actionBtn.dataset.id;
                self._emit('action', { action: action, rowId: rowId });
                return;
            }
            
            // Search clear
            if (target.closest('#' + cfg.id + '-search-clear')) {
                var searchInput = document.getElementById(cfg.id + '-search');
                if (searchInput) searchInput.value = '';
                self.handleSearch('');
                return;
            }
            
            // Export button
            if (target.closest('#' + cfg.id + '-export-btn')) {
                self.handleExport('csv');
                return;
            }
            
            // Retry button
            if (target.closest('#' + cfg.id + '-retry')) {
                self.loadData(self.config.data);
                return;
            }
        });
        
        // Search input
        var searchInput = document.getElementById(cfg.id + '-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(function() {
                self.handleSearch(this.value);
            }, 300));
        }
        
        // Page size change
        var pageSizeSelect = document.getElementById(cfg.id + '-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', function() {
                self.handlePageSizeChange(parseInt(this.value));
            });
        }
    };
    
    // ============================================
    // DATA MANAGEMENT
    // ============================================
    TableInstance.prototype.loadData = function(data) {
        this.config.data = data || [];
        this.state.filteredData = data ? data.slice() : [];
        this.state.selectedRows = {};
        this.state.currentPage = 1;
        this.state.error = null;
        
        this._applyFilters();
        this._refreshBody();
        this._refreshFooter();
    };
    
    TableInstance.prototype._applyFilters = function() {
        var data = (this.config.data || []).slice();
        var state = this.state;
        var cfg = this.config;
        
        // Search
        if (state.searchQuery) {
            var query = state.searchQuery.toLowerCase();
            data = data.filter(function(row) {
                return cfg.columns.some(function(col) {
                    var val = row[col.key];
                    if (val === null || val === undefined) return false;
                    return String(val).toLowerCase().indexOf(query) !== -1;
                });
            });
        }
        
        // Sort
        if (state.sortColumn) {
            data = sortBy(data, state.sortColumn, state.sortDirection);
        }
        
        this.state.filteredData = data;
        
        // Reset page if needed
        var totalPages = Math.ceil(data.length / cfg.pageSize);
        if (state.currentPage > totalPages && totalPages > 0) {
            state.currentPage = 1;
        }
    };
    
    // ============================================
    // HANDLERS
    // ============================================
    TableInstance.prototype.handleSort = function(columnKey) {
        var col = this.config.columns.find(function(c) { return c.key === columnKey; });
        if (!col || col.sortable === false) return;
        
        if (this.state.sortColumn === columnKey) {
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortColumn = columnKey;
            this.state.sortDirection = 'asc';
        }
        
        this._applyFilters();
        this._refreshAll();
        this._emit('sort', { column: columnKey, direction: this.state.sortDirection });
    };
    
    TableInstance.prototype.handleSearch = function(query) {
        this.state.searchQuery = query || '';
        this.state.currentPage = 1;
        this._applyFilters();
        this._refreshBody();
        this._refreshFooter();
    };
    
    TableInstance.prototype.handlePageChange = function(page) {
        var totalPages = Math.ceil((this.state.filteredData || []).length / this.config.pageSize);
        
        if (page === 'prev') page = Math.max(1, this.state.currentPage - 1);
        if (page === 'next') page = Math.min(totalPages, this.state.currentPage + 1);
        
        if (page >= 1 && page <= totalPages) {
            this.state.currentPage = page;
            this._refreshBody();
            this._refreshFooter();
            this._emit('pageChange', { page: page, totalPages: totalPages });
        }
    };
    
    TableInstance.prototype.handlePageSizeChange = function(size) {
        this.config.pageSize = size;
        this.state.currentPage = 1;
        this._refreshBody();
        this._refreshFooter();
        this._emit('pageSizeChange', { pageSize: size });
    };
    
    TableInstance.prototype.handleRowSelect = function(rowId, checked) {
        if (checked) {
            this.state.selectedRows[rowId] = true;
        } else {
            delete this.state.selectedRows[rowId];
        }
        this._refreshBody();
        this._emit('selectionChange', { selected: Object.keys(this.state.selectedRows) });
    };
    
    TableInstance.prototype.handleSelectAll = function(checked) {
        var self = this;
        var pageData = this._getCurrentPageData();
        
        if (checked) {
            pageData.forEach(function(row) {
                self.state.selectedRows[row.id || row._idx] = true;
            });
        } else {
            this.state.selectedRows = {};
        }
        
        this._refreshBody();
        this._emit('selectionChange', { selected: Object.keys(this.state.selectedRows) });
    };
    
    TableInstance.prototype.handleExport = function(format) {
        var data = Object.keys(this.state.selectedRows).length > 0
            ? this._getSelectedData()
            : this.state.filteredData;
        
        if (format === 'csv') {
            this._exportCSV(data);
        } else if (format === 'print') {
            this._printTable(data);
        }
    };
    
    // ============================================
    // EXPORT
    // ============================================
    TableInstance.prototype._exportCSV = function(data) {
        var cols = this.config.columns;
        var headers = cols.map(function(c) { return c.label || c.key; });
        
        var rows = data.map(function(row) {
            return cols.map(function(col) {
                var val = row[col.key];
                if (val === null || val === undefined) return '';
                // Escape CSV
                var str = String(val).replace(/"/g, '""');
                return '"' + str + '"';
            }).join(',');
        });
        
        var bom = '\uFEFF';
        var csv = bom + [headers.join(','), rows.join('\n')].join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, 'export-' + Date.now() + '.csv');
    };
    
    TableInstance.prototype._printTable = function(data) {
        var cols = this.config.columns;
        
        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cetak</title>';
        html += '<style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:6px;font-size:12px}th{background:#eee}@media print{@page{size:A4 landscape}}</style>';
        html += '</head><body><h2>Data Export</h2><table><thead><tr>';
        
        cols.forEach(function(c) {
            html += '<th>' + sanitizeHTML(c.label || c.key) + '</th>';
        });
        
        html += '</tr></thead><tbody>';
        
        data.forEach(function(row) {
            html += '<tr>';
            cols.forEach(function(col) {
                var val = row[col.key];
                html += '<td>' + sanitizeHTML(val !== null && val !== undefined ? String(val) : '') + '</td>';
            });
            html += '</tr>';
        });
        
        html += '</tbody></table><script>window.onload=function(){window.print();}<\/script></body></html>';
        
        var printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };
    
    // ============================================
    // REFRESH HELPERS
    // ============================================
    TableInstance.prototype._refreshBody = function() {
        var tbody = document.getElementById(this.config.id + '-tbody');
        if (tbody) this._renderBodyContent(tbody);
    };
    
    TableInstance.prototype._refreshFooter = function() {
        var pagination = document.getElementById(this.config.id + '-pagination');
        if (pagination) this._renderPaginationContent(pagination);
        
        var info = document.getElementById(this.config.id + '-info');
        if (info) info.textContent = this._getShowingInfo();
    };
    
    TableInstance.prototype._refreshAll = function() {
        // Rebuild header for sort indicators
        var table = this.container.querySelector('.data-table');
        if (table) {
            var thead = table.querySelector('thead');
            if (thead) {
                var newThead = this._createHeader();
                thead.parentNode.replaceChild(newThead, thead);
            }
        }
        this._refreshBody();
        this._refreshFooter();
    };
    
    // ============================================
    // HELPERS
    // ============================================
    TableInstance.prototype._getColSpan = function() {
        var span = this.config.columns.length;
        if (this.config.selectable) span++;
        if (this._hasActions()) span++;
        return span;
    };
    
    TableInstance.prototype._hasActions = function() {
        return this.config.actions && this.config.actions.length > 0;
    };
    
    TableInstance.prototype._isAllSelected = function() {
        var pageData = this._getCurrentPageData();
        if (pageData.length === 0) return false;
        var self = this;
        return pageData.every(function(row) {
            return self.state.selectedRows[row.id || row._idx];
        });
    };
    
    TableInstance.prototype._getCurrentPageData = function() {
        var startIdx = (this.state.currentPage - 1) * this.config.pageSize;
        var endIdx = startIdx + this.config.pageSize;
        return (this.state.filteredData || []).slice(startIdx, endIdx);
    };
    
    TableInstance.prototype._getSelectedData = function() {
        var self = this;
        var selectedIds = Object.keys(this.state.selectedRows);
        return (this.config.data || []).filter(function(row) {
            return selectedIds.indexOf(String(row.id)) !== -1;
        });
    };
    
    TableInstance.prototype._getShowingInfo = function() {
        var total = (this.state.filteredData || []).length;
        if (total === 0) return '0 data';
        var start = (this.state.currentPage - 1) * this.config.pageSize + 1;
        var end = Math.min(this.state.currentPage * this.config.pageSize, total);
        return start + '-' + end + ' dari ' + total + ' data';
    };
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    TableInstance.prototype._emit = function(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(function(cb) {
            try { cb(data); } catch(e) { console.error('Table event error:', e); }
        });
    };
    
    TableInstance.prototype.on = function(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return function() {
            this._listeners[event] = this._listeners[event].filter(function(cb) { return cb !== callback; });
        }.bind(this);
    };
    
    // ============================================
    // PUBLIC API
    // ============================================
    TableInstance.prototype.refresh = function() {
        this._applyFilters();
        this._refreshBody();
        this._refreshFooter();
    };
    
    TableInstance.prototype.setData = function(data) {
        this.loadData(data);
    };
    
    TableInstance.prototype.destroy = function() {
        if (this.container) this.container.innerHTML = '';
        this._listeners = {};
    };
    
    // ============================================
    // STATIC API
    // ============================================
    return {
        create: function(options) {
            return new TableInstance(options);
        }
    };
})();