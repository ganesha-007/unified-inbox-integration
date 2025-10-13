# Message Normalization Guide

## Overview

The Unified Inbox uses a sophisticated message normalization system to convert messages from different platforms (WhatsApp, Instagram, Gmail, Microsoft Graph) into a consistent, unified format. This ensures that all messages can be displayed, processed, and managed uniformly regardless of their source platform.

## Normalized Message Structure

All messages are converted to the following standardized format:

```javascript
{
  // Core identification
  id: "unique_message_id",
  platform: "whatsapp|instagram|email|microsoft",
  
  // Sender information
  sender: {
    name: "Display Name",
    id: "unique_sender_id",
    email: "sender@example.com", // Optional
    phone: "+1234567890" // Optional
  },
  
  // Recipient information
  recipient: {
    name: "Recipient Name",
    id: "unique_recipient_id",
    email: "recipient@example.com", // Optional
    phone: "+1234567890" // Optional
  },
  
  // Message content
  content: {
    text: "Message text content",
    subject: "Email subject or null", // Optional
    html: "<p>HTML content</p>" // Optional
  },
  
  // Metadata
  timestamp: "2024-01-01T12:00:00.000Z",
  read: false,
  readAt: null, // Date when read
  avatar: "https://avatar-url.com/image.jpg",
  
  // Threading
  threadId: "conversation_thread_id",
  parentMessageId: "parent_message_id", // For replies
  isReply: false,
  replyCount: 0,
  
  // Platform-specific data (preserved)
  platformMetadata: {
    whatsapp: { /* WhatsApp-specific fields */ },
    instagram: { /* Instagram-specific fields */ },
    email: { /* Email-specific fields */ },
    microsoft: { /* Microsoft-specific fields */ }
  },
  
  // Sync status
  syncStatus: "pending|synced|failed|retrying",
  lastSyncAt: "2024-01-01T12:00:00.000Z",
  syncAttempts: 0,
  
  // User association
  userId: "user_object_id",
  
  // Soft delete
  deleted: false,
  deletedAt: null
}
```

## Platform-Specific Normalization

### WhatsApp Business API

**Raw Message Format:**
```javascript
{
  messages: [{
    id: "wamid.xxx",
    from: "1234567890",
    timestamp: "1640995200",
    text: { body: "Hello world" },
    type: "text"
  }],
  contacts: [{
    wa_id: "1234567890",
    profile: { name: "John Doe" }
  }],
  profiles: [{
    wa_id: "1234567890",
    name: "John Doe"
  }]
}
```

**Normalization Process:**
1. Extract message content from `messages[0]`
2. Match sender info from `contacts` array using `wa_id`
3. Convert Unix timestamp to ISO date
4. Generate thread ID from participant phone numbers
5. Preserve WhatsApp-specific metadata

**Normalized Result:**
```javascript
{
  id: "wamid.xxx",
  platform: "whatsapp",
  sender: {
    name: "John Doe",
    id: "1234567890",
    phone: "1234567890"
  },
  content: {
    text: "Hello world"
  },
  platformMetadata: {
    whatsapp: {
      messageId: "wamid.xxx",
      chatId: "1234567890",
      isGroup: false
    }
  }
}
```

### Instagram Graph API

**Raw Message Format:**
```javascript
{
  id: "instagram_message_id",
  from: {
    id: "instagram_user_id",
    name: "Instagram User",
    username: "instagram_username"
  },
  message: "Hello from Instagram!",
  created_time: "1640995200"
}
```

**Normalization Process:**
1. Extract sender information from `from` object
2. Convert `created_time` to ISO date
3. Generate thread ID from sender and recipient IDs
4. Preserve Instagram-specific metadata

### Gmail API

**Raw Message Format:**
```javascript
{
  id: "gmail_message_id",
  threadId: "gmail_thread_id",
  internalDate: "1640995200000",
  payload: {
    headers: [
      { name: "From", value: "John Doe <john@example.com>" },
      { name: "To", value: "recipient@example.com" },
      { name: "Subject", value: "Email Subject" }
    ],
    body: {
      data: "base64_encoded_text_content"
    },
    parts: [/* MIME parts for HTML, attachments, etc. */]
  }
}
```

**Normalization Process:**
1. Parse email headers to extract sender/recipient info
2. Decode base64 content from `payload.body.data`
3. Extract HTML content from MIME parts
4. Parse attachments from MIME parts
5. Determine folder from label IDs

### Microsoft Graph API

**Raw Message Format:**
```javascript
{
  id: "microsoft_message_id",
  conversationId: "conversation_id",
  subject: "Email Subject",
  from: {
    emailAddress: {
      name: "John Doe",
      address: "john@example.com"
    }
  },
  toRecipients: [{
    emailAddress: {
      name: "Recipient",
      address: "recipient@example.com"
    }
  }],
  body: {
    content: "Message content",
    contentType: "text|html"
  },
  receivedDateTime: "2024-01-01T12:00:00Z",
  isRead: false
}
```

## Thread Management

### Thread ID Generation

Thread IDs are generated deterministically to ensure consistent conversation grouping:

```javascript
function generateThreadId(platform, senderId, recipientId) {
  // Sort participant IDs to ensure consistency
  const participants = [senderId, recipientId].sort();
  return `${platform}_${participants.join('_')}`;
}
```

