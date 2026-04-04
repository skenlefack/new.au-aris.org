export interface NotificationPreferenceEntity {
  id: string;
  tenantId: string;
  userId: string;
  eventType: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  whatsapp: boolean;
  telegram: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * All notification event types that support per-user channel preferences.
 */
export const NOTIFICATION_EVENT_TYPES = [
  // Alerts & Events (cross-domain — animal health, fisheries, wildlife, apiculture, climate…)
  'ALERT_NEW',
  'ALERT_CONFIRMED',
  'ALERT_REGIONAL',
  // Workflow
  'WORKFLOW_APPROVED',
  'WORKFLOW_REJECTED',
  'CAMPAIGN_ASSIGNED',
  // Data Quality
  'QUALITY_FAILED',
  'CORRECTION_OVERDUE',
  // System
  'DAILY_DIGEST',
  'FORM_SUBMITTED',
] as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[number];
