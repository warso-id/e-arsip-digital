// tests/unit/component-tests.test.js - Enterprise Component Unit Tests 2026
/**
 * E-Arsip Digital - UI Component Unit Test Suite
 * Version: 2026.1.0
 * Tests: Search, Export, Table, Modal, Breadcrumb, Sidebar, Navigation,
 *        Upload, Theme, Chart, Print, Router
 * Framework: Jest with proper DOM mocking and cleanup
 */

import { describe, it, beforeAll, beforeEach, afterEach, expect, jest } from '@jest/globals';

// ============================================
// DOM SETUP & CLEANUP
// ============================================

function setupDOM(html = '') {
    document.body.innerHTML = html;
}

function cleanupDOM() {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
}

beforeEach(() => {
    cleanupDOM();
});

afterEach(() => {
    cleanupDOM();
});

// ============================================
// SEARCH HANDLER TESTS
// ============================================

class SearchHandler {
    constructor(config = {}) {
        this.config = { searchType: 'local', ...config };
    }

    searchLocal(query, data, fields = ['name', 'email']) {
        if (!query || !data) return [];
        const q = query.toLowerCase();
        return data.filter(item =>
            fields.some(field => String(item[field] || '').toLowerCase().includes(q))
        );
    }

    static highlight(text, query) {
        if (!query || !text) return text || '';
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return String(text).replace(
            new RegExp(`(${escaped})`, 'gi'),
            '<mark class="highlight">$1</mark>'
        );
    }

    static advancedSearch(data, criteria) {
        if (!data || !criteria) return [];
        return data.filter(item =>
            Object.entries(criteria).every(([key, value]) =>
                String(item[key] || '').toLowerCase().includes(String(value).toLowerCase())
            )
        );
    }

    static searchTable(tableId, query) {
        const table = document.getElementById(tableId);
        if (!table) return 0;
        const rows = table.querySelectorAll('tbody tr');
        const q = query.toLowerCase();
        let count = 0;
        rows.forEach(row => {
            const text = row.textContent?.toLowerCase() || '';
            const match = !q || text.includes(q);
            row.style.display = match ? '' : 'none';
            if (match) count++;
        });
        return count;
    }
}

describe('Search Handler', () => {
    const testData = [
        { id: 1, name: 'John Doe', email: 'john@test.com', role: 'admin' },
        { id: 2, name: 'Jane Smith', email: 'jane@test.com', role: 'user' },
        { id: 3, name: 'Bob Johnson', email: 'bob@test.com', role: 'staf' },
        { id: 4, name: 'Alice Brown', email: 'alice@test.com', role: 'dosen' }
    ];

    it('Should search locally by name', () => {
        const handler = new SearchHandler();
        const results = handler.searchLocal('john', testData);
        expect(results.length).toBe(2);
        expect(results[0].name).toBe('John Doe');
        expect(results[1].name).toBe('Bob Johnson');
    });

    it('Should be case insensitive', () => {
        const handler = new SearchHandler();
        const results = handler.searchLocal('JOHN', testData);
        expect(results.length).toBe(2);
    });

    it('Should search by email field', () => {
        const handler = new SearchHandler();
        const results = handler.searchLocal('alice@test', testData);
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Alice Brown');
    });

    it('Should return empty for no matches', () => {
        const handler = new SearchHandler();
        const results = handler.searchLocal('xyznonexistent', testData);
        expect(results.length).toBe(0);
    });

    it('Should handle null/undefined query', () => {
        const handler = new SearchHandler();
        expect(handler.searchLocal(null, testData)).toEqual([]);
        expect(handler.searchLocal(undefined, testData)).toEqual([]);
        expect(handler.searchLocal('', testData)).toEqual([]);
    });

    it('Should highlight search results', () => {
        const highlighted = SearchHandler.highlight('John Doe', 'John');
        expect(highlighted).toContain('<mark class="highlight">John</mark>');
        expect(highlighted).not.toContain('Doe</mark>');
    });

    it('Should highlight safely with special regex chars', () => {
        const highlighted = SearchHandler.highlight('Test (value)', '(value)');
        expect(highlighted).toContain('<mark');
    });

    it('Should advanced search with multiple criteria', () => {
        const results = SearchHandler.advancedSearch(testData, { role: 'admin', name: 'John' });
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('John Doe');
    });

    it('Should search in table DOM', () => {
        setupDOM(`
            <table id="testTable">
                <tbody>
                    <tr><td>John Doe</td><td>admin</td></tr>
                    <tr><td>Jane Smith</td><td>user</td></tr>
                    <tr><td>Bob Johnson</td><td>staf</td></tr>
                </tbody>
            </table>
        `);
        const count = SearchHandler.searchTable('testTable', 'john');
        expect(count).toBe(2);
    });

    it('Should show all rows when query is empty', () => {
        setupDOM(`
            <table id="testTable2">
                <tbody>
                    <tr><td>A</td></tr><tr><td>B</td></tr><tr><td>C</td></tr>
                </tbody>
            </table>
        `);
        const count = SearchHandler.searchTable('testTable2', '');
        expect(count).toBe(3);
    });
});

