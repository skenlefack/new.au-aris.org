import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';

export class EmailChannel implements MessageChannel {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor() {
    this.fromAddress = process.env['SMTP_FROM'] ?? 'noreply@au-aris.org';

    this.transporter = nodemailer.createTransport({
      host: process.env['SMTP_HOST'] ?? 'localhost',
      port: parseInt(process.env['SMTP_PORT'] ?? '1025', 10),
      secure: process.env['SMTP_SECURE'] === 'true',
      ...(process.env['SMTP_USER']
        ? {
            auth: {
              user: process.env['SMTP_USER'],
              pass: process.env['SMTP_PASS'] ?? '',
            },
          }
        : {}),
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
