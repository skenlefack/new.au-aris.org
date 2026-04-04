import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

/**
 * Mock Telegram channel.
 * In production, replace with the Telegram Bot API.
 * Users must first start a chat with the ARIS bot to obtain their chat ID.
 *
 * Required env vars (production):
 *   TELEGRAM_BOT_TOKEN=your-bot-token
 *   (chat IDs are stored per-user in the credential service profile)
 */
export class TelegramChannel implements MessageChannel {
  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();
    console.log(`[MOCK TELEGRAM] To: ${payload.to} | Subject: ${payload.subject} | ID: ${messageId}`);
    return { success: true, messageId };
  }
}
