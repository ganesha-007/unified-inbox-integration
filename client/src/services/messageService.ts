// Message service for handling message persistence and API calls
import { Message, ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:5001';

class MessageService {
  // Save message to backend
  async saveMessage(message: Partial<Message>): Promise<Message | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Failed to save message: ${response.statusText}`);
      }

      const result: ApiResponse<Message> = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('Error saving message to backend:', error);
      // Don't throw error - we still want to save to localStorage
      return null;
    }
  }

  // Load messages from backend
  async loadMessages(): Promise<Message[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages`);
      
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const result: ApiResponse<Message[]> = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error loading messages from backend:', error);
      return [];
    }
  }

  // Sync messages with backend
  async syncMessages(messages: Message[]): Promise<Message[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync messages: ${response.statusText}`);
      }

      const result: ApiResponse<Message[]> = await response.json();
      return result.data || messages; // Return original messages if sync fails
    } catch (error) {
      console.error('Error syncing messages with backend:', error);
      return messages; // Return original messages if sync fails
    }
  }

  // Delete message from backend
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      return result.success || false;
    } catch (error) {
      console.error('Error deleting message from backend:', error);
      return false;
    }
  }

  // Update message in backend
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update message: ${response.statusText}`);
      }

      const result: ApiResponse<Message> = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('Error updating message in backend:', error);
      return null;
    }
  }

  // Send message via API
  async sendMessage(content: string, to?: string, fromName?: string): Promise<Message | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to || '919566651479',
          text: content,
          fromName: fromName || 'You'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const result: ApiResponse<{ message: Message }> = await response.json();
      return result.data?.message || null;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }
}

export default new MessageService();
