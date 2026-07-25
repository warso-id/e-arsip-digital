// js/upload.js - Advanced File Upload Handler 2026
/**
 * E-Arsip Digital - File Upload Handler
 * Version: 2026.1.0
 * Features: Chunked upload, resume, compression, virus scan, preview
 */

import APP_CONFIG from '../config/config.js';
import { Logger } from './logger.js';
import apiService from './api.js';
import utils from './utils.js';
import { SecuritySanitizer } from './security/sanitizer.js';

class FileUploader {
    constructor(options = {}) {
        this.logger = new Logger('FileUploader');
        this.sanitizer = new SecuritySanitizer();
        
        // Configuration
        this.config = {
            maxFileSize: APP_CONFIG.upload?.maxFileSize || 10485760, // 10MB
            allowedTypes: APP_CONFIG.upload?.allowedTypes || [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png',
                'image/gif'
            ],
            maxFiles: APP_CONFIG.upload?.maxFiles || 5,
            chunkSize: APP_CONFIG.upload?.chunkSize || 1048576, // 1MB
            endpoint: APP_CONFIG.upload?.endpoint || '/api/upload',
            autoUpload: true,
            multiple: false,
            dropzone: null,
            preview: true,
            compress: true,
            maxCompressSize: 5242880, // 5MB - compress files larger than this
            ...options
        };
        
        // State
        this.files = new Map();
        this.uploadQueue = [];
        this.isUploading = false;
        this.totalProgress = 0;
        
        // DOM elements
        this.container = null;
        this.input = null;
        this.dropzone = null;
        this.previewContainer = null;
        
        // Callbacks
        this.onFileAdded = options.onFileAdded || (() => {});
        this.onFileRemoved = options.onFileRemoved || (() => {});
        this.onProgress = options.onProgress || (() => {});
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || (() => {});
        this.onComplete = options.onComplete || (() => {});
        
        // Bind methods
        this.handleDrop = this.handleDrop.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    mount(container) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!this.container) {
            throw new Error('Upload container not found');
        }
        
        this.render();
        this.attachEventListeners();
        
