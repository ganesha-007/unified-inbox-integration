const Message = require('../models/Message');
const MessageNormalizationService = require('./MessageNormalizationService');

class MockMessageService {
  constructor(io) {
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
          text: 'The meeting has been moved to 3 PM. Can you confirm?',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=DK'
      },
      {
        platform: 'whatsapp',
        sender: {
          name: 'Lisa Chen',
          id: '+1555456789',
          phone: '+1555456789'
        },
        content: {
          text: 'Thanks for the help yesterday! Really appreciate it 🙏',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=LC'
      },

      // Instagram templates
      {
        platform: 'instagram',
        sender: {
          name: 'Photographer Pro',
          id: 'photographer_pro_ig',
          email: 'pro@photography.com'
        },
        content: {
          text: 'Check out this amazing sunset shot I took today! 📸✨',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=PP'
      },
      {
        platform: 'instagram',
        sender: {
          name: 'Travel Blogger',
          id: 'travel_blogger_ig',
          email: 'travel@blogger.com'
        },
        content: {
          text: 'Just arrived in Bali! The beaches here are incredible 🏖️',
          subject: null
        },
        avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=TB'
      },

      // Email templates
      {
        platform: 'email',
        sender: {
          name: 'Product Updates',
          id: 'updates@company.com',
          email: 'updates@company.com'
        },
        content: {
          text: 'We\'ve released new features in our latest update. Check out what\'s new!',
          subject: 'Product Update - New Features Available'
        },
        avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=PU'
      },
      {
        platform: 'email',
        sender: {
          name: 'Security Team',
          id: 'security@company.com',
          email: 'security@company.com'
        },
        content: {
          text: 'Your account security has been updated. Please review the changes.',
          subject: 'Security Update - Account Protection Enhanced'
        },
        avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=ST'
      },
      {
        platform: 'email',
        sender: {
          name: 'Marketing Team',
          id: 'marketing@company.com',
          email: 'marketing@company.com'
        },
        content: {
          text: 'Don\'t miss out on our exclusive offer! Limited time only.',
          subject: 'Special Offer - 50% Off Premium Features'
        },
        avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=MT'
      }
    ];
  }

  async startSendingMockMessages(intervalMinutes = 2) {
    if (this.isRunning) {
      console.log('Mock message service is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting mock message service - sending messages every ${intervalMinutes} minutes`);

    this.intervalId = setInterval(async () => {
      await this.sendRandomMockMessage();
    }, intervalMinutes * 60 * 1000);

    // Send an initial message
    setTimeout(() => {
      this.sendRandomMockMessage();
    }, 5000); // Send first message after 5 seconds
  }

  stopSendingMockMessages() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Mock message service stopped');
  }

  async sendRandomMockMessage() {
    try {
      // Get a random template
      const template = this.messageTemplates[Math.floor(Math.random() * this.messageTemplates.length)];
      
      // Get all users (for now, we'll send to the first user)
      const User = require('../models/User');
      const users = await User.find().limit(1);
      
      if (users.length === 0) {
        console.log('No users found to send mock messages to');
        return;
      }

      const user = users[0];
      
      // Create message data
      const messageData = {
        id: `${template.platform}_mock_${Date.now()}`,
        platform: template.platform,
        sender: template.sender,
        recipient: {
          name: user.firstName || 'User',
          id: user._id.toString()
        },
        content: template.content,
        timestamp: new Date(),
        read: false,
        avatar: template.avatar,
        threadId: `${template.platform}_thread_${Date.now()}`,
        parentMessageId: null,
        isReply: false,
        replyCount: 0,
        platformMetadata: this.getPlatformMetadata(template.platform),
        syncStatus: 'synced',
        userId: user._id,
        deleted: false
      };

      // Create and save message
      const message = new Message(messageData);
      await message.save();

      // Emit real-time update to all connected clients
      this.io.emit('new_message', message);

      console.log(`Sent mock ${template.platform} message: "${template.content.text.substring(0, 50)}..."`);

    } catch (error) {
      console.error('Error sending mock message:', error);
    }
  }

  getPlatformMetadata(platform) {
    const baseMetadata = {
      messageId: `${platform}_mock_${Date.now()}`,
      threadId: `${platform}_thread_${Date.now()}`
    };

    switch (platform) {
      case 'whatsapp':
        return {
          whatsapp: {
            ...baseMetadata,
            chatId: '+1555' + Math.floor(Math.random() * 1000000),
            isGroup: false,
            groupName: null
          }
        };
      case 'instagram':
        return {
          instagram: {
            ...baseMetadata,
            isStory: false,
            postId: null
          }
        };
      case 'email':
        return {
          email: {
            ...baseMetadata,
            folder: 'INBOX',
            labels: ['INBOX', 'UNREAD'],
            attachments: []
          }
        };
      default:
        return baseMetadata;
    }
  }

  async sendMockMessageToUser(userId, platform = null) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        console.log('User not found for mock message');
        return;
      }

      // If platform is specified, filter templates, otherwise random
      let templates = this.messageTemplates;
      if (platform) {
        templates = this.messageTemplates.filter(t => t.platform === platform);
      }

      if (templates.length === 0) {
        console.log('No templates found for platform:', platform);
        return;
      }

      const template = templates[Math.floor(Math.random() * templates.length)];
      
      const messageData = {
        id: `${template.platform}_mock_${Date.now()}`,
        platform: template.platform,
        sender: template.sender,
        recipient: {
          name: user.firstName || 'User',
          id: user._id.toString()
        },
        content: template.content,
        timestamp: new Date(),
        read: false,
        avatar: template.avatar,
        threadId: `${template.platform}_thread_${Date.now()}`,
        parentMessageId: null,
        isReply: false,
        replyCount: 0,
        platformMetadata: this.getPlatformMetadata(template.platform),
        syncStatus: 'synced',
        userId: user._id,
        deleted: false
      };

      const message = new Message(messageData);
      await message.save();

      // Emit to specific user's socket room
      this.io.to(userId).emit('new_message', message);
      this.io.emit('new_message', message); // Also broadcast to all

      console.log(`Sent mock ${template.platform} message to user ${user.email}`);

    } catch (error) {
      console.error('Error sending mock message to user:', error);
    }
  }
}

module.exports = MockMessageService;
