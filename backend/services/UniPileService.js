const axios = require('axios');
const config = require('../config');

class UniPileService {
  constructor() {
    this.apiKey = config.platforms.unipile.apiKey;
    this.baseUrl = config.platforms.unipile.baseUrl;
    this.dsn = config.platforms.unipile.dsn;
    this.headers = {
      'X-API-KEY': this.apiKey,
      'accept': 'application/json',
    };
  }

  /**
   * Get all accounts
   */
  async getAccounts() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/accounts`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting accounts:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initialize connection for WhatsApp or Instagram
   */
  async initializeConnection(provider, credentials = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/accounts`,
        {
          provider,
          credentials,
        },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(`Error initializing ${provider} connection:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(connectionId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${connectionId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting connection status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get chats for a connection
   */
  async getChats(connectionId, limit = 50, offset = 0) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${connectionId}/chats`,
        {
          headers: this.headers,
          params: { limit, offset },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting chats:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get messages for a chat
   */
  async getMessages(connectionId, chatId, limit = 50, offset = 0) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${connectionId}/chats/${chatId}/messages`,
        {
          headers: this.headers,
          params: { limit, offset },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting messages:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(connectionId, to, messageData) {
    try {
      const messageText = messageData.content?.text || messageData.text || messageData.message;
      
      // First, try to create a chat and send the message in one call
      // This is the correct UniPile API approach
      const response = await axios.post(
        `${this.baseUrl}/api/v1/chats`,
        {
          account_id: connectionId,
          text: messageText,
          attendees_ids: to
        },
        { 
          headers: {
            ...this.headers,
            'content-type': 'multipart/form-data'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(connectionId, chatId, messageIds) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/accounts/${connectionId}/chats/${chatId}/read`,
        { messageIds },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error marking messages as read:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload attachment
   */
  async uploadAttachment(connectionId, fileData) {
    try {
      const formData = new FormData();
      formData.append('file', fileData);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/accounts/${connectionId}/attachments`,
        formData,
        {
          headers: {
            ...this.headers,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Disconnect a connection
   */
  async disconnect(connectionId) {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/api/v1/accounts/${connectionId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error disconnecting:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get webhook events
   */
  async getWebhookEvents(connectionId, limit = 100) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/connections/${connectionId}/events`,
        {
          headers: this.headers,
          params: { limit },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting webhook events:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Normalize message data from UniPile
   */
  normalizeMessage(unipileMessage, provider) {
    return {
      id: unipileMessage.id,
      provider,
      direction: unipileMessage.direction || 'in',
      body: unipileMessage.content?.text || unipileMessage.body || '',
      subject: unipileMessage.subject || null,
      attachments: unipileMessage.attachments || [],
      sent_at: new Date(unipileMessage.timestamp || unipileMessage.sent_at),
      provider_msg_id: unipileMessage.id,
      provider_metadata: {
        chat_id: unipileMessage.chat_id,
        message_type: unipileMessage.type,
        ...unipileMessage.metadata,
      },
    };
  }

  /**
   * Normalize chat data from UniPile
   */
  normalizeChat(unipileChat, provider) {
    return {
      provider_chat_id: unipileChat.id,
      title: unipileChat.name || unipileChat.title || 'Unknown Chat',
      last_message_at: unipileChat.last_message_at ? new Date(unipileChat.last_message_at) : null,
      chat_info: {
        participants: unipileChat.participants || [],
        type: unipileChat.type || 'direct',
        ...unipileChat.metadata,
      },
      unread_count: unipileChat.unread_count || 0,
    };
  }
}

module.exports = UniPileService;
