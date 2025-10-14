import { createAsyncThunk } from '@reduxjs/toolkit';
import messageService from '../../services/messageService';
import { addMessage, setMessages, syncMessages, updateMessage, setLoading, setError } from '../slices/messagesSlice';

// Load messages from backend and sync with localStorage
export const loadMessages = createAsyncThunk(
  'messages/loadMessages',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      // Load from backend
      const backendMessages = await messageService.loadMessages();
      
      // Load from localStorage
      const localMessages = JSON.parse(localStorage.getItem('whatsapp_messages') || '[]');
      
      // Merge messages, prioritizing backend data
      const allMessages = [...localMessages];
      backendMessages.forEach(backendMsg => {
        const exists = allMessages.find(msg => msg.id === backendMsg.id);
        if (!exists) {
          allMessages.push(backendMsg);
        }
      });
      
      // Sort by timestamp
      allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      dispatch(setMessages(allMessages));
      return allMessages;
    } catch (error) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Add message with persistence
export const addMessageWithPersistence = createAsyncThunk(
  'messages/addMessageWithPersistence',
  async (message, { dispatch, rejectWithValue }) => {
    try {
      console.log('🔄 Adding message to Redux store:', message);
      // Add to Redux store (which will save to localStorage)
      dispatch(addMessage(message));
      
      // Also save to backend
      await messageService.saveMessage(message);
      
      console.log('✅ Message added successfully');
      return message;
    } catch (error) {
      console.error('❌ Error adding message:', error);
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);

// Sync messages with backend
export const syncMessagesWithBackend = createAsyncThunk(
  'messages/syncMessagesWithBackend',
  async (messages, { dispatch, rejectWithValue }) => {
    try {
      const syncedMessages = await messageService.syncMessages(messages);
      dispatch(syncMessages(syncedMessages));
      return syncedMessages;
    } catch (error) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);

// Update message with persistence
export const updateMessageWithPersistence = createAsyncThunk(
  'messages/updateMessageWithPersistence',
  async ({ messageId, updates }, { dispatch, rejectWithValue }) => {
    try {
      // Update in Redux store (which will save to localStorage)
      dispatch(updateMessage({ id: messageId, updates }));
      
      // Also update in backend
      await messageService.updateMessage(messageId, updates);
      
      return { messageId, updates };
    } catch (error) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);

// Delete message with persistence
export const deleteMessageWithPersistence = createAsyncThunk(
  'messages/deleteMessageWithPersistence',
  async (messageId, { dispatch, rejectWithValue }) => {
    try {
      // Delete from backend
      await messageService.deleteMessage(messageId);
      
      // Remove from localStorage
      const localMessages = JSON.parse(localStorage.getItem('whatsapp_messages') || '[]');
      const updatedMessages = localMessages.filter(msg => msg.id !== messageId);
      localStorage.setItem('whatsapp_messages', JSON.stringify(updatedMessages));
      
      // Update Redux store
      dispatch(setMessages(updatedMessages));
      
      return messageId;
    } catch (error) {
      dispatch(setError(error.message));
      return rejectWithValue(error.message);
    }
  }
);
