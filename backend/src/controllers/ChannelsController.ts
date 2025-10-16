import { Request, Response } from 'express';
import { ChannelAccount, ChannelChat, ChannelMessage, ChannelUsage } from '../models';
import EntitlementService from '../services/EntitlementService';
import UniPileService from '../services/UniPileService';
import EmailService from '../services/EmailService';
import EmailLimitsService from '../services/EmailLimitsService';
import { Provider, ApiResponse } from '../types';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

class ChannelsController {
  private entitlementService: EntitlementService;
  private unipileService: UniPileService;
  private emailService: EmailService;
  private emailLimitsService: EmailLimitsService;

  constructor() {
    this.entitlementService = new EntitlementService();
    this.unipileService = new UniPileService();
    this.emailService = new EmailService();
    this.emailLimitsService = new EmailLimitsService();
  }

  /**
   * Get connected accounts for a provider
   */
  async getAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { provider } = req.params as { provider: Provider };
      const userId = req.user.userId;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
        return;
      }

      const accounts = await ChannelAccount.findByUserAndProvider(userId, provider);
      
      const response: ApiResponse = {
        success: true,
        data: {
          provider,
          accounts: accounts.map(account => ({
            id: account.id,
            external_account_id: account.externalAccountId,
            status: account.status,
            account_info: account.accountInfo,
            last_sync_at: account.lastSyncAt,
            created_at: account.createdAt,
          })),
        }
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error getting accounts:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Connect a new account for a provider
   */
  async connectAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { provider } = req.params as { provider: Provider };
      const userId = req.user.userId;
      const { connectionData, accountInfo } = req.body;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
        return;
      }

      // Create account record
      const account = await ChannelAccount.create({
        userId,
        provider,
        externalAccountId: connectionData.external_account_id || connectionData.connectionId,
        status: 'connected',
        connectionData,
        accountInfo: accountInfo || {},
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: account.id,
          provider: account.provider,
          status: account.status,
          account_info: account.accountInfo,
        },
        message: 'Account connected successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error connecting account:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Disconnect an account
   */
  async disconnectAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user.userId;

      const account = await ChannelAccount.findOne({
        where: { id: accountId, userId }
      });

      if (!account) {
        res.status(404).json({ 
          success: false,
          error: 'Account not found' 
        });
        return;
      }

      await account.update({ status: 'disconnected' });

      const response: ApiResponse = {
        success: true,
        message: 'Account disconnected successfully'
      };

      res.json(response);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get chats for a connected account
   */
  async getChats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user.userId;

      const account = await ChannelAccount.findOne({
        where: { id: accountId, userId }
      });

      if (!account) {
        res.status(404).json({ 
          success: false,
          error: 'Account not found' 
        });
        return;
      }

      const chats = await ChannelChat.findByAccount(accountId);
      
      const response: ApiResponse = {
        success: true,
        data: {
          account_id: accountId,
          provider: account.provider,
          chats: chats.map(chat => ({
            id: chat.id,
            provider_chat_id: chat.providerChatId,
            title: chat.title,
            last_message_at: chat.lastMessageAt,
            unread_count: chat.unreadCount,
            status: chat.status,
            chat_info: chat.chatInfo,
          })),
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting chats:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get messages for a chat
   */
  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const userId = req.user.userId;

      // Verify chat belongs to user
      const chat = await ChannelChat.findOne({
        where: { id: chatId },
        include: [{
          model: ChannelAccount,
          where: { userId }
        }]
      });

      if (!chat) {
        res.status(404).json({ 
          success: false,
          error: 'Chat not found' 
        });
        return;
      }

      const { rows: messages, count } = await ChannelMessage.findByChat(
        chatId, 
        parseInt(limit as string), 
        parseInt(offset as string)
      );
      
      const response: ApiResponse = {
        success: true,
        data: {
          chat_id: chatId,
          messages: messages.map(message => ({
            id: message.id,
            provider_msg_id: message.providerMsgId,
            direction: message.direction,
            body: message.body,
            subject: message.subject,
            attachments: message.attachments,
            sent_at: message.sentAt,
            status: message.status,
            read_at: message.readAt,
            provider_metadata: message.providerMetadata,
            thread_id: message.threadId,
            is_reply: message.isReply,
          })),
          pagination: {
            total: count,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send a message
   */
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { content, attachments = [] } = req.body;
      const userId = req.user.userId;

      // Verify chat belongs to user
      const chat = await ChannelChat.findOne({
        where: { id: chatId },
        include: [{
          model: ChannelAccount,
          where: { userId }
        }]
      });

      if (!chat) {
        res.status(404).json({ 
          success: false,
          error: 'Chat not found' 
        });
        return;
      }

      const account = (chat as any).account;

      // Check usage limits
      const usage = await ChannelUsage.getOrCreate(userId, account.provider);
      const limits = await this.entitlementService.getLimits(userId, account.provider);
      
      if (usage.messagesSent >= limits.messagesPerMonth) {
        res.status(429).json({ 
          success: false,
          error: 'Monthly message limit exceeded' 
        });
        return;
      }

      let result;
      if (account.provider === 'whatsapp' || account.provider === 'instagram') {
        result = await this.unipileService.sendMessage(
          account.connectionData.connectionId,
          chat.providerChatId,
          { text: content, type: 'text' }
        );
      } else if (account.provider === 'email') {
        result = await this.emailService.sendMessage(
          account.connectionData,
          chat.providerChatId,
          { content, attachments }
        );
      } else {
        res.status(400).json({ 
          success: false,
          error: 'Unsupported provider' 
        });
        return;
      }

      // Create message record
      const message = await ChannelMessage.create({
        chatId,
        providerMsgId: result.message_id || `sent_${Date.now()}`,
        direction: 'out',
        body: content,
        attachments,
        sentAt: new Date(),
        status: 'sent',
        providerMetadata: result,
      });

      // Update usage
      await usage.incrementSent();

      // Update chat last message time
      await chat.updateLastMessage(new Date());

      const response: ApiResponse = {
        success: true,
        data: {
          message: {
            id: message.id,
            provider_msg_id: message.providerMsgId,
            direction: message.direction,
            body: message.body,
            sent_at: message.sentAt,
            status: message.status,
          },
          result
        },
        message: 'Message sent successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get usage statistics
   */
  async getUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user.userId;
      const { period } = req.query;

      const usage = await ChannelUsage.findByUserAndPeriod(userId, period as string);
      
      const response: ApiResponse = {
        success: true,
        data: {
          period: period || ChannelUsage.getCurrentPeriod(),
          usage: usage.map(u => ({
            provider: u.provider,
            messages_sent: u.messagesSent,
            messages_received: u.messagesReceived,
            total_messages: u.getTotalMessages(),
            usage_metrics: u.usageMetrics,
          })),
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting usage:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Express router setup
  get router() {
    const express = require('express');
    const router = express.Router();

    router.get('/:provider/accounts', this.getAccounts.bind(this));
    router.post('/:provider/accounts', this.connectAccount.bind(this));
    router.delete('/accounts/:accountId', this.disconnectAccount.bind(this));
    router.get('/accounts/:accountId/chats', this.getChats.bind(this));
    router.get('/chats/:chatId/messages', this.getMessages.bind(this));
    router.post('/chats/:chatId/messages', this.sendMessage.bind(this));
    router.get('/usage', this.getUsage.bind(this));

    return router;
  }
}

export default ChannelsController;