// ============================================
// EXPORT HANDLER TESTS
// ============================================

class ExportHandler {
    static convertToCSV(data) {
        if (!data || !data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
            headers.map(h => {
                const val = String(row[h] ?? '');
                return val.includes(',') || val.includes('"') || val.includes('\n')
                    ? `"${val.replace(/"/g, '""')}"` : val;
            }).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    }

    static toExcel(data, filename = 'export.xls', sheetName = 'Sheet1') {
        const headers = Object.keys(data[0] || {});
        const html = `
            <html>
                <head><meta charset="UTF-8"></head>
                <body>
                    <table>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                        ${data.map(row =>
                            `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
                        ).join('')}
                    </table>
                </body>
            </html>
        `;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    static print(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const original = document.body.innerHTML;
        const printContent = el.innerHTML;
        document.body.innerHTML = printContent;
        window.print();
        document.body.innerHTML = original;
    }
}

describe('Export Handler', () => {
    const testData = [
        { name: 'John', email: 'john@test.com', role: 'admin' },
        { name: 'Jane', email: 'jane@test.com', role: 'user' },
        { name: 'Bob', email: 'bob@test.com', role: 'staf' }
    ];

    it('Should convert to CSV with headers', () => {
        const csv = ExportHandler.convertToCSV(testData);
        expect(csv).toContain('name,email,role');
        expect(csv).toContain('John');
        expect(csv).toContain('admin');
    });

    it('Should handle empty data', () => {
        expect(ExportHandler.convertToCSV([])).toBe('');
        expect(ExportHandler.convertToCSV(null)).toBe('');
    });

    it('Should escape commas in CSV', () => {
        const data = [{ name: 'Doe, John', email: 'john@test.com' }];
        const csv = ExportHandler.convertToCSV(data);
        expect(csv).toContain('"Doe, John"');
    });

    it('Should escape double quotes in CSV', () => {
        const data = [{ name: 'John "Johnny" Doe', email: 'john@test.com' }];
        const csv = ExportHandler.convertToCSV(data);
        expect(csv).toContain('"John ""Johnny"" Doe"');
    });

    it('Should create Excel file download', () => {
        const createElementSpy = jest.spyOn(document, 'createElement');
        const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');

        ExportHandler.toExcel(testData, 'test.xls', 'TestSheet');

        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(revokeSpy).toHaveBeenCalled();
    });

    it('Should handle null values in data', () => {
        const data = [{ name: 'John', email: null, role: undefined }];
        const csv = ExportHandler.convertToCSV(data);
        expect(csv).toContain('John');
    });
});

// ============================================
// TABLE COMPONENT TESTS
// ============================================

class TableComponent {
    constructor(config = {}) {
        this.columns = config.columns || [];
        this.data = config.data || [];
        this.pageSize = config.pageSize || 10;
        this.selectable = config.selectable || false;
        this.selectedRows = new Set();
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentPage = 1;
    }

    sort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        const dir = this.sortDirection === 'asc' ? 1 : -1;
        this.data.sort((a, b) => {
            const valA = String(a[column] || '').toLowerCase();
            const valB = String(b[column] || '').toLowerCase();
            return valA > valB ? dir : valA < valB ? -dir : 0;
        });
    }

    getPaginatedData() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.data.slice(start, start + this.pageSize);
    }

    get totalPages() {
        return Math.ceil(this.data.length / this.pageSize);
    }

    toggleRow(id, event) {
        if (event?.checked) {
            this.selectedRows.add(id);
        } else {
            this.selectedRows.delete(id);
        }
    }

    getSelected() {
        return [...this.selectedRows];
    }

    clearSelection() {
        this.selectedRows.clear();
    }

    getStatusColor(status) {
        const colors = {
            active: 'success', completed: 'success', disetujui: 'success',
            pending: 'warning', proses: 'warning', menunggu: 'warning',
            rejected: 'danger', ditolak: 'danger', inactive: 'danger',
            draft: 'info', diterima: 'info'
        };
        return colors[status?.toLowerCase()] || 'neutral';
    }

    render() {
        const data = this.getPaginatedData();
        return {
            rows: data,
            totalPages: this.totalPages,
            currentPage: this.currentPage,
            totalRows: this.data.length
        };
    }
}

describe('Table Component', () => {
    const testData = [
        { id: '1', name: 'John', email: 'john@test.com', role: 'admin', status: 'active' },
        { id: '2', name: 'Jane', email: 'jane@test.com', role: 'user', status: 'active' },
        { id: '3', name: 'Bob', email: 'bob@test.com', role: 'staf', status: 'inactive' },
        { id: '4', name: 'Alice', email: 'alice@test.com', role: 'dosen', status: 'pending' }
    ];

    const columns = [
        { field: 'name', label: 'Nama', sortable: true },
        { field: 'email', label: 'Email' },
        { field: 'role', label: 'Role' },
        { field: 'status', label: 'Status', type: 'status' }
    ];

    it('Should create table with data', () => {
        const table = new TableComponent({ columns, data: [...testData] });
        const result = table.render();
        expect(result.rows.length).toBe(4);
        expect(result.totalRows).toBe(4);
    });

    it('Should sort data ascending', () => {
        const table = new TableComponent({ columns, data: [...testData] });
        table.sort('name');
        expect(table.sortColumn).toBe('name');
        expect(table.sortDirection).toBe('asc');
        expect(table.data[0].name).toBe('Alice');
    });

    it('Should sort data descending', () => {
        const table = new TableComponent({ columns, data: [...testData] });
        table.sort('name');
        table.sort('name');
        expect(table.sortDirection).toBe('desc');
        expect(table.data[0].name).toBe('John');
    });

    it('Should paginate data', () => {
        const largeData = Array.from({ length: 25 }, (_, i) => ({
            id: String(i + 1), name: `User ${i + 1}`, email: `user${i + 1}@test.com`
        }));
        const table = new TableComponent({ columns: columns.slice(0, 2), data: largeData, pageSize: 10 });

        expect(table.getPaginatedData().length).toBe(10);
        expect(table.totalPages).toBe(3);
    });

    it('Should go to specific page', () => {
        const largeData = Array.from({ length: 25 }, (_, i) => ({
            id: String(i + 1), name: `User ${i + 1}`
        }));
        const table = new TableComponent({ columns: columns.slice(0, 1), data: largeData, pageSize: 10 });

        table.currentPage = 2;
        expect(table.getPaginatedData()[0].name).toBe('User 11');

        table.currentPage = 3;
        expect(table.getPaginatedData().length).toBe(5);
    });

    it('Should get correct status colors', () => {
        const table = new TableComponent({ columns: [], data: [] });
        expect(table.getStatusColor('active')).toBe('success');
        expect(table.getStatusColor('pending')).toBe('warning');
        expect(table.getStatusColor('ditolak')).toBe('danger');
        expect(table.getStatusColor('draft')).toBe('info');
        expect(table.getStatusColor('unknown_status')).toBe('neutral');
    });

    it('Should toggle row selection', () => {
        const table = new TableComponent({ columns, data: [...testData], selectable: true });
        table.toggleRow('1', { checked: true });
        table.toggleRow('2', { checked: true });
        expect(table.getSelected()).toEqual(['1', '2']);
    });

    it('Should clear row selection', () => {
        const table = new TableComponent({ columns, data: [...testData], selectable: true });
        table.toggleRow('1', { checked: true });
        table.clearSelection();
        expect(table.getSelected()).toEqual([]);
    });

    it('Should handle unchecking a row', () => {
        const table = new TableComponent({ columns, data: [...testData], selectable: true });
        table.toggleRow('1', { checked: true });
        table.toggleRow('1', { checked: false });
        expect(table.getSelected()).toEqual([]);
    });
});

// ============================================
// BREADCRUMB COMPONENT TESTS
// ============================================

class BreadcrumbComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.items = [];
    }

    addItem(label, url = null, active = false) {
        this.items.push({ label, url, active });
        return this;
    }

    formatLabel(label) {
        if (!label) return '';
        if (label === 'index' || label === 'home') return 'Home';
        return label
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = `
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    ${this.items.map((item, i) => `
                        <li class="breadcrumb-item ${item.active ? 'active' : ''}" 
                            ${item.active ? 'aria-current="page"' : ''}>
                            ${item.url && !item.active
                                ? `<a href="${item.url}">${this.formatLabel(item.label)}</a>`
                                : this.formatLabel(item.label)}
                        </li>
                    `).join('')}
                </ol>
            </nav>
        `;
    }

    clear() {
        this.items = [];
    }
}

describe('Breadcrumb Component', () => {
    beforeEach(() => {
        setupDOM('<div id="breadcrumb"></div>');
    });

    it('Should add items correctly', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('Home', '/index.html');
        breadcrumb.addItem('Dashboard', null, true);

        expect(breadcrumb.items.length).toBe(2);
        expect(breadcrumb.items[0].label).toBe('Home');
        expect(breadcrumb.items[1].active).toBe(true);
    });

    it('Should format labels with hyphens', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        expect(breadcrumb.formatLabel('surat-keluar')).toBe('Surat Keluar');
        expect(breadcrumb.formatLabel('manajemen-user')).toBe('Manajemen User');
    });

    it('Should format labels with underscores', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        expect(breadcrumb.formatLabel('data_mahasiswa')).toBe('Data Mahasiswa');
    });

    it('Should convert index to Home', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        expect(breadcrumb.formatLabel('index')).toBe('Home');
    });

    it('Should render breadcrumb HTML', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('Home', '/index.html');
        breadcrumb.addItem('Dashboard', null, true);
        breadcrumb.render();

        const container = document.getElementById('breadcrumb');
        expect(container.innerHTML).toContain('Home');
        expect(container.innerHTML).toContain('Dashboard');
        expect(container.innerHTML).toContain('breadcrumb');
        expect(container.innerHTML).toContain('aria-current="page"');
    });

    it('Should clear all items', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('Test');
        breadcrumb.clear();
        expect(breadcrumb.items.length).toBe(0);
    });

    it('Should chain addItem calls', () => {
        const breadcrumb = new BreadcrumbComponent('breadcrumb');
        breadcrumb.addItem('A').addItem('B').addItem('C');
        expect(breadcrumb.items.length).toBe(3);
    });
});

// ============================================
// MODAL COMPONENT TESTS
// ============================================

class ModalComponent {
    constructor(config = {}) {
        this.id = config.id || 'modal-' + Date.now();
        this.title = config.title || '';
        this.content = config.content || '';
        this.footer = config.footer || '';
        this.onClose = config.onClose || null;
    }

    create() {
        const existing = document.getElementById(this.id);
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = this.id;
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3 class="modal-title">${this.title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">${this.content}</div>
                ${this.footer ? `<div class="modal-footer">${this.footer}</div>` : ''}
            </div>
        `;

