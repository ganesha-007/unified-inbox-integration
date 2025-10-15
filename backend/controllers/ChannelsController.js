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
      const userId = req.user.userId;

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
      const userId = req.user.userId;
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
      const userId = req.user.userId;

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
   * Force sync chats from provider
   */
  async syncChatsFromProvider(req, res) {
    try {
      const { provider, accountId } = req.params;
      const userId = req.user.userId;

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

      // Get chats from provider and sync
      let providerChats;
      if (provider === 'whatsapp' || provider === 'instagram') {
        providerChats = await this.unipileService.getChats(
          account.connection_data.connectionId,
          100, // Get more chats for sync
          0
        );
      } else if (provider === 'email') {
        const messages = await this.emailService.getGmailMessages(
          account.connection_data,
          '',
          100
        );
        providerChats = this.groupEmailMessagesIntoChats(messages);
      }

      // Sync with local database
      const chats = await this.syncChats(account, providerChats);

      // Filter out chats with own phone number (self-messages)
      const ownPhoneNumber = process.env.WHATSAPP_ACCOUNT_NUMBER || '919566651479';
      const hideOwnChats = process.env.HIDE_OWN_CHATS !== 'false'; // Default to true
      const filteredChats = hideOwnChats ? chats.filter(chat => {
        const chatPhoneNumber = chat.chat_info?.phone_number;
        // Don't show chats with own phone number
        return chatPhoneNumber !== ownPhoneNumber;
      }) : chats;

      res.json({
        provider,
        account_id: accountId,
        chats: filteredChats.map(chat => ({
          id: chat.id,
          provider_chat_id: chat.provider_chat_id,
          title: chat.title,
          last_message_at: chat.last_message_at,
          unread_count: chat.unread_count,
          chat_info: chat.chat_info,
        })),
        message: `Synced ${filteredChats.length} chats from ${provider}`
      });
    } catch (error) {
      console.error('Error syncing chats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get chats for an account
   */
  async getChats(req, res) {
    try {
      const { provider, accountId } = req.params;
      const userId = req.user.userId;
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

      // Get chats directly from local database (consolidated)
      let chats = await ChannelChat.findAll({
        where: { account_id: accountId },
        order: [['last_message_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // If no local chats, try to sync from provider
      if (chats.length === 0) {
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
        chats = await this.syncChats(account, providerChats);
      }

      // Filter out chats with own phone number (self-messages)
      const ownPhoneNumber = process.env.WHATSAPP_ACCOUNT_NUMBER || '919566651479';
      const hideOwnChats = process.env.HIDE_OWN_CHATS !== 'false'; // Default to true
      const filteredChats = hideOwnChats ? chats.filter(chat => {
        const chatPhoneNumber = chat.chat_info?.phone_number;
        // Don't show chats with own phone number
        return chatPhoneNumber !== ownPhoneNumber;
      }) : chats;

      res.json({
        provider,
        account_id: accountId,
        chats: filteredChats.map(chat => ({
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
      const userId = req.user.userId;
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
      const userId = req.user.userId;
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
      const userId = req.user.userId;
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
      const userId = req.user.userId;

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
    // First, get all existing chats for this account to avoid duplicates
    const existingChats = await ChannelChat.findAll({
      where: { account_id: account.id }
    });
    
    // Create a map of existing chats by phone number
    const existingChatsByPhone = {};
    existingChats.forEach(chat => {
      const phoneNumber = chat.chat_info?.phone_number || 'unknown';
      if (!existingChatsByPhone[phoneNumber]) {
        existingChatsByPhone[phoneNumber] = chat;
      }
    });
    
    const chats = [];
    const processedPhoneNumbers = new Set();
    
    for (const providerChat of providerChats) {
      const normalizedChat = this.unipileService.normalizeChat(providerChat, account.provider);
      
      // Extract phone number from chat participants or metadata
      const phoneNumber = this.extractPhoneNumberFromChat(providerChat);
      const uniqueChatId = `${phoneNumber}_${account.provider}`;
      
      // Skip if we've already processed this phone number
      if (processedPhoneNumbers.has(phoneNumber)) {
        console.log(`Skipping duplicate chat for phone number: ${phoneNumber}`);
        continue;
      }
      
      // Check if we already have a chat for this phone number
      let chat = existingChatsByPhone[phoneNumber];
      
      if (chat) {
        // Update existing chat with latest info
        chat.title = normalizedChat.title;
        chat.last_message_at = normalizedChat.last_message_at;
        chat.chat_info = {
          ...chat.chat_info,
          ...normalizedChat.chat_info,
          original_chat_id: normalizedChat.provider_chat_id,
          phone_number: phoneNumber,
        };
        await chat.save();
      } else {
        // Create new chat
        chat = await ChannelChat.create({
          account_id: account.id,
          provider_chat_id: uniqueChatId,
          title: normalizedChat.title,
          last_message_at: normalizedChat.last_message_at,
          chat_info: {
            ...normalizedChat.chat_info,
            original_chat_id: normalizedChat.provider_chat_id,
            phone_number: phoneNumber,
          },
          unread_count: normalizedChat.unread_count,
        });
      }

      chats.push(chat);
      processedPhoneNumbers.add(phoneNumber);
    }

    return chats;
  }

  /**
   * Extract phone number from chat data
   */
  extractPhoneNumberFromChat(chat) {
    // Try to extract phone number from participants or metadata
    if (chat.participants && chat.participants.length > 0) {
      for (const participant of chat.participants) {
        if (participant.phone || participant.id) {
          const phoneNumber = participant.phone || participant.id;
          const cleanPhone = phoneNumber.replace(/^whatsapp:/, '').replace(/^\+/, '').replace(/\D/g, '');
          if (cleanPhone && cleanPhone.length >= 10) {
            return cleanPhone;
          }
        }
      }
    }
    
    // Fallback to chat ID or name
    return chat.id || chat.name || 'unknown';
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
