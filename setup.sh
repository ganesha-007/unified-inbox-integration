#!/bin/bash

# Unified Messaging Platform Setup Script
# This script sets up the development environment for the unified messaging platform

set -e

echo "🚀 Setting up Unified Messaging Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL is not installed. Please install PostgreSQL 13+ and try again."
        print_warning "You can install it using: brew install postgresql (macOS) or apt-get install postgresql (Ubuntu)"
    fi
    
    # Check Redis
    if ! command -v redis-server &> /dev/null; then
        print_warning "Redis is not installed. Please install Redis 6+ and try again."
        print_warning "You can install it using: brew install redis (macOS) or apt-get install redis-server (Ubuntu)"
    fi
    
    print_success "Requirements check completed"
}

# Install backend dependencies
setup_backend() {
    print_status "Setting up backend..."
    
    cd backend
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Copy environment file
    if [ ! -f .env ]; then
        print_status "Creating environment file..."
        cp config.example.env .env
        print_warning "Please edit backend/.env with your configuration"
    fi
    
    # Create necessary directories
    mkdir -p uploads logs
    
    cd ..
    print_success "Backend setup completed"
}

# Install frontend dependencies
setup_frontend() {
    print_status "Setting up frontend..."
    
    cd client
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    cd ..
    print_success "Frontend setup completed"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -q; then
        print_warning "PostgreSQL is not running. Please start PostgreSQL and try again."
        print_warning "You can start it using: brew services start postgresql (macOS) or systemctl start postgresql (Ubuntu)"
        return
    fi
    
    # Create database
    print_status "Creating database..."
    createdb unified_inbox 2>/dev/null || print_warning "Database 'unified_inbox' might already exist"
    
    print_success "Database setup completed"
}

# Setup Redis
setup_redis() {
    print_status "Setting up Redis..."
    
    # Check if Redis is running
    if ! redis-cli ping &> /dev/null; then
        print_warning "Redis is not running. Please start Redis and try again."
        print_warning "You can start it using: brew services start redis (macOS) or systemctl start redis-server (Ubuntu)"
        return
    fi
    
    print_success "Redis setup completed"
}

# Create Docker setup
setup_docker() {
    print_status "Setting up Docker configuration..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Skipping Docker setup."
        return
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose is not installed. Skipping Docker setup."
        return
    fi
    
    print_success "Docker configuration is ready"
    print_status "You can run 'docker-compose up -d' to start the application with Docker"
}

# Main setup function
main() {
    echo "=========================================="
    echo "  Unified Messaging Platform Setup"
    echo "=========================================="
    echo
    
    check_requirements
    echo
    
    setup_backend
    echo
    
    setup_frontend
    echo
    
    setup_database
    echo
    
    setup_redis
    echo
    
    setup_docker
    echo
    
    echo "=========================================="
    print_success "Setup completed successfully!"
    echo "=========================================="
    echo
    print_status "Next steps:"
    echo "1. Edit backend/.env with your API keys and configuration"
    echo "2. Start PostgreSQL and Redis services"
    echo "3. Run 'cd backend && npm run dev' to start the backend"
    echo "4. Run 'cd client && npm start' to start the frontend"
    echo "5. Open http://localhost:3001 in your browser"
    echo
    print_status "For Docker deployment:"
    echo "1. Configure environment variables in docker-compose.yml"
    echo "2. Run 'docker-compose up -d'"
    echo
    print_status "API Documentation:"
    echo "- Import postman/Unified-Messaging-API.postman_collection.json into Postman"
    echo "- API base URL: http://localhost:5001"
    echo
    print_warning "Don't forget to:"
    echo "- Set up your UniPile API account"
    echo "- Configure Gmail and Microsoft Graph APIs"
    echo "- Set up Stripe for billing"
    echo "- Configure webhook endpoints"
}

# Run main function
main "$@"
