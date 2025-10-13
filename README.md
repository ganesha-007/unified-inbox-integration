# Unified Messaging Platform

A comprehensive multi-channel messaging platform that integrates WhatsApp, Instagram, and Email into a single unified inbox. Built with React.js, Node.js, Express, and PostgreSQL.

## 🚀 Features

### Multi-Channel Messaging
- **WhatsApp Business API** integration via UniPile
- **Instagram Direct Messages** via UniPile
- **Email** (Gmail & Microsoft Outlook) via OAuth 2.0
- Unified inbox interface for all channels

### Advanced Features
- **Real-time messaging** with Socket.io
- **Entitlement system** with bundled/addon pricing modes
- **Email safety limits** with send meter and rate limiting
- **OAuth 2.0** authentication for email providers
- **Webhook handling** for real-time updates
- **Usage tracking** and analytics
- **Admin console** for configuration

### Security & Compliance
- JWT-based authentication
- Webhook signature verification
- Email deliverability protection
- Rate limiting and cooldown mechanisms
- Secure token storage and refresh

## 🏗️ Architecture

### Backend Stack
- **Node.js** with Express.js
- **PostgreSQL** with Sequelize ORM
- **Redis** for caching and rate limiting
- **Socket.io** for real-time communication
- **Stripe** for billing and subscriptions

### Frontend Stack
- **React.js** with TypeScript
- **Ant Design** for UI components
- **React Router** for navigation
- **SWR** for data fetching
- **Socket.io Client** for real-time updates

### External Integrations
- **UniPile API** for WhatsApp and Instagram
- **Gmail API** for Gmail integration
- **Microsoft Graph API** for Outlook integration
- **Stripe API** for billing

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+
- Redis 6+
- UniPile API account
- Google Cloud Console project (for Gmail API)
- Microsoft Azure app registration (for Outlook API)
- Stripe account

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd unified-messaging-platform
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Frontend Setup
```bash
cd ../client
npm install
```

### 4. Database Setup
```bash
# Create PostgreSQL database
createdb unified_inbox

# Run migrations (if available)
cd backend
npm run migrate
```

### 5. Environment Configuration
```bash
# Copy environment template
cd backend
cp config.example.env .env

# Edit .env with your configuration
nano .env
```

## ⚙️ Configuration

### Environment Variables

#### Server Configuration
```env
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

#### Database Configuration
```env
DATABASE_URL=postgresql://localhost:5432/unified_inbox
REDIS_URL=redis://localhost:6379
```

#### JWT Configuration
```env
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
```

#### Pricing Mode
```env
PRICING_MODE=bundled  # 'bundled' or 'addons'
```

#### Platform APIs
```env
# UniPile API
UNIPILE_API_KEY=your-unipile-api-key
UNIPILE_BASE_URL=https://api.unipile.com
UNIPILE_WEBHOOK_SECRET=your-unipile-webhook-secret

# Gmail API
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=http://localhost:5001/api/auth/gmail/callback

# Microsoft Graph API
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:5001/api/auth/microsoft/callback

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
```

#### Email Safety Limits
```env
EMAIL_MAX_RECIPIENTS_PER_MESSAGE=10
EMAIL_MAX_PER_HOUR=50
EMAIL_MAX_PER_DAY=200
EMAIL_PER_RECIPIENT_COOLDOWN_SEC=120
EMAIL_PER_DOMAIN_COOLDOWN_SEC=60
EMAIL_MAX_ATTACHMENT_BYTES=10485760
EMAIL_TRIAL_DAILY_CAP=20
```

## 🚀 Running the Application

### Development Mode

#### Start Backend
```bash
cd backend
npm run dev
```

#### Start Frontend
```bash
cd client
npm start
```

### Production Mode

#### Build Frontend
```bash
cd client
npm run build
```

#### Start Backend
```bash
cd backend
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/auth/entitlements` - Get user entitlements

### Channels
- `GET /api/channels/:provider/accounts` - List connected accounts
- `POST /api/channels/:provider/connect` - Connect new account
- `DELETE /api/channels/:provider/:accountId/disconnect` - Disconnect account
- `GET /api/channels/:provider/:accountId/chats` - List chats
- `GET /api/channels/:provider/:accountId/chats/:chatId/messages` - Get messages
- `POST /api/channels/:provider/:accountId/chats/:chatId/send` - Send message
- `POST /api/channels/:provider/:accountId/mark-read` - Mark messages as read

### Webhooks
- `POST /api/webhooks/unipile` - UniPile webhook events
- `POST /api/webhooks/email` - Email webhook events
- `POST /api/webhooks/stripe` - Stripe webhook events

### OAuth Callbacks
- `GET /api/auth/gmail/callback` - Gmail OAuth callback
- `GET /api/auth/microsoft/callback` - Microsoft OAuth callback

## 🔧 Database Schema

### Core Tables
- `users` - User accounts and preferences
- `channels_account` - Connected provider accounts
- `channels_chat` - Chat/conversation threads
- `channels_message` - Individual messages
- `channels_entitlement` - User access permissions
- `channels_usage` - Usage tracking and limits

## 🎯 Usage Examples

### Connecting WhatsApp Account
```javascript
// Frontend
const response = await axios.post('/api/channels/whatsapp/connect', {
  credentials: {
    // UniPile connection data
  }
});
```

### Sending Email
```javascript
// Frontend
const response = await axios.post('/api/channels/email/accountId/chats/chatId/send', {
  to: 'recipient@example.com',
  subject: 'Hello World',
  body: 'This is a test email',
  cc: 'cc@example.com',
  bcc: 'bcc@example.com'
});
```

### Real-time Message Updates
```javascript
// Frontend Socket.io
socket.on('new_message', (message) => {
  // Handle incoming message
  console.log('New message:', message);
});
```

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Entitlement-based feature access

### Data Protection
- Encrypted password storage (bcrypt)
- Secure token refresh mechanisms
- Webhook signature verification

### Rate Limiting
- API rate limiting
- Email send limits
- Per-recipient cooldowns
- Domain-based pacing

## 📊 Monitoring & Analytics

### Usage Tracking
- Message counts per provider
- Monthly usage statistics
- User activity monitoring

### Email Deliverability
- Send rate monitoring
- Bounce and complaint tracking
- Domain reputation protection

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd client
npm test
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Environment Setup
1. Set up PostgreSQL and Redis instances
2. Configure environment variables
3. Set up SSL certificates
4. Configure webhook endpoints
5. Set up monitoring and logging

## 📝 API Documentation

### Postman Collection
Import the provided Postman collection for API testing:
- `postman/Unified-Messaging-API.postman_collection.json`

### Webhook Testing
Use ngrok or similar tools for local webhook testing:
```bash
ngrok http 5001
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API examples

## 🔄 Changelog

### Version 1.0.0
- Initial release
- WhatsApp, Instagram, and Email integration
- Unified inbox interface
- Real-time messaging
- Entitlement system
- Email safety limits
- Admin console

## 🎯 Roadmap

### Upcoming Features
- Telegram integration
- Facebook Messenger support
- AI-powered message suggestions
- Advanced analytics dashboard
- Team collaboration features
- Mobile app support

---

**Built with ❤️ for seamless multi-channel messaging**