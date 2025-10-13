/**
 * Message Normalization Service
 * 
 * This service provides a unified interface for normalizing messages from different platforms
 * into a consistent format that can be used throughout the application.
 * 
 * The normalization process ensures that:
 * 1. All messages have a consistent structure
 * 2. Platform-specific data is preserved in metadata
 * 3. Common fields are standardized across platforms
 * 4. Thread relationships are maintained
 */

class MessageNormalizationService {
  constructor() {
    this.platformNormalizers = {
      whatsapp: this.normalizeWhatsAppMessage.bind(this),
      instagram: this.normalizeInstagramMessage.bind(this),
      email: this.normalizeEmailMessage.bind(this),
      microsoft: this.normalizeMicrosoftMessage.bind(this),
    };
  }

  /**
   * Normalize a message from any platform into the unified format
   * @param {Object} rawMessage - Raw message from platform API
   * @param {string} platform - Platform name (whatsapp, instagram, email, microsoft)
   * @param {string} userId - User ID who owns this message
   * @returns {Object} Normalized message object
   */
  normalize(rawMessage, platform, userId) {
    if (!this.platformNormalizers[platform]) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const normalized = this.platformNormalizers[platform](rawMessage, userId);
    
    // Add common fields
    normalized.userId = userId;
    normalized.normalizedAt = new Date();
    normalized.originalData = rawMessage; // Keep original for debugging
    
    return normalized;
  }

  /**
   * Normalize WhatsApp Business API message
   * @param {Object} whatsappMessage - Raw WhatsApp message
   * @param {string} userId - User ID
   * @returns {Object} Normalized message
   */
  normalizeWhatsAppMessage(whatsappMessage, userId) {
    const message = whatsappMessage.messages?.[0];
    const contact = whatsappMessage.contacts?.[0];
    const profile = whatsappMessage.profiles?.[0];

    return {
      id: message?.id || `wa_${Date.now()}`,
      platform: 'whatsapp',
      sender: {
        name: contact?.profile?.name || contact?.wa_id || 'Unknown',
        id: contact?.wa_id || message?.from,
        phone: contact?.wa_id || message?.from,
      },
      recipient: {
        name: profile?.name || 'You',
        id: message?.to,
        phone: message?.to,
      },
      content: {
        text: message?.text?.body || message?.type || 'Media message',
        subject: null,
        html: null,
      },
      timestamp: new Date(parseInt(message?.timestamp) * 1000),
      read: false,
      avatar: `https://via.placeholder.com/40/25D366/FFFFFF?text=${(contact?.profile?.name || 'U').charAt(0).toUpperCase()}`,
      threadId: this.generateThreadId('whatsapp', contact?.wa_id || message?.from, message?.to),
      parentMessageId: null,
      isReply: false,
      replyCount: 0,
      platformMetadata: {
        whatsapp: {
          messageId: message?.id,
          chatId: contact?.wa_id || message?.from,
          isGroup: contact?.wa_id?.includes('@g.us') || false,
          groupName: contact?.profile?.name,
        },
      },
      syncStatus: 'pending',
    };
  }

  /**
   * Normalize Instagram Graph API message
   * @param {Object} instagramMessage - Raw Instagram message
   * @param {string} userId - User ID
   * @returns {Object} Normalized message
   */
  normalizeInstagramMessage(instagramMessage, userId) {
    return {
      id: instagramMessage.id || `ig_${Date.now()}`,
      platform: 'instagram',
      sender: {
        name: instagramMessage.from?.name || instagramMessage.from?.username || 'Unknown',
        id: instagramMessage.from?.id || instagramMessage.from?.username,
        email: instagramMessage.from?.email,
      },
      recipient: {
        name: 'You',
        id: userId,
      },
      content: {
        text: instagramMessage.message || instagramMessage.text || 'Instagram message',
        subject: null,
        html: null,
      },
      timestamp: new Date(instagramMessage.created_time || Date.now()),
      read: false,
      avatar: `https://via.placeholder.com/40/E4405F/FFFFFF?text=${(instagramMessage.from?.name || 'U').charAt(0).toUpperCase()}`,
      threadId: this.generateThreadId('instagram', instagramMessage.from?.id, userId),
      parentMessageId: null,
      isReply: false,
      replyCount: 0,
      platformMetadata: {
        instagram: {
          messageId: instagramMessage.id,
          threadId: instagramMessage.thread_id,
          isStory: instagramMessage.story_id ? true : false,
          postId: instagramMessage.media_id,
        },
      },
      syncStatus: 'pending',
    };
  }

