# Platform Extension Guide

## Overview

This guide explains how to extend the Unified Inbox to integrate with new messaging platforms like UniPile, Gmail, Microsoft Graph, and other communication services. The system is designed with a plugin architecture that makes adding new platforms straightforward.

## Architecture Overview

The platform extension system consists of several key components:

1. **Platform Service Base Class** - Common interface for all platforms
2. **Message Normalization Service** - Converts platform-specific data to unified format
3. **Configuration Management** - Handles platform-specific settings
4. **Webhook Handling** - Processes real-time updates from platforms
5. **Authentication Management** - Handles OAuth and API key authentication

## Adding a New Platform

### Step 1: Create Platform Service

Create a new service class that extends the base `PlatformService`:

```javascript
// backend/services/NewPlatformService.js
const PlatformService = require('./PlatformService');

class NewPlatformService extends PlatformService {
  constructor(config) {
    super('newplatform', config);
    this.apiUrl = config.apiUrl;
    this.accessToken = null;
  }

  async initialize(credentials) {
    try {
      this.accessToken = credentials.accessToken;
      
      // Verify connection
      const userInfo = await this.getUserInfo();
      this.log('initialized', { userId: userInfo.id });
      
      return true;
    } catch (error) {
      this.log('initialization_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async fetchMessages(options = {}) {
    try {
      const url = `${this.apiUrl}/messages`;
      const params = new URLSearchParams({
        limit: options.limit || 50,
        since: options.since,
        ...options,
      });

      const response = await this.makeRequest(`${url}?${params}`);
      return response.messages || [];
    } catch (error) {
      this.log('fetch_messages_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async sendMessage(message) {
    try {
      const url = `${this.apiUrl}/messages`;
      
      const payload = {
        to: message.recipient.id,
        content: message.content.text,
        type: 'text',
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      this.log('message_sent', { messageId: response.id });
      return response;
    } catch (error) {
      this.log('send_message_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async handleWebhook(webhookData) {
    try {
      // Verify webhook signature
      if (!this.validateWebhookSignature(webhookData.body, webhookData.signature)) {
        throw new Error('Invalid webhook signature');
      }

      const data = typeof webhookData.body === 'string' 
        ? JSON.parse(webhookData.body) 
        : webhookData.body;

      // Process webhook data
      const messages = this.processWebhookData(data);
      
      this.log('webhook_processed', { messageCount: messages.length });
      return messages;
    } catch (error) {
      this.log('webhook_handling_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async refreshToken() {
    // Implement token refresh logic if needed
    return {
      accessToken: this.accessToken,
      expiresIn: null,
    };
  }

  async isTokenValid() {
    try {
      await this.getUserInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getConnectionStatus() {
    try {
      const userInfo = await this.getUserInfo();
      return {
        connected: true,
        userId: userInfo.id,
        username: userInfo.username,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        lastChecked: new Date(),
      };
    }
  }

  async disconnect() {
    this.accessToken = null;
    this.log('disconnected');
    return true;
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  validateWebhookSignature(payload, signature) {
    // Implement webhook signature validation
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  // Platform-specific helper methods
  async getUserInfo() {
    const url = `${this.apiUrl}/user`;
    return await this.makeRequest(url);
  }

  processWebhookData(data) {
    // Convert webhook data to message format
    return data.events
      .filter(event => event.type === 'message')
      .map(event => ({
        id: event.message.id,
        from: event.message.from,
        content: event.message.content,
        timestamp: event.timestamp,
        // ... other fields
      }));
  }
}

module.exports = NewPlatformService;
```

### Step 2: Add Normalization Method

Add a normalization method to the `MessageNormalizationService`:

