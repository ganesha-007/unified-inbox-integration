import { io, Socket } from 'socket.io-client';
import { SocketMessage, SocketTypingEvent } from '../types';

type EventCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private listeners: Map<string, EventCallback[]> = new Map();

  connect(token?: string): void {
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

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  private setupDefaultListeners(): void {
    if (!this.socket) return;

    // New message received
    this.socket.on('new_message', (message: SocketMessage) => {
      this.emit('new_message', message);
    });

    // Message sent confirmation
    this.socket.on('message_sent', (message: SocketMessage) => {
      this.emit('message_sent', message);
    });

    // Message read status
    this.socket.on('message_read', (data: { messageId: string; readAt: Date }) => {
      this.emit('message_read', data);
    });

    // User typing indicator
    this.socket.on('user_typing', (data: SocketTypingEvent) => {
      this.emit('user_typing', data);
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      this.emit('error', error);
    });
  }

  // Send message
  sendMessage(messageData: Partial<SocketMessage>): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', messageData);
    } else {
      console.error('Socket not connected');
    }
  }

  // Join room
  joinRoom(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_room', roomId);
    }
  }

  // Leave room
  leaveRoom(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_room', roomId);
    }
  }

  // Mark message as read
  markAsRead(messageId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_read', { messageId });
    }
  }

  // Typing indicators
  startTyping(threadId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { threadId });
    }
  }

  stopTyping(threadId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { threadId });
    }
  }

  // Event listener management
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Connection status
  getConnectionStatus(): { isConnected: boolean; socketId?: string } {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
    };
  }

  // Get socket instance
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
