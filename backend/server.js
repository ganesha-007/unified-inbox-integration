const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const config = require('./config');
const { testConnection, syncDatabase } = require('./config/database');

// Import controllers
const ChannelsController = require('./controllers/ChannelsController');
const WebhooksController = require('./controllers/WebhooksController');

// Import services
const EntitlementService = require('./services/EntitlementService');

// Import models
const { User, ChannelAccount, ChannelChat, ChannelMessage, ChannelEntitlement, ChannelUsage } = require('./models');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: config.socket.cors,
});

const PORT = config.port;

// Initialize controllers
const channelsController = new ChannelsController();
const webhooksController = new WebhooksController(io);
const entitlementService = new EntitlementService();

// Test database connection
testConnection();

// Middleware
app.use(helmet());
app.use(cors(config.cors));

// Trust proxy for ngrok and other reverse proxies
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  trustProxy: true, // Trust the proxy for IP detection
});
app.use('/api/', limiter);

// File upload configuration
const upload = multer({
  dest: config.upload.uploadPath,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Socket.io authentication middleware - simplified for testing
io.use((socket, next) => {
  // Always allow connections for testing
  socket.userId = '2685891d-cdca-4645-bb87-7bd61541ab06'; // Default user ID
  console.log(`🔌 Socket.io authentication: User ${socket.userId} connecting`);
  next();
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Socket.io connection established for user: ${socket.userId}`);
  console.log(`🔌 Socket ID: ${socket.id}`);
  console.log(`🔌 Socket rooms: ${Array.from(socket.rooms)}`);
  
  // Join user-specific room
  socket.join(`user_${socket.userId}`);
  console.log(`🔌 User ${socket.userId} joined room: user_${socket.userId}`);
  
  // Handle message sending
  socket.on('send_message', async (data) => {
    try {
      console.log('Received message from socket:', data);
      const { platform, content, threadId, recipient } = data;
      
      // Create normalized message
      const messageData = {
        id: Date.now().toString(),
        platform,
        sender: {
          name: 'You',
          id: socket.userId,
        },
        recipient,
        content,
        timestamp: new Date(),
        read: false,
        threadId: threadId || `thread_${Date.now()}`,
        parentMessageId: threadId ? threadId : null,
        isReply: !!threadId,
        replyCount: 0,
        userId: socket.userId,
      };

      // Save to database
      const message = new ChannelMessage(messageData);
      await message.save();
      console.log('Message saved successfully:', message.id);

      // Emit to user's room
      socket.to(`user_${socket.userId}`).emit('new_message', message);
      socket.emit('message_sent', message);

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
      console.error('Socket message error:', error);
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(`user_${socket.userId}`).emit('user_typing', {
      userId: socket.userId,
      threadId: data.threadId,
      isTyping: true,
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(`user_${socket.userId}`).emit('user_typing', {
      userId: socket.userId,
      threadId: data.threadId,
      isTyping: false,
    });
  });

  // Handle message read status
  socket.on('mark_read', async (data) => {
    try {
      const { messageId } = data;
      await ChannelMessage.findByIdAndUpdate(messageId, { 
        read: true, 
        readAt: new Date() 
      });
      
      socket.emit('message_read', { messageId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to mark message as read' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [{ email }, { username }] 
      }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
    
    // Update last login
    await user.updateLastLogin();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user entitlements
app.get('/api/auth/entitlements', authenticateToken, async (req, res) => {
  try {
    const entitlements = await entitlementService.getUserEntitlements(req.user.userId);
    res.json(entitlements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Channel routes
app.get('/api/channels/:provider/accounts', authenticateToken, (req, res) => {
  channelsController.getAccounts(req, res);
});

app.post('/api/channels/:provider/connect', authenticateToken, (req, res) => {
  channelsController.connectAccount(req, res);
});

app.delete('/api/channels/:provider/:accountId/disconnect', authenticateToken, (req, res) => {
  channelsController.disconnectAccount(req, res);
});

app.get('/api/channels/:provider/:accountId/chats', authenticateToken, (req, res) => {
  channelsController.getChats(req, res);
});

app.post('/api/channels/:provider/:accountId/chats/sync', authenticateToken, (req, res) => {
  channelsController.syncChatsFromProvider(req, res);
});

app.get('/api/channels/:provider/:accountId/chats/:chatId/messages', authenticateToken, (req, res) => {
  channelsController.getMessages(req, res);
});

app.post('/api/channels/:provider/:accountId/chats/:chatId/send', authenticateToken, upload.array('attachments'), (req, res) => {
  channelsController.sendMessage(req, res);
});

app.post('/api/channels/:provider/:accountId/mark-read', authenticateToken, (req, res) => {
  channelsController.markAsRead(req, res);
});

// Email limits endpoint
app.get('/api/channels/email/:accountId/limits', authenticateToken, (req, res) => {
  channelsController.getEmailLimits(req, res);
});

// Webhook routes
app.post('/api/webhooks/unipile', (req, res) => {
  webhooksController.handleUniPileWebhook(req, res);
});

// UniPile webhook endpoint (for compatibility with UniPile dashboard configuration)
app.post('/app/unipile', (req, res) => {
  webhooksController.handleUniPileWebhook(req, res);
});

app.post('/api/webhooks/email', (req, res) => {
  webhooksController.handleEmailWebhook(req, res);
});

app.post('/api/webhooks/stripe', (req, res) => {
  webhooksController.handleStripeWebhook(req, res);
});

// OAuth callback routes
app.get('/api/auth/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for tokens
    const EmailService = require('./services/EmailService');
    const emailService = new EmailService();
    const tokens = await emailService.exchangeGmailCode(code);

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?provider=gmail&success=true`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?provider=gmail&success=false&error=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUrl);
  }
});

