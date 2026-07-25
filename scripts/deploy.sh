#!/bin/bash

# =============================================
# E-Arsip Digital - Deployment Script 2026
# Version: 2026.1.0
# Safe for GitHub upload
# =============================================

set -euo pipefail

# =============================================
# CONFIGURATION
# =============================================
APP_NAME="e-arsip-digital"
APP_VERSION="2026.1.0"
DEPLOY_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_DIR}/dist"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_DIR="${PROJECT_DIR}/logs"
DEPLOY_LOG="${LOG_DIR}/deploy_${DEPLOY_DATE}.log"

# =============================================
# COLORS
# =============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================
# FUNCTIONS
# =============================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    echo -e "[${timestamp}] [${level}] ${message}" | tee -a "$DEPLOY_LOG"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "${YELLOW}WARN${NC}" "$@"; }
log_error() { log "${RED}ERROR${NC}" "$@"; }
log_success() { log "${GREEN}SUCCESS${NC}" "$@"; }

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════╗"
    echo "║         E-Arsip Digital Deploy           ║"
    echo "║           Version ${APP_VERSION}                  ║"
    echo "╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_requirements() {
    log_info "Checking requirements..."
    
    local requirements=("node" "npm" "git")
    local missing=()
    
    for cmd in "${requirements[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing requirements: ${missing[*]}"
        log_error "Please install them and try again."
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js version 18 or higher is required. Current: $(node -v)"
        exit 1
    fi
    
    log_success "All requirements met"
}

validate_project() {
    log_info "Validating project..."
    
    cd "$PROJECT_DIR"
    
    # Check required files
    local required_files=(
        "package.json"
        "index.html"
        "login.html"
        "config/config.example.js"
        "js/init.js"
        "js/api.js"
        "js/auth.js"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Check for sensitive files that shouldn't be deployed
    local sensitive_files=(
        "config/config.js"
        ".env"
        "Google-Apps-Script/Code.gs"
        "credentials.json"
        "service-account.json"
    )
    
    for file in "${sensitive_files[@]}"; do
        if [ -f "$file" ]; then
            log_warn "Sensitive file found (will be excluded): $file"
        fi
    done
    
    # Run project validation if available
    if [ -f "scripts/validate-project.sh" ]; then
        bash scripts/validate-project.sh || {
            log_error "Project validation failed"
            exit 1
        }
    fi
    
    log_success "Project validation passed"
}

install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Clean install
    rm -rf node_modules package-lock.json
    
    # Install production dependencies
    npm ci --production=false || {
        log_error "Failed to install dependencies"
        exit 1
    }
    
    log_success "Dependencies installed"
}

run_tests() {
    log_info "Running tests..."
    
    cd "$PROJECT_DIR"
    
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test || {
            log_warn "Some tests failed"
        }
    else
        log_info "No tests configured, skipping"
    fi
}

build_project() {
    log_info "Building project..."
    
    cd "$PROJECT_DIR"
    
    # Clean previous build
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    
    # Run build script if available
    if grep -q '"build"' package.json; then
        npm run build || {
            log_error "Build failed"
            exit 1
        }
    else
        # Manual build
        log_info "Performing manual build..."
        
        # Copy HTML files
        find . -name "*.html" -not -path "./node_modules/*" -not -path "./dist/*" \
            -not -path "./Google-Apps-Script/*" -not -path "./backups/*" \
            -exec cp --parents {} "$BUILD_DIR/" \;
        
        # Copy CSS files
        find . -name "*.css" -not -path "./node_modules/*" -not -path "./dist/*" \
            -exec cp --parents {} "$BUILD_DIR/" \;
        
        # Copy JS files
        find . -name "*.js" -not -path "./node_modules/*" -not -path "./dist/*" \
            -not -path "./tests/*" -not -path "./Google-Apps-Script/*" \
            -exec cp --parents {} "$BUILD_DIR/" \;
        
        # Copy assets
        [ -d "icons" ] && cp -r icons "$BUILD_DIR/"
        [ -f "manifest.json" ] && cp manifest.json "$BUILD_DIR/"
        [ -f "sw.js" ] && cp sw.js "$BUILD_DIR/"
        [ -f "robots.txt" ] && cp robots.txt "$BUILD_DIR/"
        [ -f "sitemap.xml" ] && cp sitemap.xml "$BUILD_DIR/"
        
        # Copy config templates (safe versions)
        [ -f "config/config.example.js" ] && cp config/config.example.js "$BUILD_DIR/config/"
        [ -f ".env.example" ] && cp .env.example "$BUILD_DIR/"
        
        # Copy server configs
        [ -f ".htaccess" ] && cp .htaccess "$BUILD_DIR/"
        [ -f "nginx.conf" ] && cp nginx.conf "$BUILD_DIR/"
    fi
    
    # Remove sensitive files from build
    find "$BUILD_DIR" -name "config.js" -not -name "*.example.*" -delete
    find "$BUILD_DIR" -name ".env" -delete
    find "$BUILD_DIR" -name "*.gs" -delete
    find "$BUILD_DIR" -path "*/Google-Apps-Script/*" -delete
    find "$BUILD_DIR" -path "*/backups/*" -delete
    find "$BUILD_DIR" -path "*/tests/*" -delete
    
    # Optimize if tools available
    if command -v terser &> /dev/null; then
        log_info "Minifying JavaScript files..."
        find "$BUILD_DIR" -name "*.js" -exec terser {} -o {} -c -m \;
    fi
    
    if command -v cleancss &> /dev/null; then
        log_info "Minifying CSS files..."
        find "$BUILD_DIR" -name "*.css" -exec cleancss -o {} {} \;
    fi
    
    log_success "Build completed: $BUILD_DIR"
}

