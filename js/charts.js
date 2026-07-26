// js/charts.js - Chart Manager 2026 (SAFE)
/**
 * E-Arsip Digital - Chart Manager
 * Version: 2026.1.0
 * 
 * Features:
 * - Safe Chart.js wrapper
 * - Auto-detect Chart availability
 * - Destroy before recreate
 * - Static color utilities
 * - PWA mobile compatible
 */

var ChartManager = (function() {
    'use strict';
    
    // ============================================
    // PRIVATE STATE
    // ============================================
    var _charts = {};               // { canvasId: chartInstance }
    
    // ============================================
    // CHART.JS AVAILABILITY
    // ============================================
    
    function isChartAvailable() {
        return typeof Chart !== 'undefined';
    }
    
    function getCanvas(canvasId) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn('[Chart] Canvas not found: ' + canvasId);
            return null;
        }
        return canvas;
    }
    
    // ============================================
    // MERGE OPTIONS (Tanpa spread operator)
    // ============================================
    
    function mergeOptions(defaults, custom) {
        var result = {};
        
        // Copy defaults
        for (var key in defaults) {
            if (defaults.hasOwnProperty(key)) {
                if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && defaults[key] !== null) {
                    result[key] = mergeOptions(defaults[key], (custom && custom[key]) || {});
                } else {
                    result[key] = defaults[key];
                }
            }
        }
        
        // Override dengan custom
        if (custom) {
            for (var key in custom) {
                if (custom.hasOwnProperty(key)) {
                    if (typeof custom[key] === 'object' && !Array.isArray(custom[key]) && custom[key] !== null && result[key]) {
                        result[key] = mergeOptions(result[key], custom[key]);
                    } else {
                        result[key] = custom[key];
                    }
                }
            }
        }
        
        return result;
    }
    
    // ============================================
    // DESTROY CHART SAFELY
    // ============================================
    
    function destroyChart(canvasId) {
        if (_charts[canvasId]) {
            try {
                _charts[canvasId].destroy();
            } catch(e) {
                // Chart mungkin sudah di-destroy
            }
            delete _charts[canvasId];
        }
    }
    
    // ============================================
    // CREATE CHART
    // ============================================
    
    function createChart(canvasId, type, data, options) {
        if (!isChartAvailable()) {
            console.warn('[Chart] Chart.js not loaded');
            return null;
        }
        
        var canvas = getCanvas(canvasId);
        if (!canvas) return null;
        
        // Destroy existing chart di canvas ini
        destroyChart(canvasId);
        
        // Get context
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;
        
        // Default options
        var defaults = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        };
        
        // Merge options
        var mergedOptions = mergeOptions(defaults, options || {});
        
        try {
            var chart = new Chart(ctx, {
                type: type,
                data: data,
                options: mergedOptions
            });
            
            _charts[canvasId] = chart;
            return chart;
        } catch(e) {
            console.error('[Chart] Failed to create chart:', e.message);
            return null;
        }
    }
    
    // ============================================
    // CHART TYPES
    // ============================================
    
    function createBarChart(canvasId, data, options) {
        if (!options) options = {};
        if (!options.scales) {
            options.scales = {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            };
        }
        return createChart(canvasId, 'bar', data, options);
    }
    
    function createLineChart(canvasId, data, options) {
        if (!options) options = {};
        if (!options.scales) {
            options.scales = {
                y: { beginAtZero: true }
            };
        }
        return createChart(canvasId, 'line', data, options);
    }
    
    function createPieChart(canvasId, data, options) {
        return createChart(canvasId, 'doughnut', data, options);
    }
    
    function createDoughnutChart(canvasId, data, options) {
        return createChart(canvasId, 'doughnut', data, options);
    }
    
    // ============================================
    // PRE-BUILT CHARTS
    // ============================================
    
    function createMonthlyBarChart(canvasId, label, data, color) {
        var chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: label || 'Data',
                data: data || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: color || 'rgba(37, 99, 235, 0.7)',
                borderColor: color || 'rgb(37, 99, 235)',
                borderWidth: 1,
                borderRadius: 5
            }]
        };
        
        return createBarChart(canvasId, chartData);
    }
    
    function createComparisonLineChart(canvasId, label1, data1, label2, data2) {
        var chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                {
                    label: label1 || 'Dataset 1',
                    data: data1 || [],
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: label2 || 'Dataset 2',
                    data: data2 || [],
                    borderColor: 'rgb(168, 85, 247)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        };
        
        return createLineChart(canvasId, chartData);
    }
    
    function createStatusPieChart(canvasId, labels, data) {
        var chartData = {
            labels: labels || ['Selesai', 'Proses', 'Pending', 'Ditolak'],
            datasets: [{
                data: data || [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderWidth: 0
            }]
        };
        
        return createDoughnutChart(canvasId, chartData);
    }
    
    // ============================================
    // UPDATE CHART
    // ============================================
    
    function updateChart(canvasId, newData, datasetIndex) {
        var chart = _charts[canvasId];
        if (!chart) {
            console.warn('[Chart] Chart not found: ' + canvasId);
            return;
        }
        
        if (datasetIndex === undefined) datasetIndex = 0;
        
        if (chart.data.datasets[datasetIndex]) {
            chart.data.datasets[datasetIndex].data = newData;
            chart.update();
        }
    }
    
    function updateLabels(canvasId, newLabels) {
        var chart = _charts[canvasId];
        if (!chart) return;
        
        chart.data.labels = newLabels;
        chart.update();
    }
    
    // ============================================
    // DESTROY
    // ============================================
    
    function destroyAll() {
        for (var id in _charts) {
            if (_charts.hasOwnProperty(id)) {
                destroyChart(id);
            }
        }
        _charts = {};
    }
    
    function destroy(canvasId) {
        destroyChart(canvasId);
    }
    
    // ============================================
    // EXPORT
    // ============================================
    
    function exportImage(canvasId) {
        var chart = _charts[canvasId];
        if (!chart) return null;
        
        try {
            // Chart.js menyimpan canvas reference
            return chart.canvas.toDataURL('image/png');
        } catch(e) {
            return null;
        }
    }
    
    function downloadImage(canvasId, filename) {
        var url = exportImage(canvasId);
        if (!url) return;
        
        var link = document.createElement('a');
        link.href = url;
        link.download = filename || ('chart-' + canvasId + '.png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // ============================================
    // COLORS
    // ============================================
    
    var COLORS = {
        primary: 'rgba(37, 99, 235, 0.8)',
        secondary: 'rgba(168, 85, 247, 0.8)',
        success: 'rgba(34, 197, 94, 0.8)',
        warning: 'rgba(245, 158, 11, 0.8)',
        danger: 'rgba(239, 68, 68, 0.8)',
        info: 'rgba(6, 182, 212, 0.8)',
        dark: 'rgba(30, 41, 59, 0.8)'
    };
    
    function getColors() {
        return COLORS;
    }
    
    function generateColors(count) {
        var colors = [];
        for (var i = 0; i < count; i++) {
            var hue = (i * 360 / count) % 360;
            colors.push('hsla(' + hue + ', 70%, 60%, 0.8)');
        }
        return colors;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        // Core
        createBarChart: createBarChart,
        createLineChart: createLineChart,
        createPieChart: createPieChart,
        createDoughnutChart: createDoughnutChart,
        
        // Pre-built
        createMonthlyBarChart: createMonthlyBarChart,
        createComparisonLineChart: createComparisonLineChart,
        createStatusPieChart: createStatusPieChart,
        
        // Update
        updateChart: updateChart,
        updateLabels: updateLabels,
        
        // Destroy
        destroy: destroy,
        destroyAll: destroyAll,
        
        // Export
        exportImage: exportImage,
        downloadImage: downloadImage,
        
        // Colors
        getColors: getColors,
        generateColors: generateColors,
        
        /**
         * Check if Chart.js is available
         */
        isAvailable: isChartAvailable,
        
        /**
         * Get chart instance
         */
        getChart: function(canvasId) {
            return _charts[canvasId] || null;
        },
        
        /**
         * Get all chart IDs
         */
        getChartIds: function() {
            var ids = [];
            for (var id in _charts) {
                if (_charts.hasOwnProperty(id)) {
                    ids.push(id);
                }
            }
            return ids;
        }
    };
})();

// ============================================
// USAGE:
// ============================================
// // Check availability
// if (ChartManager.isAvailable()) {
//     ChartManager.createMonthlyBarChart('myChart', 'Surat Masuk', [5,10,8], 'rgba(37,99,235,0.7)');
// }
// 
// // Update
// ChartManager.updateChart('myChart', [6,12,9]);
// 
// // Export
// ChartManager.downloadImage('myChart', 'laporan-surat.png');
// 
// // Colors
// var colors = ChartManager.getColors();
// var dynamicColors = ChartManager.generateColors(5);
// ============================================