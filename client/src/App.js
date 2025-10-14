import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { Provider } from 'react-redux';
import { store } from './store';
import { AuthProvider } from './contexts/AuthContext';
import AuthPage from './components/Auth/AuthPage';
import WhatsAppInbox from './components/WhatsAppInbox'; // Import new WhatsApp component
import DemoInbox from './components/DemoInbox'; // Keep DemoInbox for comparison
import UnifiedInbox from './components/UnifiedInbox/UnifiedInbox';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#25D366',
            borderRadius: 8,
          },
        }}
      >
        <AuthProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/inbox" element={<WhatsAppInbox />} />
                <Route path="/demo" element={<DemoInbox />} />
                <Route path="/full-inbox" element={<UnifiedInbox />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/" element={<Navigate to="/inbox" replace />} />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </ConfigProvider>
    </Provider>
  );
}

export default App;