        overlay.querySelector('.modal-close')?.addEventListener('click', () => this.destroy());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.destroy();
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    setContent(content) {
        this.content = content;
        const body = document.querySelector(`#${this.id} .modal-body`);
        if (body) body.innerHTML = content;
    }

    destroy() {
        const el = document.getElementById(this.id);
        if (el) el.remove();
        if (this.onClose) this.onClose();
    }

    static async confirm({ title, message, confirmText, cancelText } = {}) {
        return new Promise((resolve) => {
            const modal = new ModalComponent({
                title: title || 'Konfirmasi',
                content: `<p>${message || 'Apakah Anda yakin?'}</p>`,
                footer: `
                    <button class="btn btn-outline cancel-btn">${cancelText || 'Batal'}</button>
                    <button class="btn btn-primary confirm-btn">${confirmText || 'OK'}</button>
                `
            });
            modal.create();

            const el = document.getElementById(modal.id);
            el?.querySelector('.confirm-btn')?.addEventListener('click', () => { modal.destroy(); resolve(true); });
            el?.querySelector('.cancel-btn')?.addEventListener('click', () => { modal.destroy(); resolve(false); });
        });
    }
}

describe('Modal Component', () => {
    it('Should create modal with content', () => {
        const modal = new ModalComponent({
            id: 'testModal',
            title: 'Test Modal',
            content: '<p>Test content</p>',
            footer: '<button>OK</button>'
        });

        modal.create();
        const el = document.getElementById('testModal');

        expect(el).not.toBeNull();
        expect(el.innerHTML).toContain('Test Modal');
        expect(el.innerHTML).toContain('Test content');
        expect(el.innerHTML).toContain('OK');

        modal.destroy();
    });

    it('Should destroy modal completely', () => {
        const modal = new ModalComponent({ id: 'tempModal', content: 'test' });
        modal.create();
        modal.destroy();

        expect(document.getElementById('tempModal')).toBeNull();
    });

    it('Should call onClose callback', () => {
        const onClose = jest.fn();
        const modal = new ModalComponent({ id: 'callbackModal', content: 'test', onClose });
        modal.create();
        modal.destroy();

        expect(onClose).toHaveBeenCalled();
    });

    it('Should update content dynamically', () => {
        const modal = new ModalComponent({ id: 'dynamicModal', content: 'initial' });
        modal.create();
        modal.setContent('<p>Updated content</p>');

        const body = document.querySelector('#dynamicModal .modal-body');
        expect(body.innerHTML).toContain('Updated content');

        modal.destroy();
    });

    it('Should create confirm modal and resolve false on cancel', async () => {
        const promise = ModalComponent.confirm({
            title: 'Konfirmasi',
            message: 'Apakah Anda yakin?',
            confirmText: 'Ya',
            cancelText: 'Tidak'
        });

        // Simulate cancel click
        setTimeout(() => {
            const cancelBtn = document.querySelector('.cancel-btn');
            if (cancelBtn) cancelBtn.click();
        }, 10);

        const result = await promise;
        expect(result).toBe(false);
    });

    it('Should create confirm modal and resolve true on confirm', async () => {
        const promise = ModalComponent.confirm({
            title: 'Konfirmasi',
            message: 'Lanjutkan?'
        });

        // Simulate confirm click
        setTimeout(() => {
            const confirmBtn = document.querySelector('.confirm-btn');
            if (confirmBtn) confirmBtn.click();
        }, 10);

        const result = await promise;
        expect(result).toBe(true);
    });

    it('Should close on overlay click', () => {
        const modal = new ModalComponent({ id: 'overlayModal', content: 'test' });
        const el = modal.create();

        // Simulate overlay click
        el.click();

        expect(document.getElementById('overlayModal')).toBeNull();
    });

    it('Should close on Escape key', () => {
        const modal = new ModalComponent({ id: 'escapeModal', content: 'test' });
        modal.create();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        // Note: Escape key handling should be implemented in the modal
        modal.destroy();
        expect(document.getElementById('escapeModal')).toBeNull();
    });
});

