# ============================================
# E-ARSIP DIGITAL - ENVIRONMENT VARIABLES
# ============================================
# Copy file ini ke .env dan isi dengan nilai yang sesuai
# ⚠️  JANGAN PERNAH COMMIT .env KE REPOSITORY
# ⚠️  GUNAKAN NILAI YANG BERBEDA UNTUK SETIAP ENVIRONMENT
# ============================================

# ============================================
# APPLICATION
# ============================================
APP_NAME=E-Arsip Digital
APP_VERSION=2026.1.0
APP_ENV=production
APP_DEBUG=false
APP_URL=https://e-arsip.example.com
APP_PORT=8080

# ============================================
# GOOGLE APPS SCRIPT INTEGRATION
# ============================================
# Dapatkan dari: Google Apps Script Editor > Deploy > Web App URL
GAS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
GAS_API_KEY=your-google-api-key
GAS_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GAS_CLIENT_SECRET=your-google-client-secret

# Google Drive (untuk upload file)
# Dapatkan dari: Google Drive > Folder > URL (bagian setelah /folders/)
GOOGLE_DRIVE_FOLDER_ID=YOUR_DRIVE_FOLDER_ID
GOOGLE_DRIVE_MAX_UPLOAD_SIZE=10485760

# Google Spreadsheet (untuk backup/logging)
GOOGLE_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
GOOGLE_SPREADSHEET_SHEET_NAME=Data

# ============================================
# INSTANSI / ORGANIZATION
# ============================================
INSTANSI_NAMA=Fakultas Ilmu Komputer
INSTANSI_SINGKATAN=FIKOM
INSTANSI_ALAMAT=Jl. Contoh No. 123, Jakarta 12345
INSTANSI_TELEPON=(021) 12345678
INSTANSI_EMAIL=admin@fikom.ac.id
INSTANSI_WEBSITE=https://fikom.ac.id
INSTANSI_LOGO_URL=/icons/logo.png

# ============================================
# SECURITY (⚠️ GUNAKAN NILAI YANG KUAT & UNIK)
# ============================================
# Generate dengan: openssl rand -hex 32
SESSION_SECRET=change-me-to-random-64-char-string
# Generate dengan: openssl rand -base64 32
ENCRYPTION_KEY=change-me-to-random-base64-string
# Generate dengan: openssl rand -hex 16
CSRF_SECRET=change-me-to-random-32-char-string
# Generate dengan: openssl rand -base64 24
JWT_SECRET=change-me-to-random-jwt-secret

# Session Configuration
SESSION_TIMEOUT=3600000
SESSION_IDLE_TIMEOUT=1800000
SESSION_ABSOLUTE_TIMEOUT=28800000
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=Strict

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=false
PASSWORD_EXPIRY_DAYS=90

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_BLOCK_DURATION_MS=300000

# ============================================
# CORS (Cross-Origin Resource Sharing)
# ============================================
CORS_ENABLED=true
CORS_ALLOWED_ORIGINS=https://e-arsip.example.com,https://admin.e-arsip.example.com
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-CSRF-Token,X-Requested-With
CORS_MAX_AGE=86400

# ============================================
# CONTENT SECURITY POLICY (CSP)
# ============================================
CSP_ENABLED=true
CSP_REPORT_ONLY=false
CSP_DEFAULT_SRC=self
CSP_SCRIPT_SRC=self,unsafe-inline,https://cdn.jsdelivr.net
CSP_STYLE_SRC=self,unsafe-inline,https://cdn.jsdelivr.net,https://fonts.googleapis.com
CSP_FONT_SRC=self,https://fonts.gstatic.com,https://cdn.jsdelivr.net
CSP_IMG_SRC=self,data:,blob:,https:
CSP_CONNECT_SRC=self,https://script.google.com
CSP_FRAME_SRC=none
CSP_REPORT_URI=/api/csp-report

# ============================================
# DATABASE (Optional - jika menggunakan backend)
# ============================================
# DB_TYPE=sqlite
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=e_arsip
# DB_USER=postgres
# DB_PASSWORD=your-db-password
# DB_SSL=true

# ============================================
# REDIS (Optional - untuk caching/session)
# ============================================
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=your-redis-password
# REDIS_DB=0

# ============================================
# EMAIL / SMTP (Optional)
# ============================================
MAIL_ENABLED=false
MAIL_DRIVER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=admin@fikom.ac.id
MAIL_PASSWORD=your-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=admin@fikom.ac.id
MAIL_FROM_NAME=E-Arsip Digital

# ============================================
# PWA (Progressive Web App)
# ============================================
PWA_ENABLED=true
PWA_THEME_COLOR=#2563eb
PWA_BACKGROUND_COLOR=#ffffff
PWA_DISPLAY=standalone
PWA_ORIENTATION=portrait-primary
PWA_START_URL=/

# ============================================
# PUSH NOTIFICATIONS (VAPID Keys)
# ============================================
# Generate dengan: npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY=your-vapid-public-key
# VAPID_PRIVATE_KEY=your-vapid-private-key
# VAPID_SUBJECT=mailto:admin@fikom.ac.id

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
LOG_CHANNEL=console
LOG_FILE_PATH=/var/log/e-arsip/app.log
LOG_MAX_FILES=30
LOG_MAX_SIZE_MB=10

# ============================================
# MONITORING & ERROR TRACKING (Optional)
# ============================================
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
# ANALYTICS_ID=G-XXXXXXXXXX

# ============================================
# BACKUP
# ============================================
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * 0
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/backups/e-arsip/

# ============================================
# FEATURE FLAGS
# ============================================
FEATURE_DARK_MODE=true
FEATURE_QR_CODE=true
FEATURE_DIGITAL_SIGNATURE=true
FEATURE_APPROVAL_WORKFLOW=true
FEATURE_EXPORT_PDF=true
FEATURE_EXPORT_EXCEL=true
FEATURE_BULK_OPERATIONS=true
FEATURE_OFFLINE_MODE=true
FEATURE_PUSH_NOTIFICATIONS=false
FEATURE_TWO_FACTOR_AUTH=false

# ============================================
# DEPLOYMENT
# ============================================
DEPLOY_URL=https://e-arsip.example.com
DEPLOY_BRANCH=main
DEPLOY_AUTO_DEPLOY=true

# ============================================
# DOCKER (Optional)
# ============================================
# DOCKER_REGISTRY=ghcr.io
# DOCKER_IMAGE=username/e-arsip-digital
# DOCKER_TAG=2026.1.0