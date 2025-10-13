# WhatsApp Messaging Application - Client Setup Guide

## ⚡ **Quick Start (TL;DR)**
```bash
git clone <your-repository-url>
cd upwork
./setup.sh
# Edit backend/.env with your UniPile credentials
cd backend && node server.js
# In another terminal: cd client && npm start
# Open http://localhost:3001
```

## 📋 **Prerequisites**

Before setting up the application, ensure you have the following installed on your machine:

### **Required Software:**
1. **Node.js** (version 16 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Git** (for cloning the repository)
   - Download from: https://git-scm.com/

4. **PostgreSQL** (for database)
   - Download from: https://www.postgresql.org/download/
   - Or use Docker: `docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`

5. **Redis** (for caching - optional for basic setup)
   - Download from: https://redis.io/download
   - Or use Docker: `docker run --name redis -p 6379:6379 -d redis`

---

## 🚀 **Installation Steps**

### **Option A: Quick Setup (Recommended)**
```bash
git clone <your-repository-url>
cd upwork
./setup.sh
```
The automated setup script will handle everything for you!

### **Option B: Manual Setup**

### **Step 1: Clone the Repository**
```bash
git clone <your-repository-url>
cd upwork
```

### **Step 2: Backend Setup**

#### **2.1 Navigate to Backend Directory**
```bash
cd backend
```

#### **2.2 Install Backend Dependencies**
```bash
npm install
```

#### **2.3 Environment Configuration**
Create a `.env` file in the `backend` directory:
```bash
cp config.example.env .env
```

#### **2.4 Configure Environment Variables**
Edit the `.env` file with your actual values:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=unified_inbox
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# UniPile API Configuration
UNIPILE_API_KEY=your_unipile_api_key
UNIPILE_BASE_URL=https://api15.unipile.com:14581
UNIPILE_DSN=api15.unipile.com:14581
WHATSAPP_ACCOUNT_NUMBER=your_whatsapp_number
WHATSAPP_ACCOUNT_TOKEN=your_whatsapp_token

# Server Configuration
PORT=5001
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:3001
```

### **Step 3: Database Setup**

#### **3.1 Create Database**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE unified_inbox;

# Exit psql
\q
```

#### **3.2 Run Database Migrations**
```bash
cd backend
node -e "
const { syncDatabase } = require('./config/database');
syncDatabase().then(() => {
  console.log('Database synced successfully');
  process.exit(0);
}).catch(err => {
  console.error('Database sync failed:', err);
  process.exit(1);
});
"
```

### **Step 4: Frontend Setup**

#### **4.1 Navigate to Frontend Directory**
```bash
cd ../client
```

#### **4.2 Install Frontend Dependencies**
```bash
npm install
```

---

## 🏃‍♂️ **Running the Application**

### **Step 1: Start Backend Server**
```bash
# In terminal 1
cd backend
node server.js
```

**Expected Output:**
```
🚀 Server running on port 5001
🌐 Health check: http://localhost:5001/health
📨 Webhook endpoint: http://localhost:5001/api/webhooks/unipile
🔌 Socket.io ready for real-time connections
✅ Ready to receive WhatsApp messages!
```

### **Step 2: Start Frontend Application**
```bash
# In terminal 2
cd client
npm start
```

**Expected Output:**
```
Compiled successfully!

You can now view the app in the browser.

  Local:            http://localhost:3001
  On Your Network:  http://192.168.x.x:3001
```

### **Step 3: Access the Application**
Open your browser and navigate to: **http://localhost:3001**

**🎉 You should see the WhatsApp-like interface with:**
- Left sidebar with chat list
- Right panel for conversations
- Dark theme matching WhatsApp
- Real-time messaging capabilities

---

## 🌐 **Webhook Configuration (For Production)**

### **Step 1: Install ngrok**
```bash
# Download from: https://ngrok.com/download
# Or install via npm
npm install -g ngrok
```

### **Step 2: Start ngrok**
```bash
# In terminal 3
ngrok http 5001
```

### **Step 3: Configure UniPile Webhook**
1. Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`)
2. Go to your UniPile dashboard
3. Set webhook URL to: `https://abc123.ngrok-free.app/api/webhooks/unipile`
4. Enable events: `message_received`

---

## 🔧 **Configuration Details**

### **UniPile API Setup**
1. **Sign up** at UniPile: https://unipile.com/
2. **Get API Key** from your dashboard
3. **Connect WhatsApp** account
4. **Get Account Token** for your WhatsApp number
5. **Configure Webhook** URL

### **WhatsApp Business Account**
- You need a **WhatsApp Business Account**
- **Phone number** must be verified
- **Business verification** may be required

---

## 🧪 **Testing the Application**

### **Test 1: Health Check**
```bash
curl http://localhost:5001/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### **Test 2: Send Test Message**
```bash
curl -X POST http://localhost:5001/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient_phone_number",
    "message": "Hello from the app!"
  }'