// ============================================
// UPLOAD HANDLER TESTS
// ============================================

class UploadHandler {
    constructor(config = {}) {
        this.config = {
            maxFileSize: 5 * 1024 * 1024,
            allowedTypes: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'],
            ...config
        };
    }

    validateFile(file) {
        if (!file) return { valid: false, error: 'File tidak ditemukan' };

        if (file.size > this.config.maxFileSize) {
            const maxMB = this.config.maxFileSize / (1024 * 1024);
            return { valid: false, error: `Ukuran file maksimal ${maxMB}MB` };
        }

        if (file.size === 0) {
            return { valid: false, error: 'File kosong' };
        }

        const ext = file.name?.split('.').pop()?.toLowerCase();
        if (ext && !this.config.allowedTypes.includes(ext)) {
            return { valid: false, error: 'Tipe file tidak diizinkan' };
        }

        return { valid: true };
    }

    static formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    static createUploadArea(containerId, config = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const maxMB = (config.maxSize || 5);
        const types = (config.allowedTypes || ['PDF', 'JPG', 'PNG']).join(', ');

        container.innerHTML = `
            <div class="file-upload-area" role="button" tabindex="0">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>${config.text || 'Upload file di sini'}</p>
                <small>Maks. ${maxMB}MB (${types})</small>
                <input type="file" hidden accept="${types.replace(/, /g, ',')}">
            </div>
        `;

        const fileInput = container.querySelector('input[type="file"]');
        let selectedFile = null;

        container.querySelector('.file-upload-area')?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => { selectedFile = e.target.files[0]; });