```javascript
// backend/services/MessageNormalizationService.js

normalizeNewPlatformMessage(newPlatformMessage, userId) {
  return {
    id: newPlatformMessage.id || `np_${Date.now()}`,
    platform: 'newplatform',
    sender: {
      name: newPlatformMessage.from?.name || 'Unknown',
      id: newPlatformMessage.from?.id,
      email: newPlatformMessage.from?.email,
    },
    recipient: {
      name: 'You',
      id: userId,
    },
    content: {
      text: newPlatformMessage.content || newPlatformMessage.text || 'No content',
      subject: newPlatformMessage.subject || null,
      html: newPlatformMessage.html || null,
    },
    timestamp: new Date(newPlatformMessage.timestamp || Date.now()),
    read: false,
    avatar: `https://via.placeholder.com/40/FF6B6B/FFFFFF?text=${(newPlatformMessage.from?.name || 'U').charAt(0).toUpperCase()}`,
    threadId: this.generateThreadId('newplatform', newPlatformMessage.from?.id, userId),
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      newplatform: {
        messageId: newPlatformMessage.id,
        threadId: newPlatformMessage.threadId,
        customField: newPlatformMessage.customField,
        // ... other platform-specific fields
      },
    },
    syncStatus: 'pending',
    userId: userId,
  };
}
```

### Step 3: Update Configuration

Add platform configuration to the config file:

```javascript
// backend/config/index.js

platforms: {
  // ... existing platforms
  newplatform: {
    apiUrl: process.env.NEWPLATFORM_API_URL || 'https://api.newplatform.com',
    clientId: process.env.NEWPLATFORM_CLIENT_ID,
    clientSecret: process.env.NEWPLATFORM_CLIENT_SECRET,
    redirectUri: process.env.NEWPLATFORM_REDIRECT_URI || 'http://localhost:5001/auth/newplatform/callback',
    scopes: ['messages:read', 'messages:write'],
    webhookSecret: process.env.NEWPLATFORM_WEBHOOK_SECRET,
  }
}
```

### Step 4: Add Database Schema Updates

Update the Message model to include the new platform:

```javascript
// backend/models/Message.js

platform: {
  type: String,
  required: true,
  enum: ['whatsapp', 'instagram', 'email', 'microsoft', 'newplatform'], // Add new platform
},

platformMetadata: {
  // ... existing platforms
  newplatform: {
    messageId: String,
    threadId: String,
    customField: String,
    // ... other platform-specific fields
  },
},
```

### Step 5: Add API Routes

Add platform-specific routes to the server:

```javascript
// backend/server.js

// Import the new service
const NewPlatformService = require('./services/NewPlatformService');

