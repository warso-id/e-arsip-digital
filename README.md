# 📁 E-Arsip Digital v2026.1.0

<div align="center">

![Version](https://img.shields.io/badge/version-2026.1.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20PWA-orange?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=for-the-badge)
![Tests](https://img.shields.io/badge/tests-955%20passed-success?style=for-the-badge)
![Coverage](https://img.shields.io/badge/coverage-85%25-yellow?style=for-the-badge)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)

**Sistem Manajemen Arsip Digital Modern untuk Institusi Pendidikan**

[🚀 Features](#-features) •
[📦 Installation](#-installation) •
[📚 Documentation](#-documentation) •
[🧪 Testing](#-testing) •
[🔒 Security](#-security) •
[🤝 Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [Changelog](#-changelog)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## Overview

E-Arsip Digital adalah aplikasi manajemen arsip dan surat menyurat berbasis web dengan dukungan **PWA (Progressive Web App)**. Dirancang khusus untuk institusi pendidikan tinggi dengan dukungan **multi-role**, **workflow approval** yang lengkap, dan **8 lapis keamanan**.

### 🎯 Key Metrics

| Metric | Value |
|--------|-------|
| Total Files | 200+ |
| JavaScript Modules | 50+ |
| User Roles | 16 |
| Dashboards | 13 |
| Security Layers | 8 |
| Test Cases | 955+ |
| Code Coverage | 85%+ |
| CSS Themes | 8 |

---

## 🚀 Features

### 📧 Document Management
- **Surat Keluar** - Full lifecycle (draft → submit → multi-approval → final)
- **Surat Masuk** - Record, agenda, disposisi, tracking dengan QR scanner
- **Disposisi** - Multi-level forwarding dengan deadline tracking
- **Approval Workflow** - 5-step approval chain (Admin → Kasubag → Wadek → Dekan)
- **Penomoran Otomatis** - Customizable format `{nomor}/{kode}/{klasifikasi}/{bulan}/{tahun}`
- **QR Code** - Generate & verifikasi keaslian surat
- **Digital Signature** - 3 metode input (draw, upload, type)
- **File Upload** - Chunked upload, compression, preview, drag & drop

### 👥 User Management
- **16 User Roles**: super_admin, admin, dekan, wadek, kaprodi, kasubag, staf, dosen, mahasiswa, dll
- **Granular Permissions** - Per-module access control
- **Profile Management** - Edit profile, upload photo, change password
- **Activity Logging** - Comprehensive audit trail

### 📊 Dashboard & Reports
- **13 Role-Based Dashboards** - Customized for each role
- **Real-time Statistics** - Surat counts, approval status, user activity
- **Interactive Charts** - Chart.js with line, bar, doughnut, pie charts
- **Export** - PDF, Excel, CSV dengan formatting
- **Custom Reports** - Filterable date range, type, status

### 🔒 Security (8 Layers)
1. **AES-256-GCM Encryption** - Data at rest & in transit
2. **CSRF Protection** - Token rotation & double-submit pattern
3. **XSS Prevention** - Context-aware sanitization & CSP headers
4. **SQL Injection Prevention** - WAF rules & parameterized queries
5. **Rate Limiting** - Sliding window algorithm
6. **Session Hardening** - Fingerprint validation & idle timeout
7. **Intrusion Detection** - Brute force & anomaly detection
8. **Web Application Firewall** - 20+ security rules

### 🎨 UI/UX
- **8 Themes** - Light, Dark, Blue, Green, Purple, Orange, Red, Custom
- **PWA Support** - Offline mode, installable, push notifications
- **Responsive Design** - Mobile-first approach
- **Toast Notifications** - Success, error, warning, info variants
- **Keyboard Shortcuts** - Quick navigation & actions
- **Accessibility** - ARIA labels, screen reader support, focus management
- **Animations** - Smooth transitions & loading skeletons

### ⚙️ System Features
- **Backup & Restore** - Scheduled & manual backup
- **Activity Logs** - Comprehensive audit trail
- **System Settings** - Configurable application settings
- **Fix Dashboard** - One-click system repair
- **Add Feature Wizard** - One-click feature activation

---

## 📋 Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Frontend** | HTML5, CSS3, JavaScript (ES2024+) | - |
| **Backend** | Google Apps Script | - |
| **Database** | Google Sheets (via GAS) | - |
| **Storage** | Google Drive | - |
| **Charts** | Chart.js | 4.4.x |
| **IndexedDB** | Dexie.js | 4.x |
| **Security** | Web Crypto API, DOMPurify | 3.x |
| **PWA** | Service Worker, Web Manifest | - |
| **Testing** | Jest | 29.x |
| **Deployment** | Docker, Nginx, Netlify, Vercel | - |

---

## 📦 Installation

### Prerequisites

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **NPM** >= 9.0.0 (included with Node.js)
- **Google Account** (untuk Google Apps Script backend)
- **Git** ([Download](https://git-scm.com/))

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/username/e-arsip-digital.git
cd e-arsip-digital

# 2. Install dependencies
npm install

# 3. Copy configuration files
cp config/config.example.js config/config.js
cp .env.example .env

# 4. Edit config/config.js dengan kredensial Google Sheets Anda
#    - GOOGLE_SCRIPT_URL
#    - GOOGLE_DRIVE_FOLDER_ID
#    - GOOGLE_SPREADSHEET_ID

# 5. Jalankan development server
npm run dev