  /**
   * Normalize Gmail API message
   * @param {Object} gmailMessage - Raw Gmail message
   * @param {string} userId - User ID
   * @returns {Object} Normalized message
   */
  normalizeEmailMessage(gmailMessage, userId) {
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    return {
      id: gmailMessage.id || `gmail_${Date.now()}`,
      platform: 'email',
      sender: {
        name: this.parseEmailName(getHeader('From')),
        id: this.parseEmailAddress(getHeader('From')),
        email: this.parseEmailAddress(getHeader('From')),
      },
      recipient: {
        name: this.parseEmailName(getHeader('To')),
        id: this.parseEmailAddress(getHeader('To')),
        email: this.parseEmailAddress(getHeader('To')),
      },
      content: {
        text: this.extractTextContent(gmailMessage.payload),
        subject: getHeader('Subject') || 'No Subject',
        html: this.extractHtmlContent(gmailMessage.payload),
      },
      timestamp: new Date(parseInt(gmailMessage.internalDate)),
      read: gmailMessage.labelIds?.includes('UNREAD') ? false : true,
      avatar: `https://via.placeholder.com/40/4285F4/FFFFFF?text=${(this.parseEmailName(getHeader('From')) || 'E').charAt(0).toUpperCase()}`,
      threadId: gmailMessage.threadId || `thread_${gmailMessage.id}`,
      parentMessageId: null,
      isReply: getHeader('Subject')?.toLowerCase().startsWith('re:') || false,
      replyCount: 0,
      platformMetadata: {
        email: {
          messageId: gmailMessage.id,
          threadId: gmailMessage.threadId,
          folder: this.determineFolder(gmailMessage.labelIds),
          labels: gmailMessage.labelIds || [],
          attachments: this.extractAttachments(gmailMessage.payload),
        },
      },
      syncStatus: 'pending',
    };
  }

  /**
   * Normalize Microsoft Graph API message
   * @param {Object} microsoftMessage - Raw Microsoft message
   * @param {string} userId - User ID
   * @returns {Object} Normalized message
   */
  normalizeMicrosoftMessage(microsoftMessage, userId) {
    return {
      id: microsoftMessage.id || `ms_${Date.now()}`,
      platform: 'microsoft',
      sender: {
        name: microsoftMessage.from?.emailAddress?.name || 'Unknown',
        id: microsoftMessage.from?.emailAddress?.address,
        email: microsoftMessage.from?.emailAddress?.address,
      },
      recipient: {
        name: microsoftMessage.toRecipients?.[0]?.emailAddress?.name || 'You',
        id: microsoftMessage.toRecipients?.[0]?.emailAddress?.address,
        email: microsoftMessage.toRecipients?.[0]?.emailAddress?.address,
      },
      content: {
        text: microsoftMessage.body?.content || microsoftMessage.bodyPreview || 'Microsoft message',
        subject: microsoftMessage.subject || 'No Subject',
        html: microsoftMessage.body?.contentType === 'html' ? microsoftMessage.body?.content : null,
      },
      timestamp: new Date(microsoftMessage.receivedDateTime),
      read: microsoftMessage.isRead || false,
      avatar: `https://via.placeholder.com/40/0078D4/FFFFFF?text=${(microsoftMessage.from?.emailAddress?.name || 'M').charAt(0).toUpperCase()}`,
      threadId: microsoftMessage.conversationId || `thread_${microsoftMessage.id}`,
      parentMessageId: null,
      isReply: microsoftMessage.subject?.toLowerCase().startsWith('re:') || false,
      replyCount: 0,
      platformMetadata: {
        microsoft: {
          messageId: microsoftMessage.id,
          conversationId: microsoftMessage.conversationId,
          folderId: microsoftMessage.parentFolderId,
          importance: microsoftMessage.importance,
          isRead: microsoftMessage.isRead,
        },
      },
      syncStatus: 'pending',
    };
  }