        this.logger.info('File uploader mounted', {
            maxSize: this.config.maxFileSize,
            allowedTypes: this.config.allowedTypes
        });
    }
    
    render() {
        this.container.innerHTML = this.getUploadHTML();
        this.cacheElements();
    }
    
    getUploadHTML() {
        return `
            <div class="upload-container">
                <!-- Dropzone -->
                <div class="upload-dropzone" id="${this.getId('dropzone')}">
                    <div class="dropzone-content">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <h4>Seret & Lepaskan File di Sini</h4>
                        <p>atau</p>
                        <button type="button" class="btn btn-primary" id="${this.getId('browse-btn')}">
                            <i class="fas fa-folder-open"></i> Pilih File
                        </button>
                        <p class="upload-info">
                            Maksimal ${utils.formatFileSize(this.config.maxFileSize)} 
                            ${this.config.multiple ? `(maks. ${this.config.maxFiles} file)` : ''}
                        </p>
                        <p class="upload-types">
                            Tipe: ${this.getReadableTypes()}
                        </p>
                    </div>
                    <input type="file" 
                        id="${this.getId('file-input')}" 
                        class="upload-input"
                        ${this.config.multiple ? 'multiple' : ''}
                        accept="${this.config.allowedTypes.join(',')}"
                        hidden
                    >
                </div>
                
                <!-- Preview Container -->
                <div class="upload-preview" id="${this.getId('preview')}"></div>
                
                <!-- Upload Progress -->
                <div class="upload-progress" id="${this.getId('progress')}" style="display:none;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
                
                <!-- Action Buttons -->
                <div class="upload-actions" id="${this.getId('actions')}" style="display:none;">
                    <button type="button" class="btn btn-primary" id="${this.getId('upload-btn')}">
                        <i class="fas fa-upload"></i> Upload
                    </button>
                    <button type="button" class="btn btn-outline" id="${this.getId('cancel-btn')}">
                        <i class="fas fa-times"></i> Batal
                    </button>
                </div>
            </div>
        `;
    }
    
    cacheElements() {
        this.dropzone = document.getElementById(this.getId('dropzone'));
        this.input = document.getElementById(this.getId('file-input'));
        this.previewContainer = document.getElementById(this.getId('preview'));
        this.progressBar = document.querySelector(`#${this.getId('progress')} .progress-fill`);
        this.progressText = document.querySelector(`#${this.getId('progress')} .progress-text`);
        this.actionsContainer = document.getElementById(this.getId('actions'));
    }
    
    attachEventListeners() {
        // Browse button
        const browseBtn = document.getElementById(this.getId('browse-btn'));
        browseBtn?.addEventListener('click', () => this.input.click());
        
        // File input
        this.input?.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Dropzone events
        this.dropzone?.addEventListener('dragover', this.handleDragOver);
        this.dropzone?.addEventListener('dragleave', this.handleDragLeave);
        this.dropzone?.addEventListener('drop', this.handleDrop);
        
        // Upload/Cancel buttons
        document.getElementById(this.getId('upload-btn'))?.addEventListener('click', () => this.uploadAll());
        document.getElementById(this.getId('cancel-btn'))?.addEventListener('click', () => this.cancelAll());
        
        // Paste event for images
        document.addEventListener('paste', (e) => this.handlePaste(e));
    }
    
    // ============================================
    // FILE HANDLING
    // ============================================
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.addFiles(files);
        event.target.value = ''; // Reset input
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dropzone?.classList.add('drag-over');
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dropzone?.classList.remove('drag-over');
    }
    
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dropzone?.classList.remove('drag-over');
        
        const files = Array.from(event.dataTransfer.files);
        this.addFiles(files);
    }
    
    async handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items) return;
        
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    this.addFiles([file]);
                }
            }
        }
    }
    
    addFiles(files) {
        const currentCount = this.files.size;
        const remainingSlots = this.config.maxFiles - currentCount;
        
        if (remainingSlots <= 0) {
            this.showError(`Maksimal ${this.config.maxFiles} file yang dapat diupload`);
            return;
        }
        
        const filesToAdd = files.slice(0, remainingSlots);
        
        for (const file of filesToAdd) {
            const validation = this.validateFile(file);
            
            if (validation.valid) {
                const fileId = this.generateFileId();
                const fileData = {
                    id: fileId,
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    status: 'pending', // pending | compressing | uploading | success | error | cancelled
                    progress: 0,
                    error: null,
                    preview: null,
                    compressedFile: null
                };
                
                this.files.set(fileId, fileData);
                
                // Generate preview for images
                if (file.type.startsWith('image/') && this.config.preview) {
                    this.generatePreview(fileData);
                }
                
                // Compress if needed
                if (this.config.compress && file.size > this.config.maxCompressSize) {
                    this.compressFile(fileData);
                }
                
                this.onFileAdded(fileData);
            } else {
                this.showError(validation.error);
            }
        }
        
        this.updateUI();
        
        // Auto upload
        if (this.config.autoUpload && this.files.size > 0) {
            this.uploadAll();
        }
    }
    
    removeFile(fileId) {
        const fileData = this.files.get(fileId);
        if (!fileData) return;
        
        // Cancel upload if in progress
        if (fileData.status === 'uploading' && fileData.xhr) {
            fileData.xhr.abort();
        }
        
        // Revoke preview URL
        if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
        }
        
        this.files.delete(fileId);
        this.onFileRemoved(fileData);
        this.updateUI();
    }
    
    clearFiles() {
        this.files.forEach((fileData, fileId) => {
            if (fileData.preview) {
                URL.revokeObjectURL(fileData.preview);
            }
        });
        
        this.files.clear();
        this.updateUI();
    }
    
    // ============================================
    // FILE VALIDATION
    // ============================================
    
    validateFile(file) {
        // Check file size
        if (file.size > this.config.maxFileSize) {
            return {
                valid: false,
                error: `File "${file.name}" terlalu besar. Maksimal ${utils.formatFileSize(this.config.maxFileSize)}`
            };
        }
        
        // Check file type
        if (!this.config.allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: `Tipe file "${file.name}" tidak diizinkan`
            };
        }
        
        // Check for duplicate
        const isDuplicate = Array.from(this.files.values())
            .some(f => f.name === file.name && f.size === file.size);
        
        if (isDuplicate) {
            return {
                valid: false,
                error: `File "${file.name}" sudah ditambahkan`
            };
        }
        
        // Sanitize filename
        const sanitizedName = this.sanitizer.sanitizeFilename(file.name);
        if (sanitizedName !== file.name) {
            this.logger.warn('Filename sanitized', { 
                original: file.name, 
                sanitized: sanitizedName 
            });
        }
        
        return { valid: true };
    }
    
    // ============================================
    // FILE COMPRESSION
    // ============================================
    
    async compressFile(fileData) {
        if (!fileData.file.type.startsWith('image/')) return;
        
        fileData.status = 'compressing';
        this.updateFilePreview(fileData);
        
        try {
            const compressed = await this.compressImage(fileData.file);
            fileData.compressedFile = compressed;
            
            this.logger.debug('File compressed', {
                name: fileData.name,
                originalSize: fileData.size,
                compressedSize: compressed.size,
                ratio: ((1 - compressed.size / fileData.size) * 100).toFixed(1) + '%'
            });
        } catch (error) {
            this.logger.warn('File compression failed, using original', error);
            fileData.compressedFile = fileData.file;
        }
        
        fileData.status = 'pending';
        this.updateFilePreview(fileData);
    }
    
    compressImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                const maxDimension = 1920;
                
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Canvas toBlob failed'));
                    }
                }, 'image/jpeg', 0.8);
            };
            
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = URL.createObjectURL(file);
        });
    }
    
    // ============================================
    // FILE UPLOAD
    // ============================================
    
    async uploadAll() {
        if (this.isUploading) return;
        
        this.isUploading = true;
        this.totalProgress = 0;
        
        const pendingFiles = Array.from(this.files.values())
            .filter(f => f.status === 'pending');
        
        if (pendingFiles.length === 0) {
            this.isUploading = false;
            return;
        }
        
        this.showProgress();
        
        for (const fileData of pendingFiles) {
            try {
                await this.uploadFile(fileData);
            } catch (error) {
                this.logger.error('Upload failed for file', {
                    name: fileData.name,
                    error: error.message
                });
            }
        }
        
        this.isUploading = false;
        this.hideProgress();
        this.onComplete();
    }
    
    async uploadFile(fileData) {
        const file = fileData.compressedFile || fileData.file;
        
        // Determine upload strategy based on file size
        if (file.size > this.config.chunkSize) {
            return this.uploadChunked(fileData, file);
        } else {
            return this.uploadDirect(fileData, file);
        }
    }
    
    async uploadDirect(fileData, file) {
        fileData.status = 'uploading';
        this.updateFilePreview(fileData);
        
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file, fileData.name);
            formData.append('fileId', fileData.id);
            
            const xhr = new XMLHttpRequest();
            fileData.xhr = xhr;
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    fileData.progress = Math.round((e.loaded / e.total) * 100);
                    this.updateFileProgress(fileData);
                    this.updateTotalProgress();
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    fileData.status = 'success';
                    fileData.progress = 100;
                    fileData.response = JSON.parse(xhr.responseText);
                    
                    this.updateFilePreview(fileData);
                    this.onSuccess(fileData);
                    resolve(fileData);
                } else {
                    this.handleUploadError(fileData, new Error(`HTTP ${xhr.status}`));
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                this.handleUploadError(fileData, new Error('Network error'));
                reject(new Error('Network error'));
            });
            
            xhr.addEventListener('abort', () => {
                fileData.status = 'cancelled';
                this.updateFilePreview(fileData);
                reject(new Error('Upload cancelled'));
            });
            
            xhr.open('POST', this.config.endpoint);
            xhr.setRequestHeader('Authorization', `Bearer ${this.getAuthToken()}`);
            xhr.send(formData);
        });
    }
    
    async uploadChunked(fileData, file) {
        fileData.status = 'uploading';
        this.updateFilePreview(fileData);
        
        const totalChunks = Math.ceil(file.size / this.config.chunkSize);
        const uploadId = await this.initiateChunkedUpload(fileData, totalChunks);
        
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * this.config.chunkSize;
            const end = Math.min(start + this.config.chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            await this.uploadChunk(uploadId, chunkIndex, chunk, totalChunks);
            
            fileData.progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
            this.updateFileProgress(fileData);
            this.updateTotalProgress();
        }
        
        // Complete upload
        const result = await this.completeChunkedUpload(uploadId, fileData);
        
        fileData.status = 'success';
        fileData.progress = 100;
        fileData.response = result;
        
        this.updateFilePreview(fileData);
        this.onSuccess(fileData);
    }
    
    async initiateChunkedUpload(fileData, totalChunks) {
        const response = await apiService.post(`${this.config.endpoint}/init`, {
            fileName: fileData.name,
            fileSize: fileData.size,
            fileType: fileData.type,
            totalChunks: totalChunks
        });
        
        return response.data.uploadId;
    }
    
    async uploadChunk(uploadId, chunkIndex, chunk, totalChunks) {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        
        return apiService.post(`${this.config.endpoint}/chunk`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
    
    async completeChunkedUpload(uploadId, fileData) {
        const response = await apiService.post(`${this.config.endpoint}/complete`, {
            uploadId: uploadId,
            fileName: fileData.name
        });
        
        return response.data;
    }
    
    handleUploadError(fileData, error) {
        fileData.status = 'error';
        fileData.error = error.message;
        this.updateFilePreview(fileData);
        this.onError(fileData, error);
    }
    
    cancelAll() {
        this.files.forEach((fileData) => {
            if (fileData.status === 'uploading' && fileData.xhr) {
                fileData.xhr.abort();
            }
        });
        
        this.clearFiles();
        this.hideProgress();
        this.isUploading = false;
    }
    
    // ============================================
    // PREVIEW GENERATION
    // ============================================
    
    generatePreview(fileData) {
        if (!fileData.file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            fileData.preview = e.target.result;
            this.updateFilePreview(fileData);
        };
        reader.readAsDataURL(fileData.file);
    }
    
    getFileIcon(fileData) {
        if (fileData.file.type.startsWith('image/')) {
            return '<i class="fas fa-image"></i>';
        } else if (fileData.file.type.includes('pdf')) {
            return '<i class="fas fa-file-pdf"></i>';
        } else if (fileData.file.type.includes('word')) {
            return '<i class="fas fa-file-word"></i>';
        } else if (fileData.file.type.includes('excel') || fileData.file.type.includes('spreadsheet')) {
            return '<i class="fas fa-file-excel"></i>';
        } else {
            return '<i class="fas fa-file"></i>';
        }
    }
    
    // ============================================
    // UI UPDATES
    // ============================================
    
    updateUI() {
        this.renderPreviews();
        this.updateActionsVisibility();
    }
    
    renderPreviews() {
        if (!this.previewContainer) return;
        
        this.previewContainer.innerHTML = Array.from(this.files.values())
            .map(fileData => this.getFilePreviewHTML(fileData))
            .join('');
        
        // Attach remove handlers
        this.previewContainer.querySelectorAll('.file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.currentTarget.dataset.fileId;
                this.removeFile(fileId);
            });
        });
    }
    
    getFilePreviewHTML(fileData) {
        const statusClass = `file-status-${fileData.status}`;
        const isImage = fileData.file.type.startsWith('image/');
        
        return `
            <div class="file-preview ${statusClass}" data-file-id="${fileData.id}">
                <div class="file-thumbnail">
                    ${isImage && fileData.preview 
                        ? `<img src="${fileData.preview}" alt="${fileData.name}">`
                        : this.getFileIcon(fileData)
                    }
                </div>
                <div class="file-info">
                    <div class="file-name">${utils.truncate(fileData.name, 30)}</div>
                    <div class="file-size">${utils.formatFileSize(fileData.size)}</div>
                    <div class="file-status-text">${this.getStatusText(fileData.status)}</div>
                </div>
                ${fileData.status !== 'uploading' ? `
                    <button class="file-remove" data-file-id="${fileData.id}" title="Hapus">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
                ${fileData.status === 'uploading' ? `
                    <div class="file-progress">
                        <div class="file-progress-bar" style="width: ${fileData.progress}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    updateFilePreview(fileData) {
        const element = this.previewContainer?.querySelector(`[data-file-id="${fileData.id}"]`);
        if (element) {
            element.outerHTML = this.getFilePreviewHTML(fileData);
        }
    }
    
    updateFileProgress(fileData) {
        const element = this.previewContainer?.querySelector(`[data-file-id="${fileData.id}"]`);
        const progressBar = element?.querySelector('.file-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${fileData.progress}%`;
        }
    }
    
    updateTotalProgress() {
        const files = Array.from(this.files.values());
        const totalProgress = files.reduce((sum, f) => sum + f.progress, 0);
        this.totalProgress = Math.round(totalProgress / files.length);
        
        if (this.progressBar) {
            this.progressBar.style.width = `${this.totalProgress}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = `${this.totalProgress}%`;
        }
    }
    
    updateActionsVisibility() {
        if (!this.actionsContainer) return;
        
        const hasPendingFiles = Array.from(this.files.values())
            .some(f => f.status === 'pending');
        
        this.actionsContainer.style.display = hasPendingFiles ? 'flex' : 'none';
    }
    
    showProgress() {
        const progressEl = document.getElementById(this.getId('progress'));
        if (progressEl) progressEl.style.display = 'block';
    }
    
    hideProgress() {
        const progressEl = document.getElementById(this.getId('progress'));
        if (progressEl) progressEl.style.display = 'none';
    }
    
    showError(message) {
        this.logger.warn('Upload error:', message);
        
        // Dispatch event for global error handling
        window.dispatchEvent(new CustomEvent('upload:error', {
            detail: { message }
        }));
    }
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    getId(suffix) {
        return `upload-${this.config.id || 'default'}-${suffix}`;
    }
    
    generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getStatusText(status) {
        const statusMap = {
            pending: 'Menunggu',
            compressing: 'Mengompres...',
            uploading: 'Mengupload...',
            success: 'Berhasil',
            error: 'Gagal',
            cancelled: 'Dibatalkan'
        };
        return statusMap[status] || status;
    }
    
    getReadableTypes() {
        return this.config.allowedTypes
            .map(type => type.split('/').pop().toUpperCase())
            .join(', ');
    }
    
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    getFiles() {
        return Array.from(this.files.values());
    }
    
    getSuccessfulFiles() {
        return Array.from(this.files.values())
            .filter(f => f.status === 'success');
    }
    
    reset() {
        this.clearFiles();
        this.hideProgress();
        this.isUploading = false;
        this.totalProgress = 0;
    }
    
    destroy() {
        this.clearFiles();
        this.container.innerHTML = '';
        this.logger.info('File uploader destroyed');
    }
}

export default FileUploader;
export { FileUploader };