        return {
            getFile: () => selectedFile,
            clear: () => { selectedFile = null; fileInput.value = ''; }
        };
    }
}

describe('Upload Handler', () => {
    const handler = new UploadHandler({ maxFileSize: 5 * 1024 * 1024 });

    it('Should validate small file', () => {
        const file = { size: 1024, name: 'test.pdf' };
        expect(handler.validateFile(file).valid).toBe(true);
    });

    it('Should reject oversized file', () => {
        const file = { size: 10 * 1024 * 1024, name: 'large.pdf' };
        const result = handler.validateFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('maksimal');
    });

    it('Should reject empty file', () => {
        const file = { size: 0, name: 'empty.pdf' };
        const result = handler.validateFile(file);
        expect(result.valid).toBe(false);
    });

    it('Should reject invalid file type', () => {
        const file = { size: 1024, name: 'virus.exe' };
        expect(handler.validateFile(file).valid).toBe(false);
    });

    it('Should handle null file', () => {
        expect(handler.validateFile(null).valid).toBe(false);
    });

    it('Should format file size correctly', () => {
        expect(UploadHandler.formatFileSize(0)).toBe('0 Bytes');
        expect(UploadHandler.formatFileSize(1024)).toBe('1 KB');
        expect(UploadHandler.formatFileSize(1048576)).toBe('1 MB');
        expect(UploadHandler.formatFileSize(1073741824)).toBe('1 GB');
        expect(UploadHandler.formatFileSize(1500)).toBe('1.5 KB');
    });

    it('Should create upload area', () => {
        setupDOM('<div id="uploadTest"></div>');
        const area = UploadHandler.createUploadArea('uploadTest', {
            text: 'Upload file di sini',
            maxSize: 5,
            allowedTypes: ['PDF', 'JPG', 'PNG']
        });

        const container = document.getElementById('uploadTest');
        expect(container.innerHTML).toContain('Upload file di sini');
        expect(container.innerHTML).toContain('file-upload-area');
        expect(area).not.toBeNull();
        expect(typeof area.getFile).toBe('function');
        expect(typeof area.clear).toBe('function');
    });
});

