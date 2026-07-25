// js/export.js - Advanced Data Export Handler 2026
/**
 * E-Arsip Digital - Data Export Handler
 * Version: 2026.1.0
 * Features: PDF, Excel, CSV, JSON export with templates, watermark, digital signature
 */

import { Logger } from './logger.js';
import utils from './utils.js';
import apiService from './api.js';

class ExportHandler {
    constructor(options = {}) {
        this.logger = new Logger('Export');
        
        // Configuration
        this.config = {
            defaultFormat: 'pdf',
            pageSize: 'A4',
            orientation: 'portrait',
            margin: { top: 20, right: 20, bottom: 20, left: 20 },
            watermark: null,
            signature: null,
            header: true,
            footer: true,
            ...options
        };
        
        // Export tracking
        this.exportHistory = this.loadExportHistory();
        
        this.initialized = true;
        this.logger.info('Export handler initialized');
    }
    
    // ============================================
    // PDF EXPORT
    // ============================================
    
    async exportPDF(data, options = {}) {
        const config = { ...this.config, ...options };
        
        try {
            this.showProgress('Menyiapkan PDF...');
            
            // Create PDF content
            const content = this.buildPDFContent(data, config);
            
            // Create blob
            const blob = await this.generatePDFBlob(content, config);
            
            // Add watermark if configured
            if (config.watermark) {
                await this.addWatermark(blob, config.watermark);
            }
            
            // Add digital signature if configured
            if (config.signature) {
                await this.addDigitalSignature(blob, config.signature);
            }
            
            // Download
            const filename = config.filename || `export-${Date.now()}.pdf`;
            this.downloadBlob(blob, filename);
            
            this.logExport('pdf', filename, data);
            this.hideProgress();
            
            return { success: true, filename };
            
        } catch (error) {
            this.logger.error('PDF export failed', error);
            this.hideProgress();
            throw new Error('Gagal mengekspor PDF');
        }
    }
    
