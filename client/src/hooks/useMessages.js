import { useState, useEffect } from 'react';
import axios from 'axios';

export const useMessages = (provider, accountId, chatId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMessages = async () => {
    if (!provider || !accountId || !chatId) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(
        `/api/channels/${provider}/${accountId}/chats/${chatId}/messages`
      );
      setMessages(response.data.messages || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch messages');
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageData) => {
    try {
      const response = await axios.post(
        `/api/channels/${provider}/${accountId}/chats/${chatId}/send`,
        messageData
      );
      
      // Add the sent message to the list
      const newMessage = {
        id: response.data.message_id,
        direction: 'out',
        body: messageData.body,
        subject: messageData.subject,
        attachments: messageData.attachments || [],
        sent_at: new Date().toISOString(),
        status: 'sent',
      };
      
      setMessages(prev => [...prev, newMessage]);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
      throw err;
    }
  };

  const markAsRead = async (messageIds) => {
    try {
      await axios.post(
        `/api/channels/${provider}/${accountId}/mark-read`,
        { messageIds }
      );
      
      // Update local message status
      setMessages(prev => 
        prev.map(msg => 
          messageIds.includes(msg.id) 
            ? { ...msg, status: 'read', read_at: new Date().toISOString() }
            : msg
        )
      );
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [provider, accountId, chatId]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refetch: fetchMessages,
  };
};
