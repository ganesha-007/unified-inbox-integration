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
const webhooksController = new WebhooksController();
const entitlementService = new EntitlementService();

// Test database connection
testConnection();

// Middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
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

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.userId = decoded.userId;
    next();
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  // Join user-specific room
  socket.join(`user_${socket.userId}`);
  
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