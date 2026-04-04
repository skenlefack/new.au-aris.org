import { randomUUID } from 'crypto';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

/**
 * Mock WhatsApp channel.
 * In production, replace with Twilio WhatsApp API, Meta Cloud API,
 * or any WhatsApp Business API provider.
 *
 * Required env vars (production):
 *   WHATSAPP_PROVIDER=twilio|meta
 *   WHATSAPP_FROM=+1234567890 (sender number)
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN  (if provider=twilio)
 *   META_ACCESS_TOKEN / META_PHONE_NUMBER_ID (if provider=meta)
 */
export class WhatsAppChannel implements MessageChannel {
  async send(payload: NotificationPayload): Promise<ChannelResult> {
    const messageId = randomUUID();
    console.log(`[MOCK WHATSAPP] To: ${payload.to} | Subject: ${payload.subject} | ID: ${messageId}`);
    return { success: true, messageId };
  }
}
