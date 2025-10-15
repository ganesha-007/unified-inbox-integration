#!/bin/bash

echo "🚀 Setting up Unified Inbox..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../client
npm install

echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f "../backend/.env" ]; then
    echo "📝 Creating .env file..."
    cat > ../backend/.env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=unified_inbox
DB_USER=inbox_user
DB_PASSWORD=password123

# Server Configuration
PORT=5001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# UniPile Configuration
UNIPILE_API_KEY=your_unipile_api_key
UNIPILE_WEBHOOK_SECRET=your_webhook_secret

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
EOF
    echo "✅ .env file created. Please update with your actual values."
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Create PostgreSQL database:"
echo "   psql -U postgres"
echo "   CREATE DATABASE unified_inbox;"
echo "   CREATE USER inbox_user WITH PASSWORD 'password123';"
echo "   GRANT ALL PRIVILEGES ON DATABASE unified_inbox TO inbox_user;"
echo "   \\q"
echo ""
echo "2. Update backend/.env with your actual values"
echo ""
echo "3. Start the application:"
echo "   Terminal 1: cd backend && npm start"
echo "   Terminal 2: cd client && npm start"
echo "   Terminal 3: ngrok http 5001"
echo ""
echo "4. Configure UniPile webhook with ngrok URL"
echo ""
echo "5. Open http://localhost:3000/inbox"