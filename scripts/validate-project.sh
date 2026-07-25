#!/bin/bash
# scripts/validate-project.sh - Project Validation 2026
# E-Arsip Digital - Project Structure Validator
# Version: 2026.1.0

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0
WARNINGS=0

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 E-Arsip Digital - Project Validator"
echo "======================================="
echo ""

# Required files
REQUIRED_FILES=(
    "index.html"
    "login.html"
    "404.html"
    "config/config.example.js"
    "js/init.js"
    "js/api.js"
    "js/auth.js"
    "js/utils.js"
    "js/logger.js"
    "js/session.js"
    "js/security/encryption.js"
    "js/security/csrf.js"
    "js/security/xss.js"
    "js/security/firewall.js"
    "components/sidebar.js"
    "components/modal.js"
    "components/table.js"
    "css/style.css"
    "sw.js"
    "manifest.json"
    "package.json"
    "README.md"
    ".gitignore"
)

echo "📁 Checking required files..."
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROJECT_DIR/$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file - MISSING!"
        ((ERRORS++))
    fi
done
echo ""

# Sensitive files that should NOT exist (or should be in .gitignore)
SENSITIVE_FILES=(
    "config/config.js"
    ".env"
    "Google-Apps-Script/Code.gs"
    "credentials.json"
    "service-account.json"
)

echo "🔒 Checking sensitive files..."
for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$PROJECT_DIR/$file" ]; then
        echo -e "  ${YELLOW}⚠${NC}  $file - Found (should be in .gitignore)"
        ((WARNINGS++))
    else
        echo -e "  ${GREEN}✓${NC} $file - Not found (safe)"
    fi
done
echo ""

# Check .gitignore for essential entries
echo "📋 Checking .gitignore..."
GITIGNORE_FILE="$PROJECT_DIR/.gitignore"
if [ -f "$GITIGNORE_FILE" ]; then
    ESSENTIAL_ENTRIES=(
        "config/config.js"
        ".env"
        "node_modules/"
        "Google-Apps-Script/"
        "backups/"
    )
    
    for entry in "${ESSENTIAL_ENTRIES[@]}"; do
        if grep -qF "$entry" "$GITIGNORE_FILE"; then
            echo -e "  ${GREEN}✓${NC} $entry"
        else
            echo -e "  ${YELLOW}⚠${NC}  $entry - Not in .gitignore"
            ((WARNINGS++))
        fi
    done
else
    echo -e "  ${RED}✗${NC} .gitignore not found!"
    ((ERRORS++))
fi
echo ""

# Directory structure check
echo "📁 Checking directory structure..."
REQUIRED_DIRS=(
    "config"
    "js"
    "js/security"
    "components"
    "css"
    "css/themes"
    "dashboard"
    "surat-keluar"
    "surat-masuk"
    "profile"
    "manajemen-user"
    "laporan"
    "log-aktivitas"
    "notifikasi"
    "pengaturan"
    "help"
    "error"
    "scripts"
    "icons"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$PROJECT_DIR/$dir" ]; then
        echo -e "  ${GREEN}✓${NC} $dir/"
    else
        echo -e "  ${RED}✗${NC} $dir/ - MISSING!"
        ((ERRORS++))
    fi
done
echo ""

# File count
JS_COUNT=$(find "$PROJECT_DIR/js" -name "*.js" 2>/dev/null | wc -l)
CSS_COUNT=$(find "$PROJECT_DIR/css" -name "*.css" 2>/dev/null | wc -l)
HTML_COUNT=$(find "$PROJECT_DIR" -name "*.html" -not -path "*/node_modules/*" 2>/dev/null | wc -l)

echo "📊 Project Statistics:"
echo "  JavaScript files: $JS_COUNT"
echo "  CSS files: $CSS_COUNT"
echo "  HTML files: $HTML_COUNT"
echo ""

# Summary
echo "======================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Project validation PASSED - No errors or warnings${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Project validation PASSED with $WARNINGS warning(s)${NC}"
else
    echo -e "${RED}❌ Project validation FAILED - $ERRORS error(s), $WARNINGS warning(s)${NC}"
fi

exit $ERRORS