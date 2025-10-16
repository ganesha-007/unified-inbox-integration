import { EventEmitter } from 'events';

/**
 * Platform Service Base Class
 * 
 * This is the base class for all platform services. It defines the common interface
 * that all platform integrations must implement.
 * 
 * Each platform service handles:
 * 1. Authentication and token management
 * 2. Message fetching and sending
 * 3. Webhook handling
 * 4. Rate limiting and error handling
 * 5. Data transformation to unified format
 */

interface PlatformConfig {
  [key: string]: any;
}

interface PlatformCredentials {
  [key: string]: any;
}

interface UnifiedMessage {
  id: string;
  platform: string;
  threadId: string;
  direction: 'in' | 'out';
  content: string;
  timestamp: Date;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  recipient?: {
    id: string;
    name: string;
  };
  attachments?: any[];
  metadata: Record<string, any>;
}

class PlatformService extends EventEmitter {
  protected platform: string;
  protected config: PlatformConfig;
  protected rateLimiter: Map<string, number>;
  protected retryAttempts: number;
  protected retryDelay: number;

  constructor(platform: string, config: PlatformConfig) {
    super();
    this.platform = platform;
    this.config = config;
    this.rateLimiter = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Initialize the platform service
   */
  async initialize(credentials: PlatformCredentials): Promise<boolean> {
    throw new Error(`initialize() method must be implemented by ${this.platform} service`);
  }

  /**
   * Send a message
   */
  async sendMessage(threadId: string, content: string, options?: Record<string, any>): Promise<UnifiedMessage> {
    throw new Error(`sendMessage() method must be implemented by ${this.platform} service`);
  }

  /**
   * Fetch messages from a thread
   */
  async fetchMessages(threadId: string, limit?: number, offset?: number): Promise<UnifiedMessage[]> {
    throw new Error(`fetchMessages() method must be implemented by ${this.platform} service`);
  }

  /**
   * Fetch all threads/conversations
   */
  async fetchThreads(limit?: number, offset?: number): Promise<any[]> {
    throw new Error(`fetchThreads() method must be implemented by ${this.platform} service`);
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    throw new Error(`markAsRead() method must be implemented by ${this.platform} service`);
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: any): Promise<void> {
    throw new Error(`handleWebhook() method must be implemented by ${this.platform} service`);
  }

  /**
   * Get platform status
   */
  async getStatus(): Promise<{ connected: boolean; lastSync?: Date; error?: string }> {
    throw new Error(`getStatus() method must be implemented by ${this.platform} service`);
  }

  /**
   * Disconnect the service
   */
  async disconnect(): Promise<void> {
    throw new Error(`disconnect() method must be implemented by ${this.platform} service`);
  }

  /**
   * Transform platform-specific message to unified format
   */
  protected transformMessage(platformMessage: any): UnifiedMessage {
    throw new Error(`transformMessage() method must be implemented by ${this.platform} service`);
  }

  /**
   * Check rate limits
   */
  protected async checkRateLimit(operation: string): Promise<boolean> {
    const now = Date.now();
    const key = `${this.platform}:${operation}`;
    const lastRequest = this.rateLimiter.get(key) || 0;
    const timeSinceLastRequest = now - lastRequest;

    // Simple rate limiting - can be enhanced with more sophisticated logic
    const minInterval = 100; // 100ms minimum between requests
    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest);
    }

    this.rateLimiter.set(key, now);
    return true;
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.retryAttempts
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Delay execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate credentials
   */
  protected validateCredentials(credentials: PlatformCredentials): boolean {
    // Basic validation - should be overridden by specific services
    return credentials && typeof credentials === 'object';
  }

  /**
   * Log platform-specific information
   */
  protected log(level: string, message: string, data?: any): void {
    const logMessage = `[${this.platform.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'info':
        console.log(logMessage, data);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.log(logMessage, data);
        }
        break;
    }
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: any, context: string): Error {
    const message = `${this.platform} service error in ${context}: ${error.message}`;
    this.log('error', message, error);
    return new Error(message);
  }

  /**
   * Get platform name
   */
  getPlatformName(): string {
    return this.platform;
  }

  /**
   * Get platform configuration
   */
  getConfig(): PlatformConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PlatformConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default PlatformService;
