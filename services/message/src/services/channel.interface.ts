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
