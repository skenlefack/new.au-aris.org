export type CampaignStatusType = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ConflictStrategyType = 'LAST_WRITE_WINS' | 'MANUAL_MERGE';

export interface CampaignEntity {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  templateId: string;
  startDate: Date;
  endDate: Date;
  targetZones: string[];
  assignedAgents: string[];
  targetSubmissions: number | null;
  status: CampaignStatusType;
  description: string | null;
  conflictStrategy: ConflictStrategyType;
  dataContractId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignWithProgress extends CampaignEntity {
  progress: {
    totalSubmissions: number;
    validated: number;
    rejected: number;
    pending: number;
    completionRate: number;
  };
}
