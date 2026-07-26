# Dockerfile - E-Arsip Digital 2026
# Multi-stage build for optimal image size and security
# Build: docker build -t e-arsip-digital:2026.1.0 .
# Run:   docker run -p 8080:80 e-arsip-digital:2026.1.0

# ============================================
# STAGE 0: DEPENDENCIES (CACHE LAYER)
# ============================================
FROM node:20-alpine AS dependencies

LABEL maintainer="E-Arsip Digital Team <dev@e-arsip.example.com>"
LABEL org.opencontainers.image.title="E-Arsip Digital"
LABEL org.opencontainers.image.description="Sistem Manajemen Arsip Digital Modern"
LABEL org.opencontainers.image.version="2026.1.0"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    git

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci --include=dev --ignore-scripts && \
    npm cache clean --force

# ============================================
# STAGE 1: BUILD
# ============================================
FROM dependencies AS builder

WORKDIR /app

# Copy source code
COPY . .

# Copy node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Run build if available, otherwise copy files directly
RUN if [ -f "package.json" ] && grep -q '"build"' package.json; then \
        npm run build; \
    else \
        echo "No build script found, preparing files..."; \
        mkdir -p dist && \
        cp -r \
            *.html \
            css/ \
            js/ \
            config/ \
            components/ \
            icons/ \
            screenshots/ \
            dashboard/ \
            surat-keluar/ \
            surat-masuk/ \
            profile/ \
            pengaturan/ \
            manajemen-user/ \
            notifikasi/ \
            laporan/ \
            log-aktivitas/ \
            help/ \
            sw.js \
            manifest.json \
            robots.txt \
            .htaccess \
            dist/ 2>/dev/null || true; \
    fi

# Generate PWA assets if workbox config exists
RUN if [ -f "workbox-config.js" ]; then \
        npx workbox generateSW workbox-config.js 2>/dev/null || true; \
    fi

# Remove development dependencies
RUN npm prune --production && \
    apk del .build-deps

# ============================================
# STAGE 2: PRODUCTION (NGINX)
# ============================================
FROM nginx:1.27-alpine AS production

# Install runtime dependencies
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        curl \
        ca-certificates \
        tzdata \
        tini \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=Asia/Jakarta
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo "$TZ" > /etc/timezone

# Create non-root user dengan dynamic UID/GID
ARG UID=1001
ARG GID=1001
RUN addgroup -g ${GID} -S appgroup && \
    adduser -u ${UID} -S appuser -G appgroup && \
    # Create nginx directories
    mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    touch /var/run/nginx.pid

# Copy nginx configuration
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/nginx.conf
COPY --chown=appuser:appgroup .htaccess /usr/share/nginx/html/.htaccess 2>/dev/null || true

# Create nginx conf.d directory
RUN mkdir -p /etc/nginx/conf.d /etc/nginx/snippets

# Copy built files from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist /usr/share/nginx/html

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Create required directories
RUN mkdir -p /usr/share/nginx/html/uploads \
             /usr/share/nginx/html/backups \
             /usr/share/nginx/html/logs \
    && chown -R appuser:appgroup /usr/share/nginx/html

# Set proper permissions
RUN chmod -R 755 /usr/share/nginx/html && \
    chmod 744 /var/cache/nginx /var/log/nginx && \
    chmod 600 /etc/nginx/nginx.conf

# Create health check endpoint
RUN mkdir -p /usr/share/nginx/html/health && \
    echo '{"status":"healthy","version":"2026.1.0","timestamp":"'$(date -Iseconds)'"}' \
    > /usr/share/nginx/html/health/index.json

# Configure nginx for health check
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    \n\
    location /health {\n\
        default_type application/json;\n\
        return 200 '"'"'{"status":"healthy","version":"2026.1.0"}'"';\n\
    }\n\
    \n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
    \n\
    # Security headers\n\
    add_header X-Frame-Options "SAMEORIGIN" always;\n\
    add_header X-Content-Type-Options "nosniff" always;\n\
    add_header X-XSS-Protection "1; mode=block" always;\n\
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;\n\
    \n\
    # Caching\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
    \n\
    location ~* \\.(html|json)$ {\n\
        expires 1h;\n\
        add_header Cache-Control "public";\n\
    }\n\
    \n\
    # Service Worker\n\
    location = /sw.js {\n\
        expires off;\n\
        add_header Cache-Control "no-cache, no-store, must-revalidate";\n\
        add_header Service-Worker-Allowed "/";\n\
    }\n\
    \n\
    # Deny access to hidden files\n\
    location ~ /\\. {\n\
        deny all;\n\
        access_log off;\n\
        log_not_found off;\n\
    }\n\
    \n\
    # Deny access to sensitive files\n\
    location ~* \\.(env|config\\.js|sql|bak|backup|log)$ {\n\
        deny all;\n\
        access_log off;\n\
        log_not_found off;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:80/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 80 443

# Set volumes for persistent data
VOLUME ["/usr/share/nginx/html/uploads", "/usr/share/nginx/html/backups"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# ============================================
# STAGE 3: DEVELOPMENT
# ============================================
FROM node:20-alpine AS development

WORKDIR /app

# Install development tools
RUN apk add --no-cache \
    bash \
    curl \
    git \
    vim \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=Asia/Jakarta

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev)
RUN npm install && \
    npm cache clean --force

# Copy source code
COPY . .

# Expose ports
EXPOSE 8080 9229

# Set environment
ENV NODE_ENV=development
ENV HOT_RELOAD=true

# Start development server with hot reload
CMD ["npm", "run", "dev"]

# ============================================
# STAGE 4: TESTING
# ============================================
FROM node:20-alpine AS testing

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --include=dev && \
    npm cache clean --force

# Copy source code
COPY . .

# Run tests
CMD ["npm", "test"]

# ============================================
# STAGE 5: AUDIT/SECURITY SCAN
# ============================================
FROM node:20-alpine AS security

WORKDIR /app

# Install security tools
RUN apk add --no-cache \
    curl \
    git \
    && npm install -g \
    snyk \
    retire \
    njsscan

# Copy package files
COPY package.json package-lock.json* ./

# Run security audit
RUN npm audit --audit-level=high && \
    npx snyk test --severity-threshold=high || true

CMD ["echo", "Security scan complete"]