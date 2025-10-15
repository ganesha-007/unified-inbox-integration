const crypto = require('crypto');
const { ChannelAccount, ChannelChat, ChannelMessage, ChannelUsage } = require('../models');
const UniPileService = require('../services/UniPileService');
const EmailService = require('../services/EmailService');

class WebhooksController {
  constructor(io) {
    this.io = io;
    this.unipileService = new UniPileService();
    this.emailService = new EmailService();
  }

  /**
   * Handle UniPile webhook events
   */
  async handleUniPileWebhook(req, res) {
    try {
      console.log('Raw webhook body:', JSON.stringify(req.body, null, 2));
      console.log('Webhook headers:', req.headers);
      
      const { event, data } = req.body;
      
      // Verify webhook signature (optional for testing - set UNIPILE_WEBHOOK_SECRET to disable)
      if (process.env.UNIPILE_WEBHOOK_SECRET && !this.verifyUniPileSignature(req)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      if (!event) {
        console.log('No event found in webhook body:', req.body);
        return res.json({ status: 'success', message: 'No event to process' });
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
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle email webhook events (Gmail/Outlook)
   */
  async handleEmailWebhook(req, res) {
    try {
      const { provider, event, data } = req.body;
      
      // Verify webhook signature
      if (!this.verifyEmailSignature(req, provider)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      switch (event) {
        case 'message.received':
          await this.handleEmailMessage(data, provider);
          break;
        case 'message.read':
          await this.handleEmailRead(data, provider);
          break;
        default:
          console.log(`Unhandled email event: ${event}`);
      }

      res.json({ status: 'success' });
    } catch (error) {
      console.error('Error handling email webhook:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(req, res) {
    try {
      const { type, data } = req.body;
      
      // Verify Stripe signature
      if (!this.verifyStripeSignature(req)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      switch (type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(data.object);
          break;
        default:
          console.log(`Unhandled Stripe event: ${type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle new message from UniPile
   */
  async handleNewMessage(data) {
    try {
      console.log('Processing new message with data:', JSON.stringify(data, null, 2));
      
      // Handle different data structures
      let connectionId, message;
      
      if (data.connectionId && data.message) {
        // Direct structure: { connectionId, message }
        connectionId = data.connectionId;
        message = data.message;
      } else if (data.connection_id && data.message) {
        // Alternative structure: { connection_id, message }
        connectionId = data.connection_id;
        message = data.message;
      } else if (data.message && data.message.connectionId) {
        // Message contains connectionId
        connectionId = data.message.connectionId;
        message = data.message;
      } else if (data.account_id && data.message) {
        // Real UniPile format: { account_id, message, sender, etc. }
        connectionId = data.account_id;
            message = {
              id: data.message_id,
              body: data.message,
              from: data.sender?.attendee_provider_id || data.sender?.attendee_id,
              to: data.provider_chat_id,
              timestamp: data.timestamp,
              chat_id: data.chat_id,
              subject: data.subject,
              attachments: data.attachments || [],
              sender: data.sender // Add sender object
            };
      } else {
        console.error('Invalid data structure for new message:', data);
        return;
      }

      if (!connectionId) {
        console.error('No connectionId found in data:', data);
        return;
      }
      
      // Find the account by connection ID
      let account = await ChannelAccount.findOne({
        where: { 
          'connection_data.connectionId': connectionId 
        },
      });

      // If not found by connectionId, try by external_account_id
      if (!account) {
        account = await ChannelAccount.findOne({
          where: { 
            external_account_id: connectionId 
          },
        });
      }

      if (!account) {
        console.error(`Account not found for connection: ${connectionId}`);
        console.log('Available accounts:', await ChannelAccount.findAll({ attributes: ['id', 'provider', 'external_account_id', 'connection_data'] }));
        return;
      }

      // Normalize message
      const normalizedMessage = this.unipileService.normalizeMessage(message, account.provider);
      
      // Create unique chat identifier using phone number
      const phoneNumber = normalizedMessage.provider_metadata.phone_number;
      
      // Skip processing if it's from own phone number
      const ownPhoneNumber = process.env.WHATSAPP_ACCOUNT_NUMBER || '919566651479';
      if (phoneNumber === ownPhoneNumber) {
        console.log(`Skipping webhook processing for own phone number: ${phoneNumber}`);
        return;
      }
      
      const uniqueChatId = `${phoneNumber}_${account.provider}`;
      
      // Find or create chat based on phone number
      const [chat, created] = await ChannelChat.findOrCreate({
        where: {
          account_id: account.id,
          provider_chat_id: uniqueChatId,
        },
        defaults: {
          account_id: account.id,
          provider_chat_id: uniqueChatId,
          title: normalizedMessage.provider_metadata.fromName || `Chat ${phoneNumber}`,
          last_message_at: normalizedMessage.sent_at,
          unread_count: 1,
          chat_info: {
            original_chat_id: normalizedMessage.provider_metadata.chat_id,
            phone_number: phoneNumber,
            from: normalizedMessage.provider_metadata.from,
          },
        },
      });

      if (!created) {
        chat.last_message_at = normalizedMessage.sent_at;
        chat.unread_count += 1;
        // Update chat title if we have a better name
        if (normalizedMessage.provider_metadata.fromName && chat.title.startsWith('Chat ')) {
          chat.title = normalizedMessage.provider_metadata.fromName;
        }
        // Update chat info with latest metadata
        chat.chat_info = {
          ...chat.chat_info,
          original_chat_id: normalizedMessage.provider_metadata.chat_id,
          phone_number: phoneNumber,
          from: normalizedMessage.provider_metadata.from,
        };
        await chat.save();
      }

      // Create message
      const newMessage = await ChannelMessage.create({
        chat_id: chat.id,
        provider_msg_id: normalizedMessage.provider_msg_id,
        direction: normalizedMessage.direction,
        body: normalizedMessage.body,
        subject: normalizedMessage.subject,
        attachments: normalizedMessage.attachments,
        sent_at: normalizedMessage.sent_at,
        status: 'received',
        provider_metadata: normalizedMessage.provider_metadata,
      });

      // Update usage
      await this.updateUsage(account.user_id, account.provider, 'received');

      // Emit real-time update
      this.emitMessageUpdate(account.user_id, newMessage);

    } catch (error) {
      console.error('Error handling new message:', error);
      throw error; // Re-throw to see the error in webhook response
    }
  }

  /**
   * Handle account update from UniPile
   */
  async handleAccountUpdate(data) {
    try {
      const { connectionId, status, accountInfo } = data;
      
      const account = await ChannelAccount.findOne({
        where: { 
          'connection_data.connectionId': connectionId 
        },
      });

      if (!account) {
        console.error(`Account not found for connection: ${connectionId}`);
        return;
      }

      account.status = status === 'connected' ? 'connected' : 'disconnected';
      account.account_info = { ...account.account_info, ...accountInfo };
      await account.save();

      console.log(`Account updated: ${account.id} - ${status}`);
    } catch (error) {
      console.error('Error handling account update:', error);
    }
  }

  /**
   * Handle connection status change
   */
  async handleConnectionStatus(data) {
    try {
      const { connectionId, status } = data;
      
      const account = await ChannelAccount.findOne({
        where: { 
          'connection_data.connectionId': connectionId 
        },
      });

      if (!account) {
        console.error(`Account not found for connection: ${connectionId}`);
        return;
      }

      account.status = status;
      await account.save();

      console.log(`Connection status updated: ${account.id} - ${status}`);
    } catch (error) {
      console.error('Error handling connection status:', error);
    }
  }

  /**
   * Handle email message received
   */
  async handleEmailMessage(data, provider) {
    try {
      const { messageId, accountId } = data;
      
      const account = await ChannelAccount.findOne({
        where: { 
          id: accountId,
          provider: 'email'
        },
      });

      if (!account) {
        console.error(`Email account not found: ${accountId}`);
        return;
      }

      // Get message details from provider
      let messageData;
      if (provider === 'gmail') {
        const gmail = this.emailService.createGmailClient(account.connection_data);
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });
        messageData = this.emailService.normalizeGmailMessage(message.data);
      } else if (provider === 'microsoft') {
        const client = this.emailService.createMicrosoftClient(account.connection_data);
        const message = await client.api(`/me/messages/${messageId}`).get();
        messageData = this.emailService.normalizeMicrosoftMessage(message);
      }

      if (!messageData) {
        console.error(`Failed to get message data for: ${messageId}`);
        return;
      }

      // Find or create chat (thread)
      const [chat, created] = await ChannelChat.findOrCreate({
        where: {
          account_id: account.id,
          provider_chat_id: messageData.provider_metadata.thread_id || messageData.provider_metadata.conversation_id,
        },
        defaults: {
          account_id: account.id,
          provider_chat_id: messageData.provider_metadata.thread_id || messageData.provider_metadata.conversation_id,
          title: messageData.subject || 'No Subject',
          last_message_at: messageData.sent_at,
          unread_count: 1,
        },
      });

      if (!created) {
        chat.last_message_at = messageData.sent_at;
        chat.unread_count += 1;
        await chat.save();
      }

      // Create message
      const newMessage = await ChannelMessage.create({
        chat_id: chat.id,
        provider_msg_id: messageData.provider_msg_id,
        direction: 'in',
        body: messageData.body,
        subject: messageData.subject,
        attachments: messageData.attachments,
        sent_at: messageData.sent_at,
        status: 'received',
        provider_metadata: messageData.provider_metadata,
      });

      // Update usage
      await this.updateUsage(account.user_id, account.provider, 'received');

      // Emit real-time update
      this.emitMessageUpdate(account.user_id, newMessage);

      console.log(`New email message processed: ${newMessage.id}`);
    } catch (error) {
      console.error('Error handling email message:', error);
    }
  }

  /**
   * Handle email read status
   */
  async handleEmailRead(data, provider) {
    try {
      const { messageId, accountId } = data;
      
      const account = await ChannelAccount.findOne({
        where: { 
          id: accountId,
          provider: 'email'
        },
      });

      if (!account) {
        console.error(`Email account not found: ${accountId}`);
        return;
      }

      // Update message status
      await ChannelMessage.update(
        { status: 'read', read_at: new Date() },
        { where: { provider_msg_id: messageId } }
      );

      console.log(`Email message marked as read: ${messageId}`);
    } catch (error) {
      console.error('Error handling email read:', error);
    }
  }

  /**
   * Handle Stripe checkout completion
   */
  async handleCheckoutCompleted(session) {
    try {
      const { customer_email, metadata } = session;
      
      // Find user by email
      const user = await User.findOne({ where: { email: customer_email } });
      if (!user) {
        console.error(`User not found for email: ${customer_email}`);
        return;
      }

      if (metadata.addon) {
        // Handle add-on purchase
        await this.entitlementService.createAddonEntitlement(user.id, metadata.addon);
        console.log(`Add-on activated: ${metadata.addon} for user ${user.id}`);
      } else if (metadata.plan) {
        // Handle plan upgrade
        await this.entitlementService.updateUserPlan(user.id, metadata.plan);
        console.log(`Plan updated: ${metadata.plan} for user ${user.id}`);
      }
    } catch (error) {
      console.error('Error handling checkout completion:', error);
    }
  }

  /**
   * Handle subscription update
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const { customer_email, status, metadata } = subscription;
      
      const user = await User.findOne({ where: { email: customer_email } });
      if (!user) {
        console.error(`User not found for email: ${customer_email}`);
        return;
      }

      if (status === 'active' && metadata.plan) {
        await this.entitlementService.updateUserPlan(user.id, metadata.plan);
      } else if (status === 'canceled') {
        // Handle subscription cancellation
        user.subscription.status = 'cancelled';
        await user.save();
      }

      console.log(`Subscription updated for user ${user.id}: ${status}`);
    } catch (error) {
      console.error('Error handling subscription update:', error);
    }
  }

  /**
   * Handle subscription deletion
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const { customer_email } = subscription;
      
      const user = await User.findOne({ where: { email: customer_email } });
      if (!user) {
        console.error(`User not found for email: ${customer_email}`);
        return;
      }

      user.subscription.status = 'cancelled';
      await user.save();

      console.log(`Subscription cancelled for user ${user.id}`);
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
    }
  }

  /**
   * Handle payment success
   */
  async handlePaymentSucceeded(invoice) {
    try {
      const { customer_email } = invoice;
      
      const user = await User.findOne({ where: { email: customer_email } });
      if (!user) {
        console.error(`User not found for email: ${customer_email}`);
        return;
      }

      user.subscription.status = 'active';
      await user.save();

      console.log(`Payment succeeded for user ${user.id}`);
    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailed(invoice) {
    try {
      const { customer_email } = invoice;
      
      const user = await User.findOne({ where: { email: customer_email } });
      if (!user) {
        console.error(`User not found for email: ${customer_email}`);
        return;
      }

      user.subscription.status = 'past_due';
      await user.save();

      console.log(`Payment failed for user ${user.id}`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  /**
   * Verify UniPile webhook signature
   */
  verifyUniPileSignature(req) {
    const signature = req.headers['x-unipile-signature'];
    const secret = process.env.UNIPILE_WEBHOOK_SECRET;
    
    // If no signature or secret, skip verification (for testing)
    if (!signature || !secret) {
      return true;
    }
    
    try {
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature || ''),
        Buffer.from(expectedSignature || '')
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify email webhook signature
   */
  verifyEmailSignature(req, provider) {
    const signature = req.headers['x-signature'];
    const payload = JSON.stringify(req.body);
    
    let secret;
    if (provider === 'gmail') {
      secret = process.env.GMAIL_WEBHOOK_SECRET;
    } else if (provider === 'microsoft') {
      secret = process.env.MICROSOFT_WEBHOOK_SECRET;
    }
    
    if (!secret) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripeSignature(req) {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;
    
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
      return true;
    } catch (error) {
      console.error('Stripe signature verification failed:', error);
      return false;
    }
  }

  /**
   * Update usage statistics
   */
  async updateUsage(userId, provider, type) {
    try {
      const currentPeriod = ChannelUsage.getCurrentPeriod();
      const usage = await ChannelUsage.getOrCreate(userId, provider, currentPeriod);
      
      if (type === 'sent') {
        await usage.incrementSent();
      } else if (type === 'received') {
        await usage.incrementReceived();
      }
    } catch (error) {
      console.error('Error updating usage:', error);
    }
  }

  /**
   * Emit real-time message update
   */
  emitMessageUpdate(userId, message) {
    if (this.io) {
      const roomName = `user_${userId}`;
      const fromName = message.provider_metadata?.fromName || message.provider_metadata?.sender?.attendee_name || 'Unknown';
      
      // Skip emitting "You" messages to prevent duplicates
      // The frontend already receives sent messages from the /api/send-message endpoint
      if (fromName === 'You') {
        console.log(`🚫 Skipping emission of "You" message to prevent duplicates:`, message.id);
        return;
      }
      
      const messageData = {
        id: message.id,
        text: message.body, // Frontend expects 'text'
        from: message.provider_metadata?.from || 'Unknown',
        fromName: fromName,
        to: message.provider_metadata?.to || 'Unknown',
        timestamp: message.sent_at,
        direction: message.direction,
        chat_id: message.chat_id,
        provider_msg_id: message.provider_msg_id,
        subject: message.subject,
        attachments: message.attachments,
        status: message.status,
        provider_metadata: message.provider_metadata,
        created_at: message.created_at,
      };
      
      console.log(`📡 Emitting message to room: ${roomName}`);
      console.log(`📡 Message data:`, JSON.stringify(messageData, null, 2));
      console.log(`📡 Connected sockets:`, this.io.sockets.sockets.size);
      console.log(`📡 Rooms:`, Array.from(this.io.sockets.adapter.rooms.keys()));
      
      // Emit to user's specific room with frontend-compatible format
      this.io.to(roomName).emit('new_message', messageData);
      console.log(`✅ Message emitted to user ${userId}:`, message.id);
    } else {
      console.log(`❌ Socket.io not available. Message update for user ${userId}:`, message.id);
    }
  }
}

module.exports = WebhooksController;
