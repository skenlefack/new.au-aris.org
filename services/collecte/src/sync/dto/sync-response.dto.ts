export interface SyncRejection {
  id: string;
  errors: { field: string; message: string }[];
}

export interface ConflictInfo {
  submissionId: string;
  clientVersion: number;
  serverVersion: number;
  strategy: 'LAST_WRITE_WINS' | 'MANUAL_MERGE';
  resolvedBy: 'client' | 'server' | 'pending';
}

export interface CampaignUpdate {
  id: string;
  status: string;
  name: string;
  startDate: Date;
  endDate: Date;
  updatedAt: Date;
}

export interface SyncResponse {
  accepted: string[];
  rejected: SyncRejection[];
  conflicts: ConflictInfo[];
  serverUpdates: CampaignUpdate[];
  syncedAt: string;
}
