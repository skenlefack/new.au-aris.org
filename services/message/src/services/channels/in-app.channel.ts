import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

/**
 * In-App notification channel. Notifications are stored in DB by NotificationService
 * before this channel is invoked. This adapter confirms delivery.
 */
export class InAppChannel implements MessageChannel {
  async send(_payload: NotificationPayload): Promise<ChannelResult> {
    return { success: true, messageId: randomUUID() };
  }
}
