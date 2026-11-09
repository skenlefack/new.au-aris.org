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

export interface ProviderCheck {
  ok: boolean;
  detail: string;
}

export interface MessageChannel {
  send(payload: NotificationPayload): Promise<ChannelResult>;
  /** Check that the provider accepts our credentials (no email is sent). */
  verify?(): Promise<ProviderCheck>;
}
