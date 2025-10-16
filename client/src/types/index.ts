// Core types for the unified inbox frontend

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

export interface Message {
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
  avatar?: string;
  platform?: string;
}

export type MessageDirection = 'in' | 'out';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';

export interface Chat {
  id: string;
  title: string;
  lastMessage?: Message;
  unreadCount: number;
  platform: Platform;
  status: ChatStatus;
  participants: Participant[];
  createdAt: Date;
  updatedAt: Date;
}

export type Platform = 'whatsapp' | 'instagram' | 'email';
export type ChatStatus = 'active' | 'archived' | 'muted';

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface Connection {
  id: string;
  platform: Platform;
  status: ConnectionStatus;
  accountInfo: AccountInfo;
  lastSyncAt?: Date;
  createdAt: Date;
}

export type ConnectionStatus = 'connected' | 'needs_action' | 'disconnected';

export interface AccountInfo {
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  externalId: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ConnectionState {
  connections: Connection[];
  isLoading: boolean;
  error: string | null;
}

export interface MessageState {
  messages: Message[];
  currentChat: Chat | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

export interface EntitlementState {
  entitlements: Record<Platform, boolean>;
  limits: Record<Platform, PlatformLimits>;
  isLoading: boolean;
  error: string | null;
}

export interface PlatformLimits {
  messagesPerMonth: number;
  maxPlatforms?: number;
  realTimeSync?: boolean;
  advancedSearch?: boolean;
}

export interface EmailLimitsState {
  currentUsage: {
    hourly: number;
    daily: number;
    trial: number;
  };
  limits: {
    maxPerHour: number;
    maxPerDay: number;
    trialDailyCap: number;
  };
  isLoading: boolean;
  error: string | null;
}

// API Response types
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
  avatar?: string;
  platform?: string;
}

export interface SocketTypingEvent {
  userId: string;
  threadId: string;
  isTyping: boolean;
}

// Component Props types
export interface ChatListProps {
  chats: Chat[];
  currentChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  isLoading?: boolean;
}

export interface ConversationProps {
  chat: Chat;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  isConnected?: boolean;
}

export interface ComposerProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  onConnect: (credentials: any) => void;
  isLoading?: boolean;
}

export interface ProviderTabsProps {
  activeTab: Platform;
  onTabChange: (platform: Platform) => void;
  connections: Connection[];
}

export interface FeatureGuardProps {
  platform: Platform;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Hook return types
export interface UseConnectionsReturn {
  connections: Connection[];
  isLoading: boolean;
  error: string | null;
  connectAccount: (platform: Platform, credentials: any) => Promise<void>;
  disconnectAccount: (connectionId: string) => Promise<void>;
  refreshConnections: () => Promise<void>;
}

export interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  isConnected: boolean;
}

export interface UseEntitlementsReturn {
  entitlements: Record<Platform, boolean>;
  limits: Record<Platform, PlatformLimits>;
  isLoading: boolean;
  error: string | null;
  hasAccess: (platform: Platform) => boolean;
  getLimits: (platform: Platform) => PlatformLimits;
}

export interface UseEmailLimitsReturn {
  currentUsage: {
    hourly: number;
    daily: number;
    trial: number;
  };
  limits: {
    maxPerHour: number;
    maxPerDay: number;
    trialDailyCap: number;
  };
  isLoading: boolean;
  error: string | null;
  refreshLimits: () => Promise<void>;
}

// Service types
export interface MessageService {
  sendMessage: (content: string, chatId?: string) => Promise<Message>;
  getMessages: (chatId: string, limit?: number, offset?: number) => Promise<Message[]>;
  markAsRead: (messageId: string) => Promise<void>;
}

export interface SocketService {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: SocketMessage) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  onMessage: (callback: (message: SocketMessage) => void) => void;
  onTyping: (callback: (event: SocketTypingEvent) => void) => void;
  onConnect: (callback: () => void) => void;
  onDisconnect: (callback: () => void) => void;
  isConnected: boolean;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface ConnectionFormData {
  platform: Platform;
  credentials: Record<string, any>;
}

// Theme types
export interface Theme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

// Search types
export interface SearchFilters {
  platforms?: Platform[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  direction?: MessageDirection;
  status?: MessageStatus;
  query?: string;
}

export interface SearchResult {
  messages: Message[];
  total: number;
  filters: SearchFilters;
}
