import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from './channel.interface';

/**
 * In-App notification channel.
 *
 * In-app notifications are stored in PostgreSQL by the NotificationService
 * before this channel is invoked. This adapter is a no-op that confirms
 * the notification was "delivered" (stored and available via API).
 */
@Injectable()
export class InAppChannel implements MessageChannel {
  private readonly logger = new Logger(InAppChannel.name);

  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();

    this.logger.debug(
      `In-app notification stored for user ${payload.to}: ${payload.subject}`,
    );

    return { success: true, messageId };
  }
}
