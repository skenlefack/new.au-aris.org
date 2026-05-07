// Sync Request/Response DTOs shared between mobile and backend

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT',
}

export enum ConflictStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  MANUAL_MERGE = 'MANUAL_MERGE',
}

export interface SyncSubmissionPayload {
  id?: string;
  campaignId: string;
  templateId: string;
  data: Record<string, unknown>;
  deviceId?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  offlineCreatedAt: string;
  dataClassification?: string;
  version: number;
}

export interface SyncRequest {
  submissions: SyncSubmissionPayload[];
  lastSyncAt: string;
  deviceId?: string;
  platform?: string;
  clientVersion?: string;
}

export interface SyncConflictDetail {
  submissionId: string;
  clientVersion: number;
  serverVersion: number;
  resolvedBy: 'client' | 'server' | 'pending';
  serverData?: Record<string, unknown>;
}

export interface SyncResponse {
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
  conflicts: SyncConflictDetail[];
  serverUpdates: {
    campaigns: Array<{ id: string; name: string; status: string; updatedAt: string }>;
    templates: Array<{ id: string; name: string; version: number }>;
    referentials: Array<{ type: string; updatedAt: string; count: number }>;
  };
  syncedAt: string;
  nextSyncRecommendedMs: number;
}

export interface SyncStatusSummary {
  userId: string;
  deviceId?: string;
  lastSyncAt: string;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  totalSubmissions: number;
}

export interface SyncDeltaRequest {
  since: string;
  types?: ('campaigns' | 'templates' | 'referentials' | 'submissions')[];
}

export interface SyncDeltaResponse {
  updatedCampaigns: Array<{ id: string; name: string; status: string; target: number; updatedAt: string }>;
  updatedTemplates: Array<{ id: string; name: string; domain: string; version: number; updatedAt: string }>;
  updatedReferentials: Array<{ type: string; count: number; lastUpdated: string }>;
  workflowUpdates: Array<{ submissionId: string; level: number; status: string; updatedAt: string }>;
  deletedCampaigns: string[];
  serverTime: string;
}
