const mongoose = require('mongoose');
const config = require('../config');
const Message = require('../models/Message');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, config.mongodb.options)
  .then(() => console.log('Connected to MongoDB for seeding'))
  .catch(err => console.error('MongoDB connection error:', err));

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
      text: 'Can we meet tomorrow for the project discussion? I have some ideas to share.',
      subject: null
    },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    read: false,
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
  {
    id: 'wa_msg_3',
    platform: 'whatsapp',
    sender: {
      name: 'Mike Chen',
      id: '+1555123456',
      phone: '+1555123456'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Thanks for the help with the code review! Really appreciate your feedback.',
      subject: null
    },
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    read: false,
    avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=MC',
    threadId: 'wa_thread_3',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      whatsapp: {
        messageId: 'wa_msg_3',
        chatId: '+1555123456',
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
      name: 'Emma Stone',
      id: 'emma_stone_ig',
      email: 'emma@example.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Love your latest post! 🔥 The sunset photos are absolutely stunning. Where was this taken?',
      subject: null
    },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=ES',
    threadId: 'ig_thread_1',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      instagram: {
        messageId: 'ig_msg_1',
        threadId: 'ig_thread_1',
        isStory: false,
        postId: null
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  },
  {
    id: 'ig_msg_2',
    platform: 'instagram',
    sender: {
      name: 'Alex Rodriguez',
      id: 'alex_rodriguez_ig',
      email: 'alex@example.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Check out this cool place I found! Perfect for our next photo shoot. What do you think?',
      subject: null
    },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=AR',
    threadId: 'ig_thread_2',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      instagram: {
        messageId: 'ig_msg_2',
        threadId: 'ig_thread_2',
        isStory: false,
        postId: null
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
      name: 'Newsletter Team',
      id: 'noreply@company.com',
      email: 'noreply@company.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Here are this week\'s updates from our team. We have exciting new features coming soon!',
      subject: 'Weekly Newsletter - New Features Coming Soon'
    },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=NL',
    threadId: 'email_thread_1',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      email: {
        messageId: 'email_msg_1',
        threadId: 'email_thread_1',
        folder: 'INBOX',
        labels: ['INBOX', 'UNREAD'],
        attachments: []
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  },
  {
    id: 'email_msg_2',
    platform: 'email',
    sender: {
      name: 'Support Team',
      id: 'support@service.com',
      email: 'support@service.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'We have successfully resolved your issue. Your account has been updated and everything should be working normally now.',
      subject: 'Your ticket has been resolved'
    },
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=SP',
    threadId: 'email_thread_2',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      email: {
        messageId: 'email_msg_2',
        threadId: 'email_thread_2',
        folder: 'INBOX',
        labels: ['INBOX', 'UNREAD'],
        attachments: []
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  },
  {
    id: 'email_msg_3',
    platform: 'email',
    sender: {
      name: 'Billing Department',
      id: 'billing@service.com',
      email: 'billing@service.com'
    },
    recipient: {
      name: 'You',
      id: 'current_user'
    },
    content: {
      text: 'Your monthly invoice is ready for review. Please log in to your account to view and download the invoice.',
      subject: 'Invoice #12345 - Ready for Review'
    },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    read: false,
    avatar: 'https://via.placeholder.com/40/4285F4/FFFFFF?text=BL',
    threadId: 'email_thread_3',
    parentMessageId: null,
    isReply: false,
    replyCount: 0,
    platformMetadata: {
      email: {
        messageId: 'email_msg_3',
        threadId: 'email_thread_3',
        folder: 'INBOX',
        labels: ['INBOX', 'UNREAD'],
        attachments: []
      }
    },
    syncStatus: 'synced',
    userId: null,
    deleted: false
  }
];

async function seedMockData() {
  try {
    console.log('Starting to seed mock data...');

    // Find the user (assuming there's at least one user)
    const user = await User.findOne();
    if (!user) {
      console.log('No user found. Please create a user first.');
      return;
    }

    console.log(`Found user: ${user.email}`);

    // Clear existing messages for this user
    await Message.deleteMany({ userId: user._id });
    console.log('Cleared existing messages for user');

    // Set userId for all mock messages
    const messagesWithUserId = mockMessages.map(msg => ({
      ...msg,
      userId: user._id
    }));

    // Insert mock messages
    const insertedMessages = await Message.insertMany(messagesWithUserId);
    console.log(`Inserted ${insertedMessages.length} mock messages`);

    // Add some replies to make it more realistic
    const replyMessages = [
      {
        id: 'wa_reply_1',
        platform: 'whatsapp',
        sender: {
          name: 'You',
          id: user._id.toString()
        },
        recipient: {
          name: 'John Doe',
          id: '+1234567890',
          phone: '+1234567890'
        },
        content: {
          text: 'I\'m doing great! Thanks for asking. How about you?',
          subject: null
        },
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
        read: true,
        avatar: 'https://via.placeholder.com/40/25D366/FFFFFF?text=YO',
        threadId: 'wa_thread_1',
        parentMessageId: insertedMessages[0]._id,
        isReply: true,
        replyCount: 0,
        platformMetadata: {
          whatsapp: {
            messageId: 'wa_reply_1',
            chatId: '+1234567890',
            isGroup: false,
            groupName: null
          }
        },
        syncStatus: 'synced',
        userId: user._id,
        deleted: false
      }
    ];

    const insertedReplies = await Message.insertMany(replyMessages);
    console.log(`Inserted ${insertedReplies.length} reply messages`);

    // Update the parent message with reply count
    await Message.findByIdAndUpdate(insertedMessages[0]._id, {
      replyCount: 1
    });

    console.log('Mock data seeding completed successfully!');
    console.log(`Total messages: ${insertedMessages.length + insertedReplies.length}`);
    console.log(`Messages by platform:`);
    console.log(`- WhatsApp: ${mockMessages.filter(m => m.platform === 'whatsapp').length + 1}`);
    console.log(`- Instagram: ${mockMessages.filter(m => m.platform === 'instagram').length}`);
    console.log(`- Email: ${mockMessages.filter(m => m.platform === 'email').length}`);

  } catch (error) {
    console.error('Error seeding mock data:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the seeding function
seedMockData();