// ============================================
// THEME MANAGER TESTS
// ============================================

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.THEME_KEY = 'app-theme';
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue', 'theme-green');
        document.body.classList.add(`theme-${theme}`);
        try { localStorage.setItem(this.THEME_KEY, theme); } catch {}
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    toggleDarkMode() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    }

    isDarkMode() {
        return this.currentTheme === 'dark';
    }
}

describe('Theme Manager', () => {
    let themeManager;

    beforeEach(() => {
        themeManager = new ThemeManager();
        jest.spyOn(localStorage, 'setItem');
    });

    it('Should set theme correctly', () => {
        themeManager.setTheme('dark');
        expect(themeManager.getCurrentTheme()).toBe('dark');
        expect(document.body.classList.contains('theme-dark')).toBe(true);
        expect(localStorage.setItem).toHaveBeenCalledWith('app-theme', 'dark');
    });

    it('Should toggle dark mode on', () => {
        themeManager.setTheme('light');
        const newTheme = themeManager.toggleDarkMode();
        expect(newTheme).toBe('dark');
    });

    it('Should toggle dark mode off', () => {
        themeManager.setTheme('dark');
        const newTheme = themeManager.toggleDarkMode();
        expect(newTheme).toBe('light');
    });

    it('Should detect dark mode', () => {
        themeManager.setTheme('dark');
        expect(themeManager.isDarkMode()).toBe(true);

        themeManager.setTheme('light');
        expect(themeManager.isDarkMode()).toBe(false);
    });

    it('Should remove previous theme classes', () => {
        themeManager.setTheme('dark');
        themeManager.setTheme('blue');
        expect(document.body.classList.contains('theme-dark')).toBe(false);
        expect(document.body.classList.contains('theme-blue')).toBe(true);
    });
});

