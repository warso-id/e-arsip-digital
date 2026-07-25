#!/bin/bash
# scripts/backup.sh - Backup Script 2026
# E-Arsip Digital - Automated Backup
# Version: 2026.1.0

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📦 E-Arsip Digital - Backup"
echo "============================"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Creating backup: ${BACKUP_FILE}"

# Create backup
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='backups' \
    --exclude='.git' \
    --exclude='config/config.js' \
    --exclude='.env' \
    --exclude='Google-Apps-Script' \
    -C "$PROJECT_DIR" .

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup berhasil: ${BACKUP_FILE} (${SIZE})${NC}"
    
    # Keep only last 10 backups
    ls -t "${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm
    echo "🧹 Old backups cleaned (keeping last 10)"
else
    echo -e "${RED}❌ Backup gagal${NC}"
    exit 1
fi