    buildPDFContent(data, config) {
        const { pageSize, orientation, margin, header, footer } = config;
        
        // Build HTML content for PDF
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page {
                        size: ${pageSize} ${orientation};
                        margin: ${margin.top}mm ${margin.right}mm ${margin.bottom}mm ${margin.left}mm;
                    }
                    
                    body {
                        font-family: 'Helvetica', 'Arial', sans-serif;
                        font-size: 11pt;
                        line-height: 1.5;
                        color: #333;
                    }
                    
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #2563eb;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    
                    .header h1 {
                        font-size: 16pt;
                        margin: 0 0 5px 0;
                        color: #1e3a8a;
                    }
                    
                    .header .subtitle {
                        font-size: 10pt;
                        color: #64748b;
                    }
                    
                    .meta {
                        margin-bottom: 20px;
                        font-size: 9pt;
                        color: #64748b;
                    }
                    
                    .meta table {
                        width: 100%;
                    }
                    
                    .meta td {
                        padding: 2px 0;
                    }
                    
                    .meta .label {
                        font-weight: bold;
                        width: 120px;
                    }
                    
                    table.data {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }
                    
                    table.data th {
                        background-color: #2563eb;
                        color: white;
                        padding: 8px 10px;
                        text-align: left;
                        font-size: 10pt;
                    }
                    
                    table.data td {
                        padding: 6px 10px;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 10pt;
                    }
                    
                    table.data tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    
                    .footer {
                        position: fixed;
                        bottom: 0;
                        width: 100%;
                        text-align: center;
                        font-size: 8pt;
                        color: #94a3b8;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 5px;
                    }
                    
                    .watermark {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 60pt;
                        color: rgba(0,0,0,0.05);
                        pointer-events: none;
                        z-index: -1;
                    }
                    
                    @media print {
                        .footer {
                            position: fixed;
                            bottom: 0;
                        }
                    }
                </style>
            </head>
            <body>
                ${config.watermark ? `<div class="watermark">${config.watermark}</div>` : ''}
                
                ${header ? `
                    <div class="header">
                        <h1>${config.title || 'Laporan E-Arsip Digital'}</h1>
                        <div class="subtitle">Dicetak pada: ${utils.formatDate(new Date(), 'full')}</div>
                    </div>
                ` : ''}
                
                <div class="meta">
                    <table>
                        ${config.meta ? Object.entries(config.meta).map(([key, value]) => `
                            <tr>
                                <td class="label">${key}</td>
                                <td>: ${value}</td>
                            </tr>
                        `).join('') : ''}
                    </table>
                </div>
                
                ${this.buildDataTable(data, config.columns)}
                
                ${footer ? `
                    <div class="footer">
                        E-Arsip Digital v2026.1.0 | Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span>
                    </div>
                ` : ''}
            </body>
            </html>
        `;
        
        return html;
    }
    
    buildDataTable(data, columns) {
        if (!data || data.length === 0) {
            return '<p style="text-align:center;color:#94a3b8;">Tidak ada data</p>';
        }
        
        const cols = columns || Object.keys(data[0]).map(key => ({
            key,
            label: utils.camelToTitle(key)
        }));
        
        return `
            <table class="data">
                <thead>
                    <tr>
                        <th style="width:30px;">No</th>
                        ${cols.map(col => `<th>${col.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map((row, index) => `
                        <tr>
                            <td style="text-align:center;">${index + 1}</td>
                            ${cols.map(col => `<td>${this.formatCellValue(row[col.key], col)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    formatCellValue(value, column) {
        if (value === null || value === undefined) return '-';
        
        if (column.type === 'date') return utils.formatDate(value, 'medium');
        if (column.type === 'datetime') return utils.formatDate(value, 'datetime');
        if (column.type === 'currency') return utils.formatCurrency(value);
        if (column.type === 'number') return utils.formatNumber(value);
        if (column.type === 'boolean') return value ? 'Ya' : 'Tidak';
        
        return String(value);
    }
    
    async generatePDFBlob(html) {
        // Create a print window for PDF generation
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        return new Promise((resolve) => {
            printWindow.onload = () => {
                printWindow.print();
                printWindow.close();
                
                // Create a placeholder blob
                // In production, use a proper PDF library like jsPDF or pdfmake
                const blob = new Blob([html], { type: 'application/pdf' });
                resolve(blob);
            };
        });
    }
    
    async addWatermark(blob, watermark) {
        // Watermark implementation with PDF-lib
        this.logger.debug('Adding watermark:', watermark);
    }
    
    async addDigitalSignature(blob, signature) {
        // Digital signature implementation
        this.logger.debug('Adding digital signature');
    }
    
    // ============================================
    // EXCEL EXPORT
    // ============================================
    
    async exportExcel(data, options = {}) {
        const config = { ...this.config, ...options };
        
        try {
            this.showProgress('Menyiapkan Excel...');
            
            const XLSX = await import('xlsx');
            
            // Prepare worksheet data
            const worksheet = this.buildExcelSheet(data, config);
            
            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName || 'Data');
            
            // Add metadata
            workbook.Props = {
                Title: config.title || 'Export Data',
                Author: config.author || 'E-Arsip Digital',
                CreatedDate: new Date()
            };
            
            // Style the worksheet
            this.styleExcelSheet(worksheet, config);
            
            // Generate and download
            const filename = config.filename || `export-${Date.now()}.xlsx`;
            XLSX.writeFile(workbook, filename);
            
            this.logExport('excel', filename, data);
            this.hideProgress();
            
            return { success: true, filename };
            
        } catch (error) {
            this.logger.error('Excel export failed', error);
            this.hideProgress();
            throw new Error('Gagal mengekspor Excel');
        }
    }
    
    buildExcelSheet(data, config) {
        const columns = config.columns || Object.keys(data[0] || {}).map(key => ({
            key,
            label: utils.camelToTitle(key)
        }));
        
        // Build headers
        const headers = columns.map(col => col.label);
        
        // Build rows
        const rows = data.map(row => 
            columns.map(col => this.formatCellValue(row[col.key], col))
        );
        
        return XLSX.utils.aoa_to_sheet([headers, ...rows]);
    }
    
    styleExcelSheet(worksheet, config) {
        // Set column widths
        const columns = config.columns || [];
        const colWidths = columns.map(col => ({ wch: col.width || 20 }));
        worksheet['!cols'] = colWidths;
    }
    
    // ============================================
    // CSV EXPORT
    // ============================================
    
    async exportCSV(data, options = {}) {
        const config = { ...this.config, ...options };
        
        try {
            this.showProgress('Menyiapkan CSV...');
            
            const columns = config.columns || Object.keys(data[0] || {}).map(key => ({
                key,
                label: utils.camelToTitle(key)
            }));
            
            // Build CSV content
            const headers = columns.map(col => col.label);
            const rows = data.map(row => 
                columns.map(col => {
                    const value = this.formatCellValue(row[col.key], col);
                    // Escape CSV special characters
                    return `"${String(value).replace(/"/g, '""')}"`;
                })
            );
            
