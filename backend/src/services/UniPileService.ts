import axios, { AxiosResponse } from 'axios';
import config from '../config';
import { UniPileConfig } from '../types';

interface UniPileAccount {
  id: string;
  provider: string;
  status: string;
  credentials: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface UniPileMessage {
  id: string;
  account_id: string;
  chat_id: string;
  message: string;
  sender: {
    attendee_id: string;
    attendee_name: string;
  };
  timestamp: string;
  attachments?: any[];
}

interface UniPileResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class UniPileService {
  private apiKey: string;
  private baseUrl: string;
  private dsn: string;
  private headers: Record<string, string>;

  constructor() {
    this.apiKey = config.platforms.unipile.apiKey || '';
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
  async getAccounts(): Promise<UniPileAccount[]> {
    try {
      const response: AxiosResponse<UniPileResponse<UniPileAccount[]>> = await axios.get(
        `${this.baseUrl}/api/v1/accounts`,
        { headers: this.headers }
      );

      return response.data.data || [];
    } catch (error: any) {
      console.error('Error getting accounts:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initialize connection for WhatsApp or Instagram
   */
  async initializeConnection(provider: string, credentials: Record<string, any> = {}): Promise<UniPileAccount> {
    try {
      const response: AxiosResponse<UniPileResponse<UniPileAccount>> = await axios.post(
        `${this.baseUrl}/api/v1/accounts`,
        {
          provider,
          credentials,
        },
        { headers: this.headers }
      );

      if (!response.data.data) {
        throw new Error('No account data returned from UniPile');
      }

      return response.data.data;
    } catch (error: any) {
      console.error(`Error initializing ${provider} connection:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get account details
   */
  async getAccount(accountId: string): Promise<UniPileAccount> {
    try {
      const response: AxiosResponse<UniPileResponse<UniPileAccount>> = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${accountId}`,
        { headers: this.headers }
      );

      if (!response.data.data) {
        throw new Error('No account data returned from UniPile');
      }

      return response.data.data;
    } catch (error: any) {
      console.error(`Error getting account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get chats for an account
   */
  async getChats(accountId: string): Promise<any[]> {
    try {
      const response: AxiosResponse<UniPileResponse<any[]>> = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${accountId}/chats`,
        { headers: this.headers }
      );

      return response.data.data || [];
    } catch (error: any) {
      console.error(`Error getting chats for account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get messages for a chat
   */
  async getMessages(accountId: string, chatId: string, limit: number = 50, offset: number = 0): Promise<UniPileMessage[]> {
    try {
      const response: AxiosResponse<UniPileResponse<UniPileMessage[]>> = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${accountId}/chats/${chatId}/messages`,
        { 
          headers: this.headers,
          params: { limit, offset }
        }
      );

      return response.data.data || [];
    } catch (error: any) {
      console.error(`Error getting messages for chat ${chatId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(accountId: string, chatId: string, messageData: { text: string; type: string }): Promise<any> {
    try {
      const response: AxiosResponse<UniPileResponse<any>> = await axios.post(
        `${this.baseUrl}/api/v1/accounts/${accountId}/chats/${chatId}/messages`,
        messageData,
        { headers: this.headers }
      );

      return response.data.data || response.data;
    } catch (error: any) {
      console.error(`Error sending message to chat ${chatId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete an account
   */
  async deleteAccount(accountId: string): Promise<boolean> {
    try {
      await axios.delete(
        `${this.baseUrl}/api/v1/accounts/${accountId}`,
        { headers: this.headers }
      );

      return true;
    } catch (error: any) {
      console.error(`Error deleting account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update account credentials
   */
  async updateAccount(accountId: string, credentials: Record<string, any>): Promise<UniPileAccount> {
    try {
      const response: AxiosResponse<UniPileResponse<UniPileAccount>> = await axios.put(
        `${this.baseUrl}/api/v1/accounts/${accountId}`,
        { credentials },
        { headers: this.headers }
      );

      if (!response.data.data) {
        throw new Error('No account data returned from UniPile');
      }

      return response.data.data;
    } catch (error: any) {
      console.error(`Error updating account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get account status
   */
  async getAccountStatus(accountId: string): Promise<string> {
    try {
      const account = await this.getAccount(accountId);
      return account.status;
    } catch (error: any) {
      console.error(`Error getting account status for ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccounts();
      return true;
    } catch (error: any) {
      console.error('UniPile connection test failed:', error.response?.data || error.message);
      return false;
    }
  }
}

export default UniPileService;
