# WhatsApp Messaging Application

A real-time WhatsApp messaging application that allows you to send and receive WhatsApp messages through a web interface.

## 🚀 Quick Start

### Option 1: Automated Setup
```bash
./setup.sh
```

### Option 2: Manual Setup
1. **Install Prerequisites**: Node.js, PostgreSQL
2. **Install Dependencies**: 
   ```bash
   cd backend && npm install
   cd ../client && npm install
   ```
3. **Configure Environment**: Copy `backend/config.example.env` to `backend/.env` and update values
4. **Start Backend**: `cd backend && node server-working.js`
5. **Start Frontend**: `cd client && npm start`
6. **Access Application**: http://localhost:3001

## 📖 Detailed Documentation

For complete setup instructions, see **[CLIENT_SETUP_GUIDE.md](./CLIENT_SETUP_GUIDE.md)**

## 🎯 Features

- ✅ **Real-time WhatsApp messaging**
- ✅ **WhatsApp-like interface**
- ✅ **Multiple conversation management**
- ✅ **Message persistence**
- ✅ **Reply functionality**
- ✅ **Dark theme**

## 🏗️ Architecture

- **Frontend**: React.js + Redux (Port 3001)
- **Backend**: Node.js + Express (Port 5001)
- **Database**: PostgreSQL
- **Real-time**: Socket.io
- **WhatsApp API**: UniPile

## 🔧 Configuration

### Required Environment Variables:
```env
UNIPILE_API_KEY=your_api_key
WHATSAPP_ACCOUNT_NUMBER=your_phone_number
WHATSAPP_ACCOUNT_TOKEN=your_account_token
DB_HOST=localhost
DB_NAME=unified_inbox
```

## 📱 How It Works

1. **Incoming Messages**: WhatsApp → UniPile → Your Backend → Frontend
2. **Outgoing Messages**: Frontend → Backend → UniPile → WhatsApp
3. **Real-time Updates**: Socket.io for instant message delivery

## 🛠️ Development

### Backend
```bash
cd backend
npm install
node server-working.js
```

### Frontend
```bash
cd client
npm install
npm start
```

## 🌐 Production Deployment

1. Set up proper webhook URLs
2. Configure HTTPS
3. Set up database backups
4. Implement authentication
5. Configure monitoring

## 📞 Support

For issues or questions:
1. Check the console logs
2. Verify all prerequisites are installed
3. Review the detailed setup guide
4. Test each component individually

---

**Built with ❤️ for seamless WhatsApp messaging**