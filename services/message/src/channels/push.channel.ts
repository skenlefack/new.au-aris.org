import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from './channel.interface';

/**
 * Push notification channel adapter.
 *
 * In development mode, logs push notifications to console (mock).
 * In production, replace with Firebase Cloud Messaging or similar.
 */
@Injectable()
export class PushChannel implements MessageChannel {
  private readonly logger = new Logger(PushChannel.name);

  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();

    // Mock implementation — log and return success
    this.logger.log(
      `[MOCK PUSH] To: ${payload.to} | Subject: ${payload.subject} | ID: ${messageId}`,
    );

    return { success: true, messageId };
  }
}
