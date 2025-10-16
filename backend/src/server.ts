import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import config
import config from './config';
import { testConnection, syncDatabase } from './config/database';

// Import controllers
import ChannelsController from './controllers/ChannelsController';
import WebhooksController from './controllers/WebhooksController';

// Import services
import EntitlementService from './services/EntitlementService';

// Import models
import { User, ChannelAccount, ChannelChat, ChannelMessage, ChannelEntitlement, ChannelUsage } from './models';

// Import types
import { EnvironmentVariables, SocketMessage } from './types';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
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
  max: (config.rateLimit as any).maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, (config.upload as any).path);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    // For development, allow connections without token
    (socket as any).userId = '2685891d-cdca-4645-bb87-7bd61541ab06'; // Default user ID
    console.log('🔌 Socket.io authentication: User 2685891d-cdca-4645-bb87-7bd61541ab06 connecting');
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (socket as any).userId = decoded.userId;
    console.log(`🔌 Socket.io authentication: User ${decoded.userId} connecting`);
    next();
  } catch (err) {
    console.error('Socket.io authentication error:', err);
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Socket.io connection established for user: ${(socket as any).userId}`);
  console.log(`🔌 Socket ID: ${socket.id}`);
  console.log(`🔌 Socket rooms: ${Array.from(socket.rooms)}`);
  
  // Join user-specific room
  socket.join(`user_${(socket as any).userId}`);
  console.log(`🔌 User ${(socket as any).userId} joined room: user_${(socket as any).userId}`);
  
  // Handle manual room joining (for frontend compatibility)
  socket.on('join_room', (roomName: string) => {
    socket.join(roomName);
    console.log(`🔌 Socket ${socket.id} joined room: ${roomName}`);
  });
  
  // Handle message sending
  socket.on('send_message', async (data: any) => {
    try {
      console.log('Received message from socket:', data);
      const { platform, content, threadId, recipient } = data;
      
      // Create normalized message
      const messageData: SocketMessage = {
        id: Date.now().toString(),
        text: content,
        from: (socket as any).userId,
        fromName: 'You',
        to: recipient,
        timestamp: new Date(),
        direction: 'out'
      };

      // Save to database
      const message = await ChannelMessage.create({
        chatId: threadId || `thread_${Date.now()}`,
        providerMsgId: messageData.id,
        direction: messageData.direction,
        body: messageData.text,
        sentAt: messageData.timestamp,
        status: 'sent',
        providerMetadata: {
          from: messageData.from,
          to: messageData.to,
          fromName: messageData.fromName
        }
      });

      console.log('Message saved successfully:', message.id);

      // Emit to user's room
      socket.to(`user_${(socket as any).userId}`).emit('new_message', message);
      socket.emit('message_sent', message);

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
      console.error('Socket message error:', error);
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data: any) => {
    socket.to(`user_${(socket as any).userId}`).emit('user_typing', {
      userId: (socket as any).userId,
      threadId: data.threadId,
      isTyping: true,
    });
  });

  socket.on('typing_stop', (data: any) => {
    socket.to(`user_${(socket as any).userId}`).emit('user_typing', {
      userId: (socket as any).userId,
      threadId: data.threadId,
      isTyping: false,
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User ${(socket as any).userId} disconnected`);
  });
});

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Unified Inbox API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/channels', channelsController.router);
app.use('/app', webhooksController.router);

// Authentication routes
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as any
    );

    res.status(201).json({
      message: 'User created successfully',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as any
    );

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Simple endpoint for frontend to send messages
app.post('/api/send-message', async (req: Request, res: Response) => {
  try {
    const { to, text, fromName } = req.body;
    
    // Find the WhatsApp account
    const account = await ChannelAccount.findOne({
      where: { 
        userId: 'e82f8560-e0ac-4de1-9c2d-039541a94a97',
        provider: 'whatsapp'
      } as any
    });
    
    if (!account) {
      return res.status(404).json({ error: 'WhatsApp account not found' });
    }
    
    // Send message via UniPile
    const unipileService = new (require('./services/UniPileService'))();
    const result = await unipileService.sendMessage(
      (account as any).connection_data.connectionId,
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
        accountId: account.id,
        providerChatId: uniqueChatId
      } as any,
      defaults: {
        accountId: account.id,
        providerChatId: uniqueChatId,
        title: fromName || `Chat ${phoneNumber}`,
        lastMessageAt: new Date(),
        chatInfo: {
          original_chat_id: to,
          phone_number: phoneNumber,
          to: to,
        },
        unreadCount: 0,
        status: 'active'
      }
    });
    
    const message = await ChannelMessage.create({
        chatId: chat.id,
      providerMsgId: result.message_id || `sent_${Date.now()}`,
      direction: 'out',
      body: text,
      subject: null,
      attachments: [],
      sentAt: new Date(),
      status: 'sent',
      providerMetadata: {
        to: to,
        from: (account as any).connection_data.phone_number,
        fromName: fromName || 'You'
      },
      isReply: false,
      syncStatus: 'pending',
      syncAttempts: 0
    });
    
    // Emit sent message to frontend so user can see their own messages in the conversation
    if (io) {
      io.to(`user_e82f8560-e0ac-4de1-9c2d-039541a94a97`).emit('new_message', {
        id: message.id,
        text: message.body,
          from: (message as any).provider_metadata.from,
          fromName: (message as any).provider_metadata.fromName,
          to: (message as any).provider_metadata.to,
          timestamp: (message as any).sent_at,
          direction: 'out',
          chat_id: (message as any).chat_id,
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
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io server ready for real-time connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
