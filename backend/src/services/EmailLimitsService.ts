import Redis from 'ioredis';
import config from '../config';
import { ChannelUsage } from '../models';

interface EmailLimitsArgs {
  userId: string;
  mailboxId: string;
  to?: string[];
  domains?: string[];
  isReply?: boolean;
  attachmentBytes?: number;
  now?: Date;
}

interface LimitError {
  code: string;
  message: string;
  retryAfter?: number;
}

class EmailLimitsService {
  private redis: Redis;
  private limits: any;

  constructor() {
    this.redis = new Redis(config.redis.url, config.redis.options);
    this.limits = config.email;
  }

  /**
   * Enforce email safety limits
   */
  async enforceLimits(args: EmailLimitsArgs): Promise<void> {
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
        'TOO_MANY_RECIPIENTS',
        `Too many recipients. Maximum ${this.limits.maxRecipientsPerMessage} allowed.`
      );
    }

    if (attachmentBytes > this.limits.maxAttachmentBytes) {
      throw this.createLimitError(
        'ATTACHMENT_TOO_LARGE',
        `Attachment too large. Maximum ${this.limits.maxAttachmentBytes} bytes allowed.`
      );
    }

    // 2) Rate limits
    await this.checkRateLimits(userId, now);

    // 3) Per-recipient cooldowns
    await this.checkRecipientCooldowns(userId, to, now);

    // 4) Per-domain cooldowns
    await this.checkDomainCooldowns(userId, domains, now);

    // 5) Trial daily cap
    await this.checkTrialDailyCap(userId, now);
  }

  /**
   * Check rate limits
   */
  private async checkRateLimits(userId: string, now: Date): Promise<void> {
    const hourKey = `email:rate:hour:${userId}:${now.getHours()}`;
    const dayKey = `email:rate:day:${userId}:${now.getDate()}`;

    const [hourCount, dayCount] = await Promise.all([
      this.redis.get(hourKey),
      this.redis.get(dayKey),
    ]);

    if (parseInt(hourCount || '0') >= this.limits.maxPerHour) {
      throw this.createLimitError(
        'HOURLY_LIMIT_EXCEEDED',
        `Hourly limit exceeded. Maximum ${this.limits.maxPerHour} emails per hour.`,
        3600 // 1 hour
      );
    }

    if (parseInt(dayCount || '0') >= this.limits.maxPerDay) {
      throw this.createLimitError(
        'DAILY_LIMIT_EXCEEDED',
        `Daily limit exceeded. Maximum ${this.limits.maxPerDay} emails per day.`,
        86400 // 24 hours
      );
    }
  }

  /**
   * Check per-recipient cooldowns
   */
  private async checkRecipientCooldowns(userId: string, recipients: string[], now: Date): Promise<void> {
    for (const recipient of recipients) {
      const key = `email:cooldown:recipient:${userId}:${recipient}`;
      const lastSent = await this.redis.get(key);

      if (lastSent) {
        const timeSinceLastSent = now.getTime() - parseInt(lastSent);
        const cooldownMs = this.limits.perRecipientCooldownSec * 1000;

        if (timeSinceLastSent < cooldownMs) {
          const remainingMs = cooldownMs - timeSinceLastSent;
          throw this.createLimitError(
            'RECIPIENT_COOLDOWN',
            `Too soon to send to ${recipient}. Please wait ${Math.ceil(remainingMs / 1000)} seconds.`,
            Math.ceil(remainingMs / 1000)
          );
        }
      }
    }
  }

  /**
   * Check per-domain cooldowns
   */
  private async checkDomainCooldowns(userId: string, domains: string[], now: Date): Promise<void> {
    for (const domain of domains) {
      const key = `email:cooldown:domain:${userId}:${domain}`;
      const lastSent = await this.redis.get(key);

      if (lastSent) {
        const timeSinceLastSent = now.getTime() - parseInt(lastSent);
        const cooldownMs = this.limits.perDomainCooldownSec * 1000;

        if (timeSinceLastSent < cooldownMs) {
          const remainingMs = cooldownMs - timeSinceLastSent;
          throw this.createLimitError(
            'DOMAIN_COOLDOWN',
            `Too soon to send to ${domain}. Please wait ${Math.ceil(remainingMs / 1000)} seconds.`,
            Math.ceil(remainingMs / 1000)
          );
        }
      }
    }
  }

  /**
   * Check trial daily cap
   */
  private async checkTrialDailyCap(userId: string, now: Date): Promise<void> {
    // This would check if user is on trial and enforce daily cap
    // For now, just a placeholder
    const dayKey = `email:trial:day:${userId}:${now.getDate()}`;
    const dayCount = await this.redis.get(dayKey);

    if (parseInt(dayCount || '0') >= this.limits.trialDailyCap) {
      throw this.createLimitError(
        'TRIAL_DAILY_CAP_EXCEEDED',
        `Trial daily cap exceeded. Maximum ${this.limits.trialDailyCap} emails per day on trial.`,
        86400 // 24 hours
      );
    }
  }

  /**
   * Record email send
   */
  async recordEmailSend(args: EmailLimitsArgs): Promise<void> {
    const {
      userId,
      to = [],
      domains = [],
      now = new Date(),
    } = args;

    // Record rate limits
    const hourKey = `email:rate:hour:${userId}:${now.getHours()}`;
    const dayKey = `email:rate:day:${userId}:${now.getDate()}`;

    await Promise.all([
      this.redis.incr(hourKey),
      this.redis.incr(dayKey),
    ]);

    // Set expiration for rate limit keys
    await Promise.all([
      this.redis.expire(hourKey, 3600), // 1 hour
      this.redis.expire(dayKey, 86400), // 24 hours
    ]);

    // Record per-recipient cooldowns
    for (const recipient of to) {
      const key = `email:cooldown:recipient:${userId}:${recipient}`;
      await this.redis.set(key, now.getTime().toString());
      await this.redis.expire(key, this.limits.perRecipientCooldownSec);
    }

    // Record per-domain cooldowns
    for (const domain of domains) {
      const key = `email:cooldown:domain:${userId}:${domain}`;
      await this.redis.set(key, now.getTime().toString());
      await this.redis.expire(key, this.limits.perDomainCooldownSec);
    }

    // Record trial usage
    const trialKey = `email:trial:day:${userId}:${now.getDate()}`;
    await this.redis.incr(trialKey);
    await this.redis.expire(trialKey, 86400); // 24 hours
  }

  /**
   * Create limit error
   */
  private createLimitError(code: string, message: string, retryAfter?: number): LimitError {
    const error: LimitError = { code, message };
    if (retryAfter) {
      error.retryAfter = retryAfter;
    }
    return error;
  }

  /**
   * Get current usage for user
   */
  async getCurrentUsage(userId: string): Promise<Record<string, any>> {
    const now = new Date();
    const hourKey = `email:rate:hour:${userId}:${now.getHours()}`;
    const dayKey = `email:rate:day:${userId}:${now.getDate()}`;
    const trialKey = `email:trial:day:${userId}:${now.getDate()}`;

    const [hourCount, dayCount, trialCount] = await Promise.all([
      this.redis.get(hourKey),
      this.redis.get(dayKey),
      this.redis.get(trialKey),
    ]);

    return {
      hourly: parseInt(hourCount || '0'),
      daily: parseInt(dayCount || '0'),
      trial: parseInt(trialCount || '0'),
      limits: {
        maxPerHour: this.limits.maxPerHour,
        maxPerDay: this.limits.maxPerDay,
        trialDailyCap: this.limits.trialDailyCap,
      },
    };
  }
}

export default EmailLimitsService;
