require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    uri: process.env.DATABASE_URL || 'postgresql://localhost:5432/unified_inbox',
    options: {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    }
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    options: {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    }
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  // Pricing Mode Configuration
  pricing: {
    mode: process.env.PRICING_MODE || 'bundled', // 'bundled' or 'addons'
    plans: {
      starter: { 
        includes: ['linkedin'], 
        limits: { messagesPerMonth: 1000 } 
      },
      growth: { 
        includes: ['linkedin', 'crm'], 
        limits: { messagesPerMonth: 5000 } 
      },
      scale: { 
        includes: ['linkedin', 'crm', 'whatsapp', 'instagram', 'email'], 
        limits: { messagesPerMonth: 50000 } 
      },
    },
    addons: {
      whatsapp: { 
        feature: 'whatsapp', 
        limits: { messagesPerMonth: 5000 } 
      },
      instagram: { 
        feature: 'instagram', 
        limits: { messagesPerMonth: 5000 } 
      },
      email: { 
        feature: 'email', 
        limits: { messagesPerMonth: 10000 } 
      },
    }
  },
  
  // Platform API Configuration
  platforms: {
    unipile: {
      apiKey: process.env.UNIPILE_API_KEY,
      baseUrl: process.env.UNIPILE_BASE_URL || 'https://api15.unipile.com:14581',
      dsn: process.env.UNIPILE_DSN || 'api15.unipile.com:14581',
      whatsappConnectionId: process.env.WHATSAPP_ACCOUNT_TOKEN || 'T5GMMpVSS72Nh975S0wPPg',
    },
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:5001/auth/gmail/callback',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5001/auth/microsoft/callback',
      scopes: [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Mail.ReadWrite'
      ],
    }
  },
  
  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  
  // Email Safety Limits
  email: {
    maxRecipientsPerMessage: parseInt(process.env.EMAIL_MAX_RECIPIENTS_PER_MESSAGE) || 10,
    maxPerHour: parseInt(process.env.EMAIL_MAX_PER_HOUR) || 50,
    maxPerDay: parseInt(process.env.EMAIL_MAX_PER_DAY) || 200,
    perRecipientCooldownSec: parseInt(process.env.EMAIL_PER_RECIPIENT_COOLDOWN_SEC) || 120,
    perDomainCooldownSec: parseInt(process.env.EMAIL_PER_DOMAIN_COOLDOWN_SEC) || 60,
    maxAttachmentBytes: parseInt(process.env.EMAIL_MAX_ATTACHMENT_BYTES) || 10485760,
    trialDailyCap: parseInt(process.env.EMAIL_TRIAL_DAILY_CAP) || 20,
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3000'],
    credentials: true,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  },
  
  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },
  
  // Socket.io Configuration
  socket: {
    cors: {
      origin: 'http://localhost:3000', // Force override .env file
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  }
};

// Validation
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
];

if (config.nodeEnv === 'production') {
  requiredEnvVars.push('STRIPE_SECRET_KEY', 'UNIPILE_API_KEY');
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  });
}

module.exports = config;