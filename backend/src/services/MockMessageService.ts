import { Server as SocketIOServer } from 'socket.io';
import Message from '../models/Message';
import MessageNormalizationService from './MessageNormalizationService';

interface MockMessageTemplate {
  platform: string;
  sender: {
    name: string;
    id: string;
    phone?: string;
    email?: string;
  };
  content: {
    text: string;
    subject?: string | null;
  };
  avatar?: string;
}

class MockMessageService {
  private io: SocketIOServer;
  private messageNormalizer: MessageNormalizationService;
  private isRunning: boolean;
  private intervalId: NodeJS.Timeout | null;
  private messageTemplates: MockMessageTemplate[];

  constructor(io: SocketIOServer) {
    this.io = io;
    this.messageNormalizer = new MessageNormalizationService();
    this.isRunning = false;
    this.intervalId = null;
    this.messageTemplates = [
      // WhatsApp templates
      {
        platform: 'whatsapp',
        sender: {
          name: 'Alice Johnson',
          id: '+1555987654',
          phone: '+1555987654'
        },
        content: {
          text: 'Hey! Are you free for a quick call later today?',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=AJ'
      },
      {
        platform: 'whatsapp',
        sender: {
          name: 'David Kim',
          id: '+1555123456',
          phone: '+1555123456'
        },
        content: {
          text: 'Thanks for the update! The project is looking great.',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=DK'
      },
      {
        platform: 'whatsapp',
        sender: {
          name: 'Sarah Wilson',
          id: '+1555555555',
          phone: '+1555555555'
        },
        content: {
          text: 'Can you send me the meeting notes from yesterday?',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=SW'
      },
      {
        platform: 'whatsapp',
        sender: {
          name: 'Mike Chen',
          id: '+1555777777',
          phone: '+1555777777'
        },
        content: {
          text: 'The client loved the presentation! 🎉',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=MC'
      },
      {
        platform: 'whatsapp',
        sender: {
          name: 'Emma Davis',
          id: '+1555999999',
          phone: '+1555999999'
        },
        content: {
          text: 'Are we still on for lunch tomorrow?',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=ED'
      },
      // Instagram templates
      {
        platform: 'instagram',
        sender: {
          name: 'tech_enthusiast',
          id: 'instagram_123',
          email: 'tech@example.com'
        },
        content: {
          text: 'Love your latest post! The design is amazing 🔥',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=TE'
      },
      {
        platform: 'instagram',
        sender: {
          name: 'creative_mind',
          id: 'instagram_456',
          email: 'creative@example.com'
        },
        content: {
          text: 'Can you share some tips on your creative process?',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=CM'
      },
      {
        platform: 'instagram',
        sender: {
          name: 'business_owner',
          id: 'instagram_789',
          email: 'business@example.com'
        },
        content: {
          text: 'Interested in collaborating on a project!',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=BO'
      },
      // Email templates
      {
        platform: 'email',
        sender: {
          name: 'John Smith',
          id: 'john.smith@company.com',
          email: 'john.smith@company.com'
        },
        content: {
          text: 'Hi there,\n\nI wanted to follow up on our discussion about the new project. When would be a good time to schedule a meeting?\n\nBest regards,\nJohn',
          subject: 'Follow up on project discussion'
        },
        avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=JS'
      },
      {
        platform: 'email',
        sender: {
          name: 'Lisa Brown',
          id: 'lisa.brown@startup.com',
          email: 'lisa.brown@startup.com'
        },
        content: {
          text: 'Hello,\n\nThank you for your interest in our services. I\'ve attached the proposal document for your review.\n\nPlease let me know if you have any questions.\n\nBest,\nLisa',
          subject: 'Proposal for your review'
        },
        avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=LB'
      },
      {
        platform: 'email',
        sender: {
          name: 'Robert Taylor',
          id: 'robert.taylor@agency.com',
          email: 'robert.taylor@agency.com'
        },
        content: {
          text: 'Hi,\n\nI hope this email finds you well. I wanted to reach out regarding the marketing campaign we discussed.\n\nLooking forward to hearing from you.\n\nRegards,\nRobert',
          subject: 'Marketing campaign discussion'
        },
        avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=RT'
      }
    ];
  }

  /**
   * Start generating mock messages
   */
  start(intervalMs: number = 10000): void {
    if (this.isRunning) {
      console.log('Mock message service is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting mock message service with ${intervalMs}ms interval`);

    this.intervalId = setInterval(() => {
      this.generateMockMessage();
    }, intervalMs);
  }

  /**
   * Stop generating mock messages
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Mock message service is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Mock message service stopped');
  }

  /**
   * Generate a single mock message
   */
  private async generateMockMessage(): Promise<void> {
    try {
      // Pick a random template
      const template = this.messageTemplates[Math.floor(Math.random() * this.messageTemplates.length)];
      
      // Create mock message data
      const mockMessage = {
        id: `${template.platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        platform: template.platform,
        threadId: template.sender.id,
        direction: 'in' as const,
        content: template.content.text,
        subject: template.content.subject,
        timestamp: new Date(),
        sender: {
          id: template.sender.id,
          name: template.sender.name,
          avatar: template.avatar,
          ...(template.sender.phone && { phone: template.sender.phone }),
          ...(template.sender.email && { email: template.sender.email })
        },
        attachments: [],
        metadata: {
          isMock: true,
          template: template
        },
        isReply: false,
        status: 'received' as const
      };

      // Save to database
      const message = await Message.create({
        id: mockMessage.id,
        platform: mockMessage.platform,
        threadId: mockMessage.threadId,
        direction: mockMessage.direction,
        content: mockMessage.content,
        subject: mockMessage.subject,
        timestamp: mockMessage.timestamp,
        sender_id: (mockMessage as any).sender.id,
        sender_name: (mockMessage as any).sender.name,
        sender_avatar: (mockMessage as any).sender.avatar,
        sender_phone: (mockMessage as any).sender.phone,
        sender_email: (mockMessage as any).sender.email,
        attachments: (mockMessage as any).attachments,
        metadata: (mockMessage as any).metadata,
        is_reply: (mockMessage as any).isReply,
        status: (mockMessage as any).status
      } as any);

      // Emit to all connected clients
      if (this.io) {
        this.io.emit('new_message', {
          id: message.id,
          text: message.content,
          from: (message as any).sender_id,
          fromName: (message as any).sender_name,
          to: 'you',
          timestamp: message.timestamp,
          direction: message.direction,
          platform: message.platform,
          subject: message.subject,
          attachments: (message as any).attachments,
          status: (message as any).status,
          avatar: (message as any).sender_avatar,
          created_at: (message as any).created_at
        });
      }

      console.log(`Generated mock ${template.platform} message from ${template.sender.name}`);
    } catch (error) {
      console.error('Error generating mock message:', error);
    }
  }

  /**
   * Generate a specific number of mock messages
   */
  async generateBatch(count: number): Promise<void> {
    console.log(`Generating ${count} mock messages...`);
    
    for (let i = 0; i < count; i++) {
      await this.generateMockMessage();
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Generated ${count} mock messages`);
  }

  /**
   * Get service status
   */
  getStatus(): { running: boolean; intervalMs?: number } {
    return {
      running: this.isRunning,
      intervalMs: this.intervalId ? 10000 : undefined // Default interval
    };
  }

  /**
   * Add custom message template
   */
  addTemplate(template: MockMessageTemplate): void {
    this.messageTemplates.push(template);
  }

  /**
   * Remove message template by index
   */
  removeTemplate(index: number): void {
    if (index >= 0 && index < this.messageTemplates.length) {
      this.messageTemplates.splice(index, 1);
    }
  }

  /**
   * Get all message templates
   */
  getTemplates(): MockMessageTemplate[] {
    return [...this.messageTemplates];
  }
}

export default MockMessageService;
