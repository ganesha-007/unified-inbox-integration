const { ChannelAccount, ChannelChat, ChannelMessage, ChannelUsage } = require('../models');
const EntitlementService = require('../services/EntitlementService');
const UniPileService = require('../services/UniPileService');
const EmailService = require('../services/EmailService');
const EmailLimitsService = require('../services/EmailLimitsService');

class ChannelsController {
  constructor() {
    this.entitlementService = new EntitlementService();
    this.unipileService = new UniPileService();
    this.emailService = new EmailService();
    this.emailLimitsService = new EmailLimitsService();
  }

  /**
   * Get connected accounts for a provider
   */
  async getAccounts(req, res) {
    try {
      const { provider } = req.params;
      const userId = req.user.id;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
      }

      const accounts = await ChannelAccount.findByUserAndProvider(userId, provider);
      
      res.json({
        provider,
        accounts: accounts.map(account => ({
          id: account.id,
          external_account_id: account.external_account_id,
          status: account.status,
          account_info: account.account_info,
          last_sync_at: account.last_sync_at,
          created_at: account.created_at,
        })),
      });
    } catch (error) {
      console.error('Error getting accounts:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Connect a new account
   */
  async connectAccount(req, res) {
    try {
      const { provider } = req.params;
      const userId = req.user.id;
      const { credentials = {} } = req.body;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
      }

      let connectionData;
      let externalAccountId;

      if (provider === 'whatsapp' || provider === 'instagram') {
        // Use UniPile for WhatsApp and Instagram
        connectionData = await this.unipileService.initializeConnection(provider, credentials);
        externalAccountId = connectionData.connectionId;
      } else if (provider === 'email') {
        // Handle email OAuth flow
        const { code, emailProvider } = credentials;
        
        if (!code) {
          // Return auth URL for OAuth flow
          const authUrl = emailProvider === 'gmail' 
            ? this.emailService.getGmailAuthUrl()
            : this.emailService.getMicrosoftAuthUrl();
          
          return res.json({ authUrl, provider: emailProvider });
        }

        // Exchange code for tokens
        const tokens = emailProvider === 'gmail'
          ? await this.emailService.exchangeGmailCode(code)
          : await this.emailService.exchangeMicrosoftCode(code);

        connectionData = tokens;
        externalAccountId = tokens.email;
      }

      // Create or update account record
      const [account, created] = await ChannelAccount.findOrCreate({
        where: {
          user_id: userId,
          provider,
          external_account_id: externalAccountId,
        },
        defaults: {
          user_id: userId,
          provider,
          external_account_id: externalAccountId,
          status: 'connected',
          connection_data: connectionData,
          account_info: {
            name: connectionData.name || externalAccountId,
            email: connectionData.email,
          },
        },
      });

      if (!created) {
        account.status = 'connected';
        account.connection_data = connectionData;
        account.account_info = {
          ...account.account_info,
          name: connectionData.name || externalAccountId,
          email: connectionData.email,
        };
        await account.save();
      }

      res.json({
        message: `${provider} account connected successfully`,
        account: {
          id: account.id,
          provider: account.provider,
          external_account_id: account.external_account_id,
          status: account.status,
          account_info: account.account_info,
        },
      });
    } catch (error) {
      console.error('Error connecting account:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Disconnect an account
   */
  async disconnectAccount(req, res) {
    try {
      const { provider, accountId } = req.params;
      const userId = req.user.id;

      const account = await ChannelAccount.findOne({
        where: { id: accountId, user_id: userId, provider },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Disconnect from provider
      if (provider === 'whatsapp' || provider === 'instagram') {
        await this.unipileService.disconnect(account.connection_data.connectionId);
      }

      // Update account status
      account.status = 'disconnected';
      account.connection_data = {};
      await account.save();

      res.json({ message: `${provider} account disconnected successfully` });
    } catch (error) {
      console.error('Error disconnecting account:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get chats for an account
   */
  async getChats(req, res) {
    try {
      const { provider, accountId } = req.params;
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
      }

      const account = await ChannelAccount.findOne({
        where: { id: accountId, user_id: userId, provider },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Get chats from provider
      let providerChats;
      if (provider === 'whatsapp' || provider === 'instagram') {
        providerChats = await this.unipileService.getChats(
          account.connection_data.connectionId,
          limit,
          offset
        );
      } else if (provider === 'email') {
        // For email, we'll get messages and group them by thread
        const messages = await this.emailService.getGmailMessages(
          account.connection_data,
          '',
          limit
        );
        providerChats = this.groupEmailMessagesIntoChats(messages);
      }

      // Sync with local database
      const chats = await this.syncChats(account, providerChats);

      res.json({
        provider,
        account_id: accountId,
        chats: chats.map(chat => ({
          id: chat.id,
          provider_chat_id: chat.provider_chat_id,
          title: chat.title,
          last_message_at: chat.last_message_at,
          unread_count: chat.unread_count,
          chat_info: chat.chat_info,
        })),
      });
    } catch (error) {
      console.error('Error getting chats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get messages for a chat
   */
  async getMessages(req, res) {
    try {
      const { provider, accountId, chatId } = req.params;
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
      }

      const account = await ChannelAccount.findOne({
        where: { id: accountId, user_id: userId, provider },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Get messages from provider
      let providerMessages;
      if (provider === 'whatsapp' || provider === 'instagram') {
        providerMessages = await this.unipileService.getMessages(
          account.connection_data.connectionId,
          chatId,
          limit,
          offset
        );
      } else if (provider === 'email') {
        providerMessages = await this.emailService.getGmailMessages(
          account.connection_data,
          `thread:${chatId}`,
          limit
        );
      }

      // Sync with local database
      const messages = await this.syncMessages(account, chatId, providerMessages);

      res.json({
        provider,
        account_id: accountId,
        chat_id: chatId,
        messages: messages.map(message => ({
          id: message.id,
          provider_msg_id: message.provider_msg_id,
          direction: message.direction,
          body: message.body,
          subject: message.subject,
          attachments: message.attachments,
          sent_at: message.sent_at,
          status: message.status,
          read_at: message.read_at,
        })),
      });
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Send a message
   */
  async sendMessage(req, res) {
    try {
      const { provider, accountId, chatId } = req.params;
      const userId = req.user.id;
      const { body, subject, attachments = [] } = req.body;

      // Check entitlement
      const hasAccess = await this.entitlementService.hasAccess(userId, provider);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: `You don't have access to ${provider}. Please upgrade your plan or purchase the add-on.`
        });
      }

      // Check usage limits
      await this.entitlementService.enforceUsageLimits(userId, provider);

      const account = await ChannelAccount.findOne({
        where: { id: accountId, user_id: userId, provider },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Apply email safety limits for email provider
      if (provider === 'email') {
        const recipients = [req.body.to].filter(Boolean);
        const domains = recipients.map(email => email.split('@')[1]);
        const attachmentBytes = attachments.reduce((total, att) => total + (att.size || 0), 0);

        await this.emailLimitsService.enforceLimits({
          userId,
          mailboxId: account.id,
          to: recipients,
          domains,
          attachmentBytes,
        });
      }

      // Send message via provider
      let providerMessage;
      if (provider === 'whatsapp' || provider === 'instagram') {
        providerMessage = await this.unipileService.sendMessage(
          account.connection_data.connectionId,
          chatId,
          { body, attachments }
        );
      } else if (provider === 'email') {
        providerMessage = await this.emailService.sendGmailMessage(
          account.connection_data,
          {
            to: req.body.to,
            cc: req.body.cc,
            bcc: req.body.bcc,
            subject,
            body,
            attachments,
          }
        );
      }

      // Save message to database
      const message = await ChannelMessage.create({
        chat_id: chatId,
        provider_msg_id: providerMessage.id,
        direction: 'out',
        body,
        subject,
        attachments,
        sent_at: new Date(),
        status: 'sent',
        provider_metadata: providerMessage,
      });

      // Update usage
      await this.updateUsage(userId, provider, 'sent');

      res.json({
        message: 'Message sent successfully',
        message_id: message.id,
        provider_message: providerMessage,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.status === 402) {
        res.status(402).json({ 
          error: error.message,
          code: error.code,
          details: error.details,
        });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(req, res) {
    try {
      const { provider, accountId } = req.params;
      const userId = req.user.id;
      const { messageIds } = req.body;

      const account = await ChannelAccount.findOne({
        where: { id: accountId, user_id: userId, provider },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Mark as read in provider
      if (provider === 'whatsapp' || provider === 'instagram') {
        await this.unipileService.markAsRead(
          account.connection_data.connectionId,
          req.body.chatId,
          messageIds
        );
      }

      // Update local database
      await ChannelMessage.update(
        { status: 'read', read_at: new Date() },
        { where: { id: messageIds } }
      );

      res.json({ message: 'Messages marked as read' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get usage limits for email
   */
  async getEmailLimits(req, res) {
    try {
      const { accountId } = req.params;
      const userId = req.user.id;

      const account = await ChannelAccount.findOne({
        where: { id: accountId, user_id: userId, provider: 'email' },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const limits = await this.emailLimitsService.getRemainingLimits(account.id);

      res.json(limits);
    } catch (error) {
      console.error('Error getting email limits:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Helper: Sync chats with local database
   */
  async syncChats(account, providerChats) {
    const chats = [];
    
    for (const providerChat of providerChats) {
      const normalizedChat = this.unipileService.normalizeChat(providerChat, account.provider);
      
      const [chat, created] = await ChannelChat.findOrCreate({
        where: {
          account_id: account.id,
          provider_chat_id: normalizedChat.provider_chat_id,
        },
        defaults: {
          account_id: account.id,
          ...normalizedChat,
        },
      });

      if (!created) {
        Object.assign(chat, normalizedChat);
        await chat.save();
      }

      chats.push(chat);
    }

    return chats;
  }

  /**
   * Helper: Sync messages with local database
   */
  async syncMessages(account, chatId, providerMessages) {
    const messages = [];
    
    for (const providerMessage of providerMessages) {
      const normalizedMessage = this.unipileService.normalizeMessage(providerMessage, account.provider);
      
      const [message, created] = await ChannelMessage.findOrCreate({
        where: {
          chat_id: chatId,
          provider_msg_id: normalizedMessage.provider_msg_id,
        },
        defaults: {
          chat_id: chatId,
          ...normalizedMessage,
        },
      });

      if (!created) {
        Object.assign(message, normalizedMessage);
        await message.save();
      }

      messages.push(message);
    }

    return messages;
  }

  /**
   * Helper: Group email messages into chats
   */
  groupEmailMessagesIntoChats(messages) {
    const chatMap = new Map();
    
    for (const message of messages) {
      const threadId = message.provider_metadata.thread_id;
      if (!chatMap.has(threadId)) {
        chatMap.set(threadId, {
          id: threadId,
          name: message.subject || 'No Subject',
          last_message_at: message.sent_at,
          unread_count: 0,
          participants: [],
        });
      }
      
      const chat = chatMap.get(threadId);
      if (message.sent_at > chat.last_message_at) {
        chat.last_message_at = message.sent_at;
      }
    }

    return Array.from(chatMap.values());
  }

  /**
   * Helper: Update usage statistics
   */
  async updateUsage(userId, provider, type) {
    const currentPeriod = ChannelUsage.getCurrentPeriod();
    const usage = await ChannelUsage.getOrCreate(userId, provider, currentPeriod);
    
    if (type === 'sent') {
      await usage.incrementSent();
    } else if (type === 'received') {
      await usage.incrementReceived();
    }
  }
}

module.exports = ChannelsController;
