export interface NotificationEntity {
  id: string;
  tenantId: string;
  userId: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  metadata: unknown;
  readAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