// Add to platform connection handler
app.post('/api/platforms/:platform/connect', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const credentials = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let platformService;
    switch (platform) {
      case 'whatsapp':
        platformService = new WhatsAppService(config.platforms.whatsapp);
        break;
      case 'newplatform': // Add new case
        platformService = new NewPlatformService(config.platforms.newplatform);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported platform' });
    }
    
    await platformService.initialize(credentials);
    await user.connectPlatform(platform, credentials);
    
    res.json({ message: `${platform} connected successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add webhook route
app.post('/api/webhooks/newplatform', async (req, res) => {
  try {
    const newPlatformService = new NewPlatformService(config.platforms.newplatform);
    const messages = await newPlatformService.handleWebhook({
      body: req.body,
      signature: req.headers['x-signature'],
    });
    
    // Process and save messages
    for (const rawMessage of messages) {
      const normalizedMessage = messageNormalizer.normalize(rawMessage, 'newplatform', 'default-user');
      const message = new Message(normalizedMessage);
      await message.save();
      
      // Emit real-time update
      io.emit('new_message', message);
    }
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('NewPlatform webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Step 6: Update Frontend

Add the new platform to the frontend tabs:

```javascript
// client/src/components/UnifiedInbox.js

const tabs = [
  { 
    key: 'all', 
    label: 'All Messages', 
    icon: <MessageOutlined />, 
    color: '#1890ff' 
  },
  { 
    key: 'whatsapp', 
    label: 'WhatsApp', 
    icon: <MessageOutlined />, 
    color: '#25D366' 
  },
  { 
    key: 'instagram', 
    label: 'Instagram', 
    icon: <InstagramOutlined />, 
    color: '#E4405F' 
  },
  { 
    key: 'email', 
    label: 'Email', 
    icon: <MailOutlined />, 
    color: '#4285F4' 
  },
  { 
    key: 'newplatform', 
    label: 'New Platform', 
    icon: <NewPlatformIcon />, 
    color: '#FF6B6B' 
  }
];
```

## Specific Platform Integrations

### Gmail Integration

Gmail uses OAuth 2.0 and the Gmail API:

```javascript
class GmailService extends PlatformService {
  constructor(config) {
    super('gmail', config);
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  async initialize(credentials) {
    this.oauth2Client.setCredentials(credentials);
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    // Test connection
    const profile = await this.gmail.users.getProfile({ userId: 'me' });
    this.log('initialized', { email: profile.data.emailAddress });
    
    return true;
  }

  async fetchMessages(options = {}) {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults: options.limit || 50,
      q: options.query || 'in:inbox',
    });

    const messages = await Promise.all(
      response.data.messages?.map(async (message) => {
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });
        return fullMessage.data;
      }) || []
    );

    return messages;
  }

  async sendMessage(message) {
    const raw = this.createRawEmail(message);
    const encoded = Buffer.from(raw).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
      },
    });

    return response.data;
  }

  createRawEmail(message) {
    const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
    
    let raw = `To: ${message.recipient.email}\r\n`;
    raw += `From: ${message.sender.email}\r\n`;
    raw += `Subject: ${message.content.subject}\r\n`;
    raw += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    
    raw += `--${boundary}\r\n`;
    raw += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
    raw += `${message.content.text}\r\n\r\n`;
    
    if (message.content.html) {
      raw += `--${boundary}\r\n`;
      raw += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      raw += `${message.content.html}\r\n\r\n`;
    }
    
    raw += `--${boundary}--\r\n`;
    
    return raw;
  }
}
```

### Microsoft Graph Integration

Microsoft Graph uses OAuth 2.0 and the Microsoft Graph API:

```javascript
class MicrosoftGraphService extends PlatformService {
  constructor(config) {
    super('microsoft', config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantId = config.tenantId;
  }

  async initialize(credentials) {
    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    
    // Test connection
    const user = await this.getUserProfile();
    this.log('initialized', { email: user.mail });
    
    return true;
  }

  async fetchMessages(options = {}) {
    const url = 'https://graph.microsoft.com/v1.0/me/messages';
    const params = new URLSearchParams({
      $top: options.limit || 50,
      $orderby: 'receivedDateTime desc',
      $select: 'id,subject,from,toRecipients,body,receivedDateTime,isRead',
    });

    const response = await this.makeRequest(`${url}?${params}`);
    return response.value || [];
  }

  async sendMessage(message) {
    const url = 'https://graph.microsoft.com/v1.0/me/sendMail';
    
    const payload = {
      message: {
        subject: message.content.subject,
        body: {
          contentType: 'Text',
          content: message.content.text,
        },
        toRecipients: [{
          emailAddress: {
            address: message.recipient.email,
            name: message.recipient.name,
          },
        }],
      },
    };

    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response;
  }

  async getUserProfile() {
    const url = 'https://graph.microsoft.com/v1.0/me';
    return await this.makeRequest(url);
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }
}
```

### UniPile Integration

UniPile is a unified API that aggregates multiple platforms:

```javascript
class UniPileService extends PlatformService {
  constructor(config) {
    super('unipile', config);
    this.apiUrl = config.apiUrl || 'https://api.unipile.com';
    this.apiKey = null;
  }

  async initialize(credentials) {
    this.apiKey = credentials.apiKey;
    
    // Test connection
    const account = await this.getAccountInfo();
    this.log('initialized', { accountId: account.id });
    
    return true;
  }

  async fetchMessages(options = {}) {
    const url = `${this.apiUrl}/messages`;
    const params = new URLSearchParams({
      limit: options.limit || 50,
      platform: options.platform,
      since: options.since,
    });

    const response = await this.makeRequest(`${url}?${params}`);
    return response.messages || [];
  }

