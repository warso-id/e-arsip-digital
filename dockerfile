# Dockerfile - E-Arsip Digital 2026
# Multi-stage build for optimal image size and security

# ============================================
# STAGE 1: BUILD
# ============================================
FROM node:20-alpine AS builder

LABEL maintainer="E-Arsip Digital Team <dev@e-arsip.example.com>"
LABEL version="2026.1.0"
LABEL description="E-Arsip Digital - Sistem Manajemen Arsip Digital"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build application
RUN npm run build && \
    npm run optimize && \
    npm run generate:pwa

# Remove dev dependencies
RUN npm prune --production

# ============================================
# STAGE 2: PRODUCTION
# ============================================
FROM nginx:1.27-alpine AS production

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=Asia/Jakarta
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY config/nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY config/nginx/gzip.conf /etc/nginx/conf.d/gzip.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy configuration files
COPY --from=builder /app/config/config.example.js /usr/share/nginx/html/config/
COPY --from=builder /app/.env.example /usr/share/nginx/html/

# Set permissions
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html && \
    chmod 644 /usr/share/nginx/html/.env.example

# Create required directories
RUN mkdir -p /usr/share/nginx/html/uploads && \
    mkdir -p /usr/share/nginx/html/backups && \
    chown -R appuser:appgroup /usr/share/nginx/html/uploads && \
    chown -R appuser:appgroup /usr/share/nginx/html/backups

# Security hardening
RUN rm -f /etc/nginx/conf.d/default.conf && \
    chmod 600 /etc/nginx/nginx.conf && \
    chmod 600 /etc/nginx/conf.d/*.conf

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Switch to non-root user
USER appuser

# Expose port
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
    vim

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Expose development port
EXPOSE 8080

# Start development server
CMD ["npm", "run", "dev"]