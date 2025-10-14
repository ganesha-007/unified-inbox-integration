import React, { useState } from 'react';
import { Layout, Tabs } from 'antd';
import { UserOutlined, UserAddOutlined } from '@ant-design/icons';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const { Content } = Layout;

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState('login');    

  const tabItems = [
    {
      key: 'login',
      label: (
        <span>
          <UserOutlined />
          Sign In
        </span>
      ),
      children: <LoginForm onSwitchToRegister={() => setActiveTab('register')} />,
    },
    {
      key: 'register',
      label: (
        <span>
          <UserAddOutlined />
          Sign Up
        </span>
      ),
      children: <RegisterForm onSwitchToLogin={() => setActiveTab('login')} />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Content
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 500 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            centered
            size="large"
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          />
        </div>
      </Content>
    </Layout>
  );
};

export default AuthPage;