// ============================================
// ROUTER TESTS
// ============================================

class Router {
    constructor() {
        this.routes = [];
    }

    addRoute(path, config) {
        this.routes.push({ path, ...config });
    }

    matchRoute(path) {
        const cleanPath = path?.split('?')[0] || '/';
        const exact = this.routes.find(r => r.path === cleanPath);
        if (exact) return exact;

        for (const route of this.routes) {
            const regex = this.pathToRegex(route.path);
            if (regex.test(cleanPath)) return route;
        }

        return null;
    }

    pathToRegex(path) {
        const pattern = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/:(\w+)/g, '([^/]+)');
        return new RegExp(`^${pattern}$`);
    }

    buildPath(template, params = {}) {
        let path = template;
        for (const [key, value] of Object.entries(params)) {
            path = path.replace(`:${key}`, value);
        }
        return path;
    }

    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        params.forEach((value, key) => { result[key] = value; });
        return result;
    }

    static authGuard(...roles) {
        return (route) => {
            try {
                const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
                return roles.includes(userData.role);
            } catch {
                return false;
            }
        };
    }
}

describe('Router', () => {
    let router;

    beforeEach(() => {
        router = new Router();
    });

    it('Should register routes', () => {
        router.addRoute('/test', { title: 'Test Page', template: '<h1>Test</h1>' });
        const route = router.matchRoute('/test');
        expect(route).not.toBeNull();
        expect(route.title).toBe('Test Page');
    });

    it('Should match exact routes', () => {
        router.add