### Reply Handling

Replies are linked to their parent messages through:
- `parentMessageId`: Direct reference to parent message
- `threadId`: Shared conversation identifier
- `isReply`: Boolean flag for quick identification

## Content Processing

### Text Extraction

Different platforms store text content differently:

- **WhatsApp**: Direct text in `text.body`
- **Instagram**: Direct text in `message` field
- **Gmail**: Base64 encoded in `payload.body.data`
- **Microsoft**: Direct text in `body.content`

### HTML Content

HTML content is preserved when available:
- **Gmail**: Extracted from MIME parts with `text/html` type
- **Microsoft**: Available when `body.contentType` is "html"
- **WhatsApp/Instagram**: Not applicable (text-only)

### Attachments

Attachments are normalized to a consistent format:

```javascript
attachments: [{
  filename: "document.pdf",
  contentType: "application/pdf",
  size: 1024000,
  url: "https://attachment-url.com/file.pdf"
}]
```

## Error Handling

### Validation

All normalized messages are validated against the schema:

```javascript
const requiredFields = [
  'id', 'platform', 'sender', 'recipient', 'content', 
  'timestamp', 'threadId', 'userId'
];

function validate(normalizedMessage) {
  return requiredFields.every(field => 
    normalizedMessage[field] !== undefined
  );
}
```

### Fallback Values

When platform data is missing, fallback values are used:

```javascript
{
  sender: {
    name: contact?.profile?.name || 'Unknown',
    id: contact?.wa_id || message?.from || 'unknown'
  },
  content: {
    text: message?.text?.body || 'No content available'
  }
}
```

## Performance Considerations

### Batch Processing

Multiple messages can be normalized efficiently:

```javascript
const normalizedMessages = rawMessages.map(message => 
  messageNormalizer.normalize(message, platform, userId)
);
```

### Caching

Normalized messages are cached to avoid reprocessing:
- Thread IDs are cached for quick lookup
- Sender information is cached for repeated contacts
- Platform metadata is preserved for debugging

## Testing

### Unit Tests

Each platform normalizer has comprehensive unit tests:

```javascript
describe('WhatsApp Normalization', () => {
  it('should normalize basic text message', () => {
    const rawMessage = { /* WhatsApp message */ };
    const normalized = normalizer.normalize(rawMessage, 'whatsapp', 'user123');
    
    expect(normalized.platform).toBe('whatsapp');
    expect(normalized.sender.name).toBe('John Doe');
    expect(normalized.content.text).toBe('Hello world');
  });
});
```

### Integration Tests

End-to-end tests verify the complete normalization pipeline:

```javascript
describe('Message Normalization Pipeline', () => {
  it('should process messages from all platforms', async () => {
    const messages = await fetchMessagesFromAllPlatforms();
    const normalized = messages.map(msg => 
      normalizer.normalize(msg.raw, msg.platform, msg.userId)
    );
    
    expect(normalized).toHaveLength(messages.length);
    normalized.forEach(msg => {
      expect(validate(msg)).toBe(true);
    });
  });
});
```

## Extending to New Platforms

### Adding a New Platform

1. **Create Platform Service:**
```javascript
class NewPlatformService extends PlatformService {
  async fetchMessages(options) {
    // Implement platform-specific message fetching
  }
  
  async sendMessage(message) {
    // Implement platform-specific message sending
  }
}
```

2. **Add Normalizer Method:**
```javascript
normalizeNewPlatformMessage(rawMessage, userId) {
  return {
    id: rawMessage.id,
    platform: 'newplatform',
    sender: {
      name: rawMessage.from.name,
      id: rawMessage.from.id
    },
    // ... rest of normalized structure
  };
}
```

3. **Update Configuration:**
```javascript
// config/index.js
platforms: {
  newplatform: {
    apiUrl: 'https://api.newplatform.com',
    // ... platform-specific config
  }
}
```

### Platform-Specific Features

Each platform can have unique features preserved in `platformMetadata`:

```javascript
platformMetadata: {
  newplatform: {
    customField: 'platform-specific-value',
    specialFeature: true,
    apiVersion: 'v2.1'
  }
}
```

## Best Practices

1. **Always preserve original data** in `originalData` field for debugging
2. **Use consistent timestamp formats** (ISO 8601)
3. **Handle missing fields gracefully** with fallback values
4. **Validate normalized messages** before saving to database
5. **Log normalization errors** for monitoring and debugging
6. **Cache frequently accessed data** to improve performance
7. **Test with real platform data** to ensure accuracy

## Monitoring and Debugging

### Logging

Normalization activities are logged for monitoring:

```javascript
logger.info('Message normalized', {
  platform: 'whatsapp',
  messageId: 'wamid.xxx',
  processingTime: '15ms',
  userId: 'user123'
});
```

### Metrics

Key metrics are tracked:
- Normalization success rate
- Processing time per platform
- Error frequency by platform
- Message volume by platform

### Debugging

Original platform data is preserved for debugging:

```javascript
{
  normalizedMessage: { /* normalized structure */ },
  originalData: { /* raw platform data */ },
  normalizationErrors: [ /* any errors encountered */ ]
}
```

This normalization system ensures that the Unified Inbox can seamlessly integrate with any messaging platform while maintaining a consistent user experience and data structure.
