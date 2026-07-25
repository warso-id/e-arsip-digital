// FILE: js/charts.js
// ============================================
// CHART CONFIGURATION - E-ARSIP DIGITAL
// ============================================

class ChartManager {
    constructor() {
        this.charts = {};
    }
    
    /**
     * Destroy all existing charts
     */
    destroyAll() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
    
    /**
     * Destroy specific chart
     */
    destroy(chartKey) {
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
            delete this.charts[chartKey];
        }
    }
    
    /**
     * Create bar chart
     */
    createBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        };
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: { ...defaultOptions, ...options }
        });
        
        this.charts[canvasId] = chart;
        return chart;
    }
    
    /**
     * Create line chart
     */
    createLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        };
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: { ...defaultOptions, ...options }
        });
        
        this.charts[canvasId] = chart;
        return chart;
    }
    
    /**
     * Create pie/doughnut chart
     */
    createPieChart(canvasId, data, type = 'doughnut', options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        };
        
        const chart = new Chart(ctx, {
            type: type,
            data: data,
            options: { ...defaultOptions, ...options }
        });
        
        this.charts[canvasId] = chart;
        return chart;
    }
    
    /**
     * Create statistik surat masuk chart
     */
    createSuratMasukChart(canvasId, data) {
        const chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Surat Masuk',
                data: data || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(102, 126, 234, 0.7)',
                borderColor: 'rgb(102, 126, 234)',
                borderWidth: 1,
                borderRadius: 5
            }]
        };
        
        return this.createBarChart(canvasId, chartData);
    }
    
    /**
     * Create statistik surat keluar chart
     */
    createSuratKeluarChart(canvasId, data) {
        const chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Surat Keluar',
                data: data || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(240, 147, 251, 0.7)',
                borderColor: 'rgb(240, 147, 251)',
                borderWidth: 1,
                borderRadius: 5
            }]
        };
        
        return this.createBarChart(canvasId, chartData);
    }
    
    /**
     * Create status distribution chart
     */
    createStatusChart(canvasId, labels, data) {
        const chartData = {
            labels: labels || ['Selesai', 'Proses', 'Pending', 'Ditolak'],
            datasets: [{
                data: data || [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(40, 167, 69, 0.8)',
                    'rgba(0, 123, 255, 0.8)',
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(220, 53, 69, 0.8)'
                ],
                borderWidth: 0
            }]
        };
        
        return this.createPieChart(canvasId, chartData);
    }
    
    /**
     * Create trend chart
     */
    createTrendChart(canvasId, data1, data2) {
        const chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                {
                    label: 'Surat Masuk',
                    data: data1 || [],
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Surat Keluar',
                    data: data2 || [],
                    borderColor: 'rgb(240, 147, 251)',
                    backgroundColor: 'rgba(240, 147, 251, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        };
        
        return this.createLineChart(canvasId, chartData);
    }
    
    /**
     * Create kategori distribution chart
     */
    createKategoriChart(canvasId, labels, data) {
        const chartData = {
            labels: labels || ['Umum', 'Keuangan', 'Legal', 'Lainnya'],
            datasets: [{
                data: data || [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(240, 147, 251, 0.8)',
                    'rgba(67, 233, 123, 0.8)',
                    'rgba(255, 215, 0, 0.8)'
                ],
                borderWidth: 0
            }]
        };
        
        return this.createPieChart(canvasId, chartData, 'pie');
    }
    
    /**
     * Update chart data
     */
    updateChart(canvasId, newData, datasetIndex = 0) {
        const chart = this.charts[canvasId];
        if (chart) {
            chart.data.datasets[datasetIndex].data = newData;
            chart.update();
        }
    }
    
    /**
     * Add dataset to existing chart
     */
    addDataset(canvasId, dataset) {
        const chart = this.charts[canvasId];
        if (chart) {
            chart.data.datasets.push(dataset);
            chart.update();
        }
    }
    
    /**
     * Export chart as image
     */
    exportChart(canvasId, format = 'png') {
        const chart = this.charts[canvasId];
        if (chart) {
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.href = url;
            link.download = `chart-${canvasId}.${format}`;
            link.click();
        }
    }
    
    /**
     * Get chart colors
     */
    static getColors() {
        return {
            primary: 'rgba(102, 126, 234, 0.8)',
            secondary: 'rgba(240, 147, 251, 0.8)',
            success: 'rgba(40, 167, 69, 0.8)',
            warning: 'rgba(255, 193, 7, 0.8)',
            danger: 'rgba(220, 53, 69, 0.8)',
            info: 'rgba(23, 162, 184, 0.8)',
            dark: 'rgba(52, 58, 64, 0.8)'
        };
    }
    
    /**
     * Generate random colors
     */
    static generateColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 360 / count) % 360;
            colors.push(`hsla(${hue}, 70%, 60%, 0.8)`);
        }
        return colors;
    }
}

// Create global instance
const chartManager = new ChartManager();