export type SubmissionStatusType =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'REJECTED';

export interface SubmissionEntity {
  id: string;
  tenantId: string;
  campaignId: string;
  templateId: string;
  data: unknown;
  submittedBy: string;
  submittedAt: Date;
  deviceId: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  offlineCreatedAt: Date | null;
  syncedAt: Date | null;
  qualityReportId: string | null;
  workflowInstanceId: string | null;
  status: SubmissionStatusType;
  dataClassification: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
