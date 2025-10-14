import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket && this.isConnected) {
      return;
    }

    this.socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5001', {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.isConnected = false;
    });

    // Set up default event listeners
    this.setupDefaultListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  setupDefaultListeners() {
    // New message received
    this.socket.on('new_message', (message) => {
      this.emit('new_message', message);
    });

    // Message sent confirmation
    this.socket.on('message_sent', (message) => {
      this.emit('message_sent', message);
    });

    // Message read status
    this.socket.on('message_read', (data) => {
      this.emit('message_read', data);
    });

    // User typing indicator
    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      this.emit('error', error);
    });
  }

  // Send message
  sendMessage(messageData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', messageData);
    } else {
      console.error('Socket not connected');
    }
  }

  // Mark message as read
  markAsRead(messageId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_read', { messageId });
    }
  }

  // Typing indicators
  startTyping(threadId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { threadId });
    }
  }

  stopTyping(threadId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { threadId });
    }
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
    };
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
