import { google } from 'googleapis';
import { ConfidentialClientApplication } from '@azure/msal-node';
import config from '../config';

interface EmailCredentials {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  attachments?: any[];
}

class EmailService {
  private gmailConfig: any;
  private microsoftConfig: any;

  constructor() {
    this.gmailConfig = config.platforms.gmail;
    this.microsoftConfig = config.platforms.microsoft;
  }

  /**
   * Initialize Gmail OAuth2 client
   */
  createGmailClient(credentials: EmailCredentials): any {
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
  createMicrosoftClient(credentials: EmailCredentials): any {
    const clientConfig = {
      auth: {
        clientId: this.microsoftConfig.clientId,
        clientSecret: this.microsoftConfig.clientSecret,
      },
    };

    const client = new ConfidentialClientApplication(clientConfig);
    return client;
  }

  /**
   * Send email via Gmail
   */
  async sendGmailMessage(credentials: EmailCredentials, messageData: EmailMessage): Promise<any> {
    try {
      const gmail = this.createGmailClient(credentials);
      
      const message = {
        to: messageData.to.join(','),
        subject: messageData.subject,
        text: messageData.body,
      };

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: this.createGmailRawMessage(message),
        },
      });

      return {
        message_id: response.data.id,
        provider: 'gmail',
        status: 'sent',
      };
    } catch (error: any) {
      console.error('Error sending Gmail message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send email via Microsoft Graph
   */
  async sendMicrosoftMessage(credentials: EmailCredentials, messageData: EmailMessage): Promise<any> {
    try {
      const client = this.createMicrosoftClient(credentials);
      
      const message = {
        message: {
          subject: messageData.subject,
          body: {
            contentType: 'Text',
            content: messageData.body,
          },
          toRecipients: messageData.to.map(email => ({
            emailAddress: {
              address: email,
            },
          })),
        },
      };

      // This would require proper Microsoft Graph API implementation
      // For now, returning a mock response
      return {
        message_id: `msg_${Date.now()}`,
        provider: 'microsoft',
        status: 'sent',
      };
    } catch (error: any) {
      console.error('Error sending Microsoft message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send message (generic method)
   */
  async sendMessage(connectionData: any, chatId: string, messageData: { content: string; attachments?: any[] }): Promise<any> {
    try {
      const { provider, credentials } = connectionData;
      
      const emailMessage: EmailMessage = {
        to: [chatId], // chatId would be the email address
        subject: 'Message from Unified Inbox',
        body: messageData.content,
        attachments: messageData.attachments || [],
      };

      if (provider === 'gmail') {
        return await this.sendGmailMessage(credentials, emailMessage);
      } else if (provider === 'microsoft') {
        return await this.sendMicrosoftMessage(credentials, emailMessage);
      } else {
        throw new Error(`Unsupported email provider: ${provider}`);
      }
    } catch (error: any) {
      console.error('Error sending email message:', error);
      throw error;
    }
  }

  /**
   * Create raw Gmail message
   */
  private createGmailRawMessage(message: { to: string; subject: string; text: string }): string {
    const lines = [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.text,
    ];

    const messageString = lines.join('\n');
    return Buffer.from(messageString).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Get Gmail authorization URL
   */
  getGmailAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
      this.gmailConfig.clientId,
      this.gmailConfig.clientSecret,
      this.gmailConfig.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.gmailConfig.scopes,
    });

    return authUrl;
  }

  /**
   * Get Microsoft authorization URL
   */
  getMicrosoftAuthUrl(): string {
    // This would require proper Microsoft Graph implementation
    // For now, returning a placeholder
    return 'https://login.microsoftonline.com/oauth2/v2.0/authorize';
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeGmailCode(code: string): Promise<EmailCredentials> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.gmailConfig.clientId,
        this.gmailConfig.clientSecret,
        this.gmailConfig.redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);
      return tokens as EmailCredentials;
    } catch (error: any) {
      console.error('Error exchanging Gmail code:', error);
      throw error;
    }
  }

  /**
   * Exchange Microsoft authorization code for tokens
   */
  async exchangeMicrosoftCode(code: string): Promise<EmailCredentials> {
    try {
      // This would require proper Microsoft Graph implementation
      // For now, returning mock credentials
      return {
        access_token: `mock_token_${Date.now()}`,
        token_type: 'Bearer',
        expires_in: 3600,
      };
    } catch (error: any) {
      console.error('Error exchanging Microsoft code:', error);
      throw error;
    }
  }
}

export default EmailService;
