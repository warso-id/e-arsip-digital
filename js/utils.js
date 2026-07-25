// js/utils.js - Utility Functions 2026 (REGULAR SCRIPT)
/**
 * E-Arsip Digital - Utility Functions
 * Version: 2026.1.0
 * ⬇️ DIUBAH: Dari ES Module ke regular script (window.EArsip.Utils)
 */
(function() {
    'use strict';
    
    var Utils = {
        /**
         * Format tanggal ke format Indonesia
         */
        formatDate: function(date, format) {
            if (!date) return '-';
            
            var d = new Date(date);
            if (isNaN(d.getTime())) return 'Invalid Date';
            
            var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                         'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            var shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                              'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            
            var day = d.getDate();
            var month = d.getMonth();
            var year = d.getFullYear();
            var hours = String(d.getHours()).padStart(2, '0');
            var minutes = String(d.getMinutes()).padStart(2, '0');
            
            switch (format) {
                case 'full':
                    return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                case 'long':
                    return day + ' ' + months[month] + ' ' + year;
                case 'medium':
                    return day + ' ' + shortMonths[month] + ' ' + year;
                case 'short':
                    return day + '/' + (month + 1) + '/' + year;
                case 'time':
                    return hours + ':' + minutes;
                case 'datetime':
                    return day + ' ' + shortMonths[month] + ' ' + year + ' ' + hours + ':' + minutes;
                case 'iso':
                    return d.toISOString();
                default:
                    return day + ' ' + months[month] + ' ' + year;
            }
        },
        
        /**
         * Format waktu relatif (time ago)
         */
        timeAgo: function(date) {
            if (!date) return '-';
            
            var now = new Date();
            var past = new Date(date);
            var diffMs = now - past;
            var diffSec = Math.floor(diffMs / 1000);
            var diffMin = Math.floor(diffSec / 60);
            var diffHour = Math.floor(diffMin / 60);
            var diffDay = Math.floor(diffHour / 24);
            
            if (diffSec < 60) return 'Baru saja';
            if (diffMin < 60) return diffMin + ' menit yang lalu';
            if (diffHour < 24) return diffHour + ' jam yang lalu';
            if (diffDay < 7) return diffDay + ' hari yang lalu';
            if (diffDay < 30) return Math.floor(diffDay / 7) + ' minggu yang lalu';
            if (diffDay < 365) return Math.floor(diffDay / 30) + ' bulan yang lalu';
            return Math.floor(diffDay / 365) + ' tahun yang lalu';
        },
        
        /**
         * Format mata uang
         */
        formatCurrency: function(amount) {
            return 'Rp ' + Number(amount).toLocaleString('id-ID');
        },
        
        /**
         * Format nomor
         */
        formatNumber: function(number) {
            return Number(number).toLocaleString('id-ID');
        },
        
        /**
         * Format ukuran file
         */
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            var k = 1024;
            var sizes = ['Bytes', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },
        
        /**
         * Generate UUID
         */
        generateUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        },
        
        /**
         * Truncate text
         */
        truncate: function(text, length) {
            length = length || 100;
            if (!text || text.length <= length) return text;
            return text.substring(0, length) + '...';
        },
        
        /**
         * Strip HTML tags
         */
        stripHtml: function(html) {
            var div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        },
        
        /**
         * Debounce function
         */
        debounce: function(func, wait) {
            var timeout;
            return function() {
                var context = this, args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(function() {
                    func.apply(context, args);
                }, wait || 300);
            };
        },
        
        /**
         * Validasi email
         */
        isValidEmail: function(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        
        /**
         * Download file
         */
        downloadFile: function(url, filename) {
            var link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        
        /**
         * Copy to clipboard
         */
        copyToClipboard: function(text) {
            return navigator.clipboard.writeText(text).catch(function() {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            });
        },
        
        /**
         * Get URL parameter
         */
        getUrlParam: function(name) {
            var params = new URLSearchParams(window.location.search);
            return params.get(name);
        },
        
        /**
         * Set URL parameter tanpa reload
         */
        setUrlParam: function(name, value) {
            var params = new URLSearchParams(window.location.search);
            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }
            var newUrl = window.location.pathname + '?' + params.toString();
            window.history.replaceState({}, '', newUrl);
        }
    };
    
    // Expose ke global
    window.EArsip.Utils = Utils;
    
    console.log('Utils ready');
})();
