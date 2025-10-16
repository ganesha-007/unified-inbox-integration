import crypto from 'crypto';
import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ChannelAccount, ChannelChat, ChannelMessage, ChannelUsage } from '../models';
import UniPileService from '../services/UniPileService';
import EmailService from '../services/EmailService';
import { UniPileWebhookData, ApiResponse } from '../types';

class WebhooksController {
  private io: SocketIOServer;
  private unipileService: UniPileService;
  private emailService: EmailService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.unipileService = new UniPileService();
    this.emailService = new EmailService();
  }

  /**
   * Handle UniPile webhook events
   */
  async handleUniPileWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('Raw webhook body:', JSON.stringify(req.body, null, 2));
      console.log('Webhook headers:', req.headers);
      
      const { event, data } = req.body;
      
      // Verify webhook signature (optional for testing - set UNIPILE_WEBHOOK_SECRET to disable)
      if (process.env.UNIPILE_WEBHOOK_SECRET && !this.verifyUniPileSignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      if (!event) {
        console.log('No event found in webhook body:', req.body);
        res.json({ status: 'success', message: 'No event to process' });
        return;
      }

      switch (event) {
        case 'message.new':
        case 'message_received':
          if (data) {
            await this.handleNewMessage(data);
          } else {
            // Handle direct webhook format (no data wrapper)
            await this.handleNewMessage(req.body);
          }
          break;
        case 'account.updated':
          await this.handleAccountUpdate(data);
          break;
        case 'connection.status':
          await this.handleConnectionStatus(data);
          break;
        default:
          console.log(`Unhandled UniPile event: ${event}`);
      }

      res.json({ status: 'success' });
    } catch (error) {
      console.error('Error handling UniPile webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle new message from UniPile
   */
  private async handleNewMessage(webhookData: UniPileWebhookData): Promise<void> {
    try {
      console.log('Processing new message:', JSON.stringify(webhookData, null, 2));

      const {
        account_id,
        chat_id,
        message,
        message_id,
        sender,
        timestamp,
        attachments = [],
        provider_chat_id,
        provider_message_id
      } = webhookData;

      // Find the account
      const account = await ChannelAccount.findOne({
        where: { externalAccountId: account_id } as any
      });

      if (!account) {
        console.error(`Account not found for connection: ${account_id}`);
        return;
      }

      console.log(`Found account: ${account.id} for user: ${(account as any).user_id}`);

      // Create or find chat
      const [chat] = await ChannelChat.findOrCreate({
        where: {
          accountId: account.id,
          providerChatId: provider_chat_id || chat_id
        },
        defaults: {
          accountId: account.id,
          providerChatId: provider_chat_id || chat_id,
          title: sender?.attendee_name || `Chat ${chat_id}`,
          lastMessageAt: new Date(timestamp),
          chatInfo: {
            original_chat_id: chat_id,
            provider_chat_id: provider_chat_id,
            sender: sender,
            is_group: webhookData.is_group || false,
            folder: webhookData.folder || []
          },
          unreadCount: 0,
          status: 'active'
        }
      });

      // Update chat info if it already existed
      if (!chat.isNewRecord) {
        await chat.update({
          lastMessageAt: new Date(timestamp),
          chatInfo: {
            ...(chat as any).chat_info,
            original_chat_id: chat_id,
            provider_chat_id: provider_chat_id,
            sender: sender,
            is_group: webhookData.is_group || false,
            folder: webhookData.folder || []
          }
        });
      }

      // Create message record
      const messageRecord = await ChannelMessage.create({
        chatId: chat.id,
        providerMsgId: provider_message_id || message_id,
        direction: 'in',
        body: message,
        subject: webhookData.subject || null,
        attachments: attachments,
        sentAt: new Date(timestamp),
        status: 'received',
        providerMetadata: {
          account_id: account_id,
          chat_id: chat_id,
          message_id: message_id,
          sender: sender,
          timestamp: timestamp,
          provider_chat_id: provider_chat_id,
          provider_message_id: provider_message_id,
          is_event: webhookData.is_event || 0,
          quoted: webhookData.quoted,
          chat_content_type: webhookData.chat_content_type,
          message_type: webhookData.message_type,
          is_group: webhookData.is_group || false,
          folder: webhookData.folder || []
        },
        isReply: false,
        syncStatus: 'pending',
        syncAttempts: 0
      });

      // Update usage
      const usage = await ChannelUsage.getOrCreate((account as any).user_id, account.provider);
      await usage.incrementReceived();

      // Emit to user's room via Socket.io
      if (this.io) {
        this.io.to(`user_${(account as any).user_id}`).emit('new_message', {
          id: messageRecord.id,
          text: messageRecord.body,
          from: sender?.attendee_id || 'unknown',
          fromName: sender?.attendee_name || 'Unknown',
          to: (account as any).connection_data?.phone_number || 'unknown',
          timestamp: (messageRecord as any).sent_at,
          direction: 'in',
          chat_id: (messageRecord as any).chat_id,
          provider_msg_id: (messageRecord as any).provider_msg_id,
          subject: messageRecord.subject,
          attachments: messageRecord.attachments,
          status: messageRecord.status,
          provider_metadata: (messageRecord as any).provider_metadata,
          created_at: (messageRecord as any).created_at
        });
      }

      console.log(`Message processed successfully: ${messageRecord.id}`);
    } catch (error) {
      console.error('Error processing new message:', error);
    }
  }

  /**
   * Handle account update from UniPile
   */
  private async handleAccountUpdate(data: any): Promise<void> {
    try {
      console.log('Processing account update:', data);
      
      const { account_id, status, connection_data } = data;
      
      const account = await ChannelAccount.findOne({
        where: { externalAccountId: account_id } as any
      });

      if (account) {
        await account.update({
          status: status === 'connected' ? 'connected' : 'disconnected',
          connectionData: { ...(account as any).connection_data, ...connection_data }
        });
        
        console.log(`Account ${account_id} updated to status: ${status}`);
      }
    } catch (error) {
      console.error('Error processing account update:', error);
    }
  }

  /**
   * Handle connection status from UniPile
   */
  private async handleConnectionStatus(data: any): Promise<void> {
    try {
      console.log('Processing connection status:', data);
      
      const { connection_id, status } = data;
      
      const account = await ChannelAccount.findOne({
        where: { 
          connectionData: {
            connectionId: connection_id
          }
        } as any
      });

      if (account) {
        await account.update({
          status: status === 'connected' ? 'connected' : 'disconnected'
        });
        
        console.log(`Connection ${connection_id} status updated to: ${status}`);
      }
    } catch (error) {
      console.error('Error processing connection status:', error);
    }
  }

  /**
   * Verify UniPile webhook signature
   */
  private verifyUniPileSignature(req: Request): boolean {
    const signature = req.headers['x-unipile-signature'] as string;
    const secret = process.env.UNIPILE_WEBHOOK_SECRET;
    
    if (!signature || !secret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle Gmail webhook events
   */
  async handleGmailWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('Gmail webhook received:', req.body);
      
      // Gmail webhook handling logic here
      // This would typically involve:
      // 1. Verifying the webhook signature
      // 2. Processing the notification
      // 3. Fetching new messages from Gmail API
      // 4. Creating message records in the database
      
      res.json({ status: 'success' });
    } catch (error) {
      console.error('Error handling Gmail webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Microsoft webhook events
   */
  async handleMicrosoftWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('Microsoft webhook received:', req.body);
      
      // Microsoft webhook handling logic here
      // Similar to Gmail webhook handling
      
      res.json({ status: 'success' });
    } catch (error) {
      console.error('Error handling Microsoft webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('Stripe webhook received:', req.body);
      
      // Stripe webhook handling logic here
      // This would typically involve:
      // 1. Verifying the webhook signature
      // 2. Processing subscription events
      // 3. Updating user entitlements
      
      res.json({ status: 'success' });
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Express router setup
  get router() {
    const express = require('express');
    const router = express.Router();

    router.post('/unipile', this.handleUniPileWebhook.bind(this));
    router.post('/gmail', this.handleGmailWebhook.bind(this));
    router.post('/microsoft', this.handleMicrosoftWebhook.bind(this));
    router.post('/stripe', this.handleStripeWebhook.bind(this));

    return router;
  }
}

export default WebhooksController;
