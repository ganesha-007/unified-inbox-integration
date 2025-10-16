// Core types for the unified inbox application

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  preferences: UserPreferences;
  status: UserStatus;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  lastActivityAt: Date;
  loginCount: number;
  subscription: Subscription;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  language: string;
  timezone: string;
}

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface Subscription {
  plan: string;
  status: string;
  expiresAt?: Date;
  features: {
    maxMessages: number;
    maxPlatforms: number;
    realTimeSync: boolean;
    advancedSearch: boolean;
  };
}

export interface ChannelAccount {
  id: string;
  userId: string;
  provider: Provider;
  externalAccountId: string;
  status: AccountStatus;
  connectionData: Record<string, any>;
  accountInfo: Record<string, any>;
  lastSyncAt?: Date;
  syncStatus: SyncStatus;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Provider = 'whatsapp' | 'instagram' | 'email';
export type AccountStatus = 'connected' | 'needs_action' | 'disconnected';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface ChannelChat {
  id: string;
  accountId: string;
  providerChatId: string;
  title: string;
  lastMessageAt?: Date;
  chatInfo: Record<string, any>;
  unreadCount: number;
  status: ChatStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatStatus = 'active' | 'archived' | 'deleted';

export interface ChannelMessage {
  id: string;
  chatId: string;
  providerMsgId: string;
  direction: MessageDirection;
  body: string;
  subject?: string;
  attachments: any[];
  sentAt: Date;
  status: MessageStatus;
  readAt?: Date;
  providerMetadata: Record<string, any>;
  threadId?: string;
  parentMessageId?: string;
  isReply: boolean;
  syncStatus: MessageSyncStatus;
  syncAttempts: number;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDirection = 'in' | 'out';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';
export type MessageSyncStatus = 'pending' | 'synced' | 'failed';

export interface ChannelEntitlement {
  id: string;
  userId: string;
  provider: Provider;
  isActive: boolean;
  source: EntitlementSource;
  expiresAt?: Date;
  limits: Record<string, any>;
  billingInfo: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type EntitlementSource = 'plan' | 'addon';

export interface ChannelUsage {
  id: string;
  userId: string;
  provider: Provider;
  periodYm: string;
  messagesSent: number;
  messagesReceived: number;
  usageMetrics: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Webhook types
export interface UniPileWebhookData {
  event: string;
  account_id: string;
  account_type: string;
  webhook_name: string;
  chat_id: string;
  attendees: Attendee[];
  sender: Attendee;
  subject: string;
  message: string;
  message_id: string;
  timestamp: string;
  attachments: any[];
  provider_chat_id: string;
  provider_message_id: string;
  is_event: number;
  quoted?: any;
  chat_content_type?: string;
  message_type?: string;
  is_group: boolean;
  folder: string[];
}

export interface Attendee {
  attendee_id: string;
  attendee_provider_id: string;
  attendee_name: string;
  attendee_profile_url?: string;
}

// Socket.io types
export interface SocketMessage {
  id: string;
  text: string;
  from: string;
  fromName: string;
  to: string;
  timestamp: Date;
  direction: MessageDirection;
  chat_id?: string;
  provider_msg_id?: string;
  subject?: string;
  attachments?: any[];
  status?: MessageStatus;
  provider_metadata?: Record<string, any>;
  created_at?: Date;
}

// Service types
export interface UniPileConfig {
  apiKey: string;
  baseUrl: string;
  dsn: string;
  webhookSecret: string;
}

export interface WhatsAppConfig {
  accountNumber: string;
  accountToken: string;
}

// Environment variables type
export interface EnvironmentVariables {
  PORT: number;
  NODE_ENV: string;
  FRONTEND_URL: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PRICING_MODE: string;
  UNIPILE_API_KEY: string;
  UNIPILE_BASE_URL: string;
  UNIPILE_DSN: string;
  UNIPILE_WEBHOOK_SECRET: string;
  WHATSAPP_ACCOUNT_NUMBER: string;
  WHATSAPP_ACCOUNT_TOKEN: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REDIRECT_URI?: string;
  GMAIL_WEBHOOK_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_REDIRECT_URI?: string;
  MICROSOFT_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  EMAIL_MAX_RECIPIENTS_PER_MESSAGE: number;
  EMAIL_MAX_PER_HOUR: number;
  EMAIL_MAX_PER_DAY: number;
  EMAIL_PER_RECIPIENT_COOLDOWN_SEC: number;
  EMAIL_PER_DOMAIN_COOLDOWN_SEC: number;
  EMAIL_MAX_ATTACHMENT_BYTES: number;
  EMAIL_TRIAL_DAILY_CAP: number;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  MAX_FILE_SIZE: number;
  UPLOAD_PATH: string;
  LOG_LEVEL: string;
  LOG_FILE: string;
}
