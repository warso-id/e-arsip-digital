#!/bin/bash
# scripts/fix-common-issues.sh - Auto-Fix Script 2026
# E-Arsip Digital - Fix Common Issues
# Version: 2026.1.0

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔧 E-Arsip Digital - Auto Fix"
echo "=============================="
echo ""

FIXED=0
ERRORS=0

# Fix 1: Check file permissions
echo "📁 Checking file permissions..."
if [ -d "$PROJECT_DIR" ]; then
    find "$PROJECT_DIR" -type f -name "*.html" ! -perm 644 -exec chmod 644 {} \; -exec echo "  Fixed permissions: {}" \; 2>/dev/null && ((FIXED++)) || true
    find "$PROJECT_DIR" -type f -name "*.js" ! -perm 644 -exec chmod 644 {} \; 2>/dev/null && ((FIXED++)) || true
    find "$PROJECT_DIR" -type f -name "*.css" ! -perm 644 -exec chmod 644 {} \; 2>/dev/null && ((FIXED++)) || true
    echo -e "  ${GREEN}✅ Permissions checked${NC}"
fi

# Fix 2: Clear old cache files
echo "🗑️  Checking for old cache files..."
if [ -d "$PROJECT_DIR/.cache" ]; then
    rm -rf "$PROJECT_DIR/.cache" && echo -e "  ${GREEN}✅ Cache cleared${NC}" && ((FIXED++))
fi

# Fix 3: Check for broken symlinks
echo "🔗 Checking for broken symlinks..."
find "$PROJECT_DIR" -type l ! -exec test -e {} \; -print 2>/dev/null | while read link; do
    echo "  Removing broken symlink: $link"
    rm "$link"
    ((FIXED++))
done
echo -e "  ${GREEN}✅ Symlinks checked${NC}"

# Fix 4: Ensure required directories exist
echo "📁 Ensuring required directories exist..."
REQUIRED_DIRS=("logs" "backups" "uploads" "temp")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$PROJECT_DIR/$dir" ]; then
        mkdir -p "$PROJECT_DIR/$dir"
        echo -e "  ${GREEN}✅ Created: $dir/${NC}"
        ((FIXED++))
    fi
done

# Fix 5: Check .gitignore for essential entries
echo "📋 Checking .gitignore..."
if [ -f "$PROJECT_DIR/.gitignore" ]; then
    ESSENTIALS=("config/config.js" ".env" "node_modules/" "Google-Apps-Script/" "backups/")
    for entry in "${ESSENTIALS[@]}"; do
        if ! grep -qF "$entry" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
            echo "$entry" >> "$PROJECT_DIR/.gitignore"
            echo -e "  ${YELLOW}⚠️  Added to .gitignore: $entry${NC}"
            ((FIXED++))
        fi
    done
    echo -e "  ${GREEN}✅ .gitignore checked${NC}"
fi

# Fix 6: Clean npm cache
echo "📦 Cleaning npm cache..."
if command -v npm &> /dev/null && [ -d "$PROJECT_DIR/node_modules" ]; then
    npm cache clean --force 2>/dev/null && echo -e "  ${GREEN}✅ npm cache cleaned${NC}" && ((FIXED++)) || true
fi

# Fix 7: Remove duplicate files
echo "🔍 Checking for duplicate files..."
find "$PROJECT_DIR" -name "*.copy.*" -o -name "*.bak" -o -name "*~" 2>/dev/null | while read file; do
    echo "  Removing: $file"
    rm "$file"
    ((FIXED++))
done
echo -e "  ${GREEN}✅ Duplicates checked${NC}"

echo ""
echo "=============================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Auto-fix completed! $FIXED issues fixed.${NC}"
else
    echo -e "${YELLOW}⚠️  Auto-fix completed with $ERRORS errors. $FIXED issues fixed.${NC}"
fi