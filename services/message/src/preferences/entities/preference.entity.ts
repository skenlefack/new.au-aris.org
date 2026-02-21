export interface NotificationPreferenceEntity {
  id: string;
  tenantId: string;
  userId: string;
  eventType: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * All notification event types that support per-user channel preferences.
 */
export const NOTIFICATION_EVENT_TYPES = [
  'WORKFLOW_APPROVED',
  'WORKFLOW_REJECTED',
  'QUALITY_FAILED',
  'CORRECTION_OVERDUE',
  'OUTBREAK_ALERT',
  'CAMPAIGN_ASSIGNED',
  'DAILY_DIGEST',
  'FORM_SUBMITTED',
] as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[number];