  /**
   * Generate a consistent thread ID for a conversation
   * @param {string} platform - Platform name
   * @param {string} senderId - Sender identifier
   * @param {string} recipientId - Recipient identifier
   * @returns {string} Thread ID
   */
  generateThreadId(platform, senderId, recipientId) {
    // Create a deterministic thread ID by sorting participant IDs
    const participants = [senderId, recipientId].sort();
    return `${platform}_${participants.join('_')}`;
  }

  /**
   * Parse email name from "Name <email@domain.com>" format
   * @param {string} fromHeader - From header value
   * @returns {string} Parsed name
   */
  parseEmailName(fromHeader) {
    if (!fromHeader) return 'Unknown';
    const match = fromHeader.match(/^(.+?)\s*<(.+)>$/);
    return match ? match[1].trim().replace(/['"]/g, '') : fromHeader;
  }

  /**
   * Parse email address from "Name <email@domain.com>" format
   * @param {string} fromHeader - From header value
   * @returns {string} Email address
   */
  parseEmailAddress(fromHeader) {
    if (!fromHeader) return '';
    const match = fromHeader.match(/<(.+)>/);
    return match ? match[1] : fromHeader;
  }

  /**
   * Extract text content from Gmail message payload
   * @param {Object} payload - Gmail message payload
   * @returns {string} Text content
   */
  extractTextContent(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        if (part.parts) {
          const text = this.extractTextContent(part);
          if (text) return text;
        }
      }
    }
    
    return 'No text content available';
  }

  /**
   * Extract HTML content from Gmail message payload
   * @param {Object} payload - Gmail message payload
   * @returns {string} HTML content
   */
  extractHtmlContent(payload) {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        if (part.parts) {
          const html = this.extractHtmlContent(part);
          if (html) return html;
        }
      }
    }
    
    return null;
  }

  /**
   * Determine folder from Gmail labels
   * @param {Array} labelIds - Gmail label IDs
   * @returns {string} Folder name
   */
  determineFolder(labelIds) {
    if (!labelIds) return 'INBOX';
    if (labelIds.includes('SENT')) return 'SENT';
    if (labelIds.includes('DRAFT')) return 'DRAFT';
    if (labelIds.includes('SPAM')) return 'SPAM';
    if (labelIds.includes('TRASH')) return 'TRASH';
    return 'INBOX';
  }

  /**
   * Extract attachments from Gmail message payload
   * @param {Object} payload - Gmail message payload
   * @returns {Array} Attachments array
   */
  extractAttachments(payload) {
    const attachments = [];
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            contentType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId,
          });
        }
        if (part.parts) {
          attachments.push(...this.extractAttachments(part));
        }
      }
    }
    
    return attachments;
  }

  /**
   * Batch normalize multiple messages
   * @param {Array} rawMessages - Array of raw messages
   * @param {string} platform - Platform name
   * @param {string} userId - User ID
   * @returns {Array} Array of normalized messages
   */
  batchNormalize(rawMessages, platform, userId) {
    return rawMessages.map(message => this.normalize(message, platform, userId));
  }

  /**
   * Validate normalized message structure
   * @param {Object} normalizedMessage - Normalized message
   * @returns {boolean} Is valid
   */
  validate(normalizedMessage) {
    const requiredFields = [
      'id', 'platform', 'sender', 'recipient', 'content', 
      'timestamp', 'threadId', 'userId'
    ];
    
    return requiredFields.every(field => normalizedMessage[field] !== undefined);
  }
}

module.exports = MessageNormalizationService;
