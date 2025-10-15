#!/bin/bash

# Unified Inbox Integration - Complete Setup and Run Script
# This script sets up and runs the entire project from scratch

echo "🚀 Starting Unified Inbox Integration Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "backend" ] && [ ! -d "client" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Setting up Unified Inbox Integration..."

# 1. Install PostgreSQL and Redis
print_info "Installing PostgreSQL and Redis..."
brew install postgresql
brew install redis

# 2. Start PostgreSQL and Redis services
print_info "Starting PostgreSQL and Redis services..."
brew services start postgresql@14
brew services start redis

# 3. Create database
print_info "Creating database..."
createdb unified_inbox

# 4. Install ngrok
print_info "Installing ngrok..."
brew install ngrok/ngrok/ngrok

# 5. Configure ngrok (you'll need to add your authtoken)
print_warning "Please configure ngrok with your authtoken:"
print_warning "ngrok config add-authtoken YOUR_AUTHTOKEN_HERE"
print_warning "Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"

# 6. Install backend dependencies
print_info "Installing backend dependencies..."
cd backend
npm install
cd ..

# 7. Install frontend dependencies
print_info "Installing frontend dependencies..."
cd client
npm install --legacy-peer-deps
cd ..

# 8. Create environment file
print_info "Setting up environment configuration..."
cd backend
cp config.example.env .env
cd ..

# 9. Create WhatsApp account in database
print_info "Creating WhatsApp account connection..."
cd backend
node scripts/createWhatsAppAccount.js
cd ..

# 10. Kill any existing processes
print_info "Stopping any existing processes..."
pkill -f "nodemon" || true
pkill -f "react-scripts" || true
pkill -f "ngrok" || true

# 11. Start backend server
print_info "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# 12. Start frontend server
print_info "Starting frontend server..."
cd client
npm start &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# 13. Start ngrok tunnel
print_info "Starting ngrok tunnel..."
ngrok http 5001 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 5

# 14. Get ngrok URL
print_info "Getting ngrok public URL..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['tunnels'][0]['public_url']) if data['tunnels'] else print('No tunnels found')")

if [ "$NGROK_URL" != "No tunnels found" ]; then
    print_status "ngrok tunnel active: $NGROK_URL"
    print_info "Webhook URL for UniPile: ${NGROK_URL}/app/unipile"
else
    print_warning "Could not get ngrok URL. Please check ngrok status."
fi

# 15. Display status
echo ""
print_status "🎉 Setup Complete!"
echo ""
print_info "Services running:"
print_info "  • Backend: http://localhost:5001"
print_info "  • Frontend: http://localhost:3000"
print_info "  • ngrok: $NGROK_URL"
echo ""
print_info "Next steps:"
print_info "  1. Open http://localhost:3000 in your browser"
print_info "  2. Register your first account (becomes admin)"
print_info "  3. Configure UniPile webhook: ${NGROK_URL}/app/unipile"
print_info "  4. Test WhatsApp messaging"
echo ""
print_warning "To stop all services, run: ./stopscript.sh"
print_warning "Or manually kill processes: pkill -f 'nodemon|react-scripts|ngrok'"

# Save PIDs for cleanup
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid
echo $NGROK_PID > .ngrok.pid

# Keep script running
print_info "Press Ctrl+C to stop all services..."
wait
