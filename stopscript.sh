#!/bin/bash

# Unified Inbox Integration - Stop Script
# This script stops all running services

echo "🛑 Stopping Unified Inbox Integration services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Stop processes by name
print_info "Stopping backend server (nodemon)..."
pkill -f "nodemon" && print_status "Backend stopped" || print_warning "Backend was not running"

print_info "Stopping frontend server (react-scripts)..."
pkill -f "react-scripts" && print_status "Frontend stopped" || print_warning "Frontend was not running"

print_info "Stopping ngrok tunnel..."
pkill -f "ngrok" && print_status "ngrok stopped" || print_warning "ngrok was not running"

# Stop processes by PID if files exist
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    kill $BACKEND_PID 2>/dev/null && print_status "Backend (PID: $BACKEND_PID) stopped" || true
    rm .backend.pid
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    kill $FRONTEND_PID 2>/dev/null && print_status "Frontend (PID: $FRONTEND_PID) stopped" || true
    rm .frontend.pid
fi

if [ -f ".ngrok.pid" ]; then
    NGROK_PID=$(cat .ngrok.pid)
    kill $NGROK_PID 2>/dev/null && print_status "ngrok (PID: $NGROK_PID) stopped" || true
    rm .ngrok.pid
fi

# Optional: Stop database services (uncomment if needed)
# print_info "Stopping PostgreSQL and Redis services..."
# brew services stop postgresql@14
# brew services stop redis

print_status "All services stopped!"
echo ""
print_info "To start services again, run: ./runscript.sh"
