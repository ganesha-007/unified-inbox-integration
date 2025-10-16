import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message } from '../../types';

// Helper functions for localStorage persistence
const STORAGE_KEY = 'whatsapp_messages';

const saveToStorage = (messages: Message[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save messages to localStorage:', error);
  }
};

const loadFromStorage = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const messages = stored ? JSON.parse(stored) : [];
    return messages; // Don't filter here - we'll filter in the UI components
  } catch (error) {
    console.error('Failed to load messages from localStorage:', error);
    return [];
  }
};

interface MessagesState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  replyingTo: Message | null;
  lastSyncTime: string | null;
}

const initialState: MessagesState = {
  messages: loadFromStorage(), // Load messages from localStorage on initialization
  loading: false,
  error: null,
  replyingTo: null,
  lastSyncTime: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    // Add a new message
    addMessage: (state, action: PayloadAction<Partial<Message>>) => {
      console.log('📝 Redux: Adding message to state:', action.payload);
      const newMessage: Message = {
        id: action.payload.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: action.payload.text || '',
        from: action.payload.from || '',
        fromName: action.payload.fromName || 'Unknown',
        to: action.payload.to || '',
        timestamp: action.payload.timestamp || new Date(),
        direction: action.payload.direction || 'in',
        chat_id: action.payload.chat_id,
        provider_msg_id: action.payload.provider_msg_id,
        subject: action.payload.subject,
        attachments: action.payload.attachments,
        status: action.payload.status,
        provider_metadata: action.payload.provider_metadata,
        created_at: action.payload.created_at,
        avatar: action.payload.avatar,
        platform: action.payload.platform,
      };
      
      // Check if message already exists to prevent duplicates
      const exists = state.messages.some(msg => msg.id === newMessage.id);
      if (!exists) {
        state.messages.push(newMessage);
        saveToStorage(state.messages); // Persist to localStorage
        state.lastSyncTime = new Date().toISOString();
        console.log('✅ Redux: Message added to state. Total messages:', state.messages.length);
      } else {
        console.log('⚠️ Redux: Message already exists, skipping');
      }
    },
    
    // Set replying to message
    setReplyingTo: (state, action: PayloadAction<Message | null>) => {
      state.replyingTo = action.payload;
    },
    
    // Clear replying to
    clearReplyingTo: (state) => {
      state.replyingTo = null;
    },
    
    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    
    // Set all messages (for loading from storage)
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
      saveToStorage(state.messages); // Persist to localStorage
      state.lastSyncTime = new Date().toISOString();
    },
    
    // Clear all messages
    clearMessages: (state) => {
      state.messages = [];
      localStorage.removeItem(STORAGE_KEY);
      state.lastSyncTime = new Date().toISOString();
    },
    
    // Update message (for read receipts, etc.)
    updateMessage: (state, action: PayloadAction<{ id: string; updates: Partial<Message> }>) => {
      const { id, updates } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);
      if (messageIndex !== -1) {
        state.messages[messageIndex] = { ...state.messages[messageIndex], ...updates };
        saveToStorage(state.messages); // Persist to localStorage
        state.lastSyncTime = new Date().toISOString();
      }
    },
    
    // Sync messages (merge new messages with existing ones)
    syncMessages: (state, action: PayloadAction<Message[]>) => {
      const newMessages = action.payload;
      const existingIds = new Set(state.messages.map(msg => msg.id));
      
      newMessages.forEach(newMsg => {
        if (!existingIds.has(newMsg.id)) {
          const message: Message = {
            id: newMsg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: newMsg.text,
            from: newMsg.from,
            fromName: newMsg.fromName || 'Unknown',
            to: newMsg.to,
            timestamp: newMsg.timestamp,
            direction: newMsg.direction,
            chat_id: newMsg.chat_id,
            provider_msg_id: newMsg.provider_msg_id,
            subject: newMsg.subject,
            attachments: newMsg.attachments,
            status: newMsg.status,
            provider_metadata: newMsg.provider_metadata,
            created_at: newMsg.created_at,
            avatar: newMsg.avatar,
            platform: newMsg.platform,
          };
          state.messages.push(message);
        }
      });
      
      // Sort messages by timestamp
      state.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      saveToStorage(state.messages); // Persist to localStorage
      state.lastSyncTime = new Date().toISOString();
    },
  },
});

export const {
  addMessage,
  setMessages,
  setReplyingTo,
  clearReplyingTo,
  setLoading,
  setError,
  clearError,
  clearMessages,
  updateMessage,
  syncMessages,
} = messagesSlice.actions;

export default messagesSlice.reducer;
