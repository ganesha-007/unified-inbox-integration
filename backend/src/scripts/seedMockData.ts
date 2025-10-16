import { sequelize } from '../config/database';
import { User, ChannelAccount, ChannelChat, ChannelMessage } from '../models';
import { Provider } from '../types';

// Mock message data
const mockMessages = [
  // WhatsApp Messages
  {
    id: 'wa_msg_1',
    platform: 'whatsapp',
    sender: {
      name: 'John Doe',
      id: '+1234567890',
      phone: '+1234567890'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Hey! How are you doing? I wanted to check in and see how your day is going.',
      subject: null
    },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=JD',
    threadId: 'wa_thread_1',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      whatsapp: {
        messageId: 'wa_msg_1',
        chatId: '+1234567890',
        isGroup: false,
        groupName: null
      }
    },
    syncStatus: 'synced',
    userId: null, // Will be set to actual user ID
    deleted: false
  },
  {
    id: 'wa_msg_2',
    platform: 'whatsapp',
    sender: {
      name: 'Sarah Wilson',
      id: '+1987654321',
      phone: '+1987654321'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Thanks for the quick response! The project is looking great so far.',
      subject: null
    },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    read: true,
    avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=SW',
    threadId: 'wa_thread_2',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      whatsapp: {
        messageId: 'wa_msg_2',
        chatId: '+1987654321',
        isGroup: false,
        groupName: null
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  },
  // Instagram Messages
  {
    id: 'ig_msg_1',
    platform: 'instagram',
    sender: {
      name: 'creative_mind',
      id: 'instagram_123',
      email: 'creative@example.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Love your latest post! The design is absolutely stunning 🔥',
      subject: null
    },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=CM',
    threadId: 'ig_thread_1',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      instagram: {
        messageId: 'ig_msg_1',
        chatId: 'instagram_123',
        isGroup: false,
        groupName: null
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  },
  // Email Messages
  {
    id: 'email_msg_1',
    platform: 'email',
    sender: {
      name: 'Michael Chen',
      id: 'michael.chen@company.com',
      email: 'michael.chen@company.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Hi there,\n\nI wanted to follow up on our discussion about the new project. When would be a good time to schedule a meeting?\n\nBest regards,\nMichael',
      subject: 'Follow up on project discussion'
    },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    read: true,
    avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=MC',
    threadId: 'email_thread_1',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      email: {
        messageId: 'email_msg_1',
        threadId: 'email_thread_1',
        isGroup: false,
        groupName: null
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  }
];

async function seedMockData(): Promise<void> {
  try {
    console.log('🌱 Starting to seed mock data...');

    // Create a default user if none exists
    let user = await User.findOne();
    if (!user) {
      console.log('👤 Creating default user...');
      user = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User'
      });
      console.log('✅ Default user created:', user.id);
    } else {
      console.log('👤 Using existing user:', user.id);
    }

    // Create channel accounts for each platform
    const platforms = ['whatsapp', 'instagram', 'email'];
    const accounts: any[] = [];

    for (const platform of platforms) {
      const [account, created] = await ChannelAccount.findOrCreate({
        where: {
          userId: user.id,
          provider: platform as Provider,
          externalAccountId: `${platform}_account_1`
        },
        defaults: {
          userId: user.id,
          provider: platform as Provider,
          externalAccountId: `${platform}_account_1`,
          status: 'connected',
          connectionData: {
            connectionId: `${platform}_connection_1`,
            accountNumber: platform === 'whatsapp' ? '919566651479' : undefined,
            accountToken: `${platform}_token_1`
          },
          accountInfo: {
            name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
            phone: platform === 'whatsapp' ? '919566651479' : undefined,
            email: platform === 'email' ? 'admin@example.com' : undefined
          }
        }
      });

      accounts.push(account);
      console.log(`✅ ${platform} account created/found:`, account.id);
    }

    // Create chats for each account
    const chats: any[] = [];
    for (const account of accounts) {
      const [chat, created] = await ChannelChat.findOrCreate({
        where: {
          accountId: account.id,
          providerChatId: `${account.provider}_chat_1`
        },
        defaults: {
          accountId: account.id,
          providerChatId: `${account.provider}_chat_1`,
          title: `${account.provider.charAt(0).toUpperCase() + account.provider.slice(1)} Chat`,
          lastMessageAt: new Date(),
          chatInfo: {
            original_chat_id: `${account.provider}_chat_1`,
            provider_chat_id: `${account.provider}_chat_1`,
            is_group: false
          },
          unreadCount: 0,
          status: 'active'
        }
      });

      chats.push(chat);
      console.log(`✅ ${account.provider} chat created/found:`, chat.id);
    }

    // Create mock messages
    console.log('📝 Creating mock messages...');
    for (const mockMessage of mockMessages) {
      const account = accounts.find(acc => acc.provider === mockMessage.platform);
      const chat = chats.find(c => c.accountId === account?.id);

      if (account && chat) {
        const [message, created] = await ChannelMessage.findOrCreate({
          where: {
            chatId: chat.id,
            providerMsgId: mockMessage.id
          },
          defaults: {
            chatId: chat.id,
            providerMsgId: mockMessage.id,
            direction: 'in',
            body: mockMessage.content.text,
            subject: mockMessage.content.subject,
            attachments: [],
            sentAt: mockMessage.timestamp,
            status: mockMessage.read ? 'read' : 'received',
            readAt: mockMessage.read ? mockMessage.timestamp : null,
            providerMetadata: {
              sender: mockMessage.sender,
              recipient: mockMessage.recipient,
              platformMetadata: mockMessage.platformMetadata,
              avatar: mockMessage.avatar,
              threadId: mockMessage.threadId,
              parentMessageId: mockMessage.parentMessageId,
              isReply: mockMessage.isReply,
              replyCount: mockMessage.replyCount,
              syncStatus: mockMessage.syncStatus,
              deleted: mockMessage.deleted
            },
            isReply: mockMessage.isReply,
            syncStatus: 'synced',
            syncAttempts: 0
          }
        });

        if (created) {
          console.log(`✅ Created message: ${mockMessage.id}`);
        }
      }
    }

    console.log('🎉 Mock data seeding completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   - 1 user`);
    console.log(`   - ${accounts.length} channel accounts`);
    console.log(`   - ${chats.length} chats`);
    console.log(`   - ${mockMessages.length} messages`);

  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the script
seedMockData();
