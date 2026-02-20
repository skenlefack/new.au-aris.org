export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MessageChannel {
  send(payload: NotificationPayload): Promise<ChannelResult>;
}

export const EMAIL_CHANNEL = Symbol('EMAIL_CHANNEL');
export const SMS_CHANNEL = Symbol('SMS_CHANNEL');
export const PUSH_CHANNEL = Symbol('PUSH_CHANNEL');
export const IN_APP_CHANNEL = Symbol('IN_APP_CHANNEL');
