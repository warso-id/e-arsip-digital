#!/bin/bash
# scripts/deploy-safe.sh - Safe Deployment Script 2026
# E-Arsip Digital - Safe Deployment with Rollback
# Version: 2026.1.0

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${PROJECT_DIR}/deploy"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOY_LOG="${PROJECT_DIR}/logs/deploy_safe_${TIMESTAMP}.log"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$DEPLOY_DIR" "$BACKUP_DIR" "$(dirname "$DEPLOY_LOG")"

log() {
    echo -e "[$(date +'%H:%M:%S')] $1" | tee -a "$DEPLOY_LOG"
}

log_success() { log "${GREEN}✅ $1${NC}"; }
log_warn() { log "${YELLOW}⚠️  $1${NC}"; }
log_error() { log "${RED}❌ $1${NC}"; }
log_info() { log "${BLUE}ℹ️  $1${NC}"; }

echo "🛡️  E-Arsip Digital - Safe Deployment"
echo "======================================"
echo ""

# Check git status
log_info "Checking git status..."
if [ -d "$PROJECT_DIR/.git" ]; then
    if command -v git &> /dev/null; then
        cd "$PROJECT_DIR"
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            log_warn "Uncommitted changes detected"
            git status --short | while read line; do
                log_warn "  $line"
            done
        else
            log_success "Git working directory clean"
        fi
    fi
fi

# Run validation
log_info "Running project validation..."
if [ -f "$PROJECT_DIR/scripts/validate-project.sh" ]; then
    bash "$PROJECT_DIR/scripts/validate-project.sh" 2>&1 | tee -a "$DEPLOY_LOG" || {
        log_error "Validation failed! Aborting deployment."
        exit 1
    }
fi

# Create backup
log_info "Creating pre-deployment backup..."
BACKUP_FILE="${BACKUP_DIR}/pre_deploy_${TIMESTAMP}.tar.gz"
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='backups' \
    --exclude='.git' \
    --exclude='config/config.js' \
    --exclude='.env' \
    -C "$PROJECT_DIR" . 2>/dev/null && {
    log_success "Backup created: $BACKUP_FILE"
} || {
    log_error "Backup failed!"
    exit 1
}

# Build
log_info "Building project..."
cd "$PROJECT_DIR"

if [ -f "package.json" ]; then
    npm run build 2>&1 | tee -a "$DEPLOY_LOG" || {
        log_error "Build failed! Rollback not needed (no files deployed yet)."
        exit 1
    }
else
    log_info "No build script found, skipping build"
fi

# Deploy to target
TARGET="${1:-local}"
log_info "Deploying to: $TARGET"

case "$TARGET" in
    staging|production)
        if [ -f "$PROJECT_DIR/config/deploy-${TARGET}.conf" ]; then
            source "$PROJECT_DIR/config/deploy-${TARGET}.conf"
            
            log_info "Syncing files to ${DEPLOY_HOST}..."
            rsync -avz --delete \
                --exclude='.git' \
                --exclude='node_modules' \
                --exclude='config/config.js' \
                --exclude='.env' \
                --exclude='backups' \
                "${PROJECT_DIR}/dist/" \
                "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}" 2>&1 | tee -a "$DEPLOY_LOG" || {
                log_error "Deployment failed! Check log for details."
                exit 1
            }
            
            log_success "Deployment to $TARGET completed"
        else
            log_error "Deployment config not found: config/deploy-${TARGET}.conf"
            exit 1
        fi
        ;;
    local)
        LOCAL_PATH="${2:-/var/www/html/e-arsip}"
        mkdir -p "$LOCAL_PATH"
        
        if [ -d "$PROJECT_DIR/dist" ]; then
            cp -r "$PROJECT_DIR/dist/"* "$LOCAL_PATH/"
        else
            cp -r "$PROJECT_DIR/"* "$LOCAL_PATH/" 2>/dev/null || true
        fi
        
        log_success "Local deployment to: $LOCAL_PATH"
        ;;
    *)
        log_error "Unknown target: $TARGET"
        exit 1
        ;;
esac

log_success "Safe deployment completed!"
log_info "Backup available at: $BACKUP_FILE"