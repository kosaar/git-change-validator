#!/bin/bash

# Production deployment script for Git Change Validator
set -e

echo "=== Git Change Validator - Production Deployment ==="

# Configuration
DEPLOY_ENV="${DEPLOY_ENV:-production}"
BACKUP_DIR="/opt/git-validator/backups"
DATA_DIR="/opt/git-validator/data"
COMPOSE_FILE="docker-compose.prod.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        log_error ".env file not found. Please copy .env.example and configure it."
        exit 1
    fi
    
    # Check for required environment variables
    source .env
    required_vars=("POSTGRES_PASSWORD" "JWT_SECRET" "ANON_KEY" "SERVICE_ROLE_KEY")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_info "Prerequisites check passed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
    
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q supabase-db; then
        log_info "Backing up database to $BACKUP_FILE"
        docker-compose -f "$COMPOSE_FILE" exec -T supabase-db \
            pg_dump -U supabase supabase > "$BACKUP_FILE"
        
        if [ $? -eq 0 ]; then
            log_info "Database backup completed successfully"
            gzip "$BACKUP_FILE"
        else
            log_error "Database backup failed"
            exit 1
        fi
    else
        log_warn "Database not running, skipping backup"
    fi
}

# Prepare data directories
prepare_directories() {
    log_info "Preparing data directories..."
    
    sudo mkdir -p "$DATA_DIR/db"
    sudo mkdir -p "$DATA_DIR/storage"
    sudo mkdir -p "$BACKUP_DIR"
    
    # Set proper permissions
    sudo chown -R 999:999 "$DATA_DIR/db"  # PostgreSQL user
    sudo chown -R 1000:1000 "$DATA_DIR/storage"  # Storage user
    
    log_info "Data directories prepared"
}

# Build and deploy
deploy() {
    log_info "Starting deployment..."
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Build custom images
    log_info "Building custom images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache frontend
    
    # Stop existing services
    log_info "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check health
    check_health
}

# Health check
check_health() {
    log_info "Performing health checks..."
    
    local services=("supabase-db" "supabase-rest" "kong" "frontend" "nginx")
    local failed_services=()
    
    for service in "${services[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q "$service.*Up"; then
            log_info "✓ $service is running"
        else
            log_error "✗ $service is not running"
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_info "All services are healthy"
        
        # Test API endpoint
        if curl -f -s http://localhost/health > /dev/null; then
            log_info "✓ API endpoint is accessible"
        else
            log_warn "⚠ API endpoint test failed"
        fi
        
    else
        log_error "Failed services: ${failed_services[*]}"
        return 1
    fi
}

# Cleanup old images and containers
cleanup() {
    log_info "Cleaning up old Docker resources..."
    
    # Remove old images
    docker image prune -f
    
    # Remove old containers
    docker container prune -f
    
    # Remove old volumes (be careful with this)
    # docker volume prune -f
    
    log_info "Cleanup completed"
}

# Setup SSL certificates (if not exists)
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    SSL_DIR="./nginx/ssl"
    mkdir -p "$SSL_DIR"
    
    if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
        log_warn "SSL certificates not found. Generating self-signed certificates for development."
        log_warn "For production, replace with proper SSL certificates."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$SSL_DIR/key.pem" \
            -out "$SSL_DIR/cert.pem" \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=git-validator.company.com"
        
        log_info "Self-signed certificates generated"
    else
        log_info "SSL certificates already exist"
    fi
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Create monitoring directory
    mkdir -p ./monitoring
    
    # Start monitoring services if configured
    if [ -f "docker-compose.monitoring.yml" ]; then
        docker-compose -f docker-compose.monitoring.yml up -d
        log_info "Monitoring services started"
    else
        log_warn "Monitoring configuration not found, skipping"
    fi
}

# Main deployment function
main() {
    local action="${1:-deploy}"
    
    case "$action" in
        "deploy"|"start")
            check_prerequisites
            prepare_directories
            setup_ssl
            create_backup
            deploy
            cleanup
            setup_monitoring
            ;;
        "stop")
            log_info "Stopping all services..."
            docker-compose -f "$COMPOSE_FILE" down
            ;;
        "restart")
            log_info "Restarting services..."
            docker-compose -f "$COMPOSE_FILE" restart
            check_health
            ;;
        "backup")
            create_backup
            ;;
        "health")
            check_health
            ;;
        "logs")
            docker-compose -f "$COMPOSE_FILE" logs -f
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            echo "Usage: $0 {deploy|start|stop|restart|backup|health|logs|cleanup}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full deployment (default)"
            echo "  start    - Same as deploy"
            echo "  stop     - Stop all services"
            echo "  restart  - Restart services"
            echo "  backup   - Create database backup"
            echo "  health   - Check service health"
            echo "  logs     - Show service logs"
            echo "  cleanup  - Clean up old Docker resources"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

log_info "Deployment script completed"
echo ""
echo "Application URLs:"
echo "  Frontend: https://localhost (or your configured domain)"
echo "  API: https://localhost/api"
echo "  Health Check: https://localhost/health"
echo ""
echo "Management commands:"
echo "  View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "  Scale services: docker-compose -f $COMPOSE_FILE up -d --scale frontend=2"
echo "  Update images: docker-compose -f $COMPOSE_FILE pull && docker-compose -f $COMPOSE_FILE up -d"