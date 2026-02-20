import type { DataClassification } from '@aris/shared-types';

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OfficialityLevel = 'OFFICIAL' | 'ANALYTICAL' | 'INTERNAL';
export type Frequency = 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type ExchangeMechanism = 'API' | 'KAFKA' | 'BATCH' | 'MANUAL';

export interface QualitySla {
  correctionDeadline: number;   // Hours to correct failed records
  escalationDeadline: number;   // Hours before escalation
  minPassRate: number;           // Minimum quality gate pass rate (0-1)
}

export interface DataContractEntity {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  dataOwner: string;
  dataSteward: string;
  purpose: string;
  officialityLevel: OfficialityLevel;
  schema: unknown;
  frequency: Frequency;
  timelinessSla: number;
  qualitySla: QualitySla;
  classification: DataClassification;
  exchangeMechanism: ExchangeMechanism;
  version: number;
  status: ContractStatus;
  validFrom: Date;
  validTo: Date | null;
  approvedBy: string;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceRecordEntity {
  id: string;
  contractId: string;
  tenantId: string;
  recordId: string;
  eventType: string;
  eventTimestamp: Date;
  submissionTime: Date | null;
  qualityPassed: boolean | null;
  timelinessHours: number | null;
  slaMet: boolean | null;
  qualityReportId: string | null;
  createdAt: Date;
}

export interface ComplianceMetrics {
  contractId: string;
  contractName: string;
  period: { from: Date; to: Date };
  totalSubmissions: number;
  onTimeSubmissions: number;
  lateSubmissions: number;
  timelinessRate: number;         // 0-1
  qualityPassCount: number;
  qualityFailCount: number;
  qualityPassRate: number;         // 0-1
  averageTimelinessHours: number;
  slaMet: boolean;
  overdueCount: number;
  atRisk: boolean;
}
