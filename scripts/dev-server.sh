#!/bin/bash

# =============================================
# E-Arsip Digital - Development Server 2026
# Version: 2026.1.0
# Hot-reload development server with live reload
# =============================================

set -euo pipefail

# Configuration
PORT="${1:-8080}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVERELOAD_PORT=35729
WATCH_DIRS="js css components config dashboard surat-keluar surat-masuk profile manajemen-user laporan log-aktivitas notifikasi pengaturan help error"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║     E-Arsip Digital Dev Server           ║"
echo "║           Version 2026.1.0                ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if http-server is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js"
    exit 1
fi

# Create livereload injection script
LIVERELOAD_SCRIPT="
<script>
(function() {
    var script = document.createElement('script');
    script.src = 'http://localhost:${LIVERELOAD_PORT}/livereload.js';
    document.head.appendChild(script);
})();
</script>
"

# Kill any existing servers on the ports
kill $(lsof -t -i:${PORT} 2>/dev/null) 2>/dev/null || true
kill $(lsof -t -i:${LIVERELOAD_PORT} 2>/dev/null) 2>/dev/null || true

echo -e "${GREEN}Starting development server...${NC}"
echo -e "  Project: ${PROJECT_DIR}"
echo -e "  HTTP Server: http://localhost:${PORT}"
echo -e "  LiveReload: http://localhost:${LIVERELOAD_PORT}"
echo ""

# Start live reload server
if command -v livereload &> /dev/null; then
    livereload "${PROJECT_DIR}" -p ${LIVERELOAD_PORT} -w 500 &
    LIVERELOAD_PID=$!
    echo -e "${GREEN}LiveReload started (PID: ${LIVERELOAD_PID})${NC}"
else
    echo -e "${YELLOW}LiveReload not installed. Install with: npm install -g livereload${NC}"
    echo -e "${YELLOW}File watching will use polling instead.${NC}"
fi

# Watch for file changes and trigger rebuild
if command -v fswatch &> /dev/null; then
    fswatch -o ${WATCH_DIRS} | while read; do
        echo -e "${YELLOW}Files changed, triggering rebuild...${NC}"
        # Touch a marker file to trigger browser refresh
        touch "${PROJECT_DIR}/.refresh"
    done &
    WATCH_PID=$!
fi

# Start HTTP server with CORS and no-cache headers
npx http-server "${PROJECT_DIR}" \
    -p ${PORT} \
    -c-1 \
    --cors \
    --gzip \
    -o /index.html \
    -s &

HTTP_PID=$!

echo -e "${GREEN}HTTP Server started (PID: ${HTTP_PID})${NC}"
echo ""
echo -e "Press ${YELLOW}Ctrl+C${NC} to stop all servers"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    
    kill ${HTTP_PID} 2>/dev/null || true
    
    if [ ! -z ${LIVERELOAD_PID+x} ]; then
        kill ${LIVERELOAD_PID} 2>/dev/null || true
    fi
    
    if [ ! -z ${WATCH_PID+x} ]; then
        kill ${WATCH_PID} 2>/dev/null || true
    fi
    
    # Clean up any remaining processes on our ports
    kill $(lsof -t -i:${PORT} 2>/dev/null) 2>/dev/null || true
    kill $(lsof -t -i:${LIVERELOAD_PORT} 2>/dev/null) 2>/dev/null || true
    
    echo -e "${GREEN}All servers stopped.${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait