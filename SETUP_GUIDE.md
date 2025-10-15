# Unified Inbox Application - Complete Setup Guide

## Overview
This is a unified messaging application that integrates WhatsApp, Instagram, and Email through UniPile API. It provides a single interface to manage all your messaging channels.

## Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- Redis (optional, for caching)
- ngrok account (for webhooks)
- UniPile account with WhatsApp integration

## 1. UniPile Setup

### 1.1 Create UniPile Account
1. Go to [https://dashboard.unipile.com](https://dashboard.unipile.com)
2. Sign up for a free account
3. Complete email verification

### 1.2 Connect WhatsApp Account
1. In UniPile dashboard, go to **Accounts** section
2. Click **"Connect an account"**
3. Select **WhatsApp**
4. Follow the QR code scanning process to connect your WhatsApp
5. Note down your **Account Token** (e.g., `T5GMMpVSS72Nh975S0wPPg`)
6. Note down your **WhatsApp Number** (e.g., `919566651479`)

### 1.3 Get API Credentials
1. Go to **Access Tokens** section in UniPile dashboard
2. Generate a new token with **Messaging** and **Accounts** permissions
3. Copy the **API Key** (e.g., `2xZnNep3.D0NyXTffwqO84EAl67hn/YuCPtBtCqKFDmWGrVQF1eI=`)
4. Note your **DSN** from the sidebar (e.g., `api15.unipile.com:14581`)

### 1.4 Setup Webhook
1. Go to **Webhooks** section
2. Click **"Create a webhook"**
3. Set **Trigger**: "On new message"
4. Set **URL**: `https://YOUR_NGROK_URL/app/unipile` (you'll get this after setting up ngrok)
5. Save the webhook

**Note:** The webhook endpoint `/app/unipile` has been added for compatibility with UniPile's default configuration.

## 2. Database Setup

### 2.1 Install PostgreSQL
```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### 2.2 Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE unified_inbox;
CREATE USER unified_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE unified_inbox TO unified_user;
\q
```

## 3. Application Setup

### 3.1 Clone and Install Dependencies
```bash
# Clone the repository
git clone <your-repository-url>
cd unified-inbox

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3.2 Environment Configuration

Create `backend/.env` file with the following content:

```env
# Server Configuration
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
DATABASE_URL=postgresql://unified_user:your_password@localhost:5432/unified_inbox
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Pricing Mode Configuration
PRICING_MODE=bundled

# UniPile API Configuration
UNIPILE_API_KEY=2xZnNep3.D0NyXTffwqO84EAl67hn/YuCPtBtCqKFDmWGrVQF1eI=
UNIPILE_BASE_URL=https://api15.unipile.com:14581
UNIPILE_DSN=api15.unipile.com:14581
UNIPILE_WEBHOOK_SECRET=your-unipile-webhook-secret

# WhatsApp Account Information
WHATSAPP_ACCOUNT_NUMBER=919566651479
WHATSAPP_ACCOUNT_TOKEN=T5GMMpVSS72Nh975S0wPPg

# Chat Filtering (Optional)
HIDE_OWN_CHATS=true  # Set to 'false' to show chats with your own phone number

# Gmail API (Optional)
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=http://localhost:5001/api/auth/gmail/callback
GMAIL_WEBHOOK_SECRET=your-gmail-webhook-secret

# Microsoft Graph API (Optional)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:5001/api/auth/microsoft/callback
MICROSOFT_WEBHOOK_SECRET=your-microsoft-webhook-secret

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret

# Email Safety Limits
EMAIL_MAX_RECIPIENTS_PER_MESSAGE=10
EMAIL_MAX_PER_HOUR=50
EMAIL_MAX_PER_DAY=200
EMAIL_PER_RECIPIENT_COOLDOWN_SEC=120
EMAIL_PER_DOMAIN_COOLDOWN_SEC=60
EMAIL_MAX_ATTACHMENT_BYTES=10485760
EMAIL_TRIAL_DAILY_CAP=20

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

**⚠️ Important:** Replace the following values with your actual UniPile credentials:
- `UNIPILE_API_KEY`
- `WHATSAPP_ACCOUNT_NUMBER`
- `WHATSAPP_ACCOUNT_TOKEN`
- `UNIPILE_DSN` and `UNIPILE_BASE_URL`

### 3.3 Database Migration
```bash
cd backend
npm run migrate
```

## 4. Running the Application

### 4.1 Start Backend
```bash
cd backend
npm run dev
```
The backend will start on `http://localhost:5001`

### 4.2 Start Frontend
```bash
cd client
npm start
```
The frontend will start on `http://localhost:3000`

### 4.3 Setup ngrok (for webhooks)
```bash
# Install ngrok
# Download from https://ngrok.com/download

# Start ngrok tunnel
ngrok http 5001
```

**Important:** Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`) and update your UniPile webhook URL to `https://abc123.ngrok-free.app/app/unipile`

## 5. Initial Setup

### 5.1 Create Admin User
1. Open `http://localhost:3000`
2. Register a new account (first user becomes admin)
3. Login with your credentials

### 5.2 Grant WhatsApp Access
1. Login to the application
2. The system should automatically detect your WhatsApp entitlement
3. If not, you may need to manually grant access through the admin panel

### 5.3 Test the Integration
1. Send a test message to your WhatsApp number from another device
2. Check if the message appears in the chat interface
3. Try sending a reply from the web interface

## 6. Troubleshooting

### 6.1 Common Issues

**Backend won't start:**
- Check if PostgreSQL is running
- Verify database credentials in `.env`
- Ensure port 5001 is not in use

**Frontend won't start:**
- Check if Node.js version is 18+
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and reinstall

**Webhooks not working:**
- Ensure ngrok is running and URL is updated in UniPile
- Check backend logs for webhook errors
- Verify webhook secret matches

**No messages appearing:**
- Check UniPile dashboard for account status
- Verify webhook is configured correctly
- Check browser console for API errors

### 6.2 Logs and Debugging
- Backend logs: Check terminal where backend is running
- Frontend logs: Open browser Developer Tools (F12)
- Database logs: Check PostgreSQL logs

### 6.3 Clear Cache (if duplicate chats appear)
1. In the chat interface, click the red trash icon (🗑️) next to the refresh button
2. This will clear cached data and fetch fresh data from the backend

## 7. Production Deployment

### 7.1 Environment Variables
Update `.env` for production:
- Change `NODE_ENV=production`
- Use production database URL
- Use production JWT secret
- Configure production webhook URLs

### 7.2 Security Considerations
- Use strong passwords for database
- Enable HTTPS in production
- Configure proper CORS origins
- Set up proper logging and monitoring

## 8. Features

### 8.1 Current Features
- ✅ WhatsApp integration via UniPile
- ✅ Real-time message sync
- ✅ Unified chat interface
- ✅ Message history
- ✅ Send/receive messages
- ✅ Chat management

### 8.2 Planned Features
- 🔄 Instagram integration
- 🔄 Email integration (Gmail, Outlook)
- 🔄 File attachments
- 🔄 Message search
- 🔄 User management
- 🔄 Analytics dashboard

## 9. Support

If you encounter any issues:
1. Check this setup guide first
2. Review the troubleshooting section
3. Check application logs
4. Contact support with specific error messages

## 10. API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Channels
- `GET /api/channels/:provider/accounts` - Get connected accounts
- `GET /api/channels/:provider/:accountId/chats` - Get chats
- `GET /api/channels/:provider/:accountId/chats/:chatId/messages` - Get messages
- `POST /api/channels/:provider/:accountId/chats/:chatId/send` - Send message

### Webhooks
- `POST /app/unipile` - UniPile webhook endpoint

---

**Note:** This application is designed for development and testing purposes. For production use, additional security measures and optimizations are recommended.