  async sendMessage(message) {
    const url = `${this.apiUrl}/messages`;
    
    const payload = {
      platform: message.platform,
      to: message.recipient.id,
      content: message.content.text,
      subject: message.content.subject,
    };

    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response;
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
```

## OAuth 2.0 Integration

### Authorization Flow

Implement OAuth 2.0 authorization for platforms that require it:

```javascript
// OAuth routes
app.get('/auth/:platform', (req, res) => {
  const { platform } = req.params;
  const authUrl = getAuthUrl(platform);
  res.redirect(authUrl);
});

app.get('/auth/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code, state } = req.query;
  
  try {
    const tokens = await exchangeCodeForTokens(platform, code);
    
    // Store tokens securely
    await storeUserTokens(req.user.userId, platform, tokens);
    
    res.redirect('/dashboard?connected=' + platform);
  } catch (error) {
    res.redirect('/dashboard?error=' + encodeURIComponent(error.message));
  }
});

function getAuthUrl(platform) {
  const config = getPlatformConfig(platform);
  
  switch (platform) {
    case 'gmail':
      return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: config.scopes,
        state: generateState(),
      });
      
    case 'microsoft':
      return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${config.clientId}&` +
        `response_type=code&` +
        `redirect_uri=${config.redirectUri}&` +
        `scope=${config.scopes.join(' ')}&` +
        `state=${generateState()}`;
        
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

## Testing Platform Integrations

### Unit Tests

Test each platform service individually:

```javascript
describe('GmailService', () => {
  let gmailService;
  
  beforeEach(() => {
    gmailService = new GmailService(mockConfig);
  });
  
  it('should initialize with valid credentials', async () => {
    const credentials = { accessToken: 'valid_token' };
    const result = await gmailService.initialize(credentials);
    expect(result).toBe(true);
  });
  
  it('should fetch messages', async () => {
    const messages = await gmailService.fetchMessages({ limit: 10 });
    expect(Array.isArray(messages)).toBe(true);
  });
  
  it('should send message', async () => {
    const message = {
      recipient: { email: 'test@example.com' },
      content: { text: 'Test message', subject: 'Test' }
    };
    
    const result = await gmailService.sendMessage(message);
    expect(result.id).toBeDefined();
  });
});
```

### Integration Tests

Test the complete integration pipeline:

```javascript
describe('Platform Integration', () => {
  it('should normalize messages from all platforms', async () => {
    const platforms = ['gmail', 'microsoft', 'whatsapp'];
    
    for (const platform of platforms) {
      const service = getPlatformService(platform);
      const rawMessages = await service.fetchMessages();
      
      for (const rawMessage of rawMessages) {
        const normalized = messageNormalizer.normalize(rawMessage, platform, 'user123');
        expect(normalized.platform).toBe(platform);
        expect(normalized.sender).toBeDefined();
        expect(normalized.content).toBeDefined();
      }
    }
  });
});
```

## Deployment Considerations

### Environment Variables

Add platform-specific environment variables:

```bash
# Gmail
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=https://yourdomain.com/auth/gmail/callback

# Microsoft Graph
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_TENANT_ID=your_tenant_id
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# UniPile
UNIPILE_API_KEY=your_unipile_api_key
UNIPILE_API_URL=https://api.unipile.com
```

### Webhook Configuration

Configure webhooks for real-time updates:

```javascript
// Webhook verification
app.get('/api/webhooks/:platform', (req, res) => {
  const { platform } = req.params;
  const { challenge } = req.query;
  
  if (platform === 'whatsapp' && challenge) {
    res.send(challenge);
  } else {
    res.status(400).send('Invalid webhook verification');
  }
});
```

### Rate Limiting

Implement rate limiting for platform APIs:

```javascript
const rateLimit = require('express-rate-limit');

const platformRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/platforms', platformRateLimit);
```

## Monitoring and Analytics

### Platform Health Monitoring

Monitor platform connection health:

```javascript
// Health check endpoint
app.get('/api/platforms/:platform/health', async (req, res) => {
  const { platform } = req.params;
  const service = getPlatformService(platform);
  
  try {
    const status = await service.getConnectionStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Usage Analytics

Track platform usage:

```javascript
// Analytics middleware
const trackPlatformUsage = (req, res, next) => {
  const { platform } = req.params;
  
  // Log platform usage
  analytics.track('platform_usage', {
    platform,
    userId: req.user.userId,
    action: req.method + ' ' + req.path,
    timestamp: new Date(),
  });
  
  next();
};

app.use('/api/platforms/:platform', trackPlatformUsage);
```

This comprehensive guide provides everything needed to extend the Unified Inbox to new platforms while maintaining consistency, reliability, and scalability.
