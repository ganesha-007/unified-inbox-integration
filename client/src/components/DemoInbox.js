import React, { useState, useEffect } from 'react';
import { Layout, Card, Typography, Space, Button, message as antdMessage, List, Avatar, Input, Badge } from 'antd';
import { MessageSquare, Send, Phone, Reply, User } from 'lucide-react';
import io from 'socket.io-client';
import './DemoInbox.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

const DemoInbox = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to Socket.io
    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('new_message', (message) => {
      console.log('New message received:', message);
      setMessages(prev => [...prev, {
        id: message.id || Date.now(),
        text: message.text,
        from: message.from,
        fromName: message.fromName || 'Unknown',
        to: message.to,
        timestamp: message.timestamp,
        direction: 'in'
      }]);
    });

    newSocket.on('message_sent', (message) => {
      console.log('Message sent confirmation:', message);
      // Don't add duplicate messages - the sendMessage function already handles this
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Store the original message for error handling
    const originalMessage = newMessage;
    
    // Clean the message text - remove any "Replying to..." prefix if it exists
    let messageText = newMessage.trim();
    if (messageText.startsWith('Replying to ')) {
      // Find the colon and take everything after it
      const colonIndex = messageText.indexOf(':');
      if (colonIndex !== -1) {
        messageText = messageText.substring(colonIndex + 1).trim();
      }
    }
    
    const targetRecipient = replyingTo ? replyingTo.from : '1234567890';
    
    // Clear the input immediately for better UX
    setNewMessage('');
    setReplyingTo(null);

    try {
      // Show loading state
      antdMessage.loading('Sending message...', 0);
      
      // Call the backend API to send the message
      const response = await fetch('http://localhost:5001/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: targetRecipient,
          message: messageText,
          replyTo: replyingTo ? replyingTo.id : null
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Add the sent message to the local state
        setMessages(prev => [...prev, {
          id: result.data.id,
          text: result.data.text,
          from: result.data.from,
          to: result.data.to,
          fromName: 'You',
          timestamp: result.data.timestamp,
          direction: 'out',
          replyTo: result.data.replyTo
        }]);
        
        antdMessage.destroy();
        antdMessage.success(`Message sent to ${replyingTo ? replyingTo.fromName : 'recipient'}!`);
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      antdMessage.destroy();
      antdMessage.error(`Failed to send message: ${error.message}`);
      
      // Restore the message in the input if sending failed
      setNewMessage(originalMessage); // Use the original message, not the cleaned one
      if (replyingTo) {
        setReplyingTo(replyingTo);
      }
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setNewMessage(''); // Don't include the reply prefix in the input
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Layout className="demo-inbox">
      <Header className="demo-header">
        <div className="header-content">
          <div className="header-left">
            <Space>
              <MessageSquare size={24} style={{ color: '#25D366' }} />
              <div>
                <Title level={3} style={{ margin: 0, color: 'white' }}>
                  WhatsApp Demo
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Real-time WhatsApp Integration
                </Text>
              </div>
            </Space>
          </div>
          <div className="header-right">
            <Space>
              <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
                <div className="status-dot" />
                <Text style={{ color: 'white', fontSize: '12px' }}>
                  {connected ? 'Connected' : 'Disconnected'}
                </Text>
              </div>
              <Text style={{ color: 'white' }}>
                Account: 919566651479
              </Text>
            </Space>
          </div>
        </div>
      </Header>

      <Content className="demo-content">
        <div className="demo-container">
          <Card className="chat-card">
            <div className="chat-header">
              <Space>
                <Avatar 
                  size={40} 
                  style={{ backgroundColor: '#25D366' }}
                  icon={<Phone size={20} />}
                />
                <div>
                  <Title level={5} style={{ margin: 0 }}>
                    WhatsApp Integration
                  </Title>
                  <Text type="secondary">
                    Send a message to 919566651479 to see it here
                  </Text>
                </div>
              </Space>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <MessageSquare size={48} style={{ color: '#d9d9d9' }} />
                  <Title level={4} type="secondary">
                    No messages yet
                  </Title>
                  <Text type="secondary">
                    Send a WhatsApp message to 919566651479 to see it appear here in real-time!
                  </Text>
                </div>
              ) : (
                <List
                  dataSource={messages}
                  renderItem={(msg) => (
                    <List.Item className={`message-item ${msg.direction}`}>
                      <div className="message-bubble">
                        {msg.direction === 'in' && (
                          <div className="message-header">
                            <Space>
                              <Avatar 
                                size={24} 
                                style={{ backgroundColor: '#25D366' }}
                                icon={<User size={12} />}
                              />
                              <Text strong style={{ fontSize: '12px' }}>
                                {msg.fromName || 'Unknown'}
                              </Text>
                              <Text type="secondary" style={{ fontSize: '11px' }}>
                                {msg.from}
                              </Text>
                            </Space>
                          </div>
                        )}
                        {msg.direction === 'out' && msg.replyTo && (
                          <div className="reply-context">
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Replying to previous message
                            </Text>
                          </div>
                        )}
                        <div className="message-text">{msg.text}</div>
                        <div className="message-footer">
                          <div className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                          {msg.direction === 'in' && (
                            <Button
                              type="text"
                              size="small"
                              icon={<Reply size={12} />}
                              onClick={() => handleReply(msg)}
                              style={{ 
                                color: '#25D366',
                                fontSize: '11px',
                                height: '20px',
                                padding: '0 4px'
                              }}
                            >
                              Reply
                            </Button>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>

            <div className="message-input">
              {replyingTo && (
                <div className="reply-indicator">
                  <Space>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Replying to {replyingTo.fromName}:
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      onClick={cancelReply}
                      style={{ color: '#ff4d4f', fontSize: '11px' }}
                    >
                      Cancel
                    </Button>
                  </Space>
                </div>
              )}
              <Space.Compact style={{ width: '100%' }}>
                <TextArea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={replyingTo ? `Reply to ${replyingTo.fromName}...` : "Type a message..."}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ resize: 'none' }}
                />
                <Button 
                  type="primary" 
                  icon={<Send size={16} />}
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  Send
                </Button>
              </Space.Compact>
            </div>
          </Card>

          <Card className="info-card">
            <Title level={4}>How to Test</Title>
            <div className="test-steps">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <Text strong>Send a WhatsApp message</Text>
                  <br />
                  <Text type="secondary">Send any message to: 919566651479</Text>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <Text strong>Watch it appear here</Text>
                  <br />
                  <Text type="secondary">The message will show up in real-time</Text>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <Text strong>Check server logs</Text>
                  <br />
                  <Text type="secondary">See the webhook processing in your terminal</Text>
                </div>
              </div>
            </div>

            <div className="status-info">
              <Title level={5}>Integration Status</Title>
              <div className="status-item">
                <Text strong>Backend Server:</Text>
                <Text type="success" style={{ marginLeft: '8px' }}>✅ Running</Text>
              </div>
              <div className="status-item">
                <Text strong>Webhook Endpoint:</Text>
                <Text type="success" style={{ marginLeft: '8px' }}>✅ Active</Text>
              </div>
              <div className="status-item">
                <Text strong>UniPile Connection:</Text>
                <Text type="success" style={{ marginLeft: '8px' }}>✅ Connected</Text>
              </div>
              <div className="status-item">
                <Text strong>Real-time Updates:</Text>
                <Text type={connected ? 'success' : 'danger'} style={{ marginLeft: '8px' }}>
                  {connected ? '✅ Connected' : '❌ Disconnected'}
                </Text>
              </div>
            </div>
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default DemoInbox;
