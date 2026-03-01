import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

/**
 * Mock SMS channel. In production, replace with Twilio, Africa's Talking, etc.
 */
export class SmsChannel implements MessageChannel {
  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();
    console.log(`[MOCK SMS] To: ${payload.to} | Subject: ${payload.subject} | ID: ${messageId}`);
    return { success: true, messageId };
  }
}
