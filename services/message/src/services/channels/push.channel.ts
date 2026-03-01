import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

/**
 * Mock push notification channel. In production, replace with FCM or similar.
 */
export class PushChannel implements MessageChannel {
  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();
    console.log(`[MOCK PUSH] To: ${payload.to} | Subject: ${payload.subject} | ID: ${messageId}`);
    return { success: true, messageId };
  }
}