create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_file="${BACKUP_DIR}/backup_${DEPLOY_DATE}.tar.gz"
    
    tar -czf "$backup_file" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='backups' \
        --exclude='.git' \
        --exclude='config/config.js' \
        --exclude='.env' \
        --exclude='Google-Apps-Script' \
        -C "$PROJECT_DIR" . || {
        log_error "Backup failed"
        return 1
    }
    
    # Keep only last 5 backups
    ls -t "${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
    
    log_success "Backup created: $backup_file"
}

deploy_to_target() {
    local target=$1
    
    log_info "Deploying to: $target"
    
    case "$target" in
        staging|production)
            # FTP/SSH deployment
            deploy_via_ssh "$target"
            ;;
        netlify)
            deploy_to_netlify
            ;;
        vercel)
            deploy_to_vercel
            ;;
        docker)
            deploy_with_docker
            ;;
        local)
            deploy_local
            ;;
        *)
            log_error "Unknown target: $target"
            log_info "Available targets: staging, production, netlify, vercel, docker, local"
            exit 1
            ;;
    esac
}

deploy_via_ssh() {
    local env=$1
    
    # Load deployment config
    local deploy_config="${PROJECT_DIR}/config/deploy-${env}.conf"
    if [ ! -f "$deploy_config" ]; then
        log_error "Deployment config not found: $deploy_config"
        exit 1
    fi
    
    source "$deploy_config"
    
    log_info "Deploying to ${DEPLOY_HOST}..."
    
    # Sync files via rsync
    rsync -avz --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='config/config.js' \
        --exclude='.env' \
        "$BUILD_DIR/" \
        "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}" || {
        log_error "Deployment failed"
        exit 1
    }
    
    log_success "Deployment to $env completed"
}

deploy_to_netlify() {
    log_info "Deploying to Netlify..."
    
    if ! command -v netlify &> /dev/null; then
        npm install -g netlify-cli
    fi
    
    cd "$BUILD_DIR"
    netlify deploy --prod --dir=. || {
        log_error "Netlify deployment failed"
        exit 1
    }
    
    log_success "Netlify deployment completed"
}

deploy_to_vercel() {
    log_info "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        npm install -g vercel
    fi
    
    cd "$PROJECT_DIR"
    vercel --prod || {
        log_error "Vercel deployment failed"
        exit 1
    }
    
    log_success "Vercel deployment completed"
}

deploy_with_docker() {
    log_info "Deploying with Docker..."
    
    cd "$PROJECT_DIR"
    
    # Build Docker image
    docker build -t "${APP_NAME}:${APP_VERSION}" . || {
        log_error "Docker build failed"
        exit 1
    }
    
    # Tag as latest
    docker tag "${APP_NAME}:${APP_VERSION}" "${APP_NAME}:latest"
    
    # Run with docker-compose
    if [ -f "docker-compose.yml" ]; then
        docker-compose up -d || {
            log_error "Docker Compose deployment failed"
            exit 1
        }
    fi
    
    log_success "Docker deployment completed"
}

deploy_local() {
    log_info "Deploying locally..."
    
    local deploy_path="${1:-/var/www/html/e-arsip}"
    
    mkdir -p "$deploy_path"
    cp -r "$BUILD_DIR"/* "$deploy_path/"
    
    log_success "Local deployment completed: $deploy_path"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if index.html is accessible
    if [ -f "${BUILD_DIR}/index.html" ]; then
        log_success "Build verification passed"
    else
        log_error "Build verification failed: index.html not found"
        exit 1
    fi
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove build artifacts if needed
    # rm -rf "$BUILD_DIR"
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# =============================================
# MAIN
# =============================================

main() {
    print_banner
    
    # Create directories
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    
    # Parse arguments
    local target="${1:-local}"
    local skip_tests="${2:-false}"
    
    log_info "Starting deployment process..."
    log_info "Target: $target"
    log_info "Version: $APP_VERSION"
    
    # Run deployment steps
    check_requirements
    validate_project
    install_dependencies
    
    if [ "$skip_tests" != "true" ]; then
        run_tests
    fi
    
    create_backup
    build_project
    verify_deployment
    deploy_to_target "$target"
    
    log_success "Deployment completed successfully!"
    log_info "Deployment log: $DEPLOY_LOG"
}

# =============================================
# USAGE
# =============================================
usage() {
    echo "Usage: $0 [target] [skip-tests]"
    echo ""
    echo "Targets:"
    echo "  local       - Deploy locally (default)"
    echo "  staging     - Deploy to staging server"
    echo "  production  - Deploy to production server"
    echo "  netlify     - Deploy to Netlify"
    echo "  vercel      - Deploy to Vercel"
    echo "  docker      - Deploy with Docker"
    echo ""
    echo "Options:"
    echo "  skip-tests  - Skip running tests (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0 local"
    echo "  $0 production true"
}

# Run
if [ "$#" -eq 0 ]; then
    usage
    exit 1
fi

main "$@"
