// Message service for handling message persistence and API calls
const API_BASE_URL = 'http://localhost:5001';

class MessageService {
  // Save message to backend
  async saveMessage(message) {
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

      return await response.json();
    } catch (error) {
      console.error('Error saving message to backend:', error);
      // Don't throw error - we still want to save to localStorage
      return null;
    }
  }

  // Load messages from backend
  async loadMessages() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages`);
      
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error loading messages from backend:', error);
      return [];
    }
  }

  // Sync messages with backend
  async syncMessages(messages) {
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

      return await response.json();
    } catch (error) {
      console.error('Error syncing messages with backend:', error);
      return messages; // Return original messages if sync fails
    }
  }

  // Delete message from backend
  async deleteMessage(messageId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting message from backend:', error);
      return null;
    }
  }

  // Update message in backend
  async updateMessage(messageId, updates) {
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

      return await response.json();
    } catch (error) {
      console.error('Error updating message in backend:', error);
      return null;
    }
  }
}

export default new MessageService();
