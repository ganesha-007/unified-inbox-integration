const { google } = require('googleapis');
const { Client } = require('@azure/msal-node');
const config = require('../config');

class EmailService {
  constructor() {
    this.gmailConfig = config.platforms.gmail;
    this.microsoftConfig = config.platforms.microsoft;
  }

  /**
   * Initialize Gmail OAuth2 client
   */
  createGmailClient(credentials) {
    const oauth2Client = new google.auth.OAuth2(
      this.gmailConfig.clientId,
      this.gmailConfig.clientSecret,
      this.gmailConfig.redirectUri
    );

    if (credentials.access_token) {
      oauth2Client.setCredentials(credentials);
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Initialize Microsoft Graph client
   */
  createMicrosoftClient(credentials) {
    const msalConfig = {
      auth: {
        clientId: this.microsoftConfig.clientId,
        clientSecret: this.microsoftConfig.clientSecret,
        authority: 'https://login.microsoftonline.com/common',
      },
    };

    const cca = new Client(msalConfig);
    
    if (credentials.access_token) {
      cca.setCredentials(credentials);
    }

    return cca;
  }

  /**
   * Get Gmail authorization URL
   */
  getGmailAuthUrl() {
    const oauth2Client = new google.auth.OAuth2(
      this.gmailConfig.clientId,
      this.gmailConfig.clientSecret,
      this.gmailConfig.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.gmailConfig.scopes,
      prompt: 'consent',
    });

    return authUrl;
  }

  /**
   * Get Microsoft authorization URL
   */
  getMicrosoftAuthUrl() {
    const msalConfig = {
      auth: {
        clientId: this.microsoftConfig.clientId,
        clientSecret: this.microsoftConfig.clientSecret,
        authority: 'https://login.microsoftonline.com/common',
      },
    };

    const cca = new Client(msalConfig);
    
    const authUrl = cca.getAuthCodeUrl({
      scopes: this.microsoftConfig.scopes,
      redirectUri: this.microsoftConfig.redirectUri,
    });

    return authUrl;
  }

  /**
   * Exchange Gmail authorization code for tokens
   */
  async exchangeGmailCode(code) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.gmailConfig.clientId,
        this.gmailConfig.clientSecret,
        this.gmailConfig.redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user info
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date - Date.now(),
        email: profile.data.emailAddress,
        tokens,
      };
    } catch (error) {
      console.error('Error exchanging Gmail code:', error);
      throw error;
    }
  }

  /**
   * Exchange Microsoft authorization code for tokens
   */
  async exchangeMicrosoftCode(code) {
    try {
      const msalConfig = {
        auth: {
          clientId: this.microsoftConfig.clientId,
          clientSecret: this.microsoftConfig.clientSecret,
          authority: 'https://login.microsoftonline.com/common',
        },
      };

      const cca = new Client(msalConfig);
      
      const tokenResponse = await cca.acquireTokenByCode({
        code,
        scopes: this.microsoftConfig.scopes,
        redirectUri: this.microsoftConfig.redirectUri,
      });

      return {
        access_token: tokenResponse.accessToken,
        refresh_token: tokenResponse.refreshToken,
        expires_in: tokenResponse.expiresOn - Date.now(),
        email: tokenResponse.account?.username,
        tokens: tokenResponse,
      };
    } catch (error) {
      console.error('Error exchanging Microsoft code:', error);
      throw error;
    }
  }

  /**
   * Refresh Gmail tokens
   */
  async refreshGmailTokens(credentials) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.gmailConfig.clientId,
        this.gmailConfig.clientSecret,
        this.gmailConfig.redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: credentials.refresh_token,
      });

      const { credentials: newTokens } = await oauth2Client.refreshAccessToken();
      
      return {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || credentials.refresh_token,
        expires_in: newTokens.expiry_date - Date.now(),
        tokens: newTokens,
      };
    } catch (error) {
      console.error('Error refreshing Gmail tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh Microsoft tokens
   */
  async refreshMicrosoftTokens(credentials) {
    try {
      const msalConfig = {
        auth: {
          clientId: this.microsoftConfig.clientId,
          clientSecret: this.microsoftConfig.clientSecret,
          authority: 'https://login.microsoftonline.com/common',
        },
      };

      const cca = new Client(msalConfig);
      
      const tokenResponse = await cca.acquireTokenSilent({
        scopes: this.microsoftConfig.scopes,
        account: credentials.account,
      });

      return {
        access_token: tokenResponse.accessToken,
        refresh_token: tokenResponse.refreshToken,
        expires_in: tokenResponse.expiresOn - Date.now(),
        tokens: tokenResponse,
      };
    } catch (error) {
      console.error('Error refreshing Microsoft tokens:', error);
      throw error;
    }
  }

  /**
   * Get Gmail messages
   */
  async getGmailMessages(credentials, query = '', maxResults = 50) {
    try {
      const gmail = this.createGmailClient(credentials);
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = [];
      for (const message of response.data.messages || []) {
        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });
        
        messages.push(this.normalizeGmailMessage(messageDetail.data));
      }

      return messages;
    } catch (error) {
      console.error('Error getting Gmail messages:', error);
      throw error;
    }
  }

  /**
   * Get Microsoft messages
   */
  async getMicrosoftMessages(credentials, filter = '', top = 50) {
    try {
      const client = this.createMicrosoftClient(credentials);
      
      const response = await client.api('/me/messages').filter(filter).top(top).get();
      
      return response.value.map(message => this.normalizeMicrosoftMessage(message));
    } catch (error) {
      console.error('Error getting Microsoft messages:', error);
      throw error;
    }
  }

  /**
   * Send Gmail message
   */
  async sendGmailMessage(credentials, messageData) {
    try {
      const gmail = this.createGmailClient(credentials);
      
      const message = this.createGmailMessage(messageData);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error sending Gmail message:', error);
      throw error;
    }
  }

  /**
   * Send Microsoft message
   */
  async sendMicrosoftMessage(credentials, messageData) {
    try {
      const client = this.createMicrosoftClient(credentials);
      
      const message = this.createMicrosoftMessage(messageData);
      
      const response = await client.api('/me/sendMail').post({
        message,
        saveToSentItems: true,
      });

      return response;
    } catch (error) {
      console.error('Error sending Microsoft message:', error);
      throw error;
    }
  }

  /**
   * Normalize Gmail message
   */
  normalizeGmailMessage(gmailMessage) {
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    return {
      id: gmailMessage.id,
      provider: 'email',
      direction: 'in',
      body: this.extractGmailBody(gmailMessage.payload),
      subject: getHeader('subject') || '',
      sent_at: new Date(parseInt(gmailMessage.internalDate)),
      provider_msg_id: gmailMessage.id,
      provider_metadata: {
        thread_id: gmailMessage.threadId,
        labels: gmailMessage.labelIds || [],
        snippet: gmailMessage.snippet,
        from: getHeader('from'),
        to: getHeader('to'),
        cc: getHeader('cc'),
        bcc: getHeader('bcc'),
      },
      attachments: this.extractGmailAttachments(gmailMessage.payload),
    };
  }

  /**
   * Normalize Microsoft message
   */
  normalizeMicrosoftMessage(microsoftMessage) {
    return {
      id: microsoftMessage.id,
      provider: 'email',
      direction: 'in',
      body: microsoftMessage.body?.content || '',
      subject: microsoftMessage.subject || '',
      sent_at: new Date(microsoftMessage.receivedDateTime),
      provider_msg_id: microsoftMessage.id,
      provider_metadata: {
        conversation_id: microsoftMessage.conversationId,
        is_read: microsoftMessage.isRead,
        importance: microsoftMessage.importance,
        from: microsoftMessage.from?.emailAddress,
        to: microsoftMessage.toRecipients?.map(r => r.emailAddress),
        cc: microsoftMessage.ccRecipients?.map(r => r.emailAddress),
        bcc: microsoftMessage.bccRecipients?.map(r => r.emailAddress),
      },
      attachments: microsoftMessage.attachments || [],
    };
  }

  /**
   * Extract Gmail message body
   */
  extractGmailBody(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }

    return '';
  }

  /**
   * Extract Gmail attachments
   */
  extractGmailAttachments(payload) {
    const attachments = [];
    
    const extractFromParts = (parts) => {
      for (const part of parts || []) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId,
          });
        }
        if (part.parts) {
          extractFromParts(part.parts);
        }
      }
    };

    extractFromParts(payload.parts);
    return attachments;
  }

  /**
   * Create Gmail message format
   */
  createGmailMessage(messageData) {
    const { to, cc, bcc, subject, body, attachments = [] } = messageData;
    
    let message = `To: ${to}\r\n`;
    if (cc) message += `Cc: ${cc}\r\n`;
    if (bcc) message += `Bcc: ${bcc}\r\n`;
    message += `Subject: ${subject}\r\n`;
    message += `Content-Type: text/html; charset="UTF-8"\r\n`;
    message += `\r\n${body}`;

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Create Microsoft message format
   */
  createMicrosoftMessage(messageData) {
    const { to, cc, bcc, subject, body, attachments = [] } = messageData;
    
    return {
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: cc?.map(email => ({ emailAddress: { address: email } })),
      bccRecipients: bcc?.map(email => ({ emailAddress: { address: email } })),
      attachments: attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.mimeType,
        contentBytes: att.content,
      })),
    };
  }
}

module.exports = EmailService;
