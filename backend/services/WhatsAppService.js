const PlatformService = require('./PlatformService');
const crypto = require('crypto');

/**
 * WhatsApp Business API Service
 * 
 * Handles integration with WhatsApp Business API including:
 * - Message sending and receiving
 * - Webhook verification and handling
 * - Media message support
 * - Template message support
 */

class WhatsAppService extends PlatformService {
  constructor(config) {
    super('whatsapp', config);
    this.apiUrl = config.apiUrl || 'https://graph.facebook.com/v18.0';
    this.accessToken = null;
    this.phoneNumberId = null;
    this.webhookVerifyToken = null;
  }

  async initialize(credentials) {
    try {
      this.accessToken = credentials.accessToken;
      this.phoneNumberId = credentials.phoneNumberId;
      this.webhookVerifyToken = credentials.webhookVerifyToken;

      // Verify connection by getting phone number info
      const phoneInfo = await this.getPhoneNumberInfo();
      this.log('initialized', { phoneNumber: phoneInfo.display_phone_number });
      
      return true;
    } catch (error) {
      this.log('initialization_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async fetchMessages(options = {}) {
    try {
      // WhatsApp Business API doesn't provide a direct way to fetch historical messages
      // Messages are typically received via webhooks
      // This method would be used for testing or special cases
      
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      const params = new URLSearchParams({
        limit: options.limit || 10,
        ...options,
      });

      const response = await this.makeRequest(`${url}?${params}`);
      return response.data || [];
    } catch (error) {
      this.log('fetch_messages_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async sendMessage(message) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: message.recipient.phone || message.recipient.id,
        type: 'text',
        text: {
          body: message.content.text,
        },
      };

      // Handle different message types
      if (message.content.media) {
        payload.type = message.content.media.type;
        payload[message.content.media.type] = {
          id: message.content.media.id,
          caption: message.content.text,
        };
      }

      // Handle template messages
      if (message.template) {
        payload.type = 'template';
        payload.template = {
          name: message.template.name,
          language: { code: message.template.language || 'en' },
          components: message.template.components || [],
        };
      }

      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      this.log('message_sent', { 
        messageId: response.messages?.[0]?.id,
        recipient: message.recipient.phone 
      });

      return response;
    } catch (error) {
      this.log('send_message_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async handleWebhook(webhookData) {
    try {
      // Verify webhook signature if provided
      if (webhookData.signature && !this.validateWebhookSignature(webhookData.body, webhookData.signature)) {
        throw new Error('Invalid webhook signature');
      }

      const data = typeof webhookData.body === 'string' ? JSON.parse(webhookData.body) : webhookData.body;
      
      if (data.object === 'whatsapp_business_account') {
        for (const entry of data.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const messages = change.value.messages || [];
              const contacts = change.value.contacts || [];
              const profiles = change.value.profiles || [];

              // Combine messages with contact and profile data
              const enrichedMessages = messages.map(message => ({
                messages: [message],
                contacts: contacts.filter(c => c.wa_id === message.from),
                profiles: profiles.filter(p => p.wa_id === message.from),
              }));

              this.log('webhook_processed', { messageCount: enrichedMessages.length });
              return enrichedMessages;
            }
          }
        }
      }

      return [];
    } catch (error) {
      this.log('webhook_handling_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  async refreshToken() {
    // WhatsApp Business API tokens don't typically expire
    // This method would handle token refresh if needed
    return {
      accessToken: this.accessToken,
      expiresIn: null,
    };
  }

  async isTokenValid() {
    try {
      await this.getPhoneNumberInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getConnectionStatus() {
    try {
      const phoneInfo = await this.getPhoneNumberInfo();
      return {
        connected: true,
        phoneNumber: phoneInfo.display_phone_number,
        status: phoneInfo.status,
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
    this.phoneNumberId = null;
    this.webhookVerifyToken = null;
    this.log('disconnected');
    return true;
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
    };
  }

  validateWebhookSignature(payload, signature) {
    if (!this.webhookVerifyToken) {
      return true; // Skip validation if no token configured
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookVerifyToken)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Get phone number information
   * @returns {Promise<Object>} Phone number info
   */
  async getPhoneNumberInfo() {
    const url = `${this.apiUrl}/${this.phoneNumberId}`;
    return await this.makeRequest(url);
  }

  /**
   * Send template message
   * @param {Object} template - Template configuration
   * @param {string} recipient - Recipient phone number
   * @returns {Promise<Object>} Send response
   */
  async sendTemplateMessage(template, recipient) {
    const message = {
      recipient: { phone: recipient },
      content: { text: '' },
      template: template,
    };

    return await this.sendMessage(message);
  }

  /**
   * Upload media file
   * @param {Buffer} mediaBuffer - Media file buffer
   * @param {string} mimeType - Media MIME type
   * @returns {Promise<Object>} Upload response
   */
  async uploadMedia(mediaBuffer, mimeType) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/media`;
      
      const formData = new FormData();
      formData.append('file', new Blob([mediaBuffer], { type: mimeType }));
      formData.append('type', mimeType);
      formData.append('messaging_product', 'whatsapp');

      const response = await this.makeRequest(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      this.log('media_uploaded', { mediaId: response.id });
      return response;
    } catch (error) {
      this.log('media_upload_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  /**
   * Get media URL
   * @param {string} mediaId - Media ID
   * @returns {Promise<string>} Media URL
   */
  async getMediaUrl(mediaId) {
    try {
      const url = `${this.apiUrl}/${mediaId}`;
      const response = await this.makeRequest(url);
      return response.url;
    } catch (error) {
      this.log('get_media_url_failed', { error: error.message }, 'error');
      throw error;
    }
  }

  /**
   * Mark message as read
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Response
   */
  async markAsRead(messageId) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      this.log('message_marked_read', { messageId });
      return response;
    } catch (error) {
      this.log('mark_read_failed', { error: error.message }, 'error');
      throw error;
    }
  }
}

module.exports = WhatsAppService;
