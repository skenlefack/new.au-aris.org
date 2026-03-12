import { ServerClient } from 'postmark';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

export interface PostmarkConfig {
  serverToken: string;
  from?: string;
  messageStream?: string;
  tag?: string;
}

export class PostmarkChannel implements MessageChannel {
  private readonly client: ServerClient;
  private readonly fromAddress: string;
  private readonly messageStream: string;
  private readonly tag: string | undefined;

  constructor(config?: Partial<PostmarkConfig>) {
    const token = config?.serverToken || process.env['POSTMARK_SERVER_TOKEN'];
    if (!token) {
      throw new Error(
        'POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark. ' +
          'Get your Server API Token from https://account.postmarkapp.com/servers',
      );
    }

    this.client = new ServerClient(token);
    this.fromAddress = config?.from || process.env['POSTMARK_FROM'] || 'noreply@au-aris.org';
    this.messageStream = config?.messageStream || process.env['POSTMARK_MESSAGE_STREAM'] || 'outbound';
    this.tag = config?.tag || process.env['POSTMARK_TAG'];
  }

  async send(payload: NotificationPayload): Promise<ChannelResult> {
    try {
      const metadata = payload.metadata
        ? Object.fromEntries(
            Object.entries(payload.metadata).map(([k, v]) => [k, String(v)]),
          )
        : undefined;

      const result = await this.client.sendEmail({
        From: this.fromAddress,
        To: payload.to,
        Subject: payload.subject,
        HtmlBody: payload.body,
        MessageStream: this.messageStream,
        Tag: this.tag,
        Metadata: metadata,
      });

      return { success: true, messageId: result.MessageID };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
