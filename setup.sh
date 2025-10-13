#!/bin/bash

# WhatsApp Messaging Application Setup Script
# This script automates the setup process for the client

echo "🚀 Setting up WhatsApp Messaging Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is installed
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js is installed: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js from https://nodejs.org/"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_status "npm is installed: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
}

# Check if PostgreSQL is running
check_postgresql() {
    if command -v psql &> /dev/null; then
        print_status "PostgreSQL is installed"
        
        # Try to connect to PostgreSQL
        if psql -U postgres -c "SELECT 1;" &> /dev/null; then
            print_status "PostgreSQL is running and accessible"
        else
            print_warning "PostgreSQL is installed but not accessible. Please start PostgreSQL service."
            print_warning "On macOS: brew services start postgresql"
            print_warning "On Ubuntu: sudo systemctl start postgresql"
        fi
    else
        print_warning "PostgreSQL is not installed. Please install PostgreSQL or use Docker."
    fi
}

# Install backend dependencies
install_backend_deps() {
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    if [ $? -eq 0 ]; then
        print_status "Backend dependencies installed successfully"
    else
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    cd ..
}

# Install frontend dependencies
install_frontend_deps() {
    print_status "Installing frontend dependencies..."
    cd client
    npm install
    if [ $? -eq 0 ]; then
        print_status "Frontend dependencies installed successfully"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    cd ..
}

# Create .env file if it doesn't exist
create_env_file() {
    if [ ! -f "backend/.env" ]; then
        print_status "Creating .env file from template..."
        cp backend/config.example.env backend/.env
        print_warning "Please edit backend/.env file with your actual configuration values"
    else
        print_status ".env file already exists"
    fi
}

# Create database
create_database() {
    print_status "Creating database..."
    if command -v psql &> /dev/null; then
        psql -U postgres -c "CREATE DATABASE unified_inbox;" 2>/dev/null || print_warning "Database might already exist"
        print_status "Database setup completed"
    else
        print_warning "Skipping database creation - PostgreSQL not accessible"
    fi
}

# Main setup function
main() {
    echo "🔍 Checking prerequisites..."
    check_nodejs
    check_npm
    check_postgresql
    
    echo ""
    echo "📦 Installing dependencies..."
    install_backend_deps
    install_frontend_deps
    
    echo ""
    echo "⚙️  Setting up configuration..."
    create_env_file
    create_database
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Edit backend/.env file with your actual configuration"
    echo "2. Start backend: cd backend && node server-working.js"
    echo "3. Start frontend: cd client && npm start"
    echo "4. Open http://localhost:3001 in your browser"
    echo ""
    echo "📖 For detailed instructions, see CLIENT_SETUP_GUIDE.md"
}

# Run main function
main