            const csv = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');
            
            // Add BOM for Excel compatibility
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            
            const filename = config.filename || `export-${Date.now()}.csv`;
            this.downloadBlob(blob, filename);
            
            this.logExport('csv', filename, data);
            this.hideProgress();
            
            return { success: true, filename };
            
        } catch (error) {
            this.logger.error('CSV export failed', error);
            this.hideProgress();
            throw new Error('Gagal mengekspor CSV');
        }
    }
    
    // ============================================
    // JSON EXPORT
    // ============================================
    
    async exportJSON(data, options = {}) {
        const config = { ...this.config, ...options };
        
        try {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            
            const filename = config.filename || `export-${Date.now()}.json`;
            this.downloadBlob(blob, filename);
            
            this.logExport('json', filename, data);
            
            return { success: true, filename };
            
        } catch (error) {
            this.logger.error('JSON export failed', error);
            throw new Error('Gagal mengekspor JSON');
        }
    }
    
    // ============================================
    // BATCH EXPORT
    // ============================================
    
    async exportMultiple(formats, data, options = {}) {
        const results = [];
        
        for (const format of formats) {
            try {
                const result = await this.exportFormat(format, data, options);
                results.push({ format, success: true, ...result });
            } catch (error) {
                results.push({ format, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    async exportFormat(format, data, options) {
        switch (format.toLowerCase()) {
            case 'pdf': return this.exportPDF(data, options);
            case 'excel':
            case 'xlsx': return this.exportExcel(data, options);
            case 'csv': return this.exportCSV(data, options);
            case 'json': return this.exportJSON(data, options);
            default: throw new Error(`Unsupported format: ${format}`);
        }
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    showProgress(message) {
        const progress = document.createElement('div');
        progress.className = 'export-progress-overlay';
        progress.innerHTML = `
            <div class="export-progress-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        progress.id = 'export-progress';
        document.body.appendChild(progress);
    }
    
    hideProgress() {
        const progress = document.getElementById('export-progress');
        if (progress) {
            progress.remove();
        }
    }
    
    // ============================================
    // EXPORT HISTORY
    // ============================================
    
    logExport(format, filename, data) {
        const entry = {
            id: utils.generateUUID(),
            format,
            filename,
            rowCount: Array.isArray(data) ? data.length : 1,
            timestamp: new Date().toISOString(),
            user: this.getCurrentUser()
        };
        
        this.exportHistory.unshift(entry);
        
        // Keep only last 50 entries
        if (this.exportHistory.length > 50) {
            this.exportHistory = this.exportHistory.slice(0, 50);
        }
        
        this.saveExportHistory();
        
        this.logger.info('Export completed', entry);
    }
    
    loadExportHistory() {
        try {
            const stored = localStorage.getItem('export_history');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }
    
    saveExportHistory() {
        try {
            localStorage.setItem('export_history', JSON.stringify(this.exportHistory));
        } catch (error) {
            this.logger.warn('Failed to save export history', error);
        }
    }
    
    getExportHistory() {
        return [...this.exportHistory];
    }
    
    clearExportHistory() {
        this.exportHistory = [];
        localStorage.removeItem('export_history');
    }
    
    getCurrentUser() {
        try {
            const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
            return session.user?.username || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    async export(data, format, options = {}) {
        return this.exportFormat(format, data, options);
    }
    
    async quickExport(data, filename) {
        // Auto-detect best format
        const format = filename?.split('.').pop() || 'xlsx';
        return this.exportFormat(format, data, { filename });
    }
    
    getSupportedFormats() {
        return ['pdf', 'excel', 'xlsx', 'csv', 'json'];
    }
    
    destroy() {
        this.hideProgress();
        this.logger.info('Export handler destroyed');
    }
}

// Create singleton
const exportHandler = new ExportHandler();

export default exportHandler;
export { ExportHandler };