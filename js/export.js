// js/export.js - Data Export Handler 2026 (LIGHTWEIGHT)
/**
 * E-Arsip Digital - Data Export Handler
 * Version: 2026.1.0
 * 
 * Features:
 * - CSV export (reliable, no dependencies)
 * - JSON export
 * - Print-friendly HTML export
 * - Excel export (jika XLSX library tersedia)
 * - No external dependencies
 */

var ExportHandler = (function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var config = {
        defaultFormat: 'csv',
        dateFormat: 'id-ID'
    };
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    function formatDate(value) {
        if (!value) return '-';
        try {
            var d = new Date(value);
            if (isNaN(d.getTime())) return String(value);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch(e) {
            return String(value);
        }
    }
    
    function formatDateTime(value) {
        if (!value) return '-';
        try {
            var d = new Date(value);
            if (isNaN(d.getTime())) return String(value);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + 
                ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch(e) {
            return String(value);
        }
    }
    
    function formatCurrency(value) {
        if (value === null || value === undefined) return '-';
        var num = parseFloat(value);
        if (isNaN(num)) return String(value);
        return 'Rp ' + num.toLocaleString('id-ID');
    }
    
    function formatNumber(value) {
        if (value === null || value === undefined) return '-';
        var num = parseFloat(value);
        if (isNaN(num)) return String(value);
        return num.toLocaleString('id-ID');
    }
    
    function formatCellValue(value, column) {
        if (value === null || value === undefined) return '-';
        
        if (column && column.type === 'date') return formatDate(value);
        if (column && column.type === 'datetime') return formatDateTime(value);
        if (column && column.type === 'currency') return formatCurrency(value);
        if (column && column.type === 'number') return formatNumber(value);
        if (column && column.type === 'boolean') return value ? 'Ya' : 'Tidak';
        
        return String(value);
    }
    
    function sanitizeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    function escapeCSV(str) {
        if (str === null || str === undefined) return '';
        var s = String(str);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }
    
    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(function() {
            URL.revokeObjectURL(url);
        }, 1000);
    }
    
    function getColumns(data, customColumns) {
        if (customColumns && customColumns.length > 0) {
            return customColumns;
        }
        
        if (!data || data.length === 0) return [];
        
        var firstRow = data[0];
        var columns = [];
        var keys = Object.keys(firstRow);
        
        for (var i = 0; i < keys.length; i++) {
            columns.push({
                key: keys[i],
                label: keys[i].replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); })
            });
        }
        
        return columns;
    }
    
    // ============================================
    // CSV EXPORT (RELIABLE)
    // ============================================
    
    function exportCSV(data, options) {
        if (!options) options = {};
        
        try {
            var columns = getColumns(data, options.columns);
            var filename = options.filename || 'export-' + Date.now() + '.csv';
            
            // Build CSV
            var rows = [];
            
            // Header
            var headers = [];
            for (var i = 0; i < columns.length; i++) {
                headers.push(escapeCSV(columns[i].label));
            }
            rows.push(headers.join(','));
            
            // Data rows
            for (var j = 0; j < data.length; j++) {
                var row = [];
                for (var k = 0; k < columns.length; k++) {
                    var value = formatCellValue(data[j][columns[k].key], columns[k]);
                    row.push(escapeCSV(value));
                }
                rows.push(row.join(','));
            }
            
            // BOM untuk Excel compatibility
            var csv = '\uFEFF' + rows.join('\n');
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            
            downloadBlob(blob, filename);
            
            console.log('[Export] CSV exported: ' + filename + ' (' + data.length + ' rows)');
            
            return { success: true, filename: filename, rowCount: data.length };
        } catch(e) {
            console.error('[Export] CSV failed:', e.message);
            throw new Error('Gagal mengekspor CSV: ' + e.message);
        }
    }
    
    // ============================================
    // JSON EXPORT (RELIABLE)
    // ============================================
    
    function exportJSON(data, options) {
        if (!options) options = {};
        
        try {
            var filename = options.filename || 'export-' + Date.now() + '.json';
            var json = JSON.stringify(data, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            
            downloadBlob(blob, filename);
            
            console.log('[Export] JSON exported: ' + filename);
            
            return { success: true, filename: filename, rowCount: Array.isArray(data) ? data.length : 1 };
        } catch(e) {
            console.error('[Export] JSON failed:', e.message);
            throw new Error('Gagal mengekspor JSON: ' + e.message);
        }
    }
    
    // ============================================
    // PRINT EXPORT (HTML - Safe)
    // ============================================
    
    function exportPrint(data, options) {
        if (!options) options = {};
        
        try {
            var columns = getColumns(data, options.columns);
            var title = options.title || 'Laporan';
            
            // Build safe HTML
            var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + sanitizeHTML(title) + '</title>';
            html += '<style>body{font-family:Arial,sans-serif;font-size:11pt;padding:20px;}';
            html += 'h1{font-size:16pt;text-align:center;margin-bottom:5px;}';
            html += '.subtitle{text-align:center;font-size:9pt;color:#666;margin-bottom:15px;}';
            html += 'table{width:100%;border-collapse:collapse;}';
            html += 'th{background:#2563eb;color:white;padding:8px 10px;text-align:left;font-size:10pt;}';
            html += 'td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:10pt;}';
            html += 'tr:nth-child(even){background:#f8fafc;}';
            html += '.footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px;}';
            html += '@media print{@page{size:A4;margin:15mm;}}';
            html += '</style></head><body>';
            
            // Header
            html += '<h1>' + sanitizeHTML(title) + '</h1>';
            html += '<p class="subtitle">Dicetak: ' + new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</p>';
            
            // Table
            html += '<table><thead><tr><th>No</th>';
            for (var i = 0; i < columns.length; i++) {
                html += '<th>' + sanitizeHTML(columns[i].label) + '</th>';
            }
            html += '</tr></thead><tbody>';
            
            for (var j = 0; j < data.length; j++) {
                html += '<tr><td>' + (j + 1) + '</td>';
                for (var k = 0; k < columns.length; k++) {
                    html += '<td>' + sanitizeHTML(formatCellValue(data[j][columns[k].key], columns[k])) + '</td>';
                }
                html += '</tr>';
            }
            
            html += '</tbody></table>';
            
            // Footer
            html += '<div class="footer">E-Arsip Digital v2026.1.0</div>';
            html += '<script>window.onload=function(){window.print();}<\/script>';
            html += '</body></html>';
            
            // Buka di window baru
            var printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
            } else {
                // Fallback: download sebagai HTML
                var blob = new Blob([html], { type: 'text/html' });
                downloadBlob(blob, (options.filename || 'export') + '.html');
            }
            
            console.log('[Export] Print sent');
            
            return { success: true, rowCount: data.length };
        } catch(e) {
            console.error('[Export] Print failed:', e.message);
            throw new Error('Gagal mengekspor: ' + e.message);
        }
    }
    
    // ============================================
    // EXCEL EXPORT (Jika XLSX tersedia)
    // ============================================
    
    function exportExcel(data, options) {
        if (!options) options = {};
        
        // Cek apakah XLSX library tersedia
        if (typeof XLSX === 'undefined') {
            console.warn('[Export] XLSX library not available, falling back to CSV');
            return exportCSV(data, options);
        }
        
        try {
            var columns = getColumns(data, options.columns);
            var filename = options.filename || 'export-' + Date.now() + '.xlsx';
            
            // Build sheet data
            var sheetData = [];
            
            // Header
            var headerRow = [];
            for (var i = 0; i < columns.length; i++) {
                headerRow.push(columns[i].label);
            }
            sheetData.push(headerRow);
            
            // Data rows
            for (var j = 0; j < data.length; j++) {
                var row = [];
                for (var k = 0; k < columns.length; k++) {
                    row.push(formatCellValue(data[j][columns[k].key], columns[k]));
                }
                sheetData.push(row);
            }
            
            var worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            
            // Set column widths
            var colWidths = [];
            for (var l = 0; l < columns.length; l++) {
                colWidths.push({ wch: columns[l].width || 20 });
            }
            worksheet['!cols'] = colWidths;
            
            var workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Data');
            
            XLSX.writeFile(workbook, filename);
            
            console.log('[Export] Excel exported: ' + filename + ' (' + data.length + ' rows)');
            
            return { success: true, filename: filename, rowCount: data.length };
        } catch(e) {
            console.warn('[Export] Excel failed, falling back to CSV:', e.message);
            return exportCSV(data, options);
        }
    }
    
    // ============================================
    // GENERIC EXPORT
    // ============================================
    
    function exportData(data, format, options) {
        if (!format) format = config.defaultFormat;
        
        switch (format.toLowerCase()) {
            case 'csv':
                return exportCSV(data, options);
            case 'json':
                return exportJSON(data, options);
            case 'print':
            case 'pdf':
                return exportPrint(data, options);
            case 'excel':
            case 'xlsx':
                return exportExcel(data, options);
            default:
                // Default ke CSV
                return exportCSV(data, options);
        }
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Primary
        export: exportData,
        csv: exportCSV,
        json: exportJSON,
        print: exportPrint,
        excel: exportExcel,
        
        /**
         * Quick export (auto-detect format from filename)
         */
        quickExport: function(data, filename) {
            var ext = 'csv';
            if (filename) {
                var parts = filename.split('.');
                if (parts.length > 1) {
                    ext = parts[parts.length - 1].toLowerCase();
                }
            }
            return exportData(data, ext, { filename: filename });
        },
        
        /**
         * Get supported formats
         */
        getFormats: function() {
            return ['csv', 'json', 'print', 'excel'];
        },
        
        /**
         * Check if Excel export is available
         */
        isExcelAvailable: function() {
            return typeof XLSX !== 'undefined';
        },
        
        /**
         * Configure
         */
        configure: function(newConfig) {
            if (newConfig) {
                for (var key in newConfig) {
                    if (newConfig.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                        config[key] = newConfig[key];
                    }
                }
            }
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // CSV
// ExportHandler.csv(data, { filename: 'surat-keluar.csv' });
// 
// // JSON
// ExportHandler.json(data);
// 
// // Print
// ExportHandler.print(data, { title: 'Laporan Surat Masuk' });
// 
// // Excel (jika XLSX tersedia)
// ExportHandler.excel(data, { filename: 'laporan.xlsx' });
// 
// // Generic
// ExportHandler.export(data, 'csv', { columns: [...] });
// ============================================