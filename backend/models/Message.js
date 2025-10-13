const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Core message fields
  id: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    required: true,
    enum: ['whatsapp', 'instagram', 'email', 'microsoft'],
  },
  sender: {
    name: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      sparse: true,
    },
    phone: {
      type: String,
      sparse: true,
    },
  },
  recipient: {
    name: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      sparse: true,
    },
    phone: {
      type: String,
      sparse: true,
    },
  },
  content: {
    text: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      sparse: true,
    },
    html: {
      type: String,
      sparse: true,
    },
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
    sparse: true,
  },
  avatar: {
    type: String,
    sparse: true,
  },
  
  // Threading
  threadId: {
    type: String,
    required: true,
    index: true,
  },
  parentMessageId: {
    type: String,
    sparse: true,
    index: true,
  },
  isReply: {
    type: Boolean,
    default: false,
  },
  replyCount: {
    type: Number,
    default: 0,
  },
  
  // Platform-specific metadata
  platformMetadata: {
    // WhatsApp specific
    whatsapp: {
      messageId: String,
      chatId: String,
      isGroup: Boolean,
      groupName: String,
    },
    // Instagram specific
    instagram: {
      messageId: String,
      threadId: String,
      isStory: Boolean,
      postId: String,
    },
    // Email specific
    email: {
      messageId: String,
      threadId: String,
      folder: String,
      labels: [String],
      attachments: [{
        filename: String,
        contentType: String,
        size: Number,
        url: String,
      }],
    },
    // Microsoft Graph specific
    microsoft: {
      messageId: String,
      conversationId: String,
      folderId: String,
      importance: String,
      isRead: Boolean,
    },
  },
  
  // Sync status
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'failed', 'retrying'],
    default: 'pending',
  },
  lastSyncAt: {
    type: Date,
    sparse: true,
  },
  syncAttempts: {
    type: Number,
    default: 0,
  },
  
  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Soft delete
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    sparse: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
messageSchema.index({ threadId: 1, timestamp: -1 });
messageSchema.index({ platform: 1, timestamp: -1 });
messageSchema.index({ userId: 1, platform: 1, timestamp: -1 });
messageSchema.index({ userId: 1, read: 1, timestamp: -1 });
messageSchema.index({ syncStatus: 1, lastSyncAt: 1 });

// Virtual for unread count
messageSchema.virtual('isUnread').get(function() {
  return !this.read;
});

// Methods
messageSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

messageSchema.methods.markAsUnread = function() {
  this.read = false;
  this.readAt = undefined;
  return this.save();
};

messageSchema.methods.updateSyncStatus = function(status, error = null) {
  this.syncStatus = status;
  this.lastSyncAt = new Date();
  if (status === 'failed') {
    this.syncAttempts += 1;
  }
  return this.save();
};

// Static methods
messageSchema.statics.findByThread = function(threadId, userId) {
  return this.find({ 
    threadId, 
    userId, 
    deleted: false 
  }).sort({ timestamp: 1 });
};

messageSchema.statics.findUnreadByUser = function(userId, platform = null) {
  const query = { 
    userId, 
    read: false, 
    deleted: false 
  };
  if (platform) {
    query.platform = platform;
  }
  return this.find(query).sort({ timestamp: -1 });
};

messageSchema.statics.getUnreadCount = function(userId, platform = null) {
  const query = { 
    userId, 
    read: false, 
    deleted: false 
  };
  if (platform) {
    query.platform = platform;
  }
  return this.countDocuments(query);
};

// Pre-save middleware
messageSchema.pre('save', function(next) {
  if (this.isNew) {
    this.id = this.id || new mongoose.Types.ObjectId().toString();
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
