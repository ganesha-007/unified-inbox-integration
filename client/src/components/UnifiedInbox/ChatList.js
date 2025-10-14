import React, { useState, useEffect } from 'react';
import { List, Avatar, Typography, Empty, Spin } from 'antd';
import { MessageSquare, Mail, Instagram } from 'lucide-react';
import { useConnections } from '../../hooks/useConnections';
import './UnifiedInbox.css';

const { Text } = Typography;

const ChatList = ({ provider, selectedChat, onChatSelect }) => {
  const { connections } = useConnections();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);

  const providerConnections = connections.filter(conn => 
    conn.provider === provider && conn.status === 'connected'
  );

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'whatsapp':
        return <MessageSquare size={16} />;
      case 'instagram':
        return <Instagram size={16} />;
      case 'email':
        return <Mail size={16} />;
      default:
        return <MessageSquare size={16} />;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const fetchChats = async () => {
    if (providerConnections.length === 0) {
      setChats([]);
      return;
    }

    setLoading(true);
    try {
      const allChats = [];
      
      for (const connection of providerConnections) {
        try {
          const response = await fetch(`/api/channels/${provider}/${connection.id}/chats`);
          const data = await response.json();
          
          if (data.chats) {
            const connectionChats = data.chats.map(chat => ({
              ...chat,
              account_id: connection.id,
              account_info: connection.account_info,
            }));
            allChats.push(...connectionChats);
          }
        } catch (error) {
          console.error(`Error fetching chats for ${connection.id}:`, error);
        }
      }
      
      // Sort by last message time
      allChats.sort((a, b) => 
        new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
      );
      
      setChats(allChats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [provider, providerConnections]);

  if (providerConnections.length === 0) {
    return (
      <div className="chat-list">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text type="secondary">No {provider} accounts connected</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Connect an account to start messaging
                </Text>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chat-list">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="chat-list">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No conversations yet"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-list">
      <List
        dataSource={chats}
        renderItem={(chat) => (
          <List.Item
            className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
            onClick={() => onChatSelect(chat)}
            style={{ padding: 0 }}
          >
            <div style={{ width: '100%', padding: '12px 16px' }}>
              <div className="chat-item-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar 
                    size="small" 
                    icon={getProviderIcon(provider)}
                    style={{ backgroundColor: '#1890ff' }}
                  />
                  <Text strong className="chat-item-title">
                    {chat.title || 'Unknown Chat'}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {chat.unread_count > 0 && (
                    <div className="chat-item-unread">
                      {chat.unread_count}
                    </div>
                  )}
                  <Text className="chat-item-time">
                    {formatTime(chat.last_message_at)}
                  </Text>
                </div>
              </div>
              
              {chat.account_info && (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {chat.account_info.name || chat.account_info.email}
                </Text>
              )}
            </div>
          </List.Item>
        )}
      />
    </div>
  );
};

export default ChatList;
