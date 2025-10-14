import React, { useEffect, useRef } from 'react';
import { Typography, Button, Space, Avatar } from 'antd';
import { MoreVertical, Phone, Video, Info } from 'lucide-react';
import { useMessages } from '../../hooks/useMessages';
import Composer from './Composer';
import './UnifiedInbox.css';

const { Title, Text } = Typography;

const Conversation = ({ chat, provider }) => {
  const { messages, loading, sendMessage, markAsRead } = useMessages(
    provider,
    chat.account_id,
    chat.id
  );
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mark unread messages as read when conversation is opened
    const unreadMessages = messages.filter(msg => 
      msg.direction === 'in' && msg.status !== 'read'
    );
    
    if (unreadMessages.length > 0) {
      markAsRead(unreadMessages.map(msg => msg.id));
    }
  }, [messages, markAsRead]);

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = async (messageData) => {
    try {
      await sendMessage(messageData);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'whatsapp':
        return '💬';
      case 'instagram':
        return '📸';
      case 'email':
        return '📧';
      default:
        return '💬';
    }
  };

  return (
    <div className="conversation">
      <div className="conversation-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar 
            size="large" 
            style={{ backgroundColor: '#1890ff' }}
          >
            {getProviderIcon(provider)}
          </Avatar>
          <div>
            <Title level={4} className="conversation-title" style={{ margin: 0 }}>
              {chat.title || 'Unknown Chat'}
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {chat.account_info?.name || chat.account_info?.email || 'Unknown Account'}
            </Text>
          </div>
        </div>
        
        <div className="conversation-actions">
          <Space>
            {provider === 'whatsapp' && (
              <>
                <Button type="text" icon={<Phone size={16} />} />
                <Button type="text" icon={<Video size={16} />} />
              </>
            )}
            <Button type="text" icon={<Info size={16} />} />
            <Button type="text" icon={<MoreVertical size={16} />} />
          </Space>
        </div>
      </div>

      <div className="conversation-messages">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Text type="secondary">Loading messages...</Text>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">No messages yet</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Start the conversation by sending a message
            </Text>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.direction}`}
            >
              <div className="message-bubble">
                {message.subject && (
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '4px',
                    fontSize: '12px',
                    opacity: 0.8
                  }}>
                    {message.subject}
                  </div>
                )}
                <div>{message.body}</div>
                {message.attachments && message.attachments.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {message.attachments.map((attachment, index) => (
                      <div key={index} style={{ 
                        padding: '4px 8px', 
                        background: 'rgba(0,0,0,0.1)', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        marginTop: '4px'
                      }}>
                        📎 {attachment.filename || 'Attachment'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="message-time">
                {formatMessageTime(message.sent_at)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <Composer
        provider={provider}
        onSendMessage={handleSendMessage}
        chat={chat}
      />
    </div>
  );
};

export default Conversation;