app.get('/api/auth/microsoft/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for tokens
    const EmailService = require('./services/EmailService');
    const emailService = new EmailService();
    const tokens = await emailService.exchangeMicrosoftCode(code);

    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?provider=microsoft&success=true`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?provider=microsoft&success=false&error=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUrl);
  }
});

// Admin routes
app.get('/api/admin/pricing-config', authenticateToken, (req, res) => {
  try {
    const config = entitlementService.getPricingConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Socket.io endpoint
app.get('/api/test-socket', (req, res) => {
  console.log('🧪 Testing Socket.io...');
  console.log('📡 Connected sockets:', io.sockets.sockets.size);
  console.log('📡 Rooms:', Array.from(io.sockets.adapter.rooms.keys()));

  // Emit test message to all connected sockets
  io.emit('test_message', {
    message: 'Test from backend!',
    timestamp: new Date().toISOString()
  });

  res.json({
    connectedSockets: io.sockets.sockets.size,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
    message: 'Test message sent to all sockets'
  });
});

// Messages API endpoints
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await ChannelMessage.findAll({
      include: [{
        model: ChannelChat,
        as: 'chat',
        include: [{
          model: ChannelAccount,
          as: 'account',
          where: { user_id: '2685891d-cdca-4645-bb87-7bd61541ab06' } // Default user for testing
        }]
      }],
      order: [['sent_at', 'DESC']],
      limit: 100
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const messageData = req.body;
    
    // For frontend messages, we need to find or create a chat first
    if (!messageData.chat_id) {
      // Find the WhatsApp account
      const account = await ChannelAccount.findOne({
        where: { 
          user_id: '2685891d-cdca-4645-bb87-7bd61541ab06',
          provider: 'whatsapp'
        }
      });
      
      if (!account) {
        return res.status(404).json({ error: 'WhatsApp account not found' });
      }
      
      // Extract phone number from recipient
      const phoneNumber = messageData.to ? messageData.to.replace(/^whatsapp:/, '').replace(/^\+/, '').replace(/\D/g, '') : 'frontend_chat';
      
      // Skip creating chat if it's with own phone number
      const ownPhoneNumber = process.env.WHATSAPP_ACCOUNT_NUMBER || '919566651479';
      if (phoneNumber === ownPhoneNumber) {
        console.log(`Skipping chat creation for own phone number: ${phoneNumber}`);
        return res.json({
          success: true,
          message: 'Message processed (own chat not created)'
        });
      }
      
      const uniqueChatId = `${phoneNumber}_whatsapp`;
      
      // Find or create chat
      const [chat] = await ChannelChat.findOrCreate({
        where: {
          account_id: account.id,
          provider_chat_id: uniqueChatId
        },
        defaults: {
          account_id: account.id,
          provider_chat_id: uniqueChatId,
          title: messageData.fromName || `Chat ${phoneNumber}`,
          last_message_at: new Date(),
          chat_info: {
            original_chat_id: messageData.to || 'frontend_chat',
            phone_number: phoneNumber,
            to: messageData.to,
          },
          unread_count: 0,
          status: 'active'
        }
      });
      
      messageData.chat_id = chat.id;
    }
    
    // Ensure required fields are present
    const fullMessageData = {
      chat_id: messageData.chat_id,
      provider_msg_id: messageData.provider_msg_id || `frontend_${Date.now()}`,
      direction: messageData.direction || 'out',
      body: messageData.body || messageData.text || '',
      subject: messageData.subject || null,
      attachments: messageData.attachments || [],
      sent_at: messageData.sent_at || new Date(),
      status: messageData.status || 'sent',
      provider_metadata: messageData.provider_metadata || {},
      is_reply: messageData.is_reply || false,
      sync_status: 'pending',
      sync_attempts: 0
    };
    
    const message = await ChannelMessage.create(fullMessageData);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

app.put('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const message = await ChannelMessage.findByPk(id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await message.update(updates);
    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const message = await ChannelMessage.findByPk(id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await message.destroy();
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.post('/api/messages/sync', async (req, res) => {
  try {
    const { messages } = req.body;
    // For now, just return the messages as-is
    res.json({ messages, synced: true });
  } catch (error) {
    console.error('Error syncing messages:', error);
    res.status(500).json({ error: 'Failed to sync messages' });
  }
});

// Clear invalid messages endpoint
app.post('/api/messages/clear-invalid', async (req, res) => {
  try {
    const { ChannelMessage, ChannelChat } = require('./models');
    
    // Find and delete messages with invalid timestamps
    const invalidMessages = await ChannelMessage.findAll({
      where: {
        sent_at: null
      }
    });
    
    console.log(`Found ${invalidMessages.length} messages with invalid timestamps`);
    
    // Delete invalid messages
    await ChannelMessage.destroy({
      where: {
        sent_at: null
      }
    });
    
    // Find and delete empty chats
    const emptyChats = await ChannelChat.findAll({
      include: [{
        model: ChannelMessage,
        as: 'messages',
        required: false
      }]
    });
    
    const chatsToDelete = emptyChats.filter(chat => !chat.messages || chat.messages.length === 0);
    console.log(`Found ${chatsToDelete.length} empty chats to delete`);
    
    for (const chat of chatsToDelete) {
      await chat.destroy();
    }
    
    res.json({ 
      success: true, 
      deletedMessages: invalidMessages.length,
      deletedChats: chatsToDelete.length
    });
    
  } catch (error) {
    console.error('Error clearing invalid messages:', error);
    res.status(500).json({ error: 'Failed to clear invalid messages' });
  }
});

// Simple endpoint for frontend to send messages
app.post('/api/send-message', async (req, res) => {
  try {
    const { to, text, fromName } = req.body;
    
    // Find the WhatsApp account
    const account = await ChannelAccount.findOne({
      where: { 
        user_id: '2685891d-cdca-4645-bb87-7bd61541ab06',
        provider: 'whatsapp'
      }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'WhatsApp account not found' });
    }
    
    // Send message via UniPile
    const unipileService = new (require('./services/UniPileService'))();
    const result = await unipileService.sendMessage(
      account.connection_data.connectionId,
      to,
      {
        text: text,
        type: 'text'
      }
    );
    
    // Extract phone number from recipient
    const phoneNumber = to ? to.replace(/^whatsapp:/, '').replace(/^\+/, '').replace(/\D/g, '') : 'unknown';
    
    // Skip creating chat if it's with own phone number
    const ownPhoneNumber = process.env.WHATSAPP_ACCOUNT_NUMBER || '919566651479';
    if (phoneNumber === ownPhoneNumber) {
      console.log(`Skipping chat creation for own phone number: ${phoneNumber}`);
      return res.json({
        success: true,
        message: 'Message sent successfully (own chat not created)',
        result
      });
    }
    
    const uniqueChatId = `${phoneNumber}_whatsapp`;
    
    // Create message record in database
    const [chat] = await ChannelChat.findOrCreate({
      where: {
        account_id: account.id,
        provider_chat_id: uniqueChatId
      },
      defaults: {
        account_id: account.id,
        provider_chat_id: uniqueChatId,
        title: fromName || `Chat ${phoneNumber}`,
        last_message_at: new Date(),
        chat_info: {
          original_chat_id: to,
          phone_number: phoneNumber,
          to: to,
        },
        unread_count: 0,
        status: 'active'
      }
    });
    
    const message = await ChannelMessage.create({
      chat_id: chat.id,
      provider_msg_id: result.message_id || `sent_${Date.now()}`,
      direction: 'out',
      body: text,
      subject: null,
      attachments: [],
      sent_at: new Date(),
      status: 'sent',
      provider_metadata: {
        to: to,
        from: account.connection_data.phone_number,
        fromName: fromName || 'You'
      },
      is_reply: false,
      sync_status: 'pending',
      sync_attempts: 0
    });
    
    // Emit sent message to frontend so user can see their own messages in the conversation
    if (io) {
      io.to(`user_2685891d-cdca-4645-bb87-7bd61541ab06`).emit('new_message', {
        id: message.id,
        text: message.body,
        from: message.provider_metadata.from,
        fromName: message.provider_metadata.fromName,
        to: message.provider_metadata.to,
        timestamp: message.sent_at,
        direction: 'out',
        chat_id: message.chat_id,
        status: message.status
      });
    }
    
    res.json({ 
      success: true, 
      message: message,
      unipile_result: result 
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io server ready for real-time connections`);
  
  // Sync database in development
  if (config.nodeEnv === 'development') {
    try {
      await syncDatabase(false);
      console.log('✅ Database synchronized');
    } catch (error) {
      console.error('❌ Database sync failed:', error);
    }
  }
});

module.exports = { app, server, io };