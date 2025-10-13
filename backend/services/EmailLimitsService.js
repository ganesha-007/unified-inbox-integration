const Redis = require('ioredis');
const config = require('../config');
const { ChannelUsage } = require('../models');

class EmailLimitsService {
  constructor() {
    this.redis = new Redis(config.redis.url, config.redis.options);
    this.limits = config.email;
  }

  /**
   * Enforce email safety limits
   */
  async enforceLimits(args) {
    const {
      userId,
      mailboxId,
      to = [],
      domains = [],
      isReply = false,
      attachmentBytes = 0,
      now = new Date(),
    } = args;

    // 1) Basic guards
    if (to.length === 0) {
      throw this.createLimitError('NO_RECIPIENTS', 'No recipients specified.');
    }

    if (to.length > this.limits.maxRecipientsPerMessage) {
      throw this.createLimitError(
        'RECIPIENT_CAP',
        `Max ${this.limits.maxRecipientsPerMessage} recipients per email.`
      );
    }

    if (attachmentBytes > this.limits.maxAttachmentBytes) {
      throw this.createLimitError(
        'ATTACHMENT_TOO_LARGE',
        `Attachments exceed ${Math.round(this.limits.maxAttachmentBytes / 1024 / 1024)} MB.`
      );
    }

    // 2) Hour/Day caps (mailbox level)
    const hourKey = this.getHourKey(mailboxId, now);
    const dayKey = this.getDayKey(mailboxId, now);

    const hourCount = await this.incrementHourly(hourKey, 1);
    if (hourCount > this.limits.maxPerHour) {
      throw this.createLimitError(
        'HOURLY_CAP',
        `Hourly send limit reached (${this.limits.maxPerHour}).`
      );
    }

    const isTrial = await this.isTrialMailbox(mailboxId);
    const dayCap = isTrial ? Math.min(this.limits.maxPerDay, this.limits.trialDailyCap) : this.limits.maxPerDay;

    const dayCount = await this.incrementDaily(dayKey, 1);
    if (dayCount > dayCap) {
      throw this.createLimitError(
        'DAILY_CAP',
        `Daily send limit reached (${dayCap}).`
      );
    }

    // 3) Per-recipient cooldown (skip or relax if reply)
    if (!isReply) {
      for (const recipient of to) {
        const lastToKey = this.getLastToKey(mailboxId, recipient);
        const canSend = await this.setIfAllowed(lastToKey, now.toISOString(), this.limits.perRecipientCooldownSec);
        if (!canSend) {
          throw this.createLimitError(
            'RECIPIENT_COOLDOWN',
            `Wait ${this.limits.perRecipientCooldownSec}s before emailing ${recipient} again.`
          );
        }
      }
    }

    // 4) Domain pacing (e.g., avoid spiking @acme.com)
    for (const domain of domains) {
      const lastDomainKey = this.getLastDomainKey(mailboxId, domain);
      const canSend = await this.setIfAllowed(lastDomainKey, now.toISOString(), this.limits.perDomainCooldownSec);
      if (!canSend) {
        throw this.createLimitError(
          'DOMAIN_COOLDOWN',
          `Slow down — pacing per domain (${domain}).`
        );
      }
    }

    return true;
  }

  /**
   * Get current usage limits for a mailbox
   */
  async getUsageLimits(mailboxId) {
    const now = new Date();
    const hourKey = this.getHourKey(mailboxId, now);
    const dayKey = this.getDayKey(mailboxId, now);

    const [usedHour, usedDay] = await Promise.all([
      this.redis.get(hourKey) || 0,
      this.redis.get(dayKey) || 0,
    ]);

    const isTrial = await this.isTrialMailbox(mailboxId);
    const dayCap = isTrial ? Math.min(this.limits.maxPerDay, this.limits.trialDailyCap) : this.limits.maxPerDay;

    return {
      perHour: this.limits.maxPerHour,
      usedHour: parseInt(usedHour),
      perDay: dayCap,
      usedDay: parseInt(usedDay),
      cooldowns: {
        recipientSec: this.limits.perRecipientCooldownSec,
        domainSec: this.limits.perDomainCooldownSec,
      },
    };
  }

  /**
   * Check if mailbox is in trial mode
   */
  async isTrialMailbox(mailboxId) {
    // This would typically check against your user/account data
    // For now, we'll assume all mailboxes are trial unless specified otherwise
    return true;
  }

  /**
   * Increment hourly counter
   */
  async incrementHourly(key, count = 1) {
    const result = await this.redis.incrby(key, count);
    await this.redis.expire(key, 70 * 60); // TTL a bit longer than an hour
    return result;
  }

  /**
   * Increment daily counter
   */
  async incrementDaily(key, count = 1) {
    const result = await this.redis.incrby(key, count);
    await this.redis.expire(key, 26 * 60 * 60); // TTL a bit longer than a day
    return result;
  }

  /**
   * Set value if allowed (cooldown check)
   */
  async setIfAllowed(key, value, ttlSeconds) {
    const exists = await this.redis.exists(key);
    if (exists) {
      return false; // Still in cooldown
    }

    await this.redis.setex(key, ttlSeconds, value);
    return true;
  }

  /**
   * Get hour key for Redis
   */
  getHourKey(mailboxId, date) {
    const slot = `${date.getUTCFullYear()}${this.pad(date.getUTCMonth() + 1)}${this.pad(date.getUTCDate())}${this.pad(date.getUTCHours())}`;
    return `email:hourly:${mailboxId}:${slot}`;
  }

  /**
   * Get day key for Redis
   */
  getDayKey(mailboxId, date) {
    const slot = `${date.getUTCFullYear()}${this.pad(date.getUTCMonth() + 1)}${this.pad(date.getUTCDate())}`;
    return `email:daily:${mailboxId}:${slot}`;
  }

  /**
   * Get last recipient key
   */
  getLastToKey(mailboxId, recipient) {
    return `email:last_to:${mailboxId}:${recipient.toLowerCase()}`;
  }

  /**
   * Get last domain key
   */
  getLastDomainKey(mailboxId, domain) {
    return `email:last_domain:${mailboxId}:${domain.toLowerCase()}`;
  }

  /**
   * Pad number with leading zero
   */
  pad(n) {
    return n < 10 ? `0${n}` : `${n}`;
  }

  /**
   * Create limit error
   */
  createLimitError(code, message) {
    const error = new Error(message);
    error.status = 402;
    error.code = code;
    return error;
  }

  /**
   * Validate attachment
   */
  validateAttachment(file) {
    const blockedTypes = ['.exe', '.bat', '.cmd', '.js', '.jar', '.scr', '.ps1', '.vbs', '.msi'];
    const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (blockedTypes.includes(extension)) {
      throw this.createLimitError(
        'BLOCKED_ATTACHMENT',
        `File type ${extension} is not allowed.`
      );
    }

    if (file.size > this.limits.maxAttachmentBytes) {
      throw this.createLimitError(
        'ATTACHMENT_TOO_LARGE',
        `File size exceeds ${Math.round(this.limits.maxAttachmentBytes / 1024 / 1024)} MB.`
      );
    }

    return true;
  }

  /**
   * Get remaining limits for UI
   */
  async getRemainingLimits(mailboxId) {
    const limits = await this.getUsageLimits(mailboxId);
    
    return {
      remainingHour: Math.max(0, limits.perHour - limits.usedHour),
      remainingDay: Math.max(0, limits.perDay - limits.usedDay),
      usedHour: limits.usedHour,
      usedDay: limits.usedDay,
      perHour: limits.perHour,
      perDay: limits.perDay,
    };
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

module.exports = EmailLimitsService;
