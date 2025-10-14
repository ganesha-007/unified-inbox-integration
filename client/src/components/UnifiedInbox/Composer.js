import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Space, Typography, message, Tooltip, Progress } from 'antd';
import { Send, Paperclip, Smile } from 'lucide-react';
import { useEmailLimits } from '../../hooks/useEmailLimits';
import './UnifiedInbox.css';

const { TextArea } = Input;
const { Text } = Typography;

const Composer = ({ provider, onSendMessage, chat }) => {
  const [messageText, setMessageText] = useState('');
  const [subject, setSubject] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  // Email limits for email provider
  const { limits, loading: limitsLoading } = useEmailLimits(
    provider === 'email' ? chat?.account_id : null
  );

  const isEmailProvider = provider === 'email';
  const canSend = !sending && messageText.trim() && 
    (isEmailProvider ? to.trim() : true) &&
    (limits ? limits.remainingHour > 0 && limits.remainingDay > 0 : true);

  const handleSend = async () => {
    if (!canSend) return;

    setSending(true);
    try {
      const messageData = {
        body: messageText.trim(),
        attachments,
      };

      if (isEmailProvider) {
        messageData.subject = subject.trim();
        messageData.to = to.trim();
        if (cc.trim()) messageData.cc = cc.trim();
        if (bcc.trim()) messageData.bcc = bcc.trim();
      }

      await onSendMessage(messageData);
      
      // Clear form
      setMessageText('');
      setSubject('');
      setTo('');
      setCc('');
      setBcc('');
      setAttachments([]);
      
      message.success('Message sent successfully!');
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSend();
      }
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      filename: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getSendMeterColor = () => {
    if (!limits) return '#1890ff';
    
    const dayPercent = (limits.usedDay / limits.perDay) * 100;
    const hourPercent = (limits.usedHour / limits.perHour) * 100;
    
    if (dayPercent >= 80 || hourPercent >= 80) return '#ff4d4f';
    if (dayPercent >= 60 || hourPercent >= 60) return '#faad14';
    return '#52c41a';
  };

  const getSendMeterText = () => {
    if (!limits) return '';
    
    const dayPercent = (limits.usedDay / limits.perDay) * 100;
    const hourPercent = (limits.usedHour / limits.perHour) * 100;
    
    if (dayPercent >= 80 || hourPercent >= 80) {
      return 'Approaching daily limit';
    }
    return '';
  };

  return (
    <div className="composer">
      {isEmailProvider && (
        <div className="email-composer">
          <div className="email-fields">
            <div className="email-field">
              <span className="email-field-label">To:</span>
              <input
                className="email-field-input"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="email-field">
              <span className="email-field-label">CC:</span>
              <input
                className="email-field-input"
                placeholder="cc@example.com (optional)"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
            <div className="email-field">
              <span className="email-field-label">BCC:</span>
              <input
                className="email-field-input"
                placeholder="bcc@example.com (optional)"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </div>
            <div className="email-field">
              <span className="email-field-label">Subject:</span>
              <input
                className="email-field-input"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>Attachments:</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {attachments.map((attachment, index) => (
              <div
                key={index}
                style={{
                  background: '#f0f0f0',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>📎 {attachment.filename}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#ff4d4f',
                    fontSize: '12px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmailProvider && limits && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <Text style={{ fontSize: '12px', color: getSendMeterColor() }}>
              {getSendMeterText() || `Emails left today: ${limits.remainingDay} • this hour: ${limits.remainingHour}`}
            </Text>
            <Tooltip title="Daily limit protects deliverability. Limits reset at midnight UTC.">
              <Text type="secondary" style={{ fontSize: '11px' }}>ℹ️</Text>
            </Tooltip>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: '11px' }}>Daily: {limits.usedDay}/{limits.perDay}</Text>
              <Progress
                percent={(limits.usedDay / limits.perDay) * 100}
                size="small"
                strokeColor={getSendMeterColor()}
                showInfo={false}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: '11px' }}>Hourly: {limits.usedHour}/{limits.perHour}</Text>
              <Progress
                percent={(limits.usedHour / limits.perHour) * 100}
                size="small"
                strokeColor={getSendMeterColor()}
                showInfo={false}
              />
            </div>
          </div>
        </div>
      )}

      <div className="composer-input">
        <TextArea
          ref={textareaRef}
          className="composer-textarea"
          placeholder={
            isEmailProvider 
              ? "Type your email message..." 
              : `Type your ${provider} message...`
          }
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={sending}
        />
        
        <div className="composer-actions">
          <input
            type="file"
            id="file-upload"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <label htmlFor="file-upload">
            <Button
              type="text"
              icon={<Paperclip size={16} />}
              style={{ color: '#666' }}
            />
          </label>
          
          <Button
            type="text"
            icon={<Smile size={16} />}
            style={{ color: '#666' }}
          />
          
          <Button
            className="composer-send"
            icon={<Send size={16} />}
            onClick={handleSend}
            disabled={!canSend}
            loading={sending}
          />
        </div>
      </div>
    </div>
  );
};

export default Composer;
