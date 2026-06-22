export type SubmissionStatusType =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'REJECTED'
  | 'RETURNED'
  | 'CONFLICT';

export type ConflictResolutionStatusType = 'PENDING' | 'RESOLVED';

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
  conflictStatus: ConflictResolutionStatusType | null;
  conflictClientData: unknown | null;
  conflictClientVersion: number | null;
  conflictDetectedAt: Date | null;
  conflictResolvedAt: Date | null;
  conflictResolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
