import PlatformService from './PlatformService';
import crypto from 'crypto';

interface WhatsAppConfig {
  apiUrl?: string;
  accessToken?: string;
  phoneNumberId?: string;
  webhookVerifyToken?: string;
}

interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
}

interface WhatsAppMessage {
  to: string;
  type: string;
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  media?: {
    id?: string;
    link?: string;
    caption?: string;
  };
}

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
  // @ts-ignore - Method signature mismatch with base class
  private apiUrl: string;
  private accessToken: string | null;
  private phoneNumberId: string | null;
  private webhookVerifyToken: string | null;

  constructor(config: WhatsAppConfig) {
    super('whatsapp', config);
    this.apiUrl = config.apiUrl || 'https://graph.facebook.com/v18.0';
    this.accessToken = null;
    this.phoneNumberId = null;
    this.webhookVerifyToken = null;
  }

  async initialize(credentials: WhatsAppCredentials): Promise<boolean> {
    try {
      this.accessToken = credentials.accessToken;
      this.phoneNumberId = credentials.phoneNumberId;
      this.webhookVerifyToken = credentials.webhookVerifyToken;

      // Verify connection by getting phone number info
      const phoneInfo = await this.getPhoneNumberInfo();
      if (phoneInfo) {
        console.log('WhatsApp connection initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing WhatsApp connection:', error);
      return false;
    }
  }

  /**
   * Get phone number information
   */
  async getPhoneNumberInfo(): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/${this.phoneNumberId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting phone number info:', error);
      throw error;
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    const message: WhatsAppMessage = {
      to,
      type: 'text',
      text: { body: text }
    };

    return this.sendMessage(message);
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en', components?: any[]): Promise<any> {
    const message: WhatsAppMessage = {
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };

    return this.sendMessage(message);
  }

  /**
   * Send a media message
   */
  async sendMediaMessage(to: string, mediaId: string, caption?: string): Promise<any> {
    const message: WhatsAppMessage = {
      to,
      type: 'image', // Default to image, could be determined by media type
      media: {
        id: mediaId,
        caption
      }
    };

    return this.sendMessage(message);
  }

  /**
   * Send a message with media link
   */
  async sendMediaLinkMessage(to: string, mediaLink: string, caption?: string): Promise<any> {
    const message: WhatsAppMessage = {
      to,
      type: 'image', // Default to image, could be determined by media type
      media: {
        link: mediaLink,
        caption
      }
    };

    return this.sendMessage(message);
  }

  /**
   * Send a message
   */
  // @ts-ignore - Method signature mismatch with base class
  async sendMessage(message: WhatsAppMessage): Promise<any> {
    try {
      const response = await this.makeRequest('POST', `/${this.phoneNumberId}/messages`, message);
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Upload media
   */
  async uploadMedia(mediaBuffer: Buffer, mimeType: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([mediaBuffer], { type: mimeType }));
      formData.append('type', mimeType);
      formData.append('messaging_product', 'whatsapp');

      const response = await this.makeRequest('POST', '/media', formData, {
        'Content-Type': 'multipart/form-data'
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  }

  /**
   * Get media URL
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await this.makeRequest('GET', `/${mediaId}`);
      return response.data.url;
    } catch (error) {
      console.error('Error getting media URL:', error);
      throw error;
    }
  }

  /**
   * Download media
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      const response = await this.makeRequest('GET', mediaUrl, null, {
        'Authorization': `Bearer ${this.accessToken}`
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading media:', error);
      throw error;
    }
  }

  /**
   * Verify webhook
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: any): Promise<void> {
    try {
      if (event.entry) {
        for (const entry of event.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value && change.value.messages) {
                for (const message of change.value.messages) {
                  await this.processIncomingMessage(message, change.value);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      throw error;
    }
  }

  /**
   * Process incoming message
   */
  private async processIncomingMessage(message: any, context: any): Promise<void> {
    try {
      const messageData = {
        id: message.id,
        from: message.from,
        timestamp: message.timestamp,
        type: message.type,
        text: message.text?.body,
        media: message.image || message.video || message.audio || message.document,
        context: message.context,
        metadata: {
          phoneNumberId: context.metadata?.phone_number_id,
          displayPhoneNumber: context.metadata?.display_phone_number,
        }
      };

      // Emit event for further processing
      this.emit('message', messageData);
    } catch (error) {
      console.error('Error processing incoming message:', error);
      throw error;
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting message status:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string): Promise<any> {
    try {
      const message = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      };

      const response = await this.makeRequest('POST', `/${this.phoneNumberId}/messages`, message);
      return response.data;
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request
   */
  private async makeRequest(method: string, endpoint: string, data?: any, headers?: Record<string, string>): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const requestHeaders = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...headers
    };

    const axios = require('axios');
    const response = await axios({
      method,
      url,
      headers: requestHeaders,
      data
    });

    return response;
  }
}

export default WhatsAppService;