```

### **Test 3: Webhook Test**
```bash
curl -X POST https://your-ngrok-url.ngrok-free.app/api/webhooks/unipile \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message_received",
    "message": "Test message",
    "sender": {
      "attendee_provider_id": "sender_phone",
      "attendee_name": "Test User"
    },
    "message_id": "test_123"
  }'
```

---

## 🐛 **Troubleshooting**

### **Common Issues:**

#### **1. Port Already in Use**
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

#### **2. Database Connection Error**
- Check PostgreSQL is running: `brew services start postgresql`
- Verify database credentials in `.env`
- Ensure database exists: `psql -U postgres -c "CREATE DATABASE unified_inbox;"`

#### **3. UniPile API Errors**
- Verify API key is correct
- Check WhatsApp account is connected
- Ensure webhook URL is accessible

#### **4. Frontend Not Loading**
- Check if backend is running on port 5001
- Verify Socket.io connection in browser console
- Clear browser cache and localStorage

#### **5. Messages Not Appearing**
- Check browser console for errors
- Verify Socket.io connection status
- Test webhook endpoint manually

---

## 📱 **Using the Application**

### **Features:**
1. **View Conversations**: Left sidebar shows all chat conversations
2. **Send Messages**: Type in the input field and press Enter or click Send
3. **Reply to Messages**: Click "Reply" button on incoming messages
4. **Real-time Updates**: Messages appear instantly without refresh
5. **Message Persistence**: Messages are saved and persist across sessions

### **Interface:**
- **Left Panel**: Chat list with contact names and last messages
- **Right Panel**: Selected conversation with message history
- **Input Area**: Type and send messages
- **Dark Theme**: WhatsApp-like appearance

---

## 🔒 **Security Considerations**

### **Environment Variables:**
- Never commit `.env` files to version control
- Use strong passwords for database
- Keep API keys secure

### **Production Deployment:**
- Use HTTPS for webhooks
- Implement proper authentication
- Set up proper CORS policies
- Use environment-specific configurations

---

## 📞 **Support**

If you encounter any issues:

1. **Check the console logs** for error messages
2. **Verify all prerequisites** are installed
3. **Test each component** individually
4. **Check network connectivity** for API calls
5. **Review configuration** in `.env` file

### **Useful Commands:**
```bash
# Check if ports are in use
netstat -an | grep :5001
netstat -an | grep :3001

# Check Node.js processes
ps aux | grep node

# View logs
tail -f backend/logs/app.log
```

---

## 🎯 **Next Steps**

Once the application is running:

1. **Test with real WhatsApp messages**
2. **Configure production webhook**
3. **Set up monitoring and logging**
4. **Implement user authentication** (if needed)
5. **Add more messaging features** (file uploads, etc.)

---

**🎉 Congratulations! Your WhatsApp messaging application is now ready to use!**
