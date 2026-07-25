// components/table.js - Advanced Table Component 2026
/**
 * E-Arsip Digital - Table Component
 * Version: 2026.1.0
 * Advanced data table with sorting, filtering, pagination, and export
 */

import utils from '../js/utils.js';
import { Logger } from '../js/logger.js';

class TableComponent {
    constructor(options = {}) {
        this.logger = new Logger('TableComponent');
        
        // Configuration
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
            loading: false,
            emptyMessage: 'Tidak ada data',
            loadingMessage: 'Memuat data...',
            errorMessage: 'Gagal memuat data',
            ...options
        };
        
        // State
        this.state = {
            filteredData: [],
            selectedRows: new Set(),
            isLoading: false,
            error: null,
            sortColumn: this.config.sortColumn,
            sortDirection: this.config.sortDirection,
            currentPage: this.config.currentPage,
            searchQuery: this.config.searchQuery
        };
        
        // DOM Elements
        this.elements = {};
        
        // Bind methods
        this.handleSort = this.handleSort.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handlePageChange = this.handlePageChange.bind(this);
        this.handleSelectAll = this.handleSelectAll.bind(this);
        this.handleExport = this.handleExport.bind(this);
        
        // Initialize
        if (this.config.container) {
            this.init();
        }
    }
    
    async init() {
        try {
            this.render();
            this.attachEventListeners();
            
            if (this.config.data.length > 0) {
                this.loadData(this.config.data);
            }
            
            this.logger.debug('Table component initialized', {
                columns: this.config.columns.length,
                rows: this.config.data.length
            });
        } catch (error) {
            this.logger.error('Table initialization failed', error);
            this.showError(error.message);
        }
    }
    
    // ============================================
    // RENDERING
    // ============================================
    
    render() {
        const container = this.getContainer();
        if (!container) return;
        
        container.innerHTML = this.getTableHTML();
        container.className = 'table-component-wrapper';
        
        // Cache DOM elements
        this.cacheElements();
    }
    
    getTableHTML() {
        return `
            <div class="table-container">
                <!-- Table Toolbar -->
                ${this.renderToolbar()}
                
                <!-- Table Content -->
                <div class="table-content">
                    <div class="table-scroll">
                        <table class="data-table" role="grid">
                            <thead>
                                ${this.renderHeader()}
                            </thead>
                            <tbody id="${this.getTableBodyId()}">
                                ${this.renderBody()}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Loading Overlay -->
                    ${this.renderLoadingOverlay()}
                </div>
                
                <!-- Table Footer -->
                ${this.renderFooter()}
            </div>
        `;
    }
    
    renderToolbar() {
        const { searchable, exportable, selectable } = this.config;
        
        if (!searchable && !exportable) return '';
        
        return `
            <div class="table-toolbar">
                <div class="toolbar-left">
                    ${searchable ? this.renderSearch() : ''}
                    ${selectable ? this.renderBulkActions() : ''}
                </div>
                <div class="toolbar-right">
                    ${exportable ? this.renderExportButton() : ''}
                    ${this.renderPageSizeSelector()}
                </div>
            </div>
        `;
    }
    
    renderSearch() {
        return `
            <div class="table-search">
                <i class="fas fa-search"></i>
                <input 
                    type="text" 
                    class="search-input" 
                    placeholder="Cari data..." 
                    id="${this.getId('search-input')}"
                    value="${this.state.searchQuery}"
                >
                ${this.state.searchQuery ? `
                    <button class="search-clear" id="${this.getId('search-clear')}">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    renderBulkActions() {
        const selectedCount = this.state.selectedRows.size;
        
        return `
            <div class="bulk-actions ${selectedCount > 0 ? 'visible' : ''}">
                <span class="selected-count">${selectedCount} terpilih</span>
                <button class="btn btn-sm btn-danger" id="${this.getId('bulk-delete')}">
                    <i class="fas fa-trash"></i> Hapus
                </button>
                <button class="btn btn-sm btn-primary" id="${this.getId('bulk-export')}">
                    <i class="fas fa-download"></i> Export
                </button>
            </div>
        `;
    }
    
    renderExportButton() {
        return `
            <div class="export-dropdown">
                <button class="btn btn-sm btn-outline" id="${this.getId('export-btn')}">
                    <i class="fas fa-download"></i> Export
                </button>
                <div class="export-menu">
                    <button data-format="csv">
                        <i class="fas fa-file-csv"></i> CSV
                    </button>
                    <button data-format="excel">
                        <i class="fas fa-file-excel"></i> Excel
                    </button>
                    <button data-format="pdf">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button data-format="print">
                        <i class="fas fa-print"></i> Print
                    </button>
                </div>
            </div>
        `;
    }
    
    renderPageSizeSelector() {
        const { pageSizeOptions, pageSize } = this.config;
        
        return `
            <div class="page-size-selector">
                <label>Tampilkan</label>
                <select id="${this.getId('page-size')}">
                    ${pageSizeOptions.map(size => `
                        <option value="${size}" ${size === pageSize ? 'selected' : ''}>
                            ${size}
                        </option>
                    `).join('')}
                </select>
                <label>data</label>
            </div>
        `;
    }
    
    renderHeader() {
        const { columns, sortable, selectable } = this.config;
        const { sortColumn, sortDirection } = this.state;
        
        return `
            <tr>
                ${selectable ? `
                    <th class="col-checkbox" style="width: 40px;">
                        <input type="checkbox" id="${this.getId('select-all')}" 
                            ${this.isAllSelected() ? 'checked' : ''}>
                    </th>
                ` : ''}
                ${columns.map(col => `
                    <th class="${col.sortable !== false && sortable ? 'sortable' : ''} 
                               ${sortColumn === col.key ? 'sorted' : ''}"
                        data-column="${col.key}"
                        style="${col.width ? `width: ${col.width}` : ''}"
                        aria-sort="${sortColumn === col.key ? 
                            sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'}"
                    >
                        <div class="th-content">
                            <span>${col.label || col.key}</span>
                            ${col.sortable !== false && sortable ? `
                                <span class="sort-icons">
                                    <i class="fas fa-sort-up ${sortColumn === col.key && sortDirection === 'asc' ? 'active' : ''}"></i>
                                    <i class="fas fa-sort-down ${sortColumn === col.key && sortDirection === 'desc' ? 'active' : ''}"></i>
                                </span>
                            ` : ''}
                        </div>
                    </th>
                `).join('')}
                ${this.hasActions() ? '<th class="col-actions" style="width: 100px;">Aksi</th>' : ''}
            </tr>
        `;
    }
    
    renderBody() {
        const { isLoading, error, filteredData } = this.state;
        const { emptyMessage, loadingMessage, errorMessage, pageSize, selectable } = this.config;
        
        if (isLoading) {
            return this.renderLoadingRow(loadingMessage);
        }
        
        if (error) {
            return this.renderErrorRow(errorMessage);
        }
        
        if (!filteredData || filteredData.length === 0) {
            return this.renderEmptyRow(emptyMessage);
        }
        
        const startIndex = (this.state.currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageData = filteredData.slice(startIndex, endIndex);
        
        return pageData.map((row, index) => `
            <tr class="${selectable && this.state.selectedRows.has(row.id) ? 'selected' : ''}"
                data-id="${row.id || index}">
                ${selectable ? `
                    <td class="col-checkbox">
                        <input type="checkbox" 
                            id="${this.getId(`row-${row.id || index}`)}"
                            ${this.state.selectedRows.has(row.id) ? 'checked' : ''}
                            data-row-id="${row.id || index}">
                    </td>
                ` : ''}
                ${this.config.columns.map(col => `
                    <td class="${col.className || ''}" 
                        data-label="${col.label || col.key}"
                        style="${col.align ? `text-align: ${col.align}` : ''}">
                        ${this.renderCell(row, col)}
                    </td>
                `).join('')}
                ${this.hasActions() ? this.renderActions(row) : ''}
            </tr>
        `).join('');
    }
    
    renderCell(row, column) {
        let value = row[column.key];
        
        // Apply formatter if exists
        if (column.formatter) {
            return column.formatter(value, row);
        }
        
        // Apply renderer if exists
        if (column.render) {
            return column.render(value, row);
        }
        
        // Default rendering
        if (value === null || value === undefined) {
            return '<span class="text-muted">-</span>';
        }
        
        if (column.type === 'date') {
            return utils.formatDate(value, 'medium');
        }
        
        if (column.type === 'datetime') {
            return utils.formatDate(value, 'datetime');
        }
        
        if (column.type === 'currency') {
            return utils.formatCurrency(value);
        }
        
        if (column.type === 'number') {
            return utils.formatNumber(value);
        }
        
        if (column.type === 'boolean') {
            return value ? 
                '<span class="badge badge-success">Ya</span>' : 
                '<span class="badge badge-danger">Tidak</span>';
        }
        
        if (column.type === 'status') {
            return this.renderStatusBadge(value);
        }
        
        return value.toString();
    }
    
    renderStatusBadge(status) {
        const statusConfig = {
            active: { class: 'badge-success', label: 'Aktif' },
            inactive: { class: 'badge-secondary', label: 'Nonaktif' },
            pending: { class: 'badge-warning', label: 'Pending' },
            approved: { class: 'badge-info', label: 'Disetujui' },
            rejected: { class: 'badge-danger', label: 'Ditolak' },
            draft: { class: 'badge-light', label: 'Draft' },
            completed: { class: 'badge-success', label: 'Selesai' }
        };
        
        const config = statusConfig[status] || { class: 'badge-secondary', label: status };
        return `<span class="badge ${config.class}">${config.label}</span>`;
    }
    
    renderActions(row) {
        const actions = this.config.actions || [];
        
        return `
            <td class="col-actions">
                <div class="action-buttons">
                    ${actions.map(action => `
                        <button class="btn-action ${action.class || ''}"
                            data-action="${action.key}"
                            data-id="${row.id}"
                            title="${action.label}"
                            ${action.disabled ? 'disabled' : ''}>
                            <i class="${action.icon}"></i>
                        </button>
                    `).join('')}
                </div>
            </td>
        `;
    }
    
    renderLoadingRow(message) {
        const colspan = this.getColSpan();
        
        return `
            <tr class="table-message-row">
                <td colspan="${colspan}">
                    <div class="table-message loading">
                        <div class="spinner"></div>
                        <span>${message}</span>
                    </div>
                </td>
            </tr>
        `;
    }
    
    renderEmptyRow(message) {
        const colspan = this.getColSpan();
        
        return `
            <tr class="table-message-row">
                <td colspan="${colspan}">
                    <div class="table-message empty">
                        <i class="fas fa-inbox"></i>
                        <span>${message}</span>
                    </div>
                </td>
            </tr>
        `;
    }
    
    renderErrorRow(message) {
        const colspan = this.getColSpan();
        
        return `
            <tr class="table-message-row">
                <td colspan="${colspan}">
                    <div class="table-message error">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${message}</span>
                        <button class="btn btn-sm btn-outline" id="${this.getId('retry-btn')}">
                            Coba Lagi
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    renderLoadingOverlay() {
        return `
            <div class="table-loading-overlay ${this.state.isLoading ? 'visible' : ''}">
                <div class="spinner"></div>
            </div>
        `;
    }
    
    renderFooter() {
        const { pagination } = this.config;
        
        if (!pagination) return '';
        
        const { filteredData } = this.state;
        const { pageSize } = this.config;
        const totalPages = Math.ceil(filteredData.length / pageSize);
        const { currentPage } = this.state;
        
        return `
            <div class="table-footer">
                <div class="table-info">
                    Menampilkan ${this.getShowingInfo()}
                </div>
                <div class="table-pagination">
                    <button class="btn-page" ${currentPage === 1 ? 'disabled' : ''} 
                        data-page="prev">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    ${this.renderPageNumbers(currentPage, totalPages)}
                    <button class="btn-page" ${currentPage === totalPages ? 'disabled' : ''} 
                        data-page="next">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    renderPageNumbers(current, total) {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => `
                <button class="btn-page ${current === i + 1 ? 'active' : ''}" 
                    data-page="${i + 1}">${i + 1}</button>
            `).join('');
        }
        
        let pages = [];
        
        // Always show first page
        pages.push(1);
        
        // Calculate range
        let start = Math.max(2, current - 1);
        let end = Math.min(total - 1, current + 1);
        
        // Adjust range
        if (current <= 3) {
            end = Math.min(5, total - 1);
        }
        if (current >= total - 2) {
            start = Math.max(total - 4, 2);
        }
        
        // Add ellipsis after first page
        if (start > 2) {
            pages.push('...');
        }
        
        // Add middle pages
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        // Add ellipsis before last page
        if (end < total - 1) {
            pages.push('...');
        }
        
        // Always show last page
        if (total > 1) {
            pages.push(total);
        }
        
        return pages.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            }
            return `
                <button class="btn-page ${current === page ? 'active' : ''}" 
                    data-page="${page}">${page}</button>
            `;
        }).join('');
    }
    
    // ============================================
    // DATA MANAGEMENT
    // ============================================
    
    loadData(data) {
        this.config.data = data;
        this.state.filteredData = [...data];
        this.state.selectedRows.clear();
        this.state.currentPage = 1;
        this.state.error = null;
        
        this.applyFilters();
        this.renderBody();
        this.updateFooter();
        this.updateBulkActions();
    }
    
    appendData(data) {
        this.config.data = [...this.config.data, ...data];
        this.state.filteredData = [...this.state.filteredData, ...data];
        
        this.renderBody();
        this.updateFooter();
    }
    
    updateRow(rowId, updatedData) {
        const index = this.config.data.findIndex(row => row.id === rowId);
        if (index !== -1) {
            this.config.data[index] = { ...this.config.data[index], ...updatedData };
        }
        
        const filteredIndex = this.state.filteredData.findIndex(row => row.id === rowId);
        if (filteredIndex !== -1) {
            this.state.filteredData[filteredIndex] = { 
                ...this.state.filteredData[filteredIndex], 
                ...updatedData 
            };
        }
        
        this.renderBody();
    }
    
    removeRow(rowId) {
        this.config.data = this.config.data.filter(row => row.id !== rowId);
        this.state.filteredData = this.state.filteredData.filter(row => row.id !== rowId);
        this.state.selectedRows.delete(rowId);
        
        this.renderBody();
        this.updateFooter();
        this.updateBulkActions();
    }
    
    removeSelectedRows() {
        const selectedIds = Array.from(this.state.selectedRows);
        this.config.data = this.config.data.filter(row => !selectedIds.includes(row.id));
        this.state.filteredData = this.state.filteredData.filter(row => !selectedIds.includes(row.id));
        this.state.selectedRows.clear();
        
        this.renderBody();
        this.updateFooter();
        this.updateBulkActions();
    }
    
    // ============================================
    // FILTERING & SORTING
    // ============================================
    
    applyFilters() {
        let data = [...this.config.data];
        
        // Apply search filter
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            data = data.filter(row => {
                return this.config.columns.some(col => {
                    const value = row[col.key];
                    if (value === null || value === undefined) return false;
                    return value.toString().toLowerCase().includes(query);
                });
            });
        }
        
        // Apply sorting
        if (this.state.sortColumn) {
            const column = this.config.columns.find(col => col.key === this.state.sortColumn);
            data = utils.sortBy(data, this.state.sortColumn, this.state.sortDirection);
            
            if (column?.sortFunction) {
                data.sort((a, b) => {
                    const result = column.sortFunction(a, b);
                    return this.state.sortDirection === 'desc' ? -result : result;
                });
            }
        }
        
        this.state.filteredData = data;
        
        // Reset to first page if current page exceeds total pages
        const totalPages = Math.ceil(data.length / this.config.pageSize);
        if (this.state.currentPage > totalPages && totalPages > 0) {
            this.state.currentPage = 1;
        }
    }
    
    handleSort(columnKey) {
        const column = this.config.columns.find(col => col.key === columnKey);
        if (!column || column.sortable === false) return;
        
        if (this.state.sortColumn === columnKey) {
            // Toggle direction
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column sort
            this.state.sortColumn = columnKey;
            this.state.sortDirection = 'asc';
        }
        
        this.applyFilters();
        this.renderBody();
        this.renderHeader();
        
        // Emit event
        this.emit('sort', {
            column: columnKey,
            direction: this.state.sortDirection
        });
    }
    
    handleSearch(query) {
        this.state.searchQuery = query;
        this.state.currentPage = 1;
        
        this.applyFilters();
        this.renderBody();
        this.updateFooter();
    }
    
    // ============================================
    // PAGINATION
    // ============================================
    
    handlePageChange(page) {
        const totalPages = Math.ceil(this.state.filteredData.length / this.config.pageSize);
        
        if (page === 'prev') {
            page = Math.max(1, this.state.currentPage - 1);
        } else if (page === 'next') {
            page = Math.min(totalPages, this.state.currentPage + 1);
        }
        
        if (page >= 1 && page <= totalPages) {
            this.state.currentPage = page;
            this.renderBody();
            this.updateFooter();
            
            // Scroll to top of table
            this.scrollToTop();
            
            // Emit event
            this.emit('pageChange', { page, totalPages });
        }
    }
    
    handlePageSizeChange(size) {
        this.config.pageSize = parseInt(size);
        this.state.currentPage = 1;
        
        this.renderBody();
        this.updateFooter();
        
        // Emit event
        this.emit('pageSizeChange', { pageSize: this.config.pageSize });
    }
    
    // ============================================
    // SELECTION
    // ============================================
    
    handleRowSelect(rowId, checked) {
        if (checked) {
            this.state.selectedRows.add(rowId);
        } else {
            this.state.selectedRows.delete(rowId);
        }
        
        this.updateBulkActions();
        this.renderBody();
        
        // Emit event
        this.emit('selectionChange', {
            selected: Array.from(this.state.selectedRows)
        });
    }
    
    handleSelectAll(checked) {
        if (checked) {
            const pageData = this.getCurrentPageData();
            pageData.forEach(row => this.state.selectedRows.add(row.id));
        } else {
            this.state.selectedRows.clear();
        }
        
        this.updateBulkActions();
        this.renderBody();
        
        // Emit event
        this.emit('selectionChange', {
            selected: Array.from(this.state.selectedRows)
        });
    }
    
    isAllSelected() {
        const pageData = this.getCurrentPageData();
        if (pageData.length === 0) return false;
        return pageData.every(row => this.state.selectedRows.has(row.id));
    }
    
    getSelectedRows() {
        return this.config.data.filter(row => this.state.selectedRows.has(row.id));
    }
    
    // ============================================
    // EXPORT
    // ============================================
    
    async handleExport(format) {
        const data = this.state.selectedRows.size > 0 
            ? this.getSelectedRows() 
            : this.state.filteredData;
        
        this.logger.info('Exporting data', { format, rowCount: data.length });
        
        switch (format) {
            case 'csv':
                this.exportCSV(data);
                break;
            case 'excel':
                await this.exportExcel(data);
                break;
            case 'pdf':
                await this.exportPDF(data);
                break;
            case 'print':
                this.printTable(data);
                break;
        }
    }
    
    exportCSV(data) {
        const columns = this.config.columns;
        const headers = columns.map(col => col.label || col.key);
        
        const rows = data.map(row => 
            columns.map(col => {
                const value = row[col.key];
                return value !== null && value !== undefined ? `"${value}"` : '';
            }).join(',')
        );
        
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        utils.downloadFile(url, `export-${Date.now()}.csv`);
        URL.revokeObjectURL(url);
    }
    
    async exportExcel(data) {
        try {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
            
            XLSX.writeFile(workbook, `export-${Date.now()}.xlsx`);
        } catch (error) {
            this.logger.error('Excel export failed', error);
            this.showError('Gagal mengekspor ke Excel');
        }
    }
    
    async exportPDF(data) {
        // PDF export implementation
        this.logger.warn('PDF export not implemented');
        this.showError('Ekspor PDF belum tersedia');
    }
    
    printTable(data) {
        const columns = this.config.columns;
        
        const printWindow = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Table</title>
                <link rel="stylesheet" href="/css/print.css">
            </head>
            <body>
                <h2>Data Export</h2>
                <table border="1">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col.label || col.key}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${columns.map(col => `<td>${row[col.key] || ''}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = () => window.print();
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
    }
    
    // ============================================
    // EVENT HANDLING
    // ============================================
    
    attachEventListeners() {
        const container = this.getContainer();
        if (!container) return;
        
        // Sort clicks
        container.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.dataset.column);
            });
        });
        
        // Search input
        const searchInput = container.querySelector(`#${this.getId('search-input')}`);
        if (searchInput) {
            searchInput.addEventListener('input', utils.debounce((e) => {
                this.handleSearch(e.target.value);
            }, 300));
        }
        
        // Search clear
        const searchClear = container.querySelector(`#${this.getId('search-clear')}`);
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                this.handleSearch('');
                searchInput.value = '';
            });
        }
        
        // Page size change
        const pageSizeSelect = container.querySelector(`#${this.getId('page-size')}`);
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.handlePageSizeChange(e.target.value);
            });
        }
        
        // Pagination clicks
        container.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.handlePageChange(isNaN(page) ? page : parseInt(page));
            });
        });
        
        // Select all
        const selectAll = container.querySelector(`#${this.getId('select-all')}`);
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }
        
        // Row selection
        container.querySelectorAll('input[data-row-id]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleRowSelect(e.target.dataset.rowId, e.target.checked);
            });
        });
        
        // Export button
        const exportBtn = container.querySelector(`#${this.getId('export-btn')}`);
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const menu = exportBtn.nextElementSibling;
                menu.classList.toggle('visible');
            });
        }
        
        // Export format selection
        container.querySelectorAll('.export-menu button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleExport(e.currentTarget.dataset.format);
                e.currentTarget.parentElement.classList.remove('visible');
            });
        });
        
        // Action buttons
        container.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const rowId = e.currentTarget.dataset.id;
                this.emit('action', { action, rowId });
            });
        });
        
        // Bulk actions
        const bulkDelete = container.querySelector(`#${this.getId('bulk-delete')}`);
        if (bulkDelete) {
            bulkDelete.addEventListener('click', () => {
                this.emit('bulkDelete', { rows: this.getSelectedRows() });
            });
        }
        
        // Retry button
        const retryBtn = container.querySelector(`#${this.getId('retry-btn')}`);
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadData(this.config.data);
            });
        }
    }
    
    // ============================================
    // UI UPDATES
    // ============================================
    
    updateFooter() {
        const footer = this.getContainer()?.querySelector('.table-footer');
        if (!footer) return;
        
        footer.innerHTML = this.renderFooter().innerHTML;
    }
    
    updateBulkActions() {
        const bulkActions = this.getContainer()?.querySelector('.bulk-actions');
        if (!bulkActions) return;
        
        const selectedCount = this.state.selectedRows.size;
        if (selectedCount > 0) {
            bulkActions.classList.add('visible');
            bulkActions.querySelector('.selected-count').textContent = 
                `${selectedCount} terpilih`;
        } else {
            bulkActions.classList.remove('visible');
        }
    }
    
    showLoading() {
        this.state.isLoading = true;
        const overlay = this.getContainer()?.querySelector('.table-loading-overlay');
        if (overlay) {
            overlay.classList.add('visible');
        }
    }
    
    hideLoading() {
        this.state.isLoading = false;
        const overlay = this.getContainer()?.querySelector('.table-loading-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }
    
    showError(message) {
        this.state.error = message;
        this.renderBody();
    }
    
    scrollToTop() {
        const tableContent = this.getContainer()?.querySelector('.table-scroll');
        if (tableContent) {
            tableContent.scrollTop = 0;
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getContainer() {
        if (typeof this.config.container === 'string') {
            return document.querySelector(this.config.container);
        }
        return this.config.container;
    }
    
    getId(suffix) {
        return `table-${this.config.id || 'default'}-${suffix}`;
    }
    
    getTableBodyId() {
        return this.getId('tbody');
    }
    
    getColSpan() {
        let span = this.config.columns.length;
        if (this.config.selectable) span++;
        if (this.hasActions()) span++;
        return span;
    }
    
    hasActions() {
        return this.config.actions && this.config.actions.length > 0;
    }
    
    getCurrentPageData() {
        const { currentPage } = this.state;
        const { pageSize } = this.config;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        return this.state.filteredData.slice(startIndex, endIndex);
    }
    
    getShowingInfo() {
        const { filteredData, currentPage } = this.state;
        const { pageSize } = this.config;
        const total = filteredData.length;
        
        if (total === 0) return '0 data';
        
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, total);
        
        return `${start}-${end} dari ${total} data`;
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    on(event, callback) {
        if (!this._eventListeners) {
            this._eventListeners = {};
        }
        
        if (!this._eventListeners[event]) {
            this._eventListeners[event] = [];
        }
        
        this._eventListeners[event].push(callback);
        
        return () => {
            this._eventListeners[event] = this._eventListeners[event]
                .filter(cb => cb !== callback);
        };
    }
    
    emit(event, data) {
        if (!this._eventListeners?.[event]) return;
        
        this._eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                this.logger.error(`Event listener error: ${event}`, error);
            }
        });
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    refresh() {
        this.applyFilters();
        this.renderBody();
        this.updateFooter();
    }
    
    setData(data) {
        this.loadData(data);
    }
    
    getData() {
        return this.config.data;
    }
    
    getFilteredData() {
        return this.state.filteredData;
    }
    
    getSelectedData() {
        return this.getSelectedRows();
    }
    
    clearSelection() {
        this.state.selectedRows.clear();
        this.updateBulkActions();
        this.renderBody();
    }
    
    setPageSize(size) {
        this.handlePageSizeChange(size);
    }
    
    setSearchQuery(query) {
        this.handleSearch(query);
    }
    
    reset() {
        this.state.searchQuery = '';
        this.state.sortColumn = null;
        this.state.sortDirection = 'asc';
        this.state.currentPage = 1;
        this.state.selectedRows.clear();
        
        this.applyFilters();
        this.render();
    }
    
    destroy() {
        const container = this.getContainer();
        if (container) {
            container.innerHTML = '';
        }
        
        this._eventListeners = {};
        this.state.selectedRows.clear();
    }
}

export default TableComponent;
export { TableComponent };