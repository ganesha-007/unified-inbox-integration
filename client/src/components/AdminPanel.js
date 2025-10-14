import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, message, Statistic, Row, Col, Divider, Select, InputNumber } from 'antd';
import { DatabaseOutlined, ReloadOutlined, InfoCircleOutlined, SendOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const AdminPanel = () => {
  const [loading, setLoading] = useState(false);
  const [mockDataStatus, setMockDataStatus] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('whatsapp');
  const [intervalMinutes, setIntervalMinutes] = useState(2);
  const [serviceRunning, setServiceRunning] = useState(false);

  const fetchMockDataStatus = async () => {
    try {
      const response = await axios.get('/api/admin/mock-data-status');
      setMockDataStatus(response.data);
    } catch (error) {
      console.error('Error fetching mock data status:', error);
    }
  };

  useEffect(() => {
    fetchMockDataStatus();
  }, []);

  const seedMockData = async () => {
    setLoading(true);
    try {
      await axios.post('/api/admin/seed-mock-data');
      message.success('Mock data seeded successfully!');
      await fetchMockDataStatus();
    } catch (error) {
      console.error('Error seeding mock data:', error);
      message.error('Failed to seed mock data');
    } finally {
      setLoading(false);
    }
  };

  const sendMockMessage = async () => {
    try {
      await axios.post('/api/admin/send-mock-message', { platform: selectedPlatform });
      message.success(`Mock ${selectedPlatform} message sent!`);
      await fetchMockDataStatus();
    } catch (error) {
      console.error('Error sending mock message:', error);
      message.error('Failed to send mock message');
    }
  };

  const toggleMockService = async (action) => {
    try {
      await axios.post(`/api/admin/mock-service/${action}`, { intervalMinutes });
      setServiceRunning(action === 'start');
      message.success(`Mock service ${action}ed successfully!`);
    } catch (error) {
      console.error('Error toggling mock service:', error);
      message.error(`Failed to ${action} mock service`);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <DatabaseOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
            <Title level={2}>Admin Panel</Title>
            <Text type="secondary">Manage mock data for testing</Text>
          </div>

          <Divider />

          {mockDataStatus && (
            <div>
              <Title level={4}>Current Status</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Total Messages"
                    value={mockDataStatus.totalMessages}
                    prefix={<DatabaseOutlined />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Has Mock Data"
                    value={mockDataStatus.hasMockData ? 'Yes' : 'No'}
                    valueStyle={{ color: mockDataStatus.hasMockData ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Platforms"
                    value={mockDataStatus.platformCounts?.length || 0}
                    suffix="connected"
                  />
                </Col>
              </Row>

              {mockDataStatus.platformCounts && mockDataStatus.platformCounts.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <Title level={5}>Messages by Platform</Title>
                  <Row gutter={16}>
                    {mockDataStatus.platformCounts.map((platform, index) => (
                      <Col span={8} key={index}>
                        <Statistic
                          title={platform._id.charAt(0).toUpperCase() + platform._id.slice(1)}
                          value={platform.count}
                        />
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </div>
          )}

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Title level={4}>Mock Data Management</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              This will populate your inbox with sample messages from WhatsApp, Instagram, and Email platforms.
              You can then test the reply functionality and real-time features.
            </Text>
            
            <Space wrap>
              <Button
                type="primary"
                size="large"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={seedMockData}
              >
                Seed Mock Data
              </Button>
              
              <Button
                icon={<InfoCircleOutlined />}
                onClick={fetchMockDataStatus}
              >
                Refresh Status
              </Button>
            </Space>
          </div>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Title level={4}>Real-time Mock Messages</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              Send individual mock messages or start an automated service to receive messages periodically.
            </Text>
            
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space wrap>
                <Select
                  value={selectedPlatform}
                  onChange={setSelectedPlatform}
                  style={{ width: 120 }}
                  options={[
                    { value: 'whatsapp', label: 'WhatsApp' },
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'email', label: 'Email' }
                  ]}
                />
                <Button
                  type="default"
                  icon={<SendOutlined />}
                  onClick={sendMockMessage}
                >
                  Send Mock Message
                </Button>
              </Space>

              <Divider style={{ margin: '16px 0' }} />

              <Space wrap>
                <Text>Auto-send every:</Text>
                <InputNumber
                  min={1}
                  max={60}
                  value={intervalMinutes}
                  onChange={setIntervalMinutes}
                  addonAfter="minutes"
                  style={{ width: 120 }}
                />
                <Button
                  type={serviceRunning ? "default" : "primary"}
                  icon={serviceRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                  onClick={() => toggleMockService(serviceRunning ? 'stop' : 'start')}
                  danger={serviceRunning}
                >
                  {serviceRunning ? 'Stop Service' : 'Start Service'}
                </Button>
              </Space>
            </Space>
          </div>

          <Divider />

          <div style={{ background: '#f6ffed', padding: '16px', borderRadius: '8px', border: '1px solid #b7eb8f' }}>
            <Title level={5} style={{ color: '#389e0d', margin: 0 }}>
              What happens when you seed mock data?
            </Title>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>Creates sample messages from WhatsApp, Instagram, and Email</li>
              <li>Includes conversation threads with replies</li>
              <li>Messages appear in real-time in your unified inbox</li>
              <li>You can reply to messages and test the full flow</li>
              <li>All messages are properly threaded and formatted</li>
            </ul>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default AdminPanel;
