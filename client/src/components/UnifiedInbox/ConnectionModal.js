import React, { useState } from 'react';
import { Modal, Button, Steps, Typography, Space, Card, message } from 'antd';
import { MessageSquare, Mail, Instagram, CheckCircle, ExternalLink } from 'lucide-react';
import axios from 'axios';

const { Title, Text } = Typography;
const { Step } = Steps;

const ConnectionModal = ({ visible, provider, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState(null);

  const providerInfo = {
    whatsapp: {
      name: 'WhatsApp',
      icon: <MessageSquare size={24} />,
      color: '#25D366',
      description: 'Connect your WhatsApp Business account to send and receive messages',
      features: [
        'Send and receive WhatsApp messages',
        'Manage multiple WhatsApp accounts',
        'Real-time message synchronization',
        'Message history and threading',
      ],
    },
    instagram: {
      name: 'Instagram',
      icon: <Instagram size={24} />,
      color: '#E4405F',
      description: 'Connect your Instagram Business account to manage direct messages',
      features: [
        'Send and receive Instagram DMs',
        'Manage Instagram Business messages',
        'Real-time message updates',
        'Message history and media support',
      ],
    },
    email: {
      name: 'Email',
      icon: <Mail size={24} />,
      color: '#4285F4',
      description: 'Connect your Gmail or Outlook account to manage emails',
      features: [
        'Send and receive emails',
        'Support for Gmail and Outlook',
        'Email threading and organization',
        'Attachment support',
      ],
    },
  };

  const info = providerInfo[provider];

  // Early return if provider is not valid
  if (!provider || !info) {
    return (
      <Modal
        title="Invalid Provider"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={400}
        centered
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Text type="danger">Invalid provider specified</Text>
          <br />
          <Button onClick={onClose} style={{ marginTop: '16px' }}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  const handleConnect = async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const response = await axios.post(`/api/channels/${provider}/connect`, {});
      
      if (response.data.authUrl) {
        setAuthUrl(response.data.authUrl);
        setCurrentStep(1);
      } else {
        // Direct connection success
        onSuccess();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to initiate connection');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthRedirect = () => {
    if (authUrl) {
      window.open(authUrl, '_blank', 'width=600,height=600');
      setCurrentStep(2);
    }
  };

  const handleComplete = () => {
    onSuccess();
  };

  const steps = [
    {
      title: 'Choose Provider',
      description: 'Select the messaging platform to connect',
    },
    {
      title: 'Authorize',
      description: 'Grant permissions to access your account',
    },
    {
      title: 'Complete',
      description: 'Connection established successfully',
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: info.color }}>
              {info.icon}
            </div>
            
            <Title level={3}>
              Connect {info.name}
            </Title>
            
            <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '24px' }}>
              {info.description}
            </Text>

            <Card style={{ textAlign: 'left', marginBottom: '24px' }}>
              <Title level={5}>What you'll get:</Title>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {info.features.map((feature, index) => (
                  <li key={index} style={{ marginBottom: '8px' }}>
                    <CheckCircle size={14} style={{ color: '#52c41a', marginRight: '8px' }} />
                    {feature}
                  </li>
                ))}
              </ul>
            </Card>

            <Space>
              <Button onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                onClick={handleConnect}
                loading={loading}
                style={{ backgroundColor: info.color, borderColor: info.color }}
              >
                Connect {info.name}
              </Button>
            </Space>
          </div>
        );

      case 1:
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: info.color }}>
              {info.icon}
            </div>
            
            <Title level={3}>
              Authorize {info.name}
            </Title>
            
            <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '24px' }}>
              Click the button below to open the authorization page in a new window
            </Text>

            <Card style={{ marginBottom: '24px' }}>
              <Space direction="vertical" size="large">
                <div>
                  <Text strong>Authorization Steps:</Text>
                  <ol style={{ textAlign: 'left', marginTop: '8px' }}>
                    <li>Click "Authorize" to open the {info.name} authorization page</li>
                    <li>Sign in to your {info.name} account</li>
                    <li>Grant the requested permissions</li>
                    <li>Return to this window and click "Complete"</li>
                  </ol>
                </div>
              </Space>
            </Card>

            <Space>
              <Button onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button 
                type="primary" 
                onClick={handleOAuthRedirect}
                icon={<ExternalLink size={16} />}
                style={{ backgroundColor: info.color, borderColor: info.color }}
              >
                Authorize {info.name}
              </Button>
            </Space>
          </div>
        );

      case 2:
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: '#52c41a' }}>
              <CheckCircle />
            </div>
            
            <Title level={3}>
              Connection Complete!
            </Title>
            
            <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '24px' }}>
              Your {info.name} account has been successfully connected
            </Text>

            <Card style={{ marginBottom: '24px' }}>
              <Space direction="vertical" size="large">
                <div>
                  <Text strong>Next Steps:</Text>
                  <ul style={{ textAlign: 'left', marginTop: '8px' }}>
                    <li>Start sending and receiving {info.name} messages</li>
                    <li>Your messages will sync in real-time</li>
                    <li>Access your {info.name} conversations in the unified inbox</li>
                  </ul>
                </div>
              </Space>
            </Card>

            <Button 
              type="primary" 
              onClick={handleComplete}
              style={{ backgroundColor: info.color, borderColor: info.color }}
            >
              Start Messaging
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <div style={{ color: info?.color }}>
            {info?.icon}
          </div>
          <span>Connect {info?.name}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
    >
      <Steps current={currentStep} style={{ marginBottom: '32px' }}>
        {steps.map((step, index) => (
          <Step
            key={index}
            title={step.title}
            description={step.description}
          />
        ))}
      </Steps>

      {renderStepContent()}
    </Modal>
  );
};

export default ConnectionModal;
