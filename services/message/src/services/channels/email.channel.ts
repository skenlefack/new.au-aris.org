import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

export interface SmtpConfig {
  host?: string;
  port?: number;
  from?: string;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export class EmailChannel implements MessageChannel {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(config?: SmtpConfig) {
    this.fromAddress = config?.from || process.env['SMTP_FROM'] || 'noreply@au-aris.org';

    const host = config?.host || process.env['SMTP_HOST'] || 'localhost';
    const port = config?.port || parseInt(process.env['SMTP_PORT'] ?? '1025', 10);
    const secure = config?.secure ?? process.env['SMTP_SECURE'] === 'true';
    const user = config?.user || process.env['SMTP_USER'];
    const pass = config?.pass || process.env['SMTP_PASS'] || '';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user ? { auth: { user, pass } } : {}),
    });
  }

  async send(payload: NotificationPayload): Promise<ChannelResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.body,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
