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

interface RawMessage {
  [key: string]: any;
}

interface NormalizedMessage {
  id: string;
  platform: string;
  threadId: string;
  direction: 'in' | 'out';
  content: string;
  timestamp: Date;
  sender: {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
    phone?: string;
  };
  recipient?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  subject?: string;
  attachments: any[];
  metadata: Record<string, any>;
  isReply: boolean;
  parentMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';
}

interface PlatformNormalizer {
  (rawMessage: RawMessage, userId: string): NormalizedMessage;
}

class MessageNormalizationService {
  private platformNormalizers: Record<string, PlatformNormalizer>;

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
   */
  normalizeMessage(rawMessage: RawMessage, platform: string, userId: string): NormalizedMessage {
    const normalizer = this.platformNormalizers[platform];
    if (!normalizer) {
      throw new Error(`No normalizer found for platform: ${platform}`);
    }

    return normalizer(rawMessage, userId);
  }

  /**
   * Normalize WhatsApp message
   */
  private normalizeWhatsAppMessage(rawMessage: RawMessage, userId: string): NormalizedMessage {
    const {
      id,
      from,
      to,
      timestamp,
      type,
      text,
      image,
      video,
      audio,
      document,
      context,
      status
    } = rawMessage;

    // Determine content based on message type
    let content = '';
    let attachments: any[] = [];

    switch (type) {
      case 'text':
        content = text?.body || '';
        break;
      case 'image':
        content = image?.caption || '';
        attachments = [{
          type: 'image',
          id: image?.id,
          mime_type: image?.mime_type,
          sha256: image?.sha256,
          caption: image?.caption
        }];
        break;
      case 'video':
        content = video?.caption || '';
        attachments = [{
          type: 'video',
          id: video?.id,
          mime_type: video?.mime_type,
          sha256: video?.sha256,
          caption: video?.caption
        }];
        break;
      case 'audio':
        content = 'Audio message';
        attachments = [{
          type: 'audio',
          id: audio?.id,
          mime_type: audio?.mime_type,
          sha256: audio?.sha256
        }];
        break;
      case 'document':
        content = document?.caption || document?.filename || 'Document';
        attachments = [{
          type: 'document',
          id: document?.id,
          mime_type: document?.mime_type,
          sha256: document?.sha256,
          filename: document?.filename,
          caption: document?.caption
        }];
        break;
      default:
        content = 'Unsupported message type';
    }

    return {
      id: id || `whatsapp_${Date.now()}`,
      platform: 'whatsapp',
      threadId: from || to || 'unknown',
      direction: to ? 'out' : 'in',
      content,
      timestamp: new Date(parseInt(timestamp) * 1000),
      sender: {
        id: from || 'unknown',
        name: from || 'Unknown',
        phone: from
      },
      recipient: to ? {
        id: to,
        name: to,
        phone: to
      } : undefined,
      attachments,
      metadata: {
        type,
        context,
        status,
        originalMessage: rawMessage
      },
      isReply: !!context?.replied_to,
      parentMessageId: context?.replied_to?.id,
      status: this.mapWhatsAppStatus(status)
    };
  }

  /**
   * Normalize Instagram message
   */
  private normalizeInstagramMessage(rawMessage: RawMessage, userId: string): NormalizedMessage {
    const {
      id,
      from,
      to,
      timestamp,
      text,
      media,
      story_mention,
      story_reply
    } = rawMessage;

    let content = text || '';
    let attachments: any[] = [];

    if (media) {
      attachments = [{
        type: media.type,
        url: media.url,
        id: media.id
      }];
    }

    return {
      id: id || `instagram_${Date.now()}`,
      platform: 'instagram',
      threadId: from?.id || to?.id || 'unknown',
      direction: to ? 'out' : 'in',
      content,
      timestamp: new Date(timestamp),
      sender: {
        id: from?.id || 'unknown',
        name: from?.username || 'Unknown',
        avatar: from?.profile_picture_url
      },
      recipient: to ? {
        id: to.id,
        name: to.username
      } : undefined,
      attachments,
      metadata: {
        story_mention,
        story_reply,
        originalMessage: rawMessage
      },
      isReply: false,
      status: 'received'
    };
  }

  /**
   * Normalize email message
   */
  private normalizeEmailMessage(rawMessage: RawMessage, userId: string): NormalizedMessage {
    const {
      id,
      threadId,
      subject,
      from,
      to,
      date,
      body,
      attachments,
      isRead,
      labels
    } = rawMessage;

    return {
      id: id || `email_${Date.now()}`,
      platform: 'email',
      threadId: threadId || id || 'unknown',
      direction: 'in', // Assuming incoming for now
      content: body || '',
      subject,
      timestamp: new Date(date),
      sender: {
        id: from?.email || 'unknown',
        name: from?.name || from?.email || 'Unknown',
        email: from?.email
      },
      recipient: to ? {
        id: to.email || 'unknown',
        name: to.name || to.email || 'Unknown',
        email: to.email
      } : undefined,
      attachments: attachments || [],
      metadata: {
        isRead,
        labels,
        originalMessage: rawMessage
      },
      isReply: false,
      status: isRead ? 'read' : 'received'
    };
  }

  /**
   * Normalize Microsoft message
   */
  private normalizeMicrosoftMessage(rawMessage: RawMessage, userId: string): NormalizedMessage {
    const {
      id,
      conversationId,
      subject,
      from,
      toRecipients,
      receivedDateTime,
      body,
      attachments,
      isRead
    } = rawMessage;

    return {
      id: id || `microsoft_${Date.now()}`,
      platform: 'microsoft',
      threadId: conversationId || id || 'unknown',
      direction: 'in', // Assuming incoming for now
      content: body?.content || '',
      subject,
      timestamp: new Date(receivedDateTime),
      sender: {
        id: from?.emailAddress?.address || 'unknown',
        name: from?.emailAddress?.name || from?.emailAddress?.address || 'Unknown',
        email: from?.emailAddress?.address
      },
      recipient: toRecipients?.[0] ? {
        id: toRecipients[0].emailAddress?.address || 'unknown',
        name: toRecipients[0].emailAddress?.name || toRecipients[0].emailAddress?.address || 'Unknown',
        email: toRecipients[0].emailAddress?.address
      } : undefined,
      attachments: attachments || [],
      metadata: {
        isRead,
        originalMessage: rawMessage
      },
      isReply: false,
      status: isRead ? 'read' : 'received'
    };
  }

  /**
   * Map WhatsApp status to unified status
   */
  private mapWhatsAppStatus(status: string): NormalizedMessage['status'] {
    switch (status) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Batch normalize messages
   */
  normalizeMessages(rawMessages: RawMessage[], platform: string, userId: string): NormalizedMessage[] {
    return rawMessages.map(message => this.normalizeMessage(message, platform, userId));
  }

  /**
   * Get supported platforms
   */
  getSupportedPlatforms(): string[] {
    return Object.keys(this.platformNormalizers);
  }

  /**
   * Add custom normalizer for a platform
   */
  addNormalizer(platform: string, normalizer: PlatformNormalizer): void {
    this.platformNormalizers[platform] = normalizer;
  }

  /**
   * Remove normalizer for a platform
   */
  removeNormalizer(platform: string): void {
    delete this.platformNormalizers[platform];
  }
}

export default MessageNormalizationService;
