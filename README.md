# E-Arsip Digital v2026.1.0

![Version](https://img.shields.io/badge/version-2026.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20PWA-orange)

**Sistem Manajemen Arsip Digital Modern**

E-Arsip Digital adalah aplikasi manajemen arsip dan surat menyurat berbasis web dengan dukungan PWA (Progressive Web App). Dirancang untuk institusi pendidikan tinggi dengan dukungan multi-role dan workflow approval yang lengkap.

---

## 🚀 Fitur Utama

### 📧 Manajemen Surat
- **Surat Keluar** - Pembuatan surat dengan wizard 3 langkah
- **Surat Masuk** - Pencatatan surat masuk dengan QR scanner
- **Disposisi** - Workflow disposisi dengan tracking
- **Approval** - Multi-level approval system
- **Penomoran Otomatis** - Format penomoran yang dapat dikonfigurasi
- **QR Code** - Verifikasi keaslian surat

### 👥 Manajemen User
- 16 role pengguna (Super Admin, Admin, Dekan, Wadek, Kaprodi, dll)
- Manajemen hak akses dan permission
- Profile management dengan foto

### 📊 Laporan & Analytics
- Dashboard dengan statistik real-time
- Laporan surat masuk/keluar
- Grafik interaktif (Chart.js)
- Export ke PDF, Excel, CSV

### 🔒 Keamanan
- AES-256-GCM Encryption
- CSRF Protection
- XSS Prevention dengan DOMPurify
- Web Application Firewall
- Rate Limiting
- Session Hardening
- Security Monitoring Dashboard
- Audit Trail

### 🎨 UI/UX Modern
- 8 tema warna (Light, Dark, Blue, Green, Purple, Orange, Red, Custom)
- Responsive design
- PWA support (offline mode)
- Toast notifications
- Keyboard shortcuts
- Accessibility (ARIA)

### ⚙️ Sistem
- Backup & Restore
- Log aktivitas
- Pengaturan sistem
- Tanda tangan digital
- Export/Import data

---

## 📋 Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES2024+) |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Security | Web Crypto API, AES-256-GCM |
| Charts | Chart.js 4.x |
| PWA | Service Worker, Web Manifest |
| Deployment | Docker, Nginx, Netlify, Vercel |

---

## 🛠️ Instalasi

### Prerequisites
- Node.js >= 18.0.0
- NPM >= 9.0.0
- Google Account (untuk backend Google Sheets)

### Quick Start

```bash
# Clone repository
git clone https://github.com/username/e-arsip-digital.git
cd e-arsip-digital

# Install dependencies
npm install

# Copy configuration
cp config/config.example.js config/config.js
cp .env.example .env

# Edit config.js dengan kredensial Google Sheets Anda

# Jalankan development server
npm run dev