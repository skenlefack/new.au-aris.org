import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from './channel.interface';

/**
 * SMS channel adapter.
 *
 * In development mode, logs SMS to console (mock).
 * In production, replace with a real SMS gateway (e.g., Twilio, Africa's Talking).
 */
@Injectable()
export class SmsChannel implements MessageChannel {
  private readonly logger = new Logger(SmsChannel.name);

  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();

    // Mock implementation — log and return success
    this.logger.log(
      `[MOCK SMS] To: ${payload.to} | Subject: ${payload.subject} | ID: ${messageId}`,
    );

    return { success: true, messageId };
  }
}
