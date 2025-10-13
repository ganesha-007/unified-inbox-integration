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

class PlatformService {
  constructor(platform, config) {
    this.platform = platform;
    this.config = config;
    this.rateLimiter = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Initialize the platform service
   * @param {Object} credentials - Platform credentials
   * @returns {Promise<boolean>} Success status
   */
  async initialize(credentials) {
    throw new Error(`initialize() method must be implemented by ${this.platform} service`);
  }

  /**
   * Fetch messages from the platform
   * @param {Object} options - Fetch options (limit, offset, since, etc.)
   * @returns {Promise<Array>} Array of raw messages
   */
  async fetchMessages(options = {}) {
    throw new Error(`fetchMessages() method must be implemented by ${this.platform} service`);
  }

  /**
   * Send a message to the platform
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Sent message response
   */
  async sendMessage(message) {
    throw new Error(`sendMessage() method must be implemented by ${this.platform} service`);
  }

  /**
   * Handle incoming webhook from platform
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} Processed webhook data
   */
  async handleWebhook(webhookData) {
    throw new Error(`handleWebhook() method must be implemented by ${this.platform} service`);
  }

  /**
   * Refresh access token if needed
   * @returns {Promise<Object>} New token data
   */
  async refreshToken() {
    throw new Error(`refreshToken() method must be implemented by ${this.platform} service`);
  }

  /**
   * Check if token is valid and not expired
   * @returns {Promise<boolean>} Token validity
   */
  async isTokenValid() {
    throw new Error(`isTokenValid() method must be implemented by ${this.platform} service`);
  }

  /**
   * Get platform connection status
   * @returns {Promise<Object>} Connection status
   */
  async getConnectionStatus() {
    throw new Error(`getConnectionStatus() method must be implemented by ${this.platform} service`);
  }

  /**
   * Disconnect from platform
   * @returns {Promise<boolean>} Success status
   */
  async disconnect() {
    throw new Error(`disconnect() method must be implemented by ${this.platform} service`);
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(url, options = {}) {
    const maxRetries = options.maxRetries || this.retryAttempts;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limiting
        await this.checkRateLimit(url);

        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited, wait and retry
            const retryAfter = response.headers.get('Retry-After') || 60;
            await this.sleep(retryAfter * 1000);
            continue;
          }
          
          if (response.status >= 500 && attempt < maxRetries) {
            // Server error, retry
            await this.sleep(this.retryDelay * attempt);
            continue;
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(url, response.headers);
        return data;

      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check rate limiting for a URL
   * @param {string} url - URL to check
   */
  async checkRateLimit(url) {
    const key = this.getRateLimitKey(url);
    const limit = this.rateLimiter.get(key);

    if (limit && limit.resetTime > Date.now()) {
      if (limit.count >= limit.maxRequests) {
        const waitTime = limit.resetTime - Date.now();
        await this.sleep(waitTime);
      }
    }
  }

  /**
   * Update rate limit tracking
   * @param {string} url - URL
   * @param {Object} headers - Response headers
   */
  updateRateLimit(url, headers) {
    const key = this.getRateLimitKey(url);
    const resetTime = headers.get('X-RateLimit-Reset') || Date.now() + 3600000; // 1 hour default
    const maxRequests = headers.get('X-RateLimit-Limit') || 1000;
    const remaining = headers.get('X-RateLimit-Remaining') || maxRequests;

    this.rateLimiter.set(key, {
      count: maxRequests - remaining,
      maxRequests: parseInt(maxRequests),
      resetTime: parseInt(resetTime) * 1000,
    });
  }

  /**
   * Get rate limit key for URL
   * @param {string} url - URL
   * @returns {string} Rate limit key
   */
  getRateLimitKey(url) {
    const urlObj = new URL(url);
    return `${this.platform}_${urlObj.hostname}`;
  }

  /**
   * Get authentication headers
   * @returns {Object} Auth headers
   */
  getAuthHeaders() {
    throw new Error(`getAuthHeaders() method must be implemented by ${this.platform} service`);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate webhook signature
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} Is valid
   */
  validateWebhookSignature(payload, signature) {
    throw new Error(`validateWebhookSignature() method must be implemented by ${this.platform} service`);
  }

  /**
   * Get platform-specific error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    const errorMessages = {
      'INVALID_TOKEN': 'Authentication token is invalid or expired',
      'RATE_LIMITED': 'Too many requests. Please try again later',
      'PERMISSION_DENIED': 'Insufficient permissions to perform this action',
      'NOT_FOUND': 'Resource not found',
      'NETWORK_ERROR': 'Network connection error',
    };

    return errorMessages[error.code] || error.message || 'An unknown error occurred';
  }

  /**
   * Log platform-specific activity
   * @param {string} action - Action performed
   * @param {Object} data - Action data
   * @param {string} level - Log level (info, warn, error)
   */
  log(action, data = {}, level = 'info') {
    const logData = {
      platform: this.platform,
      action,
      timestamp: new Date().toISOString(),
      ...data,
    };

    console[level](`[${this.platform.toUpperCase()}] ${action}:`, logData);
  }
}

module.exports = PlatformService;
